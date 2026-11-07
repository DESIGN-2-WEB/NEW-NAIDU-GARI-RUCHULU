/**
 * Dark/light theme, controlled from the settings menu.
 *
 * The choice lives in localStorage under `theme` and is applied by a small
 * inline script in index.html *before* React loads, so the page never flashes
 * the wrong palette. This module mirrors that logic, adds the
 * class to <html> and keeps the browser UI colour (mobile) in step.
 *
 * Colours themselves are CSS variables: `:root` holds the dark palette and
 * `html[data-theme='light']` (light cream — the default) overrides it in
 * index.css. Components never read the theme — they just use var(--…).
 */

const STORAGE_KEY = 'theme';
const LIGHT = 'light';
const DARK = 'dark';

/** The theme to use when nothing has been chosen yet: light cream. */
function systemTheme() {
  return LIGHT;
}

function storedTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === LIGHT || value === DARK ? value : null;
  } catch {
    return null;
  }
}

export function activeTheme() {
  return storedTheme() || systemTheme();
}

function apply(theme) {
  document.documentElement.classList.toggle('theme-light', theme === LIGHT);
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === LIGHT ? '#F6EBD3' : '#2E1A0D');
}

/** Set up the theme at startup; returns the theme now in force. */
export function initTheme() {
  const theme = activeTheme();
  apply(theme);
  return theme;
}

/** Switch the theme, remember the choice and return the new value. */
export function setTheme(theme) {
  const next = theme === LIGHT ? LIGHT : DARK;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* private mode: still apply for this session */
  }
  apply(next);
  return next;
}
