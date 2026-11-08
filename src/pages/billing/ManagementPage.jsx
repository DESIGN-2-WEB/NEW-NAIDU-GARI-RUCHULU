import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KeyRound, Store, Users } from 'lucide-react';
import { getUser } from '../../api/session';
import SharedHeader from '../../components/layout/SharedHeader';
import AccountTab from '../../components/management/AccountTab';
import RestaurantTab from '../../components/management/RestaurantTab';
import UsersTab from '../../components/management/UsersTab';
import { PORTALS } from '../../config/portals';
import { RESTAURANT } from '../../config/settings';
import { isAdmin } from '../../config/roles';
import '../../components/management/management.css';

const SECTIONS = [
  {
    id: 'restaurant',
    label: 'Restaurant details',
    icon: Store,
    adminOnly: true,
    intro: 'Name, owner, address, phone numbers and GST number. They appear on the login page, the billing header and every printed bill.',
  },
  {
    id: 'users',
    label: 'Users',
    icon: Users,
    adminOnly: true,
    intro: 'The staff accounts that can sign in. Add an account, set a new password for someone who forgot theirs, or delete an account.',
  },
  {
    id: 'account',
    label: 'My account',
    icon: KeyRound,
    adminOnly: false,
    intro: 'Change the password you sign in with.',
  },
];

/**
 * Management page (/billing/management?section=…): the restaurant's details,
 * staff accounts and your own password. An admin sees all three sections; a
 * cashier only "My account".
 */
export default function ManagementPage({ loginPath }) {
  const user = useMemo(() => getUser() || {}, []);
  const admin = isAdmin(user);
  const sections = SECTIONS.filter((section) => admin || !section.adminOnly);

  const [params, setParams] = useSearchParams();
  const requested = params.get('section');
  const active = sections.find((s) => s.id === requested) || sections[0];
  const [busy, setBusy] = useState(false);

  const open = (id) => {
    if (!busy) setParams({ section: id }, { replace: true });
  };

  return (
    <div className="page-shell mgmt-page">
      <SharedHeader
        titleText={admin ? 'Management' : 'My account'}
        showBackBtn
        backRoute={PORTALS.billing.path}
        showHeaderInfo={false}
        loginPath={loginPath}
      />

      <main className="mgmt-layout">
        {sections.length > 1 && (
          <nav className="mgmt-nav" aria-label="Management sections">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`mgmt-nav-item${active.id === id ? ' active' : ''}`}
                aria-current={active.id === id ? 'page' : undefined}
                onClick={() => open(id)}
                disabled={busy}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}

        <section className="mgmt-panel" aria-labelledby="mgmt-panel-title">
          <header className="mgmt-panel-head">
            <h2 id="mgmt-panel-title">{active.label}</h2>
            <p>{active.intro}</p>
          </header>

          {active.id === 'restaurant' && <RestaurantTab onBusy={setBusy} />}
          {active.id === 'users' && <UsersTab onBusy={setBusy} />}
          {active.id === 'account' && <AccountTab user={user} onBusy={setBusy} />}
        </section>
      </main>

      <footer className="page-footer" role="contentinfo">
        <b>{RESTAURANT.credit}</b>
      </footer>
    </div>
  );
}
