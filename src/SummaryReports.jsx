import { useState, useEffect, useRef } from 'react';
import { fetchSummary, fetchHourlyReport } from './api';
import { SummaryFilterBar, DEFAULT_SUMMARY_FILTERS } from './FilterPanel';
import Pagination from './Pagination';
import SkeletonRows from './SkeletonRows';
import NullCell from './NullCell';
import * as XLSX from 'xlsx';


const S2S_COLS = [
  { key: 'date',              label: 'Date' },
  { key: 'billerName',        label: 'Biller' },
  { key: 'operatorName',      label: 'G / O / S' },
  { key: 'clicks',            label: 'Clicks' },
  { key: 'activation',        label: 'Activations' },
  { key: 'stp',               label: 'Send to Pub' },
  { key: 'activationPending', label: 'Parking' },
  { key: 'churn',             label: 'Deactivation' },
  { key: 'sdd',               label: 'SDD' },
  { key: 'renewal',           label: 'Renewals' },
  { key: 'parkToAct',         label: 'Parking to Activations' },
  { key: 'campCR',            label: 'Camp CR' },
  { key: 'pubCR',             label: 'Pub CR' },
  { key: 'actRev',            label: 'Activation Rev' },
  { key: 'renewRev',          label: 'Renewal Rev' },
  { key: 'totalRevUsd',       label: 'Total Revenue' },
];

const API_COLS = [
  { key: 'date',              label: 'Date' },
  { key: 'billerName',        label: 'Biller' },
  { key: 'operatorName',      label: 'G / O / S' },
  { key: 'sendPin',           label: 'Send Pin',       na: true },
  { key: 'uniqPinSend',       label: 'Uniq Pin Send',  na: true },
  { key: 'verPin',            label: 'Ver Pin',         na: true },
  { key: 'uniqVerPin',        label: 'Uniq Ver Pin',    na: true },
  { key: 'pinVerSuccess',     label: 'Pin Ver Success', na: true },
  { key: 'activation',        label: 'Activations' },
  { key: 'stp',               label: 'Send to Pub' },
  { key: 'activationPending', label: 'Parking' },
  { key: 'churn',             label: 'Deactivation' },
  { key: 'sdd',               label: 'SDD' },
  { key: 'renewal',           label: 'Renewals' },
  { key: 'parkToAct',         label: 'Parking to Activations' },
  { key: 'campCR',            label: 'Camp CR' },
  { key: 'pubCR',             label: 'Pub CR' },
  { key: 'actRev',            label: 'Activation Rev' },
  { key: 'renewRev',          label: 'Renewal Rev' },
  { key: 'totalRevUsd',       label: 'Total Revenue' },
];

// Aggregate hourly data: key = productname.toLowerCase()
function hourlyTotals(hourlyData) {
  return (hourlyData || []).reduce(
    (a, h) => ({
      clicks:      a.clicks      + (h.clicks      || 0),
      stp:         a.stp         + (h.stp         || 0),
      conversions: a.conversions + (h.conversions || 0),
    }),
    { clicks: 0, stp: 0, conversions: 0 }
  );
}

function billerFromHourly(c) {
  const links   = (c.links || '').toLowerCase();
  const product = (c.productname || '').toLowerCase().trim();
  if (links.includes('/briccs/') || links.includes('briccslp') || product.includes('bric')) {
    return { billerName: 'BRICCS', operatorId: 2135, operatorName: 'NG_MTN (2135)', serviceName: 'Poker' };
  }
  if (links.includes('xceed') || product === 'xceed') {
    return { billerName: 'XCEED', operatorId: 9039, operatorName: 'SD_MTN (9039)', serviceName: 'AIGamopedia' };
  }
  return null;
}

function passesHourlyFilters(meta, filters) {
  if (filters.billerName && meta.billerName !== filters.billerName) return false;
  if (filters.adnetwork && meta.billerName !== filters.adnetwork) return false;
  if (filters.operatorId && String(meta.operatorId) !== String(filters.operatorId)) return false;
  if (filters.serviceName && meta.serviceName &&
      filters.serviceName.toLowerCase() !== meta.serviceName.toLowerCase()) return false;
  return true;
}

// When billing summary is empty (e.g. same-day), still show click traffic from hourly API
function buildHourlyOnlyRows(hourlyRows, dateLabel, filters, coveredKeys) {
  const groups = new Map();

  (hourlyRows || []).forEach(c => {
    const meta = billerFromHourly(c);
    if (!meta || !passesHourlyFilters(meta, filters)) return;

    const key = `${meta.billerName}__${meta.operatorId || ''}`;
    if (coveredKeys.has(key)) return;

    const t = hourlyTotals(c.hourlyData);
    if (!t.clicks && !t.stp && !t.conversions) return;

    if (!groups.has(key)) {
      groups.set(key, {
        date: dateLabel,
        billerName: meta.billerName,
        operatorName: meta.operatorName,
        clicks: 0,
        stp: 0,
        conversions: 0,
      });
    }
    const row = groups.get(key);
    row.clicks      += t.clicks;
    row.stp         += t.stp;
    row.conversions += t.conversions;
  });

  return Array.from(groups.values()).map(row => ({
    date:              row.date,
    billerName:        row.billerName,
    operatorName:      row.operatorName,
    clicks:            row.clicks || null,
    activation:        null,
    stp:               row.stp || row.conversions || null,
    activationPending: null,
    churn:             null,
    sdd:               null,
    renewal:           null,
    parkToAct:         null,
    campCR:            null,
    pubCR:             null,
    actRev:            null,
    renewRev:          null,
    totalRevUsd:       null,
    sendPin: null, uniqPinSend: null, verPin: null, uniqVerPin: null, pinVerSuccess: null,
  }));
}

function buildHourlyMap(hourlyRows) {
  const map = {};
  const add = (key, t) => {
    if (!key) return;
    if (!map[key]) map[key] = { clicks: 0, stp: 0, conversions: 0 };
    map[key].clicks      += t.clicks;
    map[key].stp         += t.stp;
    map[key].conversions += t.conversions;
  };
  (hourlyRows || []).forEach(c => {
    const raw = (c.productname || '').toLowerCase().trim();
    const t   = hourlyTotals(c.hourlyData);
    add(raw, t);
    if (raw.startsWith('bric') && raw !== 'briccs') add('briccs', t);
    const links = (c.links || '').toLowerCase();
    if (links.includes('briccslp') || links.includes('/briccs/')) add('briccs', t);
  });
  return map;
}

// Aggregate API rows by date+billerName+operatorId — multiple pricePoint rows → one row
function aggregateRows(apiRows, dateLabel, hourlyMap) {
  const map = new Map();

  apiRows.forEach(r => {
    const key = `${r.billerName}__${r.operatorId}`;
    if (!map.has(key)) {
      map.set(key, {
        date:              dateLabel,
        billerName:        r.billerName        || null,
        operatorName:      r.operatorName ? `${r.operatorName} (${r.operatorId})` : (r.operatorId ? String(r.operatorId) : null),
        activation:        0,
        renewal:           0,
        churn:             0,
        activationPending: 0,
        actRev:            0,
        renewRev:          0,
        _billerKey:        (r.billerName  || '').toLowerCase().trim(),
        _serviceKey:       (r.serviceName || '').toLowerCase().trim(),
      });
    }
    const row = map.get(key);
    const price = r.pricePoint || 0;
    const act   = r.activation || 0;
    const ren   = r.renewal    || 0;
    row.activation        += act;
    row.renewal           += ren;
    row.churn             += (r.churn             || 0);
    row.activationPending += (r.activationPending || 0);
    row.actRev            += act * price;
    row.renewRev          += ren * price;
  });

  return Array.from(map.values()).map(row => {
    const bk     = (row._billerKey  || '').toLowerCase().trim();
    const sk     = (row._serviceKey || '').toLowerCase().trim();
    const hourly = hourlyMap[bk] || hourlyMap[sk] || null;
    const clicks      = hourly?.clicks      ?? null;
    const stp         = hourly?.stp         ?? null;
    const conversions = hourly?.conversions ?? null;
    const act       = row.activation;
    const ren       = row.renewal;
    const parking   = row.activationPending;
    const totalRev  = row.actRev + row.renewRev;

    const campCR   = clicks > 0 && act > 0     ? ((act     / clicks)  * 100).toFixed(2) : null;
    const pubCR    = clicks > 0 && ren > 0     ? ((ren     / clicks)  * 100).toFixed(2) : null;
    const parkToAct = parking > 0 && act > 0   ? ((act     / parking) * 100).toFixed(2) : null;

    return {
      date:              row.date,
      billerName:        row.billerName,
      operatorName:      row.operatorName,
      clicks,
      activation:        act       || null,
      stp:               stp ?? conversions ?? null,
      activationPending: parking   || null,
      churn:             row.churn || null,
      sdd:               null,
      renewal:           ren       || null,
      parkToAct,
      campCR,
      pubCR,
      actRev:      row.actRev   > 0 ? row.actRev.toFixed(2)   : null,
      renewRev:    row.renewRev > 0 ? row.renewRev.toFixed(2) : null,
      totalRevUsd: totalRev     > 0 ? totalRev.toFixed(2)     : null,
      // API pin fields not available
      sendPin: null, uniqPinSend: null, verPin: null, uniqVerPin: null, pinVerSuccess: null,
    };
  });
}

function CRCell({ v }) {
  if (v == null) return <NullCell />;
  const n = parseFloat(v);
  return <span className={`cr-badge ${n >= 10 ? 'cr-good' : n >= 3 ? 'cr-mid' : 'cr-low'}`}>{v}%</span>;
}

function Cell({ col, row }) {
  const v = row[col.key];
  if (col.key === 'campCR' || col.key === 'pubCR' || col.key === 'parkToAct') return <CRCell v={v} />;
  if (col.na) return <span className="ct-muted" style={{ fontSize: '.72rem' }}>N/A</span>;
  if (v == null) return <NullCell />;
  if (col.key === 'date')         return <span className="ct-date">{v}</span>;
  if (col.key === 'billerName')   return <span className="td-primary">{v}</span>;
  if (col.key === 'operatorName') return <span className="ct-network">{v}</span>;
  if (col.key === 'clicks')       return <strong>{Number(v).toLocaleString()}</strong>;
  if (col.key === 'stp')          return <span className="stp-badge">{Number(v).toLocaleString()}</span>;
  if (col.key === 'actRev' || col.key === 'renewRev' || col.key === 'totalRevUsd')
    return <span className="ct-rev">{v}</span>;
  return typeof v === 'number' ? v.toLocaleString() : v;
}

export default function SummaryReports() {
  const [subTab,  setSubTab]  = useState('s2s');
  const [filters, setFilters] = useState(DEFAULT_SUMMARY_FILTERS);
  const [rows,    setRows]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const SIZE = 15;

  const filtersRef = useRef(filters);

  const loadData = (f, p) => {
    filtersRef.current = f;
    setLoading(true); setError('');
    const dateLabel = `${f.startDate}${f.endDate !== f.startDate ? ` \u2192 ${f.endDate}` : ''}`;
    Promise.all([
      fetchSummary({ ...f, page: p, size: SIZE }),
      fetchHourlyReport(f.startDate, f.endDate).catch(() => []),
    ])
      .then(([res, hourlyData]) => {
        const apiRows      = res.data || [];
        const coveredKeys  = new Set(apiRows.map(r => `${r.billerName || ''}__${r.operatorId || ''}`));
        const hourlyMap    = buildHourlyMap(hourlyData);
        const aggregated   = aggregateRows(apiRows, dateLabel, hourlyMap);
        const hourlyOnly   = buildHourlyOnlyRows(hourlyData, dateLabel, f, coveredKeys);
        const allRows      = [...aggregated, ...hourlyOnly];
        setRows(allRows);
        setTotal(Math.max(res.total || 0, allRows.length));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(filters, 1); }, []); // eslint-disable-line

  const handleApply = (f) => { setFilters(f); setPage(1); setRows([]); setTotal(0); loadData(f, 1); };
  const handlePageChange = (p) => { setPage(p); loadData(filtersRef.current, p); };

  const cols = subTab === 's2s' ? S2S_COLS : API_COLS;
  const dateLabel = `${filters.startDate}${filters.endDate !== filters.startDate ? ` → ${filters.endDate}` : ''}`;

  const exportExcel = () => {
    if (!rows.length) return;
    const data = rows.map(r => Object.fromEntries(cols.map(c => [c.label, c.na ? 'N/A' : (r[c.key] ?? '')])));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = cols.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, subTab === 's2s' ? 'S2S Report' : 'API Report');
    XLSX.writeFile(wb, `summary_${subTab}_${filters.startDate}_${filters.endDate}.xlsx`);
  };

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
            {!loading && rows.length > 0 && <span className="record-count">{rows.length} records</span>}
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
                <SkeletonRows cols={cols.length} rows={5} />
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
