import { useState } from 'react';

const today = new Date().toISOString().split('T')[0];
const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
const INIT = { startDate: monthAgo, endDate: today, serviceName: '', operatorId: '', billerName: '' };

export default function FilterBar({ onApply }) {
  const [f, setF] = useState(INIT);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    onApply(f);
    setTimeout(() => setLoading(false), 600);
  };

  const handleReset = () => {
    setF(INIT);
    onApply(INIT);
  };

  return (
    <div className="filter-panel">
      <div className="filter-panel-header" onClick={() => setOpen((o) => !o)}>
        <div className="filter-panel-header-left">
          <div className="filter-icon">🔍</div>
          Filters &amp; Date Range
        </div>
        <span className={`filter-toggle-icon ${open ? 'open' : ''}`}>▼</span>
      </div>

      {open && (
        <form onSubmit={handleSubmit}>
          <div className="filter-body">
            <div className="filter-group">
              <label>Start Date <span className="req">*</span></label>
              <input className="filter-input" type="date" value={f.startDate} onChange={set('startDate')} required />
            </div>
            <div className="filter-group">
              <label>End Date <span className="req">*</span></label>
              <input className="filter-input" type="date" value={f.endDate} onChange={set('endDate')} required />
            </div>
            <div className="filter-group">
              <label>Service Name</label>
              <input className="filter-input" type="text" placeholder="e.g. AIGamopedia" value={f.serviceName} onChange={set('serviceName')} />
            </div>
            <div className="filter-group">
              <label>Operator ID</label>
              <input className="filter-input" type="text" placeholder="e.g. 9039" value={f.operatorId} onChange={set('operatorId')} />
            </div>
            <div className="filter-group">
              <label>Biller Name</label>
              <input className="filter-input" type="text" placeholder="e.g. XCEED" value={f.billerName} onChange={set('billerName')} />
            </div>
            <div className="filter-actions">
              <button type="submit" className="btn-apply" disabled={loading}>
                {loading ? '⏳ Applying…' : '🔍 Apply Filters'}
              </button>
              <button type="button" className="btn-reset" onClick={handleReset}>↺ Reset</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
