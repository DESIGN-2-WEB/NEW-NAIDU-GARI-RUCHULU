"""Health check, the restaurant settings and the install-app manifest."""

import logging

from flask import Blueprint, jsonify, request

from server import db, settings
from server.roles import ADMIN
from server.api import fail, handle_errors, ok, roles_required

logger = logging.getLogger(__name__)

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


@bp.put("/api/settings")
@roles_required(ADMIN)
@handle_errors
def update_restaurant_settings(user):
    """Management -> Restaurant: name, tagline, owner, address, phones, GSTIN."""
    data = request.get_json(silent=True) or {}
    fields, error = settings.clean_editable({k: data[k] for k in settings.EDITABLE if k in data})
    if fields is None:
        return fail(error, 400)
    current = settings.update(fields)
    logger.info("Restaurant details changed by %s: %s", user.get("username"), ", ".join(sorted(fields)))
    return ok({"message": "Restaurant details saved", "settings": current})


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
