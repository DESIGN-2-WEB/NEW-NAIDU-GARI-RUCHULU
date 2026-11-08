"""MongoDB connection and collection handles.

Collections are exposed as module-level names so route modules can simply
``from server.db import bills``. ``connect()`` is called once by the app
factory; ``healthy()`` reports whether the cluster is reachable.
"""

import logging

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.errors import PyMongoError

from server.config import config

logger = logging.getLogger(__name__)

client: MongoClient | None = None
db = None

bills = None
counters = None
users = None
custom_items = None
categories = None
meta = None
settings = None

_COLLECTIONS = {
    "bills": "bills",
    "counters": "counters",
    "users": "users",
    "custom_items": "custom_items",
    "categories": "categories",
    "meta": "meta",
    "settings": "settings",
}


# Bills are deleted automatically once they are older than this: 15 months
# (15 x 30.44 days, rounded up). MongoDB does it itself through a TTL index
# on ``createdAt`` - its background task runs about once a minute - so it
# needs no scheduled job and works the same on Vercel and on a computer.
BILL_RETENTION_DAYS = 457
BILL_RETENTION_INDEX = "bill_retention"


class DatabaseUnavailable(RuntimeError):
    """Raised when a request needs the database but the cluster is unreachable."""


def connect() -> bool:
    """Open the connection and bind the collection handles. Returns success."""
    global client, db

    if not config.MONGO_URI:
        raise RuntimeError("MONGO_URI is not set. Add it to the .env file.")

    try:
        client = MongoClient(
            config.MONGO_URI,
            serverSelectionTimeoutMS=config.MONGO_TIMEOUT_MS,
            connectTimeoutMS=config.MONGO_TIMEOUT_MS,
            socketTimeoutMS=config.MONGO_TIMEOUT_MS,
        )
        client.admin.command("ping")
    except PyMongoError as exc:
        logger.error("MongoDB connection failed: %s", exc)
        client = None
        return False

    if config.MONGO_DB_NAME:
        db = client[config.MONGO_DB_NAME]
    else:
        db = client.get_default_database(default=None)
        if db is None:
            raise RuntimeError("No database named: add it to MONGO_URI (…mongodb.net/<name>) or set MONGO_DB_NAME.")
    for attr, name in _COLLECTIONS.items():
        globals()[attr] = db[name]

    logger.info("Connected to MongoDB database %r", config.MONGO_DB_NAME)
    return True


def require_db() -> None:
    if client is None:
        raise DatabaseUnavailable("Database connection is not available")


def healthy() -> bool:
    if client is None:
        return False
    try:
        client.admin.command("ping")
        return True
    except PyMongoError:
        return False


def ensure_bill_retention() -> None:
    """Create the TTL index that deletes bills older than BILL_RETENTION_DAYS,
    or change its age limit if BILL_RETENTION_DAYS was changed."""
    seconds = BILL_RETENTION_DAYS * 24 * 60 * 60
    current = bills.index_information().get(BILL_RETENTION_INDEX)
    if current is None:
        bills.create_index([("createdAt", ASCENDING)], name=BILL_RETENTION_INDEX, expireAfterSeconds=seconds)
        logger.info("Bills older than %d days are now deleted automatically", BILL_RETENTION_DAYS)
    elif current.get("expireAfterSeconds") != seconds:
        db.command("collMod", bills.name, index={"name": BILL_RETENTION_INDEX, "expireAfterSeconds": seconds})
        logger.info("Bill retention changed to %d days", BILL_RETENTION_DAYS)


def ensure_indexes() -> None:
    """Create the indexes the query patterns rely on. Safe to re-run."""
    if client is None:
        return
    try:
        bills.create_index([("createdAt", DESCENDING)])
        ensure_bill_retention()
        bills.create_index([("token", DESCENDING)])
        bills.create_index([("deleted", ASCENDING), ("createdAt", DESCENDING)])
        users.create_index([("email", ASCENDING)], unique=True)
        custom_items.create_index([("name", ASCENDING)], unique=True)
        custom_items.create_index([("category", ASCENDING)])
        categories.create_index([("name", ASCENDING)], unique=True)
        logger.info("Database indexes ensured")
    except PyMongoError as exc:
        # Duplicate legacy data can block a unique index; log and keep running.
        logger.warning("Could not ensure all indexes: %s", exc)
