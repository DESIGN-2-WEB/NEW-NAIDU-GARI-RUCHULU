"""Shared HTTP helpers: response envelope and role-based access control."""

import functools
import logging
import time

from bson.errors import InvalidId
from bson.objectid import ObjectId
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from server import db
from server.settings import SettingsMissing

logger = logging.getLogger(__name__)


def ok(payload: dict | None = None, status: int = 200):
    body = {"success": True}
    if payload:
        body.update(payload)
    return jsonify(body), status


def fail(message: str, status: int = 400, **extra):
    body = {"success": False, "error": message}
    body.update(extra)
    return jsonify(body), status


# Signed-in users looked up in the last minute: saves a database round trip
# (~90 ms) on almost every request. A changed role or a deleted account
# takes effect within USER_CACHE_SECONDS.
USER_CACHE_SECONDS = 60
_user_cache: dict[str, tuple[float, dict]] = {}


def current_user() -> dict | None:
    """Look up the user behind the request's JWT, or None if it no longer exists."""
    identity = get_jwt_identity()
    if not identity:
        return None
    cached = _user_cache.get(identity)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    try:
        user = db.users.find_one({"_id": ObjectId(identity)}, {"password": 0})
    except (InvalidId, TypeError):
        return None
    if user is None:
        _user_cache.pop(identity, None)
    else:
        _user_cache[identity] = (time.monotonic() + USER_CACHE_SECONDS, user)
    return user


def forget_user(identity: str) -> None:
    """Drop a user from the cache, so a deleted account or a new password
    takes effect on its next request instead of up to a minute later."""
    _user_cache.pop(str(identity), None)


def public_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "username": user.get("username", ""),
        "email": user.get("email", ""),
        "role": user.get("role", "staff"),
    }


def roles_required(*roles: str):
    """Require a valid JWT whose user holds one of ``roles``.

    Replaces the copy-pasted "fetch user, compare role, return 403" block that
    each protected route used to carry.
    """

    def decorator(view):
        @functools.wraps(view)
        @jwt_required()
        def wrapper(*args, **kwargs):
            # Checked here too: the user lookup below runs before handle_errors.
            if db.client is None:
                return fail("Database unavailable", 503)
            user = current_user()
            if user is None:
                return fail("Session expired. Please log in again.", 401)
            if roles and user.get("role") not in roles:
                return fail("Access denied", 403)
            return view(*args, user=user, **kwargs)

        return wrapper

    return decorator


def handle_errors(view):
    """Turn an unexpected exception into a 500 JSON envelope instead of HTML."""

    @functools.wraps(view)
    def wrapper(*args, **kwargs):
        try:
            db.require_db()
            return view(*args, **kwargs)
        except db.DatabaseUnavailable:
            return fail("Database unavailable", 503)
        except SettingsMissing as exc:
            return fail(str(exc), 503)
        except Exception:
            logger.exception("Unhandled error in %s", view.__name__)
            return fail("Internal server error", 500)

    return wrapper
