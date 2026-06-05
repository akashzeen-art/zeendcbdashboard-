import { useState, useEffect, useCallback } from 'react';
import { fetchSummary, fetchHourlyReport } from './api';
import { SummaryFilterBar } from './FilterPanel';
import Pagination from './Pagination';
import SkeletonRows from './SkeletonRows';
import NullCell from './NullCell';
import * as XLSX from 'xlsx';

const today = new Date().toISOString().split('T')[0];

// S2S: Date_Biller_G/O/S_Clicks_Activations_STP_Parking_Deactivation_SDD_Renewals_Park→Act_Camp CR_Pub CR_Act Rev_Ren Rev_Total Rev USD
const S2S_COLS = [
  { key: 'billerName',        label: 'Biller' },
  { key: 'operatorName',      label: 'G / O / S' },
  { key: 'clicks',            label: 'Clicks' },
  { key: 'activation',        label: 'Activations' },
  { key: 'stp',               label: 'Send to Pub' },
  { key: 'activationPending', label: 'Parking' },
  { key: 'churn',             label: 'Deactivation' },
  { key: 'sdd',               label: 'SDD' },
  { key: 'renewal',           label: 'Renewals' },
  { key: 'parkToAct',         label: 'Park → Act' },
  { key: 'campCR',            label: 'Camp CR' },
  { key: 'pubCR',             label: 'Pub CR' },
  { key: 'actRev',            label: 'Activation Rev' },
  { key: 'renewRev',          label: 'Renewal Rev' },
  { key: 'totalRevUsd',       label: 'Total Rev USD' },
];

// API: Date_Biller_G/O/S_SendPin_UniqPinSend_VerPin_UniqVerPin_PinVerSuccess_Activations_STP_Parking_Deactivation_SDD_Renewals_Park→Act_Camp CR_Pub CR_Act Rev_Ren Rev_Total Rev USD
const API_COLS = [
  { key: 'billerName',        label: 'Biller' },
  { key: 'operatorName',      label: 'G / O / S' },
  { key: 'sendPin',           label: 'Send Pin',        na: true },
  { key: 'uniqPinSend',       label: 'Uniq Pin Send',   na: true },
  { key: 'verPin',            label: 'Ver Pin',          na: true },
  { key: 'uniqVerPin',        label: 'Uniq Ver Pin',     na: true },
  { key: 'pinVerSuccess',     label: 'Pin Ver Success',  na: true },
  { key: 'activation',        label: 'Activations' },
  { key: 'stp',               label: 'Send to Pub' },
  { key: 'activationPending', label: 'Parking' },
  { key: 'churn',             label: 'Deactivation' },
  { key: 'sdd',               label: 'SDD' },
  { key: 'renewal',           label: 'Renewals' },
  { key: 'parkToAct',         label: 'Park → Act' },
  { key: 'campCR',            label: 'Camp CR' },
  { key: 'pubCR',             label: 'Pub CR' },
  { key: 'actRev',            label: 'Activation Rev' },
  { key: 'renewRev',          label: 'Renewal Rev' },
  { key: 'totalRevUsd',       label: 'Total Rev USD' },
];

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

function mapRow(r, hourlyMap) {
  const price    = r.pricePoint || 0;
  const act      = r.activation || 0;
  const ren      = r.renewal    || 0;
  const churn    = r.churn      || 0;
  const parking  = r.activationPending || 0;
  const actRev   = act * price;
  const renewRev = ren * price;
  const totalRev = actRev + renewRev;

  const keys   = [(r.serviceName || '').toLowerCase().trim(), (r.billerName || '').toLowerCase().trim()];
  const hourly = keys.reduce((f, k) => f || hourlyMap[k] || null, null);

  const clicks   = hourly?.clicks ?? null;
  const stp      = hourly?.stp    ?? null;
  const campCR   = clicks > 0 && act > 0  ? ((act / clicks) * 100).toFixed(2) : null;
  const pubCR    = clicks > 0 && ren > 0  ? ((ren / clicks) * 100).toFixed(2) : null;
  const parkToAct = parking > 0 && act > 0 ? ((act / parking) * 100).toFixed(2) : null;

  return {
    billerName:        r.billerName        || null,
    operatorName:      r.operatorName ? `${r.operatorName} (${r.operatorId})` : (r.operatorId ? String(r.operatorId) : null),
    clicks,
    activation:        r.activation        ?? null,
    stp,
    activationPending: r.activationPending ?? null,
    churn:             r.churn             ?? null,
    sdd:               null, // not in API
    renewal:           r.renewal           ?? null,
    parkToAct,
    campCR,
    pubCR,
    actRev:      actRev    > 0 ? actRev.toFixed(2)           : null,
    renewRev:    renewRev  > 0 ? renewRev.toFixed(2)         : null,
    totalRevUsd: totalRev  > 0 ? (totalRev / 550).toFixed(2) : null,
    // API-only pin fields — not available in API
    sendPin: null, uniqPinSend: null, verPin: null, uniqVerPin: null, pinVerSuccess: null,
  };
}

function CRCell({ v }) {
  if (v == null) return <NullCell />;
  const n = parseFloat(v);
  return <span className={`cr-badge ${n >= 10 ? 'cr-good' : n >= 3 ? 'cr-mid' : 'cr-low'}`}>{v}%</span>;
}

function Cell({ col, row }) {
  const v = row[col.key];
  if (col.key === 'campCR' || col.key === 'pubCR' || col.key === 'parkToAct') return <CRCell v={v} />;
  if (col.na) return <span className="ct-muted" style={{fontSize:'.72rem'}}>N/A</span>;
  if (v == null) return <NullCell />;
  if (col.key === 'billerName')    return <span className="td-primary">{v}</span>;
  if (col.key === 'operatorName')  return <span className="ct-network">{v}</span>;
  if (col.key === 'clicks')        return <strong>{Number(v).toLocaleString()}</strong>;
  if (col.key === 'stp')           return <span className="stp-badge">{Number(v).toLocaleString()}</span>;
  if (col.key === 'actRev' || col.key === 'renewRev' || col.key === 'totalRevUsd')
    return <span className="ct-rev">{v}</span>;
  return typeof v === 'number' ? v.toLocaleString() : v;
}

export default function SummaryReports() {
  const [subTab,  setSubTab]  = useState('s2s');
  const [filters, setFilters] = useState({ startDate: today, endDate: today, billerName: '', operatorId: '', serviceName: '', adnetwork: '' });
  const [rows,    setRows]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const SIZE = 15;

  const loadData = useCallback((f, p) => {
    setLoading(true); setError('');
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

  useEffect(() => { loadData(filters, 1); }, []); // eslint-disable-line
  useEffect(() => { if (page === 1) return; loadData(filters, page); }, [page]); // eslint-disable-line

  const handleApply = (f) => { setFilters(f); setPage(1); setRows([]); setTotal(0); loadData(f, 1); };
  const handlePageChange = (p) => { setPage(p); loadData(filters, p); };

  const cols = subTab === 's2s' ? S2S_COLS : API_COLS;

  const exportExcel = () => {
    if (!rows.length) return;
    const data = rows.map(r => Object.fromEntries(cols.map(c => [c.label, c.na ? 'N/A' : (r[c.key] ?? '')])));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = cols.map(() => ({ wch: 16 }));
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
            {!loading && rows.length > 0 && <button className="ct-export-btn" onClick={exportExcel}>⬇ Export Excel</button>}
          </div>
        </div>

        <div className="table-wrap">
          <table className="ct-table">
            <thead>
              <tr>{cols.map(c => <th key={c.key} className={`ct-th${c.na ? ' ct-th-dummy' : ''}`}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows cols={cols.length} rows={8} />
              ) : rows.length === 0 ? (
                <tr><td colSpan={cols.length}>
                  <div className="no-data-inner" style={{ padding: '3rem' }}>
                    <div className="no-data-icon">📭</div>
                    <div className="no-data-text">No data found</div>
                    <div className="no-data-sub">No records for {dateLabel}</div>
                  </div>
                </td></tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={i}>
                    {cols.map(c => (
                      <td key={c.key} className={`ct-td${c.na ? ' ct-td-dummy' : ''}`}>
                        <Cell col={c} row={row} />
                      </td>
                    ))}
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
