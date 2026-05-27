import { useEffect, useState } from 'react';
import { fetchSummary } from './api';
import Pagination from './Pagination';
import SkeletonRows from './SkeletonRows';

const COLS = [
  { key: 'date',         label: 'Date' },
  { key: 'clicks',       label: 'Clicks' },
  { key: 'network',      label: 'Network' },
  { key: 'sendPin',      label: 'Send Pin' },
  { key: 'uniqSendPin',  label: 'Uniq Send Pin' },
  { key: 'verPin',       label: 'Ver Pin' },
  { key: 'uniqVerPin',   label: 'Uniq Ver Pin' },
  { key: 'sucesVerPin',  label: 'Suces Ver Pin' },
  { key: 'actCount',     label: 'ACT Count' },
  { key: 'actRev',       label: 'Act Rev' },
  { key: 'park',         label: 'PARK' },
  { key: 'dct',          label: 'DCT' },
  { key: 'sdd',          label: 'SDD' },
  { key: 'renewCount',   label: 'Renew Count (P2A+Renewal)' },
  { key: 'renewRev',     label: 'Renew Rev' },
  { key: 'totalRev',     label: 'Total Rev' },
  { key: 'totalRevUsd',  label: 'Total Rev USD' },
  { key: 'sentToPub',    label: 'Sent To Pub' },
  { key: 'spend',        label: 'Spend' },
  { key: 'campCr',       label: 'Camp CR' },
  { key: 'pubCr',        label: 'Pub CR' },
];

// Map real API row → stats row
// API fields: serviceName, activation, renewal, churn, activationPending,
//             pricePoint, operatorId, operatorName, billerName
function mapRow(r) {
  const actRev     = (r.activation || 0) * (r.pricePoint || 0);
  const renewRev   = (r.renewal || 0) * (r.pricePoint || 0);
  const totalRev   = actRev + renewRev;
  const totalRevUsd = (totalRev / 550).toFixed(2);
  const campCr     = r.activation && r.renewal
    ? (((r.activation) / Math.max(r.activation + r.renewal, 1)) * 100).toFixed(2)
    : null;

  return {
    date:        r.serviceName || '—',
    clicks:      null,
    network:     r.operatorName || r.operatorId || '—',
    sendPin:     null,
    uniqSendPin: null,
    verPin:      null,
    uniqVerPin:  null,
    sucesVerPin: null,
    actCount:    r.activation ?? null,
    actRev:      actRev > 0 ? actRev.toLocaleString() : null,
    park:        null,
    dct:         null,
    sdd:         null,
    renewCount:  r.renewal ?? null,
    renewRev:    renewRev > 0 ? renewRev.toLocaleString() : null,
    totalRev:    totalRev > 0 ? totalRev.toLocaleString() : null,
    totalRevUsd: totalRev > 0 ? totalRevUsd : null,
    sentToPub:   null,
    spend:       null,
    campCr:      campCr,
    pubCr:       r.activationPending
                   ? (((r.activation || 0) / Math.max((r.activation || 0) + (r.activationPending || 0), 1)) * 100).toFixed(2)
                   : null,
    _biller:     r.billerName,
    _churn:      r.churn,
    _pending:    r.activationPending,
    _price:      r.pricePoint,
  };
}

const REV_KEYS = new Set(['actRev','renewRev','totalRev','totalRevUsd','sentToPub','spend']);

function CRCell({ value }) {
  if (value === null || value === undefined) return <span className="st-muted">—</span>;
  const num = parseFloat(value);
  const cls = num >= 5 ? 'cr-good' : num >= 2 ? 'cr-mid' : 'cr-low';
  return <span className={`cr-badge ${cls}`}>{value}%</span>;
}

export default function StatsTable({ filters, onTotalChange }) {
  const [data,    setData]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const size = 15;

  useEffect(() => { setPage(1); }, [filters]);

  useEffect(() => {
    if (!filters) return;
    setLoading(true);
    setError('');
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

  const exportCSV = () => {
    if (!data.length) return;
    const headers = COLS.map(c => c.label);
    const keys    = COLS.map(c => c.key);
    const csv = [
      headers.join(','),
      ...data.map(r => keys.map(k => r[k] ?? '').join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'analytics_stats.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="st-section">
      <div className="st-header">
        <div className="st-header-left">
          <div className="st-header-icon">📊</div>
          <div>
            <h2>Analytics Statistics</h2>
            <p>Performance metrics · {filters?.startDate} → {filters?.endDate}</p>
          </div>
        </div>
        <div className="st-header-right">
          {!loading && total > 0 && <span className="record-count">{total} records</span>}
          {!loading && data.length > 0 && (
            <button className="st-export-btn" onClick={exportCSV}>⬇ Export CSV</button>
          )}
        </div>
      </div>

      {error && <div className="error-box">⚠️ {error}</div>}

      <div className="table-wrap">
        <table className="st-table">
          <thead>
            <tr>
              {COLS.map(c => <th key={c.key} className="st-th">{c.label}</th>)}
            </tr>
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
                    <div className="no-data-sub">Adjust filters and click Apply</div>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={i}>
                  {COLS.map(c => {
                    const val = row[c.key];
                    return (
                      <td key={c.key} className="st-td">
                        {c.key === 'campCr' || c.key === 'pubCr'
                          ? <CRCell value={val} />
                          : c.key === 'date'
                          ? <span className="st-date">{val}</span>
                          : c.key === 'network'
                          ? <span className="st-network">{val}</span>
                          : REV_KEYS.has(c.key)
                          ? val !== null ? <span className="st-rev">{val}</span> : <span className="st-muted">—</span>
                          : val !== null && val !== undefined
                          ? <span>{typeof val === 'number' ? val.toLocaleString() : val}</span>
                          : <span className="st-muted">—</span>
                        }
                      </td>
                    );
                  })}
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
