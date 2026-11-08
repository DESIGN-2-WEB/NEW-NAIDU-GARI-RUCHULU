import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Trash2, UserPlus } from 'lucide-react';
import { createUser, deleteUser, fetchUsers, resetUserPassword } from '../../api';
import { errorMessage } from '../../api/client';
import { ADMIN, CASHIER } from '../../config/roles';
import { useNotify } from '../notifications/notification-context';
import Select from '../ui/Select';
import PasswordInput from './PasswordInput';

const ROLE_OPTIONS = [
  { value: CASHIER, label: 'Cashier' },
  { value: ADMIN, label: 'Admin' },
];
const ROLE_HELP = {
  [CASHIER]: 'Billing and adding one-off items.',
  [ADMIN]: 'Everything: billing, analytics, the menu and Management.',
};
const EMPTY_USER = { username: '', email: '', role: CASHIER, password: '' };

/** Management -> Users: staff accounts. Add, delete, or set a new password. */
export default function UsersTab({ onBusy }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_USER);
  const [busy, setBusyState] = useState(false);
  // One row at a time asks "Delete …?" or shows its new-password box.
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [resetFor, setResetFor] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const notify = useNotify();

  const setBusy = (value) => { setBusyState(value); onBusy(value); };

  const load = useCallback(async () => {
    try {
      setUsers(await fetchUsers());
    } catch (err) {
      notify(errorMessage(err, 'Could not load the accounts'), 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const run = async (action, success) => {
    setBusy(true);
    try {
      const result = await action();
      notify(result?.message || success, 'success');
      await load();
      return true;
    } catch (err) {
      notify(errorMessage(err, 'That did not work'), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (event) => {
    event.preventDefault();
    if (!form.username.trim() || !form.email.trim() || !form.password) {
      notify('Fill in username, email and password.', 'error');
      return;
    }
    if (await run(() => createUser({ ...form, username: form.username.trim(), email: form.email.trim() }), 'Account added')) {
      setForm(EMPTY_USER);
    }
  };

  const remove = async (user) => {
    if (await run(() => deleteUser(user.id), 'Account deleted')) setConfirmDelete(null);
  };

  const saveReset = async (user) => {
    if (await run(() => resetUserPassword(user.id, resetPassword), 'Password set')) {
      setResetFor(null);
      setResetPassword('');
    }
  };

  return (
    <div className="mgmt-users">
      <section>
        <h3 className="mgmt-section-title">Accounts</h3>
        {loading ? (
          <p className="mgmt-hint">Loading accounts…</p>
        ) : (
          <ul className="mgmt-user-list">
            {users.map((user) => (
              <li key={user.id} className="mgmt-user">
                <div className="mgmt-user-main">
                  <span className="mgmt-avatar" aria-hidden="true">{(user.username || '?').charAt(0).toUpperCase()}</span>
                  <span className="mgmt-user-text">
                    <span className="mgmt-user-name">
                      {user.username}
                      {user.isYou && <span className="mgmt-badge mgmt-badge-you">You</span>}
                    </span>
                    <span className="mgmt-user-email">{user.email}</span>
                  </span>
                  <span className={`mgmt-badge mgmt-role-${user.role}`}>{user.role}</span>
                  <span className="mgmt-user-actions">
                    <button
                      type="button"
                      className="mgmt-icon-btn"
                      onClick={() => { setResetFor(resetFor === user.id ? null : user.id); setResetPassword(''); setConfirmDelete(null); }}
                      disabled={busy}
                      title="Set a new password"
                      aria-label={`Set a new password for ${user.username}`}
                    >
                      <KeyRound size={16} />
                    </button>
                    {!user.isYou && (
                      <button
                        type="button"
                        className="mgmt-icon-btn danger"
                        onClick={() => { setConfirmDelete(user.id); setResetFor(null); }}
                        disabled={busy}
                        title="Delete account"
                        aria-label={`Delete ${user.username}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </span>
                </div>

                {confirmDelete === user.id && (
                  <div className="mgmt-inline mgmt-inline-danger">
                    <span>Delete <b>{user.username}</b>? They can no longer sign in. This cannot be undone.</span>
                    <span className="mgmt-inline-actions">
                      <button type="button" className="mgmt-btn" onClick={() => setConfirmDelete(null)} disabled={busy}>Cancel</button>
                      <button type="button" className="mgmt-btn mgmt-btn-danger" onClick={() => remove(user)} disabled={busy}>
                        {busy ? 'Deleting…' : 'Delete'}
                      </button>
                    </span>
                  </div>
                )}

                {resetFor === user.id && (
                  <div className="mgmt-inline">
                    <PasswordInput
                      id={`reset-${user.id}`}
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      disabled={busy}
                      placeholder={`New password for ${user.username}`}
                    />
                    <span className="mgmt-inline-actions">
                      <button type="button" className="mgmt-btn" onClick={() => setResetFor(null)} disabled={busy}>Cancel</button>
                      <button type="button" className="mgmt-btn mgmt-btn-primary" onClick={() => saveReset(user)} disabled={busy || resetPassword.length < 6}>
                        {busy ? 'Saving…' : 'Set password'}
                      </button>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mgmt-section-title"><UserPlus size={17} aria-hidden="true" /> Add an account</h3>
        <form onSubmit={add} className="mgmt-form">
          <div className="mgmt-grid">
            <div className="mgmt-field">
              <label htmlFor="new-username">Username (shown on the login page)</label>
              <input id="new-username" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} disabled={busy} maxLength={30} placeholder="e.g. cashier3" />
            </div>
            <div className="mgmt-field">
              <label htmlFor="new-email">Email</label>
              <input id="new-email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} disabled={busy} maxLength={120} placeholder="name@example.com" />
            </div>
            <div className="mgmt-field">
              <label htmlFor="new-role">Role</label>
              <Select id="new-role" value={form.role} onChange={(role) => setForm((p) => ({ ...p, role }))} options={ROLE_OPTIONS} disabled={busy} ariaLabel="Role" />
              <span className="mgmt-field-note">{ROLE_HELP[form.role]}</span>
            </div>
            <div className="mgmt-field">
              <label htmlFor="new-password">Password</label>
              <PasswordInput id="new-password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} disabled={busy} placeholder="At least 6 characters" />
            </div>
          </div>
          <div className="mgmt-actions">
            <button type="submit" className="mgmt-btn mgmt-btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Add account'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
