import { useEffect, useState } from 'react';
import { fetchSummary } from './api';
import Pagination from './Pagination';
import SkeletonRows from './SkeletonRows';
import NullCell from './NullCell';
import * as XLSX from 'xlsx';

// Only columns that come directly from the summary API
const COLS = [
  { key: 'serviceName',        label: 'Service / Product', type: 'primary' },
  { key: 'billerName',         label: 'Biller',            type: 'text' },
  { key: 'operatorName',       label: 'Network / Operator',type: 'network' },
  { key: 'operatorId',         label: 'Operator ID',       type: 'mono' },
  { key: 'activation',         label: 'ACT Count',         type: 'number' },
  { key: 'activationPending',  label: 'PARK',              type: 'number' },
  { key: 'churn',              label: 'Churn',             type: 'number' },
  { key: 'renewal',            label: 'Renew Count',       type: 'number' },
  { key: 'pricePoint',         label: 'Price Point',       type: 'amount' },
  { key: 'actRev',             label: 'Act Rev',           type: 'rev' },
  { key: 'renewRev',           label: 'Renew Rev',         type: 'rev' },
  { key: 'totalRev',           label: 'Total Rev',         type: 'rev' },
  { key: 'totalRevUsd',        label: 'Total Rev USD',     type: 'rev' },
  { key: 'campCR',             label: 'Camp CR',           type: 'cr' },
];

function mapRow(r) {
  const price    = r.pricePoint || 0;
  const actRev   = (r.activation || 0) * price;
  const renewRev = (r.renewal    || 0) * price;
  const totalRev = actRev + renewRev;
  const total    = (r.activation || 0) + (r.renewal || 0) + (r.churn || 0);
  const campCR   = total > 0 ? ((r.activation || 0) / total * 100).toFixed(2) : null;

  return {
    serviceName:       r.serviceName       || null,
    billerName:        r.billerName        || null,
    operatorName:      r.operatorName      || null,
    operatorId:        r.operatorId        || null,
    activation:        r.activation        ?? null,
    activationPending: r.activationPending ?? null,
    churn:             r.churn             ?? null,
    renewal:           r.renewal           ?? null,
    pricePoint:        r.pricePoint        ?? null,
    actRev:      actRev    > 0 ? actRev    : null,
    renewRev:    renewRev  > 0 ? renewRev  : null,
    totalRev:    totalRev  > 0 ? totalRev  : null,
    totalRevUsd: totalRev  > 0 ? (totalRev / 550).toFixed(2) : null,
    campCR,
  };
}

function CRCell({ value }) {
  if (value === null || value === undefined) return <NullCell />;
  const n = parseFloat(value);
  const cls = n >= 10 ? 'cr-good' : n >= 3 ? 'cr-mid' : 'cr-low';
  return <span className={`cr-badge ${cls}`}>{value}%</span>;
}

function Cell({ row, col }) {
  const v = row[col.key];
  if (v === null || v === undefined) return <NullCell />;
  switch (col.type) {
    case 'primary': return <span className="td-primary">{v}</span>;
    case 'network': return <span className="ct-network">{v}</span>;
    case 'mono':    return <span className="td-mono">{v}</span>;
    case 'number':  return <span>{Number(v).toLocaleString()}</span>;
    case 'amount':  return <span className="td-amount">{Number(v).toLocaleString()}</span>;
    case 'rev':     return <span className="ct-rev">{Number(v).toLocaleString()}</span>;
    case 'cr':      return <CRCell value={v} />;
    default:        return String(v);
  }
}

export default function CombinedTable({ filters, onTotalChange }) {
  const [data,    setData]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const size = 15;

  useEffect(() => { setPage(1); }, [filters]);

  useEffect(() => {
    if (!filters) return;
    setLoading(true); setError('');
    fetchSummary({ ...filters, page, size })
      .then(res => {
        const rows = (res.data || []).map(mapRow);
        setData(rows);
        setTotal(res.total || 0);
        onTotalChange?.(res.total || 0);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  const exportExcel = () => {
    if (!data.length) return;
    const rows = data.map(r => Object.fromEntries(COLS.map(c => [c.label, r[c.key] ?? ''])));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = COLS.map(c => ({ wch: Math.max(c.label.length, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Summary Analytics');
    XLSX.writeFile(wb, `analytics_${filters.startDate}_${filters.endDate}.xlsx`);
  };

  return (
    <div className="ct-section">
      <div className="ct-header">
        <div className="ct-header-left">
          <div className="ct-header-icon">📊</div>
          <div>
            <h2>Summary &amp; Analytics</h2>
            <p>
              {filters?.startDate} → {filters?.endDate}
              {filters?.billerName  && ` · ${filters.billerName}`}
              {filters?.serviceName && ` · ${filters.serviceName}`}
            </p>
          </div>
        </div>
        <div className="ct-header-right">
          {!loading && <span className="record-count">{total} records</span>}
          {!loading && data.length > 0 && (
            <button className="ct-export-btn" onClick={exportExcel}>⬇ Export Excel</button>
          )}
        </div>
      </div>

      {error && <div className="error-box">⚠️ {error}</div>}

      <div className="table-wrap">
        <table className="ct-table">
          <thead>
            <tr>{COLS.map(c => <th key={c.key} className="ct-th">{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={COLS.length} rows={8} />
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={COLS.length}>
                  <div className="no-data-inner">
                    <div className="no-data-icon">📭</div>
                    <div className="no-data-text">No data found</div>
                    <div className="no-data-sub">Adjust filters and click Apply Filters</div>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={i}>
                  {COLS.map(c => (
                    <td key={c.key} className="ct-td">
                      <Cell row={row} col={c} />
                    </td>
                  ))}
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
