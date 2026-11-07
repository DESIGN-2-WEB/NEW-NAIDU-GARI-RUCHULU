import { useCallback, useEffect, useRef, useState } from 'react';
import { NotificationContext } from './notification-context';
import './Notifications.css';

/**
 * One place for every message the app shows: `notify("Bill saved")` adds a
 * card to the stack, which dismisses itself after a few seconds.
 *
 * This replaces the browser's `alert()`, which froze the till until someone
 * dismissed it - awkward on a touch screen mid-service.
 */

const AUTO_DISMISS_MS = { info: 4000, success: 4000, error: 8000 };

/** Cards visible at once. Beyond this the oldest drop off rather than covering
 *  the bill panel behind them. */
const MAX_VISIBLE = 4;

const ICONS = {
  success: <path d="M20 6 9 17l-5-5" />,
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="12" y1="16.5" x2="12" y2="16.6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <line x1="12" y1="7.5" x2="12" y2="7.6" />
    </>
  ),
};

function NoticeIcon({ tone }) {
  return (
    <svg
      className="notice-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[tone] || ICONS.info}
    </svg>
  );
}

function Notice({ notice, onDismiss }) {
  const { id, tone, title, message } = notice;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), AUTO_DISMISS_MS[tone] ?? AUTO_DISMISS_MS.info);
    return () => clearTimeout(timer);
  }, [id, tone, onDismiss]);

  return (
    <div className={`notice notice-${tone}`} role="status" aria-live="polite">
      <NoticeIcon tone={tone} />
      <div className="notice-body">
        {title && <div className="notice-title">{title}</div>}
        <div className="notice-message">{message}</div>
      </div>
      <button
        type="button"
        className="notice-close"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

export function NotificationProvider({ children }) {
  const [notices, setNotices] = useState([]);
  const nextId = useRef(1);

  const push = useCallback((message, tone = 'info', title = '') => {
    const id = `local-${nextId.current += 1}`;
    setNotices((current) => [...current, { id, tone, title, message }]);
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={push}>
      {children}
      {notices.length > 0 && (
        <div className="notice-stack" aria-live="polite">
          {notices.slice(-MAX_VISIBLE).map((notice) => (
            <Notice key={notice.id} notice={notice} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </NotificationContext.Provider>
  );
}
