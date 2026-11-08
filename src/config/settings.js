/**
 * The restaurant settings, from the database (GET /api/settings): name,
 * tagline, address, owner, phones, footer line, payment methods, order
 * types, number of tables and the order sizes are shown in. Nothing about the
 * restaurant is written in the code - change it with
 * `python -m server.settings set …`.
 *
 * main.jsx calls loadSettings() before the first render, so components can
 * read these objects directly. If the API cannot be reached the last copy
 * this device saw is used, so a till still opens during a network blip.
 */
import { fetchSettings } from '../api';

/** name, title, shortName, tagline, location (the address), owner, phones, gstNumber, credit, … */
export const RESTAURANT = { phones: [] };

/** Payment choices on a bill; the first is preselected. */
export const PAYMENT_METHODS = [];

/** Order-type choices on a bill; the first is preselected. */
export const ORDER_TYPES = [];

/** Group-item sizes in serving order (lower-case), e.g. solo, duo, trio. */
export const SIZE_ORDER = [];

let tableCount = 0;

const CACHE_KEY = 'settings:restaurant';

function apply(settings) {
  const { paymentMethods, orderTypes, sizeOrder, tableCount: tables, ...restaurant } = settings;
  Object.assign(RESTAURANT, { phones: [] }, restaurant);
  PAYMENT_METHODS.splice(0, PAYMENT_METHODS.length, ...(paymentMethods || []));
  ORDER_TYPES.splice(0, ORDER_TYPES.length, ...(orderTypes || []));
  SIZE_ORDER.splice(0, SIZE_ORDER.length, ...(sizeOrder || []).map((s) => String(s).trim().toLowerCase()));
  tableCount = Number(tables) || 0;
}

function remember(settings) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch {
    /* storage full or blocked: the next start just fetches again */
  }
}

/**
 * Use the settings the API just returned after the admin saved them in
 * Management, and tell open screens to redraw (`settings:changed`).
 */
export function replaceSettings(settings) {
  apply(settings);
  remember(settings);
  window.dispatchEvent(new Event('settings:changed'));
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  } catch {
    return null;
  }
}

/**
 * Load the settings before the first screen.
 *
 * A device that has opened the app before has a copy: it is used at once, so
 * the screen appears without waiting for the API (which can take a few
 * seconds to wake up on Vercel), and fresh settings are fetched in the
 * background; if they differ, open screens redraw. A first visit waits for
 * the API.
 */
export async function loadSettings() {
  const cached = readCache();
  if (cached) {
    apply(cached);
    fetchSettings()
      .then((fresh) => {
        if (JSON.stringify(fresh) === JSON.stringify(cached)) return;
        replaceSettings(fresh);
      })
      .catch(() => { /* offline or waking up: keep this device's copy */ });
    return;
  }
  const settings = await fetchSettings();
  apply(settings);
  remember(settings);
}

/** `[{value,label}]` for the table dropdown, with an "unassigned" first row. */
export function tableOptions(emptyLabel = 'Not assigned') {
  return [
    { value: '', label: emptyLabel },
    ...Array.from({ length: tableCount }, (_, i) => ({
      value: String(i + 1),
      label: `Table ${i + 1}`,
    })),
  ];
}
