"""Minimal client for a local Ollama server (default http://127.0.0.1:11434).

Only localhost is used. Model replies are untrusted: callers validate them.
"""

from __future__ import annotations

import time

import httpx

from . import config


class ModelUnavailable(RuntimeError):
    pass


def status() -> dict:
    """Which models are installed and whether the runtime answers. Never raises."""
    try:
        resp = httpx.get(f"{config.OLLAMA_URL}/api/tags", timeout=3)
        resp.raise_for_status()
        names = {m.get("name") for m in resp.json().get("models", [])}
    except Exception:  # runtime not running or not installed
        return {"runtime": False, "text": False, "vision": False,
                "text_model": config.TEXT_MODEL, "vision_model": config.VISION_MODEL}
    return {
        "runtime": True,
        "text": _installed(config.TEXT_MODEL, names),
        "vision": _installed(config.VISION_MODEL, names),
        "text_model": config.TEXT_MODEL,
        "vision_model": config.VISION_MODEL,
    }


def _installed(model: str, names: set) -> bool:
    if model in names:
        return True
    base, _, tag = model.partition(":")
    return tag in ("", "latest") and f"{base}:latest" in names


def chat_json(model: str, system: str, user: str, schema: dict, timeout_s: float,
              images_b64: list[str] | None = None, temperature: float = 0.0) -> tuple[str, dict]:
    """One non-streaming chat call constrained to a JSON schema. Returns (raw text, timing)."""
    message: dict = {"role": "user", "content": user}
    if images_b64:
        message["images"] = images_b64
    body = {
        "model": model,
        "messages": [{"role": "system", "content": system}, message],
        "format": schema,
        "stream": False,
        "options": {"temperature": temperature},
        "keep_alive": "10m",
    }
    started = time.perf_counter()
    try:
        resp = httpx.post(f"{config.OLLAMA_URL}/api/chat", json=body, timeout=httpx.Timeout(timeout_s, connect=5))
    except httpx.TimeoutException as exc:
        raise ModelUnavailable(f"{model} timed out after {timeout_s:.0f} s") from exc
    except httpx.HTTPError as exc:
        raise ModelUnavailable(f"could not reach the local model runtime: {type(exc).__name__}") from exc
    if resp.status_code == 404:
        raise ModelUnavailable(f"{model} is not installed")
    if resp.status_code >= 400:
        try:  # e.g. "model requires more system memory than is available"; never contains document text
            detail = str(resp.json().get("error", ""))[:200]
        except ValueError:
            detail = ""
        raise ModelUnavailable(f"{model} returned HTTP {resp.status_code}" + (f": {detail}" if detail else ""))
    data = resp.json()
    timing = {
        "wall_s": round(time.perf_counter() - started, 2),
        "load_s": round((data.get("load_duration") or 0) / 1e9, 2),
        "prompt_tokens": data.get("prompt_eval_count"),
        "output_tokens": data.get("eval_count"),
        "model": data.get("model", model),
    }
    return (data.get("message") or {}).get("content", ""), timing
