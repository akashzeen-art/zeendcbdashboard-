import { useState, useEffect } from 'react';
import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { fetchSummary, fetchHourlyReport } from './api';
import { SummaryFilterBar, DEFAULT_SUMMARY_FILTERS } from './FilterPanel';
import Pagination from './Pagination';
import SkeletonRows from './SkeletonRows';
import NullCell from './NullCell';
import { totalsFromHourlyData, calcCR, calcStpCR, billerFromHourly, passesBillingFilters, passesTrafficFilters, parseOperatorFields, parsePackFromProduct, resolveServiceName, localToUsd, excelNum, applySheetNumberFormats } from './utils';
import * as XLSX from 'xlsx';

const ROWS_PER_PAGE = 50;

const EXPORT_NUM_KEYS = new Set([
  'clicks', 'activation', 'activationPending', 'churn', 'renewal', 'stp',
  'actRev', 'renewRev', 'totalRevUsd',
]);

const EXPORT_REV_LABELS = ['Act Rev', 'Renew Rev', 'Total Rev USD'];
const EXPORT_COUNT_LABELS = ['Clicks', 'ACT', 'PARK', 'Dct', 'RENEW', 'Sent To Pub'];

const COLS = [
  { key: 'date',              label: 'Date' },
  { key: 'geo',               label: 'Geo' },
  { key: 'operator',          label: 'Operator' },
  { key: 'service',           label: 'Service' },
  { key: 'pack',              label: 'Pack' },
  { key: 'billerName',        label: 'Aggregator' },
  { key: 'dspNetwork',        label: 'Network' },
  { key: 'clicks',            label: 'Clicks' },
  { key: 'activation',        label: 'ACT' },
  { key: 'parkToAct',         label: 'P2A' },
  { key: 'activationPending', label: 'PARK' },
  { key: 'churn',             label: 'Dct' },
  { key: 'renewal',           label: 'RENEW' },
  { key: 'actRev',            label: 'Act Rev' },
  { key: 'renewRev',          label: 'Renew Rev' },
  { key: 'totalRevUsd',       label: 'Total Rev USD' },
  { key: 'stp',               label: 'Sent To Pub' },
  { key: 'campCR',            label: 'CR %' },
  { key: 'stpCR',             label: 'STP CR %' },
];


function billingMapKey(operatorId, serviceName, billerName) {
  return `${operatorId ?? ''}__${serviceName || ''}__${billerName || ''}`;
}

function fmtLocalRev(n) {
  return n > 0 ? n.toFixed(2) : null;
}

function fmtUsdRev(localTotal, operatorName) {
  const usd = localToUsd(localTotal, operatorName);
  return usd != null && usd > 0 ? usd.toFixed(2) : null;
}

/** Aggregate billing per operator + service (price points merged). */
function buildBillingMap(apiRows, filters) {
  const map = new Map();

  (apiRows || []).forEach(r => {
    if (!passesBillingFilters(r, filters)) return;

    const key = billingMapKey(r.operatorId, r.serviceName, r.billerName);
    if (!map.has(key)) {
      map.set(key, {
        billerName: r.billerName || null,
        operatorId: r.operatorId ?? null,
        operatorName: r.operatorName || null,
        serviceName: r.serviceName || null,
        activation: 0,
        renewal: 0,
        churn: 0,
        activationPending: 0,
        actRev: 0,
        renewRev: 0,
      });
    }

    const g = map.get(key);
    const price = r.pricePoint || 0;
    const act   = r.activation || 0;
    const ren   = r.renewal    || 0;

    g.activation        += act;
    g.renewal           += ren;
    g.churn             += (r.churn || 0);
    g.activationPending += (r.activationPending || 0);
    g.actRev            += act * price;
    g.renewRev          += ren * price;
  });

  return map;
}

function billingMapToRow(g, dateLabel) {
  const act = g.activation;
  const parking = g.activationPending;
  const totalRev = g.actRev + g.renewRev;
  const { geo, operator } = parseOperatorFields(g.operatorName, g.operatorId);

  return {
    date: dateLabel,
    geo,
    operator,
    service: g.serviceName || null,
    pack: null,
    billerName: g.billerName,
    dspNetwork: null,
    clicks: null,
    activation: act || null,
    stp: null,
    activationPending: parking || null,
    churn: g.churn || null,
    renewal: g.renewal || null,
    parkToAct: parking > 0 && act > 0 ? ((act / parking) * 100).toFixed(2) : null,
    campCR: null,
    stpCR: null,
    actRev: fmtLocalRev(g.actRev),
    renewRev: fmtLocalRev(g.renewRev),
    totalRevUsd: fmtUsdRev(totalRev, g.operatorName),
    _rowKey: `billing-${dateLabel}-${g.billerName}-${g.operatorId}-${g.serviceName}`,
    _billingKey: billingMapKey(g.operatorId, g.serviceName, g.billerName),
  };
}

function applyBillingToRow(row, billing) {
  const act = billing.activation;
  const parking = billing.activationPending;
  const totalRev = billing.actRev + billing.renewRev;
  const clicks = row.clicks || 0;

  row.activation = act || null;
  row.activationPending = parking || null;
  row.churn = billing.churn || null;
  row.renewal = billing.renewal || null;
  row.parkToAct = parking > 0 && act > 0 ? ((act / parking) * 100).toFixed(2) : null;
  row.actRev = fmtLocalRev(billing.actRev);
  row.renewRev = fmtLocalRev(billing.renewRev);
  row.totalRevUsd = fmtUsdRev(totalRev, billing.operatorName);
  row.campCR = calcCR(act, clicks);
  row.stpCR = calcStpCR(row.stp ?? 0, clicks);
}

function trafficRowKey(geo, operator, service, pack, network, agg) {
  return `${geo || ''}__${operator || ''}__${service || ''}__${pack || ''}__${network || ''}__${agg || ''}`;
}

/** Prefer a row with real clicks; billing has no network dimension. */
function pickBillingRow(rows) {
  const withClicks = rows.filter(r => (r.clicks || 0) > 0);
  const pool = withClicks.length ? withClicks : rows;
  return pool.reduce((best, row) => {
    if (!best) return row;
    if ((row.clicks || 0) !== (best.clicks || 0)) {
      return (row.clicks || 0) > (best.clicks || 0) ? row : best;
    }
    return row._conversions > best._conversions ? row : best;
  }, null);
}

/** One row per network; billing from API on the primary traffic row for that service. */
function buildDayRows(day, apiRows, hourlyForDay, filters) {
  const billingMap = buildBillingMap(apiRows, filters);
  const trafficMap = new Map();
  const billingAssigned = new Set();

  (hourlyForDay || []).forEach(c => {
    if (c.type !== 'vas') return;
    const meta = billerFromHourly(c);
    if (!passesTrafficFilters(c, filters)) return;

    const t = totalsFromHourlyData(c.hourlyData);
    if (!t.clicks && !t.stp && !t.conversions) return;

    const { geo, operator } = parseOperatorFields(meta?.operatorName, meta?.operatorId);
    const service = resolveServiceName({ metaService: meta?.serviceName, productName: c.productname });
    const pack = parsePackFromProduct(c.productname);
    const network = c.dspName || '';
    const agg = meta?.billerName || '';

    const key = trafficRowKey(geo, operator, service, pack, network, agg);

    if (!trafficMap.has(key)) {
      trafficMap.set(key, {
        date: day,
        geo,
        operator,
        service,
        pack: pack || null,
        billerName: meta?.billerName || null,
        dspNetwork: network || null,
        clicks: 0,
        stp: 0,
        _conversions: 0,
        _billingKey: billingMapKey(meta?.operatorId, service, meta?.billerName),
        activation: null,
        activationPending: null,
        churn: null,
        renewal: null,
        parkToAct: null,
        actRev: null,
        renewRev: null,
        totalRevUsd: null,
        campCR: null,
        stpCR: null,
        _rowKey: `row-${day}-${key}`,
      });
    }

    const row = trafficMap.get(key);
    row.clicks += t.clicks;
    row.stp += t.stp;
    row._conversions += t.conversions;
  });

  const rows = [...trafficMap.values()];
  const byBillingKey = new Map();

  rows.forEach(row => {
    const bk = row._billingKey;
    if (!byBillingKey.has(bk)) byBillingKey.set(bk, []);
    byBillingKey.get(bk).push(row);
  });

  byBillingKey.forEach((groupRows, bk) => {
    const billing = billingMap.get(bk);
    if (billing) {
      const primary = pickBillingRow(groupRows);
      applyBillingToRow(primary, billing);
      billingAssigned.add(bk);
      groupRows.forEach(row => {
        if (row === primary) return;
        row.campCR = calcCR(0, row.clicks);
        row.stpCR = calcStpCR(row.stp, row.clicks);
      });
    } else {
      groupRows.forEach(row => {
        row.activation = row._conversions || null;
        row.campCR = calcCR(row._conversions, row.clicks);
        row.stpCR = calcStpCR(row.stp, row.clicks);
      });
    }
  });

  rows.forEach(row => {
    row.clicks = row.clicks || null;
    row.stp = row.stp || null;
    delete row._conversions;
    delete row._billingKey;
  });

  billingMap.forEach((billing, bk) => {
    if (!billingAssigned.has(bk)) {
      rows.push(billingMapToRow(billing, day));
    }
  });

  return rows;
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
    const geoCmp = String(a.geo || '').localeCompare(String(b.geo || ''));
    if (geoCmp !== 0) return geoCmp;
    const svcCmp = String(a.service || '').localeCompare(String(b.service || ''));
    if (svcCmp !== 0) return svcCmp;
    const packCmp = String(a.pack || '').localeCompare(String(b.pack || ''));
    if (packCmp !== 0) return packCmp;
    return String(a.dspNetwork || '').localeCompare(String(b.dspNetwork || ''));
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
  if (v == null) return <NullCell />;
  if (col.key === 'date')     return <span className="ct-date">{formatTableDate(v)}</span>;
  if (col.key === 'geo')      return v ? <span className="ct-network">{v}</span> : <NullCell />;
  if (col.key === 'operator') return v ? <span className="ct-network">{v}</span> : <NullCell />;
  if (col.key === 'service')  return v ? <span className="td-primary">{v}</span> : <NullCell />;
  if (col.key === 'pack')     return v ? <span className="td-primary">{v}</span> : <NullCell />;
  if (col.key === 'billerName') return <span className="td-primary">{aggregatorLabel(v)}</span>;
  if (col.key === 'dspNetwork') return v ? <span className="ct-network">{v}</span> : <NullCell />;
  if (col.key === 'clicks')          return <strong>{Number(v).toLocaleString()}</strong>;
  if (col.key === 'activation')      return <strong>{Number(v).toLocaleString()}</strong>;
  if (col.key === 'stp')             return <span className="stp-badge">{Number(v).toLocaleString()}</span>;
  if (col.key === 'actRev' || col.key === 'renewRev' || col.key === 'totalRevUsd')
    return <span className="ct-rev">{v}</span>;
  return typeof v === 'number' ? v.toLocaleString() : v;
}

export default function SummaryReports() {
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

  const dateLabel = formatDateRangeLabel(filters.startDate, filters.endDate);
  const visibleRows = rows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const exportRow = (r) => Object.fromEntries(COLS.map(c => {
    let val = r[c.key];
    if (c.key === 'date' && val) val = formatTableDate(val);
    else if (c.key === 'billerName') val = aggregatorLabel(val);
    else if (EXPORT_NUM_KEYS.has(c.key)) val = excelNum(val);
    else if (c.key === 'campCR' || c.key === 'stpCR' || c.key === 'parkToAct') val = excelNum(val);
    return [c.label, val ?? ''];
  }));

  const exportExcel = () => {
    if (!rows.length) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows.map(exportRow));
    applySheetNumberFormats(ws, XLSX, EXPORT_REV_LABELS, '#,##0.00');
    applySheetNumberFormats(ws, XLSX, EXPORT_COUNT_LABELS, '#,##0');
    applySheetNumberFormats(ws, XLSX, ['CR %', 'STP CR %', 'P2A'], '0.00');
    ws['!cols'] = COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'S2S Report');
    XLSX.writeFile(wb, `summary_${filters.startDate}_${filters.endDate}.xlsx`);
  };

  return (
    <div className="demo-page">
      <SummaryFilterBar onApply={handleApply} onExport={exportExcel} exportDisabled={!rows.length} />
      {error && <div className="error-box">⚠️ {error}</div>}

      <div className="demo-report-bar">
        <div className="demo-report-tabs">
          <span className="demo-report-tab active">S2S Report</span>
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
                {COLS.map(c => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows cols={COLS.length} rows={8} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length}>
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
                    {COLS.map(c => (
                      <td key={c.key}>
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
