import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Archive,
  Boxes,
  ChevronRight,
  Filter,
  Layers3,
  PackageOpen,
  Plus,
  RefreshCw,
  Search,
  Tags,
  Trash2,
  Warehouse,
} from "lucide-react";
import { CustomSelect, type SelectOption } from "../components/ui/CustomSelect";
import { Modal } from "../components/ui/Modal";
import { showToast } from "../components/ui/ToastViewport";
import { mutate } from "../lib/api";
import { useWorkspace } from "../lib/workspace";

type Row = Record<string, unknown>;
const text = (value: unknown) => String(value ?? "");
const number = (value: unknown) => Number(value ?? 0);
const money = (minor: unknown) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}).format(number(minor) / 100);

const BILLING_OPTIONS: SelectOption[] = [
  { value: "one_time", label: "One-time" },
  { value: "recurring", label: "Recurring" },
];
const CADENCE_OPTIONS: SelectOption[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];
const STATUS_OPTIONS: SelectOption[] = [
  { value: "active", label: "Active products" },
  { value: "archived", label: "Archived products" },
  { value: "all", label: "All products" },
];

export function CatalogView({ focusId, focusRequest }: { focusId?: string | null; focusRequest?: number }) {
  const { data, connection, run } = useWorkspace();
  const products = data.catalog ?? [];
  const categories = data.productCategories ?? [];
  const warehouses = data.warehouses ?? [];
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState("active");
  const [billing, setBilling] = useState("all");
  const [editor, setEditor] = useState<Row | "new" | null>(null);
  const [billingType, setBillingType] = useState("one_time");
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
  const [categoryEditor, setCategoryEditor] = useState<Row | "new" | null>(null);
  const [replacementCategoryId, setReplacementCategoryId] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmCategoryDelete, setConfirmCategoryDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!focusId) return;
    const product = products.find((item) => text(item.id) === focusId);
    if (!product) return;
    setEditor(product);
    setBillingType(text(product.billingType));
    setConfirmArchive(false);
    setError("");
  }, [focusId, focusRequest, products]);

  const categoryOptions = useMemo<SelectOption[]>(() => [
    { value: "all", label: "All categories" },
    ...categories.map((category) => ({
      value: text(category.id),
      label: text(category.name),
      detail: `${number(category.activeProductCount)} active`,
    })),
  ], [categories]);
  const editorCategoryOptions = categoryOptions.filter((option) => option.value !== "all");
  const billingOptions: SelectOption[] = [
    { value: "all", label: "All billing" },
    ...BILLING_OPTIONS,
  ];
  const filtered = useMemo(() => products.filter((product) => {
    const matchesQuery = `${text(product.name)} ${text(product.sku)} ${text(product.category)}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesCategory = categoryId === "all" || text(product.categoryId) === categoryId;
    const matchesStatus = status === "all" || (status === "active" ? product.active !== false : product.active === false);
    const matchesBilling = billing === "all" || text(product.billingType) === billing;
    return matchesQuery && matchesCategory && matchesStatus && matchesBilling;
  }), [billing, categoryId, products, query, status]);
  const activeProducts = products.filter((product) => product.active !== false);
  const stockSummary = activeProducts.flatMap((product) => (product.stock as Row[] | undefined) ?? []);
  const availableUnits = stockSummary.reduce((sum, level) => sum + number(level.availableQuantity), 0);
  const reservedUnits = stockSummary.reduce((sum, level) => sum + number(level.reservedQuantity), 0);
  const lowStock = activeProducts.filter((product) => {
    const levels = (product.stock as Row[] | undefined) ?? [];
    return levels.length > 0 && levels.reduce((sum, level) => sum + number(level.availableQuantity) - number(level.reservedQuantity), 0) <= 5;
  }).length;

  const openEditor = (product: Row | "new") => {
    setEditor(product);
    setBillingType(product === "new" ? "one_time" : text(product.billingType));
    setConfirmArchive(false);
    setError("");
  };
  const closeEditor = () => {
    setEditor(null);
    setConfirmArchive(false);
    setError("");
  };
  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;
    const editing = editor;
    setError("");
    const form = new FormData(event.currentTarget);
    const stock = warehouses.map((warehouse) => {
      const existing = editing === "new" ? undefined : ((editing.stock as Row[] | undefined) ?? []).find((level) => text(level.warehouseId) === text(warehouse.id));
      return {
        warehouseId: text(warehouse.id),
        availableQuantity: Number(form.get(`stock-${warehouse.id}`)),
        expectedVersion: number(existing?.version),
      };
    });
    const payload = {
      name: text(form.get("name")),
      sku: text(form.get("sku")),
      categoryId: text(form.get("categoryId")),
      billingType,
      cadence: billingType === "recurring" ? text(form.get("cadence")) : null,
      priceMinor: Math.round(Number(form.get("price")) * 100),
      costMinor: Math.round(Number(form.get("cost")) * 100),
      stock,
      ...(editing === "new" ? {} : { active: editing.active !== false, expectedVersion: number(editing.version) }),
    };
    try {
      await run(() => mutate(
        editing === "new" ? "/api/admin/products" : `/api/admin/products/${editing.id}`,
        editing === "new" ? "POST" : "PATCH",
        payload,
      ));
      showToast(editing === "new" ? "Product created." : "Product updated.", "success");
      closeEditor();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not save product.";
      setError(message);
      showToast(message, "error");
    }
  };
  const archiveProduct = async () => {
    if (!editor || editor === "new") return;
    if (!confirmArchive) {
      setConfirmArchive(true);
      return;
    }
    try {
      await run(() => mutate(`/api/admin/products/${editor.id}`, "DELETE", { expectedVersion: number(editor.version) }));
      showToast("Product archived.", "success");
      closeEditor();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not archive product.";
      setError(message);
      showToast(message, "error");
    }
  };
  const restoreProduct = async () => {
    if (!editor || editor === "new") return;
    try {
      await run(() => mutate(`/api/admin/products/${editor.id}`, "PATCH", {
        name: text(editor.name),
        sku: text(editor.sku),
        categoryId: text(editor.categoryId),
        billingType: text(editor.billingType),
        cadence: editor.billingType === "recurring" ? text(editor.cadence) : null,
        priceMinor: number(editor.priceMinor),
        costMinor: number(editor.costMinor),
        stock: ((editor.stock as Row[] | undefined) ?? []).map((level) => ({
          warehouseId: text(level.warehouseId),
          availableQuantity: number(level.availableQuantity),
          expectedVersion: number(level.version),
        })),
        active: true,
        expectedVersion: number(editor.version),
      }));
      showToast("Product restored.", "success");
      closeEditor();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not restore product.";
      setError(message);
      showToast(message, "error");
    }
  };

  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await run(() => mutate(
        categoryEditor === "new" ? "/api/admin/categories" : `/api/admin/categories/${categoryEditor?.id}`,
        categoryEditor === "new" ? "POST" : "PATCH",
        { name: form.get("name"), ...(categoryEditor === "new" ? {} : { expectedVersion: number(categoryEditor?.version) }) },
      ));
      showToast(categoryEditor === "new" ? "Category created." : "Category updated.", "success");
      setCategoryEditor(null);
      setError("");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not save category.";
      setError(message);
      showToast(message, "error");
    }
  };
  const deleteCategory = async () => {
    if (!categoryEditor || categoryEditor === "new") return;
    if (!confirmCategoryDelete) {
      setConfirmCategoryDelete(true);
      return;
    }
    try {
      await run(() => mutate(`/api/admin/categories/${categoryEditor.id}`, "DELETE", {
        expectedVersion: number(categoryEditor.version),
        ...(replacementCategoryId ? { replacementCategoryId } : {}),
      }));
      showToast("Category deleted.", "success");
      setCategoryEditor(null);
      setConfirmCategoryDelete(false);
      setReplacementCategoryId("");
      setError("");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not delete category.";
      setError(message);
      showToast(message, "error");
    }
  };

  return (
    <div className="page-stack catalog-page">
      <section className="page-actions-row">
        <div className="page-action-group catalog-actions">
          <button type="button" className="secondary-action" onClick={() => { setCategoryPanelOpen(true); setCategoryEditor(null); setError(""); }}><Tags size={17} /> Categories</button>
          <button type="button" className="primary-action" disabled={connection !== "online" || !categories.length} onClick={() => openEditor("new")}><Plus size={17} /> Product</button>
        </div>
      </section>

      <section className="metric-grid compact catalog-metrics">
        <article className="metric-card"><span className="metric-icon"><Boxes size={19} /></span><span>Active products</span><strong>{activeProducts.length}</strong><small>{products.length - activeProducts.length} archived</small></article>
        <article className="metric-card"><span className="metric-icon"><Layers3 size={19} /></span><span>Categories</span><strong>{categories.length}</strong><small>Commercial catalogue</small></article>
        <article className="metric-card"><span className="metric-icon"><Warehouse size={19} /></span><span>Available units</span><strong>{availableUnits.toLocaleString("en-IN")}</strong><small>{reservedUnits.toLocaleString("en-IN")} reserved</small></article>
        <article className="metric-card"><span className="metric-icon"><PackageOpen size={19} /></span><span>Low stock</span><strong>{lowStock}</strong><small>Five units or fewer</small></article>
      </section>

      <section className="data-panel catalog-panel">
        <div className="data-toolbar">
          <label className="toolbar-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or SKU" /></label>
          <CustomSelect className="toolbar-custom-select" ariaLabel="Filter category" icon={<Tags size={15} />} options={categoryOptions} value={categoryId} onChange={setCategoryId} />
          <CustomSelect className="toolbar-custom-select" ariaLabel="Filter billing" icon={<Filter size={15} />} options={billingOptions} value={billing} onChange={setBilling} />
          <CustomSelect className="toolbar-custom-select" ariaLabel="Filter product status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
          <span className="result-count">{filtered.length} products</span>
        </div>
        <div className="record-table catalog-table">
          <div className="record-table-head"><span>Product</span><span>Category</span><span>Billing</span><span>Price / cost</span><span>Stock</span><span /></div>
          {filtered.map((product) => {
            const stock = (product.stock as Row[] | undefined) ?? [];
            const available = stock.reduce((sum, level) => sum + number(level.availableQuantity), 0);
            const reserved = stock.reduce((sum, level) => sum + number(level.reservedQuantity), 0);
            const margin = number(product.priceMinor) ? ((number(product.priceMinor) - number(product.costMinor)) / number(product.priceMinor)) * 100 : 0;
            return <button type="button" className="record-row" key={text(product.id)} onClick={() => openEditor(product)}>
              <span className="record-primary"><strong>{text(product.name)}</strong><small>{text(product.sku)}</small></span>
              <span data-label="Category">{text(product.category)}</span>
              <span data-label="Billing"><span className={`status-pill ${product.active === false ? "danger" : product.billingType === "recurring" ? "info" : "success"}`}>{product.active === false ? "Archived" : product.billingType === "recurring" ? text(product.cadence) : "One-time"}</span></span>
              <span className="record-money" data-label="Price / cost"><strong>{money(product.priceMinor)}</strong><small>{money(product.costMinor)} cost · {margin.toFixed(1)}%</small></span>
              <span className="record-money" data-label="Stock"><strong>{Math.max(0, available - reserved).toLocaleString("en-IN")}</strong><small>{reserved} reserved</small></span>
              <ChevronRight size={17} />
            </button>;
          })}
          {!filtered.length && <div className="inline-empty"><PackageOpen size={22} /><strong>No products found</strong><span>Change the filters or add a product.</span></div>}
        </div>
      </section>

      <Modal open={Boolean(editor)} title={editor === "new" ? "New product" : text(editor?.name)} eyebrow="Catalogue" onClose={closeEditor} size="wide" className="catalog-editor-modal">
        {editor && <form className="modal-form catalog-editor" key={editor === "new" ? "new" : `${editor.id}-${editor.version}`} onSubmit={saveProduct}>
          <div className="form-columns">
            <label><span>Product name</span><input name="name" maxLength={120} defaultValue={editor === "new" ? "" : text(editor.name)} required /></label>
            <label><span>SKU</span><input name="sku" maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9._-]+" defaultValue={editor === "new" ? "" : text(editor.sku)} required /></label>
          </div>
          <div className="form-columns">
            <label><span>Category</span><CustomSelect name="categoryId" ariaLabel="Product category" defaultValue={editor === "new" ? editorCategoryOptions[0]?.value : text(editor.categoryId)} options={editorCategoryOptions} /></label>
            <label><span>Billing</span><CustomSelect name="billingType" ariaLabel="Billing type" value={billingType} options={BILLING_OPTIONS} onChange={setBillingType} /></label>
          </div>
          {billingType === "recurring" && <label><span>Billing cadence</span><CustomSelect name="cadence" ariaLabel="Billing cadence" defaultValue={editor === "new" ? "monthly" : text(editor.cadence)} options={CADENCE_OPTIONS} /></label>}
          <div className="form-columns">
            <label><span>Selling price (₹)</span><input name="price" type="number" min="0" max="90071992547409" step="0.01" defaultValue={editor === "new" ? "" : (number(editor.priceMinor) / 100).toFixed(2)} required /></label>
            <label><span>Unit cost (₹)</span><input name="cost" type="number" min="0" max="90071992547409" step="0.01" defaultValue={editor === "new" ? "" : (number(editor.costMinor) / 100).toFixed(2)} required /></label>
          </div>
          <section className="catalog-stock-editor">
            <header><span><Warehouse size={17} /></span><div><strong>Warehouse stock</strong><small>Available includes reserved units.</small></div></header>
            <div>{warehouses.map((warehouse) => {
              const level = editor === "new" ? undefined : ((editor.stock as Row[] | undefined) ?? []).find((item) => text(item.warehouseId) === text(warehouse.id));
              return <label key={text(warehouse.id)}><span><strong>{text(warehouse.name)}</strong><small>{text(warehouse.code)} · {number(level?.reservedQuantity)} reserved</small></span><input name={`stock-${warehouse.id}`} type="number" min={number(level?.reservedQuantity)} max="10000000" step="1" defaultValue={number(level?.availableQuantity)} required /></label>;
            })}</div>
          </section>
          {error && <p className="login-error">{error}</p>}
          <div className="modal-actions catalog-editor-actions">
            {editor !== "new" && editor.active !== false && <button type="button" className="danger-action" disabled={connection !== "online"} onClick={() => void archiveProduct()}><Archive size={16} /> {confirmArchive ? "Confirm archive" : "Archive"}</button>}
            {editor !== "new" && editor.active === false && <button type="button" className="secondary-action" disabled={connection !== "online"} onClick={() => void restoreProduct()}><RefreshCw size={16} /> Restore</button>}
            <button type="button" className="secondary-action" onClick={closeEditor}>Cancel</button>
            <button type="submit" className="primary-action" disabled={connection !== "online"}>{editor === "new" ? "Create product" : "Save changes"}</button>
          </div>
        </form>}
      </Modal>

      <Modal open={categoryPanelOpen} title={categoryEditor ? (categoryEditor === "new" ? "New category" : text(categoryEditor.name)) : "Product categories"} eyebrow="Catalogue" onClose={() => { setCategoryPanelOpen(false); setCategoryEditor(null); setError(""); }}>
        {categoryEditor ? <form className="modal-form" key={categoryEditor === "new" ? "new" : `${categoryEditor.id}-${categoryEditor.version}`} onSubmit={saveCategory}>
          <button type="button" className="tier-editor-back" onClick={() => { setCategoryEditor(null); setConfirmCategoryDelete(false); setReplacementCategoryId(""); setError(""); }}>All categories</button>
          <label><span>Category name</span><input name="name" maxLength={80} defaultValue={categoryEditor === "new" ? "" : text(categoryEditor.name)} required /></label>
          {categoryEditor !== "new" && number(categoryEditor.productCount) > 0 && <label><span>Move {number(categoryEditor.productCount)} products to</span><CustomSelect ariaLabel="Replacement category" options={categories.filter((category) => text(category.id) !== text(categoryEditor.id)).map((category) => ({ value: text(category.id), label: text(category.name) }))} value={replacementCategoryId} onChange={setReplacementCategoryId} /></label>}
          {error && <p className="login-error">{error}</p>}
          <div className="modal-actions">
            {categoryEditor !== "new" && <button type="button" className="danger-action" disabled={connection !== "online" || categories.length <= 1 || (number(categoryEditor.productCount) > 0 && !replacementCategoryId)} onClick={() => void deleteCategory()}><Trash2 size={16} /> {confirmCategoryDelete ? "Confirm delete" : "Delete"}</button>}
            <button type="submit" className="primary-action" disabled={connection !== "online"}>{categoryEditor === "new" ? "Create category" : "Save changes"}</button>
          </div>
        </form> : <div className="tier-manager">
          <div className="tier-manager-toolbar"><span>{categories.length} categories</span><button type="button" className="primary-action" onClick={() => setCategoryEditor("new")}><Plus size={16} /> Add category</button></div>
          <div className="tier-manager-list category-manager-list">{categories.map((category) => <button type="button" key={text(category.id)} onClick={() => { setCategoryEditor(category); setReplacementCategoryId(text(categories.find((item) => text(item.id) !== text(category.id))?.id)); setConfirmCategoryDelete(false); setError(""); }}><span className="record-icon"><Tags size={17} /></span><span><strong>{text(category.name)}</strong><small>{number(category.productCount)} products</small></span><span><strong>{number(category.activeProductCount)}</strong><small>Active</small></span><ChevronRight size={17} /></button>)}</div>
        </div>}
      </Modal>
    </div>
  );
}
