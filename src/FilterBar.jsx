import { useState, useEffect, useRef } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { fetchFilterOptions } from './api';
import DateRangePicker from './DateRangePicker';

const today    = new Date().toISOString().split('T')[0];
const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

const GRANULARITY = ['Daily', 'Weekly', 'Monthly'];
const ADNETWORKS  = ['Google Ads', 'Meta Ads', 'TikTok Ads', 'Programmatic', 'Direct', 'Organic'];
const PUBWISE_OPTS = ['Pubwise A', 'Pubwise B', 'Pubwise C', 'All Publishers'];

const INIT = {
  startDate: monthAgo, endDate: today,
  billerName: '', operatorId: '', serviceName: '',
  granularity: '', adnetwork: '', pubwise: '',
};

function Dropdown({ label, value, options, onChange, placeholder = 'All', loading = false }) {
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
          {options.length === 0 && !loading && (
            <div className="fb-option fb-option-empty">No options available</div>
          )}
          {options.map(opt => {
            const v = opt.value ?? opt;
            const l = opt.label ?? opt;
            return (
              <div key={v} className={`fb-option ${value === v ? 'active' : ''}`}
                onClick={() => { onChange(v); setOpen(false); }}>
                {value === v && <span className="fb-check">✓</span>}{l}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FilterBar({ onApply }) {
  const [f, setF]               = useState(INIT);
  const [panelOpen, setPanelOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [allRows,   setAllRows]   = useState([]);
  const [billers,   setBillers]   = useState([]);
  const [operators, setOperators] = useState([]);
  const [services,  setServices]  = useState([]);

  const [dateRange, setDateRange] = useState({
    s: startOfDay(subDays(new Date(), 30)),
    e: endOfDay(new Date()),
  });

  // Load all filter options from API once
  useEffect(() => {
    fetchFilterOptions()
      .then(res => {
        const rows = res.data || [];
        setAllRows(rows);
        setBillers([...new Set(rows.map(r => r.billerName).filter(Boolean))].sort());
        setOperators(buildOperators(rows));
        setServices([...new Set(rows.map(r => r.serviceName).filter(Boolean))].sort());
      })
      .catch(() => {})
      .finally(() => setMetaLoading(false));
  }, []);

  // Cascade: biller → operators & services
  useEffect(() => {
    const filtered = f.billerName ? allRows.filter(r => r.billerName === f.billerName) : allRows;
    const ops = buildOperators(filtered);
    const svcs = [...new Set(filtered.map(r => r.serviceName).filter(Boolean))].sort();
    setOperators(ops);
    setServices(svcs);
    if (f.operatorId && !ops.find(x => x.value === f.operatorId))
      setF(p => ({ ...p, operatorId: '' }));
    if (f.serviceName && !svcs.includes(f.serviceName))
      setF(p => ({ ...p, serviceName: '' }));
  }, [f.billerName, allRows]);

  function buildOperators(rows) {
    return [...new Map(
      rows.filter(r => r.operatorId)
        .map(r => [String(r.operatorId), {
          value: String(r.operatorId),
          label: r.operatorName ? `${r.operatorName} (${r.operatorId})` : String(r.operatorId),
        }])
    ).values()];
  }

  const set = (k) => (v) => setF(p => ({ ...p, [k]: v }));

  const handleDateChange = (range) => {
    setDateRange(range);
    setF(p => ({
      ...p,
      startDate: format(range.s, 'yyyy-MM-dd'),
      endDate:   format(range.e, 'yyyy-MM-dd'),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    onApply({ ...f });
    setTimeout(() => setSubmitting(false), 600);
  };

  const handleReset = () => {
    const range = { s: startOfDay(subDays(new Date(), 30)), e: endOfDay(new Date()) };
    setDateRange(range);
    const reset = { ...INIT };
    setF(reset);
    onApply(reset);
  };

  return (
    <div className="filter-panel">
      <div className="filter-panel-header" onClick={() => setPanelOpen(o => !o)}>
        <div className="filter-panel-header-left">
          <div className="filter-icon">🔍</div>
          Filters &amp; Date Range
        </div>
        <span className={`filter-toggle-icon ${panelOpen ? 'open' : ''}`}>▼</span>
      </div>

      {panelOpen && (
        <form onSubmit={handleSubmit}>
          <div className="filter-body">

            {/* Date Range — spans 2 cols */}
            <div className="filter-group fb-date-span">
              <label className="fb-label">Date Range <span className="req">*</span></label>
              <DateRangePicker value={dateRange} onChange={handleDateChange} />
            </div>

            {/* API-driven dropdowns */}
            <Dropdown
              label="Biller / Aggregator"
              value={f.billerName}
              options={billers}
              onChange={set('billerName')}
              placeholder="All Billers"
              loading={metaLoading}
            />
            <Dropdown
              label="Geo / Operator"
              value={f.operatorId}
              options={operators}
              onChange={set('operatorId')}
              placeholder={f.billerName ? 'All Operators' : 'Select Biller First'}
              loading={metaLoading}
            />
            <Dropdown
              label="Service / Product"
              value={f.serviceName}
              options={services}
              onChange={set('serviceName')}
              placeholder="All Services"
              loading={metaLoading}
            />

            {/* Static dropdowns */}
            <Dropdown
              label="Daily / Weekly / Monthly"
              value={f.granularity}
              options={GRANULARITY}
              onChange={set('granularity')}
              placeholder="Daily"
            />
            <Dropdown
              label="Ad Network"
              value={f.adnetwork}
              options={ADNETWORKS}
              onChange={set('adnetwork')}
              placeholder="All Networks"
            />
            <Dropdown
              label="Pubwise"
              value={f.pubwise}
              options={PUBWISE_OPTS}
              onChange={set('pubwise')}
              placeholder="All"
            />

            {/* Actions */}
            <div className="filter-actions">
              <button type="submit" className="btn-apply" disabled={submitting}>
                {submitting ? '⏳ Applying…' : '🔍 Apply Filters'}
              </button>
              <button type="button" className="btn-reset" onClick={handleReset}>↺ Reset</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
