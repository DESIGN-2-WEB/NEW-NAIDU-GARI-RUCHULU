import { rupees } from '../../../utils/format';

/**
 * Earnings per menu category for the selected period, biggest first: what
 * each category brought in (after bill discounts), its share of the total,
 * items sold and how many bills included it.
 */
export default function AnalyticsCategories({ rows = [] }) {
  const earned = rows.reduce((sum, row) => sum + row.total, 0);
  const top = rows[0]?.total || 0;

  return (
    <div className="report-section category-sales">
      <h3>
        Earnings by category
        {rows.length > 0 && <span className="category-sales-total">{rupees(earned)}</span>}
      </h3>

      {rows.length === 0 ? (
        <p className="no-data category-sales-empty">No sales in this period</p>
      ) : (
        <ol className="category-list">
          {rows.map((row) => (
            <li key={row.category} className="category-row">
              <div className="category-row-head">
                <span className="category-name">{row.category}</span>
                <span className="category-amount">{rupees(row.total)}</span>
              </div>
              <div className="category-bar" aria-hidden="true">
                <span style={{ width: `${top > 0 ? (row.total / top) * 100 : 0}%` }} />
              </div>
              <div className="category-meta">
                <span>{row.share.toFixed(1)}% of earnings</span>
                <span>{row.qty} {row.qty === 1 ? 'item' : 'items'} sold</span>
                <span>{row.bills} {row.bills === 1 ? 'bill' : 'bills'}</span>
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="category-sales-note">
        Earnings are after bill discounts. Bills saved before categories were recorded are
        matched to today&rsquo;s menu by item name; items no longer on the menu show as &ldquo;other&rdquo;.
      </p>
    </div>
  );
}
