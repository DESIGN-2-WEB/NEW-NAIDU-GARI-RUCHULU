import { useEffect } from 'react';
import { RESTAURANT } from '../config/settings';

/**
 * The browser tab title for the page on screen, e.g.
 * "Billing Portal · <restaurant title>" - so tabs, bookmarks,
 * history and installed apps say which portal they are.
 */
export function usePageTitle(title) {
  useEffect(() => {
    // Either part may be missing (e.g. a title not set in the settings yet).
    document.title = [title, RESTAURANT.title].filter(Boolean).join(' · ') || 'Billing POS';
  }, [title]);
}
