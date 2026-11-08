"""Restaurant settings, kept in the database - nothing about the restaurant is
written in the code.

One document (collection ``settings``, ``_id: "restaurant"``) holds the name,
address and phones printed on bills, the payment methods, order types, number
of tables and the order sizes are shown in. The web app loads it through
``GET /api/settings``; the API reads it to check bills and build reports.
Change it with:

    python -m server.settings show
    python -m server.settings set phones <number> <number>
    python -m server.settings set tableCount 12
    python -m server.settings set paymentAliases "Cash / UPI=Cash"
    python -m server.settings set receiptFooter "Thank you!" "Visit again"
    python -m server.settings set loginHeadline "Every order," "*perfectly* billed."
    python -m server.settings set loginFeatures "receipt|Counter billing|Bills and receipts"

A change reaches every screen the next time it is opened (the API keeps a
copy for at most CACHE_SECONDS).
"""

import argparse
import re
import sys
import time

from server import db

DOC_ID = "restaurant"

# field: (type, what it is for). Lists are given as several values on the
# command line; paymentAliases as "old name=new name" pairs.
FIELDS = {
    "name": (str, "name printed on bills and shown in the headers"),
    "title": (str, "name in browser tabs, the installed app and the Excel report"),
    "shortName": (str, "short name under the installed app's icon"),
    "tagline": (str, "line under the name, e.g. Family Restaurant"),
    "location": (str, "address shown on the login page and in the billing header"),
    "owner": (str, "owner's name shown in the billing header"),
    "phones": (list, "contact numbers printed on bills"),
    "gstNumber": (str, "GSTIN printed on bills (optional; leave unset if none)"),
    "credit": (str, "footer line"),
    "receiptFooter": (list, "lines printed at the bottom of every bill, e.g. Thank you!"),
    "loginHeadline": (list, "login page headline, one value per line; wrap words in *stars* to highlight them"),
    "loginFeatures": (list, 'login page cards as "icon|title|description"; icons: receipt, chart, menu, star, clock, users'),
    "paymentMethods": (list, "payment choices on a bill; the first is preselected"),
    "orderTypes": (list, "order-type choices on a bill; the first is preselected"),
    "tableCount": (int, "tables in the Table list (1..tableCount)"),
    "sizeOrder": (list, "sizes of group items shown in this order; others follow, cheapest first"),
    "paymentAliases": (dict, "payment names on older bills counted as another method in reports"),
}

# The API reads the settings on every bill; this keeps that from costing a
# database round trip each time.
CACHE_SECONDS = 60
_cache: tuple[float, dict] | None = None


class SettingsMissing(RuntimeError):
    """The settings document has not been created yet."""


def get() -> dict:
    """The current settings (cached for CACHE_SECONDS)."""
    global _cache
    if _cache and _cache[0] > time.monotonic():
        return _cache[1]
    doc = db.settings.find_one({"_id": DOC_ID}, {"_id": 0})
    if not doc:
        raise SettingsMissing("Restaurant settings are not set up. Run: python -m server.settings show")
    settings = {field: doc[field] for field in FIELDS if field in doc}
    _cache = (time.monotonic() + CACHE_SECONDS, settings)
    return settings


def _parse(field: str, values: list[str]):
    kind = FIELDS[field][0]
    if kind is list:
        return [v.strip() for v in values if v.strip()]
    if kind is dict:
        pairs = {}
        for value in values:
            old, sep, new = value.partition("=")
            if not sep or not old.strip() or not new.strip():
                raise SystemExit(f'{field} values look like "old name=new name", not {value!r}')
            pairs[old.strip()] = new.strip()
        return pairs
    if len(values) != 1:
        raise SystemExit(f"{field} takes one value (use quotes around text with spaces)")
    if kind is int:
        try:
            number = int(values[0])
        except ValueError:
            raise SystemExit(f"{field} must be a whole number") from None
        if number < 0:
            raise SystemExit(f"{field} cannot be negative")
        return number
    return values[0].strip()


def set_field(field: str, values: list[str]) -> None:
    global _cache
    if field not in FIELDS:
        raise SystemExit(f"Unknown setting {field!r}. Settings: {', '.join(FIELDS)}")
    db.settings.update_one({"_id": DOC_ID}, {"$set": {field: _parse(field, values)}}, upsert=True)
    _cache = None


# The details the admin edits in Management -> Restaurant.
EDITABLE = ("name", "tagline", "owner", "location", "phones", "gstNumber")
MAX_PHONES = 4
GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
PHONE_RE = re.compile(r"^\+?[0-9][0-9 -]{4,18}[0-9]$")


def clean_editable(data: dict) -> tuple[dict | None, str]:
    """Check the Management -> Restaurant form; returns (fields, error)."""
    fields = {}
    for key in ("name", "tagline", "owner", "location"):
        if key in data:
            value = str(data.get(key) or "").strip()
            if len(value) > 120:
                return None, f"{key} is too long"
            fields[key] = value
    if "name" in fields and not fields["name"]:
        return None, "The restaurant name is required"
    if "phones" in data:
        raw = data.get("phones") or []
        if not isinstance(raw, list):
            return None, "Phone numbers must be a list"
        phones = [str(p).strip() for p in raw if str(p).strip()]
        if len(phones) > MAX_PHONES:
            return None, f"At most {MAX_PHONES} phone numbers"
        bad = [p for p in phones if not PHONE_RE.match(p)]
        if bad:
            return None, f"Not a phone number: {bad[0]}"
        fields["phones"] = phones
    if "gstNumber" in data:
        gst = re.sub(r"\s+", "", str(data.get("gstNumber") or "")).upper()
        if gst and not GSTIN_RE.match(gst):
            return None, "GST number must be the 15-character GSTIN, e.g. 37ABCDE1234F1Z5"
        fields["gstNumber"] = gst
    return fields, ""


def update(fields: dict) -> dict:
    """Save edited details (an empty optional value is removed) and return
    the settings as they now are."""
    global _cache
    to_set = {k: v for k, v in fields.items() if v not in ("", [])}
    to_unset = {k: "" for k, v in fields.items() if v in ("", []) and k != "name"}
    change = {}
    if to_set:
        change["$set"] = to_set
    if to_unset:
        change["$unset"] = to_unset
    if change:
        db.settings.update_one({"_id": DOC_ID}, change, upsert=True)
    _cache = None
    return get()


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(prog="python -m server.settings", description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("show", help="print every setting")
    set_cmd = sub.add_parser("set", help="change one setting")
    set_cmd.add_argument("field", help=", ".join(FIELDS))
    set_cmd.add_argument("values", nargs="*")
    args = parser.parse_args(argv)
    # Windows consoles default to a code page without © or —.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    if not db.connect():
        raise SystemExit("Cannot reach MongoDB")

    if args.command == "set":
        set_field(args.field, args.values)

    doc = db.settings.find_one({"_id": DOC_ID}) or {}
    for field, (_, description) in FIELDS.items():
        value = doc.get(field, "(not set)")
        print(f"{field:15} {value!r:60} {description}")
    missing = [f for f in FIELDS if f not in doc]
    if missing:
        print(f"\nNot set yet: {', '.join(missing)}", file=sys.stderr)


if __name__ == "__main__":
    main()
