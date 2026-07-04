import { useState, useEffect } from 'react';
import { Dropdown } from './FilterPanel';
import { fetchHourlyReport, updateCut } from './api';
import { CUT_OPTIONS } from './utils';

function uniqueCampaigns(rows) {
  const map = new Map();
  (rows || []).forEach(c => {
    if (!c?.campaignId) return;
    const key = String(c.campaignId);
    const existing = map.get(key);
    if (!existing || (c.date || '') >= (existing.date || '')) {
      map.set(key, c);
    }
  });
  return [...map.values()].sort((a, b) =>
    String(a.productname || '').localeCompare(String(b.productname || ''))
    || String(a.dspName || '').localeCompare(String(b.dspName || ''))
  );
}

function campaignLabel(c) {
  const name = c.productname || 'Campaign';
  const net  = c.dspName ? ` · ${c.dspName}` : '';
  const cut  = c.cut != null ? ` · CUT ${c.cut}%` : '';
  return `${name}${net} · #${c.campaignId}${cut}`;
}

export default function Cutback() {
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const [campaigns, setCampaigns] = useState([]);
  const [loadingCamps, setLoadingCamps] = useState(true);
  const [f, setF] = useState({ campaignId: '', cut: '' });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setLoadingCamps(true);
    fetchHourlyReport(monthAgo, today)
      .then(rows => setCampaigns(uniqueCampaigns(rows)))
      .catch(() => setCampaigns([]))
      .finally(() => setLoadingCamps(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const campaignOptions = campaigns.map(c => ({
    value: String(c.campaignId),
    label: campaignLabel(c),
  }));

  const selected = campaigns.find(c => String(c.campaignId) === f.campaignId);

  const set = (k) => (v) => setF(p => ({ ...p, [k]: v }));

  const handleApply = async (e) => {
    e.preventDefault();
    if (!selected || f.cut === '') {
      setStatus('error');
      setMsg('Campaign and CUT % are required.');
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      await updateCut(selected.campaignId, selected.links, Number(f.cut));
      const entry = {
        campaign: campaignLabel(selected),
        campaignId: selected.campaignId,
        cut: f.cut,
        appliedAt: new Date().toLocaleString(),
      };
      setHistory(h => [entry, ...h]);
      setCampaigns(prev =>
        prev.map(c =>
          String(c.campaignId) === String(selected.campaignId) ? { ...c, cut: f.cut } : c
        )
      );
      setStatus('success');
      setMsg(`CUT updated to ${f.cut}% for campaign #${selected.campaignId}`);
    } catch (err) {
      setStatus('error');
      setMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setF({ campaignId: '', cut: '' });
    setStatus(null);
    setMsg('');
  };

  return (
    <div className="cutback-page">
      <div className="ct-section">
        <div className="ct-header">
          <div className="ct-header-left">
            <div className="ct-header-icon">✂️</div>
            <div>
              <h2>CUT Configuration</h2>
              <p>Set campaign CUT via GET /optimize?id=&amp;cut=</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleApply} className="cutback-form">
          <div className="cutback-grid">
            <Dropdown
              label="Campaign *"
              value={f.campaignId}
              options={campaignOptions}
              onChange={set('campaignId')}
              placeholder="Select Campaign"
              loading={loadingCamps}
            />
            <Dropdown
              label="CUT % *"
              value={f.cut}
              options={CUT_OPTIONS.map(String)}
              onChange={set('cut')}
              placeholder="Select CUT"
            />
          </div>

          {selected && (
            <p className="cutback-meta" style={{ fontSize: '.8rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
              Links: <span style={{ wordBreak: 'break-all' }}>{selected.links}</span>
            </p>
          )}

          {status && (
            <div className={`cutback-feedback ${status}`}>
              {status === 'success' ? '✓' : '✗'} {msg}
            </div>
          )}

          <div className="cutback-actions">
            <button type="submit" className="btn-apply" disabled={saving || loadingCamps}>
              {saving ? '⏳ Applying…' : '✂️ Apply CUT'}
            </button>
            <button type="button" className="btn-reset" onClick={handleReset}>↺ Reset</button>
          </div>
        </form>
      </div>

      {history.length > 0 && (
        <div className="ct-section" style={{ marginTop: '1.25rem' }}>
          <div className="ct-header">
            <div className="ct-header-left">
              <div className="ct-header-icon">📜</div>
              <div><h2>Applied CUT</h2><p>Session history</p></div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="ct-table">
              <thead>
                <tr>
                  {['Campaign', 'Campaign ID', 'CUT %', 'Applied At'].map(h => (
                    <th key={h} className="ct-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td className="ct-td"><span className="td-primary">{h.campaign}</span></td>
                    <td className="ct-td">{h.campaignId}</td>
                    <td className="ct-td"><span className="cr-badge cr-good">{h.cut}%</span></td>
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
