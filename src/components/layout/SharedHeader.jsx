import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout as logoutRequest } from '../../api';
import { clearSession, getUser } from '../../api/session';
import { RESTAURANT } from '../../config/settings';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useNotify } from '../notifications/notification-context';
import SettingsDropdown from './SettingsDropdown';
import { AnalyticsIcon, BackIcon, DownloadIcon } from '../ui/icons';

export default function SharedHeader({
  titleText,
  showAnalyticsBtn = false,
  showBackBtn = false,
  backRoute = '/billing',
  loginPath = '/billing/login',
  showSettingsBtn = true,
  showDownloadBtn = false,
  onDownload,
  showHeaderInfo = true,
  onAddCategory,
  onDeleteCategory,
  onAddMenu,
  onEditMenu,
  onDeleteMenu,
}) {
  const navigate = useNavigate();
  const user = useMemo(() => getUser(), []);
  const notify = useNotify();
  usePageTitle(titleText);

  const handleLogout = useCallback(async () => {
    // Tell the server for the audit log, but never let a failed call trap the
    // user in a session they asked to end.
    try {
      await logoutRequest();
    } catch {
      /* ignore */
    } finally {
      clearSession();
      notify('Signed out.', 'info');
      navigate(loginPath, { replace: true });
    }
  }, [loginPath, navigate, notify]);


  return (
    <header className="header" role="banner">
      <div className="header-top-row">
        <div className="header-icons">
          {showSettingsBtn && (
            <SettingsDropdown
              user={user}
              onLogout={handleLogout}
              onAddCategory={onAddCategory}
              onDeleteCategory={onDeleteCategory}
              onAddMenu={onAddMenu}
              onEditMenu={onEditMenu}
              onDeleteMenu={onDeleteMenu}
            />
          )}
        </div>

        <div className="billing-portal-heading">
          <h1>{RESTAURANT.name}</h1>
          <h3>{RESTAURANT.tagline}</h3>
          {titleText && <div className="header-portal-subtitle">{titleText}</div>}
        </div>

        <div className="header-actions">
          {showAnalyticsBtn && (
            <button type="button" className="icon-btn" onClick={() => navigate('/billing/analytics')} title="Analytics" aria-label="Analytics">
              <AnalyticsIcon />
            </button>
          )}

          {showDownloadBtn && onDownload && (
            <button type="button" className="icon-btn" onClick={onDownload} title="Download report" aria-label="Download report">
              <DownloadIcon />
            </button>
          )}

          {showBackBtn && (
            <button type="button" className="icon-btn" onClick={() => navigate(backRoute)} title="Back" aria-label="Back">
              <BackIcon />
            </button>
          )}
        </div>
      </div>

      {showHeaderInfo && (
        <div className="header-info">
          <div className="location">
            <strong>Address:&nbsp;</strong>
            <span>
              {RESTAURANT.location}
            </span>
          </div>
          <div className="owner">
            <div className="owner-row">
              <strong>Owner:</strong>
              <span>{RESTAURANT.owner} ({RESTAURANT.phones.join(', ')})</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
