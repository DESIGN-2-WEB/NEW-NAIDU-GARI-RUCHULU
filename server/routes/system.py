"""Health check, the restaurant settings and the install-app manifest."""

from flask import Blueprint, jsonify

from server import db, settings
from server.api import handle_errors, ok

bp = Blueprint("system", __name__)

# How the installed app looks; its name comes from the settings.
APP_COLOURS = "#14101A"
APP_ICONS = [
    {"src": "/icons/logo-192.png?v=2", "sizes": "192x192", "type": "image/png", "purpose": "any"},
    {"src": "/icons/logo-512.png?v=2", "sizes": "512x512", "type": "image/png", "purpose": "any"},
    {"src": "/icons/logo-maskable-512.png?v=2", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
]


@bp.get("/api/health")
def health():
    connected = db.healthy()
    payload = {
        "success": connected,
        "status": "healthy" if connected else "unhealthy",
        "database": "connected" if connected else "disconnected",
    }
    return payload, 200 if connected else 503


@bp.get("/api/settings")
@handle_errors
def restaurant_settings():
    """Everything the screens show about the restaurant (no secrets: the same
    details are printed on every bill). Read before sign-in by the login page."""
    return ok({"settings": settings.get()})


@bp.get("/api/manifest.webmanifest")
@handle_errors
def manifest():
    """The installable app's manifest, named from the settings."""
    current = settings.get()
    title = current.get("title", "")
    response = jsonify({
        "id": "/billing",
        "name": f"{title} — Billing Portal" if title else "Billing Portal",
        "short_name": current.get("shortName") or title or "Billing",
        "description": f"The Billing Portal of {title}." if title else "Billing Portal.",
        "start_url": "/billing",
        "scope": "/billing",
        "display": "standalone",
        "background_color": APP_COLOURS,
        "theme_color": APP_COLOURS,
        "icons": APP_ICONS,
    })
    response.mimetype = "application/manifest+json"
    return response
