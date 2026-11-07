"""Bill-number midnight reset, against real MongoDB in a throwaway database.

    python tests/bill_number_test.py
    python -m unittest discover tests

Uses the MONGO_URI from .env but a scratch database, dropped at the end; the
shop's database is never touched. The clock is faked, so it runs any time.
"""

import logging
import sys
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
logging.disable(logging.CRITICAL)

from server import db  # noqa: E402
from server.routes import bills  # noqa: E402

IST = timezone(timedelta(minutes=330))
SCRATCH = "naidugari_scratch_billno_test"


class BillNumberResetTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        db.connect()
        cls.scratch = db.client[SCRATCH]
        cls.orig_counters = db.counters
        cls.orig_day_start = bills.local_day_start
        cls.orig_utc_now = bills.utc_now

        db.counters = cls.scratch["counters"]
        cls.clock = {"now": None}

        def fake_day_start(days_ago=0):
            start = cls.clock["now"].replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days_ago)
            return start.astimezone(timezone.utc)

        bills.local_day_start = fake_day_start
        bills.utc_now = lambda: cls.clock["now"].astimezone(timezone.utc)

    @classmethod
    def tearDownClass(cls):
        db.counters = cls.orig_counters
        bills.local_day_start = cls.orig_day_start
        bills.utc_now = cls.orig_utc_now
        db.client.drop_database(SCRATCH)

    def at(self, y, m, d, hh, mm, ss=0):
        self.clock["now"] = datetime(y, m, d, hh, mm, ss, tzinfo=IST)

    def test_bill_number_reset_lifecycle(self):
        self.at(2026, 10, 24, 10, 0)
        self.assertEqual(bills._peek_bill_number(), 1, "no counter yet: next number shown")
        self.assertEqual(bills._next_bill_number(), 1, "first bill ever")
        self.assertEqual(bills._next_bill_number(), 2, "second bill")
        self.assertEqual(bills._next_bill_number(), 3, "third bill")
        self.assertEqual(bills._peek_bill_number(), 4, "shown next number during the day")

        self.at(2026, 10, 24, 23, 59, 59)
        self.assertEqual(bills._next_bill_number(), 4, "23:59:59 IST still the same day")
        self.assertEqual(bills._peek_bill_number(), 5, "23:59:59 shown next number")

        self.at(2026, 10, 25, 0, 0, 1)
        self.assertEqual(bills._peek_bill_number(), 1, "00:00:01 IST shown next number resets")
        self.assertEqual(bills._next_bill_number(), 1, "first bill after midnight")
        self.assertEqual(bills._next_bill_number(), 2, "second bill after midnight")

        self.at(2026, 10, 25, 5, 29)  # 23:59 UTC the previous day - must NOT reset again
        self.assertEqual(bills._next_bill_number(), 3, "05:29 IST (still before UTC midnight) no extra reset")
        self.at(2026, 10, 25, 5, 31)  # just after UTC midnight - must NOT reset either
        self.assertEqual(bills._next_bill_number(), 4, "05:31 IST (after UTC midnight) no extra reset")

        self.at(2026, 10, 28, 12, 0)
        self.assertEqual(bills._next_bill_number(), 1, "first bill after days closed")

        db.counters.replace_one({"_id": "bill_number"}, {"_id": "bill_number", "value": 57})
        self.assertEqual(bills._peek_bill_number(), 1, "old counter without lastReset: shown")
        self.assertEqual(bills._next_bill_number(), 1, "old counter without lastReset: resets")
        self.assertEqual(bills._next_bill_number(), 2, "then counts on")

        self.at(2026, 10, 29, 0, 0, 5)
        with ThreadPoolExecutor(max_workers=20) as pool:
            numbers = sorted(pool.map(lambda _: bills._next_bill_number(), range(20)))
        self.assertEqual(numbers, list(range(1, 21)), "20 counters billing at once just after midnight")


if __name__ == "__main__":
    unittest.main()
