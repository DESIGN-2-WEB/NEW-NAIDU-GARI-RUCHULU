/**
 * Session storage helpers: the sign-in token and the signed-in user, kept in
 * localStorage. Nothing else reads or writes these keys.
 *
 * The sign-in is stored per portal (see src/config/portals.js), keyed by the
 * page's address (/billing…), so an installed app and browser tabs share one
 * session per portal.
 */
import { PORTALS, portalForPath } from '../config/portals';

// One shared sign-in, written by earlier versions; removed on the next
// sign-in or sign-out.
const OLD_KEYS = ['token', 'authToken', 'user'];

function keysFor(portalId) {
  const id = portalId || portalForPath(window.location.pathname).id;
  return { token: `session:${id}:token`, user: `session:${id}:user` };
}

export function getToken(portalId) {
  return localStorage.getItem(keysFor(portalId).token) || '';
}

export function getUser(portalId) {
  try {
    const raw = localStorage.getItem(keysFor(portalId).user);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // A corrupted entry should log the user out, not crash the portal.
    return null;
  }
}

export function saveSession(token, user, portalId) {
  const keys = keysFor(portalId);
  localStorage.setItem(keys.token, token);
  localStorage.setItem(keys.user, JSON.stringify(user));
  OLD_KEYS.forEach((key) => localStorage.removeItem(key));
}

/** End this portal's sign-in only; the other portals stay signed in. */
export function clearSession(portalId) {
  const keys = keysFor(portalId);
  localStorage.removeItem(keys.token);
  localStorage.removeItem(keys.user);
  OLD_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function isSignedIn(portalId) {
  return Boolean(getToken(portalId) && getUser(portalId));
}

/** The first portal this device is signed in to, if any (for the "/" page). */
export function signedInPortal() {
  return Object.values(PORTALS).find((portal) => isSignedIn(portal.id)) || null;
}
