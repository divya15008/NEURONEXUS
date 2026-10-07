import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR.parent / ".env")

DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
DATABASE_PATH = DATA_DIR / "neuronexus.sqlite3"
MAX_UPLOAD_BYTES = 15 * 1024 * 1024
ALLOWED_EXTENSION = ".docx"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROK_API_KEY = os.getenv("GROK_API_KEY", os.getenv("XAI_API_KEY", ""))
GROK_MODEL = os.getenv("GROK_MODEL", os.getenv("XAI_MODEL", "grok-4"))
AI_MODE = os.getenv(
    "NEURONEXUS_AI_MODE",
    "groq" if GROQ_API_KEY else "grok" if GROK_API_KEY else "gemini" if GEMINI_API_KEY else "local",
).lower()

for directory in (DATA_DIR, UPLOAD_DIR, OUTPUT_DIR):
    directory.mkdir(parents=True, exist_ok=True)
