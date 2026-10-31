"""AuraHealth: an experimental offline emergency communication and handoff assistant (research prototype)."""

from __future__ import annotations

import argparse
import socket


def _lan_addresses() -> list[str]:
    addresses = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith(("127.", "169.254.")):
                addresses.add(ip)
    except OSError:
        pass
    return sorted(addresses)


def _stable_pair_code() -> str:
    """Keep the pairing code across restarts so a paired phone keeps working. Delete the file to change it."""
    import secrets

    from . import config

    path = config.DATA_DIR / "pair_code.txt"
    try:
        code = path.read_text(encoding="utf-8").strip()
        if len(code) >= 8:
            return code
    except OSError:
        pass
    code = secrets.token_urlsafe(6)
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(code, encoding="utf-8")
    return code


def main() -> None:
    import uvicorn

    from . import app as app_module
    from . import ollama

    parser = argparse.ArgumentParser(prog="aurahealth", description="Run the AuraHealth local server.")
    parser.add_argument("--lan", action="store_true",
                        help="also listen on the local network so a phone on the same trusted Wi-Fi can connect")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    app_module.STATE["lan"] = args.lan
    if args.lan:
        app_module.STATE["pair_code"] = _stable_pair_code()
    host = "0.0.0.0" if args.lan else "127.0.0.1"
    status = ollama.status()
    print("\nAuraHealth (research prototype, simulation only)")
    print(f"  On this laptop:  http://127.0.0.1:{args.port}/")
    if args.lan:
        code = app_module.STATE["pair_code"]
        print("  Phone pairing links (open ONE on your phone, on the same trusted Wi-Fi):")
        for ip in _lan_addresses():
            print(f"    http://{ip}:{args.port}/pair?code={code}")
        print("  Anyone on this network with the link can open the app. Use a trusted network only.")
        print("  The code stays the same after restarts; delete data/pair_code.txt to make a new one.")
    else:
        print("  Local only. Add --lan to let your phone connect over Wi-Fi.")
    from . import ai, config, meta_api, ocr

    helper = ai.status()
    if helper["provider"] == "glimmer":
        state = "key set (needs internet)" if helper["ready"] else "NO KEY: run scripts/set-nvidia-key.ps1"
        print(f"  AI helper: Meta Muse Glimmer ({helper['model']}, hosted free by NVIDIA): {state}")
    else:
        print(f"  AI helper: {helper['model']} on this laptop (Ollama {'running' if status['runtime'] else 'NOT running'}): "
              f"{'ready' if helper['ready'] else 'missing'}")
    reader = "ready" if helper["ready"] else "needs the AI helper"
    print(f"  Photo reader ({'Muse Glimmer reads the photo' if helper['images'] else 'Windows OCR + ' + helper['model']}): {reader}")
    online = "key set, needs internet" if meta_api.available() else "no key (run scripts/set-meta-key.ps1)"
    print(f"  Meta online reader ({config.META_MODEL}): {online}\n", flush=True)
    uvicorn.run(app_module.app, host=host, port=args.port, access_log=False, log_level="warning")
