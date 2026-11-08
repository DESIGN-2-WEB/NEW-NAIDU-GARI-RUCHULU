import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, ChartColumn, Check, ChevronDown, Eye, EyeOff,
  LoaderCircle, Lock, MapPin, Phone, ReceiptText, User, UtensilsCrossed,
} from 'lucide-react';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/playfair-display/wght-italic.css';
import { fetchLoginAccounts, login } from '../../api';
import { errorMessage } from '../../api/client';
import { clearSession, saveSession } from '../../api/session';
import { RESTAURANT } from '../../config/settings';
import { usePageTitle } from '../../hooks/usePageTitle';
import InstallAppButton from '../layout/InstallAppButton';
import { useNotify } from '../notifications/notification-context';
import './SharedLogin.css';
import './Login.css';

/** Remembers which account last signed in on this device, to preselect it. */
const LAST_ACCOUNT_KEY = 'login:lastAccount';

function readLastAccount() {
  try {
    return localStorage.getItem(LAST_ACCOUNT_KEY) || '';
  } catch {
    return '';
  }
}

function rememberAccount(email) {
  try {
    localStorage.setItem(LAST_ACCOUNT_KEY, email);
  } catch {
    /* private window or blocked storage: nothing to remember */
  }
}

const FEATURES = [
  { icon: ReceiptText, title: 'Counter billing', text: 'Bills, thermal receipts and payments' },
  { icon: ChartColumn, title: 'Sales analytics', text: 'Daily sales, charts and Excel reports' },
  { icon: UtensilsCrossed, title: 'Menu & categories', text: 'Prices, sizes and custom items' },
];

/** Gold line rosette drawn from rotated ellipses, like a spirograph. */
function Rosette({ className, petals = 36, rx = 150, ry = 62 }) {
  const angles = useMemo(
    () => Array.from({ length: petals }, (_, i) => (180 / petals) * i),
    [petals],
  );
  return (
    <svg className={className} viewBox="-160 -160 320 320" aria-hidden="true" focusable="false">
      {angles.map((angle) => (
        <ellipse key={angle} rx={rx} ry={ry} transform={`rotate(${angle})`} />
      ))}
      <circle r={rx * 0.42} className="lg-rosette-core" />
    </svg>
  );
}

export default function SharedLogin({ portal, targetRole, helperText }) {
  const navigate = useNavigate();
  const notify = useNotify();

  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const pickerRef = useRef(null);
  const passwordRef = useRef(null);
  usePageTitle(`${portal.name} login`);

  useEffect(() => {
    // Arriving at a login screen means whatever session existed is finished.
    clearSession();
  }, []);

  useEffect(() => {
    let active = true;
    fetchLoginAccounts()
      .then((list) => {
        if (!active) return;
        const allowed = list.filter((account) => targetRole.includes(account.role));
        setAccounts(allowed);
        const last = readLastAccount();
        const preselect = allowed.find((a) => a.value === last) || allowed[0];
        if (preselect) setEmail(preselect.value);
      })
      .catch((err) => {
        if (active) notify(errorMessage(err, 'Could not load accounts'), 'error');
      })
      .finally(() => {
        if (active) setAccountsLoading(false);
      });
    return () => { active = false; };
  }, [notify, targetRole]);

  // Close the account list on a click outside it.
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const disabled = accountsLoading || accounts.length === 0;
  const selected = accounts.find((a) => a.value === email);

  const openList = () => {
    if (disabled) return;
    setActiveIndex(Math.max(0, accounts.findIndex((a) => a.value === email)));
    setOpen(true);
  };

  const choose = (account) => {
    setEmail(account.value);
    setOpen(false);
    // Straight on to the password once an account is picked.
    requestAnimationFrame(() => passwordRef.current?.focus());
  };

  const onPickerKeyDown = (event) => {
    if (disabled) return;
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % accounts.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + accounts.length) % accounts.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (accounts[activeIndex]) choose(accounts[activeIndex]);
    }
  };

  const fail = (message) => {
    notify(message, 'error');
    setShake(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      fail('Select an account and enter the password.');
      return;
    }

    setLoading(true);
    try {
      const data = await login(email, password);

      if (!targetRole.includes(data.user.role)) {
        fail(`This portal is for ${targetRole.join(' or ')} accounts, not ${data.user.role}.`);
        return;
      }

      rememberAccount(email);
      saveSession(data.token, data.user);
      notify('Signed in. Opening the portal…', 'success');
      navigate(portal.path, { replace: true });
    } catch (err) {
      fail(errorMessage(err, 'Could not sign in'));
    } finally {
      setLoading(false);
    }
  };

  const phones = (RESTAURANT.phones || []).filter(Boolean);
  const listId = 'lg-account-list';

  return (
    <div className="lg-page">
      <aside className="lg-brand">
        <Rosette className="lg-rosette lg-rosette-a" petals={28} />
        <Rosette className="lg-rosette lg-rosette-b" petals={44} rx={152} ry={70} />

        <div className="lg-brand-inner">
          <div className="lg-identity lg-reveal" style={{ '--d': 0 }}>
            <img className="lg-logo" src="/icons/logo-192.png" alt="" width="52" height="52" />
            <div>
              <div className="lg-name">{RESTAURANT.name}</div>
              {RESTAURANT.tagline && <div className="lg-tagline">{RESTAURANT.tagline}</div>}
            </div>
          </div>
          <dl className="lg-details lg-reveal" style={{ '--d': 1 }}>
            {RESTAURANT.owner && (
              <div className="lg-detail">
                <dt><User size={13} aria-hidden="true" />Owner</dt>
                <dd>{RESTAURANT.owner}</dd>
              </div>
            )}
            {RESTAURANT.location && (
              <div className="lg-detail">
                <dt><MapPin size={13} aria-hidden="true" />Address</dt>
                <dd>{RESTAURANT.location}</dd>
              </div>
            )}
            {phones.length > 0 && (
              <div className="lg-detail">
                <dt><Phone size={13} aria-hidden="true" />Phone</dt>
                <dd>{phones.join(' / ')}</dd>
              </div>
            )}
          </dl>

          <div className="lg-hero">
            <div className="lg-kicker lg-reveal" style={{ '--d': 2 }}>{portal.name}</div>
            <h1 className="lg-headline lg-reveal" style={{ '--d': 3 }}>
              Every order,<br />
              <em>perfectly</em> billed.
            </h1>

            <ul className="lg-features">
              {FEATURES.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="lg-feature lg-reveal" style={{ '--d': 5 + i }}>
                  <span className="lg-feature-icon"><Icon size={17} aria-hidden="true" /></span>
                  <span>
                    <span className="lg-feature-title">{title}</span>
                    <span className="lg-feature-text">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {RESTAURANT.credit && (
            <div className="lg-credit lg-reveal" style={{ '--d': 8 }}>{RESTAURANT.credit}</div>
          )}
        </div>
      </aside>

      <main className="lg-main">
        <div className="lg-install">
          <InstallAppButton portal={portal} onResult={(message) => notify(message, 'info')} />
        </div>

        <div
          className={`lg-card${shake ? ' lg-shake' : ''}`}
          onAnimationEnd={(e) => e.animationName === 'lg-shake' && setShake(false)}
        >
          <h2 className="lg-title lg-reveal" style={{ '--d': 1 }}>Welcome back</h2>
          <p className="lg-subtitle lg-reveal" style={{ '--d': 2 }}>
            Choose your account and enter your password.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="lg-field lg-field-account lg-reveal" style={{ '--d': 3 }}>
              <span className="lg-label" id="lg-account-label">Login as</span>
              <div className={`lg-picker${open ? ' is-open' : ''}`} ref={pickerRef}>
                <button
                  type="button"
                  className="lg-control lg-picker-button"
                  aria-haspopup="listbox"
                  aria-expanded={open}
                  aria-controls={listId}
                  aria-labelledby="lg-account-label"
                  aria-activedescendant={open && activeIndex >= 0 ? `lg-opt-${activeIndex}` : undefined}
                  disabled={disabled}
                  onClick={() => (open ? setOpen(false) : openList())}
                  onKeyDown={onPickerKeyDown}
                >
                  <User className="lg-control-icon" size={17} aria-hidden="true" />
                  <span className={`lg-picker-value${selected ? '' : ' is-placeholder'}`}>
                    {selected?.label
                      || (accountsLoading ? 'Loading accounts…' : accounts.length ? 'Select account' : 'No accounts available')}
                  </span>
                  {accountsLoading
                    ? <LoaderCircle className="lg-spin lg-chevron" size={17} aria-hidden="true" />
                    : <ChevronDown className="lg-chevron" size={17} aria-hidden="true" />}
                </button>

                <ul className="lg-options" id={listId} role="listbox" aria-labelledby="lg-account-label">
                  {accounts.map((account, i) => {
                    const isSelected = account.value === email;
                    return (
                      <li
                        key={account.value}
                        id={`lg-opt-${i}`}
                        role="option"
                        aria-selected={isSelected}
                        className={`lg-option${i === activeIndex ? ' is-active' : ''}`}
                        onPointerEnter={() => setActiveIndex(i)}
                        onClick={() => choose(account)}
                      >
                        <span className="lg-option-avatar" aria-hidden="true">
                          {String(account.label || '?').charAt(0).toUpperCase()}
                        </span>
                        <span className="lg-option-text">
                          <span className="lg-option-name">{account.label}</span>
                          <span className="lg-option-role">{account.role}</span>
                        </span>
                        {isSelected && <Check className="lg-option-check" size={16} aria-hidden="true" />}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div className="lg-field lg-reveal" style={{ '--d': 4 }}>
              <label className="lg-label" htmlFor="login-password">Password</label>
              <div className="lg-control lg-password">
                <Lock className="lg-control-icon" size={17} aria-hidden="true" />
                <input
                  id="login-password"
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="lg-eye"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="lg-submit lg-reveal"
              style={{ '--d': 5 }}
              disabled={loading || disabled}
            >
              {loading ? (
                <>
                  <LoaderCircle className="lg-spin" size={18} aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="lg-submit-arrow" size={18} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {helperText && <div className="lg-helper">{helperText}</div>}
        </div>
      </main>
    </div>
  );
}
