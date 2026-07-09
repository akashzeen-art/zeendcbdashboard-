import { useState, useEffect } from 'react';
import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { fetchAllSummary, fetchAllSummaryDetails } from './api';
import { SummaryFilterBar, DEFAULT_SUMMARY_FILTERS } from './FilterPanel';
import Pagination from './Pagination';
import SkeletonRows from './SkeletonRows';
import NullCell from './NullCell';
import {
  localToUsd,
  excelNum,
  downloadCsv,
  passesSummaryFilters,
  billingGroupsForCampaign,
  summaryParking,
} from './utils';

const ROWS_PER_PAGE = 50;

const COUNT_KEYS = new Set([
  'activation', 'churn', 'renewal',
]);

const EXPORT_NUM_KEYS = new Set([
  'pricePoint', 'activation', 'parking', 'churn', 'renewal',
  'actRev', 'renewRev', 'totalRev', 'totalRevUsd',
]);

/** Columns aligned with GET /dashboard/summary API fields. */
const COLS = [
  { key: 'date',              label: 'Date' },
  { key: 'serviceName',       label: 'Service' },
  { key: 'billerName',        label: 'Aggregator' },
  { key: 'operatorName',      label: 'Operator' },
  { key: 'operatorId',        label: 'Operator ID' },
  { key: 'pricePoint',        label: 'Price Point' },
  { key: 'activation',        label: 'ACT' },
  { key: 'parking',           label: 'PARK' },
  { key: 'churn',             label: 'Dct' },
  { key: 'renewal',           label: 'RENEW' },
  { key: 'actRev',            label: 'Act Rev' },
  { key: 'renewRev',          label: 'Renew Rev' },
  { key: 'totalRev',          label: 'Total Rev' },
  { key: 'totalRevUsd',       label: 'Total Rev USD' },
];

/** Preserve API zero; only null/undefined → empty cell. */
function apiNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtLocalRev(n) {
  return n > 0 ? n.toFixed(2) : null;
}

function fmtUsdRev(localTotal, operatorName) {
  const usd = localToUsd(localTotal, operatorName);
  return usd != null && usd > 0 ? usd.toFixed(2) : null;
}

/** Map one API record — no derived parking or adjusted counts. */
function mapSummaryRow(r, day) {
  const price = apiNum(r.pricePoint) ?? 0;
  const act = apiNum(r.activation) ?? 0;
  const ren = apiNum(r.renewal) ?? 0;
  const actRev = act * price;
  const renewRev = ren * price;
  const totalRev = actRev + renewRev;

  return {
    date: day,
    serviceName: r.serviceName ?? null,
    billerName: r.billerName ?? null,
    operatorName: r.operatorName ?? null,
    operatorId: apiNum(r.operatorId),
    pricePoint: apiNum(r.pricePoint),
    activation: apiNum(r.activation),
    parking: summaryParking(r),
    churn: apiNum(r.churn),
    renewal: apiNum(r.renewal),
    actRev: fmtLocalRev(actRev),
    renewRev: fmtLocalRev(renewRev),
    totalRev: fmtLocalRev(totalRev),
    totalRevUsd: fmtUsdRev(totalRev, r.operatorName),
    _rowKey: `${day}-${r.billerName}-${r.operatorId}-${r.serviceName}-${r.pricePoint}`,
  };
}

function getDaysInRange(startDate, endDate) {
  return eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  }).map(d => format(d, 'yyyy-MM-dd'));
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
    const svcCmp = String(a.serviceName || '').localeCompare(String(b.serviceName || ''));
    if (svcCmp !== 0) return svcCmp;
    const aggCmp = String(a.billerName || '').localeCompare(String(b.billerName || ''));
    if (aggCmp !== 0) return aggCmp;
    const opCmp = String(a.operatorId ?? '').localeCompare(String(b.operatorId ?? ''));
    if (opCmp !== 0) return opCmp;
    const aPrice = a.pricePoint ?? -1;
    const bPrice = b.pricePoint ?? -1;
    return bPrice - aPrice;
  });
}

function Cell({ col, row }) {
  const v = row[col.key];

  if (col.key === 'parking') {
    if (v == null || v === 0) return <NullCell />;
    return Number(v).toLocaleString();
  }

  if (v == null) return <NullCell />;
  if (col.key === 'date') return <span className="ct-date">{formatTableDate(v)}</span>;
  if (col.key === 'serviceName') return <span className="td-primary">{v}</span>;
  if (col.key === 'billerName') return <span className="td-primary">{aggregatorLabel(v)}</span>;
  if (col.key === 'operatorName') return <span className="ct-network">{v}</span>;
  if (col.key === 'operatorId') return <span className="td-mono">{v}</span>;
  if (col.key === 'pricePoint') return <span className="td-amount">{Number(v).toLocaleString()}</span>;
  if (COUNT_KEYS.has(col.key)) return Number(v).toLocaleString();
  if (col.key === 'actRev' || col.key === 'renewRev' || col.key === 'totalRev' || col.key === 'totalRevUsd')
    return <span className="ct-rev">{v}</span>;
  return typeof v === 'number' ? v.toLocaleString() : v;
}

function summaryApiParams(filters, day) {
  return {
    startDate: day,
    endDate: day,
    ...(filters.billerName && { billerName: filters.billerName }),
    ...(filters.operatorId && { operatorId: filters.operatorId }),
    ...(filters.serviceName && { serviceName: filters.serviceName }),
  };
}

function detailsApiParams(filters) {
  return {
    startDate: filters.startDate,
    endDate: filters.endDate,
    ...(filters.billerName && { billerName: filters.billerName }),
    ...(filters.operatorId && { operatorId: filters.operatorId }),
    ...(filters.serviceName && { serviceName: filters.serviceName }),
  };
}

async function fetchSummaryForRange(filters) {
  const { startDate, endDate } = filters;
  const days = getDaysInRange(startDate, endDate);
  const needsDetails = Boolean(filters.campaignName);

  const [dayRows, details] = await Promise.all([
    Promise.all(days.map(async (day) => {
      try {
        const { data } = await fetchAllSummary(summaryApiParams(filters, day));
        return (data || []).map(r => mapSummaryRow(r, day));
      } catch {
        return [];
      }
    })),
    needsDetails
      ? fetchAllSummaryDetails(startDate, endDate, detailsApiParams(filters)).catch(() => [])
      : Promise.resolve([]),
  ]);

  const campaignGroups = filters.campaignName
    ? billingGroupsForCampaign(details || [], filters.campaignName)
    : null;

  return dayRows
    .flat()
    .filter(r => passesSummaryFilters(r, filters, campaignGroups));
}

export default function SummaryReports() {
  const [filters, setFilters] = useState(DEFAULT_SUMMARY_FILTERS);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadData = (f) => {
    if (!f.startDate || !f.endDate) return;
    setLoading(true);
    setError('');

    fetchSummaryForRange(f)
      .then(data => setRows(sortRows(data)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(filters); }, []); // eslint-disable-line

  const handleApply = (f) => { setFilters(f); setPage(1); setRows([]); loadData(f); };
  const handlePageChange = (p) => setPage(p);

  const dateLabel = formatDateRangeLabel(filters.startDate, filters.endDate);
  const visibleRows = rows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const exportCsv = () => {
    if (!rows.length) return;
    const headers = COLS.map(c => c.label);
    const dataRows = rows.map(r => COLS.map(c => {
      let val = r[c.key];
      if (c.key === 'date' && val) val = formatTableDate(val);
      else if (c.key === 'billerName') val = aggregatorLabel(val);
      else if (EXPORT_NUM_KEYS.has(c.key)) val = excelNum(val);
      return val ?? '';
    }));
    downloadCsv(`summary_${filters.startDate}_${filters.endDate}.csv`, headers, dataRows);
  };

  return (
    <div className="demo-page">
      <SummaryFilterBar
        onApply={handleApply}
        onExport={exportCsv}
        exportDisabled={loading || !rows.length}
      />
      {error && <div className="error-box">⚠️ {error}</div>}

      <div className="demo-report-bar">
        <div className="demo-report-tabs">
          <span className="demo-report-tab active">Summary Report</span>
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
                      <div className="no-data-sub">No summary records for {dateLabel}</div>
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
