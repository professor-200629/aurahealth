"""The first-aid time log. The phone sends ids and times only; the text on the card comes from the guide pack,
so a client cannot put its own words into the log as if they were a first-aid step."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

EVENT_KINDS = {"guide_open", "done", "choice", "cpr_start", "cpr_stop"}
MAX_EVENTS = 300
MAX_CLOCK_SKEW = timedelta(days=2)


def parse_time(value: str) -> datetime | None:
    try:
        when = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if when.tzinfo is None:
        return None
    if abs(when - datetime.now(timezone.utc)) > MAX_CLOCK_SKEW:
        return None
    return when


def describe(event: dict, pack: dict, number: str) -> dict | None:
    """Validate one event against the guide pack and return the stored entry, or None if it is not valid."""
    kind = event.get("kind")
    guide = pack["guides"].get(event.get("guide") or "")
    when = parse_time(event.get("at") or "")
    event_id = str(event.get("id") or "")
    if kind not in EVENT_KINDS or guide is None or when is None or not 0 < len(event_id) <= 40:
        return None
    step = next((s for s in guide["steps"] if s["id"] == event.get("step")), None)
    if kind == "guide_open":
        text = f"Opened the guide: {guide['title']}"
    elif kind in ("cpr_start", "cpr_stop"):
        if not step or step["kind"] != "cpr":
            return None
        text = "Chest compressions started" if kind == "cpr_start" else "Chest compressions paused"
    elif kind == "done":
        if not step or step["kind"] == "question":
            return None
        text = step["log"]
    else:  # choice
        choice = next((c for c in (step or {}).get("choices", []) if c["id"] == event.get("choice")), None)
        if not step or step["kind"] != "question" or not choice:
            return None
        text = f"{step['log']}? {choice['label']}"
    return {
        "id": event_id,
        "kind": kind,
        "guide": guide["id"],
        "step": step["id"] if step else None,
        "choice": event.get("choice") if kind == "choice" else None,
        "at": when.isoformat(),
        "received": datetime.now(timezone.utc).isoformat(),
        "text": text.replace("{number}", number),
    }
