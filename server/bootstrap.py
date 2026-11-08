"""One-time startup work: the database indexes, including the one that
deletes bills older than 15 months (``db.BILL_RETENTION_DAYS``).

Nothing is seeded from the code: staff accounts, categories, the menu and the
restaurant settings all live only in the database (accounts are added with
``python -m server.passwords set <email> --role …``, settings with
``python -m server.settings set …``).
"""

import logging

from pymongo.errors import PyMongoError

from server import db
from server.timeutil import utc_now

logger = logging.getLogger(__name__)

# Bump this when the startup work below changes, so the next start runs it
# once more. Until then a start only checks the marker (one read) instead of
# re-creating the indexes - about a second saved on every cold start of the
# API on Vercel.
SETUP_VERSION = 3  # 3: automatic deletion of bills older than 15 months


def warn_missing_passwords() -> None:
    """Log accounts that cannot sign in yet."""
    missing = [u["email"] for u in db.users.find({"password": {"$not": {"$type": "string"}}}, {"email": 1})]
    if missing:
        logger.warning(
            "No password set for: %s - run: python -m server.passwords set <email>",
            ", ".join(missing),
        )


def run() -> None:
    """Run every startup task once per SETUP_VERSION, logging (not raising) on failure."""
    try:
        if db.meta.find_one({"_id": "setup", "version": SETUP_VERSION}):
            logger.info("Startup setup already done (version %d)", SETUP_VERSION)
            return
        db.ensure_indexes()
        warn_missing_passwords()
        db.meta.update_one(
            {"_id": "setup"},
            {"$set": {"version": SETUP_VERSION, "doneAt": utc_now()}},
            upsert=True,
        )
    except PyMongoError as exc:
        logger.error("Startup initialisation failed: %s", exc)
