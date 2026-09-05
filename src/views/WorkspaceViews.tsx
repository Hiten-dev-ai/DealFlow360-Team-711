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
import { CustomSelect, type SelectOption } from "../components/ui/CustomSelect";
import { downloadReport, mutate } from "../lib/api";
import { showToast } from "../components/ui/ToastViewport";
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

const QUOTE_STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "pending_manager", label: "Pending manager" },
  { value: "pending_finance", label: "Pending finance" },
  { value: "approved", label: "Approved" },
  { value: "negotiation", label: "Negotiation" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

const INVOICE_STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "All statuses" },
  { value: "due", label: "Due" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "draft", label: "Draft" },
];

const SUBSCRIPTION_STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
];

const APPROVAL_STAGE_OPTIONS: SelectOption[] = [
  { value: "all", label: "All stages" },
  { value: "manager", label: "Manager" },
  { value: "finance", label: "Finance / Ops" },
];

const FULFILLMENT_STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "All statuses" },
  { value: "ready", label: "Ready to allocate" },
  { value: "planned", label: "Planned" },
  { value: "reserved", label: "Reserved" },
  { value: "picking", label: "Picking" },
  { value: "partially_shipped", label: "Partially shipped" },
  { value: "shipped", label: "Shipped" },
  { value: "completed", label: "Completed" },
  { value: "backorder", label: "Backorder" },
];

const ALERT_SEVERITY_OPTIONS: SelectOption[] = [
  { value: "all", label: "All severity" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

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
  const { data, connection, role, run } = useWorkspace();
  const canEdit = role !== "finance_ops";
  const quotations = data.quotes;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState("");
  const [portalLink, setPortalLink] = useState("");
  const selected = quotations.find((quote) => quote.id === selectedId);
  const filtered = useMemo(
    () =>
      quotations.filter(
        (quote) =>
          `${text(quote.quoteNumber)} ${text(quote.customer)} ${text(quote.owner)} ${text(quote.tier)}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (status === "all" || text(quote.status) === status),
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
        action={canEdit ? (
          <button
            type="button"
            className="primary-action"
            disabled={connection !== "online"}
            onClick={() => setCreateOpen(true)}
          >
            <FilePlus2 size={17} /> New quotation
          </button>
        ) : undefined}
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
          <CustomSelect
            className="toolbar-custom-select"
            ariaLabel="Filter quotations by status"
            icon={<Filter size={15} />}
            options={QUOTE_STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
          />
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
                  {text(quote.quoteNumber)} · {text(quote.tier)} ·{" "}
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
            <CustomSelect
              name="customerId"
              ariaLabel="Customer"
              options={data.customers.map((customer) => ({
                value: text(customer.id),
                label: text(customer.name),
                detail: text(customer.tier),
              }))}
            />
          </label>
          <label>
            <span>Product</span>
            <CustomSelect
              name="productId"
              ariaLabel="Product"
              options={data.catalog.map((product) => ({
                value: text(product.id),
                label: text(product.name),
                detail: `${text(product.sku)} · ${formatMoney(product.priceMinor)}`,
              }))}
            />
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
                step="0.1"
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
        className="quotation-detail-modal"
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
              {canEdit && ((selected.suggestions as Row[]) ?? [])[0] && <button type="button" className="secondary-action" disabled={connection !== "online"} onClick={() => void addSuggestion(((selected.suggestions as Row[]) ?? [])[0])}>Add</button>}
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
              {canEdit && text(selected.status) === "approved" && <button
                type="button"
                className="secondary-action"
                disabled={connection !== "online"}
                onClick={createPortalLink}
              >
                Customer link
              </button>}
              {canEdit && ["draft", "negotiation"].includes(text(selected.status)) && (
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
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [error, setError] = useState("");
  const selected = data.approvals.find((record) => record.id === selectedId);
  const filtered = useMemo(
    () => data.approvals.filter((record) =>
      `${text(record.quoteNumber)} ${text(record.customer)}`.toLowerCase().includes(query.toLowerCase())
      && (stage === "all" || text(record.stage) === stage)),
    [data.approvals, query, stage],
  );
  const decide = async (decision: "approve" | "reject") => {
    if (!selected) return;
    const scrollTop = window.scrollY;
    try {
      await run(() =>
        mutate(`/api/approvals/${selected.id}/decision`, "POST", { decision }),
      );
      showToast(decision === "approve" ? "Quotation approved." : "Quotation rejected.", decision === "approve" ? "success" : "warning");
      setSelectedId(null);
      window.requestAnimationFrame(() => window.scrollTo({ top: scrollTop }));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Decision failed.";
      setError(message);
      showToast(message, "error");
    }
  };
  return (
    <div className="page-stack">
      <PageHeader
        kicker="Governance"
        title="Approvals"
        description="Review exceptions with the risk and margin context visible."
      />
      <div className="data-toolbar standalone-toolbar">
        <label className="toolbar-search">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search approvals" />
        </label>
        <CustomSelect
          className="toolbar-custom-select"
          ariaLabel="Filter approvals by stage"
          icon={<Filter size={15} />}
          options={APPROVAL_STAGE_OPTIONS}
          value={stage}
          onChange={setStage}
        />
        <span className="result-count">{filtered.length} pending</span>
      </div>
      <section className="card-grid three-column">
        {filtered.length === 0 && (
          <EmptyState title="No approvals waiting" />
        )}
        {filtered.map((record) => (
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
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  const allocatable = data.quotes.filter(
    (quote) =>
      quote.status === "accepted" &&
      !data.fulfillment.some((order) => order.quoteId === quote.id),
  );
  const filteredAllocatable = allocatable.filter((quote) =>
    `${text(quote.quoteNumber)} ${text(quote.customer)}`.toLowerCase().includes(query.toLowerCase())
    && (status === "all" || status === "ready"),
  );
  const filteredFulfillment = data.fulfillment.filter((record) =>
    `${text(record.quoteNumber)} ${text(record.customer)} ${(record.shipments as Row[] ?? []).map((shipment) => text(shipment.warehouse)).join(" ")}`.toLowerCase().includes(query.toLowerCase())
    && (status === "all" || text(record.status) === status),
  );
  const allocate = async (quoteId: unknown) => {
    try {
      await run(() =>
        mutate(`/api/fulfillment/quotes/${quoteId}/allocate`, "POST"),
      );
      showToast("Inventory allocated.", "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Allocation failed.";
      setError(message);
      showToast(message, "error");
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
      <div className="data-toolbar standalone-toolbar">
        <label className="toolbar-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search fulfillment" /></label>
        <CustomSelect className="toolbar-custom-select" ariaLabel="Filter fulfillment by status" icon={<Filter size={15} />} options={FULFILLMENT_STATUS_OPTIONS} value={status} onChange={setStatus} />
        <span className="result-count">{filteredAllocatable.length + filteredFulfillment.length} records</span>
      </div>
      <section className="card-grid three-column">
        {filteredAllocatable.map((quote) => (
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
        {filteredFulfillment.map((record) => {
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
        {!filteredAllocatable.length && !filteredFulfillment.length && (
          <EmptyState title="No fulfillment records" />
        )}
      </section>
    </div>
  );
}

export function SubscriptionsView() {
  const { data, connection, run } = useWorkspace();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  const filtered = useMemo(
    () => data.subscriptions.filter((item) =>
      `${text(item.customer)} ${text(item.plan)}`.toLowerCase().includes(query.toLowerCase())
      && (status === "all" || text(item.status) === status)),
    [data.subscriptions, query, status],
  );
  const toggle = async (item: Row) => {
    try {
      await run(() =>
        mutate(`/api/subscriptions/${item.id}`, "PATCH", {
          status: item.status === "active" ? "paused" : "active",
          expectedVersion: amount(item.version),
        }),
      );
      showToast(item.status === "active" ? "Subscription paused." : "Subscription resumed.", item.status === "active" ? "warning" : "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Update failed.";
      setError(message);
      showToast(message, "error");
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
        <div className="data-toolbar">
          <label className="toolbar-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subscriptions" />
          </label>
          <CustomSelect
            className="toolbar-custom-select"
            ariaLabel="Filter subscriptions by status"
            icon={<Filter size={15} />}
            options={SUBSCRIPTION_STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
          />
          <span className="result-count">{filtered.length} records</span>
        </div>
        <div className="record-table subscription-table">
          <div className="record-table-head">
            <span>Subscription</span>
            <span>Plan</span>
            <span>Next bill</span>
            <span>Amount</span>
            <span>Status</span>
            <span />
          </div>
          {filtered.map((item) => (
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
          {!filtered.length && (
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
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerQuery, setLedgerQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  const selected = data.invoices.find((item) => item.id === selectedId);
  const filtered = useMemo(
    () => data.invoices.filter((item) =>
      `${text(item.invoiceNumber)} ${text(item.customer)}`.toLowerCase().includes(query.toLowerCase())
      && (status === "all" || text(item.status) === status)),
    [data.invoices, query, status],
  );
  const ledgerEntries = useMemo(() => data.payments.filter((item) =>
    `${text(item.invoiceNumber)} ${text(item.customer)} ${text(item.reference)} ${text(item.recordedBy)}`.toLowerCase().includes(ledgerQuery.toLowerCase())),
  [data.payments, ledgerQuery]);
  const pay = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const enteredAmount = Number(form.get("amount"));
    const amountMinor = Math.round(enteredAmount * 100);
    const balanceMinor = amount(selected.totalMinor) - amount(selected.paidMinor);
    if (!Number.isFinite(enteredAmount) || amountMinor < 1 || amountMinor > balanceMinor) {
      setError("Enter an amount within the outstanding balance.");
      return;
    }
    setError("");
    try {
      await run(() =>
        mutate(
          `/api/invoices/${selected.id}/payments`,
          "POST",
          {
            amountMinor,
            reference: form.get("reference"),
          },
          crypto.randomUUID(),
        ),
      );
      showToast("Payment recorded.", "success");
      setSelectedId(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Payment failed.";
      setError(message);
      showToast(message, "error");
    }
  };
  return (
    <div className="page-stack">
      <PageHeader
        kicker="Quote to cash"
        title="Invoices"
        description="Track balances and record customer payments."
        action={
          <button type="button" className="secondary-action" onClick={() => setLedgerOpen(true)}>
            <ReceiptIndianRupee size={17} /> Internal ledger
          </button>
        }
      />
      <section className="data-panel">
        <div className="data-toolbar">
          <label className="toolbar-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoices" />
          </label>
          <CustomSelect
            className="toolbar-custom-select"
            ariaLabel="Filter invoices by status"
            icon={<Filter size={15} />}
            options={INVOICE_STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
          />
          <span className="result-count">{filtered.length} records</span>
        </div>
        <div className="record-table invoice-table">
          <div className="record-table-head">
            <span>Invoice</span>
            <span>Amount</span>
            <span>Due</span>
            <span>Status</span>
            <span />
          </div>
          {filtered.map((item) => (
            <div className="record-row" key={text(item.id)}>
              <span className="record-primary">
                <strong>{text(item.customer)}</strong>
                <small>INV-{text(item.invoiceNumber).padStart(4, "0")}</small>
              </span>
              <span className="record-money" data-label="Amount">
                <strong>{formatMoney(item.totalMinor)}</strong>
                <small>{formatMoney(amount(item.totalMinor) - amount(item.paidMinor))} open</small>
              </span>
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
          {!filtered.length && <EmptyState title="No invoices" />}
        </div>
      </section>
      <Modal
        open={ledgerOpen}
        title="Payment ledger"
        eyebrow="Internal ledger"
        className="wide ledger-modal"
        onClose={() => { setLedgerOpen(false); setLedgerQuery(""); }}
      >
        <div className="ledger-summary">
          <span><small>Collected</small><strong>{formatMoney(data.payments.reduce((sum, item) => sum + amount(item.amountMinor), 0))}</strong></span>
          <span><small>Entries</small><strong>{data.payments.length}</strong></span>
        </div>
        <label className="toolbar-search ledger-search"><Search size={16} /><input value={ledgerQuery} onChange={(event) => setLedgerQuery(event.target.value)} placeholder="Search reference, invoice or customer" /></label>
        <div className="ledger-list">
          {ledgerEntries.map((item) => <article key={text(item.id)}>
            <span className="record-icon"><ReceiptIndianRupee size={16} /></span>
            <span><strong>{text(item.customer)}</strong><small>INV-{text(item.invoiceNumber).padStart(4, "0")} · {text(item.reference)}</small></span>
            <span><strong>{formatMoney(item.amountMinor)}</strong><small>{new Date(text(item.receivedAt)).toLocaleString()}</small></span>
          </article>)}
          {!ledgerEntries.length && <EmptyState title="No ledger entries" />}
        </div>
      </Modal>
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
                min="0.01"
                step="0.01"
                inputMode="decimal"
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
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const high = data.alerts.filter((alert) => alert.severity === "high").length;
  const score = Math.max(0, 100 - high * 8 - (data.alerts.length - high) * 3);
  const filteredAlerts = useMemo(() => data.alerts.filter((alert) =>
    `${text(alert.title)} ${text(alert.message)} ${text(alert.category)}`.toLowerCase().includes(query.toLowerCase())
    && (severity === "all" || text(alert.severity) === severity),
  ), [data.alerts, query, severity]);
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
      <div className="data-toolbar standalone-toolbar">
        <label className="toolbar-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search deal signals" /></label>
        <CustomSelect className="toolbar-custom-select" ariaLabel="Filter deal health by severity" icon={<Filter size={15} />} options={ALERT_SEVERITY_OPTIONS} value={severity} onChange={setSeverity} />
        <span className="result-count">{filteredAlerts.length} signals</span>
      </div>
      <section className="alert-list">
        {filteredAlerts.length === 0 && (
          <div className="success-empty">
            <CheckCircle2 size={24} />
            <strong>All signals resolved</strong>
          </div>
        )}
        {filteredAlerts.map((alert) => (
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
  const [downloading, setDownloading] = useState<"pdf" | "xls" | null>(null);
  const [error, setError] = useState("");
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
  const download = async (format: "pdf" | "xls") => {
    setDownloading(format);
    setError("");
    try {
      const file = await downloadReport(format);
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Report download failed.");
    } finally {
      setDownloading(null);
    }
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
              disabled={connection !== "online" || downloading !== null}
              onClick={() => void download("pdf")}
            >
              <Download size={17} /> {downloading === "pdf" ? "Preparing" : "PDF"}
            </button>
            <button
              type="button"
              className="secondary-action"
              disabled={connection !== "online" || downloading !== null}
              onClick={() => void download("xls")}
            >
              <Download size={17} /> {downloading === "xls" ? "Preparing" : "XLS"}
            </button>
          </div>
        }
      />
      <ErrorText value={error} />
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
