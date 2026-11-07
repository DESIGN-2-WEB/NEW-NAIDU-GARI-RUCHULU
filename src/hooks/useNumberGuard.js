import { useCallback, useRef } from 'react';
import { useNotify } from '../components/notifications/notification-context';

/**
 * Shared guard for every number field (price, size price, discount %).
 *
 * `<input type="number" min=...>` only stops the spinner: typing "-5" or
 * "150" still went into state and was silently clamped on save, so the person
 * at the till never learned the value was wrong. Each keystroke is checked
 * here instead — an out-of-range value is refused (the field keeps the value
 * it had) and the reason arrives as one toast, not one card per keystroke.
 *
 * Returns `true` when the typed value may be used.
 *
 *   const guardNumber = useNumberGuard();
 *   onChange={(e) => guardNumber(e.target.value, {
 *     min: 1, message: 'Enter a price above zero.',
 *   }) && setPrice(e.target.value)}
 */
export default function useNumberGuard() {
  const notify = useNotify();
  const last = useRef({ message: '', at: 0 });

  return useCallback((raw, { min, max, message } = {}) => {
    const text = String(raw).trim();
    // Empty, or the lone minus/sign of a number still being typed.
    if (text === '' || text === '-' || text === '.' || text === '-.') return true;

    const value = Number(text);
    const tooLow = min !== undefined && value < min;
    const tooHigh = max !== undefined && value > max;
    if (Number.isFinite(value) && !tooLow && !tooHigh) return true;

    // Holding a key down would otherwise stack an identical card per repeat.
    const now = Date.now();
    if (last.current.message !== message || now - last.current.at > 1500) {
      notify(message, 'error');
      last.current = { message, at: now };
    }
    return false;
  }, [notify]);
}
