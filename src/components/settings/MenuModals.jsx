import { useCallback, useEffect, useMemo, useState } from 'react';
import { createMenuItem, deleteMenuItem, updateMenuItem } from '../../api';
import { errorMessage } from '../../api/client';
import { rupees } from '../../utils/format';
import { orderedSizes } from '../../utils/sizes';
import useNumberGuard from '../../hooks/useNumberGuard';
import Select from '../ui/Select';
import { cardImageProps } from '../menu/cardImage';
import MenuItemFields from './MenuItemFields';
import ModalShell from './ModalShell';
import { useNotify } from '../notifications/notification-context';

const EMPTY = { name: '', price: '', category: '', imageUrl: '' };
const EMPTY_SIZE = { label: '', price: '' };

const byName = (a, b) => a.name.localeCompare(b.name);

/** Put the cursor back in the name field for the next entry. */
const focusName = () => setTimeout(() => document.getElementById('menu-item-name')?.focus(), 0);

/** A group item's prices map -> rows for the size editor, in serving order. */
function sizesFromItem(item) {
  const entries = orderedSizes(item?.prices);
  if (entries.length === 0) return [{ ...EMPTY_SIZE }];
  return entries.map(([label, price]) => ({ label, price: String(price) }));
}

// A picture link must be one the browser can load: a web address, a stored
// upload or an embedded image. Checked here so the admin gets a clear message
// instead of the browser's own "Please enter a URL" bubble.
function imageError(imageUrl) {
  const value = imageUrl.trim();
  if (!value || /^(https?:\/\/|data:image\/)/i.test(value)) return '';
  return 'The image link must start with http:// or https:// (or leave it empty).';
}

function validate({ name, price, category, imageUrl }) {
  if (!name.trim()) return 'Enter an item name.';
  const value = Number(price);
  if (!Number.isFinite(value) || value <= 0) return 'Enter a price above zero.';
  if (!category) return 'Choose a category.';
  return imageError(imageUrl);
}

function validateGroup({ name, category, sizes, imageUrl }) {
  if (!name.trim()) return 'Enter an item name.';
  if (!category) return 'Choose a category.';
  const imageMessage = imageError(imageUrl);
  if (imageMessage) return imageMessage;
  const filled = sizes.filter((s) => s.label.trim() || String(s.price).trim());
  if (filled.length === 0) return 'Add at least one size with a price.';
  for (const s of filled) {
    if (!s.label.trim()) return 'Every size needs a name (e.g. Solo).';
    const value = Number(s.price);
    if (!Number.isFinite(value) || value <= 0) return `Size "${s.label.trim()}" needs a price above zero.`;
  }
  const labels = filled.map((s) => s.label.trim().toLowerCase());
  if (new Set(labels).size !== labels.length) return 'Size names must be unique.';
  return '';
}

/** Rows of size-name + price for group-priced items (solo / duo / …). */
function GroupSizesField({ sizes, onChange, disabled }) {
  const guardNumber = useNumberGuard();
  const update = (idx, field, value) =>
    onChange(sizes.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  const updatePrice = (idx, row, raw) => {
    const label = row.label.trim() || `size ${idx + 1}`;
    if (guardNumber(raw, { min: 1, message: `Size "${label}" needs a price above zero.` })) {
      update(idx, 'price', raw);
    }
  };
  const remove = (idx) => onChange(sizes.filter((_, i) => i !== idx));
  const add = () => onChange([...sizes, { ...EMPTY_SIZE }]);

  return (
    <div className="group-sizes-editor">
      <div className="group-sizes-head">
        <label>Sizes and prices *</label>
        <button type="button" className="group-size-add-btn" onClick={add} disabled={disabled}>
          + Add size
        </button>
      </div>
      {sizes.length === 0 && (
        <div className="field-note">Add at least one size, e.g. Solo — 299.</div>
      )}
      {sizes.map((row, idx) => (
        <div key={idx} className="group-size-row">
          <input
            type="text"
            value={row.label}
            onChange={(e) => update(idx, 'label', e.target.value)}
            placeholder="Size name (e.g. solo)"
            disabled={disabled}
          />
          <input
            type="number"
            min="1"
            step="0.01"
            value={row.price}
            onChange={(e) => updatePrice(idx, row, e.target.value)}
            placeholder="Price ₹"
            disabled={disabled}
          />
          <button
            type="button"
            className="group-size-remove-btn"
            onClick={() => remove(idx)}
            disabled={disabled || sizes.length <= 1}
            aria-label={`Remove size ${row.label || idx + 1}`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export function AddMenuItemModal({ onClose, categories = [], onRefresh }) {
  const [mode, setMode] = useState('single');
  const [form, setForm] = useState(EMPTY);
  const [sizes, setSizes] = useState([{ ...EMPTY_SIZE }]);
  const [busy, setBusy] = useState(false);
  const notify = useNotify();

  // Default to the first category once they have loaded.
  useEffect(() => {
    setForm((prev) => (prev.category || categories.length === 0 ? prev : { ...prev, category: categories[0] }));
  }, [categories]);

  const switchMode = (next) => {
    setMode(next);
  };

  const submit = async (event) => {
    event.preventDefault();

    const data = new FormData();
    data.append('name', form.name.trim());
    data.append('category', form.category);
    if (form.imageUrl.trim()) data.append('image_url', form.imageUrl.trim());

    if (mode === 'group') {
      const message = validateGroup({ ...form, sizes });
      if (message) { notify(message, 'error'); return; }
      const prices = {};
      for (const s of sizes) {
        if (s.label.trim() || String(s.price).trim()) prices[s.label.trim()] = Number(s.price);
      }
      data.append('is_group', 'true');
      data.append('group_prices', JSON.stringify(prices));
    } else {
      const message = validate(form);
      if (message) { notify(message, 'error'); return; }
      data.append('price', String(Number(form.price)));
    }

    setBusy(true);
    try {
      await createMenuItem(data);
      await onRefresh();
      // Stay open for the next item: same category and mode, empty fields.
      notify(`"${form.name.trim()}" added to the menu.`, 'success');
      setForm((prev) => ({ ...EMPTY, category: prev.category }));
      setSizes([{ ...EMPTY_SIZE }]);
      focusName();
    } catch (err) {
      notify(errorMessage(err, 'Could not add the item'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const isGroup = mode === 'group';

  return (
    <ModalShell title="Add menu item" onClose={onClose} busy={busy} size="menu-modal-content">
      <form onSubmit={submit} noValidate>
        <div className="add-menu-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isGroup}
            className={`add-menu-tab ${!isGroup ? 'active' : ''}`}
            onClick={() => switchMode('single')}
            disabled={busy}
          >
            Single item
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isGroup}
            className={`add-menu-tab ${isGroup ? 'active' : ''}`}
            onClick={() => switchMode('group')}
            disabled={busy}
          >
            Group item (sizes)
          </button>
        </div>

        <MenuItemFields
          value={form}
          onChange={setForm}
          categories={categories}
          disabled={busy}
          priceField={!isGroup}
          sizesSlot={<GroupSizesField sizes={sizes} onChange={setSizes} disabled={busy} />}
          previewPriceLabel={isGroup ? 'Group' : undefined}
        />

        <div className="modal-actions">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={busy}>Close</button>
          <button type="submit" className="btn-add" disabled={busy}>
            {busy ? 'Adding…' : 'Add to menu'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/** The categories that hold at least one item, in menu order. */
function categoriesInUse(categories, items) {
  const used = new Set(items.map((i) => i.category).filter(Boolean));
  return categories.filter((c) => used.has(c));
}

export function EditMenuModal({ onClose, categories = [], items = [], onRefresh }) {
  const itemCategories = useMemo(() => categoriesInUse(categories, items), [categories, items]);
  const [activeCategory, setActiveCategory] = useState(itemCategories[0] || '');
  // Items are tracked by id: a rename keeps the same item selected.
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [sizes, setSizes] = useState([{ ...EMPTY_SIZE }]);
  const [busy, setBusy] = useState(false);
  const notify = useNotify();

  const visible = useMemo(
    () => items.filter((i) => i.category === activeCategory).sort(byName),
    [items, activeCategory],
  );
  const selected = items.find((i) => i.id === selectedId) || null;
  const isGroup = Boolean(selected?.isGroup);

  const load = useCallback((item) => {
    setSelectedId(item ? item.id : '');
    setForm(item
      ? {
        name: item.name,
        price: item.price != null ? String(item.price) : '',
        category: item.category,
        imageUrl: item.imageUrl || '',
      }
      : EMPTY);
    setSizes(item ? sizesFromItem(item) : [{ ...EMPTY_SIZE }]);
  }, []);

  // A category tab that lost its last item falls back to the first tab.
  useEffect(() => {
    if (itemCategories.length > 0 && !itemCategories.includes(activeCategory)) {
      setActiveCategory(itemCategories[0]);
    }
  }, [itemCategories, activeCategory]);

  // Nothing selected yet (or the item went away): take the tab's first item.
  // A refresh after saving keeps the current selection and what was typed.
  useEffect(() => {
    if (!selected) load(visible[0]);
  }, [selected, visible, load]);

  const openCategory = (category) => {
    setActiveCategory(category);
    load(items.filter((i) => i.category === category).sort(byName)[0]);
  };

  const pick = (id) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    load(item);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!selected) { notify('Select an item to edit.', 'error'); return; }

    let payload;
    if (isGroup) {
      const message = validateGroup({ ...form, sizes });
      if (message) { notify(message, 'error'); return; }
      const prices = {};
      for (const s of sizes) {
        if (s.label.trim() || String(s.price).trim()) prices[s.label.trim()] = Number(s.price);
      }
      payload = {
        name: form.name.trim(),
        imageUrl: form.imageUrl.trim(),
        group_prices: prices,
      };
    } else {
      const message = validate(form);
      if (message) { notify(message, 'error'); return; }
      payload = {
        name: form.name.trim(),
        price: Number(form.price),
        imageUrl: form.imageUrl.trim(),
      };
    }

    setBusy(true);
    try {
      await updateMenuItem(selected.name, payload);
      await onRefresh();
      notify(`Saved "${payload.name}".`, 'success');
    } catch (err) {
      notify(errorMessage(err, 'Could not update the item'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Edit menu item" onClose={onClose} busy={busy} size="edit-menu-modal-content">
      <form onSubmit={submit} noValidate>
        <div className="edit-menu-layout">
          <div className="edit-menu-sidebar">
            <div className="edit-menu-sidebar-title">Categories</div>
            <div className="edit-menu-category-list">
              {itemCategories.length === 0
                ? <div className="delete-menu-empty-note">No items yet.</div>
                : itemCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`edit-menu-sidebar-btn ${category === activeCategory ? 'active' : ''}`}
                    onClick={() => openCategory(category)}
                    disabled={busy}
                  >
                    {category}
                  </button>
                ))}
            </div>
          </div>

          <div className="edit-menu-main">
            <div className="form-group">
              <label htmlFor="edit-item-picker">Item to edit *</label>
              <Select
                id="edit-item-picker"
                value={selectedId}
                onChange={pick}
                options={visible.map((item) => ({
                  value: item.id,
                  label: item.isGroup ? `${item.name} (group)` : item.name,
                }))}
                placeholder="Select an item"
                keepCase
                disabled={busy}
              />
            </div>

            {selected?.isGroup && (
              <p className="modal-note modal-note-warn">
                “{selected.name}” is a group-priced item — edit its sizes and
                prices below. Saving keeps the group.
              </p>
            )}

            {isGroup ? (
              /* Group items share the name and image fields with single items;
                 the sizes editor takes the price field's place. */
              <MenuItemFields
                value={form}
                onChange={setForm}
                disabled={busy}
                priceField={false}
                showCategory={false}
                sizesSlot={<GroupSizesField sizes={sizes} onChange={setSizes} disabled={busy} />}
                previewPriceLabel="Group"
              />
            ) : (
              <MenuItemFields value={form} onChange={setForm} disabled={busy} showCategory={false} />
            )}
          </div>
        </div>


        <div className="modal-actions">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={busy}>Close</button>
          <button type="submit" className="btn-add" disabled={busy || !selected}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function DeleteMenuModal({ onClose, categories: allCategories = [], items = [], onRefresh }) {
  const categories = useMemo(() => categoriesInUse(allCategories, items), [allCategories, items]);

  const [activeCategory, setActiveCategory] = useState(categories[0] || '');
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const notify = useNotify();

  const visible = useMemo(
    () => items.filter((i) => i.category === activeCategory).sort(byName),
    [items, activeCategory],
  );

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(activeCategory)) setActiveCategory(categories[0]);
  }, [categories, activeCategory]);

  const toggle = (name) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    return next;
  });

  const submit = async (event) => {
    event.preventDefault();
    const targets = [...selected];
    if (targets.length === 0) { notify('Select at least one item.', 'error'); return; }

    setBusy(true);
    try {
      const results = await Promise.allSettled(targets.map((name) => deleteMenuItem(name)));
      const failed = targets.filter((_, i) => results[i].status === 'rejected');
      const deleted = targets.length - failed.length;

      if (deleted > 0) await onRefresh();
      // Stay open for more deletions; only the failures stay selected.
      setSelected(new Set(failed));
      if (deleted > 0) notify(`Deleted ${deleted} item${deleted === 1 ? '' : 's'}.`, 'success');
      if (failed.length) notify(`Could not delete: ${failed.join(', ')}`, 'error');
    } catch (err) {
      notify(errorMessage(err, 'Could not delete the items'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Delete menu item" onClose={onClose} busy={busy} size="edit-menu-modal-content">
      <form onSubmit={submit}>
        <div className="edit-menu-layout">
          <div className="edit-menu-sidebar">
            <div className="edit-menu-sidebar-title">Categories</div>
            <div className="edit-menu-category-list">
              {categories.length === 0
                ? <div className="delete-menu-empty-note">No items yet.</div>
                : categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`edit-menu-sidebar-btn ${category === activeCategory ? 'active' : ''}`}
                    onClick={() => { setActiveCategory(category); setSelected(new Set()); }}
                    disabled={busy}
                  >
                    {category}
                  </button>
                ))}
            </div>
          </div>

          <div className="edit-menu-main">
            <div className="delete-menu-toolbar">
              <button type="button" className="delete-menu-toolbar-btn" onClick={() => setSelected(new Set(visible.map((i) => i.name)))} disabled={busy}>
                Select all
              </button>
              <button type="button" className="delete-menu-toolbar-btn secondary" onClick={() => setSelected(new Set())} disabled={busy}>
                Clear
              </button>
              <div className="delete-menu-count">{selected.size} selected</div>
            </div>

            <div className="delete-menu-grid">
              {visible.length === 0 ? (
                <div className="delete-menu-empty-note">No items in this category.</div>
              ) : visible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`menu-item delete-card-item ${selected.has(item.name) ? 'selected' : ''}`}
                  {...cardImageProps(item.imageUrl)}
                  onClick={() => toggle(item.name)}
                  disabled={busy}
                >
                  <div className="menu-item-info">
                    <div className="item-name">{item.name}</div>
                    <div className="item-price">
                      {item.isGroup ? 'Group' : rupees(item.price || 0)}
                    </div>
                  </div>
                  {selected.has(item.name) && (
                    <div className="delete-card-overlay"><div className="delete-card-checkmark">✓</div></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>


        <div className="modal-actions">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={busy}>Close</button>
          <button type="submit" className="btn-delete" disabled={busy || selected.size === 0}>
            {busy ? 'Deleting…' : 'Delete selected'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
