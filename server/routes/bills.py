"""Bill numbering, saving and the bill register."""

import logging

from flask import Blueprint, request

from server import db
from server.api import fail, handle_errors, ok, roles_required
from bson.errors import InvalidId
from bson.objectid import ObjectId
from pymongo import ReturnDocument

from server.roles import ADMIN, ROLES
from server.timeutil import as_utc, local_day_start, to_iso, utc_now
from server.validation import validate_bill

logger = logging.getLogger(__name__)

bp = Blueprint("bills", __name__, url_prefix="/api")

_COUNTER_ID = "bill_number"
MAX_PAGE_SIZE = 2000


def _peek_bill_number() -> int:
    """The number the next bill will get, without consuming it."""
    counter = db.counters.find_one({"_id": _COUNTER_ID})
    if not counter:
        return 1
    last_reset = counter.get("lastReset")
    if last_reset is None or as_utc(last_reset) < local_day_start():
        return 1
    return int(counter.get("value", 0)) + 1


def _next_bill_number() -> int:
    """Reserve the next bill number, starting again at 1 with the first bill
    after the restaurant's midnight.

    One atomic update, so two terminals printing at the same moment cannot be
    handed the same number, and only one database round trip per bill. A
    counter with no ``lastReset`` (or none at all) counts as a new day.
    """
    new_day = {"$lt": ["$lastReset", local_day_start()]}
    counter = db.counters.find_one_and_update(
        {"_id": _COUNTER_ID},
        [{"$set": {
            "value": {"$cond": [new_day, 1, {"$add": [{"$ifNull": ["$value", 0]}, 1]}]},
            "lastReset": {"$cond": [new_day, utc_now(), "$lastReset"]},
        }}],
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    number = int(counter["value"])
    if number == 1:
        logger.info("Daily bill number reset - Bill #1")
    return number


def _serialize(bill: dict) -> dict:
    """Shape a bill for the client, exposing its unique id as ``id``."""
    if "_id" in bill:
        bill["id"] = str(bill.pop("_id"))
    bill["createdAt"] = to_iso(bill.get("createdAt"))
    # Bills from the older till also carry a string copy of the timestamp.
    bill.pop("createdAtISO", None)
    return bill


@bp.get("/bill-number")
@handle_errors
def next_bill_number():
    return ok({"billNumber": _peek_bill_number()})


@bp.post("/bill")
@roles_required(*ROLES)
@handle_errors
def save_bill(user):
    """Record a finalised bill."""
    payload = request.get_json(silent=True) or {}
    fields, error = validate_bill(payload)
    if fields is None:
        return fail(error, 400)

    number = _next_bill_number()
    now = utc_now()
    bill = {
        **fields,
        "billNumber": number,
        "token": number,
        "createdAt": now,
        "createdBy": user.get("username", "unknown"),
        "deleted": False,
    }
    result = db.bills.insert_one(bill)

    logger.info("Bill #%s saved - total %.2f, %d items", number, bill["total"], len(bill["items"]))
    return ok(
        {
            "message": "Bill saved successfully",
            "billId": str(result.inserted_id),
            "billNumber": number,
            "bill": _serialize(dict(bill)),
        },
        201,
    )


@bp.get("/bills")
@roles_required(*ROLES)
@handle_errors
def list_bills(user):
    """The bill register, newest first."""
    limit = min(request.args.get("limit", type=int) or 1000, MAX_PAGE_SIZE)
    days = request.args.get("days", type=int)

    query: dict = {"deleted": {"$ne": True}}
    if days:
        query["createdAt"] = {"$gte": local_day_start(days_ago=days)}
    for field, arg in (("payment", "payment"), ("orderType", "orderType")):
        value = request.args.get(arg)
        if value:
            query[field] = value

    bills = db.bills.find(query).sort("createdAt", -1).limit(limit)
    return ok({"bills": [_serialize(b) for b in bills]})


@bp.get("/bill/<bill_id>")
@roles_required(*ROLES)
@handle_errors
def get_bill(user, bill_id):
    bill = _find(bill_id)
    if not bill:
        return fail("Bill not found", 404)
    return ok({"bill": _serialize(bill)})


def _find(bill_id: str):
    """Look up one bill by its document id.

    Bills are addressed by ``_id`` and never by ``billNumber``: the daily
    counter restarts at 1 every morning, so hundreds of bills share number 2.
    The previous ``delete_one({"token": n})`` therefore removed an arbitrary
    bill that happened to carry the same number - potentially one from months
    ago - rather than the one the cashier selected.
    """
    try:
        return db.bills.find_one({"_id": ObjectId(bill_id)})
    except (InvalidId, TypeError):
        return None


@bp.delete("/bill/<bill_id>/permanent-delete")
@roles_required(ADMIN)
@handle_errors
def destroy_bill(user, bill_id):
    bill = _find(bill_id)
    if not bill:
        return fail("Bill not found", 404)

    result = db.bills.delete_one({"_id": bill["_id"]})
    if result.deleted_count == 0:
        return fail("Bill not found", 404)

    # Log enough to reconstruct the record from the log if this was a mistake.
    logger.warning(
        "Bill %s (number %s, %s, total %.2f) permanently deleted by %s",
        bill_id, bill.get("billNumber"), to_iso(bill.get("createdAt")),
        bill.get("total", 0), user.get("username"),
    )
    return ok({"message": "Bill permanently deleted"})
