<div align="center">

<img src="public/icons/logo-192.png?v=2" alt="New Naidu Gari Ruchulu logo" width="112">

# New Naidu Gari Ruchulu — Billing POS

**Fast thermal-print billing and sales analytics for restaurant management.**

Family Restaurant — Old NH5 Road, Kosingpuram Junction, Palasa

![React 19](https://img.shields.io/badge/React-19-20232a?logo=react&logoColor=61DAFB)
![Vite 8](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Flask 3](https://img.shields.io/badge/Flask-3-000000?logo=flask&logoColor=white)
![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![Vercel](https://img.shields.io/badge/Hosted%20on-Vercel-000000?logo=vercel&logoColor=white)

<img src="docs/screenshots/billing.jpg" alt="The billing counter with a bill in progress" width="900">

</div>

---

## Contents

- [What it is](#what-it-is)
- [Screenshots](#screenshots)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Run it on your computer](#run-it-on-your-computer)
- [Configuration](#configuration)
- [Deploy to Vercel](#deploy-to-vercel)
- [Restaurant settings (in the database)](#restaurant-settings-in-the-database)
- [Staff accounts and passwords](#staff-accounts-and-passwords)
- [Printer setup (once per counter PC)](#printer-setup-once-per-counter-pc)
- [Your data: bills and reports](#your-data-bills-and-reports)
- [Troubleshooting](#troubleshooting)
- [For developers](#for-developers)
- [Credits](#credits)

---

## What it is

A modern, high-speed point-of-sale and counter billing system tailored for New Naidu Gari Ruchulu:

| Portal | Address | Who signs in | What it is for |
|---|---|---|---|
| **Billing** | `/billing` | admin, cashier | Make the bill, print thermal receipt, take payment |
| **Analytics** | `/billing/analytics` | admin | Sales, charts, bill register, Excel report |

Opens at `/billing/login`.

## Screenshots

<table>
  <tr>
    <td width="70%"><img src="docs/screenshots/analytics.jpg" alt="Analytics dashboard with sales cards and charts"><br><sub><b>Analytics</b> — revenue, top items, payment methods and the 7-day trend.</sub></td>
    <td align="center" width="30%"><img src="docs/screenshots/login-phone.jpg" alt="Login page on a phone" width="260"><br><sub><b>Login</b>, with <i>Install</i> to add the portal as an app</sub></td>
  </tr>
</table>

<sub>Screens shown with sample bills.</sub>

## Features

### Billing counter

- **Fast billing** — tap menu items (sizes such as solo / duo / trio / squad
  where an item has them), set quantities, table, payment (Cash, Card, UPI,
  Zomato, Swiggy, Pending), order type and a discount %. The **＋** button adds
  a one-off item.
- **Printed bill and token slip** for an **80 mm thermal printer** (e.g. TVS
  RP3200 Lite): bill number, date and time, items, totals and *"Thank you! 🙏
  Visit again 🙏"*, then the customer's token slip (items only) on its own page,
  so the cutter separates them. Set the printer up once — see
  [Printer setup](#printer-setup-once-per-counter-pc).
- **Menu and categories** (admin) — add, edit and delete items and categories
  from the gear menu; the dialogs stay open for several changes in a row.

### Analytics (admin)

- Today / this week / this month / any date or range: revenue, number of bills,
  average bill, busiest hour, top items, payment methods and a 7-day trend.
- **Bill register** with search, and **Manage bill → Print bill** (reprint any
  saved bill) or **Permanently delete bills**.
- **Excel sales report** for any date range — six sheets: Summary, Daily Sales,
  Payment Methods, Order Types, Item Sales and the full Bill Register, in a
  plain printable ledger style.

### Everywhere

- **Works on phones, tablets and computers** (from small phones to large
  counter screens).
- **Install as an app** — the login page has an *Install* button that installs
  the portal with the restaurant logo. It disappears once installed.
- **Dark and light theme** (gear menu → Theme).

## Tech stack

| Part | Built with |
|---|---|
| Web app | React 19, React Router 7, Vite 8, Chart.js 4, Axios; Inter font bundled |
| API | Python 3.12+, Flask 3, Flask-JWT-Extended (sign-in tokens), Flask-CORS, bcrypt |
| Database | MongoDB Atlas (PyMongo) |
| Reports | openpyxl (Excel) |
| Hosting | Vercel — pages plus the API as a Python function |
| Installable app | A web app manifest + a small service worker |

## Run it on your computer

**You need:** Node.js 20.19+ (or 22.12+), Python 3.12+, and a MongoDB Atlas
database.

1. **Install**

   ```bash
   pip install -r requirements.txt
   npm install
   ```

2. **Settings** — copy `.env.example` to `.env` and fill in at least
   `MONGO_URI` and `JWT_SECRET_KEY` (see [Configuration](#configuration)).
   `.env` holds secrets and is never uploaded.

3. **Restaurant and accounts** — on a new database, enter the restaurant
   settings ([how](#restaurant-settings-in-the-database)) and create the staff
   accounts with their passwords ([how](#staff-accounts-and-passwords)).
   Nothing is created from the code.

4. **Start** — two terminals:

   ```bash
   python app.py        # API on http://localhost:5000
   ```

   ```bash
   npm run dev          # web app on http://localhost:5173
   ```

   Open <http://localhost:5173/billing/login>. The web app passes `/api` on to
   the API, so everything runs from one address.

To keep both running in the background with logs (Git Bash / Linux):

```bash
nohup python app.py > logs/api.log 2>&1 &
nohup npx vite > logs/web.log 2>&1 &
```

They do not start again by themselves after the computer restarts.

## Configuration

API settings come from `.env` locally, or from the host's environment
variables (see `.env.example`):

| Variable | Default | What it does |
|---|---|---|
| `MONGO_URI` | *(required)* | MongoDB connection string |
| `MONGO_DB_NAME` | *(from `MONGO_URI`)* | Only if the database name is not in `MONGO_URI` |
| `JWT_SECRET_KEY` | *(random each start)* | **Set it** — otherwise every restart signs all staff out |
| `JWT_EXPIRY_DAYS` | `30` | How long a sign-in lasts |
| `TZ_OFFSET_MINUTES` | `330` | Restaurant time zone (IST); decides "today" and the daily bill-number reset |
| `CORS_ORIGINS` | `*` | Only when the API runs at a different address from the pages |
| `DEBUG` | `false` | Developer's computer only — never on the internet |
| `PORT` / `HOST` | `5000` / `0.0.0.0` | Where `python app.py` listens |
| `MAX_UPLOAD_MB` | `8` | Largest request the API accepts |

Read when the web pages are built:

| Variable | When to set it |
|---|---|
| `VITE_API_URL` | Only if the API runs at a different address from the pages |
| `SITE_URL` | Only with your own domain (for link previews); Vercel knows its own address |

## Deploy to Vercel

The pages **and** the API run in one Vercel project at one https address.
`vercel.json` already sets everything up: the build, `/api/…` → the Python
function in `api/index.py` and the Mumbai region (next to the database).

1. **Put the project on GitHub.** `.gitignore` keeps `.env`, `backups/`,
   `logs/` and `node_modules/` out. Keep the repository **private**.
2. **Import the repository in Vercel.** No build settings to change.
3. **Environment variables** (Vercel → Settings → Environment Variables), for
   **Production**, type **Secret**:

   | Key | Value |
   |---|---|
   | `MONGO_URI` | from `.env` |
   | `JWT_SECRET_KEY` | from `.env` |

   Do **not** add `VITE_API_URL` or `CORS_ORIGINS`. Keep *Enable access to
   System Environment Variables* ticked.
4. **MongoDB Atlas → Network Access:** allow `0.0.0.0/0`. Vercel has no fixed
   address, so a strong database password is what protects the data.
5. **Deploy**, then open `https://<your-project>.vercel.app/api/health`. It
   should say `"database": "connected"`.

**Updating the live site:** upload the changed files to GitHub; Vercel rebuilds
by itself in about two minutes. Installed apps pick up the new version the next
time they are opened.

**Good to know**

- Vercel's free plan is for personal, non-commercial use; a business is
  expected to use **Pro**.
- After a quiet spell the first request takes 1–3 seconds longer while Vercel
  wakes the API up.

## Restaurant settings (in the database)

Nothing about the restaurant is written in the code. One document in the
database (collection `settings`) holds everything the screens, bills and the
Excel report show, and the app loads it when it opens:

| Setting | What it is |
|---|---|
| `name` | Name printed on bills and in the headers |
| `title` | Name in browser tabs, the installed app and the Excel report |
| `shortName` | Short name under the installed app's icon |
| `tagline` | Line under the name, e.g. *Family Restaurant* |
| `location`, `owner` | Shown in the billing header |
| `phones` | Contact numbers printed on bills |
| `credit` | Footer line |
| `paymentMethods` | Payment choices on a bill — the first is preselected |
| `orderTypes` | Order-type choices on a bill — the first is preselected |
| `tableCount` | Tables in the Table list (1 … `tableCount`) |
| `sizeOrder` | Order the sizes of a group item are shown in (others follow, cheapest first) |
| `paymentAliases` | Payment names on older bills counted as another method in reports (e.g. `Cash / UPI` → `Cash`) |

See or change them from the project folder:

```bash
python -m server.settings show
```

```bash
python -m server.settings set phones 9959399849 9490595021
```

Text with spaces goes in quotes (`set tagline "Family Restaurant"`); lists take
several values; `paymentAliases` takes `"old name=new name"` pairs. A change
shows on every screen the next time it is opened (the API keeps a copy for up
to a minute). Staff accounts, categories and the menu are in the database too.

## Staff accounts and passwords

| Role | Accounts | Can use |
|---|---|---|
| admin | 1 | Billing, Analytics, menu and categories, deleting bills |
| cashier | 2 | Billing: bills and the menu |

The accounts live only in the database; the login page lists every admin
and cashier that has a password. To add one:

```bash
python -m server.passwords set <email> --role cashier
```

**Passwords live only in the database**, scrambled with bcrypt — never in the
code or in `.env`. To set or change one (the typed password is not shown):

```bash
python -m server.passwords set <account email>
```

`python -m server.passwords list` shows every account and whether it has a
password (never the password itself).

- Every API call checks the role: cashiers cannot delete bills, only the admin manages the menu and deletes bills.
- There is no limit on wrong password attempts, so use **strong passwords** on
  the live site.

## Printer setup (once per counter PC)

**Print** saves the bill and prints it straight away, with no print dialog, so
a bill can never be printed-then-cancelled or saved without printing by
mistake. For that the counter's browser must print directly:

1. **Print directly (required).** Make a shortcut that opens the billing page
   with direct printing:
   - Right-click the desktop → **New → Shortcut**.
   - For the location, enter one line. Chrome:

     ```
     "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing https://<your-site>/billing
     ```

     or Edge:

     ```
     "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk-printing https://<your-site>/billing
     ```

   - Name it *Billing* and always open the till from this shortcut. Close every
     other Chrome window first: the option only works when Chrome starts from it.
   - Bills now print to Windows' **default printer**, so set the thermal
     printer as default (Settings → Bluetooth & devices → Printers & scanners
     → *your printer* → **Set as default**).
2. **Paper settings (once).** Direct printing reuses the last print-dialog
   settings. Open the billing page once *without* the shortcut, press
   **Ctrl+P**, choose the thermal printer, open **More settings** and set:
   - **Paper size:** the printer's 80 mm receipt / roll size
   - **Margins:** None
   - **Scale:** Default
   - **Headers and footers:** off (unticked)
3. **If blank paper still comes out after each slip**, open Windows **Settings
   → Bluetooth & devices → Printers & scanners → *your printer* → Printing
   preferences**, choose the same 80 mm receipt size there, and switch on the
   driver's option that stops at the end of the printed lines (names differ:
   *paper saving*, *reduce blank space*, *feed/cut at end of page*). Set the
   cutter to cut **after each page**, so the bill and the token slip come out
   separately.

**Save** records a bill without printing it (printer out of paper, or the
customer wants no slip).

Without the shortcut the browser shows its print dialog, and pressing
*Cancel* there still leaves the bill saved: the browser does not tell the page
that the print was cancelled. An admin can delete such a bill from the bill
register in Analytics.

## Your data: bills and reports

### Bill numbers

Bill numbers start again at **1 at midnight** (restaurant time, IST) and are
handed out one at a time, so two counters never get the same number.
`tests/bill_number_test.py` checks this. Because numbers
repeat from day to day, a bill is always opened by its date and number
together.

### Keeping bills

Bills are kept until the admin deletes them (Analytics → Manage bill →
**Permanently delete bills**); nothing is deleted automatically.

### Excel report

Analytics → download → pick the dates. Six sheets: Summary, Daily Sales,
Payment Methods, Order Types, Item Sales and the full Bill Register — Times New
Roman, black only, a border on every cell, A4 with page numbers.

### Backups and logs (on the computer only, never uploaded)

- `backups/` — copies of records removed during earlier clean-ups.
- `logs/` — `api.log` and `web.log` when the servers run in the background;
  deleted bills are recorded there.

## Troubleshooting

| Problem | What to do |
|---|---|
| *Database unavailable* / health check says disconnected | Check `MONGO_URI`; in Atlas → Network Access allow your address (or `0.0.0.0/0` for Vercel) |
| Everyone was signed out after a restart | Set a fixed `JWT_SECRET_KEY` |
| Changes don't show on the live site | Check Vercel → Deployments for the new build; close and reopen installed apps |
| No *Install* button | The portal is already installed on this device. On iPhone use Share → *Add to Home Screen* |
| First screen is slow after a quiet spell | Vercel is waking the API up (1–3 s) |
| Bill prints with big gaps, the date or the web address | Do the [printer setup](#printer-setup-once-per-counter-pc) once on that PC |
| Local app doesn't open after a restart | Start `python app.py` and `npm run dev` again |

## For developers

<details>
<summary><b>Project structure</b></summary>

```
app.py                     start the API on a computer (python app.py)
api/index.py               the same API as one Vercel function
vercel.json                Vercel: build, /api routing, Mumbai region, caching
index.html                 page shell: title, description, link-preview tags, theme script
requirements.txt           Python packages      package.json   Node packages

server/                    Flask API
  __init__.py              create_app(): settings, CORS, sign-in tokens, routes
  config.py                every setting, read from the environment / .env
  db.py                    MongoDB connection, collections, indexes
  api.py                   response format and @roles_required
  bootstrap.py             database indexes (once; nothing is seeded from the code)
  settings.py              restaurant settings in the database + command line
  passwords.py             command line: set staff passwords
  security.py              bcrypt password hashing
  validation.py            bill checks; totals are recomputed on the server
  reports.py               the Excel workbook
  timeutil.py              UTC storage, restaurant "today"
  routes/                  auth, bills, menu, reports, system

src/                       React web app
  main.jsx, App.jsx        start-up and the billing routes
  api/                     client.js (Axios + sign-in), session.js (the stored sign-in), index.js (every API call)
  config/                  settings.js (restaurant settings from the API), portals.js
  styles/                  index.css (colours, layout, print), components.css, theme.js, typography.js
  hooks/                   useMenu, useCart, useNumberGuard, usePageTitle
  components/              auth/, layout/, ui/, notifications/, menu/, modals/, receipt/, settings/
  pages/                   billing/ (+ analytics/)
  utils/                   format, install, zoom, sizes, download

public/                    icons, favicon, robots.txt, app manifest, service worker
brand/logo-original.jpg    the logo the icons are made from (scripts/make_app_icons.py)
docs/screenshots/          images used in this README
tests/                     smoke_test.py (sign-in, menu, billing, reports), bill_number_test.py (midnight reset)
```

</details>

<details>
<summary><b>API reference</b></summary>

All responses are JSON: `{ "success": true, … }` or
`{ "success": false, "error": "…" }`. Signed-in calls send
`Authorization: Bearer <token>` from `POST /api/auth/login`.

| Method | Path | Who |
|---|---|---|
| POST | `/api/auth/login` | anyone |
| GET / POST | `/api/auth/verify`, `/api/auth/logout` | signed in |
| GET | `/api/auth/accounts` (the login list) | anyone |
| GET | `/api/custom-items`, `/api/categories` | admin, cashier |
| POST | `/api/custom-items` | admin, cashier |
| PUT / DELETE | `/api/custom-items/<name>` | admin |
| POST / DELETE | `/api/categories`, `/api/categories/<name>` (deletes its items too) | admin |
| GET | `/api/bill-number` (next number, not used up) | anyone |
| POST | `/api/bill` (save a bill) | admin, cashier |
| GET | `/api/bills`, `/api/bill/<id>` | admin, cashier |
| DELETE | `/api/bill/<id>/permanent-delete` | admin |
| GET | `/api/reports/sales.xlsx?from=YYYY-MM-DD&to=YYYY-MM-DD` | admin |
| GET | `/api/settings` (restaurant settings) | anyone |
| GET | `/api/manifest.webmanifest` (install-app manifest, named from the settings) | anyone |
| GET | `/api/health` | anyone |

</details>

<details>
<summary><b>Conventions</b></summary>

- **Every API call goes through `src/api/index.js`** — components never build
  URLs.
- **The server owns the money** — subtotals, discounts and totals are
  recalculated from the items when a bill is saved.
- **Bills are addressed by `id`**, never by bill number (numbers restart daily).
- **Times are stored in UTC**; "today" is the restaurant's day.
- **No `alert()`, `confirm()` or native `<select>`** — messages use
  `useNotify()`, dropdowns use `Select` / `MenuPopup`.
- **Nothing about the restaurant is in the code** — name, phones, payment
  methods, order types, tables and size order come from the `settings`
  document (`server/settings.py`, `src/config/settings.js`); accounts,
  categories and the menu from their own collections. `index.html` stays
  generic because link previews read it without running the app.
- **Nothing secret in the code** — passwords only in the database, keys only in
  `.env` / the host.
- **Colours are CSS variables** (dark on `:root`, light on
  `html[data-theme='light']`).
- **Popups are drawn above the page and kept on screen** (`MenuPopup`); the
  desktop layout uses `body { zoom }`, so hand-positioned things go through
  `utils/zoom.js`.
- The portal is a staff tool and **kept out of search engines** on purpose
  (`noindex`, `robots.txt`); link previews still work.

</details>

<details>
<summary><b>Testing</b></summary>

```bash
npm run lint && npm run build
```

```bash
python tests/bill_number_test.py
```

Checks that bill numbers start again at 1 at midnight IST (and not at UTC
midnight), that an old counter is handled, and that 20 counters billing at once
get different numbers. Uses a scratch database that it drops afterwards.

The smoke test walks the whole flow — sign-in, roles, menu, billing, the bill
register, the Excel report and menu editing. It saves real bills, so run it
against a **separate test database**, never the shop's:

1. Start a second API on a test database:
   `MONGO_DB_NAME=pos_smoketest PORT=5055 python app.py`
   (copy `settings`, `custom_items` and `categories` into it).
2. Create an admin and a cashier there with
   `python -m server.passwords set <email> --role …` (same `MONGO_DB_NAME`);
   the test picks them from the login list.
3. Run it, then delete the test database:

```bash
SMOKE_BASE_URL=http://localhost:5055 SMOKE_ADMIN_PASSWORD=… SMOKE_STAFF_PASSWORD=… python tests/smoke_test.py
```

</details>

The full history of changes, fixes and decisions is in
[PROJECT_LOG.md](PROJECT_LOG.md).

## Credits

Built for **New Naidu Gari Ruchulu**, Old NH5 Road, Kosingpuram Junction, Palasa.

© D2W 2026
