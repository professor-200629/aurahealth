"""Paths, model names and limits. Everything runs on this laptop, except the optional Meta online reader."""

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

# Ollama 0.30+ cannot load Llama 3.2 Vision ("unknown model architecture: 'mllama'"); set AURA_LOCAL_VISION=1
# only with an older Ollama (0.24.0) where it runs.
USE_LOCAL_VISION = os.environ.get("AURA_LOCAL_VISION", "0") == "1"

# Optional online reader: Meta Model API, Muse Spark. Needs MODEL_API_KEY (scripts/set-meta-key.ps1).
META_API_BASE = os.environ.get("AURA_META_API_BASE", "https://api.meta.ai/v1")
# On the 60 test questions, 1.1 at "low" did better than 1.3 at "minimal": 3.9 s against 4.8 s median, 112/113 against 106/113 concepts (5 Nov).
META_MODEL = os.environ.get("AURA_META_MODEL", "muse-spark-1.1")
META_TIMEOUT_S = float(os.environ.get("AURA_META_TIMEOUT_S", "120"))
META_EFFORT = os.environ.get("AURA_META_EFFORT", "low")
MAX_META_SPEND_USD = float(os.environ.get("AURA_MAX_META_SPEND_USD", "2.00"))
META_CALL_RESERVE_USD = 0.02
# Published prices (dev.meta.ai/docs/pricing-rate-limits, read 2026-10-29), USD per million tokens.
PRICE_META_INPUT_PER_M = 1.25
PRICE_META_OUTPUT_PER_M = 4.25

# The AI helper. "glimmer" (default): Meta Muse Glimmer 30B (open weights), hosted free by NVIDIA; needs internet
# and NVIDIA_API_KEY (scripts/set-nvidia-key.ps1). "llama": Llama 3.2 3B on this laptop through Ollama, offline.
# The hackathon organizers said on 31 Oct that Llama does not count as a Meta model for judging, so it is opt-in.
AI_PROVIDER = os.environ.get("AURA_AI", "glimmer")
GLIMMER_MODEL = os.environ.get("AURA_GLIMMER_MODEL", "meta/muse-glimmer-30b")
NVIDIA_API_BASE = os.environ.get("AURA_NVIDIA_API_BASE", "https://integrate.api.nvidia.com/v1")
GLIMMER_TIMEOUT_S = float(os.environ.get("AURA_GLIMMER_TIMEOUT_S", "90"))

TEXT_TIMEOUT_S = float(os.environ.get("AURA_TEXT_TIMEOUT_S", "90"))
VISION_TIMEOUT_S = float(os.environ.get("AURA_VISION_TIMEOUT_S", "900"))

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_IMAGE_SIDE = 1120          # Llama 3.2 Vision reads up to 4 tiles of 560 px
MAX_DESCRIPTION_CHARS = 2000
MAX_FIELDS = 40
MAX_FIELD_LABEL = 80
MAX_FIELD_VALUE = 300

APP_VERSION = "0.1.0"
