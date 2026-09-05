import { FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Workflow } from 'lucide-react';
import { APP_DESCRIPTION, APP_NAME, TEAM_NAME } from '../app-meta';
import { authenticateDummyAccount, type DummyAccount } from '../lib/dummy-accounts';

interface LoginPageProps {
  onAuthenticated: (account: DummyAccount) => void;
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const account = authenticateDummyAccount(email, password);
    if (!account) {
      setError('Email or password is incorrect.');
      setSubmitting(false);
      return;
    }
    onAuthenticated(account);
  };

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Product overview">
        <div className="brand-lockup">
          <span className="brand-mark"><Workflow size={22} /></span>
          <span><strong>{APP_NAME}</strong><small>{TEAM_NAME}</small></span>
        </div>
        <div className="login-story-copy">
          <span className="story-kicker"><ShieldCheck size={15} /> CONTROLLED DEAL EXECUTION</span>
          <h1>Every deal.<br />One clear flow.</h1>
          <p>{APP_DESCRIPTION}</p>
        </div>
        <div className="story-signal"><span className="signal-dot" /> Workspace services ready</div>
      </section>

      <section className="login-surface" aria-labelledby="login-title">
        <div className="login-card">
          <div className="login-heading">
            <span className="mobile-brand-mark"><Workflow size={20} /></span>
            <p>{TEAM_NAME}</p>
            <h2 id="login-title">Welcome back</h2>
            <span>Sign in to your sales workspace.</span>
          </div>

          <form onSubmit={submit} className="login-form">
            <label htmlFor="login-email">Email</label>
            <div className="field-shell">
              <Mail size={17} aria-hidden="true" />
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <label htmlFor="login-password">Password</label>
            <div className="field-shell">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {error && <p className="login-error" role="alert">{error}</p>}

            <button type="submit" className="login-submit" disabled={submitting}>
              <span>{submitting ? 'Opening workspace…' : 'Sign in'}</span>
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="login-footnote">Protected workspace · {TEAM_NAME}</p>
        </div>
      </section>
    </main>
  );
}
