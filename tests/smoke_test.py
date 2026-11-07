"""End-to-end smoke test of the POS API.

Tests authentication, menu management, bill creation, bill register,
permissions, sales report generation (Excel), and cleanup.

    python tests/smoke_test.py
"""

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date as _date

BASE = os.environ.get("SMOKE_BASE_URL", "http://localhost:5000")
ADMIN_PASSWORD = os.environ.get("SMOKE_ADMIN_PASSWORD")
STAFF_PASSWORD = os.environ.get("SMOKE_STAFF_PASSWORD")

passed = 0
failed = 0


def call(method, path, token=None, body=None, form=None):
    url = BASE + path
    headers = {}
    data = None
    if token:
        headers["Authorization"] = "Bearer " + token
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    elif form is not None:
        data = form
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            return exc.code, json.loads(raw or b"{}")
        except ValueError:
            return exc.code, {"raw": raw[:200].decode(errors="replace")}


def check(label, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {label}")
    else:
        failed += 1
        print(f"  FAIL  {label}  {detail}")


def login(email, password):
    status, data = call("POST", "/api/auth/login", body={"email": email, "password": password})
    return data.get("token"), status, data


def fetch_raw(path, token=None):
    req = urllib.request.Request(BASE + path, headers={"Authorization": "Bearer " + token} if token else {})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.status, response.headers, response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.headers, exc.read()


def multipart(fields, boundary="----smoke"):
    parts = []
    for key, value in fields.items():
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{value}\r\n")
    parts.append(f"--{boundary}--\r\n")
    return "".join(parts).encode()


def run_smoke_test():
    global passed, failed

    if not ADMIN_PASSWORD or not STAFF_PASSWORD:
        sys.exit("Set SMOKE_ADMIN_PASSWORD and SMOKE_STAFF_PASSWORD to run the smoke test.")

    print("== authentication ==")
    status, data = call("GET", "/api/auth/accounts")
    login_accounts = data.get("accounts", [])
    check("login accounts load from database", status == 200 and len(login_accounts) >= 2)
    check("account list excludes password hashes", all("password" not in account for account in login_accounts))

    # The accounts come from the database: the first admin and the first cashier.
    admin_email = next((a["value"] for a in login_accounts if a["role"] == "admin"), "")
    cashier_email = next((a["value"] for a in login_accounts if a["role"] == "cashier"), "")
    check("an admin and a cashier account exist", admin_email and cashier_email)

    admin, status, data = login(admin_email, ADMIN_PASSWORD)
    check("admin logs in", status == 200 and admin, f"{status} {data}")

    cashier, status, _ = login(cashier_email, STAFF_PASSWORD)
    check("cashier logs in", status == 200 and cashier)

    status, data = login(admin_email, "wrong-password")[1:]
    check("wrong password rejected", status == 401, str(status))

    status, data = call("GET", "/api/bills")
    check("unauthenticated request rejected", status == 401, str(status))

    status, data = call("GET", "/api/auth/verify", token=admin)
    check("token verifies", status == 200 and data.get("user", {}).get("role") == "admin")

    print("\n== menu ==")
    status, data = call("GET", "/api/custom-items", token=cashier)
    items = data.get("items", [])
    check("cashier can read the menu", status == 200 and isinstance(items, list), f"{status}")

    status, data = call("GET", "/api/categories", token=cashier)
    check("categories load", status == 200 and len(data.get("categories", [])) > 0)

    print("\n== settings ==")
    status, data = call("GET", "/api/settings")
    settings = data.get("settings", {})
    check("settings served publicly", status == 200 and settings.get("name"))
    check("settings holds required fields", all(k in settings for k in ("name", "phones", "paymentMethods", "orderTypes")))

    status, _ = call("GET", "/api/manifest.webmanifest")
    check("install-app manifest served", status == 200)

    payment = settings.get("paymentMethods", ["Cash"])[0]
    order_type = settings.get("orderTypes", ["Dine-in"])[0]

    print("\n== bill numbering & creation ==")
    status, data = call("GET", "/api/next-bill-number", token=cashier)
    expected_first = data.get("nextBillNumber")
    check("next bill number returns a positive integer", status == 200 and isinstance(expected_first, int) and expected_first > 0)

    sample_items = [{"name": "Single Mandi", "price": 180, "qty": 1}]
    status, data = call("POST", "/api/bills", token=cashier, body={
        "items": sample_items,
        "payment": payment,
        "orderType": order_type,
        "tableNo": "T1",
        "discount": 0,
    })
    first_bill = data.get("bill", {})
    first_number = data.get("billNumber")
    first_id = first_bill.get("id")
    check("first bill created", status == 201 and first_id and first_number == expected_first, f"{first_number} vs {expected_first}")
    check("bill total computed correctly", first_bill.get("total") == 180)

    status, data = call("POST", "/api/bills", token=cashier, body={
        "items": sample_items,
        "payment": payment,
        "orderType": order_type,
        "tableNo": "T2",
        "discount": 10,
    })
    second_bill = data.get("bill", {})
    second_number = data.get("billNumber")
    second_id = second_bill.get("id")
    check("consecutive bill increments number", second_number == first_number + 1, f"{second_number} vs {first_number + 1}")
    check("discount applied (180 - 10% = 162)", second_bill.get("total") == 162)

    status, _ = call("POST", "/api/bills", token=cashier, body={
        "items": [],
        "payment": payment,
        "orderType": order_type,
    })
    check("empty bill rejected", status == 400, str(status))

    status, _ = call("POST", "/api/bills", token=cashier, body={
        "items": sample_items,
        "payment": "InvalidPaymentMethodXYZ",
        "orderType": order_type,
    })
    check("unknown payment method rejected", status == 400, str(status))

    print("\n== bill register ==")
    status, data = call("GET", "/api/bills", token=cashier)
    bill_list = data.get("bills", [])
    check("cashier can read bill register", status == 200 and len(bill_list) >= 2)

    found = {b.get("id") for b in bill_list}
    check("both created bills appear in register", first_id in found and second_id in found)

    print("\n== permissions ==")
    status, _ = call("DELETE", f"/api/bill/{first_id}/permanent-delete", token=cashier)
    check("cashier cannot delete a bill", status == 403, str(status))

    status, _ = call("DELETE", "/api/categories/mandi", token=cashier)
    check("cashier cannot delete a category", status == 403, str(status))

    print("\n== excel sales report ==")
    today = _date.today().isoformat()
    status, headers, body = fetch_raw(f"/api/reports/sales.xlsx?from={today}&to={today}", admin)
    check("admin gets an Excel workbook", status == 200 and body[:2] == b"PK", f"{status} {body[:60]!r}")
    check("served as .xlsx, not CSV",
          headers.get("Content-Type", "").startswith("application/vnd.openxmlformats-officedocument.spreadsheetml"),
          headers.get("Content-Type"))

    status, _, _ = fetch_raw(f"/api/reports/sales.xlsx?from={today}&to={today}", cashier)
    check("cashier cannot download reports", status == 403, str(status))

    print("\n== menu editing ==")
    form_name = "SmokeTestItem"
    call("DELETE", f"/api/custom-items/{form_name}", token=admin)
    call("DELETE", f"/api/custom-items/{form_name}Renamed", token=admin)

    boundary = "----smoke"
    req = urllib.request.Request(
        BASE + "/api/custom-items",
        data=multipart({"name": form_name, "price": "150", "category": "custom"}, boundary=boundary),
        headers={"Authorization": "Bearer " + admin,
                 "Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            status, data = response.status, json.loads(response.read())
    except urllib.error.HTTPError as exc:
        status, data = exc.code, json.loads(exc.read() or b"{}")
    check("menu item created", status == 201, f"{status} {data}")

    status, data = call("PUT", f"/api/custom-items/{form_name}", token=admin,
                        body={"name": form_name + "Renamed", "price": 175, "category": "custom"})
    check("menu item updates", status == 200, f"{status} {data}")

    status, _ = call("PUT", f"/api/custom-items/{form_name}Renamed", token=cashier,
                     body={"price": 200})
    check("cashier cannot edit the menu", status == 403, str(status))

    status, _ = call("DELETE", f"/api/custom-items/{form_name}Renamed", token=admin)
    check("menu item deletes", status == 200, str(status))

    print("\n== cleanup ==")
    removed = 0
    for bill_id in (first_id, second_id):
        status, _ = call("DELETE", f"/api/bill/{bill_id}/permanent-delete", token=admin)
        removed += 1 if status == 200 else 0
    check("both test bills removed by id", removed == 2, f"{removed}/2")

    print(f"\n{'=' * 46}\n{passed} passed, {failed} failed\n{'=' * 46}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    run_smoke_test()
