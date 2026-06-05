import { useState, useEffect, useCallback } from 'react';
import { fetchSummary } from './api';
import { PublisherFilterBar } from './FilterPanel';
import Pagination from './Pagination';
import SkeletonRows from './SkeletonRows';
import NullCell from './NullCell';
import * as XLSX from 'xlsx';

const COLS = [
  { key: 'billerName',   label: 'Publisher / Biller' },
  { key: 'serviceName',  label: 'Service / Product' },
  { key: 'operatorName', label: 'G / O / S' },
  { key: 'operatorId',   label: 'Operator ID' },
  { key: 'activation',   label: 'Activations' },
  { key: 'renewal',      label: 'Renewals' },
  { key: 'totalRev',     label: 'Total Revenue' },
  { key: 'totalRevUsd',  label: 'Cost in USD' },
];

// Aggregate rows by billerName + operatorId
function aggregateRows(apiRows) {
  const map = new Map();
  apiRows.forEach(r => {
    const key = `${r.billerName}__${r.operatorId}`;
    if (!map.has(key)) {
      map.set(key, {
        billerName:   r.billerName   || null,
        serviceName:  r.serviceName  || null,
        operatorName: r.operatorName || null,
        operatorId:   r.operatorId   || null,
        activation:   0,
        renewal:      0,
        totalRevRaw:  0,
      });
    }
    const row   = map.get(key);
    const price = r.pricePoint || 0;
    row.activation  += (r.activation || 0);
    row.renewal     += (r.renewal    || 0);
    row.totalRevRaw += ((r.activation || 0) + (r.renewal || 0)) * price;
  });

  return Array.from(map.values()).map(row => ({
    billerName:   row.billerName,
    serviceName:  row.serviceName,
    operatorName: row.operatorName,
    operatorId:   row.operatorId,
    activation:   row.activation  || null,
    renewal:      row.renewal     || null,
    totalRev:     row.totalRevRaw > 0 ? row.totalRevRaw.toLocaleString()   : null,
    totalRevUsd:  row.totalRevRaw > 0 ? row.totalRevRaw.toFixed(2) : null,
  }));
}


export default function PublisherReport() {
  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState({ startDate: today, endDate: today, operatorId: '', serviceName: '' });
  const [data,    setData]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const SIZE = 15;

  const loadData = useCallback((f, p) => {
    setLoading(true); setError('');
    fetchSummary({ ...f, page: p, size: SIZE })
      .then(res => { setData(aggregateRows(res.data || [])); setTotal(res.total || 0); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(filters, 1); }, []); // eslint-disable-line

  const handleApply = (f) => { setFilters(f); setPage(1); setData([]); loadData(f, 1); };
  const handlePageChange = (p) => { setPage(p); loadData(filters, p); };

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
      <PublisherFilterBar onApply={handleApply} />
      {error && <div className="error-box">⚠️ {error}</div>}

      <div className="ct-section">
        <div className="ct-header">
          <div className="ct-header-left">
            <div className="ct-header-icon">📢</div>
            <div>
              <h2>Publisher Report</h2>
              <p>{filters ? `${filters.startDate}${filters.endDate !== filters.startDate ? ` → ${filters.endDate}` : ''}` : ''}</p>
            </div>
          </div>
          <div className="ct-header-right">
            {!loading && data.length > 0 && <span className="record-count">{data.length} records</span>}
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
                    <div className="no-data-sub">No records for the selected date range</div>
                  </div>
                </td></tr>
              ) : data.map((row, i) => (
                <tr key={i}>
                  {COLS.map(c => (
                    <td key={c.key} className="ct-td">
                      {c.key === 'billerName' || c.key === 'serviceName'
                        ? (row[c.key] != null ? <span className="td-primary">{row[c.key]}</span> : <NullCell />)
                        : c.key === 'operatorName'
                        ? (row[c.key] != null ? <span className="ct-network">{row[c.key]}</span> : <NullCell />)
                        : c.key === 'totalRev' || c.key === 'totalRevUsd'
                        ? (row[c.key] != null ? <span className="ct-rev">{row[c.key]}</span> : <NullCell />)
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
        <Pagination page={page} total={total} size={SIZE} onChange={handlePageChange} />
      </div>
    </div>
  );
}
