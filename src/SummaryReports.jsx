import { useState, useEffect } from 'react';
import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { fetchSummary, fetchHourlyReport } from './api';
import { SummaryFilterBar, DEFAULT_SUMMARY_FILTERS } from './FilterPanel';
import Pagination from './Pagination';
import SkeletonRows from './SkeletonRows';
import NullCell from './NullCell';
import { totalsFromHourlyData, calcCR, calcStpCR, billerFromHourly, passesBillingFilters, passesTrafficFilters } from './utils';
import * as XLSX from 'xlsx';

const ROWS_PER_PAGE = 50;

const S2S_COLS = [
  { key: 'date',              label: 'Date' },
  { key: 'campaignService',   label: 'Campaign / Service' },
  { key: 'billerName',        label: 'Aggregator' },
  { key: 'dspNetwork',        label: 'Network' },
  { key: 'operatorName',      label: 'G / O / S' },
  { key: 'clicks',            label: 'Clicks' },
  { key: 'activation',        label: 'ACT' },
  { key: 'parkToAct',         label: 'P2A' },
  { key: 'activationPending', label: 'PARK' },
  { key: 'churn',             label: 'Dct' },
  { key: 'sdd',               label: 'SDD' },
  { key: 'renewal',           label: 'RENEW' },
  { key: 'actRev',            label: 'Act Rev' },
  { key: 'renewRev',          label: 'Renew Rev' },
  { key: 'totalRevUsd',       label: 'Total Rev USD' },
  { key: 'conversions',       label: 'Conversions' },
  { key: 'stp',               label: 'Sent To Pub' },
  { key: 'campCR',            label: 'CR %' },
  { key: 'stpCR',             label: 'STP CR %' },
];

const API_COLS = [
  { key: 'date',              label: 'Date' },
  { key: 'campaignService',   label: 'Campaign / Service' },
  { key: 'billerName',        label: 'Aggregator' },
  { key: 'dspNetwork',        label: 'Network' },
  { key: 'operatorName',      label: 'G / O / S' },
  { key: 'clicks',            label: 'Clicks' },
  { key: 'sendPin',           label: 'Send Pin',       na: true },
  { key: 'uniqPinSend',       label: 'Uniq Pin Send',  na: true },
  { key: 'verPin',            label: 'Ver Pin',         na: true },
  { key: 'uniqVerPin',        label: 'Uniq Ver Pin',    na: true },
  { key: 'pinVerSuccess',     label: 'Pin Ver Success', na: true },
  { key: 'activation',        label: 'ACT' },
  { key: 'parkToAct',         label: 'P2A' },
  { key: 'activationPending', label: 'PARK' },
  { key: 'churn',             label: 'Dct' },
  { key: 'sdd',               label: 'SDD' },
  { key: 'renewal',           label: 'RENEW' },
  { key: 'actRev',            label: 'Act Rev' },
  { key: 'renewRev',          label: 'Renew Rev' },
  { key: 'totalRevUsd',       label: 'Total Rev USD' },
  { key: 'conversions',       label: 'Conversions' },
  { key: 'stp',               label: 'Sent To Pub' },
  { key: 'campCR',            label: 'CR %' },
  { key: 'stpCR',             label: 'STP CR %' },
];

function aggOpKey(billerName, operatorId) {
  return `${billerName || ''}__${operatorId ?? ''}`;
}

/** Billing row — one per API record (price point kept separate) */
function mapBillingRow(r, dateLabel, filters) {
  if (!passesBillingFilters(r, filters)) return null;

  const act      = r.activation        || 0;
  const ren      = r.renewal           || 0;
  const parking  = r.activationPending || 0;
  const churn    = r.churn             || 0;
  const price    = r.pricePoint        || 0;
  const actRev   = act * price;
  const renewRev = ren * price;
  const totalRev = actRev + renewRev;
  const ppLabel  = price ? ` · PP ${price}` : '';
  const aggOp    = aggOpKey(r.billerName, r.operatorId);

  return {
    date: dateLabel,
    campaignService: `${r.serviceName || '—'}${ppLabel}`,
    billerName: r.billerName || null,
    dspNetwork: null,
    operatorName: r.operatorName
      ? `${r.operatorName} (${r.operatorId})`
      : (r.operatorId ? String(r.operatorId) : null),
    clicks: null,
    activation: act || null,
    conversions: null,
    stp: null,
    activationPending: parking || null,
    churn: churn || null,
    sdd: null,
    renewal: ren || null,
    parkToAct: parking > 0 && act > 0 ? ((act / parking) * 100).toFixed(2) : null,
    campCR: null,
    stpCR: null,
    actRev: actRev > 0 ? actRev.toFixed(2) : null,
    renewRev: renewRev > 0 ? renewRev.toFixed(2) : null,
    totalRevUsd: totalRev > 0 ? totalRev.toFixed(2) : null,
    sendPin: null, uniqPinSend: null, verPin: null, uniqVerPin: null, pinVerSuccess: null,
    _rowKey: `billing-${dateLabel}-${r.billerName}-${r.operatorId}-${r.serviceName}-${price}`,
    _aggOp: aggOp,
    _sort: 1,
  };
}

/** Traffic row — one per campaign; conversions & STP from API as-is */
function mapTrafficRow(c, dateLabel, filters) {
  const meta = billerFromHourly(c);
  if (!passesTrafficFilters(c, filters)) return null;

  const t = totalsFromHourlyData(c.hourlyData);
  if (!t.clicks && !t.stp && !t.conversions) return null;

  const { clicks, conversions, stp } = t;

  return {
    date: dateLabel,
    campaignService: `${c.productname || '—'} #${c.campaignId}`,
    billerName: meta?.billerName || null,
    dspNetwork: c.dspName || null,
    operatorName: meta?.operatorName || null,
    clicks: clicks || null,
    conversions: conversions || null,
    stp: stp || null,
    activation: null,
    activationPending: null,
    churn: null,
    sdd: null,
    renewal: null,
    parkToAct: null,
    campCR: calcCR(conversions, clicks),
    stpCR:  calcStpCR(stp, clicks),
    actRev: null,
    renewRev: null,
    totalRevUsd: null,
    sendPin: null, uniqPinSend: null, verPin: null, uniqVerPin: null, pinVerSuccess: null,
    _rowKey: `traffic-${dateLabel}-${c.campaignId}`,
    _aggOp: meta ? aggOpKey(meta.billerName, meta.operatorId) : null,
    _sort: 0,
  };
}

/**
 * Traffic rows per campaign + billing rows per price point.
 * Both are always included — clicks from hourly, ACT/renewals from billing API.
 */
function buildDayRows(day, apiRows, hourlyForDay, filters) {
  const traffic = (hourlyForDay || [])
    .filter(c => c.type === 'vas')
    .map(c => mapTrafficRow(c, day, filters))
    .filter(Boolean);

  const billing = (apiRows || [])
    .map(r => mapBillingRow(r, day, filters))
    .filter(Boolean);

  return [...traffic, ...billing];
}

function getDaysInRange(startDate, endDate) {
  return eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  })
    .map(d => format(d, 'yyyy-MM-dd'))
    .reverse();
}

function formatTableDate(isoDate) {
  if (!isoDate) return '—';
  try {
    return format(parseISO(isoDate), 'yyyy-MM-dd');
  } catch {
    return isoDate;
  }
}

function formatDateRangeLabel(startDate, endDate) {
  if (!startDate || !endDate) return '—';
  if (startDate === endDate) return format(parseISO(startDate), 'MMM dd, yyyy');
  return `${format(parseISO(startDate), 'MMM dd, yyyy')} → ${format(parseISO(endDate), 'MMM dd, yyyy')}`;
}

function aggregatorLabel(billerName) {
  const name = (billerName || '').trim();
  return name || '—';
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    const sortCmp = (a._sort ?? 0) - (b._sort ?? 0);
    if (sortCmp !== 0) return sortCmp;
    return String(a.campaignService || '').localeCompare(String(b.campaignService || ''));
  });
}

function CRCell({ v }) {
  if (v == null) return <NullCell />;
  const n = parseFloat(v);
  return <span className={`cr-badge ${n >= 10 ? 'cr-good' : n >= 3 ? 'cr-mid' : 'cr-low'}`}>{v}%</span>;
}

function Cell({ col, row }) {
  const v = row[col.key];
  if (col.key === 'campCR' || col.key === 'stpCR' || col.key === 'parkToAct') return <CRCell v={v} />;
  if (col.na) return <span className="ct-muted" style={{ fontSize: '.72rem' }}>N/A</span>;
  if (v == null) return <NullCell />;
  if (col.key === 'date')            return <span className="ct-date">{formatTableDate(v)}</span>;
  if (col.key === 'campaignService') return <span className="td-primary">{v}</span>;
  if (col.key === 'billerName')      return <span className="td-primary">{aggregatorLabel(v)}</span>;
  if (col.key === 'dspNetwork')      return v ? <span className="ct-network">{v}</span> : <NullCell />;
  if (col.key === 'operatorName')    return <span className="ct-network">{v}</span>;
  if (col.key === 'clicks')          return <strong>{Number(v).toLocaleString()}</strong>;
  if (col.key === 'stp')             return <span className="stp-badge">{Number(v).toLocaleString()}</span>;
  if (col.key === 'actRev' || col.key === 'renewRev' || col.key === 'totalRevUsd')
    return <span className="ct-rev">{v}</span>;
  return typeof v === 'number' ? v.toLocaleString() : v;
}

export default function SummaryReports() {
  const [subTab,  setSubTab]  = useState('s2s');
  const [filters, setFilters] = useState(DEFAULT_SUMMARY_FILTERS);
  const [rows,    setRows]    = useState([]);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const loadData = (f) => {
    setLoading(true); setError('');
    const days = getDaysInRange(f.startDate, f.endDate);

    fetchHourlyReport(f.startDate, f.endDate)
      .catch(() => [])
      .then(hourlyData =>
        Promise.all(days.map(day => {
          const hourlyForDay = (hourlyData || []).filter(c => c.date === day);
          return fetchSummary({ ...f, startDate: day, endDate: day, page: 1, size: 500 })
            .then(res => buildDayRows(day, res.data || [], hourlyForDay, f))
            .catch(() => buildDayRows(day, [], hourlyForDay, f));
        }))
      )
      .then(dayRows => setRows(sortRows(dayRows.flat())))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(filters); }, []); // eslint-disable-line

  const handleApply = (f) => { setFilters(f); setPage(1); setRows([]); loadData(f); };
  const handlePageChange = (p) => setPage(p);

  const cols = subTab === 's2s' ? S2S_COLS : API_COLS;
  const dateLabel = formatDateRangeLabel(filters.startDate, filters.endDate);
  const visibleRows = rows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const exportRow = (r) => Object.fromEntries(cols.map(c => {
    let val = r[c.key];
    if (c.key === 'date' && val) val = formatTableDate(val);
    if (c.key === 'billerName') val = aggregatorLabel(val);
    return [c.label, c.na ? 'N/A' : (val ?? '')];
  }));

  const exportExcel = () => {
    if (!rows.length) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows.map(exportRow));
    ws['!cols'] = cols.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, subTab === 's2s' ? 'S2S Report' : 'API Report');
    XLSX.writeFile(wb, `summary_${subTab}_${filters.startDate}_${filters.endDate}.xlsx`);
  };

  return (
    <div className="demo-page">
      <SummaryFilterBar onApply={handleApply} onExport={exportExcel} exportDisabled={!rows.length} />
      {error && <div className="error-box">⚠️ {error}</div>}

      <div className="demo-report-bar">
        <div className="demo-report-tabs">
          <button type="button" className={`demo-report-tab ${subTab === 's2s' ? 'active' : ''}`} onClick={() => setSubTab('s2s')}>
            S2S Report
          </button>
          <button type="button" className={`demo-report-tab ${subTab === 'api' ? 'active' : ''}`} onClick={() => setSubTab('api')}>
            API Report
          </button>
        </div>
        <span className="demo-report-meta">📅 {dateLabel}</span>
      </div>

      <div className="demo-table-section">
        {!loading && rows.length > 0 && (
          <div className="demo-table-meta">
            <span>{rows.length} records</span>
          </div>
        )}

        <div className="demo-table-wrap">
          <table className="demo-table">
            <thead>
              <tr className="demo-thead-row">
                {cols.map(c => (
                  <th key={c.key} className={c.na ? 'demo-th-dummy' : ''}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows cols={cols.length} rows={8} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={cols.length}>
                    <div className="no-data-inner" style={{ padding: '2.5rem' }}>
                      <div className="no-data-icon">📭</div>
                      <div className="no-data-text">No data found</div>
                      <div className="no-data-sub">No records for {dateLabel}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row._rowKey}>
                    {cols.map(c => (
                      <td key={c.key} className={c.na ? 'demo-td-dummy' : ''}>
                        <Cell col={c} row={row} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} total={rows.length} size={ROWS_PER_PAGE} onChange={handlePageChange} />
      </div>
    </div>
  );
}
