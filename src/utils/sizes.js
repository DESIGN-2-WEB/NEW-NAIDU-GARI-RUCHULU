/**
 * Portion sizes of a group-priced item, in serving order.
 *
 * The API returns a group's prices as an object whose keys come back sorted
 * alphabetically ("Duo", "Family", "Solo"). The till's size picker and the
 * admin's size editor both show them in the settings' sizeOrder (from the
 * database), with any other size after those, cheapest first.
 */
import { SIZE_ORDER } from '../config/settings';

function sizeRank(size) {
  const index = SIZE_ORDER.indexOf(String(size).trim().toLowerCase());
  return index === -1 ? SIZE_ORDER.length : index;
}

/** `{ label: price }` -> `[[label, price], …]` in serving order. */
export function orderedSizes(prices) {
  return Object.entries(prices || {})
    .map(([size, price]) => [size, Number(price)])
    .sort((a, b) => sizeRank(a[0]) - sizeRank(b[0]) || a[1] - b[1]);
}
