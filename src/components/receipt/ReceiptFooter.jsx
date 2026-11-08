import { RESTAURANT } from '../../config/settings';

/**
 * The closing lines printed at the bottom of every bill, from the restaurant
 * settings (`receiptFooter`): the first line large, the rest smaller.
 */
export default function ReceiptFooter() {
  const [first, ...rest] = (RESTAURANT.receiptFooter || []).filter(Boolean);
  if (!first) return null;
  return (
    <div className="footer">
      <div className="footer-thanks">{first}</div>
      {rest.map((line) => <div key={line} className="footer-visit">{line}</div>)}
    </div>
  );
}
