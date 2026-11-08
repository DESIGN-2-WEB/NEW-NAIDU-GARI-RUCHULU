"""Staff accounts, managed by the admin in Management -> Users.

The same rules as ``python -m server.passwords``: an account is an email,
a username shown on the login list, a role and a bcrypt-hashed password.
The admin cannot delete their own account or the last admin, so the shop
can never lock itself out.
"""

import logging
import re

from bson.errors import InvalidId
from bson.objectid import ObjectId
from flask import Blueprint, request

from server import db
from server.api import fail, forget_user, handle_errors, ok, roles_required
from server.roles import ADMIN, ROLES
from server.security import hash_password, password_problem
from server.timeutil import to_iso, utc_now

logger = logging.getLogger(__name__)

bp = Blueprint("users", __name__, url_prefix="/api/users")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
USERNAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 ._-]{1,29}$")


def _object_id(value: str):
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None


def _row(user: dict, me: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "username": user.get("username", ""),
        "email": user.get("email", ""),
        "role": user.get("role", ""),
        "createdAt": to_iso(user.get("createdAt")),
        "isYou": user["_id"] == me["_id"],
    }


@bp.get("")
@roles_required(ADMIN)
@handle_errors
def list_users(user):
    rows = db.users.find({"role": {"$in": ROLES}}, {"password": 0}).sort([("role", 1), ("username", 1)])
    return ok({"users": [_row(u, user) for u in rows]})


@bp.post("")
@roles_required(ADMIN)
@handle_errors
def create_user(user):
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    role = str(data.get("role", "")).strip().lower()
    password = data.get("password", "")

    if not USERNAME_RE.match(username):
        return fail("Username: 2-30 letters, numbers, spaces, dots, dashes or underscores", 400)
    if not EMAIL_RE.match(email):
        return fail("Enter a valid email address", 400)
    if role not in ROLES:
        return fail(f"Role must be one of: {', '.join(ROLES)}", 400)
    problem = password_problem(password)
    if problem:
        return fail(problem, 400)
    if db.users.find_one({"email": email}):
        return fail("An account with this email already exists", 400)
    if db.users.find_one({"username": {"$regex": f"^{re.escape(username)}$", "$options": "i"}}):
        return fail("An account with this username already exists", 400)

    now = utc_now()
    new_user = {
        "username": username,
        "email": email,
        "role": role,
        "password": hash_password(password),
        "passwordChangedAt": now,
        "createdAt": now,
        "createdBy": user.get("email", "unknown"),
    }
    new_user["_id"] = db.users.insert_one(new_user).inserted_id
    logger.info("Account added by %s: %s (%s)", user.get("username"), username, role)
    return ok({"message": f"Account {username} added", "user": _row(new_user, user)}, 201)


@bp.delete("/<user_id>")
@roles_required(ADMIN)
@handle_errors
def delete_user(user, user_id):
    oid = _object_id(user_id)
    target = db.users.find_one({"_id": oid}) if oid else None
    if not target:
        return fail("Account not found", 404)
    if target["_id"] == user["_id"]:
        return fail("You cannot delete your own account", 400)
    if target.get("role") == ADMIN and db.users.count_documents({"role": ADMIN}) <= 1:
        return fail("The last admin account cannot be deleted", 400)

    db.users.delete_one({"_id": target["_id"]})
    forget_user(target["_id"])
    logger.info("Account deleted by %s: %s", user.get("username"), target.get("username"))
    return ok({"message": f"Account {target.get('username') or target.get('email')} deleted"})


@bp.put("/<user_id>/password")
@roles_required(ADMIN)
@handle_errors
def reset_password(user, user_id):
    """Set a new password for a staff member who has forgotten theirs."""
    oid = _object_id(user_id)
    target = db.users.find_one({"_id": oid}, {"username": 1}) if oid else None
    if not target:
        return fail("Account not found", 404)
    password = (request.get_json(silent=True) or {}).get("password", "")
    problem = password_problem(password)
    if problem:
        return fail(problem, 400)

    db.users.update_one(
        {"_id": target["_id"]},
        {"$set": {"password": hash_password(password), "passwordChangedAt": utc_now()}},
    )
    forget_user(target["_id"])
    logger.info("Password reset by %s for %s", user.get("username"), target.get("username"))
    return ok({"message": f"New password set for {target.get('username')}"})
