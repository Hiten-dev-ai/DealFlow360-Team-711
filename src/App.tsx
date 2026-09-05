import { Activity, ArrowRight, ShieldCheck } from 'lucide-react';
import { APP_NAME, TEAM_NAME } from './app-meta';

function App() {
  return (
    <main className="app-shell">
      <section className="welcome-card" aria-labelledby="page-title">
        <div className="eyebrow"><ShieldCheck size={16} /> {TEAM_NAME.toUpperCase()}</div>
        <h1 id="page-title">{APP_NAME}</h1>
        <p className="lede">
          A governed sales workspace for quotations, approvals, fulfillment, and billing.
        </p>
        <div className="scaffold-status" role="status">
          <Activity size={17} />
          <span>Scaffold ready</span>
        </div>
        <button type="button" className="start-button">
          Open workspace <ArrowRight size={17} />
        </button>
      </section>
    </main>
  );
}

export default App;
