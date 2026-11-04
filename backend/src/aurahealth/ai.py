"""The AI helper behind the text helper, the guide finder and the photo reader.

Default: Meta Muse Glimmer 30B (Meta open weights, Apache 2.0), hosted free by NVIDIA (build.nvidia.com). It needs
internet and an NVIDIA API key (NVIDIA_API_KEY, saved by scripts/set-nvidia-key.ps1); the key is never logged,
returned or stored by AuraHealth. AURA_AI=spark uses Muse Spark on the Meta Model API instead (MODEL_API_KEY, spending
capped in meta_api.py). Optional: Llama 3.2 3B on this laptop (AURA_AI=llama), offline. Either way the model's reply
is untrusted: the callers check it (exact words, fixed guide list) and a person confirms.

The emergency path (112 button, first-aid steps, night guard, calls, card) never needs this.
"""

from __future__ import annotations

import os
import re
import sys
import time

import httpx

from . import config, meta_api, ollama

ModelUnavailable = ollama.ModelUnavailable
_THINK = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def nvidia_key() -> str | None:
    key = (os.environ.get("NVIDIA_API_KEY") or "").strip()
    if key:
        return key
    if sys.platform == "win32":  # set with SetEnvironmentVariable(..., "User"): visible to new processes only
        try:
            import winreg

            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as handle:
                value, _ = winreg.QueryValueEx(handle, "NVIDIA_API_KEY")
                return str(value).strip() or None
        except OSError:
            return None
    return None


def provider() -> str:
    return config.AI_PROVIDER if config.AI_PROVIDER in ("llama", "spark") else "glimmer"


def model_name() -> str:
    return {"llama": config.TEXT_MODEL, "spark": config.META_MODEL}.get(provider(), config.GLIMMER_MODEL)


def status() -> dict:
    """Never raises and never calls the internet: a key counts as ready; network errors show up per call."""
    if provider() == "llama":
        return {"ready": ollama.status()["text"], "provider": "llama", "model": config.TEXT_MODEL, "online": False,
                "images": False}
    if provider() == "spark":
        return {"ready": meta_api.available(), "provider": "spark", "model": config.META_MODEL, "online": True, "images": True}
    return {"ready": bool(nvidia_key()), "provider": "glimmer", "model": config.GLIMMER_MODEL, "online": True,
            "images": True}


def chat_json(system: str, user: str, schema: dict, timeout_s: float | None = None,
              images_b64: list[str] | None = None) -> tuple[str, dict]:
    """One call that should return a JSON object. Returns (raw text, timing)."""
    if provider() == "llama":
        if images_b64:
            raise ModelUnavailable("the laptop text model cannot read images")
        return ollama.chat_json(config.TEXT_MODEL, system, user, schema, timeout_s or config.TEXT_TIMEOUT_S)
    if provider() == "spark":
        return _spark(system, user, timeout_s or config.META_TIMEOUT_S, images_b64)
    return _glimmer(system, user, timeout_s or config.GLIMMER_TIMEOUT_S, images_b64)


def _spark(system: str, user: str, timeout_s: float, images_b64: list[str] | None) -> tuple[str, dict]:
    key = meta_api.api_key()
    if not key:
        raise ModelUnavailable("no Meta API key is set (run scripts/set-meta-key.ps1)")
    if meta_api.spent() + config.META_CALL_RESERVE_USD > config.MAX_META_SPEND_USD:
        raise ModelUnavailable(f"the AuraHealth spending cap of ${config.MAX_META_SPEND_USD:.2f} is reached")
    content: list[dict] = [{"type": "input_text", "text": user}]
    content += [{"type": "input_image", "image_url": f"data:image/jpeg;base64,{b64}"} for b64 in images_b64 or []]
    body = {
        "model": config.META_MODEL,
        "instructions": system,
        "input": [{"type": "message", "role": "user", "content": content}],
        "store": False,
        "max_output_tokens": 2500,
        "reasoning": {"effort": config.META_EFFORT},
        "text": {"format": {"type": "json_object"}},
    }
    started = time.perf_counter()
    try:
        resp = httpx.post(f"{config.META_API_BASE}/responses", json=body, timeout=httpx.Timeout(timeout_s, connect=10),
                          headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    except httpx.TimeoutException as exc:
        raise ModelUnavailable(f"Muse Spark did not answer within {timeout_s:.0f} s") from exc
    except httpx.HTTPError as exc:
        raise ModelUnavailable(f"could not reach Meta (no internet?): {type(exc).__name__}") from exc
    if resp.status_code in (401, 403):
        raise ModelUnavailable("Meta did not accept the API key")
    if resp.status_code == 429:
        raise ModelUnavailable("Meta's rate limit was reached; try again in a minute")
    if resp.status_code >= 400:
        raise ModelUnavailable(f"Muse Spark returned HTTP {resp.status_code}")
    data = resp.json()
    usage = data.get("usage") or {}
    usd = meta_api.cost(usage)
    meta_api._add_spend(usd)
    timing = {
        "wall_s": round(time.perf_counter() - started, 2),
        "prompt_tokens": usage.get("input_tokens"),
        "output_tokens": usage.get("output_tokens"),
        "cost_usd": round(usd, 5),
        "model": data.get("model", config.META_MODEL),
    }
    return _THINK.sub("", meta_api.output_text(data)).strip(), timing


def _glimmer(system: str, user: str, timeout_s: float, images_b64: list[str] | None) -> tuple[str, dict]:
    key = nvidia_key()
    if not key:
        raise ModelUnavailable("no NVIDIA API key is set (run scripts/set-nvidia-key.ps1)")
    content: list[dict] | str = user
    if images_b64:
        content = [{"type": "text", "text": user}] + [
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}} for b64 in images_b64]
    body = {
        "model": config.GLIMMER_MODEL,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": content}],
        "temperature": 0,
        "max_tokens": 1500,
        "response_format": {"type": "json_object"},
        # Muse Glimmer thinks before it answers. "low" took about half the time (8 s vs 17 s) on 31 Oct, same answer.
        "reasoning_effort": "low",
    }
    started = time.perf_counter()
    try:
        with httpx.Client(timeout=httpx.Timeout(timeout_s, connect=10)) as client:
            resp = client.post(f"{config.NVIDIA_API_BASE}/chat/completions", json=body,
                               headers={"Authorization": f"Bearer {key}", "Accept": "application/json"})
            if resp.status_code in (400, 422):  # a host may reject the optional settings: ask without them
                body.pop("response_format")
                body.pop("reasoning_effort")
                resp = client.post(f"{config.NVIDIA_API_BASE}/chat/completions", json=body,
                                   headers={"Authorization": f"Bearer {key}", "Accept": "application/json"})
    except httpx.TimeoutException as exc:
        raise ModelUnavailable(f"Muse Glimmer did not answer within {timeout_s:.0f} s") from exc
    except httpx.HTTPError as exc:
        raise ModelUnavailable(f"could not reach NVIDIA (no internet?): {type(exc).__name__}") from exc
    if resp.status_code == 401 or resp.status_code == 403:
        raise ModelUnavailable("NVIDIA did not accept the API key")
    if resp.status_code == 429:
        raise ModelUnavailable("NVIDIA's free limit was reached; try again in a minute")
    if resp.status_code >= 400:
        raise ModelUnavailable(f"Muse Glimmer returned HTTP {resp.status_code}")
    data = resp.json()
    usage = data.get("usage") or {}
    text = ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    timing = {
        "wall_s": round(time.perf_counter() - started, 2),
        "prompt_tokens": usage.get("prompt_tokens"),
        "output_tokens": usage.get("completion_tokens"),
        "model": data.get("model", config.GLIMMER_MODEL),
    }
    return _THINK.sub("", text).strip(), timing
