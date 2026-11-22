"""Central configuration, read once from environment variables (.env supported)."""
import logging
import os

from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


API_KEY = os.getenv("API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
LLM_TIMEOUT_SECONDS = _int("LLM_TIMEOUT_SECONDS", 30)

ALLOWED_ORIGINS = [o.strip() for o in os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5000,http://127.0.0.1:5000").split(",") if o.strip()]

RATE_LIMIT_PER_MINUTE = _int("RATE_LIMIT_PER_MINUTE", 60)
TRUST_PROXY = _bool("TRUST_PROXY", False)  # honour X-Forwarded-For for rate limiting
UI_ENABLED = _bool("UI_ENABLED", True)
ALLOW_PRIVATE_URLS = _bool("ALLOW_PRIVATE_URLS", False)  # SSRF guard override (dev only)

# Input limits (protect cost and memory)
MAX_PDF_BYTES = _int("MAX_PDF_BYTES", 5 * 1024 * 1024)
MAX_PDF_PAGES = _int("MAX_PDF_PAGES", 30)
MAX_RESUME_CHARS = 30_000
MAX_JD_CHARS = 15_000
MAX_ANSWER_CHARS = 5_000
MAX_QUESTIONS = 15

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=LOG_LEVEL, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

APP_VERSION = "2.0.0"
