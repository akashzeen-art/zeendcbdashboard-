import { useState, useCallback } from 'react';
import Login from './Login';
import FilterBar from './FilterBar';
import SummaryTable from './SummaryTable';
import SummaryDetailsTable from './SummaryDetailsTable';
import './App.css';
import './Login.css';

const today = new Date().toISOString().split('T')[0];
const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
const DEFAULT_FILTERS = { startDate: monthAgo, endDate: today, serviceName: '', operatorId: '', billerName: '' };

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('vas_user') || sessionStorage.getItem('vas_user');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return (parsed && parsed.email && parsed.name) ? parsed : null;
    } catch { return null; }
  });
  const [filters, setFilters]         = useState(DEFAULT_FILTERS);
  const [activeTab, setActiveTab]     = useState('summary');
  const [summaryTotal, setSummaryTotal] = useState(0);
  const [detailsTotal, setDetailsTotal] = useState(0);
  const [summaryStats, setSummaryStats] = useState(null);

  const handleApply  = useCallback((f) => setFilters(f), []);
  const handleLogin  = (u) => {
    const val = JSON.stringify(u);
    try { localStorage.setItem('vas_user', val); } catch {}
    try { sessionStorage.setItem('vas_user', val); } catch {}
    setUser(u);
  };
  const handleLogout = () => {
    localStorage.removeItem('vas_user');
    sessionStorage.removeItem('vas_user');
    setUser(null);
    setFilters(DEFAULT_FILTERS);
    setSummaryStats(null);
  };

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="header-logo">📊</div>
          <div className="header-title">
            <h1>VAS Dashboard</h1>
            <span>Zeen DCB Reporting Portal</span>
          </div>
        </div>
        <div className="header-right">
          <div className="live-dot">Live</div>
          <div className="header-badge">DCB Platform</div>
          <div className="header-user">
            <div className="header-avatar">{user.name[0]}</div>
            <div className="header-user-info">
              <span className="header-user-name">{user.name}</span>
              <span className="header-user-email">{user.email}</span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Sign out">
            ⏻ Logout
          </button>
        </div>
      </header>

      <main className="app-main">
        <FilterBar onApply={handleApply} />

        {summaryStats && (
          <div className="stat-cards">
            <div className="stat-card">
              <div className="stat-icon blue">🔵</div>
              <div className="stat-info">
                <div className="stat-label">Total Activations</div>
                <div className="stat-value">{summaryStats.activation?.toLocaleString() ?? '—'}</div>
                <div className="stat-sub">New subscribers</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">🔄</div>
              <div className="stat-info">
                <div className="stat-label">Renewals</div>
                <div className="stat-value">{summaryStats.renewal?.toLocaleString() ?? '—'}</div>
                <div className="stat-sub">Recurring billing</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon red">📉</div>
              <div className="stat-info">
                <div className="stat-label">Churn</div>
                <div className="stat-value">{summaryStats.churn?.toLocaleString() ?? '—'}</div>
                <div className="stat-sub">Unsubscribed</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon amber">⏳</div>
              <div className="stat-info">
                <div className="stat-label">Pending</div>
                <div className="stat-value">{summaryStats.activationPending?.toLocaleString() ?? '—'}</div>
                <div className="stat-sub">Awaiting activation</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple">💰</div>
              <div className="stat-info">
                <div className="stat-label">Price Point</div>
                <div className="stat-value">{summaryStats.pricePoint?.toLocaleString() ?? '—'}</div>
                <div className="stat-sub">{summaryStats.operatorName ?? ''}</div>
              </div>
            </div>
          </div>
        )}

        <div className="tabs-bar">
          <div className="tabs">
            <button className={activeTab === 'summary' ? 'tab active' : 'tab'} onClick={() => setActiveTab('summary')}>
              📋 Summary Report
              <span className="tab-count">{summaryTotal}</span>
            </button>
            <button className={activeTab === 'details' ? 'tab active' : 'tab'} onClick={() => setActiveTab('details')}>
              🧾 Transaction Details
              <span className="tab-count">{detailsTotal}</span>
            </button>
          </div>
          <div className="table-meta">
            📅 {filters.startDate} → {filters.endDate}
          </div>
        </div>

        {activeTab === 'summary' ? (
          <SummaryTable filters={filters} onTotalChange={setSummaryTotal} onStatsChange={setSummaryStats} />
        ) : (
          <SummaryDetailsTable filters={filters} onTotalChange={setDetailsTotal} />
        )}
      </main>
    </div>
  );
}
