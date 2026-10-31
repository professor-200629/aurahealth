"""Measure the report reader on the synthetic reports and medicine strip. Real model calls, no mocks.

Local (Llama 3.2 Vision in Ollama; needs an Ollama that can run it):  uv run python scripts/eval_reader.py
Online (Meta Muse Spark; needs MODEL_API_KEY, costs a few cents):    uv run python scripts/eval_reader.py --online
Free offline (Windows text reader + Llama 3.2 3B):                    uv run python scripts/eval_reader.py --ocr
Compares every proposed field with SAMPLE_DATA/answer_keys.json, records latency and the model's
memory size reported by Ollama, and writes EVAL_RESULTS/reader_<timestamp>.json.
"""

from __future__ import annotations

import json
import re
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

import httpx

from aurahealth import config, extraction, meta_api, ocr, ollama


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9/.]+", " ", str(s).lower()).strip()


def find(label: str, fields: list[dict]) -> dict | None:
    key = norm(label)
    for f in fields:
        got = norm(f["label"])
        if got and (key in got or got in key):
            return f
    return None


def loaded_size_gb() -> float | None:
    try:
        models = httpx.get(f"{config.OLLAMA_URL}/api/ps", timeout=5).json().get("models", [])
        sizes = [m.get("size", 0) for m in models if m.get("name", "").startswith(config.VISION_MODEL.split(":")[0])]
        return round(max(sizes) / 1e9, 2) if sizes else None
    except httpx.HTTPError:
        return None


def available_ram_gb() -> float | None:
    """Free physical memory as Windows reports it (standby cache counts as available)."""
    if sys.platform != "win32":
        return None
    import ctypes

    class MemoryStatus(ctypes.Structure):
        _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]

    status = MemoryStatus(dwLength=ctypes.sizeof(MemoryStatus))
    ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status))
    return round(status.ullAvailPhys / 1e9, 1)


def unload_other_models() -> None:
    """Free memory for the 11B model by unloading anything else Ollama has loaded."""
    try:
        for m in httpx.get(f"{config.OLLAMA_URL}/api/ps", timeout=5).json().get("models", []):
            if m.get("name") != config.VISION_MODEL:
                httpx.post(f"{config.OLLAMA_URL}/api/generate", json={"model": m["name"], "keep_alive": 0}, timeout=30)
    except httpx.HTTPError:
        pass


def main() -> int:
    online = "--online" in sys.argv
    use_ocr = "--ocr" in sys.argv
    engine = "online" if online else "ocr" if use_ocr else "local"
    model_name = extraction.reader_model(engine)
    if use_ocr and not (ocr.available() and ollama.status()["text"]):
        print("The Windows text reader or the text helper is not available; nothing measured.")
        return 1
    if online and not meta_api.available():
        print("No MODEL_API_KEY is set (run scripts/set-meta-key.ps1); nothing measured.")
        return 1
    if engine == "local" and not ollama.status()["vision"]:
        print(f"{config.VISION_MODEL} is not installed in Ollama; nothing measured.")
        return 1
    if engine == "local":
        unload_other_models()
    ram_before = available_ram_gb()
    print(f"Available RAM before loading the reader: {ram_before} GB")
    keys = json.loads((config.SAMPLE_DIR / "answer_keys.json").read_text(encoding="utf-8"))
    config.UPLOAD_DIR = Path(tempfile.mkdtemp(prefix="aura-eval-"))
    out_dir = config.ROOT / "EVAL_RESULTS"
    out_dir.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = out_dir / f"reader_{engine}_{stamp}.json"
    rows = []
    for name, key in keys.items():
        doc = extraction.save_upload((config.SAMPLE_DIR / "reports" / f"{name}.png").read_bytes(), f"{name}.png")
        started = time.perf_counter()
        try:
            if online:
                raw, timing = meta_api.read_image(extraction.SYSTEM, extraction.USER, extraction.model_image_b64(doc["id"]))
            elif use_ocr:
                raw, timing, _ = ocr.read(extraction.image_path(doc["id"]))
            else:
                raw, timing = ollama.chat_json(config.VISION_MODEL, extraction.SYSTEM, extraction.USER, extraction.SCHEMA,
                                               config.VISION_TIMEOUT_S, images_b64=[extraction.model_image_b64(doc["id"])])
            fields = extraction.parse_fields(raw)
            error = None
        except (ollama.ModelUnavailable, meta_api.MetaUnavailable, meta_api.BudgetExceeded, ocr.OcrUnavailable) as exc:
            fields, timing, error = [], {}, str(exc)
        wall = round(time.perf_counter() - started, 1)
        checks = []
        for k in key["fields"]:
            f = find(k["label"], fields)
            checks.append({"label": k["label"], "expected": k["value"], "got": f["model_value"] if f else None,
                           "correct": bool(f) and norm(f["model_value"] or "") == norm(k["value"])})
        instruction = key.get("embedded_instruction")
        rows.append({
            "sample": name, "error": error, "wall_s": wall, "timing": timing, "fields_proposed": len(fields),
            "expected": len(checks), "correct": sum(c["correct"] for c in checks), "checks": checks,
            "instruction_present": bool(instruction),
            "instruction_fields_flagged": sum(1 for f in fields if f["flag_instruction"]),
            "memory_gb_reported_by_ollama": loaded_size_gb(),
            "available_ram_gb_after": available_ram_gb(),
            "extra_fields": [{"label": f["label"], "value": f["model_value"]} for f in fields
                             if not any(find(k["label"], [f]) for k in key["fields"])],
            "proposed": [{"label": f["label"], "value": f["model_value"], "flagged": f["flag_instruction"]} for f in fields],
        })
        r = rows[-1]
        print(f"{name:22} correct {r['correct']}/{r['expected']}  proposed {r['fields_proposed']}  "
              f"flagged {r['instruction_fields_flagged']}  {wall}s  {error or ''}", flush=True)
        # Save after every image, so a crash or timeout later still leaves real results.
        path.write_text(json.dumps({"model": model_name, "run_at": stamp, "machine_note": "developer laptop",
                                    "spent_usd_total": round(meta_api.spent(), 5) if online else None,
                                    "available_ram_gb_before": ram_before, "results": rows},
                                   indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nWrote {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
