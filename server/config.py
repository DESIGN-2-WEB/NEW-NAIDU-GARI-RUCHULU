"""Application configuration, loaded from the environment.

``load_dotenv`` runs at import time so every module that reads ``os.getenv``
sees the ``.env`` values, no matter what gets imported first.
"""

import os
import secrets
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def _flag(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


class Config:
    # --- Core ---
    # Off unless asked for: Flask's debug mode lets anyone who can reach the
    # server run code on it. Set DEBUG=true in .env only on a developer's PC.
    DEBUG = _flag("DEBUG", False)
    PORT = int(os.getenv("PORT", "5000"))
    HOST = os.getenv("HOST", "0.0.0.0")

    # --- Database ---
    MONGO_URI = os.getenv("MONGO_URI") or os.getenv("MONGODB_URI")
    # Optional: by default the database named in MONGO_URI is used.
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")
    MONGO_TIMEOUT_MS = int(os.getenv("MONGO_TIMEOUT_MS", "10000"))

    # --- Auth ---
    # A generated fallback keeps development working, but every restart then
    # invalidates existing tokens - which is the intended nudge to set the var.
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or secrets.token_urlsafe(48)
    JWT_SECRET_IS_EPHEMERAL = not os.getenv("JWT_SECRET_KEY")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=int(os.getenv("JWT_EXPIRY_DAYS", "30")))

    # --- CORS ---
    # Which web addresses may use this API from a browser. Comma-separated,
    # e.g. "https://pos.example.com". "*" allows any site - fine on one
    # computer, not once the API is on the internet at a different address
    # from the pages. Not needed when pages and API share one address.
    CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

    # --- Requests ---
    # Largest request accepted. Menu pictures are web links or small data:
    # images kept in the database, never files on disk. (Vercel caps any
    # request at 4.5 MB on its own.)
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_UPLOAD_MB", "8")) * 1024 * 1024

    # --- Business rules ---
    # Local wall-clock offset used for "today", daily bill-number resets and
    # receipt timestamps. The restaurant runs on IST.
    TIMEZONE_OFFSET_MINUTES = int(os.getenv("TZ_OFFSET_MINUTES", "330"))
    # Everything about the restaurant itself - name, phones, payment methods,
    # order types, tables - is in the database (server/settings.py).


config = Config()
