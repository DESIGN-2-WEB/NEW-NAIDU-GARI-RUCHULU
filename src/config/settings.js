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

/** name, title, shortName, tagline, location, owner, phones, credit */
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

/** Fetch the settings (falling back to this device's last copy). */
export async function loadSettings() {
  try {
    const settings = await fetchSettings();
    apply(settings);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
    } catch {
      /* storage full or blocked: the next start just fetches again */
    }
  } catch (err) {
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    } catch {
      cached = null;
    }
    if (!cached) throw err;
    apply(cached);
  }
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
