"""Region and language packs. Only packs that exist on disk and pass checks are offered."""

from __future__ import annotations

import json
from functools import lru_cache

from . import config


class PackError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def languages() -> dict[str, dict]:
    langs: dict[str, dict] = {}
    base_keys: set[str] | None = None
    for path in sorted((config.PACKS_DIR / "i18n").glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        meta = data.get("meta") or {}
        code = meta.get("code")
        if code != path.stem:
            raise PackError(f"{path.name}: meta.code must be '{path.stem}'")
        langs[code] = data
    if "en" not in langs:
        raise PackError("the English baseline pack (en.json) is required")
    base_keys = {k for k in langs["en"] if k != "meta"}
    for code, data in langs.items():
        missing = base_keys - set(data)
        if missing:
            raise PackError(f"{code}.json is missing {len(missing)} keys, e.g. {sorted(missing)[:3]}")
    return langs


@lru_cache(maxsize=1)
def regions() -> dict[str, dict]:
    result: dict[str, dict] = {}
    langs = languages()
    for path in sorted((config.PACKS_DIR / "regions").glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("status") != "implemented":
            continue
        number = str((data.get("emergency") or {}).get("number", ""))
        if not number.isdigit():
            raise PackError(f"{path.name}: emergency number must be digits")
        if not (data["emergency"].get("source") or {}).get("reference_url"):
            raise PackError(f"{path.name}: emergency number needs a source")
        unknown_langs = [l for l in data.get("languages", []) if l not in langs]
        if unknown_langs:
            raise PackError(f"{path.name}: languages without packs: {unknown_langs}")
        result[data["id"]] = data
    if not result:
        raise PackError("no implemented region pack found")
    return result


def summary() -> dict:
    """What the UI may offer: only implemented regions and languages."""
    return {
        "regions": [
            {
                "id": r["id"],
                "name": r["name"],
                "emergency_number": r["emergency"]["number"],
                "tel_uri": r["emergency"]["tel_uri"],
                "emergency_source": r["emergency"]["source"],
                "languages": r["languages"],
                "guidance_cards": r.get("guidance_cards", []),
                "guidance_note": r.get("guidance_note", ""),
            }
            for r in regions().values()
        ],
        "languages": [
            {"code": code, **{k: v for k, v in data["meta"].items()}} for code, data in languages().items()
        ],
    }
