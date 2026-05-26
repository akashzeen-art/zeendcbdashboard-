import { useState } from 'react';

const DEMO_EMAIL = 'zeen@vas.com';
const DEMO_PASS  = 'Zeenvas123';

export default function Login({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTimeout(() => {
      if (email === DEMO_EMAIL && password === DEMO_PASS) {
        onLogin({ email, name: 'Zeen VAS' });
      } else {
        setError('Invalid email or password. Please try again.');
      }
      setLoading(false);
    }, 900);
  };

  return (
    <div className="login-page">
      {/* Left panel */}
      <div className="login-left">
        <div className="login-left-content">
          <div className="login-brand">
            <div className="login-brand-icon">📊</div>
            <div>
              <div className="login-brand-name">VAS Dashboard</div>
              <div className="login-brand-sub">Zeen DCB Platform</div>
            </div>
          </div>

          <div className="login-hero">
            <h2>Real-time DCB<br />Reporting &amp; Analytics</h2>
            <p>Monitor activations, renewals, churn and billing transactions across all operators and services in one place.</p>
          </div>

          <div className="login-features">
            {[
              { icon: '⚡', text: 'Live transaction monitoring' },
              { icon: '📈', text: 'Service-level summary reports' },
              { icon: '🔍', text: 'Advanced filtering & search' },
              { icon: '🔒', text: 'Secure role-based access' },
            ].map((f) => (
              <div className="login-feature-item" key={f.text}>
                <span className="login-feature-icon">{f.icon}</span>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="login-left-orb orb1" />
        <div className="login-left-orb orb2" />
      </div>

      {/* Right panel — form */}
      <div className="login-right">
        <div className="login-card">
          <div className="login-card-header">
            <div className="login-card-icon">🔐</div>
            <h1>Welcome back</h1>
            <p>Sign in to your dashboard account</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="email">Email address</label>
              <div className="login-input-wrap">
                <span className="login-input-icon">✉️</span>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  required
                  autoComplete="email"
                  className={error ? 'login-input error' : 'login-input'}
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <div className="login-input-wrap">
                <span className="login-input-icon">🔑</span>
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  required
                  autoComplete="current-password"
                  className={error ? 'login-input error' : 'login-input'}
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPass((s) => !s)}
                  tabIndex={-1}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error">
                <span>⚠️</span> {error}
              </div>
            )}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? (
                <span className="login-spinner" />
              ) : (
                'Sign In →'
              )}
            </button>
          </form>

          <div className="login-demo-hint">
            <span>Demo credentials</span>
            <div className="login-demo-creds">
              <code>{DEMO_EMAIL}</code>
              <code>{DEMO_PASS}</code>
            </div>
          </div>
        </div>

        <div className="login-footer">
          © {new Date().getFullYear()} Zeen DCB · All rights reserved
        </div>
      </div>
    </div>
  );
}
