import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchNextBillNumber,
  saveBill,
} from '../../api';
import { errorMessage } from '../../api/client';
import { useNotify } from '../../components/notifications/notification-context';
import Select from '../../components/ui/Select';
import MenuBrowser from '../../components/menu/MenuBrowser';
import AddCustomItemModal from '../../components/modals/AddCustomItemModal';
import SizeSelectionModal from '../../components/modals/SizeSelectionModal';
import ReceiptFooter from '../../components/receipt/ReceiptFooter';
import useCart from '../../hooks/useCart';
import useMenu from '../../hooks/useMenu';
import useNumberGuard from '../../hooks/useNumberGuard';
import { rupees } from '../../utils/format';
import { orderedSizes } from '../../utils/sizes';
import { ORDER_TYPES, PAYMENT_METHODS, RESTAURANT, tableOptions } from '../../config/settings';

// The first payment method and order type in the settings are preselected.
const firstOf = (list) => list[0] || '';

export default function BillingDashboard() {
  const menu = useMenu();
  const cart = useCart();
  const notify = useNotify();
  const guardNumber = useNumberGuard();

  const [tableNo, setTableNo] = useState('');
  const [orderType, setOrderType] = useState(() => firstOf(ORDER_TYPES));
  const [payment, setPayment] = useState(() => firstOf(PAYMENT_METHODS));
  const tableChoices = useMemo(() => tableOptions('No table'), []);
  const [discount, setDiscount] = useState(0);

  const [billNumber, setBillNumber] = useState(null);
  const [printedAt, setPrintedAt] = useState(null);
  const [sizeItem, setSizeItem] = useState(null);
  const [showCustomItem, setShowCustomItem] = useState(false);
  const [saving, setSaving] = useState(false);

  // Show the number this bill will be given, so the printed slip and the
  // register agree. Previously the receipt always printed "Bill No: 0".
  const refreshBillNumber = useCallback(() => {
    fetchNextBillNumber().then(setBillNumber).catch(() => setBillNumber(null));
  }, []);

  useEffect(() => { refreshBillNumber(); }, [refreshBillNumber]);

  const discountPercent = Math.min(100, Math.max(0, Number(discount) || 0));
  const discountAmount = Math.round((cart.subtotal * discountPercent) / 100);
  const total = cart.subtotal - discountAmount;
  const canPrint = !cart.isEmpty && total >= 0;

  const selectItem = useCallback((item) => {
    if (!item.isGroup) {
      cart.addItem(item.name, item.price || 0, item.category);
      return;
    }
    // A group with no priced size has nothing to put on the bill; the click
    // used to do nothing at all, which looked like a dead card.
    const priced = orderedSizes(item.prices).filter(([, price]) => Number(price) > 0);
    if (priced.length === 0) {
      notify(`"${item.name}" has no size prices yet — add them under Edit item.`, 'error');
      return;
    }
    setSizeItem(item);
  }, [cart, notify]);

  const reset = useCallback(() => {
    cart.clear();
    setTableNo('');
    setOrderType(firstOf(ORDER_TYPES));
    setPayment(firstOf(PAYMENT_METHODS));
    setDiscount(0);
  }, [cart]);

  const printBill = useCallback(async () => {
    if (!canPrint || saving) return;
    setSaving(true);

    try {
      // Save first: a bill that printed but was never recorded is the one
      // failure mode the cashier cannot recover from at the counter.
      const result = await saveBill({
        items: cart.lines,
        payment,
        orderType,
        tableNo,
        discount: discountPercent,
      });

      setBillNumber(result.billNumber);
      setPrintedAt(new Date());

      // Let React paint the final number before the print dialog snapshots it.
      await new Promise((resolve) => setTimeout(resolve, 60));
      window.print();

      notify(`Bill #${result.billNumber} printed — ${rupees(result.bill?.total ?? total)}`, 'success');

      reset();
      setPrintedAt(null);
      refreshBillNumber();
    } catch (err) {
      notify(errorMessage(err, 'Could not save the bill'), 'error');
    } finally {
      setSaving(false);
    }
  }, [canPrint, cart, discountPercent, notify, orderType, payment, refreshBillNumber, reset, saving, tableNo, total]);

  const stamp = printedAt || new Date();

  return (
    <main className="container billing-layout">
      <MenuBrowser
        items={menu.items}
        categories={menu.categories}
        activeCategory={menu.activeCategory}
        onCategoryChange={menu.setActiveCategory}
        onSelect={selectItem}
        loading={menu.loading}
        error={menu.error}
      />

      <div className="bill">
        <div className="cut-line" />

        <div className="bill-header">
          <div className="bill-header-row">
            <div className="bill-number">
              Table No: <span className="bill-no-display">{tableNo || 'X'}</span>
            </div>
            <div className="bill-number">
              Bill No: <span className="bill-no-display">{billNumber ?? '—'}</span>
            </div>
          </div>
          <b>{RESTAURANT.name}</b><br />
          <span className="bill-subtitle">{RESTAURANT.tagline}</span><br />
          <span className="bill-fineprint">Contact No: {RESTAURANT.phones.join(', ')}</span><br />
          <div className="datetime">
            <span>Date: {stamp.toLocaleDateString('en-IN')}</span>
            <span>Time: {stamp.toLocaleTimeString('en-IN')}</span>
          </div>
        </div>

        <div className="bill-items">
          <table id="billTable">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th aria-label="Remove" className="no-print" />
              </tr>
            </thead>
            <tbody>
              {cart.isEmpty ? (
                <tr><td colSpan="4" className="empty-bill">No items added yet</td></tr>
              ) : (
                cart.entries.map(([name, item]) => (
                  <tr key={name}>
                    <td style={{ textAlign: 'left', fontWeight: 'bold' }}>{name}</td>
                    <td>
                      <div className="qty-controls no-print">
                        <button type="button" className="qty-btn" onClick={() => cart.decrease(name)}>&minus;</button>
                        <span className="qty-display">{item.qty}</span>
                        <button type="button" className="qty-btn" onClick={() => cart.increase(name)}>+</button>
                      </div>
                      <span className="qty-print">{item.qty}</span>
                    </td>
                    <td style={{ fontWeight: 'bold' }}>{rupees(item.price * item.qty)}</td>
                    <td className="remove-cell no-print">
                      <button type="button" className="remove-btn" onClick={() => cart.remove(name)}>&#10006;</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bill-controls no-print">
          <div className="bill-field">
            <label htmlFor="billing-table">Table</label>
            <Select id="billing-table" value={tableNo} onChange={setTableNo} options={tableChoices} />
          </div>

          <div className="bill-field">
            <label htmlFor="billing-payment">Payment</label>
            <Select id="billing-payment" value={payment} onChange={setPayment} options={PAYMENT_METHODS} />
          </div>

          <div className="bill-field">
            <label htmlFor="billing-order-type">Order type</label>
            <Select id="billing-order-type" value={orderType} onChange={setOrderType} options={ORDER_TYPES} />
          </div>

          <div className="bill-field">
            <label htmlFor="billing-discount">Discount %</label>
            <input
              id="billing-discount"
              type="number"
              min="0"
              max="100"
              value={discount}
              onChange={(e) => {
                const raw = e.target.value;
                // Refuse a discount below 0 or above 100 as it is typed, and
                // say why — the old code clamped it silently on blur.
                if (guardNumber(raw, { min: 0, max: 100, message: 'Discount must be between 0 and 100%.' })) {
                  setDiscount(raw);
                }
              }}
              className="discount-input"
            />
          </div>
        </div>

        {/* Table, payment and order type print under the item list, exactly
            where the reference slip puts them; on screen the pickers above
            already show them. */}
        <div className="bill-print-meta">
          <div className="print-meta-line"><span>Table No.</span><span>{tableNo || 'X'}</span></div>
          <div className="print-meta-line"><span>Payment Method:</span><span>{payment}</span></div>
          <div className="print-meta-line"><span>Order Type:</span><span>{orderType}</span></div>
        </div>

        <div className="total-section">
          <div className="total-line">
            <span>Subtotal:</span><span>{rupees(cart.subtotal)}</span>
          </div>
          {discountPercent > 0 && (
            <div className="total-line total-line-discount">
              <span>Discount ({discountPercent}%):</span><span>− {rupees(discountAmount)}</span>
            </div>
          )}
          <div className="total"><span>Total:</span>{' '}<span>{rupees(total)}</span></div>
        </div>

        <div className="actions no-print">
          <button type="button" className="print" onClick={printBill} disabled={!canPrint || saving}>
            {saving ? 'Saving…' : 'Print'}
          </button>
          <button type="button" className="clear" onClick={reset} disabled={cart.isEmpty}>
            Clear
          </button>
        </div>

        <ReceiptFooter />

        <div className="cut-line thermal-cut" />
      </div>

      {/* The customer's copy: a plain token slip that prints on its own page
          — token number instead of bill number, one line per item, no totals. */}
      <div className="customer-receipt" aria-hidden="true">
        <div className="bill-header">
          <div className="bill-header-row">
            <div className="bill-number">
              Token No: <span className="bill-no-display">{billNumber ?? '—'}</span>
            </div>
          </div>
          <b>{RESTAURANT.name}</b><br />
          <span className="bill-subtitle">{RESTAURANT.tagline}</span><br />
          <span className="bill-fineprint">Contact No: {RESTAURANT.phones.join(', ')}</span><br />
          <div className="datetime">
            <span>Date: {stamp.toLocaleDateString('en-IN')}</span>
            <span>Time: {stamp.toLocaleTimeString('en-IN')}</span>
          </div>
        </div>
        <div className="customer-items">
          {cart.entries.map(([name, item]) => (
            <div key={name} className="item">{item.qty} x {name}</div>
          ))}
        </div>
        <ReceiptFooter />
      </div>

      {sizeItem && (
        <SizeSelectionModal
          item={sizeItem}
          onClose={() => setSizeItem(null)}
          onSelect={(name, price) => {
            cart.addItem(name, price, sizeItem.category);
            setSizeItem(null);
          }}
        />
      )}

      {showCustomItem && (
        <AddCustomItemModal
          onClose={() => setShowCustomItem(false)}
          onAdded={(name, price) => {
            cart.addItem(name, price, 'custom');
            menu.reload();
          }}
        />
      )}

      <button
        type="button"
        className="add-custom-btn no-print"
        onClick={() => setShowCustomItem(true)}
        title="Add a one-off item"
        aria-label="Add a one-off item"
      >
        +
      </button>
    </main>
  );
}
