"""Login, token verification, logout and changing your own password."""

import logging

from flask import Blueprint, request

from server import db
from server.api import fail, handle_errors, ok, public_user, roles_required
from server.security import hash_password, password_problem, verify_password
from server.roles import ROLES
from server.timeutil import utc_now

logger = logging.getLogger(__name__)

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.get("/accounts")
@handle_errors
def accounts():
    users = db.users.find(
        {
            "role": {"$in": ROLES},
            "password": {"$type": "string"},
        },
        {"_id": 0, "email": 1, "username": 1, "role": 1},
    ).sort("username", 1)
    return ok({
        "accounts": [
            {
                "value": user["email"],
                "label": user.get("username") or user["email"],
                "role": user["role"],
            }
            for user in users
            if user.get("email")
        ]
    })


@bp.post("/login")
@handle_errors
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return fail("Email and password are required", 400)

    # The password is checked against the scrambled (bcrypt) copy stored with
    # the account in the database; no password is kept anywhere else.
    user = db.users.find_one({"email": email})
    # The same message for both branches so the response cannot be used to
    # enumerate which staff emails exist.
    if not user or not verify_password(password, user.get("password")):
        logger.info("Failed login attempt for %s", email)
        return fail("Invalid credentials", 401)

    from flask_jwt_extended import create_access_token

    logger.info("Login: %s (%s)", user.get("username"), user.get("role"))
    return ok(
        {
            "message": "Login successful",
            "token": create_access_token(identity=str(user["_id"])),
            "user": public_user(user),
        }
    )


@bp.get("/verify")
@roles_required()
@handle_errors
def verify(user):
    return ok({"user": public_user(user)})


@bp.post("/logout")
@roles_required()
@handle_errors
def logout(user):
    """Acknowledge logout.

    Tokens are stateless, so the client discards it; this endpoint exists so
    the UI gets a clean 200 instead of a 404 in the console.
    """
    logger.info("Logout: %s", user.get("username"))
    return ok({"message": "Logged out"})


@bp.post("/password")
@roles_required()
@handle_errors
def change_password(user):
    """Management -> My account: change your own password (the current one
    is asked for, so an unattended signed-in screen cannot be used to)."""
    data = request.get_json(silent=True) or {}
    stored = db.users.find_one({"_id": user["_id"]}, {"password": 1})
    if not stored or not verify_password(data.get("currentPassword", ""), stored.get("password")):
        return fail("Your current password is not correct", 400)
    new_password = data.get("newPassword", "")
    problem = password_problem(new_password)
    if problem:
        return fail(problem, 400)
    if verify_password(new_password, stored.get("password")):
        return fail("The new password must be different from the current one", 400)

    db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password": hash_password(new_password), "passwordChangedAt": utc_now()}},
    )
    logger.info("Password changed: %s", user.get("username"))
    return ok({"message": "Password changed"})
