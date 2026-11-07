import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchLoginAccounts, login } from '../../api';
import { errorMessage } from '../../api/client';
import { clearSession, saveSession } from '../../api/session';
import { RESTAURANT } from '../../config/settings';
import { usePageTitle } from '../../hooks/usePageTitle';
import InstallAppButton from '../layout/InstallAppButton';
import Tagline from '../layout/Tagline';
import { useNotify } from '../notifications/notification-context';
import './SharedLogin.css';

export default function SharedLogin({ portal, targetRole, helperText }) {
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const notify = useNotify();
  const [loading, setLoading] = useState(false);
  usePageTitle(`${portal.name} login`);

  useEffect(() => {
    // Arriving at a login screen means whatever session existed is finished.
    clearSession();
  }, []);

  useEffect(() => {
    let active = true;
    fetchLoginAccounts()
      .then((list) => {
        if (active) setAccounts(list.filter((account) => targetRole.includes(account.role)));
      })
      .catch((err) => {
        if (active) notify(errorMessage(err, 'Could not load accounts'), 'error');
      })
      .finally(() => {
        if (active) setAccountsLoading(false);
      });
    return () => { active = false; };
  }, [notify, targetRole]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      notify('Select an account and enter the password.', 'error');
      return;
    }

    setLoading(true);

    try {
      const data = await login(email, password);

      if (!targetRole.includes(data.user.role)) {
        notify(`This portal is for ${targetRole.join(' or ')} accounts, not ${data.user.role}.`, 'error');
        return;
      }

      saveSession(data.token, data.user);
      notify('Signed in — opening the portal…', 'success');
      navigate(portal.path, { replace: true });
    } catch (err) {
      notify(errorMessage(err, 'Could not sign in'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedLabel = accounts.find((a) => a.value === email)?.label;

  return (
    <div className="page-shell">
      <header className="header">
        <div className="header-container">
          <div className="header-brand-info">            <h1>{RESTAURANT.name}</h1>
            <Tagline />
            <div className="header-portal-subtitle">{portal.name}</div>
          </div>
          <div className="install-app">
            <InstallAppButton portal={portal} onResult={(message) => notify(message, 'info')} />
          </div>
        </div>
      </header>

      <main className="login-container">
        <div className="login-box">
          <div className="login-header">
            <h2 className="login-title">Login</h2>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label id="account-label">Account</label>
              <div
                className="custom-dropdown"
                role="button"
                tabIndex={0}
                aria-labelledby="account-label"
                aria-expanded={dropdownOpen}
                aria-disabled={accountsLoading || accounts.length === 0}
                onClick={() => !accountsLoading && setDropdownOpen((open) => !open)}
                onKeyDown={(e) => e.key === 'Enter' && !accountsLoading && setDropdownOpen((open) => !open)}
              >
                <div className={`dropdown-selected ${email ? '' : 'placeholder'}`}>
                  {selectedLabel || (accountsLoading ? 'Loading accounts…' : 'Select account')}
                  <span className="dropdown-arrow">▼</span>
                </div>

                {dropdownOpen && (
                  <div className="dropdown-options">
                    {accounts.length === 0 ? (
                      <div className="dropdown-option">No accounts available</div>
                    ) : accounts.map((account) => (
                      <div
                        key={account.value}
                        className="dropdown-option"
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEmail(account.value);
                          setDropdownOpen(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return;
                          e.stopPropagation();
                          setEmail(account.value);
                          setDropdownOpen(false);
                        }}
                      >
                        {account.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <div className="password-field">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword((shown) => !shown)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button type="submit" className="login-btn" disabled={loading || accountsLoading || accounts.length === 0}>
              {loading ? 'Signing in…' : 'Login'}
              {loading && <span className="loading-spinner show" />}
            </button>
          </form>

          {helperText && <div className="helper-text">{helperText}</div>}
        </div>
      </main>

      <footer className="login-footer">
        <b>{RESTAURANT.credit}</b>
      </footer>
    </div>
  );
}
