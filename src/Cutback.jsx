import { useState } from 'react';
import { Dropdown, useFilterOptions } from './FilterPanel';
import { updateCut } from './api';

const PERCENTAGES = ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'];
const CAPS        = ['No Cap', '100', '500', '1000', '2000', '5000', '10000', 'Unlimited'];

export default function Cutback() {
  const { billers, operators, services, loading } = useFilterOptions();
  const [f, setF] = useState({ publisher: '', product: '', geoOperator: '', percentage: '', cap: '' });
  const [saving,  setSaving]  = useState(false);
  const [status,  setStatus]  = useState(null);
  const [msg,     setMsg]     = useState('');
  const [history, setHistory] = useState([]);

  const set = (k) => (v) => setF(p => ({ ...p, [k]: v }));

  const handleApply = async (e) => {
    e.preventDefault();
    if (!f.publisher || !f.percentage) {
      setStatus('error'); setMsg('Publisher and Percentage are required.');
      return;
    }
    setSaving(true); setStatus(null);
    try {
      // Build a fake links string so updateCut can extract id if needed
      await updateCut(f.publisher, '', Number(f.percentage));
      const entry = { ...f, appliedAt: new Date().toLocaleString() };
      setHistory(h => [entry, ...h]);
      setStatus('success');
      setMsg(`Cutback applied: ${f.percentage}% for ${f.publisher}`);
    } catch (err) {
      setStatus('error'); setMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setF({ publisher: '', product: '', geoOperator: '', percentage: '', cap: '' });
    setStatus(null); setMsg('');
  };

  return (
    <div className="cutback-page">
      <div className="ct-section">
        <div className="ct-header">
          <div className="ct-header-left">
            <div className="ct-header-icon">✂️</div>
            <div>
              <h2>Cutback Configuration</h2>
              <p>Set publisher cut percentage and cap limits</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleApply} className="cutback-form">
          <div className="cutback-grid">
            <Dropdown
              label="Publisher *"
              value={f.publisher}
              options={billers}
              onChange={set('publisher')}
              placeholder="Select Publisher"
              loading={loading}
            />
            <Dropdown
              label="Product / Service"
              value={f.product}
              options={services}
              onChange={set('product')}
              placeholder="All Products"
              loading={loading}
            />
            <Dropdown
              label="Geo / Operator"
              value={f.geoOperator}
              options={operators}
              onChange={set('geoOperator')}
              placeholder="All Operators"
              loading={loading}
            />
            <Dropdown
              label="Percentage (Cut %) *"
              value={f.percentage}
              options={PERCENTAGES}
              onChange={set('percentage')}
              placeholder="Select %"
            />
            <Dropdown
              label="Cap"
              value={f.cap}
              options={CAPS}
              onChange={set('cap')}
              placeholder="No Cap"
            />
          </div>

          {status && (
            <div className={`cutback-feedback ${status}`}>
              {status === 'success' ? '✓' : '✗'} {msg}
            </div>
          )}

          <div className="cutback-actions">
            <button type="submit" className="btn-apply" disabled={saving}>
              {saving ? '⏳ Applying…' : '✂️ Apply Cutback'}
            </button>
            <button type="button" className="btn-reset" onClick={handleReset}>↺ Reset</button>
          </div>
        </form>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="ct-section" style={{ marginTop: '1.25rem' }}>
          <div className="ct-header">
            <div className="ct-header-left">
              <div className="ct-header-icon">📜</div>
              <div><h2>Applied Cutbacks</h2><p>Session history</p></div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="ct-table">
              <thead>
                <tr>
                  {['Publisher','Product','Geo/Operator','Percentage','Cap','Applied At'].map(h => (
                    <th key={h} className="ct-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td className="ct-td"><span className="td-primary">{h.publisher || '—'}</span></td>
                    <td className="ct-td">{h.product    || '—'}</td>
                    <td className="ct-td"><span className="ct-network">{h.geoOperator || 'All'}</span></td>
                    <td className="ct-td"><span className="cr-badge cr-good">{h.percentage}%</span></td>
                    <td className="ct-td">{h.cap || 'No Cap'}</td>
                    <td className="ct-td" style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{h.appliedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
