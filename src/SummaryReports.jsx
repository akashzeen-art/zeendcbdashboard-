import { useState, useEffect, useCallback } from 'react';
import { fetchSummary, fetchHourlyReport } from './api';
import { SummaryFilterBar } from './FilterPanel';
import Pagination from './Pagination';
import SkeletonRows from './SkeletonRows';
import NullCell from './NullCell';
import * as XLSX from 'xlsx';

const today = new Date().toISOString().split('T')[0];

const COLS = [
  { key: 'serviceName',       label: 'Service / Product' },
  { key: 'billerName',        label: 'Biller' },
  { key: 'operatorName',      label: 'G / O / S' },
  { key: 'pricePoint',        label: 'Price Point' },
  { key: 'clicks',            label: 'Clicks' },
  { key: 'activation',        label: 'Activations' },
  { key: 'stp',               label: 'STP' },
  { key: 'stpCR',             label: 'STP CR' },
  { key: 'activationPending', label: 'Parking' },
  { key: 'churn',             label: 'Deactivation' },
  { key: 'renewal',           label: 'Renewals' },
  { key: 'campCR',            label: 'Camp CR' },
  { key: 'actRev',            label: 'Activation Rev' },
  { key: 'renewRev',          label: 'Renewal Rev' },
  { key: 'totalRevUsd',       label: 'Total Rev USD' },
];

// Aggregate hourly clicks/stp by productname
function buildHourlyMap(hourlyRows) {
  const map = {};
  (hourlyRows || []).forEach(c => {
    const key = (c.productname || '').toLowerCase().trim();
    const t = (c.hourlyData || []).reduce(
      (a, h) => ({ clicks: a.clicks + (h.clicks || 0), stp: a.stp + (h.stp || 0) }),
      { clicks: 0, stp: 0 }
    );
    if (!map[key]) map[key] = { clicks: 0, stp: 0 };
    map[key].clicks += t.clicks;
    map[key].stp    += t.stp;
  });
  return map;
}

// Map raw API row — no hardcoded values, all from API
function mapRow(r, hourlyMap) {
  const price    = r.pricePoint  || 0;
  const act      = r.activation  || 0;
  const ren      = r.renewal     || 0;
  const churn    = r.churn       || 0;
  const actRev   = act * price;
  const renewRev = ren * price;
  const totalRev = actRev + renewRev;
  const total    = act + ren + churn;

  const keys   = [(r.serviceName || '').toLowerCase().trim(), (r.billerName || '').toLowerCase().trim()];
  const hourly = keys.reduce((f, k) => f || hourlyMap[k] || null, null);

  const clicks = hourly?.clicks ?? null;
  const stp    = hourly?.stp    ?? (r.stp ?? null);
  // STP CR% = STP / Clicks * 100
  const stpCR  = clicks > 0 && stp != null ? ((stp / clicks) * 100).toFixed(2) : null;
  // Camp CR% = Activations / Clicks * 100
  const campCR = clicks > 0 && act > 0 ? ((act / clicks) * 100).toFixed(2) : null;

  return {
    serviceName:       r.serviceName       || null,
    billerName:        r.billerName        || null,
    operatorName:      r.operatorName ? `${r.operatorName} (${r.operatorId})` : (r.operatorId ? String(r.operatorId) : null),
    pricePoint:        r.pricePoint        ?? null,
    clicks,
    activation:        r.activation        ?? null,
    stp,
    stpCR,
    activationPending: r.activationPending ?? null,
    churn:             r.churn             ?? null,
    renewal:           r.renewal           ?? null,
    campCR,
    actRev:      actRev    > 0 ? actRev.toFixed(2)             : null,
    renewRev:    renewRev  > 0 ? renewRev.toFixed(2)           : null,
    totalRevUsd: totalRev  > 0 ? (totalRev / price || 0).toFixed(2) : null,
  };
}

function CRCell({ v, type }) {
  if (v == null) return <NullCell />;
  const n = parseFloat(v);
  // STP CR: good >= 20%, mid >= 5%; Camp CR: good >= 10%, mid >= 3%
  const good = type === 'stp' ? 20 : 10;
  const mid  = type === 'stp' ? 5  : 3;
  return <span className={`cr-badge ${n >= good ? 'cr-good' : n >= mid ? 'cr-mid' : 'cr-low'}`}>{v}%</span>;
}

function Cell({ col, row }) {
  const v = row[col.key];
  if (col.key === 'stpCR')  return <CRCell v={v} type="stp" />;
  if (col.key === 'campCR') return <CRCell v={v} type="camp" />;
  if (v == null) return <NullCell />;
  if (col.key === 'serviceName' || col.key === 'billerName')
    return <span className="td-primary">{v}</span>;
  if (col.key === 'operatorName')
    return <span className="ct-network">{v}</span>;
  if (col.key === 'pricePoint')
    return <span className="pack-badge">{Number(v).toLocaleString()}</span>;
  if (col.key === 'clicks')
    return <strong>{Number(v).toLocaleString()}</strong>;
  if (col.key === 'stp')
    return <span className="stp-badge">{Number(v).toLocaleString()}</span>;
  if (col.key === 'actRev' || col.key === 'renewRev' || col.key === 'totalRevUsd')
    return <span className="ct-rev">{v}</span>;
  return typeof v === 'number' ? v.toLocaleString() : v;
}

export default function SummaryReports() {
  const [subTab,   setSubTab]   = useState('s2s');
  const [filters,  setFilters]  = useState({ startDate: today, endDate: today, billerName: '', operatorId: '', serviceName: '', adnetwork: '' });
  const [rows,     setRows]     = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const SIZE = 15;

  const loadData = useCallback((f, p) => {
    setLoading(true);
    setError('');
    Promise.all([
      fetchSummary({ ...f, page: p, size: SIZE }),
      fetchHourlyReport(f.startDate, f.endDate).catch(() => []),
    ])
      .then(([res, hourlyData]) => {
        const hourlyMap = buildHourlyMap(hourlyData);
        setRows((res.data || []).map(r => mapRow(r, hourlyMap)));
        setTotal(res.total || 0);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Load on mount with today's filters
  useEffect(() => {
    loadData(filters, 1);
  }, []); // eslint-disable-line

  // Load when page changes (not on filter change — that's handled by onApply)
  useEffect(() => {
    if (page === 1) return; // page=1 is handled by onApply/onSubTabChange
    loadData(filters, page);
  }, [page]); // eslint-disable-line

  const handleApply = (f) => {
    setFilters(f);
    setPage(1);
    setRows([]);
    setTotal(0);
    loadData(f, 1);
  };

  const handlePageChange = (p) => {
    setPage(p);
    loadData(filters, p);
  };

  const exportExcel = () => {
    if (!rows.length) return;
    const data = rows.map(r => Object.fromEntries(COLS.map(c => [c.label, r[c.key] ?? ''])));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = COLS.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, subTab === 's2s' ? 'S2S Report' : 'API Report');
    XLSX.writeFile(wb, `summary_${subTab}_${filters.startDate}_${filters.endDate}.xlsx`);
  };

  const dateLabel = `${filters.startDate}${filters.endDate !== filters.startDate ? ` → ${filters.endDate}` : ''}`;

  return (
    <div>
      <SummaryFilterBar onApply={handleApply} />
      {error && <div className="error-box">⚠️ {error}</div>}

      <div className="sub-tabs-bar">
        <div className="sub-tabs">
          <button className={`sub-tab ${subTab === 's2s' ? 'active' : ''}`} onClick={() => setSubTab('s2s')}>S2S Report</button>
          <button className={`sub-tab ${subTab === 'api' ? 'active' : ''}`} onClick={() => setSubTab('api')}>API Report</button>
        </div>
        <span className="table-meta">📅 {dateLabel}</span>
      </div>

      <div className="ct-section">
        <div className="ct-header">
          <div className="ct-header-left">
            <div className="ct-header-icon">📋</div>
            <div>
              <h2>{subTab === 's2s' ? 'S2S Summary Report' : 'API Summary Report'}</h2>
              <p>{dateLabel}</p>
            </div>
          </div>
          <div className="ct-header-right">
            {!loading && total > 0 && <span className="record-count">{total} records</span>}
            {!loading && rows.length > 0 && (
              <button className="ct-export-btn" onClick={exportExcel}>⬇ Export Excel</button>
            )}
          </div>
        </div>

        <div className="table-wrap">
          <table className="ct-table">
            <thead>
              <tr>{COLS.map(c => <th key={c.key} className="ct-th">{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows cols={COLS.length} rows={8} />
              ) : rows.length === 0 ? (
                <tr><td colSpan={COLS.length}>
                  <div className="no-data-inner" style={{ padding: '3rem' }}>
                    <div className="no-data-icon">📭</div>
                    <div className="no-data-text">No data found</div>
                    <div className="no-data-sub">No records for {dateLabel}</div>
                  </div>
                </td></tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={i}>
                    {COLS.map(c => <td key={c.key} className="ct-td"><Cell col={c} row={row} /></td>)}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} size={SIZE} onChange={handlePageChange} />
      </div>
    </div>
  );
}
