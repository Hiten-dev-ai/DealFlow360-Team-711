import { ArrowUpRight, CheckCircle2, CircleDollarSign, Clock3, FileText, Route } from 'lucide-react';
import type { AppView } from '../components/layout/AppShell';

const metrics = [
  { label: 'Open quotations', value: '24', note: 'Active workspace items', icon: FileText },
  { label: 'Pending approval', value: '7', note: 'Awaiting a decision', icon: Clock3 },
  { label: 'Approval rate', value: '91%', note: 'Current demo period', icon: CheckCircle2 },
  { label: 'Pipeline value', value: '₹18.4L', note: 'Open opportunity value', icon: CircleDollarSign },
];

const flow: Array<{ label: string; view: AppView }> = [
  { label: 'Quotation', view: 'quotations' },
  { label: 'Approval', view: 'approvals' },
  { label: 'Fulfillment', view: 'fulfillment' },
  { label: 'Billing', view: 'invoices' },
];

export function OverviewView({ onNavigate }: { onNavigate: (view: AppView) => void }) {
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div><span className="page-kicker">Sales operations</span><h2>Sales dashboard</h2><p>Track the path from quotation to payment.</p></div>
        <button type="button" className="primary-action" onClick={() => onNavigate('quotations')}>New quotation <ArrowUpRight size={17} /></button>
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
        <div className="flow-heading"><span><Route size={19} /></span><div><h3>Core deal flow</h3><p>Open any stage to continue the workflow.</p></div></div>
        <div className="flow-steps">
          {flow.map((step, index) => (
            <button type="button" className="flow-step" key={step.label} onClick={() => onNavigate(step.view)}><span>{index + 1}</span><strong>{step.label}</strong><ArrowUpRight size={14} /></button>
          ))}
        </div>
      </section>
    </div>
  );
}
