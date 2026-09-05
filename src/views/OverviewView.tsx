import { ArrowUpRight, CheckCircle2, CircleDollarSign, Clock3, FileText, Route, Sparkles, TrendingUp, UsersRound, WalletCards } from 'lucide-react';
import { isViewAvailable, type AppView } from '../components/layout/AppShell';
import { useWorkspace } from '../lib/workspace';

const flow: Array<{ label: string; view: AppView }> = [
  { label: 'Quotation', view: 'quotations' },
  { label: 'Approval', view: 'approvals' },
  { label: 'Fulfillment', view: 'fulfillment' },
  { label: 'Billing', view: 'invoices' },
];

const money = (minor: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(minor / 100);

export function OverviewView({ onNavigate }: { onNavigate: (view: AppView) => void }) {
  const { data, connection, role } = useWorkspace();
  const visibleFlow = flow.filter((step) => isViewAvailable(step.view, role));
  const canCreateQuote = role !== 'finance_ops';
  const openQuotes = data.quotes.filter((quote) => !['accepted', 'rejected', 'expired'].includes(String(quote.status)));
  const approved = data.quotes.filter((quote) => ['approved', 'accepted'].includes(String(quote.status))).length;
  const pipelineMinor = openQuotes.reduce((sum, quote) => sum + Number(quote.totalMinor ?? 0), 0);
  const collectedMinor = data.payments.reduce((sum, payment) => sum + Number(payment.amountMinor ?? 0), 0);
  const outstandingMinor = data.invoices.reduce((sum, invoice) => sum + Number(invoice.totalMinor ?? 0) - Number(invoice.paidMinor ?? 0), 0);
  const stages = [
    { label: 'Draft', count: data.quotes.filter((quote) => quote.status === 'draft').length },
    { label: 'Review', count: data.quotes.filter((quote) => String(quote.status).startsWith('pending')).length },
    { label: 'Approved', count: data.quotes.filter((quote) => quote.status === 'approved').length },
    { label: 'Won', count: data.quotes.filter((quote) => quote.status === 'accepted').length },
  ];
  const maxStage = Math.max(1, ...stages.map(({ count }) => count));
  const tierCounts = ['Gold', 'Silver', 'Bronze'].map((tier) => ({
    tier,
    count: data.customers.filter((customer) => customer.tier === tier).length,
  }));
  const metrics = [
    { label: 'Open quotations', value: String(openQuotes.length), note: 'Active opportunities', icon: FileText },
    { label: 'Pending approval', value: String(data.approvals.length), note: 'Needs a decision', icon: Clock3 },
    { label: 'Approved deals', value: String(approved), note: 'Ready or accepted', icon: CheckCircle2 },
    { label: 'Pipeline value', value: money(pipelineMinor), note: connection === 'online' ? 'Live workspace' : 'Saved workspace', icon: CircleDollarSign },
  ];

  return <div className="page-stack dashboard-page">
    <section className="dashboard-hero">
      <div><span><Sparkles size={14} /> Revenue command center</span><h2>{money(pipelineMinor)}</h2><p>Open commercial pipeline across {openQuotes.length} active quotations.</p></div>
      <div className="dashboard-hero-signal"><TrendingUp size={20} /><span><strong>{approved}</strong><small>approved deals</small></span></div>
      {canCreateQuote && <button type="button" className="dashboard-create" disabled={connection !== 'online'} onClick={() => onNavigate('quotations')}>New quotation <ArrowUpRight size={17} /></button>}
    </section>
    <section className="metric-grid" aria-label="Workspace metrics">{metrics.map(({ label, value, note, icon: Icon }) => <article className="metric-card" key={label}><span className="metric-icon"><Icon size={19} /></span><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</section>
    <section className="dashboard-insight-grid">
      <article className="dashboard-panel">
        <header><span><TrendingUp size={17} /></span><div><h3>Pipeline pulse</h3><p>Current quotation progression</p></div></header>
        <div className="pipeline-bars">{stages.map((stage) => <div key={stage.label}><span>{stage.label}</span><i><b style={{ width: `${Math.max(7, stage.count / maxStage * 100)}%` }} /></i><strong>{stage.count}</strong></div>)}</div>
      </article>
      <article className="dashboard-panel">
        <header><span><UsersRound size={17} /></span><div><h3>Customer portfolio</h3><p>Commercial tier mix</p></div></header>
        <div className="tier-stack">{tierCounts.map(({ tier, count }) => <div className={`tier-row ${tier.toLowerCase()}`} key={tier}><i /><span><strong>{tier}</strong><small>{count} customers</small></span><b>{count}</b></div>)}</div>
      </article>
      {isViewAvailable('invoices', role) && <article className="dashboard-panel collection-panel">
        <header><span><WalletCards size={17} /></span><div><h3>Collections</h3><p>Internal payment ledger</p></div></header>
        <div><span><small>Collected</small><strong>{money(collectedMinor)}</strong></span><span><small>Outstanding</small><strong>{money(outstandingMinor)}</strong></span></div>
        <button type="button" onClick={() => onNavigate('invoices')}>Open ledger <ArrowUpRight size={14} /></button>
      </article>}
    </section>
    <section className="flow-card"><div className="flow-heading"><span><Route size={19} /></span><div><h3>Deal flow</h3><p>Jump to any active stage.</p></div></div><div className="flow-steps">{visibleFlow.map((step, index) => <button type="button" className="flow-step" key={step.label} onClick={() => onNavigate(step.view)}><span>{index + 1}</span><strong>{step.label}</strong><ArrowUpRight size={14} /></button>)}</div></section>
  </div>;
}
