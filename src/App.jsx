import { useState, useCallback } from 'react';
import Login from './Login';
import SummaryReports from './SummaryReports';
import HourlyReport from './HourlyReport';
import PricePointReport from './PricePointReport';
import './App.css';
import './Login.css';

const today    = new Date().toISOString().split('T')[0];
const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
const DEFAULT_FILTERS = { startDate: monthAgo, endDate: today, billerName: '', operatorId: '', serviceName: '', adnetwork: '' };

const TABS = [
  { id: 'summary',   label: 'Summary & Reports',      icon: '📋' },
  { id: 'hourly',    label: 'Reports Hourly',          icon: '⏱️' },
  { id: 'pricepoint',label: 'Pricepoint/Biller Report',icon: '💰' },
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
    <div className="app demo-app">
      <nav className="demo-navbar">
        <div className="demo-navbar-brand">MyDashboard</div>
        <ul className="demo-navbar-nav">
          <li><span className="demo-nav-user">VAS Reporting</span></li>
          <li>
            <div className="demo-nav-user-block">
              <span className="demo-nav-avatar">{user.name[0]}</span>
              <span>{user.name}</span>
            </div>
          </li>
          <li>
            <button type="button" className="demo-nav-link" onClick={handleLogout}>Log Out</button>
          </li>
        </ul>
      </nav>

      <div className="demo-page-wrapper">
        <main className="app-main demo-main">
          <div className="main-tabs demo-main-tabs">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                className={`main-tab ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                <span className="main-tab-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'summary'    && <SummaryReports />}
          {activeTab === 'hourly'     && <HourlyReport />}
          {activeTab === 'pricepoint' && <PricePointReport />}
        </main>
      </div>
    </div>
  );
}
