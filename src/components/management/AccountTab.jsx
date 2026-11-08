import { useState } from 'react';
import { changeMyPassword } from '../../api';
import { errorMessage } from '../../api/client';
import { useNotify } from '../notifications/notification-context';
import PasswordInput from './PasswordInput';

const EMPTY = { current: '', next: '', repeat: '' };
const MIN_LENGTH = 6;

/** Management -> My account: change your own password. */
export default function AccountTab({ user, onBusy }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    if (!form.current) { notify('Enter your current password.', 'error'); return; }
    if (form.next.length < MIN_LENGTH) { notify(`The new password needs at least ${MIN_LENGTH} characters.`, 'error'); return; }
    if (form.next !== form.repeat) { notify('The new passwords do not match.', 'error'); return; }

    setSaving(true);
    onBusy(true);
    try {
      await changeMyPassword(form.current, form.next);
      setForm(EMPTY);
      notify('Password changed. Use the new one next time you sign in.', 'success');
    } catch (err) {
      notify(errorMessage(err, 'Could not change the password'), 'error');
    } finally {
      setSaving(false);
      onBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="mgmt-form mgmt-narrow">
      <div className="mgmt-me">
        <span className="mgmt-avatar" aria-hidden="true">{(user?.username || '?').charAt(0).toUpperCase()}</span>
        <span>
          <span className="mgmt-me-name">{user?.username}</span>
          <span className="mgmt-me-meta">{user?.email} · {user?.role}</span>
        </span>
      </div>

      <div className="mgmt-field">
        <label htmlFor="mgmt-current">Current password</label>
        <PasswordInput id="mgmt-current" value={form.current} onChange={set('current')} disabled={saving} autoComplete="current-password" />
      </div>
      <div className="mgmt-field">
        <label htmlFor="mgmt-new">New password</label>
        <PasswordInput id="mgmt-new" value={form.next} onChange={set('next')} disabled={saving} placeholder={`At least ${MIN_LENGTH} characters`} />
      </div>
      <div className="mgmt-field">
        <label htmlFor="mgmt-repeat">Repeat new password</label>
        <PasswordInput id="mgmt-repeat" value={form.repeat} onChange={set('repeat')} disabled={saving} />
      </div>

      <div className="mgmt-actions">
        <button type="submit" className="mgmt-btn mgmt-btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </form>
  );
}
