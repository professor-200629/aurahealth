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
    else:
        print("  Local only. Add --lan to let your phone connect over Wi-Fi.")
    print(f"  Model runtime (Ollama): {'running' if status['runtime'] else 'NOT running'}")
    print(f"    text helper  {status['text_model']}: {'installed' if status['text'] else 'missing'}")
    print(f"    report reader {status['vision_model']}: {'installed' if status['vision'] else 'missing'}\n", flush=True)
    uvicorn.run(app_module.app, host=host, port=args.port, access_log=False, log_level="warning")
