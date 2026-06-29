import { useEffect, useState, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { fetchHourlyReport, updateCut } from './api';
import { HourlyFilterBar, DEFAULT_HOURLY_FILTERS } from './FilterPanel';
import SkeletonRows from './SkeletonRows';
import Pagination from './Pagination';
import {
  parseHourlyData,
  totalsFromHourlyData,
  calcCR,
  calcStpCR,
  HOUR_SLOTS,
  passesTrafficFilters,
} from './utils';
import * as XLSX from 'xlsx';

const CAMPAIGNS_PER_PAGE = 5;
const CUT_OPTIONS = [0, 10, 20, 30];

function filterCampaigns(campaigns, filters) {
  return campaigns.filter(c => passesTrafficFilters(c, filters));
}

function filterGroupedCampaigns(grouped, filters) {
  return grouped
    .map(c => ({
      ...c,
      dates: c.dates.filter(({ date, hourlyData }) =>
        passesTrafficFilters({ ...c, date, hourlyData }, filters)
      ),
    }))
    .filter(c => c.dates.length > 0);
}

function groupCampaigns(campaigns) {
  const map = new Map();
  campaigns.forEach(c => {
    if (!map.has(c.campaignId)) {
      map.set(c.campaignId, { ...c, dates: [{ date: c.date, hourlyData: c.hourlyData || [] }] });
    } else {
      map.get(c.campaignId).dates.push({ date: c.date, hourlyData: c.hourlyData || [] });
    }
  });
  map.forEach(c => c.dates.sort((a, b) => b.date.localeCompare(a.date)));
  return Array.from(map.values());
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

function buildSummaryRows(campaigns) {
  const rows = [];
  campaigns.forEach(c => {
    c.dates.forEach(({ date, hourlyData }) => {
      const totals = totalsFromHourlyData(hourlyData);
      rows.push({
        date: formatTableDate(date),
        campaign: c.productname || '—',
        network: c.dspName || '—',
        campaignId: c.campaignId,
        clicks: totals.clicks,
        conversions: totals.conversions,
        stp: totals.stp,
        cr: calcCR(totals.conversions, totals.clicks),
        stpCr: calcStpCR(totals.stp, totals.clicks),
        _campaign: c,
        _date: date,
        _hourlyData: hourlyData,
      });
    });
  });
  return rows.sort((a, b) => b._date.localeCompare(a._date) || String(a.campaign).localeCompare(String(b.campaign)));
}

function CRBadge({ value }) {
  const n = parseFloat(value);
  const cls = n >= 5 ? 'cr-good' : n >= 1 ? 'cr-mid' : 'cr-low';
  return <span className={`cr-badge ${cls}`}>{value}%</span>;
}

function CutEditor({ campaign }) {
  const [cutVal, setCutVal] = useState(String(campaign.cut ?? '0'));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState('');
  const timerRef = useRef();

  const showFeedback = (type, text) => {
    setStatus(type); setMsg(text);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setStatus(null); setMsg(''); }, 3500);
  };

  const handleChange = async (e) => {
    const val = e.target.value;
    const prev = cutVal;

    if (!window.confirm(`Set CUT to ${val}?`)) {
      e.target.value = prev;
      return;
    }

    setCutVal(val);
    setSaving(true);
    try {
      await updateCut(campaign.campaignId, campaign.links, Number(val));
      showFeedback('success', 'CUT value updated successfully!');
    } catch {
      setCutVal(prev);
      e.target.value = prev;
      showFeedback('error', 'Failed to update CUT');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="demo-cut-editor">
      <span className="demo-cut-label">CUT</span>
      <select className="demo-cut-select" value={cutVal} onChange={handleChange} disabled={saving}>
        {CUT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {status && <span className={`demo-cut-feedback ${status === 'error' ? 'demo-cut-error' : ''}`}>{msg}</span>}
    </div>
  );
}

function HourlyDetailTable({ hourlyData }) {
  const parsed       = parseHourlyData(hourlyData);
  const totals       = totalsFromHourlyData(hourlyData);
  const totalCR      = calcCR(totals.conversions, totals.clicks);
  const totalStpCR   = calcStpCR(totals.stp, totals.clicks);

  return (
    <table className="demo-table demo-table-hourly">
      <thead>
        <tr className="demo-thead-row">
          <th>Metric</th>
          {HOUR_SLOTS.map(h => <th key={h.slot}>{h.slot}</th>)}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="demo-metric-label">Clicks</td>
          {HOUR_SLOTS.map(h => (
            <td key={h.slot}>{parsed.clicks[h.index].toLocaleString()}</td>
          ))}
          <td><strong>{totals.clicks.toLocaleString()}</strong></td>
        </tr>
        <tr>
          <td className="demo-metric-label">Conversions</td>
          {HOUR_SLOTS.map(h => (
            <td key={h.slot}>{parsed.conversions[h.index].toLocaleString()}</td>
          ))}
          <td><strong>{totals.conversions.toLocaleString()}</strong></td>
        </tr>
        <tr>
          <td className="demo-metric-label">Sent To Pub</td>
          {HOUR_SLOTS.map(h => (
            <td key={h.slot}>{parsed.stp[h.index].toLocaleString()}</td>
          ))}
          <td><strong className="stp-badge">{totals.stp.toLocaleString()}</strong></td>
        </tr>
        <tr>
          <td className="demo-metric-label">CR %</td>
          {HOUR_SLOTS.map(h => (
            <td key={h.slot}>
              <CRBadge value={calcCR(parsed.conversions[h.index], parsed.clicks[h.index])} />
            </td>
          ))}
          <td><CRBadge value={totalCR} /></td>
        </tr>
        <tr>
          <td className="demo-metric-label">STP CR %</td>
          {HOUR_SLOTS.map(h => (
            <td key={h.slot}>
              <CRBadge value={calcStpCR(parsed.stp[h.index], parsed.clicks[h.index])} />
            </td>
          ))}
          <td><CRBadge value={totalStpCR} /></td>
        </tr>
      </tbody>
    </table>
  );
}

function CampaignBlock({ row, index }) {
  const c = row._campaign;
  return (
    <div className="demo-campaign-block">
      <div className="demo-campaign-header">
        <div className="demo-campaign-header-left">
          <span className="demo-campaign-index">{index + 1}</span>
          <div>
            <div className="demo-campaign-title">
              {row.campaign} · #{row.campaignId} · {row.network}
            </div>
            <div className="demo-campaign-meta">
              <span>📅 {row.date}</span>
              {c.links && (
                <a href={c.links} target="_blank" rel="noreferrer" className="demo-campaign-link">Campaign Link</a>
              )}
            </div>
          </div>
        </div>
        <div className="demo-campaign-header-right">
          <span>Clicks: <strong>{row.clicks.toLocaleString()}</strong></span>
          <span>Conv: <strong>{row.conversions.toLocaleString()}</strong></span>
          <span>STP: <strong className="stp-badge">{row.stp.toLocaleString()}</strong></span>
          <span>CR %: <CRBadge value={row.cr} /></span>
          <span>STP CR %: <CRBadge value={row.stpCr} /></span>
          <CutEditor campaign={c} />
        </div>
      </div>
      <div className="demo-table-wrap">
        <HourlyDetailTable hourlyData={row._hourlyData} />
      </div>
    </div>
  );
}

export default function HourlyReport({ filters: externalFilters, onCountChange }) {
  const [filters, setFilters] = useState(externalFilters || DEFAULT_HOURLY_FILTERS);
  const [campaigns, setCampaigns] = useState([]);
  const [summaryRows, setSummaryRows] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const standalone = !externalFilters;

  useEffect(() => {
    if (externalFilters) setFilters(externalFilters);
  }, [externalFilters]);

  useEffect(() => {
    if (!filters?.startDate || !filters?.endDate) return;
    setLoading(true); setError('');
    fetchHourlyReport(filters.startDate, filters.endDate)
      .then(data => {
        const filtered = filterCampaigns(data, filters);
        const grouped = filterGroupedCampaigns(groupCampaigns(filtered), filters);
        setCampaigns(grouped);
        setSummaryRows(buildSummaryRows(grouped));
        setPage(1);
        onCountChange?.(filtered.length);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters]);

  const dateLabel = formatDateRangeLabel(filters?.startDate, filters?.endDate);
  const detailRows = summaryRows;
  const visibleDetails = detailRows.slice((page - 1) * CAMPAIGNS_PER_PAGE, page * CAMPAIGNS_PER_PAGE);

  const exportAllExcel = () => {
    if (!summaryRows.length) return;
    const wb = XLSX.utils.book_new();

    const summarySheet = summaryRows.map(r => ({
      Date: r.date,
      Campaign: r.campaign,
      Network: r.network,
      'Campaign ID': r.campaignId,
      Clicks: r.clicks,
      Conversions: r.conversions,
      'Sent To Pub': r.stp,
      'CR %': r.cr,
      'STP CR %': r.stpCr,
    }));
    const wsSummary = XLSX.utils.json_to_sheet(summarySheet);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    summaryRows.forEach((r, i) => {
      const parsed = parseHourlyData(r._hourlyData);
      const tot = totalsFromHourlyData(r._hourlyData);
      const header = ['Metric', ...HOUR_SLOTS.map(h => h.slot), 'Total'];
      const rows = [
        ['Clicks', ...HOUR_SLOTS.map(h => parsed.clicks[h.index]), tot.clicks],
        ['Conversions', ...HOUR_SLOTS.map(h => parsed.conversions[h.index]), tot.conversions],
        ['Sent To Pub', ...HOUR_SLOTS.map(h => parsed.stp[h.index]), tot.stp],
        ['CR %', ...HOUR_SLOTS.map(h => calcCR(parsed.conversions[h.index], parsed.clicks[h.index])), calcCR(tot.conversions, tot.clicks)],
        ['STP CR %', ...HOUR_SLOTS.map(h => calcStpCR(parsed.stp[h.index], parsed.clicks[h.index])), calcStpCR(tot.stp, tot.clicks)],
      ];
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      const sheetName = `C${r.campaignId}_${r.date}`.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName || `Sheet${i + 1}`);
    });

    XLSX.writeFile(wb, `hourly_vas_${filters.startDate}_${filters.endDate}.xlsx`);
  };

  return (
    <div className="demo-page">
      {standalone && (
        <HourlyFilterBar
          onApply={setFilters}
          onExport={exportAllExcel}
          exportDisabled={!summaryRows.length}
        />
      )}
      {error && <div className="error-box">⚠️ {error}</div>}

      <div className="demo-report-bar">
        <div className="demo-report-tabs">
          <button type="button" className="demo-report-tab active">Hourly Report</button>
          <span className="demo-vas-pill">VAS Only</span>
        </div>
        <span className="demo-report-meta">📅 {dateLabel}</span>
      </div>

      {loading ? (
        <div className="demo-table-section">
          <div className="demo-table-wrap">
            <table className="demo-table">
              <tbody><SkeletonRows cols={10} rows={6} /></tbody>
            </table>
          </div>
        </div>
      ) : summaryRows.length === 0 ? (
        <div className="demo-table-section">
          <div className="no-data-inner" style={{ padding: '2.5rem' }}>
            <div className="no-data-icon">📭</div>
            <div className="no-data-text">No VAS campaigns found</div>
            <div className="no-data-sub">Adjust filters and click Submit</div>
          </div>
        </div>
      ) : (
        <div className="demo-hourly-details">
          {!loading && (
            <div className="demo-table-meta" style={{ marginBottom: '.75rem' }}>
              <span>{campaigns.length} campaigns · {summaryRows.length} records</span>
            </div>
          )}
          {visibleDetails.map((row, i) => (
            <CampaignBlock key={`${row.campaignId}-${row._date}`} row={row} index={(page - 1) * CAMPAIGNS_PER_PAGE + i} />
          ))}
          <Pagination
            page={page}
            total={detailRows.length}
            size={CAMPAIGNS_PER_PAGE}
            onChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
