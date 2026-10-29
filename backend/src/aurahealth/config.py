"""Paths, model names and limits. Everything runs on this laptop."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]          # .../aurahealth
PACKS_DIR = ROOT / "packs"
FRONTEND_DIST = ROOT / "frontend" / "dist"
SAMPLE_DIR = ROOT / "SAMPLE_DATA"
DATA_DIR = Path(os.environ.get("AURA_DATA_DIR", ROOT / "data"))
DB_PATH = DATA_DIR / "sessions.sqlite3"
UPLOAD_DIR = DATA_DIR / "uploads"

OLLAMA_URL = os.environ.get("AURA_OLLAMA_URL", "http://127.0.0.1:11434")
TEXT_MODEL = os.environ.get("AURA_TEXT_MODEL", "llama3.2:3b")
VISION_MODEL = os.environ.get("AURA_VISION_MODEL", "llama3.2-vision:11b")

TEXT_TIMEOUT_S = float(os.environ.get("AURA_TEXT_TIMEOUT_S", "90"))
VISION_TIMEOUT_S = float(os.environ.get("AURA_VISION_TIMEOUT_S", "900"))

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_IMAGE_SIDE = 1120          # Llama 3.2 Vision reads up to 4 tiles of 560 px
MAX_DESCRIPTION_CHARS = 2000
MAX_FIELDS = 40
MAX_FIELD_LABEL = 80
MAX_FIELD_VALUE = 300

APP_VERSION = "0.1.0"
