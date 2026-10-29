"""Build the handoff card from confirmed inputs only. Deterministic: no model is involved.

Each item carries its provenance:
- user          the user typed or chose it
- user_split    the user's exact words, split into a point by the text helper
- doc_confirmed a report field the user confirmed unchanged
- doc_corrected a report field the user corrected (the model's reading is kept as evidence)
Missing answers are listed as unknown. Nothing is inferred.
"""

from __future__ import annotations

AGE_KEYS = {"under1", "1to12", "13to17", "18to39", "40to64", "65plus"}
ONSET_KEYS = {"lt15", "15to60", "1to6h", "gt6h"}
DETAIL_KEYS = ("allergies", "medicines", "conditions", "other")


def build(session: dict) -> dict:
    items: list[dict] = []
    unknown: list[str] = []

    who = session.get("who") or {}
    if who.get("choice") in ("me", "someone"):
        label = (who.get("label") or "").strip()
        items.append(_item("person", {"choice": who["choice"], "label": label}, "user"))
    else:
        unknown.append("person")

    age = session.get("age")
    if age in AGE_KEYS:
        items.append(_item("age", {"choice": age}, "user"))
    else:
        unknown.append("age")

    desc = session.get("description") or {}
    points = [p for p in desc.get("points", []) if p.get("kept", True) and (p.get("text") or "").strip()]
    if points:
        for p in points:
            source = "user_split" if p.get("source") == "user_split" else "user"
            items.append(_item("what", {"text": p["text"].strip()}, source,
                               {"full_text": desc.get("text", ""), "model": (desc.get("assist") or {}).get("model")}))
    elif (desc.get("text") or "").strip():
        items.append(_item("what", {"text": desc["text"].strip()}, "user", {"full_text": desc["text"]}))
    else:
        unknown.append("what")

    onset = session.get("onset") or {}
    if onset.get("choice") in ONSET_KEYS:
        items.append(_item("onset", {"choice": onset["choice"]}, "user"))
    elif onset.get("choice") == "other" and (onset.get("other_text") or "").strip():
        items.append(_item("onset", {"text": onset["other_text"].strip()}, "user"))
    else:
        unknown.append("onset")

    details = session.get("details") or {}
    for key in DETAIL_KEYS:
        value = (details.get(key) or "").strip()
        if value:
            items.append(_item("details", {"field": key, "text": value}, "user"))
        elif key != "other":
            unknown.append(f"details.{key}")

    doc = session.get("document")
    if doc:
        confirmed = [f for f in doc.get("fields", []) if f.get("status") == "confirmed" and (f.get("value") or "").strip()]
        for f in confirmed:
            corrected = f.get("origin") == "model" and f.get("value") != f.get("model_value")
            source = "user" if f.get("origin") == "user" else ("doc_corrected" if corrected else "doc_confirmed")
            items.append(_item("report", {"label": f.get("label", ""), "text": f["value"]}, source, {
                "document_id": doc.get("id"),
                "model_value": f.get("model_value") if f.get("origin") == "model" else None,
                "flag_instruction": bool(f.get("flag_instruction")),
                "from_document": True,
            }))
        if confirmed:
            items.append(_item("report_current", {"current": doc.get("current")}, "user"))

    return {
        "region": session.get("region"),
        "language": session.get("language"),
        "items": items,
        "unknown": unknown,
        "not_assessed": True,
        "sources": [],
        "simulation": True,
    }


def _item(section: str, value: dict, provenance: str, evidence: dict | None = None) -> dict:
    return {"section": section, "value": value, "provenance": provenance, "evidence": evidence or {}}
