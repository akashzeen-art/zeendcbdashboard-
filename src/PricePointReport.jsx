import { useState, useEffect, useCallback } from 'react';
import { fetchSummary } from './api';
import { SummaryFilterBar } from './FilterPanel';
import Pagination from './Pagination';
import SkeletonRows from './SkeletonRows';
import NullCell from './NullCell';
import * as XLSX from 'xlsx';

const COLS = [
  { key: 'billerName',         label: 'Biller / Aggregator' },
  { key: 'serviceName',        label: 'Service / Product' },
  { key: 'operatorName',       label: 'Operator' },
  { key: 'operatorId',         label: 'Operator ID' },
  { key: 'pricePoint',         label: 'Price Point' },
  { key: 'activation',         label: 'Activations' },
  { key: 'renewal',            label: 'Renewals' },
  { key: 'churn',              label: 'Churn' },
  { key: 'activationPending',  label: 'Pending (PARK)' },
  { key: 'actRev',             label: 'Act Revenue' },
  { key: 'renewRev',           label: 'Renew Revenue' },
  { key: 'totalRev',           label: 'Total Revenue' },
  { key: 'totalRevUsd',        label: 'Total Rev USD' },
];

function mapRow(r) {
  const price    = r.pricePoint || 0;
  const actRev   = (r.activation || 0) * price;
  const renewRev = (r.renewal    || 0) * price;
  const totalRev = actRev + renewRev;
  return {
    billerName:        r.billerName        || null,
    serviceName:       r.serviceName       || null,
    operatorName:      r.operatorName      || null,
    operatorId:        r.operatorId        || null,
    pricePoint:        r.pricePoint        ?? null,
    activation:        r.activation        ?? null,
    renewal:           r.renewal           ?? null,
    churn:             r.churn             ?? null,
    activationPending: r.activationPending ?? null,
    actRev:      actRev    > 0 ? actRev.toLocaleString()    : null,
    renewRev:    renewRev  > 0 ? renewRev.toLocaleString()  : null,
    totalRev:    totalRev  > 0 ? totalRev.toLocaleString()  : null,
    totalRevUsd: totalRev  > 0 ? (totalRev / 550).toFixed(2) : null,
  };
}

export default function PricePointReport() {
  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState({ startDate: today, endDate: today, billerName: '', operatorId: '', serviceName: '' });
  const [data,    setData]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const SIZE = 15;

  const loadData = useCallback((f, p) => {
    setLoading(true); setError('');
    fetchSummary({ ...f, page: p, size: SIZE })
      .then(res => { setData((res.data || []).map(mapRow)); setTotal(res.total || 0); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(filters, 1); }, []); // eslint-disable-line

  const handleApply = (f) => { setFilters(f); setPage(1); setData([]); loadData(f, 1); };
  const handlePageChange = (p) => { setPage(p); loadData(filters, p); };

  const exportExcel = () => {
    const rows = data.map(r => Object.fromEntries(COLS.map(c => [c.label, r[c.key] ?? ''])));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = COLS.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PricePoint Report');
    XLSX.writeFile(wb, `pricepoint_${filters?.startDate}_${filters?.endDate}.xlsx`);
  };

  return (
    <div>
      <SummaryFilterBar onApply={handleApply} />
      {error && <div className="error-box">⚠️ {error}</div>}

      <div className="ct-section">
        <div className="ct-header">
          <div className="ct-header-left">
            <div className="ct-header-icon">💰</div>
            <div>
              <h2>Pricepoint / Biller Report</h2>
              <p>{filters ? `${filters.startDate}${filters.endDate !== filters.startDate ? ` → ${filters.endDate}` : ''}` : ''}</p>
            </div>
          </div>
          <div className="ct-header-right">
            {!loading && total > 0 && <span className="record-count">{total} records</span>}
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
                        : c.key === 'pricePoint'
                        ? (row[c.key] != null ? <span className="ct-rev">{Number(row[c.key]).toLocaleString()}</span> : <NullCell />)
                        : c.key === 'actRev' || c.key === 'renewRev' || c.key === 'totalRev' || c.key === 'totalRevUsd'
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
