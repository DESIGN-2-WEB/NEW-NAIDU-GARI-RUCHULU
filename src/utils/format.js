/** Shared display formatting. */

const RUPEES = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/** `1234.5` -> `"₹1,234.5"` */
export function rupees(value) {
  return `₹${RUPEES.format(Number(value) || 0)}`;
}

export function dateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-IN');
}

/** `yyyy-mm-dd` in local time - `toISOString` would shift the day for IST. */
export function toDateInput(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

