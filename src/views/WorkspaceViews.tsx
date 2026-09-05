import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeIndianRupee,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  FilePlus2,
  Filter,
  PackageCheck,
  Pause,
  Play,
  ReceiptIndianRupee,
  Search,
  Send,
  Sparkles,
  TrendingUp,
  Warehouse,
  X,
} from "lucide-react";
import { Modal } from "../components/ui/Modal";
import { mutate } from "../lib/api";
import { statusTone } from "../lib/demo-data";
import { useWorkspace } from "../lib/workspace";

type Row = Record<string, unknown>;
const text = (value: unknown) => String(value ?? "");
const amount = (value: unknown) => Number(value ?? 0);
const formatMoney = (minor: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount(minor) / 100);
const titleCase = (value: unknown) =>
  text(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

function PageHeader({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="page-heading">
      <div>
        <span className="page-kicker">{kicker}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </section>
  );
}
function StatusPill({ value }: { value: unknown }) {
  const label = titleCase(value);
  return <span className={`status-pill ${statusTone(label)}`}>{label}</span>;
}
function EmptyState({ title }: { title: string }) {
  return (
    <div className="inline-empty">
      <Search size={20} />
      <strong>{title}</strong>
      <span>No records to show.</span>
    </div>
  );
}
function ErrorText({ value }: { value: string }) {
  return value ? (
    <p className="login-error" role="alert">
      {value}
    </p>
  ) : null;
}

export function QuotationsView() {
  const { data, connection, run } = useWorkspace();
  const quotations = data.quotes;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState("");
  const [portalLink, setPortalLink] = useState("");
  const selected = quotations.find((quote) => quote.id === selectedId);
  const filtered = useMemo(
    () =>
      quotations.filter(
        (quote) =>
          `${text(quote.quoteNumber)} ${text(quote.customer)} ${text(quote.owner)}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (status === "All" || titleCase(quote.status) === status),
      ),
    [query, quotations, status],
  );

  const createQuote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await run(() =>
        mutate("/api/quotes", "POST", {
          customerId: form.get("customerId"),
          lines: [
            {
              productId: form.get("productId"),
              quantity: Number(form.get("quantity")),
              discountBps: Number(form.get("discount")) * 100,
            },
          ],
        }),
      );
      setCreateOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create quotation.",
      );
    }
  };
  const submit = async () => {
    if (!selected) return;
    setError("");
    try {
      await run(() => mutate(`/api/quotes/${selected.id}/submit`, "POST"));
      setSelectedId(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not submit quotation.",
      );
    }
  };
  const createPortalLink = async () => {
    if (!selected) return;
    try {
      const result = await run(() =>
        mutate<{ data: { link: string } }>(
          `/api/quotes/${selected.id}/portal-link`,
          "POST",
        ),
      );
      setPortalLink(result.data.link);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create link.",
      );
    }
  };
  const addSuggestion = async (suggestion: Row) => {
    if (!selected) return;
    try {
      await run(() =>
        mutate(`/api/quotes/${selected.id}/lines`, "POST", {
          productId: suggestion.productId,
          quantity: 1,
          discountBps: 0,
          expectedVersion: amount(selected.version),
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add suggestion.");
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        kicker="Sales workspace"
        title="Quotations"
        description="Build, govern, and track every customer offer."
        action={
          <button
            type="button"
            className="primary-action"
            disabled={connection !== "online"}
            onClick={() => setCreateOpen(true)}
          >
            <FilePlus2 size={17} /> New quotation
          </button>
        }
      />
      <section className="data-panel">
        <div className="data-toolbar">
          <label className="toolbar-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search quotations"
            />
          </label>
          <label className="toolbar-select">
            <Filter size={15} />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option>All</option>
              <option>Draft</option>
              <option>Pending Manager</option>
              <option>Pending Finance</option>
              <option>Approved</option>
              <option>Negotiation</option>
              <option>Accepted</option>
            </select>
          </label>
          <span className="result-count">{filtered.length} records</span>
        </div>
        <div className="record-table quotation-table">
          <div className="record-table-head">
            <span>Quotation</span>
            <span>Owner</span>
            <span>Value</span>
            <span>Margin</span>
            <span>Status</span>
            <span />
          </div>
          {filtered.length === 0 && <EmptyState title="No quotations found" />}
          {filtered.map((quote) => (
            <button
              type="button"
              className="record-row"
              key={text(quote.id)}
              onClick={() => setSelectedId(text(quote.id))}
            >
              <span className="record-primary">
                <strong>{text(quote.customer)}</strong>
                <small>
                  {text(quote.quoteNumber)} ·{" "}
                  {new Date(text(quote.updatedAt)).toLocaleString()}
                </small>
              </span>
              <span data-label="Owner">{text(quote.owner)}</span>
              <span data-label="Value">{formatMoney(quote.totalMinor)}</span>
              <span data-label="Margin">
                {(amount(quote.marginBps) / 100).toFixed(1)}%
              </span>
              <span data-label="Status">
                <StatusPill value={quote.status} />
              </span>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      </section>
      <Modal
        open={createOpen}
        title="New quotation"
        eyebrow="Draft"
        onClose={() => {
          setCreateOpen(false);
          setError("");
        }}
      >
        <form className="modal-form" onSubmit={createQuote}>
          <label>
            <span>Customer</span>
            <select name="customerId" required>
              {data.customers.map((customer) => (
                <option key={text(customer.id)} value={text(customer.id)}>
                  {text(customer.name)} · {text(customer.tier)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Product</span>
            <select name="productId" required>
              {data.catalog.map((product) => (
                <option key={text(product.id)} value={text(product.id)}>
                  {text(product.name)} · {formatMoney(product.priceMinor)}
                </option>
              ))}
            </select>
          </label>
          <div className="form-columns">
            <label>
              <span>Quantity</span>
              <input
                name="quantity"
                type="number"
                min="1"
                defaultValue="1"
                required
              />
            </label>
            <label>
              <span>Discount %</span>
              <input
                name="discount"
                type="number"
                min="0"
                max="100"
                defaultValue="0"
                required
              />
            </label>
          </div>
          <div className="form-note">
            <Sparkles size={17} />
            <span>
              Pricing, margin, and approvals are calculated by the server.
            </span>
          </div>
          <ErrorText value={error} />
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="primary-action">
              Create draft <ArrowRight size={17} />
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(selected)}
        title={text(selected?.quoteNumber)}
        eyebrow="Quotation detail"
        onClose={() => {
          setSelectedId(null);
          setPortalLink("");
          setError("");
        }}
        size="wide"
      >
        {selected && (
          <div className="detail-stack">
            <div className="detail-hero">
              <div>
                <span>Customer</span>
                <h3>{text(selected.customer)}</h3>
                <p>
                  Owned by {text(selected.owner)} · Revision{" "}
                  {text(selected.revision)}
                </p>
              </div>
              <StatusPill value={selected.status} />
            </div>
            <div className="detail-metrics">
              <div>
                <span>Quote value</span>
                <strong>{formatMoney(selected.totalMinor)}</strong>
              </div>
              <div>
                <span>Risk</span>
                <strong>{text(selected.riskScore)}/100</strong>
              </div>
              <div>
                <span>Live margin</span>
                <strong>
                  {(amount(selected.marginBps) / 100).toFixed(1)}%
                </strong>
              </div>
            </div>
            <div className="suggestion-card">
              <Sparkles size={19} />
              <div>
                <strong>
                  {((selected.suggestions as Row[]) ?? [])[0]
                    ? text(((selected.suggestions as Row[]) ?? [])[0].product)
                    : "Governed pricing"}
                </strong>
                <p>{((selected.suggestions as Row[]) ?? [])[0]
                  ? `${formatMoney(((selected.suggestions as Row[]) ?? [])[0].marginImpactMinor)} expected margin contribution.`
                  : ((selected.approvalRoute as unknown[]) ?? []).length
                    ? `Route: ${(selected.approvalRoute as string[]).join(" → ")}`
                    : "Eligible for automatic approval."}</p>
              </div>
              {((selected.suggestions as Row[]) ?? [])[0] && <button type="button" className="secondary-action" disabled={connection !== "online"} onClick={() => void addSuggestion(((selected.suggestions as Row[]) ?? [])[0])}>Add</button>}
            </div>
            {portalLink && (
              <div className="form-note">
                <span className="portal-link-text">{portalLink}</span>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => navigator.clipboard.writeText(portalLink)}
                >
                  Copy
                </button>
              </div>
            )}
            <ErrorText value={error} />
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-action"
                disabled={connection !== "online"}
                onClick={createPortalLink}
              >
                Customer link
              </button>
              {["draft", "negotiation"].includes(text(selected.status)) && (
                <button
                  type="button"
                  className="primary-action"
                  disabled={connection !== "online"}
                  onClick={submit}
                >
                  <Send size={16} /> Send for approval
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function ApprovalsView() {
  const { data, connection, run } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const selected = data.approvals.find((record) => record.id === selectedId);
  const decide = async (decision: "approve" | "reject") => {
    if (!selected) return;
    try {
      await run(() =>
        mutate(`/api/approvals/${selected.id}/decision`, "POST", { decision }),
      );
      setSelectedId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Decision failed.");
    }
  };
  return (
    <div className="page-stack">
      <PageHeader
        kicker="Governance"
        title="Approvals"
        description="Review exceptions with the risk and margin context visible."
      />
      <section className="card-grid three-column">
        {data.approvals.length === 0 && (
          <EmptyState title="No approvals waiting" />
        )}
        {data.approvals.map((record) => (
          <article className="work-card" key={text(record.id)}>
            <header>
              <span className="record-icon">
                <AlertTriangle size={18} />
              </span>
              <StatusPill value={record.status} />
            </header>
            <div>
              <span className="record-id">
                Q-{text(record.quoteNumber).padStart(4, "0")}
              </span>
              <h3>{text(record.customer)}</h3>
              <p>{titleCase(record.stage)} review required.</p>
            </div>
            <dl>
              <div>
                <dt>Value</dt>
                <dd>{formatMoney(record.totalMinor)}</dd>
              </div>
              <div>
                <dt>Risk</dt>
                <dd>{text(record.riskScore)}/100</dd>
              </div>
              <div>
                <dt>Step</dt>
                <dd>{titleCase(record.stage)}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="secondary-action full"
              onClick={() => setSelectedId(text(record.id))}
            >
              Review decision <ChevronRight size={16} />
            </button>
          </article>
        ))}
      </section>
      <Modal
        open={Boolean(selected)}
        title={
          selected ? `Q-${text(selected.quoteNumber).padStart(4, "0")}` : ""
        }
        eyebrow="Approval review"
        onClose={() => setSelectedId(null)}
      >
        {selected && (
          <div className="detail-stack">
            <div className="risk-score">
              <span>Blended risk</span>
              <strong>{text(selected.riskScore)}</strong>
              <div>
                <i style={{ width: `${text(selected.riskScore)}%` }} />
              </div>
            </div>
            <div className="decision-reason">
              <strong>{titleCase(selected.stage)} approval</strong>
              <p>The decision is recorded in the immutable audit trail.</p>
            </div>
            <ErrorText value={error} />
            <div className="modal-actions split">
              <button
                type="button"
                className="danger-action"
                disabled={connection !== "online"}
                onClick={() => void decide("reject")}
              >
                <X size={16} /> Reject
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={connection !== "online"}
                onClick={() => void decide("approve")}
              >
                <Check size={16} /> Approve
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function FulfillmentView() {
  const { data, connection, run } = useWorkspace();
  const [error, setError] = useState("");
  const allocatable = data.quotes.filter(
    (quote) =>
      quote.status === "accepted" &&
      !data.fulfillment.some((order) => order.quoteId === quote.id),
  );
  const allocate = async (quoteId: unknown) => {
    try {
      await run(() =>
        mutate(`/api/fulfillment/quotes/${quoteId}/allocate`, "POST"),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Allocation failed.");
    }
  };
  return (
    <div className="page-stack">
      <PageHeader
        kicker="Operations"
        title="Fulfillment"
        description="Review warehouse splits, shipment count, and stock risk."
      />
      <ErrorText value={error} />
      <section className="card-grid three-column">
        {allocatable.map((quote) => (
          <article className="work-card" key={text(quote.id)}>
            <header>
              <span className="record-icon">
                <PackageCheck size={18} />
              </span>
              <StatusPill value="Ready" />
            </header>
            <div>
              <span className="record-id">{text(quote.quoteNumber)}</span>
              <h3>{text(quote.customer)}</h3>
              <p>Accepted and ready for stock allocation.</p>
            </div>
            <button
              type="button"
              className="primary-action full"
              disabled={connection !== "online"}
              onClick={() => void allocate(quote.id)}
            >
              Allocate stock
            </button>
          </article>
        ))}
        {data.fulfillment.map((record) => {
          const shipments = (record.shipments as Row[]) ?? [];
          return (
            <article className="work-card" key={text(record.id)}>
              <header>
                <span className="record-icon">
                  <PackageCheck size={18} />
                </span>
                <StatusPill value={record.status} />
              </header>
              <div>
                <span className="record-id">
                  Q-{text(record.quoteNumber).padStart(4, "0")}
                </span>
                <h3>{text(record.customer)}</h3>
                <p>
                  {shipments.length} planned shipment
                  {shipments.length === 1 ? "" : "s"}.
                </p>
              </div>
              <dl>
                <div>
                  <dt>Shipments</dt>
                  <dd>{shipments.length}</dd>
                </div>
                <div>
                  <dt>Est. cost</dt>
                  <dd>
                    {formatMoney(
                      shipments.reduce(
                        (sum, item) => sum + amount(item.shippingCostMinor),
                        0,
                      ),
                    )}
                  </dd>
                </div>
              </dl>
              <div className="warehouse-split">
                {shipments.map((shipment) => (
                  <div key={text(shipment.id)}>
                    {text(shipment.status) === "backorder" ? (
                      <Boxes size={18} />
                    ) : (
                      <Warehouse size={18} />
                    )}
                    <span>
                      <strong>{text(shipment.warehouse) || "Backorder"}</strong>
                      <small>
                        {((shipment.lines as unknown[]) ?? []).length} product
                        lines
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
        {!allocatable.length && !data.fulfillment.length && (
          <EmptyState title="No fulfillment records" />
        )}
      </section>
    </div>
  );
}

export function SubscriptionsView() {
  const { data, connection, run } = useWorkspace();
  const [error, setError] = useState("");
  const toggle = async (item: Row) => {
    try {
      await run(() =>
        mutate(`/api/subscriptions/${item.id}`, "PATCH", {
          status: item.status === "active" ? "paused" : "active",
          expectedVersion: amount(item.version),
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Update failed.");
    }
  };
  return (
    <div className="page-stack">
      <PageHeader
        kicker="Recurring revenue"
        title="Subscriptions"
        description="One-time and recurring lines stay clear throughout billing."
      />
      <ErrorText value={error} />
      <section className="data-panel">
        <div className="record-table subscription-table">
          <div className="record-table-head">
            <span>Subscription</span>
            <span>Plan</span>
            <span>Next bill</span>
            <span>Amount</span>
            <span>Status</span>
            <span />
          </div>
          {data.subscriptions.map((item) => (
            <div className="record-row" key={text(item.id)}>
              <span className="record-primary">
                <strong>{text(item.customer)}</strong>
                <small>
                  {text(item.id).slice(0, 8)} · {titleCase(item.cadence)}
                </small>
              </span>
              <span data-label="Plan">{text(item.plan)}</span>
              <span data-label="Next bill">
                {new Date(text(item.nextBillOn)).toLocaleDateString()}
              </span>
              <span data-label="Amount">
                {formatMoney(item.unitPriceMinor)}
              </span>
              <span data-label="Status">
                <StatusPill value={item.status} />
              </span>
              <button
                type="button"
                className="row-action"
                disabled={
                  connection !== "online" || item.status === "cancelled"
                }
                onClick={() => void toggle(item)}
              >
                {item.status === "active" ? (
                  <Pause size={15} />
                ) : (
                  <Play size={15} />
                )}
                {item.status === "active" ? "Pause" : "Resume"}
              </button>
            </div>
          ))}
          {!data.subscriptions.length && (
            <EmptyState title="No subscriptions" />
          )}
        </div>
      </section>
    </div>
  );
}

export function InvoicesView() {
  const { data, connection, run } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const selected = data.invoices.find((item) => item.id === selectedId);
  const pay = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      await run(() =>
        mutate(
          `/api/invoices/${selected.id}/payments`,
          "POST",
          {
            amountMinor: Math.round(Number(form.get("amount")) * 100),
            reference: form.get("reference"),
          },
          crypto.randomUUID(),
        ),
      );
      setSelectedId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment failed.");
    }
  };
  return (
    <div className="page-stack">
      <PageHeader
        kicker="Quote to cash"
        title="Invoices"
        description="Track balances and record customer payments."
        action={
          <span className="secondary-action">
            <ReceiptIndianRupee size={17} /> Internal ledger
          </span>
        }
      />
      <section className="data-panel">
        <div className="record-table invoice-table">
          <div className="record-table-head">
            <span>Invoice</span>
            <span>Amount</span>
            <span>Due</span>
            <span>Status</span>
            <span />
          </div>
          {data.invoices.map((item) => (
            <div className="record-row" key={text(item.id)}>
              <span className="record-primary">
                <strong>{text(item.customer)}</strong>
                <small>INV-{text(item.invoiceNumber).padStart(4, "0")}</small>
              </span>
              <span data-label="Amount">{formatMoney(item.totalMinor)}</span>
              <span data-label="Due">
                {new Date(text(item.dueOn)).toLocaleDateString()}
              </span>
              <span data-label="Status">
                <StatusPill value={item.status} />
              </span>
              <button
                type="button"
                className="row-action"
                disabled={connection !== "online" || item.status === "paid"}
                onClick={() => setSelectedId(text(item.id))}
              >
                <CheckCircle2 size={15} />
                {item.status === "paid" ? "Paid" : "Record payment"}
              </button>
            </div>
          ))}
          {!data.invoices.length && <EmptyState title="No invoices" />}
        </div>
      </section>
      <Modal
        open={Boolean(selected)}
        title="Record payment"
        eyebrow="Internal ledger"
        onClose={() => setSelectedId(null)}
      >
        {selected && (
          <form className="modal-form" onSubmit={pay}>
            <label>
              <span>Amount</span>
              <input
                name="amount"
                type="number"
                min="1"
                max={
                  (amount(selected.totalMinor) - amount(selected.paidMinor)) /
                  100
                }
                defaultValue={
                  (amount(selected.totalMinor) - amount(selected.paidMinor)) /
                  100
                }
                required
              />
            </label>
            <label>
              <span>Reference</span>
              <input
                name="reference"
                placeholder="Bank or receipt reference"
                required
              />
            </label>
            <ErrorText value={error} />
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={() => setSelectedId(null)}
              >
                Cancel
              </button>
              <button type="submit" className="primary-action">
                Record payment
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export function DealHealthView() {
  const { data } = useWorkspace();
  const high = data.alerts.filter((alert) => alert.severity === "high").length;
  const score = Math.max(0, 100 - high * 8 - (data.alerts.length - high) * 3);
  return (
    <div className="page-stack">
      <PageHeader
        kicker="Live monitoring"
        title="Deal Health"
        description="Act on stalled deals, pricing anomalies, and delivery risk."
      />
      <section className="health-summary">
        <div>
          <span>Health score</span>
          <strong>{score}</strong>
          <small>{score >= 80 ? "Stable" : "Needs attention"}</small>
        </div>
        <div>
          <TrendingUp size={20} />
          <span>
            <strong>{data.quotes.length}</strong>
            <small>Tracked quotations</small>
          </span>
        </div>
        <div>
          <AlertTriangle size={20} />
          <span>
            <strong>{data.alerts.length}</strong>
            <small>Open signals</small>
          </span>
        </div>
      </section>
      <section className="alert-list">
        {data.alerts.length === 0 && (
          <div className="success-empty">
            <CheckCircle2 size={24} />
            <strong>All signals resolved</strong>
          </div>
        )}
        {data.alerts.map((alert) => (
          <article key={text(alert.id)}>
            <span className={`alert-severity ${text(alert.severity)}`}>
              <AlertTriangle size={18} />
            </span>
            <div>
              <span className="record-id">{titleCase(alert.category)}</span>
              <h3>{text(alert.title)}</h3>
              <p>{text(alert.message)}</p>
            </div>
            <StatusPill value={alert.severity} />
          </article>
        ))}
      </section>
    </div>
  );
}

export function ReportsView() {
  const { data, connection } = useWorkspace();
  const quoted = data.quotes.reduce(
    (sum, quote) => sum + amount(quote.totalMinor),
    0,
  );
  const approved = data.quotes
    .filter((quote) => ["approved", "accepted"].includes(text(quote.status)))
    .reduce((sum, quote) => sum + amount(quote.totalMinor), 0);
  const averageMargin = data.quotes.length
    ? data.quotes.reduce((sum, quote) => sum + amount(quote.marginBps), 0) /
      data.quotes.length /
      100
    : 0;
  const download = (format: "pdf" | "xls") => {
    window.location.assign(`/api/reports/deals.${format}`);
  };
  return (
    <div className="page-stack">
      <PageHeader
        kicker="Performance"
        title="Reports"
        description="Export governed sales performance."
        action={
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-action"
              disabled={connection === "offline"}
              onClick={() => download("pdf")}
            >
              <Download size={17} /> PDF
            </button>
            <button
              type="button"
              className="secondary-action"
              disabled={connection === "offline"}
              onClick={() => download("xls")}
            >
              <Download size={17} /> XLS
            </button>
          </div>
        }
      />
      <section className="metric-grid compact">
        <article className="metric-card">
          <span className="metric-icon">
            <BadgeIndianRupee size={18} />
          </span>
          <span>Quoted value</span>
          <strong>{formatMoney(quoted)}</strong>
          <small>{data.quotes.length} quotations</small>
        </article>
        <article className="metric-card">
          <span className="metric-icon">
            <TrendingUp size={18} />
          </span>
          <span>Approved value</span>
          <strong>{formatMoney(approved)}</strong>
          <small>Server-scoped result</small>
        </article>
        <article className="metric-card">
          <span className="metric-icon">
            <TrendingUp size={18} />
          </span>
          <span>Average margin</span>
          <strong>{averageMargin.toFixed(1)}%</strong>
          <small>Current workspace</small>
        </article>
      </section>
    </div>
  );
}
