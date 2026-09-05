import { ArrowUpRight, CheckCircle2, CircleDollarSign, Clock3, FileText, Route } from 'lucide-react';
import { isViewAvailable, type AppView } from '../components/layout/AppShell';
import { useWorkspace } from '../lib/workspace';

const flow: Array<{ label: string; view: AppView }> = [
  { label: 'Quotation', view: 'quotations' }, { label: 'Approval', view: 'approvals' },
  { label: 'Fulfillment', view: 'fulfillment' }, { label: 'Billing', view: 'invoices' },
];

export function OverviewView({ onNavigate }: { onNavigate: (view: AppView) => void }) {
  const { data, connection, role } = useWorkspace();
  const visibleFlow = flow.filter((step) => isViewAvailable(step.view, role));
  const canCreateQuote = role !== 'finance_ops';
  const approved = data.quotes.filter((quote) => ['approved', 'accepted'].includes(String(quote.status))).length;
  const metrics = [
    { label: 'Open quotations', value: String(data.quotes.filter((quote) => !['accepted', 'rejected', 'expired'].includes(String(quote.status))).length), note: 'Active workspace items', icon: FileText },
    { label: 'Pending approval', value: String(data.approvals.length), note: 'Awaiting a decision', icon: Clock3 },
    { label: 'Approved deals', value: String(approved), note: 'Approved or accepted', icon: CheckCircle2 },
    { label: 'Pipeline value', value: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(data.quotes.reduce((sum, quote) => sum + Number(quote.totalMinor ?? 0), 0) / 100), note: connection === 'online' ? 'Live workspace value' : 'Saved workspace value', icon: CircleDollarSign },
  ];
  return <div className="page-stack"><section className="page-heading"><div><span className="page-kicker">Sales operations</span><h2>Sales dashboard</h2><p>Track the path from quotation to payment.</p></div>{canCreateQuote && <button type="button" className="primary-action" disabled={connection !== 'online'} onClick={() => onNavigate('quotations')}>New quotation <ArrowUpRight size={17} /></button>}</section><section className="metric-grid" aria-label="Workspace metrics">{metrics.map(({ label, value, note, icon: Icon }) => <article className="metric-card" key={label}><span className="metric-icon"><Icon size={19} /></span><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</section><section className="flow-card"><div className="flow-heading"><span><Route size={19} /></span><div><h3>Core deal flow</h3><p>Open any stage to continue the workflow.</p></div></div><div className="flow-steps">{visibleFlow.map((step, index) => <button type="button" className="flow-step" key={step.label} onClick={() => onNavigate(step.view)}><span>{index + 1}</span><strong>{step.label}</strong><ArrowUpRight size={14} /></button>)}</div></section></div>;
}
