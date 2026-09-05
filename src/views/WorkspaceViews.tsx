import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle, ArrowRight, BadgeIndianRupee, Boxes, Check, CheckCircle2,
  ChevronRight, CirclePause, Download, FilePlus2, Filter, PackageCheck,
  Pause, Play, ReceiptIndianRupee, Search, Send, Sparkles, TrendingUp,
  Warehouse, X,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import {
  approvalRecords, formatCurrency, fulfillmentRecords, initialHealthAlerts,
  initialInvoices, initialQuotations, initialSubscriptions, statusTone,
  type Quotation,
} from '../lib/demo-data';

function PageHeader({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: ReactNode }) {
  return <section className="page-heading"><div><span className="page-kicker">{kicker}</span><h2>{title}</h2><p>{description}</p></div>{action}</section>;
}

function StatusPill({ value }: { value: string }) {
  return <span className={`status-pill ${statusTone(value)}`}>{value}</span>;
}

function EmptyState({ title }: { title: string }) {
  return <div className="inline-empty"><Search size={20} /><strong>{title}</strong><span>Try a different filter.</span></div>;
}

export function QuotationsView() {
  const [quotations, setQuotations] = useState(initialQuotations);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [selected, setSelected] = useState<Quotation | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const filtered = useMemo(() => quotations.filter((quote) => {
    const matchesQuery = `${quote.id} ${quote.customer} ${quote.owner}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (status === 'All' || quote.status === status);
  }), [query, quotations, status]);

  const createQuote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amount = Number(data.get('amount'));
    const discount = Number(data.get('discount'));
    const quote: Quotation = {
      id: `Q-${Math.max(...quotations.map((item) => Number(item.id.slice(2)))) + 1}`,
      customer: String(data.get('customer')),
      owner: 'Hiten',
      amount,
      discount,
      margin: Math.max(12, 38 - discount),
      status: discount > 15 ? 'Pending approval' : 'Draft',
      updated: 'Just now',
    };
    setQuotations((items) => [quote, ...items]);
    setCreateOpen(false);
  };

  return (
    <div className="page-stack">
      <PageHeader kicker="Sales workspace" title="Quotations" description="Build, govern, and track every customer offer." action={<button type="button" className="primary-action" onClick={() => setCreateOpen(true)}><FilePlus2 size={17} /> New quotation</button>} />
      <section className="data-panel">
        <div className="data-toolbar">
          <label className="toolbar-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search quotations" /></label>
          <label className="toolbar-select"><Filter size={15} /><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Draft</option><option>Pending approval</option><option>Approved</option><option>Negotiation</option></select></label>
          <span className="result-count">{filtered.length} records</span>
        </div>
        <div className="record-table quotation-table">
          <div className="record-table-head"><span>Quotation</span><span>Owner</span><span>Value</span><span>Margin</span><span>Status</span><span /></div>
          {filtered.length === 0 && <EmptyState title="No quotations found" />}
          {filtered.map((quote) => (
            <button type="button" className="record-row" key={quote.id} onClick={() => setSelected(quote)}>
              <span className="record-primary"><strong>{quote.customer}</strong><small>{quote.id} · {quote.updated}</small></span>
              <span data-label="Owner">{quote.owner}</span><span data-label="Value">{formatCurrency(quote.amount)}</span><span data-label="Margin">{quote.margin}%</span><span data-label="Status"><StatusPill value={quote.status} /></span><ChevronRight size={17} />
            </button>
          ))}
        </div>
      </section>

      <Modal open={createOpen} title="New quotation" eyebrow="Draft" onClose={() => setCreateOpen(false)}>
        <form className="modal-form" onSubmit={createQuote}>
          <label><span>Customer</span><input name="customer" placeholder="Company name" required /></label>
          <div className="form-columns"><label><span>Quote value</span><input name="amount" type="number" min="1" placeholder="500000" required /></label><label><span>Discount %</span><input name="discount" type="number" min="0" max="50" defaultValue="10" required /></label></div>
          <div className="form-note"><Sparkles size={17} /><span>Discounts above 15% route to approval automatically.</span></div>
          <div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setCreateOpen(false)}>Cancel</button><button type="submit" className="primary-action">Create draft <ArrowRight size={17} /></button></div>
        </form>
      </Modal>

      <Modal open={Boolean(selected)} title={selected?.id ?? ''} eyebrow="Quotation detail" onClose={() => setSelected(null)} size="wide">
        {selected && <div className="detail-stack"><div className="detail-hero"><div><span>Customer</span><h3>{selected.customer}</h3><p>Owned by {selected.owner} · Updated {selected.updated}</p></div><StatusPill value={selected.status} /></div><div className="detail-metrics"><div><span>Quote value</span><strong>{formatCurrency(selected.amount)}</strong></div><div><span>Discount</span><strong>{selected.discount}%</strong></div><div><span>Live margin</span><strong>{selected.margin}%</strong></div></div><div className="suggestion-card"><Sparkles size={19} /><div><strong>Upsell suggestion</strong><p>Add Priority Support to improve expected margin by 2.4%.</p></div><button type="button" className="secondary-action">Add to quote</button></div><div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setSelected(null)}>Close</button><button type="button" className="primary-action" onClick={() => { setQuotations((items) => items.map((item) => item.id === selected.id ? { ...item, status: 'Pending approval' } : item)); setSelected(null); }}><Send size={16} /> Send for approval</button></div></div>}
      </Modal>
    </div>
  );
}

export function ApprovalsView() {
  const [states, setStates] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = approvalRecords.find((record) => record.id === selectedId);
  const decide = (id: string, decision: 'Approved' | 'Rejected') => {
    setStates((current) => ({ ...current, [id]: decision }));
    setSelectedId(null);
  };
  return <div className="page-stack">
    <PageHeader kicker="Governance" title="Approvals" description="Review exceptions with the risk and margin context visible." />
    <section className="card-grid three-column">
      {approvalRecords.map((record) => <article className="work-card" key={record.id}><header><span className="record-icon"><AlertTriangle size={18} /></span><StatusPill value={states[record.id] ?? 'In review'} /></header><div><span className="record-id">{record.id}</span><h3>{record.customer}</h3><p>{record.reason}</p></div><dl><div><dt>Value</dt><dd>{formatCurrency(record.amount)}</dd></div><div><dt>Risk</dt><dd>{record.risk}/100</dd></div><div><dt>Step</dt><dd>{record.step}</dd></div></dl><button type="button" className="secondary-action full" onClick={() => setSelectedId(record.id)}>Review decision <ChevronRight size={16} /></button></article>)}
    </section>
    <Modal open={Boolean(selected)} title={selected?.id ?? ''} eyebrow="Approval review" onClose={() => setSelectedId(null)}>
      {selected && <div className="detail-stack"><div className="risk-score"><span>Blended risk</span><strong>{selected.risk}</strong><div><i style={{ width: `${selected.risk}%` }} /></div></div><div className="decision-reason"><strong>{selected.reason}</strong><p>This decision is added to the quotation audit trail.</p></div><div className="modal-actions split"><button type="button" className="danger-action" onClick={() => decide(selected.id, 'Rejected')}><X size={16} /> Reject</button><button type="button" className="primary-action" onClick={() => decide(selected.id, 'Approved')}><Check size={16} /> Approve</button></div></div>}
    </Modal>
  </div>;
}

export function FulfillmentView() {
  const [accepted, setAccepted] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = fulfillmentRecords.find((record) => record.id === selectedId);
  return <div className="page-stack">
    <PageHeader kicker="Operations" title="Fulfillment" description="Review warehouse splits, shipment count, and stock risk." />
    <section className="card-grid three-column">{fulfillmentRecords.map((record) => <article className="work-card" key={record.id}><header><span className="record-icon"><PackageCheck size={18} /></span><StatusPill value={accepted.includes(record.id) ? 'Approved' : record.status} /></header><div><span className="record-id">{record.id}</span><h3>{record.customer}</h3><p>{record.units} units across {record.warehouses}.</p></div><dl><div><dt>Shipments</dt><dd>{record.shipments}</dd></div><div><dt>Est. cost</dt><dd>{formatCurrency(record.cost)}</dd></div></dl><button type="button" className="secondary-action full" onClick={() => setSelectedId(record.id)}>View split <ChevronRight size={16} /></button></article>)}</section>
    <Modal open={Boolean(selected)} title={selected?.id ?? ''} eyebrow="Warehouse split" onClose={() => setSelectedId(null)}>
      {selected && <div className="detail-stack"><div className="warehouse-split"><div><Warehouse size={18} /><span><strong>Main Warehouse</strong><small>{Math.ceil(selected.units * .65)} units</small></span></div><div><Boxes size={18} /><span><strong>East Depot</strong><small>{Math.floor(selected.units * .35)} units</small></span></div></div><div className="form-note"><PackageCheck size={17} /><span>{selected.shipments} shipments · {formatCurrency(selected.cost)} estimated freight.</span></div><div className="modal-actions"><button type="button" className="secondary-action">Manual override</button><button type="button" className="primary-action" onClick={() => { setAccepted((items) => [...items, selected.id]); setSelectedId(null); }}><Check size={16} /> Accept split</button></div></div>}
    </Modal>
  </div>;
}

export function SubscriptionsView() {
  const [statuses, setStatuses] = useState<Record<string, string>>(() => Object.fromEntries(initialSubscriptions.map((item) => [item.id, item.status])));
  return <div className="page-stack"><PageHeader kicker="Recurring revenue" title="Subscriptions" description="One-time and recurring lines stay clear throughout billing." />
    <section className="data-panel"><div className="record-table subscription-table"><div className="record-table-head"><span>Subscription</span><span>Plan</span><span>Next bill</span><span>Amount</span><span>Status</span><span /></div>{initialSubscriptions.map((item) => { const active = statuses[item.id] === 'Active'; return <div className="record-row" key={item.id}><span className="record-primary"><strong>{item.customer}</strong><small>{item.id} · {item.cadence}</small></span><span data-label="Plan">{item.plan}</span><span data-label="Next bill">{item.nextBill}</span><span data-label="Amount">{formatCurrency(item.amount)}</span><span data-label="Status"><StatusPill value={statuses[item.id]} /></span><button type="button" className="row-action" onClick={() => setStatuses((current) => ({ ...current, [item.id]: active ? 'Paused' : 'Active' }))}>{active ? <Pause size={15} /> : <Play size={15} />}{active ? 'Pause' : 'Resume'}</button></div>; })}</div></section>
  </div>;
}

export function InvoicesView() {
  const [statuses, setStatuses] = useState<Record<string, string>>(() => Object.fromEntries(initialInvoices.map((item) => [item.id, item.status])));
  return <div className="page-stack"><PageHeader kicker="Quote to cash" title="Invoices" description="Track balances and record customer payments." action={<button type="button" className="secondary-action"><ReceiptIndianRupee size={17} /> New invoice</button>} />
    <section className="data-panel"><div className="record-table invoice-table"><div className="record-table-head"><span>Invoice</span><span>Amount</span><span>Due</span><span>Status</span><span /></div>{initialInvoices.map((item) => <div className="record-row" key={item.id}><span className="record-primary"><strong>{item.customer}</strong><small>{item.id}</small></span><span data-label="Amount">{formatCurrency(item.amount)}</span><span data-label="Due">{statuses[item.id] === 'Paid' ? 'Paid just now' : item.due}</span><span data-label="Status"><StatusPill value={statuses[item.id]} /></span><button type="button" className="row-action" disabled={statuses[item.id] === 'Paid'} onClick={() => setStatuses((current) => ({ ...current, [item.id]: 'Paid' }))}><CheckCircle2 size={15} />{statuses[item.id] === 'Paid' ? 'Recorded' : 'Record payment'}</button></div>)}</div></section>
  </div>;
}

export function DealHealthView() {
  const [alerts, setAlerts] = useState(initialHealthAlerts);
  return <div className="page-stack"><PageHeader kicker="Live monitoring" title="Deal Health" description="Act on stalled deals, pricing anomalies, and delivery risk." />
    <section className="health-summary"><div><span>Health score</span><strong>82</strong><small>Stable</small></div><div><TrendingUp size={20} /><span><strong>3.8%</strong><small>Improvement this week</small></span></div><div><AlertTriangle size={20} /><span><strong>{alerts.length}</strong><small>Open signals</small></span></div></section>
    <section className="alert-list">{alerts.length === 0 && <div className="success-empty"><CheckCircle2 size={24} /><strong>All signals resolved</strong></div>}{alerts.map((alert) => <article key={alert.id}><span className={`alert-severity ${alert.severity.toLowerCase()}`}><AlertTriangle size={18} /></span><div><span className="record-id">{alert.id} · {alert.age}</span><h3>{alert.title}</h3><p>{alert.detail}</p></div><StatusPill value={alert.severity} /><button type="button" className="secondary-action" onClick={() => setAlerts((items) => items.filter((item) => item.id !== alert.id))}>Resolve</button></article>)}</section>
  </div>;
}

export function ReportsView() {
  const [period, setPeriod] = useState('This month');
  const [team, setTeam] = useState('All reps');
  const exportCsv = () => {
    const csv = `metric,value\nQuoted value,1840000\nApproved value,1260000\nAverage margin,26.4%\nWin rate,38%\nPeriod,${period}\nTeam,${team}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dealflow360-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  const bars = [58, 72, 46, 84, 67, 92, 76];
  return <div className="page-stack"><PageHeader kicker="Performance" title="Reports" description="Filter sales performance and export a concise result." action={<button type="button" className="secondary-action" onClick={exportCsv}><Download size={17} /> Export CSV</button>} />
    <section className="report-filters"><label><span>Period</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option>This week</option><option>This month</option><option>This quarter</option></select></label><label><span>Sales rep</span><select value={team} onChange={(event) => setTeam(event.target.value)}><option>All reps</option><option>Hiten</option><option>Sujith Kumar</option></select></label></section>
    <section className="report-grid"><article className="report-chart"><header><div><span>Approved value</span><strong>{formatCurrency(1260000)}</strong></div><StatusPill value="Approved" /></header><div className="bar-chart" aria-label="Approved value trend">{bars.map((height, index) => <div key={index}><i style={{ height: `${height}%` }} /><span>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</span></div>)}</div></article><article className="report-breakdown"><span>Conversion</span><strong>38%</strong><div className="progress-ring"><span>38</span></div><p>12 of 32 quotations converted in {period.toLowerCase()}.</p></article></section>
    <section className="metric-grid compact"><article className="metric-card"><span className="metric-icon"><BadgeIndianRupee size={18} /></span><span>Quoted value</span><strong>{formatCurrency(1840000)}</strong><small>{team}</small></article><article className="metric-card"><span className="metric-icon"><TrendingUp size={18} /></span><span>Average margin</span><strong>26.4%</strong><small>+1.8% from prior period</small></article><article className="metric-card"><span className="metric-icon"><CirclePause size={18} /></span><span>Sales cycle</span><strong>9.4d</strong><small>1.2 days faster</small></article></section>
  </div>;
}
