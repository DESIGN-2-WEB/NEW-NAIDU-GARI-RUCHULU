import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { fetchCategories, fetchMenuItems } from '../../api';
import { errorMessage } from '../../api/client';
import { getUser } from '../../api/session';
import { useNotify } from '../../components/notifications/notification-context';
import { RESTAURANT } from '../../config/settings';
import RequireAuth from '../../components/auth/RequireAuth';
import SharedHeader from '../../components/layout/SharedHeader';
import SharedLogin from '../../components/auth/SharedLogin';
import { PORTALS } from '../../config/portals';
import { ADMIN, ROLES, isAdmin } from '../../config/roles';
import {
  AddCategoryModal,
  AddMenuItemModal,
  DeleteCategoryModal,
  DeleteMenuModal,
  EditMenuModal,
} from '../../components/settings';
import { orderCategories } from '../../hooks/useMenu';
import ManagementPage from './ManagementPage';
import BillingDashboard from './BillingDashboard';

// Analytics pulls in Chart.js, which the till itself never needs. Loading it
// on demand keeps the billing screen's bundle small on the counter terminal.
const AnalyticsDashboard = lazy(() => import('./analytics/AnalyticsDashboard'));

const LOGIN_PATH = `${PORTALS.billing.path}/login`;

const NO_MODAL = null;

function AnalyticsPortal() {
  const handleDownload = () => window.dispatchEvent(new Event('analytics:download'));

  return (
    <div className="page-shell analytics-portal">
      <SharedHeader
        titleText="Analytics Dashboard"
        showBackBtn
        backRoute="/billing"
        showSettingsBtn={false}
        showDownloadBtn
        onDownload={handleDownload}
        showHeaderInfo={false}
        loginPath={LOGIN_PATH}
      />
      <Suspense fallback={<p className="analytics-message">Loading analytics…</p>}>
        <AnalyticsDashboard />
      </Suspense>
    </div>
  );
}

function BillingPortal() {
  const user = useMemo(() => getUser() || {}, []);
  const admin = isAdmin(user);
  const notify = useNotify();

  const [openModal, setOpenModal] = useState(NO_MODAL);

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);

  // The menu-management dialogs need the full catalogue to populate their
  // pickers; only an admin can open them, so only an admin pays for the fetch.
  const loadCatalogue = useCallback(async () => {
    if (!admin) return;
    try {
      const [cats, menuItems] = await Promise.all([fetchCategories(), fetchMenuItems()]);
      setCategories(orderCategories(cats, menuItems));
      setItems(menuItems);
    } catch (err) {
      // The dashboard covers the menu grid; this fetch fills the settings
      // dialogs' pickers, so a silent failure left the admin looking at
      // empty lists with no idea why.
      notify(errorMessage(err, 'Could not load the menu for the settings dialogs'), 'error');
    }
  }, [admin, notify]);

  useEffect(() => { loadCatalogue(); }, [loadCatalogue]);

  // Resolves once the dialogs' own lists are fresh, so a dialog that stays
  // open after a change shows the result straight away.
  const refreshAll = useCallback(async () => {
    // Tell every mounted dashboard to reload its menu.
    window.dispatchEvent(new Event('menu:refresh'));
    await loadCatalogue();
  }, [loadCatalogue]);

  const close = () => setOpenModal(NO_MODAL);
  const modalProps = { onClose: close, onRefresh: refreshAll };

  return (
    <div className="page-shell">
      <SharedHeader
        titleText={PORTALS.billing.name}
        showAnalyticsBtn={admin}
        loginPath={LOGIN_PATH}
        onAddCategory={() => setOpenModal('addCategory')}
        onDeleteCategory={() => setOpenModal('deleteCategory')}
        onAddMenu={() => setOpenModal('addMenu')}
        onEditMenu={() => setOpenModal('editMenu')}
        onDeleteMenu={() => setOpenModal('deleteMenu')}
      />

      <BillingDashboard />

      <footer className="page-footer" role="contentinfo">
        <b>{RESTAURANT.credit}</b>
      </footer>

      {openModal === 'addCategory' && <AddCategoryModal {...modalProps} />}
      {openModal === 'deleteCategory' && <DeleteCategoryModal {...modalProps} categories={categories} items={items} />}
      {openModal === 'addMenu' && <AddMenuItemModal {...modalProps} categories={categories} />}
      {openModal === 'editMenu' && <EditMenuModal {...modalProps} categories={categories} items={items} />}
      {openModal === 'deleteMenu' && <DeleteMenuModal {...modalProps} categories={categories} items={items} />}
    </div>
  );
}

export default function BillingApp() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth roles={ROLES} loginPath={LOGIN_PATH}>
            <BillingPortal />
          </RequireAuth>
        }
      />
      <Route
        path="/analytics"
        element={
          <RequireAuth roles={[ADMIN]} loginPath={LOGIN_PATH}>
            <AnalyticsPortal />
          </RequireAuth>
        }
      />
      <Route
        path="/management"
        element={
          <RequireAuth roles={ROLES} loginPath={LOGIN_PATH}>
            <ManagementPage loginPath={LOGIN_PATH} />
          </RequireAuth>
        }
      />
      <Route
        path="/login"
        element={
          <SharedLogin
            portal={PORTALS.billing}
            targetRole={ROLES}
          />
        }
      />
      <Route path="*" element={<Navigate to="/billing" replace />} />
    </Routes>
  );
}
