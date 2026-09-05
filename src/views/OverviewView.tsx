import { ArrowUpRight, CheckCircle2, CircleDollarSign, Clock3, FileText, Route } from 'lucide-react';

const metrics = [
  { label: 'Open quotations', value: '24', note: 'Active workspace items', icon: FileText },
  { label: 'Pending approval', value: '7', note: 'Awaiting a decision', icon: Clock3 },
  { label: 'Approval rate', value: '91%', note: 'Current demo period', icon: CheckCircle2 },
  { label: 'Pipeline value', value: '₹18.4L', note: 'Open opportunity value', icon: CircleDollarSign },
];

export function OverviewView() {
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div><span className="page-kicker">Sales operations</span><h2>Deal workspace</h2><p>Track the path from quotation to fulfillment.</p></div>
        <button type="button" className="primary-action">New quotation <ArrowUpRight size={17} /></button>
      </section>

      <section className="metric-grid" aria-label="Workspace metrics">
        {metrics.map(({ label, value, note, icon: Icon }) => (
          <article className="metric-card" key={label}>
            <span className="metric-icon"><Icon size={19} /></span>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>

      <section className="flow-card">
        <div className="flow-heading"><span><Route size={19} /></span><div><h3>Core deal flow</h3><p>The workspace structure is ready for business modules.</p></div></div>
        <div className="flow-steps">
          {['Quotation', 'Approval', 'Fulfillment', 'Billing'].map((step, index) => (
            <div className="flow-step" key={step}><span>{index + 1}</span><strong>{step}</strong></div>
          ))}
        </div>
      </section>
    </div>
  );
}
