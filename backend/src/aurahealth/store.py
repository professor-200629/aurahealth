"""One local session in SQLite (unencrypted, on this laptop only) plus uploaded report images."""

from __future__ import annotations

import json
import shutil
import sqlite3
import threading
import time
import uuid
from copy import deepcopy

from . import config

_LOCK = threading.Lock()

EMPTY_SESSION = {
    "who": {"choice": None, "label": ""},
    "age": None,
    "description": {"text": "", "points": [], "assist": None},
    "onset": {"choice": None, "other_text": ""},
    "details": {"allergies": "", "medicines": "", "conditions": "", "other": ""},
    "document": None,
    "events": [],  # first-aid steps the person marked done, with the phone's time
}


def _connect() -> sqlite3.Connection:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS session (id TEXT PRIMARY KEY, created REAL, updated REAL, data TEXT)"
    )
    return conn


def get() -> dict | None:
    with _LOCK, _connect() as conn:
        row = conn.execute("SELECT id, created, updated, data FROM session LIMIT 1").fetchone()
    if not row:
        return None
    data = json.loads(row[3])
    data.update({"id": row[0], "created": row[1], "updated": row[2]})
    return data


def create(region: str, language: str) -> dict:
    delete()
    now = time.time()
    data = deepcopy(EMPTY_SESSION)
    data.update({"region": region, "language": language})
    sid = uuid.uuid4().hex
    with _LOCK, _connect() as conn:
        conn.execute("INSERT INTO session VALUES (?, ?, ?, ?)", (sid, now, now, json.dumps(data)))
    data.update({"id": sid, "created": now, "updated": now})
    return data


def save(data: dict) -> dict:
    body = {k: v for k, v in data.items() if k not in ("id", "created", "updated")}
    now = time.time()
    with _LOCK, _connect() as conn:
        cur = conn.execute("UPDATE session SET updated = ?, data = ? WHERE id = ?", (now, json.dumps(body), data["id"]))
        if cur.rowcount != 1:
            raise KeyError("session not found")
    data["updated"] = now
    return data


def delete() -> None:
    """Remove the session row and every uploaded image."""
    with _LOCK:
        with _connect() as conn:
            conn.execute("DELETE FROM session")
        if config.UPLOAD_DIR.exists():
            shutil.rmtree(config.UPLOAD_DIR, ignore_errors=True)
