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


STEP_KINDS = {"action", "call", "cpr", "question"}


@lru_cache(maxsize=1)
def guides() -> dict:
    """First-aid guides: fixed text adapted from the IFRC 2020 guidelines. No model ever writes or edits them."""
    data = json.loads((config.PACKS_DIR / "guides" / "en.json").read_text(encoding="utf-8"))
    source = (data.get("meta") or {}).get("source") or {}
    if not source.get("url") or not source.get("publisher"):
        raise PackError("guides: every guide pack needs a source")
    by_id: dict[str, dict] = {}
    for guide in data.get("guides", []):
        gid = guide.get("id")
        if not gid or gid in by_id:
            raise PackError(f"guides: missing or duplicate id {gid!r}")
        steps = guide.get("steps") or []
        step_ids = [s.get("id") for s in steps]
        if not steps or None in step_ids or len(set(step_ids)) != len(step_ids):
            raise PackError(f"guide {gid}: steps need unique ids")
        for step in steps:
            if step.get("kind") not in STEP_KINDS or not step.get("text") or not step.get("log"):
                raise PackError(f"guide {gid}/{step.get('id')}: needs a known kind, text and log")
            if step["kind"] == "question" and not step.get("choices"):
                raise PackError(f"guide {gid}/{step['id']}: a question needs choices")
        by_id[gid] = guide
    for gid, guide in by_id.items():
        step_ids = {s["id"] for s in guide["steps"]}
        targets = [c.get("goto") for s in guide["steps"] for c in s.get("choices", [])]
        targets += [link.get("goto") for link in guide.get("links", [])]
        for target in targets:
            ok = target in ("next", "list") or target in step_ids or (
                isinstance(target, str) and target.startswith("guide:") and target[6:] in by_id)
            if not ok:
                raise PackError(f"guide {gid}: unknown target {target!r}")
    return {"meta": data["meta"], "guides": by_id}


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
