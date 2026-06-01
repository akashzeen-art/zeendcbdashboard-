import { useState, useEffect, useRef } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { fetchFilterOptions, fetchSummaryDetails } from './api';
import DateRangePicker from './DateRangePicker';

const today    = new Date().toISOString().split('T')[0];
const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

// Dropdown — real options normal, dummy options greyed out
export function Dropdown({ label, value, options, onChange, placeholder = 'All', loading = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="fb-field" ref={ref}>
      <label className="fb-label">{label}</label>
      <div className={`fb-select ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
        <span className={!value ? 'fb-placeholder' : 'fb-value'}>
          {loading ? 'Loading…' : (value || placeholder)}
        </span>
        <svg className={`fb-chevron ${open ? 'rotated' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {open && (
        <div className="fb-dropdown">
          <div className={`fb-option ${!value ? 'active' : ''}`} onClick={() => { onChange(''); setOpen(false); }}>
            {!value && <span className="fb-check">✓</span>}{placeholder}
          </div>
          {options.length === 0 && !loading && <div className="fb-option fb-option-empty">No options</div>}
          {options.map(opt => {
            const v    = opt.value ?? opt;
            const l    = opt.label ?? opt;
            const demo = opt.demo === true;
            return (
              <div
                key={v}
                className={`fb-option ${value === v ? 'active' : ''} ${demo ? 'fb-option-demo' : ''}`}
                onClick={() => { onChange(v); setOpen(false); }}
              >
                {value === v && <span className="fb-check">✓</span>}
                {l}
                {demo && <span className="fb-demo-tag">demo</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Hook to load API-driven filter options
export function useFilterOptions() {
  const [allRows,    setAllRows]    = useState([]);
  const [billers,    setBillers]    = useState([]);
  const [operators,  setOperators]  = useState([]);
  const [services,   setServices]   = useState([]);
  const [adNetworks, setAdNetworks] = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    const end   = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];

    Promise.all([
      fetchFilterOptions(),
      fetchSummaryDetails({ startDate: start, endDate: end, page: 1, size: 500 }),
    ])
      .then(([summaryRes, detailsRes]) => {
        const rows = summaryRes.data || [];
        setAllRows(rows);
        setBillers([...new Set(rows.map(r => r.billerName).filter(Boolean))].sort());
        setOperators(buildOps(rows));
        setServices([...new Set(rows.map(r => r.serviceName).filter(Boolean))].sort());

        // Ad Networks from requestMode field in details API
        const detailRows = detailsRes.data || [];
        const nets = [...new Set(detailRows.map(r => r.requestMode).filter(Boolean))].sort();
        setAdNetworks(nets.map(n => ({ value: n, label: n, demo: false })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function buildOps(rows) {
    return [...new Map(rows.filter(r => r.operatorId).map(r => [
      String(r.operatorId),
      { value: String(r.operatorId), label: r.operatorName ? `${r.operatorName} (${r.operatorId})` : String(r.operatorId), demo: false }
    ])).values()];
  }

  function cascade(billerName) {
    const filtered = billerName ? allRows.filter(r => r.billerName === billerName) : allRows;
    setOperators(buildOps(filtered));
    setServices([...new Set(filtered.map(r => r.serviceName).filter(Boolean))].sort());
  }

  return { billers, operators, services, adNetworks, loading, cascade };
}

export function SummaryFilterBar({ onApply }) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { billers, operators, services, adNetworks, loading, cascade } = useFilterOptions();
  const [dateRange, setDateRange] = useState({ s: startOfDay(subDays(new Date(),30)), e: endOfDay(new Date()) });
  const [f, setF] = useState({ startDate: monthAgo, endDate: today, billerName: '', operatorId: '', serviceName: '', adnetwork: '' });

  const set = (k) => (v) => {
    setF(p => ({ ...p, [k]: v }));
    if (k === 'billerName') cascade(v);
  };

  const handleDate = (r) => {
    setDateRange(r);
    setF(p => ({ ...p, startDate: format(r.s,'yyyy-MM-dd'), endDate: format(r.e,'yyyy-MM-dd') }));
  };

  const handleSubmit = (e) => {
    e.preventDefault(); setSubmitting(true);
    onApply({ ...f });
    setTimeout(() => setSubmitting(false), 500);
  };

  const handleReset = () => {
    const r = { s: startOfDay(subDays(new Date(),30)), e: endOfDay(new Date()) };
    setDateRange(r);
    const reset = { startDate: monthAgo, endDate: today, billerName: '', operatorId: '', serviceName: '', adnetwork: '' };
    setF(reset); onApply(reset);
  };

  return (
    <div className="filter-panel">
      <div className="filter-panel-header" onClick={() => setPanelOpen(o => !o)}>
        <div className="filter-panel-header-left"><div className="filter-icon">🔍</div>Filters &amp; Date Range</div>
        <span className={`filter-toggle-icon ${panelOpen ? 'open' : ''}`}>▼</span>
      </div>
      {panelOpen && (
        <form onSubmit={handleSubmit}>
          <div className="filter-body">
            <div className="filter-group fb-date-span">
              <label className="fb-label">Date Range <span className="req">*</span></label>
              <DateRangePicker value={dateRange} onChange={handleDate} />
            </div>
            <Dropdown label="Biller" value={f.billerName} options={billers} onChange={set('billerName')} placeholder="All Billers" loading={loading} />
            <Dropdown label="Geo / Operator" value={f.operatorId} options={operators} onChange={set('operatorId')} placeholder="All Operators" loading={loading} />
            <Dropdown label="Service / Product" value={f.serviceName} options={services} onChange={set('serviceName')} placeholder="All Services" loading={loading} />
            <Dropdown
              label="Ad Network"
              value={f.adnetwork}
              options={adNetworks}
              onChange={set('adnetwork')}
              placeholder="All Networks"
              loading={loading}
            />
            <div className="filter-actions">
              <button type="submit" className="btn-apply" disabled={submitting}>{submitting ? '⏳ Applying…' : '🔍 Apply'}</button>
              <button type="button" className="btn-reset" onClick={handleReset}>↺ Reset</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

// Hourly Report filter bar — just date range
export function HourlyFilterBar({ onApply }) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [dateRange, setDateRange] = useState({ s: startOfDay(new Date()), e: endOfDay(new Date()) });
  const [f, setF] = useState({ startDate: today, endDate: today });

  const handleDate = (r) => {
    setDateRange(r);
    setF({ startDate: format(r.s,'yyyy-MM-dd'), endDate: format(r.e,'yyyy-MM-dd') });
  };

  return (
    <div className="filter-panel">
      <div className="filter-panel-header" onClick={() => setPanelOpen(o => !o)}>
        <div className="filter-panel-header-left"><div className="filter-icon">🔍</div>Date Range</div>
        <span className={`filter-toggle-icon ${panelOpen ? 'open' : ''}`}>▼</span>
      </div>
      {panelOpen && (
        <form onSubmit={(e) => { e.preventDefault(); onApply(f); }}>
          <div className="filter-body">
            <div className="filter-group fb-date-span">
              <label className="fb-label">Date Range <span className="req">*</span></label>
              <DateRangePicker value={dateRange} onChange={handleDate} />
            </div>
            <div className="filter-actions">
              <button type="submit" className="btn-apply">🔍 Apply</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

// Publisher Report filter bar
export function PublisherFilterBar({ onApply }) {
  const [panelOpen, setPanelOpen] = useState(true);
  const { operators, services, loading } = useFilterOptions();
  const [dateRange, setDateRange] = useState({ s: startOfDay(subDays(new Date(),30)), e: endOfDay(new Date()) });
  const [f, setF] = useState({ startDate: monthAgo, endDate: today, operatorId: '', serviceName: '' });

  const set = (k) => (v) => setF(p => ({ ...p, [k]: v }));
  const handleDate = (r) => {
    setDateRange(r);
    setF(p => ({ ...p, startDate: format(r.s,'yyyy-MM-dd'), endDate: format(r.e,'yyyy-MM-dd') }));
  };

  return (
    <div className="filter-panel">
      <div className="filter-panel-header" onClick={() => setPanelOpen(o => !o)}>
        <div className="filter-panel-header-left"><div className="filter-icon">🔍</div>Filters</div>
        <span className={`filter-toggle-icon ${panelOpen ? 'open' : ''}`}>▼</span>
      </div>
      {panelOpen && (
        <form onSubmit={(e) => { e.preventDefault(); onApply(f); }}>
          <div className="filter-body">
            <div className="filter-group fb-date-span">
              <label className="fb-label">Date Range <span className="req">*</span></label>
              <DateRangePicker value={dateRange} onChange={handleDate} />
            </div>
            <Dropdown label="Geo / Operator" value={f.operatorId} options={operators} onChange={set('operatorId')} placeholder="All Operators" loading={loading} />
            <Dropdown label="Service / Product" value={f.serviceName} options={services} onChange={set('serviceName')} placeholder="All Services" loading={loading} />
            <div className="filter-actions">
              <button type="submit" className="btn-apply">🔍 Apply</button>
              <button type="button" className="btn-reset" onClick={() => { const r={startDate:monthAgo,endDate:today,operatorId:'',serviceName:''}; setF(r); onApply(r); }}>↺ Reset</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
