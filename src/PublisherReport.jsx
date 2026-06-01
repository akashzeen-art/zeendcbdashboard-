import { useState, useEffect } from 'react';
import { fetchSummary } from './api';
import { PublisherFilterBar } from './FilterPanel';
import Pagination from './Pagination';
import SkeletonRows from './SkeletonRows';
import * as XLSX from 'xlsx';

const COLS = [
  { key: 'date',       label: 'Date' },
  { key: 'publisher',  label: 'Publisher' },
  { key: 'geo',        label: 'G / O / S' },
  { key: 'sentToPub',  label: 'Send to Pub' },
  { key: 'costUsd',    label: 'Cost in USD' },
];

function enrichRow(r, idx) {
  const price    = r.pricePoint || 0;
  const act      = r.activation || 0;
  const ren      = r.renewal    || 0;
  const totalRev = (act + ren) * price;
  const sentToPub = Math.floor(totalRev * 0.15);
  const costUsd   = sentToPub > 0 ? (sentToPub / 550).toFixed(2) : '0.00';
  return {
    date:      r.serviceName || '—',
    publisher: r.billerName  || '—',
    geo:       r.operatorName ? `${r.operatorName} (${r.operatorId})` : String(r.operatorId || '—'),
    sentToPub: sentToPub > 0 ? sentToPub.toLocaleString() : '—',
    costUsd,
  };
}

export default function PublisherReport() {
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
      .then(res => { setData((res.data || []).map(enrichRow)); setTotal(res.total || 0); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  const exportExcel = () => {
    const rows = data.map(r => Object.fromEntries(COLS.map(c => [c.label, r[c.key] ?? ''])));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = COLS.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Publisher Report');
    XLSX.writeFile(wb, `publisher_${filters?.startDate}_${filters?.endDate}.xlsx`);
  };

  return (
    <div>
      <PublisherFilterBar onApply={setFilters} />
      {error && <div className="error-box">⚠️ {error}</div>}

      <div className="ct-section">
        <div className="ct-header">
          <div className="ct-header-left">
            <div className="ct-header-icon">📢</div>
            <div>
              <h2>Publisher Report</h2>
              <p>Publisher-level send & cost breakdown</p>
            </div>
          </div>
          <div className="ct-header-right">
            {!loading && <span className="record-count">{total} records</span>}
            {!loading && data.length > 0 && <button className="ct-export-btn" onClick={exportExcel}>⬇ Export Excel</button>}
          </div>
        </div>

        <div className="table-wrap">
          <table className="ct-table">
            <thead>
              <tr>{COLS.map(c => <th key={c.key} className="ct-th">{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows cols={COLS.length} rows={8} /> :
               data.length === 0 ? (
                <tr><td colSpan={COLS.length}>
                  <div className="no-data-inner">
                    <div className="no-data-icon">📭</div>
                    <div className="no-data-text">No data found</div>
                    <div className="no-data-sub">Apply filters to load data</div>
                  </div>
                </td></tr>
              ) : data.map((row, i) => (
                <tr key={i}>
                  {COLS.map(c => (
                    <td key={c.key} className="ct-td">
                      {c.key === 'publisher' ? <span className="td-primary">{row[c.key]}</span>
                      : c.key === 'geo'       ? <span className="ct-network">{row[c.key]}</span>
                      : c.key === 'costUsd'   ? <span className="ct-rev">{row[c.key]}</span>
                      : row[c.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} size={SIZE} onChange={setPage} />
      </div>
    </div>
  );
}
