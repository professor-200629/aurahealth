"""The time log: first-aid steps, night-guard alerts and check-ins. The phone sends ids and times only; the text
on the card comes from the guide pack or the fixed table below, so a client cannot put its own words into the
log as if they were a first-aid step or an alert."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

GUIDE_KINDS = {"guide_open", "done", "choice", "cpr_start", "cpr_stop"}
ROLES = {"neighbour": "the neighbour", "family": "family"}
# Night guard and check-in events. "{role}" is filled from ROLES only.
SYSTEM_EVENTS = {
    "checkin_night": "Said good night (last seen well)",
    "checkin_morning": "Said good morning",
    "guard_on": "Night guard switched on",
    "guard_off": "Night guard switched off",
    "guard_knock": "Knock signal heard (3 knocks)",
    "guard_silence": "No \"Good morning\" by the morning check time",
    "guard_test": "Alert test started (no call)",
    "guard_cancel": "\"I'm OK\" tapped, alert cancelled",
    "guard_call": "Phoned {role} automatically",
    "guard_sms": "Sent an alert text to {role}",
    "guard_failed": "Could not reach {role} automatically",
}
EVENT_KINDS = GUIDE_KINDS | set(SYSTEM_EVENTS)
LAST_SEEN_WELL = {"checkin_night", "checkin_morning", "guard_cancel"}
ALERTS = {"guard_knock", "guard_silence"}
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
    """Validate one event and return the stored entry, or None if it is not valid."""
    kind = event.get("kind")
    when = parse_time(event.get("at") or "")
    event_id = str(event.get("id") or "")
    if kind not in EVENT_KINDS or when is None or not 0 < len(event_id) <= 40:
        return None
    guide = step = None
    if kind in SYSTEM_EVENTS:
        template = SYSTEM_EVENTS[kind]
        role = event.get("role")
        if "{role}" in template:
            if role not in ROLES:
                return None
            template = template.replace("{role}", ROLES[role])
        text = template
    else:
        guide = pack["guides"].get(event.get("guide") or "")
        if guide is None:
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
        "guide": guide["id"] if guide else None,
        "step": step["id"] if step else None,
        "choice": event.get("choice") if kind == "choice" else None,
        "role": event.get("role") if kind in SYSTEM_EVENTS else None,
        "at": when.isoformat(),
        "received": datetime.now(timezone.utc).isoformat(),
        "text": text.replace("{number}", number),
    }


def last_seen_well(events: list[dict]) -> str | None:
    """The latest sign the person was fine before the first alert: a check-in or an "I'm OK" tap."""
    ordered = sorted(events, key=lambda e: e["at"])
    first_alert = next((e["at"] for e in ordered if e["kind"] in ALERTS), None)
    candidates = [e["at"] for e in ordered if e["kind"] in LAST_SEEN_WELL and (first_alert is None or e["at"] < first_alert)]
    return candidates[-1] if candidates else None
