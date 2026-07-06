import { useState, useEffect } from 'react';
import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { fetchSummary, fetchHourlyReport } from './api';
import { PricePointFilterBar, DEFAULT_PRICEPOINT_FILTERS } from './FilterPanel';
import { totalsFromHourlyData, billerFromHourly, applySheetNumberFormats } from './utils';
import * as XLSX from 'xlsx';

// Local currency → USD divisor. Adjust the rates if the FX changes.
const CURRENCY_RATES = {
  SD_MTN: { code: 'SDG', usdDivisor: 600 },
  NG_MTN: { code: 'NGN', usdDivisor: 1550 },
};

function currencyFor(operatorName) {
  const key = (operatorName || '').toUpperCase().trim();
  return CURRENCY_RATES[key] || { code: 'Local', usdDivisor: 1 };
}

function getDaysInRange(startDate, endDate) {
  return eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) })
    .map(d => format(d, 'yyyy-MM-dd'))
    .reverse();
}

function matchesFilters(r, f) {
  if (f.operatorId && String(r.operatorId) !== String(f.operatorId)) return false;
  if (f.serviceName && r.serviceName !== f.serviceName) return false;
  return true;
}

/** One day → one row per (operator + service). Pure backend billing data. */
function buildDayGroups(day, apiRows, hourlyForDay, filters) {
  const rows = (apiRows || []).filter(r => matchesFilters(r, filters));
  const ppFilter = filters.pricePoint ? Number(filters.pricePoint) : null;

  const groups = new Map();
  rows.forEach(r => {
    const key = `${r.operatorId ?? ''}__${r.serviceName || ''}`;
    if (!groups.has(key)) {
      groups.set(key, {
        operatorId: r.operatorId ?? null,
        operatorName: r.operatorName || null,
        serviceName: r.serviceName || null,
        list: [],
      });
    }
    groups.get(key).list.push(r);
  });

  const out = [];
  groups.forEach(g => {
    const gaByPp = {};
    const renByPp = {};
    let totalGa = 0, totalRen = 0, gaRev = 0, renRev = 0, parking = 0, churn = 0;

    g.list.forEach(r => {
      const pp  = r.pricePoint || 0;
      const act = r.activation || 0;
      const ren = r.renewal    || 0;

      parking += r.activationPending || 0;

      if (pp <= 0) {
        churn += r.churn || 0;
        return;
      }
      if (ppFilter && pp !== ppFilter) return;

      gaByPp[pp]  = (gaByPp[pp]  || 0) + act;
      renByPp[pp] = (renByPp[pp] || 0) + ren;
      totalGa += act;
      totalRen += ren;
      gaRev  += act * pp;
      renRev += ren * pp;
    });

    let clicks = 0, sendCount = 0;
    (hourlyForDay || []).forEach(c => {
      const meta = billerFromHourly(c);
      if (!meta || String(meta.operatorId) !== String(g.operatorId)) return;
      const t = totalsFromHourlyData(c.hourlyData);
      clicks    += t.clicks;
      sendCount += t.stp;
    });

    const { code, usdDivisor } = currencyFor(g.operatorName);
    const totalLocal = gaRev + renRev;

    out.push({
      date: day,
      operatorId: g.operatorId,
      operatorName: g.operatorName ? `${g.operatorName} (${g.operatorId})` : String(g.operatorId ?? ''),
      serviceName: g.serviceName || '—',
      currencyCode: code,
      clicks,
      sendCount,
      gaByPp,
      renByPp,
      totalGa,
      totalRen,
      gaRev,
      renRev,
      parking,
      churn,
      totalLocal,
      totalUsd: totalLocal / usdDivisor,
      actArpu: totalGa  > 0 ? gaRev  / totalGa  : 0,
      renArpu: totalRen > 0 ? renRev / totalRen : 0,
      _rowKey: `${day}-${g.operatorId}-${g.serviceName}`,
    });
  });

  return out;
}

const fmtInt     = n => (n ? Number(n).toLocaleString() : '');
const fmtIntZero = n => Number(n || 0).toLocaleString();
const fmtMoney   = n => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PricePointReport() {
  const [filters, setFilters]         = useState(DEFAULT_PRICEPOINT_FILTERS);
  const [rows, setRows]               = useState([]);
  const [pricePoints, setPricePoints] = useState([]);
  const [currencyCode, setCurrency]   = useState('Local');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const loadData = (f) => {
    setLoading(true); setError('');
    const days = getDaysInRange(f.startDate, f.endDate);

    fetchHourlyReport(f.startDate, f.endDate)
      .catch(() => [])
      .then(hourlyData =>
        Promise.all(days.map(day => {
          const hourlyForDay = (hourlyData || []).filter(c => c.date === day);
          return fetchSummary({ ...f, startDate: day, endDate: day, page: 1, size: 500 })
            .then(res => buildDayGroups(day, res.data || [], hourlyForDay, f))
            .catch(() => buildDayGroups(day, [], hourlyForDay, f));
        }))
      )
      .then(dayRows => {
        const flat = dayRows.flat();

        let pps;
        if (f.pricePoint) {
          pps = [Number(f.pricePoint)];
        } else {
          const ppSet = new Set();
          flat.forEach(r => {
            Object.keys(r.gaByPp).forEach(pp => ppSet.add(Number(pp)));
            Object.keys(r.renByPp).forEach(pp => ppSet.add(Number(pp)));
          });
          pps = [...ppSet].sort((a, b) => a - b);
        }

        setPricePoints(pps);
        setCurrency(
          flat.find(r => r.currencyCode && r.currencyCode !== 'Local')?.currencyCode
          || flat[0]?.currencyCode
          || 'Local'
        );
        setRows(flat);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(filters); }, []); // eslint-disable-line

  const handleApply = (f) => { setFilters(f); setRows([]); loadData(f); };

  const exportExcel = () => {
    if (!rows.length) return;
    const data = rows.map(r => {
      const o = { Date: r.date, Operator: r.operatorName, Product: r.serviceName, Clicks: r.clicks };
      pricePoints.forEach(pp => { o[`GA ${pp}`] = r.gaByPp[pp] || 0; });
      o['Total GA']   = r.totalGa;
      o['GA Rev']     = r.gaRev || '';
      o['GA Parking'] = r.parking;
      o['Churn']      = r.churn;
      pricePoints.forEach(pp => { o[`Ren ${pp}`] = r.renByPp[pp] || 0; });
      o['Total Ren']                        = r.totalRen;
      o['Ren Revenue']                      = r.renRev || '';
      o[`Total Revenue (${currencyCode})`]  = r.totalLocal || '';
      o['Total Revenue (USD)']              = r.totalUsd || '';
      o['Act ARPU']                         = r.actArpu || '';
      o['Ren ARPU']                         = r.renArpu || '';
      o['Send Count']                       = r.sendCount;
      o['Spent']                            = '';
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    applySheetNumberFormats(ws, XLSX, [
      'GA Rev', 'Ren Revenue', `Total Revenue (${currencyCode})`, 'Total Revenue (USD)',
      'Act ARPU', 'Ren ARPU',
    ], '#,##0.00');
    applySheetNumberFormats(ws, XLSX, [
      'Clicks', 'Total GA', 'GA Parking', 'Churn', 'Total Ren', 'Send Count',
      ...pricePoints.flatMap(pp => [`GA ${pp}`, `Ren ${pp}`]),
    ], '#,##0');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PricePoint Report');
    XLSX.writeFile(wb, `pricepoint_${filters.startDate}_${filters.endDate}.xlsx`);
  };

  const ppCount  = pricePoints.length || 1;
  const colSpan  = 16 + ppCount * 2;
  const ppHeader = pricePoints.length ? pricePoints : ['—'];

  return (
    <div className="demo-page">
      <PricePointFilterBar onApply={handleApply} onExport={exportExcel} exportDisabled={!rows.length} />
      {error && <div className="error-box">⚠️ {error}</div>}

      <div className="demo-table-section">
        {!loading && rows.length > 0 && (
          <div className="demo-table-meta"><span>{rows.length} records</span></div>
        )}

        <div className="demo-table-wrap">
          <table className="demo-table demo-pivot-table">
            <thead>
              <tr className="demo-thead-row pp-row1">
                <th rowSpan={2}>Date</th>
                <th rowSpan={2}>Operator</th>
                <th rowSpan={2}>Product</th>
                <th rowSpan={2}>Clicks</th>
                <th className="pp-group-th" colSpan={ppCount}>GA Count</th>
                <th rowSpan={2}>Total GA</th>
                <th rowSpan={2}>GA Rev</th>
                <th rowSpan={2}>GA Parking</th>
                <th rowSpan={2}>Churn</th>
                <th className="pp-group-th" colSpan={ppCount}>Ren Count</th>
                <th rowSpan={2}>Total Ren</th>
                <th rowSpan={2}>Ren Revenue</th>
                <th rowSpan={2}>Total Revenue ({currencyCode})</th>
                <th rowSpan={2}>Total Revenue (USD)</th>
                <th rowSpan={2}>Act ARPU</th>
                <th rowSpan={2}>Ren ARPU</th>
                <th rowSpan={2}>Send Count</th>
                <th rowSpan={2}>Spent</th>
              </tr>
              <tr className="demo-thead-row pp-row2">
                {ppHeader.map((pp, i) => (
                  <th key={`ga-${pp}-${i}`} className="pp-sub-th">{pp}</th>
                ))}
                {ppHeader.map((pp, i) => (
                  <th key={`ren-${pp}-${i}`} className="pp-sub-th">{pp}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colSpan}>
                  <div className="no-data-inner" style={{ padding: '2.5rem' }}>
                    <div className="no-data-text">Loading…</div>
                  </div>
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={colSpan}>
                  <div className="no-data-inner" style={{ padding: '2.5rem' }}>
                    <div className="no-data-icon">📭</div>
                    <div className="no-data-text">No data found</div>
                    <div className="no-data-sub">No records for the selected filters</div>
                  </div>
                </td></tr>
              ) : (
                rows.map(r => (
                  <tr key={r._rowKey}>
                    <td className="ct-date">{r.date}</td>
                    <td className="ct-network">{r.operatorName}</td>
                    <td className="td-primary">{r.serviceName}</td>
                    <td><strong>{fmtIntZero(r.clicks)}</strong></td>
                    {pricePoints.map(pp => (
                      <td key={`ga-${pp}`}>{fmtInt(r.gaByPp[pp])}</td>
                    ))}
                    <td><strong>{fmtIntZero(r.totalGa)}</strong></td>
                    <td className="ct-rev">{fmtMoney(r.gaRev)}</td>
                    <td>{fmtInt(r.parking)}</td>
                    <td>{fmtIntZero(r.churn)}</td>
                    {pricePoints.map(pp => (
                      <td key={`ren-${pp}`}>{fmtInt(r.renByPp[pp])}</td>
                    ))}
                    <td><strong>{fmtIntZero(r.totalRen)}</strong></td>
                    <td className="ct-rev">{fmtMoney(r.renRev)}</td>
                    <td className="ct-rev">{fmtMoney(r.totalLocal)}</td>
                    <td className="ct-rev">{fmtMoney(r.totalUsd)}</td>
                    <td>{fmtMoney(r.actArpu)}</td>
                    <td>{fmtMoney(r.renArpu)}</td>
                    <td>{fmtInt(r.sendCount)}</td>
                    <td>—</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
