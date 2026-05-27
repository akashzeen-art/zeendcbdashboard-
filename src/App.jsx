import { useState, useCallback } from 'react';
import Login from './Login';
import FilterBar from './FilterBar';
import CombinedTable from './CombinedTable';
import SummaryDetailsTable from './SummaryDetailsTable';
import './App.css';
import './Login.css';

const today    = new Date().toISOString().split('T')[0];
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

  const [filters,      setFilters]      = useState(DEFAULT_FILTERS);
  const [activeTab,    setActiveTab]    = useState('combined');
  const [combinedTotal, setCombinedTotal] = useState(0);
  const [detailsTotal,  setDetailsTotal]  = useState(0);

  const handleApply = useCallback((f) => {
    // Map FilterBar fields to API params
    setFilters({
      startDate:   f.startDate,
      endDate:     f.endDate,
      billerName:  f.billerName  || '',
      operatorId:  f.operatorId  || '',
      serviceName: f.serviceName || '',
    });
  }, []);

  const handleLogin = (u) => {
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
  };

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="header-logo">📊</div>
          <div className="header-title">
            <h1>VAS Dashboard</h1>
            <span>Zeend DCB Reporting Portal</span>
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
          <button className="btn-logout" onClick={handleLogout}>⏻ Logout</button>
        </div>
      </header>

      <main className="app-main">
        <FilterBar onApply={handleApply} />

        <div className="tabs-bar">
          <div className="tabs">
            <button
              className={activeTab === 'combined' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('combined')}
            >
              📋 Summary &amp; Analytics
              <span className="tab-count">{combinedTotal}</span>
            </button>
            <button
              className={activeTab === 'details' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('details')}
            >
              🧾 Transaction Details
              <span className="tab-count">{detailsTotal}</span>
            </button>
          </div>
          <div className="table-meta">📅 {filters.startDate} → {filters.endDate}</div>
        </div>

        {activeTab === 'combined' && (
          <CombinedTable filters={filters} onTotalChange={setCombinedTotal} />
        )}
        {activeTab === 'details' && (
          <SummaryDetailsTable filters={filters} onTotalChange={setDetailsTotal} />
        )}
      </main>
    </div>
  );
}
