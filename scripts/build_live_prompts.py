"""Write live-server/prompts.json from the shared pack, so the web demo's server sends the same prompts as the phone.

Run from backend/:  uv run python ../scripts/build_live_prompts.py
"""

import json
from pathlib import Path

from aurahealth import chat, config

ROOT = Path(__file__).resolve().parent.parent
pack = json.loads((config.PACKS_DIR / "ai" / "aura_chat.json").read_text(encoding="utf-8"))
prompts = {"chat": chat.system_prompt("112"), "photo": "\n".join(pack["photo_system"]).replace("{number}", "112")}
out = ROOT / "live-server" / "prompts.json"
out.write_text(json.dumps(prompts, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print("wrote", out, {k: len(v) for k, v in prompts.items()})
