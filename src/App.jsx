import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { signedInPortal } from './api/session';
import { NotificationProvider } from './components/notifications/Notifications';
import BillingApp from './pages/billing/BillingApp';

/** "/" opens the portal this device is signed in to, or the billing login. */
function Landing() {
  const portal = signedInPortal();
  return <Navigate to={portal ? portal.path : '/billing/login'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/billing/*" element={<BillingApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NotificationProvider>
    </BrowserRouter>
  );
}
