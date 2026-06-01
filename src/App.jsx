import { useState, useCallback } from 'react';
import Login from './Login';
import SummaryReports from './SummaryReports';
import HourlyReport from './HourlyReport';
import PricePointReport from './PricePointReport';
import PublisherReport from './PublisherReport';
import Cutback from './Cutback';
import './App.css';
import './Login.css';

const today    = new Date().toISOString().split('T')[0];
const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
const DEFAULT_FILTERS = { startDate: monthAgo, endDate: today, billerName: '', operatorId: '', serviceName: '', adnetwork: '' };

const TABS = [
  { id: 'summary',   label: 'Summary & Reports',      icon: '📋' },
  { id: 'hourly',    label: 'Reports Hourly',          icon: '⏱️' },
  { id: 'pricepoint',label: 'Pricepoint/Biller Report',icon: '💰' },
  { id: 'publisher', label: 'Publisher Report',        icon: '📢' },
  { id: 'cutback',   label: 'Cutback',                 icon: '✂️' },
];

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('vas_user') || sessionStorage.getItem('vas_user');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return (parsed && parsed.email && parsed.name) ? parsed : null;
    } catch { return null; }
  });

  const [activeTab, setActiveTab] = useState('summary');
  const [filters,   setFilters]   = useState(DEFAULT_FILTERS);

  const handleApply = useCallback((f) => setFilters(f), []);

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
        {/* Main tab navigation */}
        <div className="main-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`main-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <span className="main-tab-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content — each manages its own filters */}
        {activeTab === 'summary'    && <SummaryReports />}
        {activeTab === 'hourly'     && <HourlyReport filters={filters} onCountChange={() => {}} />}
        {activeTab === 'pricepoint' && <PricePointReport />}
        {activeTab === 'publisher'  && <PublisherReport />}
        {activeTab === 'cutback'    && <Cutback />}
      </main>
    </div>
  );
}
