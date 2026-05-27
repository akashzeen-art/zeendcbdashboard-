import { useEffect, useState } from 'react';
import { fetchSummary } from './api';
import Pagination from './Pagination';
import SkeletonRows from './SkeletonRows';

const COLS = [
  { key: 'serviceName',       label: 'Service Name',  type: 'primary' },
  { key: 'operatorName',      label: 'Operator',      type: 'text' },
  { key: 'operatorId',        label: 'Operator ID',   type: 'mono' },
  { key: 'billerName',        label: 'Biller',        type: 'text' },
  { key: 'activation',        label: 'Activations',   type: 'number' },
  { key: 'renewal',           label: 'Renewals',      type: 'number' },
  { key: 'churn',             label: 'Churn',         type: 'number' },
  { key: 'activationPending', label: 'Pending',       type: 'number' },
  { key: 'pricePoint',        label: 'Price Point',   type: 'amount' },
];

export default function SummaryTable({ filters, onTotalChange }) {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const size = 10;

  useEffect(() => { setPage(1); }, [filters]);

  useEffect(() => {
    if (!filters) return;
    setLoading(true);
    setError('');
    fetchSummary({ ...filters, page, size })
      .then((res) => {
        const rows = res.data || [];
        setData(rows);
        setTotal(res.total || 0);
        onTotalChange?.(res.total || 0);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  const renderCell = (row, col) => {
    const val = row[col.key];
    if (val === null || val === undefined) return <span style={{ color: 'var(--text-light)' }}>—</span>;
    if (col.type === 'primary') return <span className="td-primary">{val}</span>;
    if (col.type === 'mono')    return <span className="td-mono">{val}</span>;
    if (col.type === 'amount')  return <span className="td-amount">{Number(val).toLocaleString()}</span>;
    if (col.type === 'number')  return <strong>{Number(val).toLocaleString()}</strong>;
    return val;
  };

  return (
    <div className="table-section">
      <div className="table-header">
        <div className="table-header-left">
          <div className="table-header-icon purple">📋</div>
          <div>
            <h2>Summary Report</h2>
            <p>Aggregated service-level billing data</p>
          </div>
        </div>
        <div className="table-header-right">
          {!loading && <span className="record-count">{total} records</span>}
        </div>
      </div>

      {error && <div className="error-box">⚠️ {error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>{COLS.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={COLS.length} rows={6} />
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={COLS.length}>
                  <div className="no-data-inner">
                    <div className="no-data-icon">📭</div>
                    <div className="no-data-text">No data found</div>
                    <div className="no-data-sub">Try adjusting your filters or date range</div>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={i}>
                  {COLS.map((c) => <td key={c.key}>{renderCell(row, c)}</td>)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} size={size} onChange={setPage} />
    </div>
  );
}
