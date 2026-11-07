/**
 * The portal: one definition used for its page title, login page
 * and installable app. The installable app is described by
 * the manifest the API builds (server/routes/system.py) - keep paths in step with it.
 */
export const PORTALS = {
  billing: {
    id: 'billing',
    name: 'Billing Portal',
    path: '/billing',
  },
};

/** The portal a URL path belongs to (always billing). */
export function portalForPath(pathname) {
  const first = String(pathname || '').split('/')[1];
  return PORTALS[first] || PORTALS.billing;
}
