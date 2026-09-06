import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
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
  Pencil,
  Play,
  Plus,
  ReceiptIndianRupee,
  Search,
  Send,
  Sparkles,
  Tags,
  TrendingUp,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import { Modal } from "../components/ui/Modal";
import { CustomSelect, type SelectOption } from "../components/ui/CustomSelect";
import { ApiError, downloadReport, mutate } from "../lib/api";
import { showToast } from "../components/ui/ToastViewport";
import { statusTone } from "../lib/demo-data";
import { useWorkspace } from "../lib/workspace";

type Row = Record<string, unknown>;
interface SearchFocusProps { focusId?: string | null; focusRequest?: number }
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
  action,
}: {
  kicker: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return action ? <section className="page-actions-row">{action}</section> : null;
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

export function QuotationsView({ focusId, focusRequest }: SearchFocusProps) {
  const { data, connection, role, run } = useWorkspace();
  const canEdit = role !== "finance_ops";
  const canShareCustomerLink = ["admin", "sales_rep", "sales_manager"].includes(role);
  const quotations = data.quotes;
  const tiers = data.tiers ?? [];
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [tierPanelOpen, setTierPanelOpen] = useState(false);
  const [tierEditor, setTierEditor] = useState<Row | "new" | null>(null);
  const [confirmTierDelete, setConfirmTierDelete] = useState(false);
  const [replacementTierId, setReplacementTierId] = useState("");
  const [error, setError] = useState("");
  const [portalLink, setPortalLink] = useState("");
  const selected = quotations.find((quote) => quote.id === selectedId);
  useEffect(() => {
    if (focusId && quotations.some((quote) => text(quote.id) === focusId)) setSelectedId(focusId);
  }, [focusId, focusRequest, quotations]);
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
    setError("");
    try {
      const result = await run(() =>
        mutate<{ data: { link: string; delivered: boolean } }>(
          `/api/quotes/${selected.id}/portal-link`,
          "POST",
        ),
      );
      setPortalLink(result.data.link);
      showToast(
        result.data.delivered ? "Customer link emailed." : "Customer link ready to copy.",
        "success",
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not create link.";
      setError(message);
      showToast(message, "error");
    }
  };
  const copyPortalLink = async () => {
    try {
      await navigator.clipboard.writeText(portalLink);
      showToast("Customer link copied.", "success");
    } catch {
      showToast("Could not copy the link.", "error");
    }
  };
  const saveTier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: text(form.get("name")).trim(),
      overdueRisk: Number(form.get("overdueRisk")),
      discountCeilingBps: Math.round(Number(form.get("discountCeiling")) * 100),
      ...(tierEditor !== "new" ? { expectedVersion: amount(tierEditor?.version) } : {}),
    };
    try {
      await run(() => mutate(
        tierEditor === "new" ? "/api/admin/tiers" : `/api/admin/tiers/${tierEditor?.id}`,
        tierEditor === "new" ? "POST" : "PATCH",
        payload,
      ));
      showToast(tierEditor === "new" ? "Tier created." : "Tier updated.", "success");
      setTierEditor(null);
      setConfirmTierDelete(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not save tier.";
      setError(message);
      showToast(message, "error");
    }
  };
  const deleteTier = async () => {
    if (!tierEditor || tierEditor === "new") return;
    if (!confirmTierDelete) {
      setConfirmTierDelete(true);
      return;
    }
    try {
      await run(() => mutate(`/api/admin/tiers/${tierEditor.id}`, "DELETE", {
        expectedVersion: amount(tierEditor.version),
        ...(replacementTierId ? { replacementTierId } : {}),
      }));
      showToast("Tier deleted.", "success");
      setTierEditor(null);
      setConfirmTierDelete(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not delete tier.";
      setError(message);
      showToast(message, "error");
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
          <div className="page-action-group">
            {role === "admin" && <button
              type="button"
              className="secondary-action"
              onClick={() => { setTierPanelOpen(true); setTierEditor(null); setReplacementTierId(""); setError(""); }}
            >
              <Tags size={17} /> Manage tiers
            </button>}
            <button
              type="button"
              className="primary-action"
              disabled={connection !== "online"}
              onClick={() => setCreateOpen(true)}
            >
              <FilePlus2 size={17} /> New quotation
            </button>
          </div>
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
        open={tierPanelOpen}
        title={tierEditor ? (tierEditor === "new" ? "New customer tier" : `Edit ${text(tierEditor.name)}`) : "Customer tiers"}
        eyebrow="Pricing governance"
        onClose={() => {
          setTierPanelOpen(false);
          setTierEditor(null);
          setConfirmTierDelete(false);
          setReplacementTierId("");
          setError("");
        }}
        size="wide"
      >
        {tierEditor ? (
          <form className="modal-form tier-editor" key={tierEditor === "new" ? "new" : text(tierEditor.id)} onSubmit={saveTier}>
            <button type="button" className="tier-editor-back" onClick={() => { setTierEditor(null); setConfirmTierDelete(false); setReplacementTierId(""); setError(""); }}>
              <ArrowLeft size={16} /> All tiers
            </button>
            <div className="form-columns">
              <label>
                <span>Tier name</span>
                <input name="name" maxLength={40} defaultValue={tierEditor === "new" ? "" : text(tierEditor.name)} placeholder="e.g. Platinum" required />
              </label>
              <label>
                <span>Overdue risk score</span>
                <input name="overdueRisk" type="number" min="0" max="100" defaultValue={tierEditor === "new" ? 10 : amount(tierEditor.overdueRisk)} required />
              </label>
            </div>
            <label>
              <span>Maximum standard discount</span>
              <input name="discountCeiling" type="number" min="0" max="100" step="0.1" defaultValue={tierEditor === "new" ? 5 : amount(tierEditor.discountCeilingBps) / 100} required />
            </label>
            <div className="form-note">
              <Tags size={17} />
              <span>Discounts above this ceiling enter the approval route. Overdue risk contributes to the deal score.</span>
            </div>
            {tierEditor !== "new" && amount(tierEditor.customerCount) > 0 && <label>
              <span>Move {text(tierEditor.customerCount)} assigned customers to</span>
              <CustomSelect
                ariaLabel="Replacement customer tier"
                value={replacementTierId}
                onChange={setReplacementTierId}
                options={tiers
                  .filter((tier) => text(tier.id) !== text(tierEditor.id))
                  .map((tier) => ({ value: text(tier.id), label: text(tier.name), detail: `${text(tier.customerCount)} customers` }))}
              />
            </label>}
            <ErrorText value={error} />
            <div className="modal-actions split">
              {tierEditor !== "new" ? <button type="button" className="danger-action" disabled={connection !== "online" || (amount(tierEditor.customerCount) > 0 && !replacementTierId)} onClick={() => void deleteTier()}>
                <Trash2 size={16} /> {confirmTierDelete ? "Confirm delete" : "Delete tier"}
              </button> : <span />}
              <button type="submit" className="primary-action" disabled={connection !== "online"}>
                {tierEditor === "new" ? "Create tier" : "Save changes"}
              </button>
            </div>
          </form>
        ) : (
          <div className="tier-manager">
            <div className="tier-manager-toolbar">
              <span>{tiers.length} available tiers</span>
              <button type="button" className="primary-action" disabled={connection !== "online"} onClick={() => { setTierEditor("new"); setError(""); }}>
                <Plus size={16} /> Add tier
              </button>
            </div>
            <div className="tier-manager-list">
              {tiers.map((tier) => <button type="button" key={text(tier.id)} onClick={() => { setTierEditor(tier); setReplacementTierId(text(tiers.find((candidate) => text(candidate.id) !== text(tier.id))?.id)); setConfirmTierDelete(false); setError(""); }}>
                <span className="record-icon"><Tags size={17} /></span>
                <span><strong>{text(tier.name)}</strong><small>{text(tier.customerCount)} customers</small></span>
                <span><strong>{(amount(tier.discountCeilingBps) / 100).toFixed(1)}%</strong><small>Discount ceiling</small></span>
                <span><strong>{text(tier.overdueRisk)}/100</strong><small>Overdue risk</small></span>
                <Pencil size={16} />
              </button>)}
              {!tiers.length && <EmptyState title="No customer tiers" />}
            </div>
          </div>
        )}
      </Modal>
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
            <dl className="signal-detail-list">
              <div><dt>Sales team</dt><dd>{text(selected.team)}</dd></div>
              <div><dt>Customer tier</dt><dd>{text(selected.tier)}</dd></div>
              <div><dt>Valid until</dt><dd>{new Date(text(selected.validUntil)).toLocaleDateString()}</dd></div>
              <div><dt>Approval route</dt><dd>{((selected.approvalRoute as string[]) ?? []).length ? ((selected.approvalRoute as string[]) ?? []).map(titleCase).join(" → ") : "Automatic"}</dd></div>
            </dl>
            <section className="detail-section">
              <header><strong>Line items</strong><span>{((selected.lines as Row[]) ?? []).length} products</span></header>
              <div className="quotation-line-list">
                {((selected.lines as Row[]) ?? []).map((line) => {
                  const lineTotal = amount(line.unitPriceMinor) * amount(line.quantity) * (1 - amount(line.discountBps) / 10000);
                  return <article key={text(line.id)}>
                    <span><strong>{text(line.product)}</strong><small>{text(line.sku)} · {titleCase(line.billingType)}</small></span>
                    <span><small>Quantity</small><strong>{text(line.quantity)}</strong></span>
                    <span><small>Discount</small><strong>{(amount(line.discountBps) / 100).toFixed(1)}%</strong></span>
                    <span><small>Line value</small><strong>{formatMoney(lineTotal)}</strong></span>
                  </article>;
                })}
              </div>
            </section>
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
                  onClick={() => void copyPortalLink()}
                >
                  Copy
                </button>
              </div>
            )}
            <ErrorText value={error} />
            <div className="modal-actions">
              {canShareCustomerLink && text(selected.status) === "approved" && <button
                type="button"
                className="secondary-action"
                disabled={connection !== "online"}
                onClick={createPortalLink}
              >
                Share with customer
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

export function ApprovalsView({ focusId, focusRequest }: SearchFocusProps) {
  const { data, connection, run } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [error, setError] = useState("");
  const selected = data.approvals.find((record) => record.id === selectedId);
  useEffect(() => {
    if (focusId && data.approvals.some((record) => text(record.id) === focusId)) setSelectedId(focusId);
  }, [data.approvals, focusId, focusRequest]);
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
            <div className="detail-hero">
              <div>
                <span>Customer</span>
                <h3>{text(selected.customer)}</h3>
                <p>{text(selected.owner)} · {text(selected.team)} · Revision {text(selected.revision)}</p>
              </div>
              <StatusPill value={selected.stage} />
            </div>
            <div className="detail-metrics">
              <div><span>Quote value</span><strong>{formatMoney(selected.totalMinor)}</strong></div>
              <div><span>Live margin</span><strong>{(amount(selected.marginBps) / 100).toFixed(1)}%</strong></div>
              <div><span>Discount</span><strong>{formatMoney(selected.discountMinor)}</strong></div>
            </div>
            <div className="risk-score">
              <span>Blended risk</span>
              <strong>{text(selected.riskScore)}</strong>
              <div>
                <i style={{ width: `${text(selected.riskScore)}%` }} />
              </div>
            </div>
            <div className="decision-reason">
              <strong>{titleCase(selected.stage)} decision</strong>
              <p>{text(selected.reason) || `${text(selected.tier)} customer · ${titleCase(selected.quoteStatus)} quotation`}</p>
            </div>
            <dl className="signal-detail-list">
              <div><dt>Stage</dt><dd>{titleCase(selected.stage)}</dd></div>
              <div><dt>Customer tier</dt><dd>{text(selected.tier)}</dd></div>
              <div><dt>Submitted</dt><dd>{new Date(text(selected.createdAt)).toLocaleString()}</dd></div>
              <div><dt>Audit</dt><dd>Decision recorded</dd></div>
            </dl>
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

export function InvoicesView({ focusId, focusRequest }: SearchFocusProps) {
  const { data, connection, run } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerQuery, setLedgerQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  const selected = data.invoices.find((item) => item.id === selectedId);
  useEffect(() => {
    if (focusId && data.invoices.some((item) => text(item.id) === focusId)) setSelectedId(focusId);
  }, [data.invoices, focusId, focusRequest]);
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
                onClick={() => setSelectedId(text(item.id))}
              >
                <CheckCircle2 size={15} />
                {item.status === "paid" ? "View details" : "Manage"}
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
        title={selected ? `INV-${text(selected.invoiceNumber).padStart(4, "0")}` : "Invoice"}
        eyebrow="Invoice detail"
        onClose={() => { setSelectedId(null); setError(""); }}
      >
        {selected && (
          <form className="modal-form" onSubmit={pay}>
            <div className="detail-hero">
              <div><span>Customer</span><h3>{text(selected.customer)}</h3><p>Due {new Date(text(selected.dueOn)).toLocaleDateString()}</p></div>
              <StatusPill value={selected.status} />
            </div>
            <div className="detail-metrics">
              <div><span>Invoice total</span><strong>{formatMoney(selected.totalMinor)}</strong></div>
              <div><span>Paid</span><strong>{formatMoney(selected.paidMinor)}</strong></div>
              <div><span>Outstanding</span><strong>{formatMoney(amount(selected.totalMinor) - amount(selected.paidMinor))}</strong></div>
            </div>
            {amount(selected.totalMinor) - amount(selected.paidMinor) > 0 ? <>
              <div className="detail-section-heading"><strong>Record payment</strong><span>INR</span></div>
              <label>
                <span>Amount</span>
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  max={(amount(selected.totalMinor) - amount(selected.paidMinor)) / 100}
                  defaultValue={(amount(selected.totalMinor) - amount(selected.paidMinor)) / 100}
                  required
                />
              </label>
              <label>
                <span>Reference</span>
                <input name="reference" placeholder="Bank or receipt reference" required />
              </label>
            </> : <div className="form-note"><CheckCircle2 size={17} /><span>This invoice is fully paid. Its payment history remains available in the ledger.</span></div>}
            <ErrorText value={error} />
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={() => setSelectedId(null)}
              >
                Close
              </button>
              {amount(selected.totalMinor) - amount(selected.paidMinor) > 0 && <button type="submit" className="primary-action" disabled={connection !== "online"}>
                Record payment
              </button>}
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export function DealHealthView({ focusId, focusRequest }: SearchFocusProps) {
  const { data } = useWorkspace();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const high = data.alerts.filter((alert) => alert.severity === "high").length;
  const score = Math.max(0, 100 - high * 8 - (data.alerts.length - high) * 3);
  const selected = data.alerts.find((alert) => text(alert.id) === selectedId);
  useEffect(() => {
    if (focusId && data.alerts.some((alert) => text(alert.id) === focusId)) setSelectedId(focusId);
  }, [data.alerts, focusId, focusRequest]);
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
          <button type="button" className="deal-alert-row" key={text(alert.id)} onClick={() => setSelectedId(text(alert.id))}>
            <span className={`alert-severity ${text(alert.severity)}`}>
              <AlertTriangle size={18} />
            </span>
            <div>
              <span className="record-id">{titleCase(alert.category)}</span>
              <h3>{text(alert.title)}</h3>
              <p>{text(alert.message)}</p>
            </div>
            <StatusPill value={alert.severity} />
            <ChevronRight size={17} />
          </button>
        ))}
      </section>
      <Modal open={Boolean(selected)} title={text(selected?.quoteNumber ? `Q-${selected.quoteNumber}` : "Deal signal")} eyebrow="Deal health" onClose={() => setSelectedId(null)} size="wide">
        {selected && <div className="detail-stack">
          <div className="detail-hero">
            <div><span>Customer</span><h3>{text(selected.customer)}</h3><p>{text(selected.owner)} · {text(selected.team)}</p></div>
            <StatusPill value={selected.severity} />
          </div>
          <div className="detail-metrics">
            <div><span>Deal value</span><strong>{formatMoney(selected.totalMinor)}</strong></div>
            <div><span>Risk score</span><strong>{text(selected.riskScore)}/100</strong></div>
            <div><span>Live margin</span><strong>{(amount(selected.marginBps) / 100).toFixed(1)}%</strong></div>
          </div>
          <div className="risk-score">
            <span>{titleCase(selected.category)}</span>
            <strong>{text(selected.title)}</strong>
            <p>{text(selected.message)}</p>
          </div>
          <dl className="signal-detail-list">
            <div><dt>Quotation</dt><dd>Q-{text(selected.quoteNumber)}</dd></div>
            <div><dt>Deal status</dt><dd>{titleCase(selected.quoteStatus)}</dd></div>
            <div><dt>Customer tier</dt><dd>{text(selected.tier)}</dd></div>
            <div><dt>Last activity</dt><dd>{new Date(text(selected.updatedAt)).toLocaleString()}</dd></div>
          </dl>
        </div>}
      </Modal>
    </div>
  );
}

export function ReportsView() {
  const { data, connection } = useWorkspace();
  const [downloading, setDownloading] = useState<"pdf" | "xls" | null>(null);
  const [status, setStatus] = useState("all");
  const [ownerId, setOwnerId] = useState("all");
  const ownerOptions = useMemo<SelectOption[]>(() => [
    { value: "all", label: "All owners" },
    ...Array.from(new Map(data.quotes.map((quote) => [text(quote.ownerUserId), text(quote.owner)])).entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ], [data.quotes]);
  const filteredQuotes = useMemo(() => data.quotes.filter((quote) =>
    (status === "all" || text(quote.status) === status)
    && (ownerId === "all" || text(quote.ownerUserId) === ownerId)
  ), [data.quotes, ownerId, status]);
  const quoted = filteredQuotes.reduce(
    (sum, quote) => sum + amount(quote.totalMinor),
    0,
  );
  const approved = filteredQuotes
    .filter((quote) => ["approved", "accepted"].includes(text(quote.status)))
    .reduce((sum, quote) => sum + amount(quote.totalMinor), 0);
  const accepted = filteredQuotes.filter((quote) => text(quote.status) === "accepted");
  const averageMargin = filteredQuotes.length
    ? filteredQuotes.reduce((sum, quote) => sum + amount(quote.marginBps), 0) /
      filteredQuotes.length /
      100
    : 0;
  const conversion = filteredQuotes.length ? accepted.length / filteredQuotes.length * 100 : 0;
  const highRisk = filteredQuotes.filter((quote) => amount(quote.riskScore) >= 70).length;
  const statusSeries = QUOTE_STATUS_OPTIONS.slice(1).map((option) => ({
    ...option,
    count: filteredQuotes.filter((quote) => text(quote.status) === option.value).length,
  })).filter((item) => item.count > 0);
  const maxStatusCount = Math.max(1, ...statusSeries.map((item) => item.count));
  const topDeals = [...filteredQuotes].sort((a, b) => amount(b.totalMinor) - amount(a.totalMinor)).slice(0, 6);
  const download = async (format: "pdf" | "xls") => {
    setDownloading(format);
    try {
      const file = await downloadReport(format, { status, ownerId });
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      showToast(`${format.toUpperCase()} report downloaded.`, "success");
    } catch (caught) {
      const message = caught instanceof ApiError && caught.status === 401
        ? "Your session expired. Sign in again to export."
        : caught instanceof Error ? caught.message : "Report download failed.";
      showToast(message, "error");
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
      <div className="data-toolbar standalone-toolbar report-toolbar">
        <CustomSelect className="toolbar-custom-select" ariaLabel="Filter report by status" icon={<Filter size={15} />} options={QUOTE_STATUS_OPTIONS} value={status} onChange={setStatus} />
        <CustomSelect className="toolbar-custom-select" ariaLabel="Filter report by owner" icon={<Filter size={15} />} options={ownerOptions} value={ownerId} onChange={setOwnerId} />
        <span className="result-count">{filteredQuotes.length} deals</span>
      </div>
      <section className="metric-grid compact">
        <article className="metric-card">
          <span className="metric-icon">
            <BadgeIndianRupee size={18} />
          </span>
          <span>Quoted value</span>
          <strong>{formatMoney(quoted)}</strong>
          <small>{filteredQuotes.length} quotations</small>
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
        <article className="metric-card">
          <span className="metric-icon"><AlertTriangle size={18} /></span>
          <span>High-risk deals</span>
          <strong>{highRisk}</strong>
          <small>Risk score of 70 or more</small>
        </article>
      </section>
      <section className="report-grid">
        <article className="report-chart">
          <header><div><span>Pipeline distribution</span><strong>Deal stages</strong></div><StatusPill value={`${filteredQuotes.length} total`} /></header>
          <div className="bar-chart">
            {statusSeries.map((item) => <div key={item.value}><i style={{ height: `${Math.max(8, item.count / maxStatusCount * 100)}%` }} /><strong>{item.count}</strong><span>{item.label}</span></div>)}
          </div>
        </article>
        <article className="report-breakdown">
          <span>Win conversion</span><strong>{formatMoney(accepted.reduce((sum, quote) => sum + amount(quote.totalMinor), 0))}</strong>
          <div className="progress-ring" style={{ background: `conic-gradient(var(--accent) 0 ${conversion}%, var(--surface-soft) ${conversion}% 100%)` }}><span>{conversion.toFixed(0)}%</span></div>
          <p>{accepted.length} accepted deals from {filteredQuotes.length} visible quotations.</p>
        </article>
      </section>
      <section className="data-panel report-leaderboard">
        <div className="report-section-title"><div><span>Top opportunities</span><strong>Highest-value deals</strong></div><span>{formatMoney(quoted)}</span></div>
        <div className="record-table report-table">
          <div className="record-table-head"><span>Customer</span><span>Owner</span><span>Team</span><span>Value</span><span>Status</span></div>
          {topDeals.map((quote) => <div className="record-row" key={text(quote.id)}><span className="record-primary"><strong>{text(quote.customer)}</strong><small>{text(quote.quoteNumber)}</small></span><span data-label="Owner">{text(quote.owner)}</span><span data-label="Team">{text(quote.team)}</span><strong data-label="Value">{formatMoney(quote.totalMinor)}</strong><span data-label="Status"><StatusPill value={quote.status} /></span></div>)}
        </div>
      </section>
    </div>
  );
}
