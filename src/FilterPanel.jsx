import { useState, useEffect, useCallback, useRef } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { fetchFilterOptions, fetchHourlyReport, fetchSummary } from './api';
import { billerFromHourly } from './utils';
import DateRangePicker from './DateRangePicker';

const today = new Date().toISOString().split('T')[0];
const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
const todayRange = { s: startOfDay(new Date()), e: endOfDay(new Date()) };
const summaryDateRange = todayRange;

export const DEFAULT_SUMMARY_FILTERS = {
  startDate: today,
  endDate: today,
};

export const DEFAULT_HOURLY_FILTERS = {
  startDate: today,
  endDate: today,
  operatorId: '',
  serviceName: '',
  dspNetwork: '',
  billerName: '',
  campaignName: '',
};

export const DEFAULT_PRICEPOINT_FILTERS = {
  startDate: monthAgo,
  endDate: today,
  operatorId: '',
  serviceName: '',
  pricePoint: '',
};

const EMPTY_OPTS = {
  operators: [],
  products: [],
  networks: [],
  aggregators: [],
  campaigns: [],
};

function toOptions(values) {
  return [...values].sort().map(v => ({ value: v, label: v }));
}

function buildOperators(rows) {
  return [...new Map(
    rows
      .filter(r => r.operatorId)
      .map(r => [
        String(r.operatorId),
        {
          value: String(r.operatorId),
          label: r.operatorName
            ? `${r.operatorName} (${r.operatorId})`
            : String(r.operatorId),
        },
      ])
  ).values()].sort((a, b) => a.label.localeCompare(b.label));
}

function deriveOptions(billingRows, hourlyRows, selected = {}) {
  const { billerName, operatorId, dspNetwork, serviceName } = selected;

  const hourlyFiltered = (hourlyRows || []).filter(c => {
    const meta = billerFromHourly(c);
    if (billerName && meta?.billerName !== billerName) return false;
    if (dspNetwork && (c.dspName || '') !== dspNetwork) return false;
    if (operatorId && meta && String(meta.operatorId) !== operatorId) return false;
    if (serviceName) {
      if ((c.productname || '') !== serviceName && meta?.serviceName !== serviceName) return false;
    }
    return true;
  });

  const billingFiltered = (billingRows || []).filter(r => {
    if (billerName && r.billerName !== billerName) return false;
    if (operatorId && String(r.operatorId) !== operatorId) return false;
    if (serviceName && r.serviceName !== serviceName) return false;
    return true;
  });

  const billingForOps = billingFiltered.length ? billingFiltered : (billingRows || []);

  const operators = buildOperators(billingForOps);

  const products = toOptions(new Set([
    ...billingFiltered.map(r => r.serviceName),
    ...hourlyFiltered.map(c => c.productname),
    ...hourlyFiltered.map(c => billerFromHourly(c)?.serviceName),
  ].filter(Boolean)));

  const networks = toOptions(new Set(
    hourlyFiltered.map(c => c.dspName).filter(Boolean)
  ));

  const aggregators = toOptions(new Set([
    ...billingFiltered.map(r => r.billerName),
    ...hourlyFiltered.map(c => billerFromHourly(c)?.billerName),
  ].filter(Boolean)));

  const campaigns = toOptions(new Set(
    hourlyFiltered.map(c => c.productname).filter(Boolean)
  ));

  return { operators, products, networks, aggregators, campaigns };
}

/** Load billing + hourly options for the selected date range. */
export function useReportFilterOptions(startDate, endDate) {
  const [options, setOptions] = useState(EMPTY_OPTS);
  const [loading, setLoading] = useState(true);
  const dataRef = useRef({ billing: [], hourly: [] });

  const load = useCallback(async (start, end) => {
    if (!start || !end) return;
    setLoading(true);
    try {
      const [summaryRes, hourly] = await Promise.all([
        fetchFilterOptions().catch(() => ({ data: [] })),
        fetchHourlyReport(start, end).catch(() => []),
      ]);
      dataRef.current = {
        billing: summaryRes.data || [],
        hourly: (hourly || []).filter(c => c.type === 'vas'),
      };
      setOptions(deriveOptions(dataRef.current.billing, dataRef.current.hourly));
    } finally {
      setLoading(false);
    }
  }, []);

  const cascade = useCallback((selected) => {
    const { billing, hourly } = dataRef.current;
    setOptions(deriveOptions(billing, hourly, selected));
  }, []);

  useEffect(() => {
    load(startDate, endDate);
  }, [startDate, endDate, load]);

  return { ...options, loading, cascade, reload: () => load(startDate, endDate) };
}

export function Dropdown({ label, value, options, onChange, placeholder = 'All', loading = false, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const normalized = (options || []).map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const selectedLabel = value
    ? (normalized.find(opt => opt.value === value)?.label ?? value)
    : '';

  return (
    <div className="fb-field" ref={ref}>
      <label className="fb-label">{label}</label>
      <div
        className={`fb-select ${open ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setOpen(o => !o)}
      >
        <span className={!value ? 'fb-placeholder' : 'fb-value'}>
          {loading ? 'Loading…' : (selectedLabel || placeholder)}
        </span>
        <svg className={`fb-chevron ${open ? 'rotated' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {open && !disabled && (
        <div className="fb-dropdown">
          <div className={`fb-option ${!value ? 'active' : ''}`} onClick={() => { onChange(''); setOpen(false); }}>
            {!value && <span className="fb-check">✓</span>}{placeholder}
          </div>
          {normalized.length === 0 && !loading && (
            <div className="fb-option fb-option-empty">No options</div>
          )}
          {normalized.map(opt => (
            <div
              key={opt.value}
              className={`fb-option ${value === opt.value ? 'active' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {value === opt.value && <span className="fb-check">✓</span>}
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SummaryFilterBar({ onApply, onExport, exportDisabled = true }) {
  const [dateRange, setDateRange] = useState(summaryDateRange);
  const [f, setF] = useState(DEFAULT_SUMMARY_FILTERS);
  const [submitting, setSubmitting] = useState(false);

  const handleDate = (r) => {
    setDateRange(r);
    setF({
      startDate: format(r.s, 'yyyy-MM-dd'),
      endDate: format(r.e, 'yyyy-MM-dd'),
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    onApply({ ...f });
    setTimeout(() => setSubmitting(false), 400);
  };

  const handleReset = () => {
    setDateRange(summaryDateRange);
    setF(DEFAULT_SUMMARY_FILTERS);
    onApply(DEFAULT_SUMMARY_FILTERS);
  };

  return (
    <div className="demo-filter-panel">
      <form onSubmit={handleSubmit}>
        <div className="demo-filter-grid">
          <div className="demo-field">
            <label className="demo-label">Select Dates <span className="req">*</span></label>
            <DateRangePicker value={dateRange} onChange={handleDate} />
          </div>
          <div className="demo-field demo-field-actions">
            <label className="demo-label">&nbsp;</label>
            <div className="demo-action-row">
              <button type="submit" className="demo-btn demo-btn-primary" disabled={submitting}>
                {submitting ? 'Loading…' : 'Submit'}
              </button>
              <button type="button" className="demo-btn demo-btn-secondary" onClick={handleReset}>Reset</button>
            </div>
          </div>
          {onExport && (
            <div className="demo-field demo-field-actions">
              <label className="demo-label">&nbsp;</label>
              <button type="button" className="demo-btn demo-btn-primary" onClick={onExport} disabled={exportDisabled}>
                Csv Download
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

export function HourlyFilterBar({ onApply, onExport, exportDisabled = true }) {
  const [dateRange, setDateRange] = useState(todayRange);
  const [f, setF] = useState(DEFAULT_HOURLY_FILTERS);
  const [submitting, setSubmitting] = useState(false);
  const { operators, products, networks, aggregators, campaigns, loading, cascade } =
    useReportFilterOptions(f.startDate, f.endDate);

  const set = (k) => (v) => {
    setF(prev => {
      const next = { ...prev, [k]: v };
      if (k === 'billerName') {
        next.operatorId = '';
        next.serviceName = '';
        next.dspNetwork = '';
        next.campaignName = '';
      }
      if (k === 'operatorId') { next.serviceName = ''; next.campaignName = ''; }
      if (k === 'dspNetwork') { next.campaignName = ''; }
      if (k === 'serviceName') { next.campaignName = ''; }
      cascade(next);
      return next;
    });
  };

  const handleDate = (r) => {
    setDateRange(r);
    const next = {
      ...DEFAULT_HOURLY_FILTERS,
      startDate: format(r.s, 'yyyy-MM-dd'),
      endDate: format(r.e, 'yyyy-MM-dd'),
    };
    setF(next);
    cascade(next);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    onApply({ ...f });
    setTimeout(() => setSubmitting(false), 400);
  };

  const handleReset = () => {
    setDateRange(todayRange);
    setF(DEFAULT_HOURLY_FILTERS);
    cascade(DEFAULT_HOURLY_FILTERS);
    onApply(DEFAULT_HOURLY_FILTERS);
  };

  return (
    <div className="demo-filter-panel">
      <form onSubmit={handleSubmit}>
        <div className="demo-filter-grid">
          <div className="demo-field">
            <label className="demo-label">Select Dates <span className="req">*</span></label>
            <DateRangePicker value={dateRange} onChange={handleDate} />
          </div>
          <div className="demo-field">
            <Dropdown label="Please select Operator" value={f.operatorId} options={operators} onChange={set('operatorId')} placeholder="-- Select Operator --" loading={loading} />
          </div>
          <div className="demo-field">
            <Dropdown label="Please select product" value={f.serviceName} options={products} onChange={set('serviceName')} placeholder="-- All Products --" loading={loading} />
          </div>
          <div className="demo-field">
            <Dropdown label="Please select Network" value={f.dspNetwork} options={networks} onChange={set('dspNetwork')} placeholder="-- All Networks --" loading={loading} />
          </div>
          <div className="demo-field">
            <Dropdown label="Please Select Aggregator" value={f.billerName} options={aggregators} onChange={set('billerName')} placeholder="-- All Aggregators --" loading={loading} />
          </div>
          <div className="demo-field">
            <Dropdown label="Please select Campaign" value={f.campaignName} options={campaigns} onChange={set('campaignName')} placeholder="-- All Campaigns --" loading={loading} />
          </div>
          <div className="demo-field demo-field-actions">
            <label className="demo-label">&nbsp;</label>
            <div className="demo-action-row">
              <button type="submit" className="demo-btn demo-btn-primary" disabled={submitting}>
                {submitting ? 'Loading…' : 'Submit'}
              </button>
              <button type="button" className="demo-btn demo-btn-secondary" onClick={handleReset}>Reset</button>
            </div>
          </div>
          {onExport && (
            <div className="demo-field demo-field-actions">
              <label className="demo-label">&nbsp;</label>
              <button type="button" className="demo-btn demo-btn-primary" onClick={onExport} disabled={exportDisabled}>
                Csv Download
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

/**
 * Price-point page options — sourced strictly from the billing summary API,
 * so a selected product/price point always maps to real billing rows.
 */
function usePricePointOptions(startDate, endDate) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!startDate || !endDate) return undefined;
    setLoading(true);
    fetchSummary({ startDate, endDate, page: 1, size: 500 })
      .then(res => { if (!cancelled) setRows(res.data || []); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  const build = (selected = {}) => {
    const { operatorId, serviceName } = selected;
    const operators = buildOperators(rows);

    const byOp = rows.filter(r => !operatorId || String(r.operatorId) === String(operatorId));
    const products = toOptions(new Set(byOp.map(r => r.serviceName).filter(Boolean)));

    const byOpSvc = byOp.filter(r => !serviceName || r.serviceName === serviceName);
    const pricePoints = [...new Set(byOpSvc.map(r => r.pricePoint).filter(pp => pp > 0))]
      .sort((a, b) => a - b)
      .map(pp => ({ value: String(pp), label: String(pp) }));

    return { operators, products, pricePoints };
  };

  return { loading, build };
}

export function PricePointFilterBar({ onApply, onExport, exportDisabled = true }) {
  const [dateRange, setDateRange] = useState(summaryDateRange);
  const [f, setF] = useState(DEFAULT_PRICEPOINT_FILTERS);
  const [submitting, setSubmitting] = useState(false);
  const { loading, build } = usePricePointOptions(f.startDate, f.endDate);
  const { operators, products, pricePoints } = build(f);

  const set = (k) => (v) => {
    setF(prev => {
      const next = { ...prev, [k]: v };
      if (k === 'operatorId') { next.serviceName = ''; next.pricePoint = ''; }
      if (k === 'serviceName') { next.pricePoint = ''; }
      return next;
    });
  };

  const handleDate = (r) => {
    setDateRange(r);
    setF({
      ...DEFAULT_PRICEPOINT_FILTERS,
      startDate: format(r.s, 'yyyy-MM-dd'),
      endDate: format(r.e, 'yyyy-MM-dd'),
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    onApply({ ...f });
    setTimeout(() => setSubmitting(false), 400);
  };

  const handleReset = () => {
    setDateRange(summaryDateRange);
    setF(DEFAULT_PRICEPOINT_FILTERS);
    onApply(DEFAULT_PRICEPOINT_FILTERS);
  };

  return (
    <div className="demo-filter-panel">
      <form onSubmit={handleSubmit}>
        <div className="demo-filter-grid">
          <div className="demo-field">
            <label className="demo-label">Select Dates <span className="req">*</span></label>
            <DateRangePicker value={dateRange} onChange={handleDate} />
          </div>
          <div className="demo-field">
            <Dropdown label="Please select Operator" value={f.operatorId} options={operators} onChange={set('operatorId')} placeholder="-- Select Operator --" loading={loading} />
          </div>
          <div className="demo-field">
            <Dropdown label="Please select Product" value={f.serviceName} options={products} onChange={set('serviceName')} placeholder="-- All Products --" loading={loading} />
          </div>
          <div className="demo-field">
            <Dropdown label="Please select Price Point" value={f.pricePoint} options={pricePoints} onChange={set('pricePoint')} placeholder="-- All Price Points --" loading={loading} />
          </div>
          <div className="demo-field demo-field-actions">
            <label className="demo-label">&nbsp;</label>
            <div className="demo-action-row">
              <button type="submit" className="demo-btn demo-btn-primary" disabled={submitting}>
                {submitting ? 'Loading…' : 'Submit'}
              </button>
              <button type="button" className="demo-btn demo-btn-secondary" onClick={handleReset}>Reset</button>
            </div>
          </div>
          {onExport && (
            <div className="demo-field demo-field-actions">
              <label className="demo-label">&nbsp;</label>
              <button type="button" className="demo-btn demo-btn-primary" onClick={onExport} disabled={exportDisabled}>
                Csv Download
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

// Back-compat for Cutback and other screens
export function useFilterOptions() {
  const { aggregators, operators, products, loading } = useReportFilterOptions(today, today);
  return {
    billers: aggregators.map(a => a.value),
    operators,
    services: products.map(p => p.value),
    loading,
    cascade: () => {},
  };
}
export function PublisherFilterBar({ onApply }) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [dateRange, setDateRange] = useState(todayRange);
  const [f, setF] = useState({ startDate: today, endDate: today, operatorId: '', serviceName: '' });
  const { operators, products, loading, cascade } = useReportFilterOptions(f.startDate, f.endDate);

  const set = (k) => (v) => {
    setF(prev => {
      const next = { ...prev, [k]: v };
      if (k === 'operatorId') next.serviceName = '';
      cascade(next);
      return next;
    });
  };

  const handleDate = (r) => {
    setDateRange(r);
    const next = {
      startDate: format(r.s, 'yyyy-MM-dd'),
      endDate: format(r.e, 'yyyy-MM-dd'),
      operatorId: '',
      serviceName: '',
    };
    setF(next);
    cascade(next);
  };

  const handleReset = () => {
    const next = { startDate: today, endDate: today, operatorId: '', serviceName: '' };
    setDateRange(todayRange);
    setF(next);
    cascade(next);
    onApply(next);
  };

  return (
    <div className="demo-filter-panel">
      <form onSubmit={(e) => { e.preventDefault(); onApply(f); }}>
        <div className="demo-filter-grid">
          <div className="demo-field">
            <label className="demo-label">Select Dates <span className="req">*</span></label>
            <DateRangePicker value={dateRange} onChange={handleDate} />
          </div>
          <div className="demo-field">
            <Dropdown label="Please select Operator" value={f.operatorId} options={operators} onChange={set('operatorId')} placeholder="-- All Operators --" loading={loading} />
          </div>
          <div className="demo-field">
            <Dropdown label="Please select product" value={f.serviceName} options={products} onChange={set('serviceName')} placeholder="-- All Products --" loading={loading} />
          </div>
          <div className="demo-field demo-field-actions">
            <label className="demo-label">&nbsp;</label>
            <div className="demo-action-row">
              <button type="submit" className="demo-btn demo-btn-primary">Submit</button>
              <button type="button" className="demo-btn demo-btn-secondary" onClick={handleReset}>Reset</button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
