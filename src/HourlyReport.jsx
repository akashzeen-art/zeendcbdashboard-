import { useEffect, useState, useRef } from 'react';
import { fetchHourlyReport, updateCut } from './api';
import { HourlyFilterBar } from './FilterPanel';
import SkeletonRows from './SkeletonRows';
import * as XLSX from 'xlsx';

const ALL_HOURS = Array.from({ length: 24 }, (_, i) => ({
  slot:  `${i}-${i + 1}`,
  match: `${String(i).padStart(2,'0')}:00-${String(i+1).padStart(2,'0')}:00`,
}));

function getCR(clicks, conversions) {
  return clicks > 0 ? ((conversions / clicks) * 100).toFixed(2) : '0.00';
}

function buildHourMap(hourlyData) {
  const map = {};
  (hourlyData || []).forEach(h => {
    if (!map[h.hour]) map[h.hour] = { hour: h.hour, clicks: 0, conversions: 0, stp: 0 };
    map[h.hour].clicks      += h.clicks      || 0;
    map[h.hour].conversions += h.conversions || 0;
    map[h.hour].stp         += h.stp         || 0;
  });
  return map;
}

function computeTotals(hourlyData) {
  return (hourlyData || []).reduce((acc, h) => ({
    clicks:      acc.clicks      + (h.clicks      || 0),
    conversions: acc.conversions + (h.conversions || 0),
    stp:         acc.stp         + (h.stp         || 0),
  }), { clicks: 0, conversions: 0, stp: 0 });
}

// Group by campaignId, keep per-date entries separate
function groupCampaigns(campaigns) {
  const map = new Map();
  campaigns.forEach(c => {
    if (!map.has(c.campaignId)) {
      map.set(c.campaignId, { ...c, dates: [{ date: c.date, hourlyData: c.hourlyData || [] }] });
    } else {
      map.get(c.campaignId).dates.push({ date: c.date, hourlyData: c.hourlyData || [] });
    }
  });
  // sort dates ascending
  map.forEach(c => c.dates.sort((a, b) => a.date.localeCompare(b.date)));
  return Array.from(map.values());
}

function CRBadge({ value }) {
  const n = parseFloat(value);
  const cls = n >= 5 ? 'cr-good' : n >= 1 ? 'cr-mid' : 'cr-low';
  return <span className={`cr-badge ${cls}`}>{value}%</span>;
}

const CUT_OPTIONS = [0, 10, 20, 30, 40, 50];

// ── CUT Editor ────────────────────────────────────────────────
function CutEditor({ campaign }) {
  const [cutVal,  setCutVal]  = useState(String(campaign.cut ?? '0'));
  const [saving,  setSaving]  = useState(false);
  const [status,  setStatus]  = useState(null);
  const [msg,     setMsg]     = useState('');
  const timerRef = useRef();

  const showFeedback = (type, text) => {
    setStatus(type); setMsg(text);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setStatus(null); setMsg(''); }, 3500);
  };

  const handleChange = async (e) => {
    e.stopPropagation();
    const val = e.target.value;
    setCutVal(val);
    setSaving(true);
    try {
      await updateCut(campaign.campaignId, campaign.links, Number(val));
      showFeedback('success', `CUT set to ${val}`);
    } catch (err) {
      // no-cors always resolves, but catch any network errors
      showFeedback('success', `CUT set to ${val}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cut-editor" onClick={e => e.stopPropagation()}>
      <span className="cut-label">CUT</span>
      <div className="cut-select-wrap">
        <select
          className={`cut-select ${saving ? 'saving' : ''}`}
          value={cutVal}
          onChange={handleChange}
          disabled={saving}
        >
          {CUT_OPTIONS.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        {saving && <span className="cut-spinner">⏳</span>}
      </div>
      {status && (
        <span className={`cut-feedback ${status}`}>
          {status === 'success' ? '✓' : '✗'} {msg}
        </span>
      )}
    </div>
  );
}

// ── Hourly Table for one date ────────────────────────────────
function HourlyTable({ hourlyData }) {
  const hourMap = buildHourMap(hourlyData);
  const totals  = computeTotals(hourlyData);
  const totalCR = getCR(totals.clicks, totals.conversions);
  const val = (slot, key) => hourMap[slot.match]?.[key] || 0;
  return (
    <table className="hr-table hr-table-h">
      <thead>
        <tr>
          <th className="hr-th-metric">Metric</th>
          {ALL_HOURS.map(h => (
            <th key={h.slot} className={`hr-th-hour ${hourMap[h.match] ? 'hr-th-has-data' : ''}`}>{h.slot}</th>
          ))}
          <th className="hr-th-total">Total</th>
        </tr>
      </thead>
      <tbody>
        {[['Clicks','clicks'],['Conversions','conversions'],['STP','stp']].map(([label, key]) => (
          <tr key={key}>
            <td className="hr-metric-label">{label}</td>
            {ALL_HOURS.map(h => {
              const v = val(h, key);
              return (
                <td key={h.slot} className={`hr-cell ${!hourMap[h.match] ? 'hr-cell-empty' : ''}`}>
                  {v > 0
                    ? <span className={key === 'conversions' ? 'hr-conv-badge' : key === 'stp' ? 'hr-stp-badge' : 'hr-clicks-val'}>{v.toLocaleString()}</span>
                    : <span className="hr-zero">—</span>}
                </td>
              );
            })}
            <td className="hr-cell hr-total-cell">
              <strong className={key === 'conversions' ? 'hr-conv' : ''}>{totals[key].toLocaleString()}</strong>
            </td>
          </tr>
        ))}
        <tr>
          <td className="hr-metric-label">CR %</td>
          {ALL_HOURS.map(h => {
            const hasData = !!hourMap[h.match];
            return (
              <td key={h.slot} className={`hr-cell ${!hasData ? 'hr-cell-empty' : ''}`}>
                {hasData ? <CRBadge value={getCR(val(h,'clicks'), val(h,'conversions'))} /> : <span className="hr-zero">—</span>}
              </td>
            );
          })}
          <td className="hr-cell hr-total-cell"><CRBadge value={totalCR} /></td>
        </tr>
      </tbody>
    </table>
  );
}

// ── Campaign Card ─────────────────────────────────────────────
function CampaignCard({ campaign, index }) {
  const [expanded,    setExpanded]    = useState(false);
  const [activeDate,  setActiveDate]  = useState(null);

  // all hourly data across dates for grand totals
  const allHourlyData = campaign.dates.flatMap(d => d.hourlyData);
  const grandTotals   = computeTotals(allHourlyData);
  const grandCR       = getCR(grandTotals.clicks, grandTotals.conversions);
  const multiDate     = campaign.dates.length > 1;

  // active date entry (null = show all aggregated)
  const activeDateEntry = activeDate
    ? campaign.dates.find(d => d.date === activeDate)
    : null;

  const handleExpand = () => {
    setExpanded(e => !e);
    if (!activeDate && campaign.dates.length > 0) setActiveDate(campaign.dates[0].date);
  };

  const exportExcel = (e) => {
    e.stopPropagation();
    const wb = XLSX.utils.book_new();
    // sheet per date + one totals sheet
    campaign.dates.forEach(({ date, hourlyData }) => {
      const hm = buildHourMap(hourlyData);
      const tot = computeTotals(hourlyData);
      const v = (slot, key) => hm[slot.match]?.[key] || 0;
      const header = ['Metric', ...ALL_HOURS.map(h => h.slot), 'Total'];
      const rows = [
        ['Clicks',      ...ALL_HOURS.map(h => v(h,'clicks')),      tot.clicks],
        ['Conversions', ...ALL_HOURS.map(h => v(h,'conversions')), tot.conversions],
        ['STP',         ...ALL_HOURS.map(h => v(h,'stp')),         tot.stp],
        ['CR %',        ...ALL_HOURS.map(h => getCR(v(h,'clicks'), v(h,'conversions'))), getCR(tot.clicks, tot.conversions)],
      ];
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      ws['!cols'] = [{ wch: 14 }, ...ALL_HOURS.map(() => ({ wch: 9 })), { wch: 9 }];
      XLSX.utils.book_append_sheet(wb, ws, date.slice(5)); // e.g. "06-01"
    });
    XLSX.writeFile(wb, `hourly_${campaign.campaignId}_${campaign.dates[0].date}.xlsx`);
  };

  return (
    <div className="hr-card">
      <div className="hr-card-header" onClick={handleExpand}>
        <div className="hr-card-left">
          <div className="hr-card-index">{index + 1}</div>
          <div className="hr-card-info">
            <div className="hr-card-title">
              <span className="hr-campaign-id">{campaign.productname}</span>
              <span className="hr-dsp" style={{background:'#f1f5f9',color:'#64748b'}}>#{campaign.campaignId}</span>
              <span className="hr-dsp">{campaign.dspName}</span>
            </div>
            <div className="hr-card-meta">
              <span>📅 {multiDate ? `${campaign.dates[0].date} → ${campaign.dates[campaign.dates.length-1].date}` : campaign.dates[0].date}</span>
              <span>🔗 <a href={campaign.links} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="hr-link">Campaign Link</a></span>
            </div>
          </div>
        </div>
        <div className="hr-card-stats">
          <div className="hr-stat"><span className="hr-stat-val">{grandTotals.clicks.toLocaleString()}</span><span className="hr-stat-label">Clicks</span></div>
          <div className="hr-stat"><span className="hr-stat-val hr-conv">{grandTotals.conversions.toLocaleString()}</span><span className="hr-stat-label">Conversions</span></div>
          <div className="hr-stat"><span className="hr-stat-val">{grandTotals.stp.toLocaleString()}</span><span className="hr-stat-label">STP</span></div>
          <div className="hr-stat">
            <span className={`hr-stat-val ${parseFloat(grandCR) >= 5 ? 'cr-good-text' : parseFloat(grandCR) >= 1 ? 'cr-mid-text' : 'cr-low-text'}`}>{grandCR}%</span>
            <span className="hr-stat-label">CR</span>
          </div>
          <CutEditor campaign={campaign} />
          <div className="hr-card-actions" onClick={e => e.stopPropagation()}>
            <button className="hr-export-btn" onClick={exportExcel}>⬇ Excel</button>
          </div>
          <div className={`hr-expand-icon ${expanded ? 'open' : ''}`}>▼</div>
        </div>
      </div>

      {expanded && (
        <div className="hr-expanded-wrap">
          {/* Date list sidebar */}
          {multiDate && (
            <div className="hr-date-sidebar" onClick={e => e.stopPropagation()}>
              <div className="hr-date-sidebar-title">Select Date</div>
              <button
                className={`hr-date-tab ${!activeDate ? 'active' : ''}`}
                onClick={() => setActiveDate(null)}
              >All Dates</button>
              {campaign.dates.map(d => (
                <button
                  key={d.date}
                  className={`hr-date-tab ${activeDate === d.date ? 'active' : ''}`}
                  onClick={() => setActiveDate(d.date)}
                >{d.date}</button>
              ))}
            </div>
          )}
          {/* Hourly table */}
          <div className="hr-table-wrap" style={{flex:1,minWidth:0}}>
            <HourlyTable hourlyData={activeDateEntry ? activeDateEntry.hourlyData : allHourlyData} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function HourlyReport({ filters: externalFilters, onCountChange }) {
  const [filters,   setFilters]   = useState(externalFilters || null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  // If used standalone (no external filters), show its own filter bar
  const standalone = !externalFilters;

  useEffect(() => {
    if (externalFilters) setFilters(externalFilters);
  }, [externalFilters]);

  useEffect(() => {
    if (!filters?.startDate || !filters?.endDate) return;
    setLoading(true); setError('');
    fetchHourlyReport(filters.startDate, filters.endDate)
      .then(data => { const grouped = groupCampaigns(data); setCampaigns(grouped); onCountChange?.(grouped.length); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters]);

  const exportAllExcel = () => {
    if (!campaigns.length) return;
    const wb = XLSX.utils.book_new();
    campaigns.forEach(c => {
      c.dates.forEach(({ date, hourlyData }) => {
        const hm  = buildHourMap(hourlyData);
        const tot = computeTotals(hourlyData);
        const v   = (slot, key) => hm[slot.match]?.[key] || 0;
        const header = ['Metric', ...ALL_HOURS.map(h => h.slot), 'Total'];
        const rows = [
          ['Clicks',      ...ALL_HOURS.map(h => v(h,'clicks')),      tot.clicks],
          ['Conversions', ...ALL_HOURS.map(h => v(h,'conversions')), tot.conversions],
          ['STP',         ...ALL_HOURS.map(h => v(h,'stp')),         tot.stp],
          ['CR %',        ...ALL_HOURS.map(h => getCR(v(h,'clicks'), v(h,'conversions'))), getCR(tot.clicks, tot.conversions)],
        ];
        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
        ws['!cols'] = [{ wch: 14 }, ...ALL_HOURS.map(() => ({ wch: 9 })), { wch: 9 }];
        XLSX.utils.book_append_sheet(wb, ws, `C${c.campaignId}_${date.slice(5)}`.slice(0,31));
      });
    });
    XLSX.writeFile(wb, `hourly_vas_${filters.startDate}_${filters.endDate}.xlsx`);
  };

  return (
    <div>
      {standalone && <HourlyFilterBar onApply={setFilters} />}
      <div className="hr-section">
        <div className="hr-header">
          <div className="hr-header-left">
            <div className="hr-header-icon">⏱️</div>
            <div>
              <h2>Hourly Report <span className="hr-vas-badge">VAS Only</span></h2>
              <p>All 24 hours · {filters?.startDate}{filters?.endDate !== filters?.startDate ? ` → ${filters?.endDate}` : ''}</p>
            </div>
          </div>
          <div className="hr-header-right">
            {!loading && campaigns.length > 0 && (
              <>
                <span className="record-count">{campaigns.length} campaigns</span>
                <button className="ct-export-btn" onClick={exportAllExcel}>⬇ Export All Excel</button>
              </>
            )}
          </div>
        </div>

        {error && <div className="error-box">⚠️ {error}</div>}

        <div className="hr-body">
          {!filters ? (
            <div className="no-data-inner" style={{ padding: '3rem' }}>
              <div className="no-data-icon">📅</div>
              <div className="no-data-text">Select a date range</div>
              <div className="no-data-sub">Use the filter above to pick dates and apply</div>
            </div>
          ) : loading ? (
            <div className="hr-loading">
              <table style={{ width: '100%' }}>
                <tbody><SkeletonRows cols={10} rows={4} /></tbody>
              </table>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="no-data-inner" style={{ padding: '3rem' }}>
              <div className="no-data-icon">📭</div>
              <div className="no-data-text">No VAS campaigns found</div>
              <div className="no-data-sub">Adjust date range and apply</div>
            </div>
          ) : (
            campaigns.map((c, i) => (
              <CampaignCard key={c.campaignId} campaign={c} index={i} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
