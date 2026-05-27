import { useEffect, useState } from 'react';
import { fetchSummaryDetails } from './api';
import Pagination from './Pagination';
import SkeletonRows from './SkeletonRows';
import * as XLSX from 'xlsx';

const COLS = [
  { key: 'transactionId',  label: 'Transaction ID',  type: 'mono' },
  { key: 'msisdn',         label: 'MSISDN',          type: 'mono' },
  { key: 'serviceName',    label: 'Service',         type: 'primary' },
  { key: 'operatorName',   label: 'Operator',        type: 'text' },
  { key: 'billerName',     label: 'Biller',          type: 'text' },
  { key: 'action',         label: 'Action',          type: 'action' },
  { key: 'billingStatus',  label: 'Status',          type: 'status' },
  { key: 'pack',           label: 'Pack',            type: 'pack' },
  { key: 'amount',         label: 'Amount',          type: 'amount' },
  { key: 'requestMode',    label: 'Request Mode',    type: 'text' },
  { key: 'mediaSource',    label: 'Media Source',    type: 'text' },
  { key: 'offerId',        label: 'Offer ID',        type: 'mono' },
  { key: 'campaignId',     label: 'Campaign ID',     type: 'mono' },
  { key: 'transactionTime',label: 'Transaction Time',type: 'datetime' },
];

const STATUS_MAP = { SUCCESS: 'success', FAILED: 'failed', PENDING: 'pending' };
const ACTION_MAP = { RENEW: 'renew', ACTIVATE: 'activate', CHURN: 'churn' };

export default function SummaryDetailsTable({ filters, onTotalChange }) {
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
    fetchSummaryDetails({ ...filters, page, size })
      .then((res) => {
        setData(res.data || []);
        setTotal(res.total || 0);
        onTotalChange?.(res.total || 0);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  const renderCell = (row, col) => {
    const val = row[col.key];
    if ((val === null || val === undefined) && col.type !== 'status') {
      return <span style={{ color: 'var(--text-light)' }}>—</span>;
    }
    switch (col.type) {
      case 'primary':  return <span className="td-primary">{val}</span>;
      case 'mono':     return <span className="td-mono">{val}</span>;
      case 'amount':   return <span className="td-amount">{Number(val).toLocaleString()}</span>;
      case 'datetime': return <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{val}</span>;
      case 'status': {
        const cls = STATUS_MAP[val] || '';
        return <span className={`badge ${cls}`}>{val ?? '—'}</span>;
      }
      case 'action': {
        const cls = ACTION_MAP[(val || '').toUpperCase()] || 'default';
        return <span className={`action-badge ${cls}`}>{val}</span>;
      }
      case 'pack':
        return val ? <span className="pack-badge">{val}</span> : <span style={{ color: 'var(--text-light)' }}>—</span>;
      default: return val;
    }
  };

  const exportExcel = () => {
    if (!data.length) return;
    const rows = data.map(r =>
      Object.fromEntries(COLS.map(c => [c.label, r[c.key] ?? '']))
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = COLS.map(c => ({ wch: Math.max(c.label.length, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `transactions_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="table-section">
      <div className="table-header">
        <div className="table-header-left">
          <div className="table-header-icon blue">🧾</div>
          <div>
            <h2>Transaction Details</h2>
            <p>Individual transaction-level billing records</p>
          </div>
        </div>
        <div className="table-header-right">
          {!loading && <span className="record-count">{total} records</span>}
          {!loading && data.length > 0 && (
            <button className="ct-export-btn" onClick={exportExcel}>⬇ Export Excel</button>
          )}
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
              <SkeletonRows cols={COLS.length} rows={8} />
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={COLS.length}>
                  <div className="no-data-inner">
                    <div className="no-data-icon">📭</div>
                    <div className="no-data-text">No transactions found</div>
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
