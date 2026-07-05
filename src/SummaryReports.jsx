import { useState, useEffect } from 'react';
import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { fetchSummary, fetchAllSummaryDetails } from './api';
import { SummaryFilterBar, DEFAULT_SUMMARY_FILTERS } from './FilterPanel';
import Pagination from './Pagination';
import SkeletonRows from './SkeletonRows';
import NullCell from './NullCell';
import {
  parseOperatorFields,
  localToUsd,
  excelNum,
  downloadCsv,
  billingGroupKey,
  groupParkingFromDetails,
  groupChurnFromDetails,
  passesSummaryFilters,
  billingGroupsForCampaign,
} from './utils';

const ROWS_PER_PAGE = 50;

const COUNT_KEYS = new Set([
  'activation', 'activationPending', 'churn', 'renewal',
]);

const EXPORT_NUM_KEYS = new Set([
  'pricePoint', 'activation', 'activationPending', 'churn', 'renewal',
  'actRev', 'renewRev', 'totalRev', 'totalRevUsd',
]);

/** Raw API fields + revenue derived from activation/renewal × pricePoint. */
const COLS = [
  { key: 'date',              label: 'Date' },
  { key: 'serviceName',       label: 'Service' },
  { key: 'billerName',        label: 'Aggregator' },
  { key: 'operatorName',      label: 'Operator' },
  { key: 'operatorId',        label: 'Operator ID' },
  { key: 'pricePoint',        label: 'Price Point' },
  { key: 'activation',        label: 'ACT' },
  { key: 'activationPending', label: 'PARK' },
  // { key: 'parkToAct',         label: 'P2A (Parking→Act )' },
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

function mapSummaryRow(r, dateLabel) {
  const act = apiNum(r.activation) ?? 0;
  const ren = apiNum(r.renewal) ?? 0;
  const park = apiNum(r.activationPending) ?? 0;
  const churn = apiNum(r.churn) ?? 0;
  const price = apiNum(r.pricePoint) ?? 0;
  const actRev = act * price;
  const renewRev = ren * price;
  const totalRev = actRev + renewRev;
  const isParkingBucket = price <= 0;

  return {
    date: dateLabel,
    serviceName: r.serviceName ?? null,
    billerName: r.billerName ?? null,
    operatorName: r.operatorName ?? null,
    operatorId: apiNum(r.operatorId),
    pricePoint: isParkingBucket ? null : price,
    activation: apiNum(r.activation),
    activationPending: apiNum(r.activationPending),
    churn: apiNum(r.churn),
    renewal: apiNum(r.renewal),
    parkToAct: park > 0 && act > 0 ? ((act / park) * 100).toFixed(2) : null, // ACT ÷ PARK × 100
    actRev: fmtLocalRev(actRev),
    renewRev: fmtLocalRev(renewRev),
    totalRev: fmtLocalRev(totalRev),
    totalRevUsd: fmtUsdRev(totalRev, r.operatorName),
    _isParkingBucket: isParkingBucket,
    _rowKey: `${dateLabel}-${r.billerName}-${r.operatorId}-${r.serviceName}-${r.pricePoint}`,
  };
}

function buildDayRows(day, apiRows, detailRows) {
  const rows = (apiRows || []).map(r => mapSummaryRow(r, day));
  const parkingMap = groupParkingFromDetails(detailRows);
  const churnMap = groupChurnFromDetails(detailRows);

  const groupMeta = new Map();
  (apiRows || []).forEach(r => {
    groupMeta.set(billingGroupKey(r.billerName, r.operatorId, r.serviceName), r);
  });

  const summaryParkByGroup = new Map();
  rows.forEach(row => {
    const key = billingGroupKey(row.billerName, row.operatorId, row.serviceName);
    summaryParkByGroup.set(key, (summaryParkByGroup.get(key) || 0) + (row.activationPending ?? 0));
  });

  parkingMap.forEach((detailPark, key) => {
    if (!detailPark) return;
    const summaryPark = summaryParkByGroup.get(key) || 0;
    const bucketRow = rows.find(r =>
      r._isParkingBucket && billingGroupKey(r.billerName, r.operatorId, r.serviceName) === key
    );

    if (bucketRow) {
      if (summaryPark === 0) bucketRow.activationPending = detailPark;
      if (!bucketRow.churn && churnMap.get(key)) bucketRow.churn = churnMap.get(key);
      return;
    }

    if (summaryPark > 0) return;

    const sample = groupMeta.get(key);
    if (!sample) return;

    rows.push(mapSummaryRow({
      serviceName: sample.serviceName,
      billerName: sample.billerName,
      operatorName: sample.operatorName,
      operatorId: sample.operatorId,
      activation: 0,
      renewal: 0,
      churn: churnMap.get(key) || 0,
      activationPending: detailPark,
      pricePoint: 0,
    }, day));
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

function operatorExportLabel(operatorName, operatorId) {
  const { geo, operator } = parseOperatorFields(operatorName, operatorId);
  if (geo && operator) return `${geo} · ${operator}`;
  return operatorName || operator || '';
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    const svcCmp = String(a.serviceName || '').localeCompare(String(b.serviceName || ''));
    if (svcCmp !== 0) return svcCmp;
    const aggCmp = String(a.billerName || '').localeCompare(String(b.billerName || ''));
    if (aggCmp !== 0) return aggCmp;
    const aPrice = a.pricePoint ?? -1;
    const bPrice = b.pricePoint ?? -1;
    return bPrice - aPrice;
  });
}

function Cell({ col, row }) {
  const v = row[col.key];
  if (v == null) return <NullCell />;
  if (col.key === 'date') return <span className="ct-date">{formatTableDate(v)}</span>;
  if (col.key === 'serviceName') return <span className="td-primary">{v}</span>;
  if (col.key === 'billerName') return <span className="td-primary">{aggregatorLabel(v)}</span>;
  if (col.key === 'operatorName') {
    const { geo, operator } = parseOperatorFields(v, row.operatorId);
    const label = geo && operator ? `${geo} · ${operator}` : (v || operator);
    return label ? <span className="ct-network">{label}</span> : <NullCell />;
  }
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
    page: 1,
    size: 500,
    ...(filters.billerName && { billerName: filters.billerName }),
    ...(filters.operatorId && { operatorId: filters.operatorId }),
    ...(filters.serviceName && { serviceName: filters.serviceName }),
  };
}

async function fetchSummaryForRange(filters) {
  const { startDate, endDate } = filters;

  async function loadDay(day) {
    try {
      const apiParams = summaryApiParams(filters, day);
      const [summaryRes, details] = await Promise.all([
        fetchSummary(apiParams),
        fetchAllSummaryDetails(day, day, {
          ...(filters.billerName && { billerName: filters.billerName }),
          ...(filters.operatorId && { operatorId: filters.operatorId }),
          ...(filters.serviceName && { serviceName: filters.serviceName }),
        }).catch(() => []),
      ]);
      const campaignGroups = filters.campaignName
        ? billingGroupsForCampaign(details || [], filters.campaignName)
        : null;
      const rows = buildDayRows(day, summaryRes.data || [], details || []);
      return rows.filter(r => passesSummaryFilters(r, filters, campaignGroups));
    } catch {
      return [];
    }
  }

  if (startDate === endDate) return loadDay(startDate);

  const days = getDaysInRange(startDate, endDate);
  const chunks = await Promise.all(days.map(loadDay));
  return chunks.flat();
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
      else if (c.key === 'operatorName') val = operatorExportLabel(val, r.operatorId);
      else if (EXPORT_NUM_KEYS.has(c.key) || c.key === 'parkToAct') {
        val = excelNum(val);
      }
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
