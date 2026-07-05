import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { fetchHourlyReport } from './api';
import { PublisherFilterBar } from './FilterPanel';
import Pagination from './Pagination';
import SkeletonRows from './SkeletonRows';
import NullCell from './NullCell';
import { totalsFromHourlyData, calcCR, calcStpCR, passesTrafficFilters, downloadCsv, excelNum } from './utils';

const ROWS_PER_PAGE = 31;

const COLS = [
  { key: 'date',        label: 'Date' },
  { key: 'campaigns',   label: 'Campaigns' },
  { key: 'clicks',      label: 'Clicks' },
  { key: 'conversions', label: 'Conversions' },
  { key: 'stp',         label: 'Sent To Pub' },
  { key: 'cr',          label: 'CR %' },
  { key: 'stpCr',       label: 'STP CR %' },
];

const today = new Date().toISOString().split('T')[0];

const DEFAULT_FILTERS = {
  startDate: today,
  endDate: today,
  operatorId: '',
  serviceName: '',
};

function toHourlyFilters(f) {
  return {
    startDate: f.startDate,
    endDate: f.endDate,
    operatorId: f.operatorId || '',
    serviceName: f.serviceName || '',
    dspNetwork: '',
    billerName: '',
    campaignName: '',
  };
}

/** One row per day — sum of all VAS hourly campaigns for that date. */
function buildDailySummary(campaigns, filters) {
  const byDay = new Map();

  (campaigns || []).forEach(c => {
    if (!passesTrafficFilters(c, filters)) return;
    const day = c.date;
    if (!day) return;

    const t = totalsFromHourlyData(c.hourlyData || []);
    if (!byDay.has(day)) {
      byDay.set(day, { date: day, campaigns: 0, clicks: 0, conversions: 0, stp: 0 });
    }
    const row = byDay.get(day);
    row.campaigns += 1;
    row.clicks += t.clicks;
    row.conversions += t.conversions;
    row.stp += t.stp;
  });

  return [...byDay.values()]
    .map(r => ({
      date: r.date,
      campaigns: r.campaigns,
      clicks: r.clicks,
      conversions: r.conversions,
      stp: r.stp,
      cr: calcCR(r.conversions, r.clicks),
      stpCr: calcStpCR(r.stp, r.clicks),
      _rowKey: r.date,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
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

function CRBadge({ value }) {
  const n = parseFloat(value);
  const cls = n >= 5 ? 'cr-good' : n >= 1 ? 'cr-mid' : 'cr-low';
  return <span className={`cr-badge ${cls}`}>{value}%</span>;
}

function Cell({ col, row }) {
  const v = row[col.key];
  if (col.key === 'cr' || col.key === 'stpCr') return <CRBadge value={v} />;
  if (v == null) return <NullCell />;
  if (col.key === 'date') return <span className="ct-date">{formatTableDate(v)}</span>;
  if (col.key === 'clicks' || col.key === 'conversions') return <strong>{Number(v).toLocaleString()}</strong>;
  if (col.key === 'stp') return <span className="stp-badge">{Number(v).toLocaleString()}</span>;
  return typeof v === 'number' ? v.toLocaleString() : v;
}

export default function PublisherReport() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadData = (f) => {
    if (!f.startDate || !f.endDate) return;
    setLoading(true);
    setError('');

    fetchHourlyReport(f.startDate, f.endDate)
      .then(data => setRows(buildDailySummary(data, toHourlyFilters(f))))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(filters); }, []); // eslint-disable-line

  const handleApply = (f) => { setFilters(f); setPage(1); setRows([]); loadData(f); };

  const dateLabel = formatDateRangeLabel(filters.startDate, filters.endDate);
  const visibleRows = rows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const rangeTotals = rows.reduce(
    (acc, r) => ({
      campaigns: acc.campaigns + r.campaigns,
      clicks: acc.clicks + r.clicks,
      conversions: acc.conversions + r.conversions,
      stp: acc.stp + r.stp,
    }),
    { campaigns: 0, clicks: 0, conversions: 0, stp: 0 }
  );

  const exportCsv = () => {
    if (!rows.length) return;
    const headers = COLS.map(c => c.label);
    const dataRows = rows.map(r => COLS.map(c => {
      let val = r[c.key];
      if (c.key === 'date' && val) val = formatTableDate(val);
      else if (['clicks', 'conversions', 'stp', 'campaigns'].includes(c.key)) val = excelNum(val);
      else if (c.key === 'cr' || c.key === 'stpCr') val = excelNum(val);
      return val ?? '';
    }));
    downloadCsv(`publisher_daily_${filters.startDate}_${filters.endDate}.csv`, headers, dataRows);
  };

  return (
    <div className="demo-page">
      <PublisherFilterBar onApply={handleApply} />
      {error && <div className="error-box">⚠️ {error}</div>}

      <div className="demo-report-bar">
        <div className="demo-report-tabs">
          <span className="demo-report-tab active">Publisher Report</span>
          <span className="demo-vas-pill">Daily totals · Hourly API</span>
        </div>
        <span className="demo-report-meta">📅 {dateLabel}</span>
      </div>

      <div className="demo-table-section">
        {!loading && rows.length > 0 && (
          <div className="demo-table-meta">
            <span>
              {rows.length} days · {rangeTotals.campaigns} campaign records ·{' '}
              {rangeTotals.clicks.toLocaleString()} clicks ·{' '}
              {rangeTotals.conversions.toLocaleString()} conv ·{' '}
              {rangeTotals.stp.toLocaleString()} STP
            </span>
            <button type="button" className="demo-btn demo-btn-primary" onClick={exportCsv}>
              Csv Download
            </button>
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
                <SkeletonRows cols={COLS.length} rows={6} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length}>
                    <div className="no-data-inner" style={{ padding: '2.5rem' }}>
                      <div className="no-data-icon">📭</div>
                      <div className="no-data-text">No hourly data found</div>
                      <div className="no-data-sub">No VAS campaigns for {dateLabel}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleRows.map(row => (
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

        <Pagination page={page} total={rows.length} size={ROWS_PER_PAGE} onChange={setPage} />
      </div>
    </div>
  );
}
