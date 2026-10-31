"""Meta Model API (online), used to read a photo of a report or medicine strip with Muse Spark.

- Used only when a key is set (MODEL_API_KEY, saved by scripts/set-meta-key.ps1) and only when the person
  taps the online reader; the page says that the photo is sent to Meta's servers.
- The key is read from the environment and never logged, returned or stored by AuraHealth.
- Spending is capped (AURA_MAX_META_SPEND_USD, default 2.00) using Meta's published prices.
- Request shape: POST {base}/responses with input_text + input_image parts (dev.meta.ai/docs, read 2026-10-29,
  same shape as the PointCaption project).
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time

import httpx

from . import config


class MetaUnavailable(RuntimeError):
    pass


class BudgetExceeded(RuntimeError):
    pass


_LOCK = threading.Lock()


def api_key() -> str | None:
    key = (os.environ.get("MODEL_API_KEY") or "").strip()
    if key:
        return key
    if sys.platform == "win32":  # set with SetEnvironmentVariable(..., "User"): visible to new processes only
        try:
            import winreg

            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as handle:
                value, _ = winreg.QueryValueEx(handle, "MODEL_API_KEY")
                return str(value).strip() or None
        except OSError:
            return None
    return None


def available() -> bool:
    return bool(api_key())


def _spend_path():
    return config.DATA_DIR / "meta_spend.json"


def spent() -> float:
    try:
        return float(json.loads(_spend_path().read_text(encoding="utf-8")).get("usd", 0.0))
    except (OSError, ValueError):
        return 0.0


def _add_spend(usd: float) -> None:
    with _LOCK:
        total = spent() + usd
        config.DATA_DIR.mkdir(parents=True, exist_ok=True)
        _spend_path().write_text(json.dumps({"usd": round(total, 6), "updated": time.time()}), encoding="utf-8")


def cost(usage: dict | None) -> float:
    usage = usage or {}
    inp = float(usage.get("input_tokens") or usage.get("prompt_tokens") or 0)
    out = float(usage.get("output_tokens") or usage.get("completion_tokens") or 0)
    return inp / 1e6 * config.PRICE_META_INPUT_PER_M + out / 1e6 * config.PRICE_META_OUTPUT_PER_M


def output_text(data: dict) -> str:
    if isinstance(data.get("output_text"), str):
        return data["output_text"]
    parts: list[str] = []
    for item in data.get("output", []) or []:
        for content in item.get("content", []) or []:
            if content.get("type") in ("output_text", "text") and "text" in content:
                parts.append(str(content["text"]))
    return "".join(parts)


def read_image(instructions: str, request: str, jpeg_b64: str) -> tuple[str, dict]:
    """One Muse Spark call with the image. Returns (model text, timing). Raises MetaUnavailable or BudgetExceeded."""
    key = api_key()
    if not key:
        raise MetaUnavailable("no Meta API key is set")
    if spent() + config.META_CALL_RESERVE_USD > config.MAX_META_SPEND_USD:
        raise BudgetExceeded(f"the AuraHealth spending cap of ${config.MAX_META_SPEND_USD:.2f} is reached")
    body = {
        "model": config.META_MODEL,
        "input": [{
            "type": "message",
            "role": "user",
            "content": [
                {"type": "input_text", "text": f"{instructions}\n\n{request}"},
                {"type": "input_image", "image_url": f"data:image/jpeg;base64,{jpeg_b64}"},
            ],
        }],
    }
    started = time.perf_counter()
    try:
        resp = httpx.post(f"{config.META_API_BASE}/responses", json=body, timeout=httpx.Timeout(config.META_TIMEOUT_S, connect=15),
                          headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    except httpx.TimeoutException as exc:
        raise MetaUnavailable(f"Meta did not answer within {config.META_TIMEOUT_S:.0f} s") from exc
    except httpx.HTTPError as exc:
        raise MetaUnavailable(f"could not reach Meta: {type(exc).__name__} (is the internet on?)") from exc
    if resp.status_code in (401, 403):
        raise MetaUnavailable(f"Meta refused the key (HTTP {resp.status_code})")
    if resp.status_code >= 400:
        raise MetaUnavailable(f"Meta returned HTTP {resp.status_code}")
    data = resp.json()
    usage = data.get("usage") or {}
    usd = cost(usage)
    _add_spend(usd)
    timing = {
        "wall_s": round(time.perf_counter() - started, 2),
        "load_s": 0.0,
        "output_tokens": usage.get("output_tokens"),
        "cost_usd": round(usd, 5),
        "model": config.META_MODEL,
    }
    return output_text(data), timing
