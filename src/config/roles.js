/**
 * Staff roles - the one place the web app names them (the API's copy is
 * server/roles.py).
 *
 * admin    everything: billing, analytics, the menu, deleting bills, Management
 * cashier  billing and adding one-off menu items
 */
export const ADMIN = 'admin';
export const CASHIER = 'cashier';
export const ROLES = [ADMIN, CASHIER];

export const isAdmin = (user) => user?.role === ADMIN;

/** The category one-off items from the + button are filed under. */
export const CUSTOM_CATEGORY = 'custom';
