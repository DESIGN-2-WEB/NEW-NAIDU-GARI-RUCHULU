import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { updateSettings } from '../../api';
import { errorMessage } from '../../api/client';
import { RESTAURANT, replaceSettings } from '../../config/settings';
import { useNotify } from '../notifications/notification-context';

const MAX_PHONES = 4;

function fromSettings() {
  return {
    name: RESTAURANT.name || '',
    tagline: RESTAURANT.tagline || '',
    owner: RESTAURANT.owner || '',
    location: RESTAURANT.location || '',
    phones: RESTAURANT.phones?.length ? [...RESTAURANT.phones] : [''],
    gstNumber: RESTAURANT.gstNumber || '',
  };
}

/** Management -> Restaurant: the details shown on the login page, the
 *  billing header and every printed bill. */
export default function RestaurantTab({ onBusy }) {
  const [form, setForm] = useState(fromSettings);
  const [saving, setSaving] = useState(false);
  const notify = useNotify();

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const setPhone = (index, value) => setForm((prev) => ({
    ...prev,
    phones: prev.phones.map((phone, i) => (i === index ? value : phone)),
  }));
  const addPhone = () => setForm((prev) => ({ ...prev, phones: [...prev.phones, ''] }));
  const removePhone = (index) => setForm((prev) => ({
    ...prev,
    phones: prev.phones.length > 1 ? prev.phones.filter((_, i) => i !== index) : [''],
  }));

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) { notify('Enter the restaurant name.', 'error'); return; }

    setSaving(true);
    onBusy(true);
    try {
      const settings = await updateSettings({
        ...form,
        phones: form.phones.map((p) => p.trim()).filter(Boolean),
      });
      replaceSettings(settings);
      setForm(fromSettings());
      notify('Restaurant details saved.', 'success');
    } catch (err) {
      notify(errorMessage(err, 'Could not save the details'), 'error');
    } finally {
      setSaving(false);
      onBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="mgmt-form">
      <div className="mgmt-grid">
        <div className="mgmt-field">
          <label htmlFor="mgmt-name">Restaurant name *</label>
          <input id="mgmt-name" value={form.name} onChange={set('name')} disabled={saving} maxLength={120} />
        </div>
        <div className="mgmt-field">
          <label htmlFor="mgmt-tagline">Tagline</label>
          <input id="mgmt-tagline" value={form.tagline} onChange={set('tagline')} disabled={saving} maxLength={120} placeholder="e.g. Family Restaurant" />
        </div>
        <div className="mgmt-field">
          <label htmlFor="mgmt-owner">Owner name</label>
          <input id="mgmt-owner" value={form.owner} onChange={set('owner')} disabled={saving} maxLength={120} />
        </div>
        <div className="mgmt-field">
          <label htmlFor="mgmt-gst">GST number <span className="mgmt-optional">(optional)</span></label>
          <input
            id="mgmt-gst"
            value={form.gstNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, gstNumber: e.target.value.toUpperCase() }))}
            disabled={saving}
            maxLength={20}
            placeholder="15-character GSTIN"
            autoCapitalize="characters"
          />
        </div>
      </div>

      <div className="mgmt-field">
        <label htmlFor="mgmt-address">Address</label>
        <input id="mgmt-address" value={form.location} onChange={set('location')} disabled={saving} maxLength={120} />
      </div>

      <div className="mgmt-field">
        <label htmlFor="mgmt-phone-0">Phone numbers</label>
        <div className="mgmt-phones">
          {form.phones.map((phone, index) => (
            // Rows are only ever added or removed at their own position.
            // eslint-disable-next-line react/no-array-index-key
            <div className="mgmt-phone-row" key={index}>
              <input
                id={`mgmt-phone-${index}`}
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(index, e.target.value)}
                disabled={saving}
                maxLength={20}
                placeholder="e.g. 9959399849"
              />
              <button
                type="button"
                className="mgmt-icon-btn"
                onClick={() => removePhone(index)}
                disabled={saving}
                aria-label={`Remove phone number ${index + 1}`}
                title="Remove"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          {form.phones.length < MAX_PHONES && (
            <button type="button" className="mgmt-link-btn" onClick={addPhone} disabled={saving}>
              <Plus size={15} aria-hidden="true" /> Add phone number
            </button>
          )}
        </div>
      </div>

      <div className="mgmt-actions">
        <button type="submit" className="mgmt-btn mgmt-btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save details'}
        </button>
      </div>
    </form>
  );
}
