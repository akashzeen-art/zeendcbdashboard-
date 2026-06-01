import { useState, useEffect } from 'react';
import { fetchSummary } from './api';
import { SummaryFilterBar } from './FilterPanel';
import Pagination from './Pagination';
import SkeletonRows from './SkeletonRows';
import NullCell from './NullCell';
import * as XLSX from 'xlsx';

// Fields available from summary API:
// serviceName, operatorName, operatorId, billerName,
// activation, renewal, churn, activationPending, pricePoint

const S2S_COLS = [
  { key: 'serviceName',        label: 'Service / Product' },
  { key: 'billerName',         label: 'Biller' },
  { key: 'operatorName',       label: 'G / O / S' },
  { key: 'activation',         label: 'Activations' },
  { key: 'activationPending',  label: 'Parking' },
  { key: 'churn',              label: 'Deactivation' },
  { key: 'renewal',            label: 'Renewals' },
  { key: 'campCR',             label: 'Camp CR' },
  { key: 'actRev',             label: 'Activation Rev' },
  { key: 'renewRev',           label: 'Renewal Rev' },
  { key: 'totalRevUsd',        label: 'Total Rev USD' },
];

const API_COLS = [
  { key: 'serviceName',        label: 'Service / Product' },
  { key: 'billerName',         label: 'Biller' },
  { key: 'operatorName',       label: 'G / O / S' },
  { key: 'activation',         label: 'Activations' },
  { key: 'activationPending',  label: 'Parking' },
  { key: 'churn',              label: 'Deactivation' },
  { key: 'renewal',            label: 'Renewals' },
  { key: 'campCR',             label: 'Camp CR' },
  { key: 'pubCR',              label: 'Pub CR' },
  { key: 'actRev',             label: 'Activation Rev' },
  { key: 'renewRev',           label: 'Renewal Rev' },
  { key: 'totalRevUsd',        label: 'Total Rev USD' },
];

// Only compute fields that are mathematically derived from real API values
function mapRow(r) {
  const price    = r.pricePoint  || 0;
  const act      = r.activation  || 0;
  const ren      = r.renewal     || 0;
  const actRev   = act * price;
  const renewRev = ren * price;
  const totalRev = actRev + renewRev;
  const total    = act + ren + (r.churn || 0);
  const campCR   = total > 0 ? ((act / total) * 100).toFixed(2) + '%' : '—';
  const pubCR    = total > 0 ? ((ren / total) * 100).toFixed(2) + '%' : '—';

  return {
    serviceName:       r.serviceName       || null,
    billerName:        r.billerName        || null,
    operatorName:      r.operatorName      ? `${r.operatorName} (${r.operatorId})` : null,
    activation:        r.activation        ?? null,
    renewal:           r.renewal           ?? null,
    churn:             r.churn             ?? null,
    activationPending: r.activationPending ?? null,
    campCR:            total > 0 ? ((act / total) * 100).toFixed(2) + '%' : null,
    pubCR:             total > 0 ? ((ren / total) * 100).toFixed(2) + '%' : null,
    actRev:      actRev    > 0 ? actRev.toLocaleString()    : null,
    renewRev:    renewRev  > 0 ? renewRev.toLocaleString()  : null,
    totalRevUsd: totalRev  > 0 ? (totalRev / 550).toFixed(2) : null,
  };
}

function CRCell({ v }) {
  if (!v || v === null) return <NullCell />;
  const n = parseFloat(v);
  const cls = n >= 10 ? 'cr-good' : n >= 3 ? 'cr-mid' : 'cr-low';
  return <span className={`cr-badge ${cls}`}>{v}</span>;
}

function ReportTable({ cols, data, loading, total, page, onPageChange, onExport, title, dateRange }) {
  return (
    <div className="ct-section">
      <div className="ct-header">
        <div className="ct-header-left">
          <div className="ct-header-icon">📋</div>
          <div>
            <h2>{title}</h2>
            <p>{dateRange || 'Apply filters to load data'}</p>
          </div>
        </div>
        <div className="ct-header-right">
          {!loading && total > 0 && <span className="record-count">{total} records</span>}
          {!loading && data.length > 0 && <button className="ct-export-btn" onClick={onExport}>⬇ Export Excel</button>}
        </div>
      </div>
      <div className="table-wrap">
        <table className="ct-table">
          <thead>
            <tr>{cols.map(c => <th key={c.key} className="ct-th">{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows cols={cols.length} rows={8} /> :
             data.length === 0 ? (
              <tr><td colSpan={cols.length}>
                <div className="no-data-inner">
                  <div className="no-data-icon">📭</div>
                  <div className="no-data-text">No data found</div>
                  <div className="no-data-sub">Apply filters to load data</div>
                </div>
              </td></tr>
            ) : data.map((row, i) => (
              <tr key={i}>
                {cols.map(c => (
                  <td key={c.key} className="ct-td">
                    {c.key === 'campCR' || c.key === 'pubCR'
                      ? <CRCell v={row[c.key]} />
                      : c.key === 'actRev' || c.key === 'renewRev' || c.key === 'totalRevUsd'
                      ? (row[c.key] != null ? <span className="ct-rev">{row[c.key]}</span> : <NullCell />)
                      : c.key === 'billerName' || c.key === 'serviceName'
                      ? (row[c.key] != null ? <span className="td-primary">{row[c.key]}</span> : <NullCell />)
                      : c.key === 'operatorName'
                      ? (row[c.key] != null ? <span className="ct-network">{row[c.key]}</span> : <NullCell />)
                      : row[c.key] != null
                      ? (typeof row[c.key] === 'number' ? row[c.key].toLocaleString() : row[c.key])
                      : <NullCell />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} size={15} onChange={onPageChange} />
    </div>
  );
}

export default function SummaryReports() {
  const [subTab,  setSubTab]  = useState('s2s');
  const [filters, setFilters] = useState(null);
  const [data,    setData]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const SIZE = 15;

  useEffect(() => { setPage(1); }, [filters]);

  useEffect(() => {
    if (!filters) return;
    setLoading(true); setError('');
    fetchSummary({ ...filters, page, size: SIZE })
      .then(res => { setData((res.data || []).map(mapRow)); setTotal(res.total || 0); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  const cols = subTab === 's2s' ? S2S_COLS : API_COLS;

  const exportExcel = () => {
    if (!data.length) return;
    const rows = data.map(r => Object.fromEntries(cols.map(c => [c.label, r[c.key] ?? ''])));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = cols.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, subTab === 's2s' ? 'S2S Report' : 'API Report');
    XLSX.writeFile(wb, `summary_${subTab}_${filters?.startDate}_${filters?.endDate}.xlsx`);
  };

  return (
    <div>
      <SummaryFilterBar onApply={setFilters} />
      {error && <div className="error-box">⚠️ {error}</div>}

      <div className="sub-tabs-bar">
        <div className="sub-tabs">
          <button className={`sub-tab ${subTab === 's2s' ? 'active' : ''}`} onClick={() => setSubTab('s2s')}>S2S Report</button>
          <button className={`sub-tab ${subTab === 'api' ? 'active' : ''}`} onClick={() => setSubTab('api')}>API Report</button>
        </div>
        {filters && <span className="table-meta">📅 {filters.startDate} → {filters.endDate}</span>}
      </div>

      <ReportTable
        cols={cols} data={data} loading={loading} total={total}
        page={page} onPageChange={setPage} onExport={exportExcel}
        title={subTab === 's2s' ? 'S2S Summary Report' : 'API Summary Report'}
        dateRange={filters ? `${filters.startDate} → ${filters.endDate}` : null}
      />
    </div>
  );
}
