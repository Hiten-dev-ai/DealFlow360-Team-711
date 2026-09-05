import { randomBytes } from "node:crypto";
import { z } from "zod";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import { streamSSE } from "hono/streaming";
import { allocateInventory } from "../domain/allocation.js";
import { calculateQuote, invoiceStatus, prorateMinor } from "../domain/rules.js";
import { hashSessionToken } from "../auth/session.js";
import { csrfTokenForSession } from "../auth/csrf.js";
import { readCookie, sessionCookie } from "../http/cookies.js";
import {
  encryptSetting,
  buildSmtpUrl,
  resolveMailSettings,
  smtpConnectionDetails,
  smtpHost,
} from "../services/environment.js";

const uuid = z.string().uuid();
const quoteInput = z.object({
  customerId: uuid,
  teamId: uuid.optional(),
  validUntil: z.string().date().optional(),
  lines: z
    .array(
      z.object({
        productId: uuid,
        quantity: z.number().int().positive().max(10_000),
        discountBps: z.number().int().min(0).max(10_000).default(0),
      }),
    )
    .min(1)
    .max(100),
});
const decisionInput = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
});
const paymentInput = z.object({
  amountMinor: z.number().int().positive(),
  reference: z.string().trim().min(1).max(120),
});
const counterInput = z.object({
  action: z.enum(["comment", "counteroffer", "accept", "reject"]),
  message: z.string().trim().max(1000).optional(),
  lines: z
    .array(
      z.object({
        lineId: uuid,
        quantity: z.number().int().positive(),
        discountBps: z.number().int().min(0).max(10_000),
      }),
    )
    .max(100)
    .optional(),
});
const addLineInput = z.object({
  productId: uuid,
  quantity: z.number().int().positive().max(10_000).default(1),
  discountBps: z.number().int().min(0).max(10_000).default(0),
  expectedVersion: z.number().int().positive(),
});

function number(value) {
  return Number(value ?? 0);
}
function xml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function tokenPair() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashSessionToken(token) };
}
function billingWindow(cadence, now = new Date()) {
  const month = now.getUTCMonth();
  const boundaryMonth = cadence === "monthly" ? month + 1 : cadence === "quarterly" ? Math.floor(month / 3) * 3 + 3 : 12;
  const next = new Date(Date.UTC(now.getUTCFullYear(), boundaryMonth, 1));
  const previous = cadence === "monthly" ? new Date(Date.UTC(now.getUTCFullYear(), month, 1)) : cadence === "quarterly" ? new Date(Date.UTC(now.getUTCFullYear(), Math.floor(month / 3) * 3, 1)) : new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const day = 86_400_000;
  return { startsOn: now.toISOString().slice(0, 10), nextBillOn: next.toISOString().slice(0, 10), activeDays: Math.max(1, Math.ceil((next.getTime() - now.getTime()) / day)), periodDays: Math.round((next.getTime() - previous.getTime()) / day) };
}
function dbRequired(c, store) {
  return store.query
    ? null
    : c.json(
        {
          error: "Business data requires PostgreSQL.",
          code: "DATABASE_REQUIRED",
        },
        503,
      );
}
function parse(schema, payload) {
  const result = schema.safeParse(payload);
  return result.success ? { data: result.data } : { error: result.error };
}
async function jsonBody(c, schema) {
  return parse(schema, await c.req.json().catch(() => null));
}

function quoteScope(auth, start = 2) {
  if (auth.role === "admin" || auth.role === "finance_ops")
    return { sql: "", params: [] };
  if (auth.role === "sales_manager")
    return { sql: ` AND q.team_id = $${start}`, params: [auth.user.teamId] };
  return { sql: ` AND q.owner_user_id = $${start}`, params: [auth.user.id] };
}

function mapQuote(row) {
  return {
    ...row,
    quoteNumber: `Q-${String(row.quoteNumber).padStart(4, "0")}`,
    subtotalMinor: number(row.subtotalMinor),
    discountMinor: number(row.discountMinor),
    totalMinor: number(row.totalMinor),
    costMinor: number(row.costMinor),
    marginBps: number(row.marginBps),
    riskScore: number(row.riskScore),
    version: number(row.version),
    revision: number(row.revision),
  };
}

async function listQuotes(store, auth) {
  const scope = quoteScope(auth);
  const result = await store.query(
    `SELECT q.id, q.quote_number AS "quoteNumber", q.status, q.revision, q.subtotal_minor AS "subtotalMinor",
            q.discount_minor AS "discountMinor", q.total_minor AS "totalMinor", q.cost_minor AS "costMinor",
            q.margin_bps AS "marginBps", q.risk_score AS "riskScore", q.approval_route AS "approvalRoute",
            q.version, q.valid_until AS "validUntil", q.updated_at AS "updatedAt",
            c.id AS "customerId", c.name AS customer, t.name AS tier, u.full_name AS owner, q.owner_user_id AS "ownerUserId", q.team_id AS "teamId", st.name AS team,
            COALESCE((SELECT json_agg(json_build_object('id', l.id, 'productId', p.id, 'product', p.name, 'sku', p.sku,
              'quantity', l.quantity, 'unitPriceMinor', l.unit_price_minor, 'discountBps', l.discount_bps,
              'billingType', l.billing_type, 'cadence', l.cadence) ORDER BY p.name)
              FROM quote_lines l JOIN products p ON p.id = l.product_id WHERE l.quote_id = q.id), '[]') AS lines,
            COALESCE((SELECT json_agg(json_build_object('productId',suggested.id,'product',suggested.name,'priceMinor',suggested.price_minor,
              'marginImpactMinor',suggested.price_minor-suggested.cost_minor)) FROM upsell_rules ur
              JOIN quote_lines source_line ON source_line.product_id=ur.source_product_id AND source_line.quote_id=q.id
              JOIN products suggested ON suggested.id=ur.suggested_product_id
              WHERE ur.workspace_id=q.workspace_id AND ur.active=true AND source_line.quantity>=ur.min_quantity
                AND NOT EXISTS(SELECT 1 FROM quote_lines existing WHERE existing.quote_id=q.id AND existing.product_id=suggested.id)), '[]') AS suggestions
       FROM quotes q JOIN customers c ON c.id = q.customer_id LEFT JOIN customer_tiers t ON t.id=c.tier_id JOIN users u ON u.id = q.owner_user_id JOIN sales_teams st ON st.id=q.team_id
      WHERE q.workspace_id = $1${scope.sql} ORDER BY q.updated_at DESC LIMIT 200`,
    [auth.user.workspaceId, ...scope.params],
  );
  return result.rows.map(mapQuote);
}

async function writeChange(
  client,
  workspaceId,
  type,
  id,
  version = null,
  operation = "upsert",
) {
  await client.query(
    "INSERT INTO sync_changes (workspace_id, entity_type, entity_id, operation, version) VALUES ($1,$2,$3,$4,$5)",
    [workspaceId, type, id, operation, version],
  );
}

async function writeAudit(client, auth, action, metadata = {}) {
  await client.query(
    "INSERT INTO audit_events (user_id, workspace_id, action, metadata) VALUES ($1,$2,$3,$4)",
    [auth.user.id, auth.user.workspaceId, action, JSON.stringify(metadata)],
  );
}

async function loadQuoteCalculation(
  client,
  quoteId,
  workspaceId,
  replacementLines = null,
) {
  const quoteResult = await client.query(
    `SELECT q.*, c.overdue_minor, t.overdue_risk, st.manager_user_id
       FROM quotes q JOIN customers c ON c.id=q.customer_id LEFT JOIN customer_tiers t ON t.id=c.tier_id
       JOIN sales_teams st ON st.id=q.team_id WHERE q.id=$1 AND q.workspace_id=$2 FOR UPDATE OF q`,
    [quoteId, workspaceId],
  );
  const quote = quoteResult.rows[0];
  if (!quote) return null;
  const rawLines =
    replacementLines ??
    (
      await client.query(
        'SELECT product_id AS "productId", quantity, discount_bps AS "discountBps" FROM quote_lines WHERE quote_id=$1',
        [quoteId],
      )
    ).rows;
  const productIds = rawLines.map((line) => line.productId);
  const products = await client.query(
    `SELECT p.id, p.price_minor AS "unitPriceMinor", p.cost_minor AS "unitCostMinor", p.billing_type AS "billingType", p.cadence,
            COALESCE(dp.ceiling_bps, 0) AS "ceilingBps"
       FROM products p LEFT JOIN discount_policies dp ON dp.category_id=p.category_id AND dp.tier_id=$2 AND dp.workspace_id=$3
      WHERE p.id = ANY($1::uuid[]) AND p.workspace_id=$3 AND p.active=true`,
    [productIds, quote.tier_id, workspaceId],
  );
  if (products.rowCount !== new Set(productIds).size)
    throw Object.assign(new Error("One or more products are unavailable."), {
      status: 400,
      code: "PRODUCT_UNAVAILABLE",
    });
  const productMap = new Map(
    products.rows.map((product) => [product.id, product]),
  );
  const lines = rawLines.map((line) => ({
    ...productMap.get(line.productId),
    productId: line.productId,
    quantity: number(line.quantity),
    discountBps: number(line.discountBps),
  }));
  const settingsRow = (
    await client.query(
      `SELECT manager_score AS "managerScore", finance_score AS "financeScore", finance_value_minor AS "financeValueMinor",
            margin_floor_bps AS "marginFloorBps", discount_weight AS "discountWeight", margin_weight AS "marginWeight",
            value_weight AS "valueWeight", overdue_weight AS "overdueWeight" FROM approval_settings WHERE workspace_id=$1`,
      [workspaceId],
    )
  ).rows[0];
  const settings = Object.fromEntries(
    Object.entries(settingsRow).map(([key, value]) => [key, number(value)]),
  );
  const calculation = calculateQuote(
    lines,
    { overdueRisk: number(quote.overdue_risk) },
    settings,
  );
  return { quote, lines, calculation };
}

async function notifyRole(client, workspaceId, role, payload, teamId = null) {
  await client.query(
    `INSERT INTO notifications (workspace_id,user_id,category,title,message,target_type,target_id,priority)
     SELECT $1,u.id,$2,$3,$4,$5,$6,$7 FROM users u JOIN workspace_memberships m ON m.user_id=u.id AND m.workspace_id=$1
      WHERE m.role=$8 AND ($9::uuid IS NULL OR m.team_id=$9)`,
    [
      workspaceId,
      payload.category,
      payload.title,
      payload.message,
      payload.targetType,
      payload.targetId,
      payload.priority ?? false,
      role,
      teamId,
    ],
  );
}

async function generateDueSubscriptionInvoices(store, workspaceId) {
  if (!store.transaction) return;
  await store.transaction(async (client) => {
    const due = (
      await client.query(
        `SELECT * FROM subscriptions WHERE workspace_id=$1 AND status='active' AND next_bill_on<=current_date FOR UPDATE`,
        [workspaceId],
      )
    ).rows;
    for (const subscription of due) {
      const periodEnd = (
        await client.query(
          `SELECT ($1::date + CASE $2 WHEN 'monthly' THEN interval '1 month' WHEN 'quarterly' THEN interval '3 months' ELSE interval '1 year' END)::date AS value`,
          [subscription.next_bill_on, subscription.cadence],
        )
      ).rows[0].value;
      const totalMinor = number(subscription.unit_price_minor) * number(subscription.quantity);
      const invoice = await client.query(
        `INSERT INTO invoices(workspace_id,customer_id,quote_id,subscription_id,period_start,period_end,total_minor,due_on)
         VALUES($1,$2,$3,$4,$5,$6,$7,current_date+interval '14 days')
         ON CONFLICT(subscription_id,period_start) WHERE subscription_id IS NOT NULL DO NOTHING RETURNING id`,
        [workspaceId, subscription.customer_id, subscription.quote_id, subscription.id, subscription.next_bill_on, periodEnd, totalMinor],
      );
      if (invoice.rowCount) {
        await client.query(
          `INSERT INTO invoice_lines(invoice_id,description,quantity,unit_price_minor,amount_minor) VALUES($1,'Subscription renewal',$2,$3,$4)`,
          [invoice.rows[0].id, subscription.quantity, subscription.unit_price_minor, totalMinor],
        );
      }
      await client.query(`UPDATE subscriptions SET next_bill_on=$2,version=version+1 WHERE id=$1`, [subscription.id, periodEnd]);
    }
  });
}

export function registerDomainRoutes(app, { store, config, auth }) {
  app.get("/api/version", (c) => c.json({ releaseId: config.releaseId }));

  app.get("/api/bootstrap", auth.required, async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const current = c.get("auth");
    await generateDueSubscriptionInvoices(store, current.user.workspaceId);
    await store.query(
      `UPDATE invoices SET status='overdue',updated_at=now() WHERE workspace_id=$1 AND status='due' AND due_on<current_date`,
      [current.user.workspaceId],
    );
    const scopedQuotes = quoteScope(current);
    const canReadOperations = current.role === "admin" || current.role === "finance_ops";
    await store.query(
      `INSERT INTO deal_alerts(workspace_id,quote_id,category,severity,title,message)
      SELECT q.workspace_id,q.id,'stalled','medium','Stalled quotation','No quotation activity for more than three days.' FROM quotes q
      WHERE q.workspace_id=$1 AND q.status IN ('draft','negotiation') AND q.updated_at<now()-interval '3 days'
      AND NOT EXISTS(SELECT 1 FROM deal_alerts a WHERE a.quote_id=q.id AND a.category='stalled' AND a.resolved_at IS NULL)`,
      [current.user.workspaceId],
    );
    const [
      quotes,
      approvals,
      fulfillment,
      subscriptions,
      invoices,
      payments,
      alerts,
      notifications,
      teams,
      customers,
      catalog,
      preferences,
      cursor,
    ] = await Promise.all([
      listQuotes(store, current),
      store.query(
        `SELECT ar.id, ar.quote_id AS "quoteId", ar.stage, ar.status, ar.reason, ar.created_at AS "createdAt", q.quote_number AS "quoteNumber", q.total_minor AS "totalMinor", q.risk_score AS "riskScore", c.name AS customer
        FROM approval_requests ar JOIN quotes q ON q.id=ar.quote_id JOIN customers c ON c.id=q.customer_id
        WHERE q.workspace_id=$1 AND ar.status='pending' AND (($2='admin') OR ($2='sales_manager' AND ar.stage='manager' AND q.team_id=$3) OR ($2='finance_ops' AND ar.stage='finance')) ORDER BY ar.created_at`,
        [current.user.workspaceId, current.role, current.user.teamId],
      ),
      canReadOperations ? store.query(
        `SELECT o.id, o.quote_id AS "quoteId", o.status, o.version, q.quote_number AS "quoteNumber", c.name AS customer,
        COALESCE((SELECT json_agg(json_build_object('id',s.id,'warehouse',w.name,'status',s.status,'shippingCostMinor',s.shipping_cost_minor,'lines',s.lines)) FROM shipments s LEFT JOIN warehouses w ON w.id=s.warehouse_id WHERE s.order_id=o.id),'[]') AS shipments
        FROM orders o JOIN quotes q ON q.id=o.quote_id JOIN customers c ON c.id=q.customer_id WHERE o.workspace_id=$1 ORDER BY o.updated_at DESC`,
        [current.user.workspaceId],
      ) : Promise.resolve({ rows: [] }),
      canReadOperations ? store.query(
        `SELECT s.id,s.quote_id AS "quoteId",s.status,s.cadence,s.quantity,s.unit_price_minor AS "unitPriceMinor",s.next_bill_on AS "nextBillOn",s.version,c.name AS customer,p.name AS plan FROM subscriptions s JOIN customers c ON c.id=s.customer_id JOIN products p ON p.id=s.product_id WHERE s.workspace_id=$1 ORDER BY s.created_at DESC`,
        [current.user.workspaceId],
      ) : Promise.resolve({ rows: [] }),
      canReadOperations ? store.query(
        `SELECT i.id,i.quote_id AS "quoteId",i.subscription_id AS "subscriptionId",i.invoice_number AS "invoiceNumber",i.status,i.total_minor AS "totalMinor",i.paid_minor AS "paidMinor",i.due_on AS "dueOn",i.version,c.name AS customer FROM invoices i JOIN customers c ON c.id=i.customer_id WHERE i.workspace_id=$1 ORDER BY i.created_at DESC`,
        [current.user.workspaceId],
      ) : Promise.resolve({ rows: [] }),
      canReadOperations ? store.query(
        `SELECT p.id,p.invoice_id AS "invoiceId",p.amount_minor AS "amountMinor",p.reference,p.received_at AS "receivedAt",
          i.invoice_number AS "invoiceNumber",c.name AS customer,COALESCE(u.full_name,'System') AS "recordedBy"
         FROM payments p JOIN invoices i ON i.id=p.invoice_id JOIN customers c ON c.id=i.customer_id
         LEFT JOIN users u ON u.id=p.recorded_by WHERE i.workspace_id=$1 ORDER BY p.received_at DESC`,
        [current.user.workspaceId],
      ) : Promise.resolve({ rows: [] }),
      store.query(
        `SELECT a.id,a.quote_id AS "quoteId",a.category,a.severity,a.title,a.message,a.created_at AS "createdAt",
          q.quote_number AS "quoteNumber",q.status AS "quoteStatus",q.total_minor AS "totalMinor",q.margin_bps AS "marginBps",
          q.risk_score AS "riskScore",q.updated_at AS "updatedAt",c.name AS customer,ct.name AS tier,u.full_name AS owner,st.name AS team
         FROM deal_alerts a JOIN quotes q ON q.id=a.quote_id JOIN customers c ON c.id=q.customer_id
         LEFT JOIN customer_tiers ct ON ct.id=c.tier_id JOIN users u ON u.id=q.owner_user_id JOIN sales_teams st ON st.id=q.team_id
         WHERE a.workspace_id=$1 AND a.resolved_at IS NULL${scopedQuotes.sql} ORDER BY a.created_at DESC`,
        [current.user.workspaceId, ...scopedQuotes.params],
      ),
      store.query(
        `SELECT id,category,title,message,target_type AS "targetType",target_id AS "targetId",priority,read_at AS "readAt",created_at AS "createdAt" FROM notifications WHERE user_id=$1 AND dismissed_at IS NULL ORDER BY created_at DESC LIMIT 100`,
        [current.user.id],
      ),
      current.role === "admin" ? store.query(
        `SELECT t.id,t.name,t.manager_user_id AS "managerUserId",t.version,COALESCE(json_agg(json_build_object('id',u.id,'fullName',u.full_name,'email',u.email,'role',m.role)) FILTER (WHERE u.id IS NOT NULL),'[]') AS members FROM sales_teams t LEFT JOIN workspace_memberships m ON m.team_id=t.id LEFT JOIN users u ON u.id=m.user_id WHERE t.workspace_id=$1 GROUP BY t.id ORDER BY t.name`,
        [current.user.workspaceId],
      ) : Promise.resolve({ rows: [] }),
      store.query(
        `SELECT c.id,c.name,c.email,c.company,c.version,t.name AS tier,t.id AS "tierId" FROM customers c LEFT JOIN customer_tiers t ON t.id=c.tier_id WHERE c.workspace_id=$1 ORDER BY c.name`,
        [current.user.workspaceId],
      ),
      store.query(
        `SELECT p.id,p.sku,p.name,p.billing_type AS "billingType",p.cadence,p.price_minor AS "priceMinor",p.cost_minor AS "costMinor",pc.name AS category FROM products p JOIN product_categories pc ON pc.id=p.category_id WHERE p.workspace_id=$1 AND p.active=true ORDER BY p.name`,
        [current.user.workspaceId],
      ),
      store.query(
        'SELECT theme,accent,desktop_alerts AS "desktopAlerts",sound_alerts AS "soundAlerts",priority_only AS "priorityOnly",dnd FROM user_preferences WHERE user_id=$1',
        [current.user.id],
      ),
      store.query(
        "SELECT COALESCE(max(cursor),0) AS cursor FROM sync_changes WHERE workspace_id=$1",
        [current.user.workspaceId],
      ),
    ]);
    return c.json({
      data: {
        quotes,
        approvals: approvals.rows,
        fulfillment: fulfillment.rows,
        subscriptions: subscriptions.rows,
        invoices: invoices.rows,
        payments: payments.rows,
        alerts: alerts.rows,
        notifications: notifications.rows,
        teams: teams.rows,
        customers: customers.rows,
        catalog: catalog.rows,
        preferences: preferences.rows[0] ?? { theme: "system", accent: "blue" },
      },
      sync: {
        cursor: number(cursor.rows[0].cursor),
        syncedAt: new Date().toISOString(),
      },
    });
  });

  app.get("/api/quotes", auth.required, async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    return c.json({ data: await listQuotes(store, c.get("auth")) });
  });

  app.post("/api/quotes", auth.required, async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const parsed = await jsonBody(c, quoteInput);
    if (parsed.error)
      return c.json(
        {
          error: "Invalid quotation.",
          code: "INVALID_INPUT",
          details: parsed.error.flatten(),
        },
        400,
      );
    const current = c.get("auth");
    if (!["admin", "sales_rep", "sales_manager"].includes(current.role))
      return c.json(
        { error: "You cannot create quotations.", code: "FORBIDDEN" },
        403,
      );
    try {
      const created = await store.transaction(async (client) => {
        const customer = (
          await client.query(
            "SELECT id,tier_id FROM customers WHERE id=$1 AND workspace_id=$2",
            [parsed.data.customerId, current.user.workspaceId],
          )
        ).rows[0];
        if (!customer)
          throw Object.assign(new Error("Customer not found."), {
            status: 404,
            code: "NOT_FOUND",
          });
        const teamId =
          current.role === "admin"
            ? (parsed.data.teamId ?? current.user.teamId)
            : current.user.teamId;
        if (!teamId)
          throw Object.assign(
            new Error("Assign the user to a sales team first."),
            { status: 409, code: "TEAM_REQUIRED" },
          );
        const inserted = await client.query(
          `INSERT INTO quotes (workspace_id,customer_id,owner_user_id,team_id,valid_until) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [
            current.user.workspaceId,
            customer.id,
            current.user.id,
            teamId,
            parsed.data.validUntil ?? null,
          ],
        );
        const quoteId = inserted.rows[0].id;
        const loaded = await loadQuoteCalculation(
          client,
          quoteId,
          current.user.workspaceId,
          parsed.data.lines,
        );
        for (const line of loaded.lines)
          await client.query(
            `INSERT INTO quote_lines (quote_id,product_id,quantity,unit_price_minor,unit_cost_minor,discount_bps,billing_type,cadence) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              quoteId,
              line.productId,
              line.quantity,
              line.unitPriceMinor,
              line.unitCostMinor,
              line.discountBps,
              line.billingType,
              line.cadence,
            ],
          );
        await client.query(
          `UPDATE quotes SET subtotal_minor=$2,discount_minor=$3,total_minor=$4,cost_minor=$5,margin_bps=$6,risk_score=$7,approval_route=$8,updated_at=now() WHERE id=$1`,
          [
            quoteId,
            loaded.calculation.subtotalMinor,
            loaded.calculation.discountMinor,
            loaded.calculation.totalMinor,
            loaded.calculation.costMinor,
            loaded.calculation.marginBps,
            loaded.calculation.riskScore,
            loaded.calculation.approvalRoute,
          ],
        );
        if (loaded.calculation.ceilingBreached)
          await client.query(
            `INSERT INTO deal_alerts(workspace_id,quote_id,category,severity,title,message) VALUES($1,$2,'discount','high','Discount exception','One or more quotation lines exceed the configured ceiling.')`,
            [current.user.workspaceId, quoteId],
          );
        if (loaded.calculation.marginBps < 2000)
          await client.query(
            `INSERT INTO deal_alerts(workspace_id,quote_id,category,severity,title,message) VALUES($1,$2,'margin','high','Margin compression','Quotation margin is below the configured floor.')`,
            [current.user.workspaceId, quoteId],
          );
        const snapshot = {
          lines: loaded.lines.map(({ productId, quantity, discountBps }) => ({
            productId,
            quantity,
            discountBps,
          })),
          calculation: loaded.calculation,
        };
        await client.query(
          `INSERT INTO quote_revisions (quote_id,revision,snapshot,reason,created_by) VALUES ($1,1,$2,'created',$3)`,
          [quoteId, JSON.stringify(snapshot), current.user.id],
        );
        await writeChange(
          client,
          current.user.workspaceId,
          "quote",
          quoteId,
          1,
        );
        await writeAudit(client, current, "quote.created", { quoteId });
        return { id: quoteId };
      });
      const quote = (await listQuotes(store, current)).find(
        (item) => item.id === created.id,
      );
      return c.json({ data: quote }, 201);
    } catch (error) {
      return c.json(
        {
          error: error.message ?? "Could not create quotation.",
          code: error.code ?? "QUOTE_CREATE_FAILED",
        },
        error.status ?? 500,
      );
    }
  });

  app.post("/api/quotes/:id/submit", auth.required, async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const current = c.get("auth");
    if (!["admin", "sales_rep", "sales_manager"].includes(current.role))
      return c.json(
        { error: "You cannot submit quotations.", code: "FORBIDDEN" },
        403,
      );
    const quoteId = c.req.param("id");
    try {
      const result = await store.transaction(async (client) => {
        const loaded = await loadQuoteCalculation(
          client,
          quoteId,
          current.user.workspaceId,
        );
        if (!loaded)
          throw Object.assign(new Error("Quotation not found."), {
            status: 404,
            code: "NOT_FOUND",
          });
        if (
          current.role === "sales_rep" &&
          loaded.quote.owner_user_id !== current.user.id
        )
          throw Object.assign(new Error("You cannot submit this quotation."), {
            status: 403,
            code: "FORBIDDEN",
          });
        if (
          current.role === "sales_manager" &&
          loaded.quote.team_id !== current.user.teamId
        )
          throw Object.assign(new Error("You cannot submit this quotation."), {
            status: 403,
            code: "FORBIDDEN",
          });
        if (
          loaded.calculation.approvalRoute.includes("manager") &&
          !loaded.quote.manager_user_id
        )
          throw Object.assign(
            new Error("Assign a manager to this sales team before submission."),
            { status: 409, code: "MANAGER_REQUIRED" },
          );
        await client.query(
          `UPDATE approval_requests SET status='superseded' WHERE quote_id=$1 AND status='pending'`,
          [quoteId],
        );
        for (const stage of loaded.calculation.approvalRoute.slice(0, 1))
          await client.query(
            `INSERT INTO approval_requests(quote_id,quote_revision,stage,assigned_team_id) VALUES($1,$2,$3,$4) ON CONFLICT(quote_id,quote_revision,stage) DO UPDATE SET status='pending',decided_by=NULL,decided_at=NULL`,
            [quoteId, loaded.quote.revision, stage, loaded.quote.team_id],
          );
        const status = loaded.calculation.approvalRoute.length
          ? "pending_manager"
          : "approved";
        await client.query(
          `UPDATE quotes SET status=$2,submitted_at=now(),version=version+1,updated_at=now() WHERE id=$1`,
          [quoteId, status],
        );
        if (status === "pending_manager")
          await notifyRole(
            client,
            current.user.workspaceId,
            "sales_manager",
            {
              category: "Approvals",
              title: `Quotation ${loaded.quote.quote_number} needs review`,
              message: "A discount or risk rule requires manager approval.",
              targetType: "quote",
              targetId: quoteId,
              priority: true,
            },
            loaded.quote.team_id,
          );
        await writeChange(
          client,
          current.user.workspaceId,
          "quote",
          quoteId,
          loaded.quote.version + 1,
        );
        await writeAudit(client, current, "quote.submitted", {
          quoteId,
          status,
        });
        return { status };
      });
      return c.json({ data: result });
    } catch (error) {
      return c.json(
        { error: error.message, code: error.code ?? "SUBMIT_FAILED" },
        error.status ?? 500,
      );
    }
  });

  app.post("/api/quotes/:id/lines", auth.required, async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const parsed = await jsonBody(c, addLineInput);
    if (parsed.error)
      return c.json(
        { error: "Invalid quotation line.", code: "INVALID_INPUT" },
        400,
      );
    const current = c.get("auth");
    try {
      const data = await store.transaction(async (client) => {
        const quote = (
          await client.query(
            `SELECT * FROM quotes WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,
            [c.req.param("id"), current.user.workspaceId],
          )
        ).rows[0];
        if (!quote)
          throw Object.assign(new Error("Quotation not found."), {
            status: 404,
            code: "NOT_FOUND",
          });
        if (number(quote.version) !== parsed.data.expectedVersion)
          throw Object.assign(
            new Error("Quotation changed on another device."),
            { status: 409, code: "VERSION_CONFLICT" },
          );
        const allowed =
          current.role === "admin" ||
          (current.role === "sales_rep" &&
            quote.owner_user_id === current.user.id) ||
          (current.role === "sales_manager" &&
            quote.team_id === current.user.teamId);
        if (!allowed)
          throw Object.assign(new Error("You cannot edit this quotation."), {
            status: 403,
            code: "FORBIDDEN",
          });
        const product = (
          await client.query(
            `SELECT id,price_minor,cost_minor,billing_type,cadence FROM products WHERE id=$1 AND workspace_id=$2 AND active=true`,
            [parsed.data.productId, current.user.workspaceId],
          )
        ).rows[0];
        if (!product)
          throw Object.assign(new Error("Product not found."), {
            status: 404,
            code: "PRODUCT_NOT_FOUND",
          });
        await client.query(
          `INSERT INTO quote_lines(quote_id,product_id,quantity,unit_price_minor,unit_cost_minor,discount_bps,billing_type,cadence) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            quote.id,
            product.id,
            parsed.data.quantity,
            product.price_minor,
            product.cost_minor,
            parsed.data.discountBps,
            product.billing_type,
            product.cadence,
          ],
        );
        const loaded = await loadQuoteCalculation(
          client,
          quote.id,
          current.user.workspaceId,
        );
        const revision = number(quote.revision) + 1;
        await client.query(
          `UPDATE quotes SET status='draft',revision=$2,subtotal_minor=$3,discount_minor=$4,total_minor=$5,cost_minor=$6,margin_bps=$7,risk_score=$8,approval_route=$9,version=version+1,updated_at=now() WHERE id=$1`,
          [
            quote.id,
            revision,
            loaded.calculation.subtotalMinor,
            loaded.calculation.discountMinor,
            loaded.calculation.totalMinor,
            loaded.calculation.costMinor,
            loaded.calculation.marginBps,
            loaded.calculation.riskScore,
            loaded.calculation.approvalRoute,
          ],
        );
        await client.query(
          `UPDATE approval_requests SET status='superseded' WHERE quote_id=$1 AND status='pending'`,
          [quote.id],
        );
        await client.query(
          `INSERT INTO quote_revisions(quote_id,revision,snapshot,reason,created_by) VALUES($1,$2,$3,'line_added',$4)`,
          [
            quote.id,
            revision,
            JSON.stringify({
              lines: loaded.lines,
              calculation: loaded.calculation,
            }),
            current.user.id,
          ],
        );
        await writeChange(
          client,
          current.user.workspaceId,
          "quote",
          quote.id,
          number(quote.version) + 1,
        );
        await writeAudit(client, current, "quote.line_added", {
          quoteId: quote.id,
          productId: product.id,
        });
        return { id: quote.id, revision, version: number(quote.version) + 1 };
      });
      return c.json({ data });
    } catch (error) {
      return c.json(
        { error: error.message, code: error.code ?? "QUOTE_UPDATE_FAILED" },
        error.status ?? 500,
      );
    }
  });

  app.post("/api/approvals/:id/decision", auth.required, async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const parsed = await jsonBody(c, decisionInput);
    if (parsed.error)
      return c.json({ error: "Invalid decision.", code: "INVALID_INPUT" }, 400);
    const current = c.get("auth");
    try {
      const data = await store.transaction(async (client) => {
        const request = (
          await client.query(
            `SELECT ar.*,q.workspace_id,q.team_id,q.quote_number,q.approval_route,q.version AS quote_version FROM approval_requests ar JOIN quotes q ON q.id=ar.quote_id WHERE ar.id=$1 FOR UPDATE`,
            [c.req.param("id")],
          )
        ).rows[0];
        if (!request || request.workspace_id !== current.user.workspaceId)
          throw Object.assign(new Error("Approval not found."), {
            status: 404,
            code: "NOT_FOUND",
          });
        const allowed =
          current.role === "admin" ||
          (request.stage === "manager" &&
            current.role === "sales_manager" &&
            request.team_id === current.user.teamId) ||
          (request.stage === "finance" && current.role === "finance_ops");
        if (!allowed)
          throw Object.assign(new Error("You cannot decide this approval."), {
            status: 403,
            code: "FORBIDDEN",
          });
        if (request.status !== "pending")
          throw Object.assign(
            new Error("This approval is no longer pending."),
            { status: 409, code: "ALREADY_DECIDED" },
          );
        await client.query(
          `UPDATE approval_requests SET status=$2,reason=$3,decided_by=$4,decided_at=now() WHERE id=$1`,
          [
            request.id,
            parsed.data.decision === "approve" ? "approved" : "rejected",
            parsed.data.reason ?? null,
            current.user.id,
          ],
        );
        let quoteStatus = "rejected";
        if (parsed.data.decision === "approve") {
          if (request.stage === "manager" && request.approval_route.includes("finance")) {
            await client.query(
              `INSERT INTO approval_requests(quote_id,quote_revision,stage,assigned_team_id) VALUES($1,$2,'finance',$3)
               ON CONFLICT(quote_id,quote_revision,stage) DO UPDATE SET status='pending',decided_by=NULL,decided_at=NULL`,
              [request.quote_id, request.quote_revision, request.team_id],
            );
          }
          const next = (
            await client.query(
              `SELECT stage FROM approval_requests WHERE quote_id=$1 AND quote_revision=$2 AND status='pending' ORDER BY CASE stage WHEN 'manager' THEN 1 ELSE 2 END LIMIT 1`,
              [request.quote_id, request.quote_revision],
            )
          ).rows[0];
          quoteStatus = next ? `pending_${next.stage}` : "approved";
          if (next?.stage === "finance")
            await notifyRole(client, current.user.workspaceId, "finance_ops", {
              category: "Approvals",
              title: `Quotation ${request.quote_number} needs finance review`,
              message: "Manager review is complete.",
              targetType: "quote",
              targetId: request.quote_id,
              priority: true,
            });
        }
        await client.query(
          `UPDATE quotes SET status=$2,version=version+1,updated_at=now() WHERE id=$1`,
          [request.quote_id, quoteStatus],
        );
        await writeChange(
          client,
          current.user.workspaceId,
          "quote",
          request.quote_id,
          number(request.quote_version) + 1,
        );
        await writeAudit(client, current, "approval.decided", {
          approvalId: request.id,
          quoteId: request.quote_id,
          decision: parsed.data.decision,
          stage: request.stage,
        });
        return { quoteId: request.quote_id, status: quoteStatus };
      });
      return c.json({ data });
    } catch (error) {
      return c.json(
        { error: error.message, code: error.code ?? "APPROVAL_FAILED" },
        error.status ?? 500,
      );
    }
  });

  app.post("/api/quotes/:id/portal-link", auth.required, async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const current = c.get("auth");
    if (!["admin", "sales_rep", "sales_manager"].includes(current.role))
      return c.json(
        { error: "You cannot create customer links.", code: "FORBIDDEN" },
        403,
      );
    const pair = tokenPair();
    try {
      const result = await store.query(
        `INSERT INTO portal_links(workspace_id,customer_id,quote_id,token_hash,expires_at,created_by)
         SELECT q.workspace_id,q.customer_id,q.id,$2,now()+interval '30 minutes',$3 FROM quotes q
         WHERE q.id=$1 AND q.workspace_id=$4 AND q.status='approved' AND ($5='admin' OR ($5='sales_rep' AND q.owner_user_id=$3) OR ($5='sales_manager' AND q.team_id=$6))
         RETURNING id,quote_id AS "quoteId",customer_id AS "customerId",expires_at AS "expiresAt"`,
        [
          c.req.param("id"),
          pair.tokenHash,
          current.user.id,
          current.user.workspaceId,
          current.role,
          current.user.teamId,
        ],
      );
      if (!result.rowCount)
        return c.json(
          { error: "Quotation not found.", code: "NOT_FOUND" },
          404,
        );
      const link = `${config.origin}/portal?token=${encodeURIComponent(pair.token)}`;
      const customer = (
        await store.query("SELECT email,name FROM customers WHERE id=$1", [
          result.rows[0].customerId,
        ])
      ).rows[0];
      let delivered = false;
      const mail = await resolveMailSettings(store, config, current.user.workspaceId);
      if (mail.smtpUrl) {
        try {
          const transport = nodemailer.createTransport(mail.smtpUrl);
          await transport.sendMail({
            from: mail.mailFrom,
            to: customer.email,
            subject: "Review your DealFlow360 quotation",
            text: `Hello ${customer.name}, review your quotation: ${link}`,
          });
          delivered = true;
        } catch {
          delivered = false;
        }
      }
      await store.writeAudit({
        userId: current.user.id,
        workspaceId: current.user.workspaceId,
        action: "portal.link_created",
        metadata: { quoteId: result.rows[0].quoteId, delivered },
      });
      return c.json({ data: { ...result.rows[0], link, delivered } });
    } catch (error) {
      return c.json(
        { error: "Could not create portal link.", code: "PORTAL_LINK_FAILED" },
        500,
      );
    }
  });

  app.post("/api/portal/redeem", async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const body = await c.req.json().catch(() => null);
    const parsed = z.object({ token: z.string().min(20) }).safeParse(body);
    if (!parsed.success)
      return c.json({ error: "Invalid link.", code: "INVALID_INPUT" }, 400);
    const tokenHash = hashSessionToken(parsed.data.token);
    const pair = tokenPair();
    const result = await store.query(
      `WITH used AS (UPDATE portal_links SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING customer_id,quote_id) INSERT INTO portal_sessions(token_hash,customer_id,quote_id,expires_at) SELECT $2,customer_id,quote_id,now()+interval '8 hours' FROM used RETURNING customer_id AS "customerId",quote_id AS "quoteId"`,
      [tokenHash, pair.tokenHash],
    );
    if (!result.rowCount)
      return c.json(
        { error: "This link is invalid or expired.", code: "LINK_INVALID" },
        401,
      );
    c.header(
      "Set-Cookie",
      sessionCookie(config.portalCookieName, pair.token, config, 8 * 60 * 60),
    );
    return c.json({
      data: result.rows[0],
      csrfToken: csrfTokenForSession(pair.token),
    });
  });

  async function portalSession(c) {
    const token = readCookie(c.req, config.portalCookieName);
    if (!token) return null;
    return (
      (
        await store.query(
          `SELECT ps.customer_id AS "customerId",ps.quote_id AS "quoteId",q.workspace_id AS "workspaceId" FROM portal_sessions ps JOIN quotes q ON q.id=ps.quote_id WHERE ps.token_hash=$1 AND ps.expires_at>now()`,
          [hashSessionToken(token)],
        )
      ).rows[0] ?? null
    );
  }
  app.get("/api/portal/quote", async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const portal = await portalSession(c);
    if (!portal)
      return c.json(
        { error: "Customer session required.", code: "PORTAL_AUTH_REQUIRED" },
        401,
      );
    const result = await store.query(
      `SELECT q.id,q.quote_number AS "quoteNumber",q.status,q.revision,q.total_minor AS "totalMinor",q.margin_bps AS "marginBps",c.name AS customer,COALESCE(json_agg(json_build_object('id',l.id,'product',p.name,'quantity',l.quantity,'unitPriceMinor',l.unit_price_minor,'discountBps',l.discount_bps)),'[]') AS lines FROM quotes q JOIN customers c ON c.id=q.customer_id JOIN quote_lines l ON l.quote_id=q.id JOIN products p ON p.id=l.product_id WHERE q.id=$1 AND q.customer_id=$2 GROUP BY q.id,c.name`,
      [portal.quoteId, portal.customerId],
    );
    return c.json({ data: result.rows[0] });
  });

  app.post("/api/portal/quote/respond", async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const portal = await portalSession(c);
    if (!portal)
      return c.json(
        { error: "Customer session required.", code: "PORTAL_AUTH_REQUIRED" },
        401,
      );
    const parsed = await jsonBody(c, counterInput);
    if (parsed.error)
      return c.json({ error: "Invalid response.", code: "INVALID_INPUT" }, 400);
    try {
      const data = await store.transaction(async (client) => {
        const locked = (
          await client.query(
            "SELECT * FROM quotes WHERE id=$1 AND customer_id=$2 FOR UPDATE",
            [portal.quoteId, portal.customerId],
          )
        ).rows[0];
        if (!locked)
          throw Object.assign(new Error("Quotation not found."), {
            status: 404,
            code: "NOT_FOUND",
          });
        if (parsed.data.action === "accept") {
          if (locked.status !== "approved")
            throw Object.assign(
              new Error(
                "This quotation must complete approval before acceptance.",
              ),
              { status: 409, code: "QUOTE_NOT_READY" },
            );
          await client.query(
            `UPDATE quotes SET status='accepted',accepted_at=now(),version=version+1,updated_at=now() WHERE id=$1`,
            [locked.id],
          );
        } else if (parsed.data.action === "reject")
          await client.query(
            `UPDATE quotes SET status='rejected',version=version+1,updated_at=now() WHERE id=$1`,
            [locked.id],
          );
        else if (parsed.data.action === "counteroffer") {
          const currentLines = (
            await client.query(
              'SELECT id,product_id AS "productId",quantity,discount_bps AS "discountBps" FROM quote_lines WHERE quote_id=$1',
              [locked.id],
            )
          ).rows;
          const requested = new Map(
            (parsed.data.lines ?? []).map((line) => [line.lineId, line]),
          );
          const replacement = currentLines.map((line) => {
            const change = requested.get(line.id);
            return {
              productId: line.productId,
              quantity: change?.quantity ?? line.quantity,
              discountBps: change?.discountBps ?? line.discountBps,
            };
          });
          const loaded = await loadQuoteCalculation(
            client,
            locked.id,
            portal.workspaceId,
            replacement,
          );
          await client.query("DELETE FROM quote_lines WHERE quote_id=$1", [
            locked.id,
          ]);
          for (const line of loaded.lines)
            await client.query(
              `INSERT INTO quote_lines(quote_id,product_id,quantity,unit_price_minor,unit_cost_minor,discount_bps,billing_type,cadence) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
              [
                locked.id,
                line.productId,
                line.quantity,
                line.unitPriceMinor,
                line.unitCostMinor,
                line.discountBps,
                line.billingType,
                line.cadence,
              ],
            );
          const revision = locked.revision + 1;
          await client.query(
            `UPDATE quotes SET status='negotiation',revision=$2,subtotal_minor=$3,discount_minor=$4,total_minor=$5,cost_minor=$6,margin_bps=$7,risk_score=$8,approval_route=$9,version=version+1,updated_at=now() WHERE id=$1`,
            [
              locked.id,
              revision,
              loaded.calculation.subtotalMinor,
              loaded.calculation.discountMinor,
              loaded.calculation.totalMinor,
              loaded.calculation.costMinor,
              loaded.calculation.marginBps,
              loaded.calculation.riskScore,
              loaded.calculation.approvalRoute,
            ],
          );
          await client.query(
            `UPDATE approval_requests SET status='superseded' WHERE quote_id=$1 AND status='pending'`,
            [locked.id],
          );
          await client.query(
            `INSERT INTO quote_revisions(quote_id,revision,snapshot,reason) VALUES($1,$2,$3,'customer_counteroffer')`,
            [
              locked.id,
              revision,
              JSON.stringify({
                lines: replacement,
                calculation: loaded.calculation,
              }),
            ],
          );
        }
        await client.query(
          `INSERT INTO negotiations(quote_id,quote_revision,actor_type,action,message,requested_lines) VALUES($1,$2,'customer',$3,$4,$5)`,
          [
            locked.id,
            locked.revision,
            parsed.data.action,
            parsed.data.message ?? null,
            parsed.data.lines ? JSON.stringify(parsed.data.lines) : null,
          ],
        );
        await writeChange(
          client,
          portal.workspaceId,
          "quote",
          locked.id,
          locked.version + 1,
        );
        return {
          quoteId: locked.id,
          status:
            parsed.data.action === "counteroffer"
              ? "negotiation"
              : parsed.data.action === "accept"
                ? "accepted"
                : parsed.data.action === "reject"
                  ? "rejected"
                  : locked.status,
        };
      });
      return c.json({ data });
    } catch (error) {
      return c.json(
        { error: error.message, code: error.code ?? "PORTAL_RESPONSE_FAILED" },
        error.status ?? 500,
      );
    }
  });

  app.post(
    "/api/fulfillment/quotes/:id/allocate",
    auth.capability("fulfillment.manage"),
    async (c) => {
      const unavailable = dbRequired(c, store);
      if (unavailable) return unavailable;
      const current = c.get("auth");
      try {
        const data = await store.transaction(async (client) => {
          const quote = (
            await client.query(
              `SELECT * FROM quotes WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,
              [c.req.param("id"), current.user.workspaceId],
            )
          ).rows[0];
          if (!quote || quote.status !== "accepted")
            throw Object.assign(
              new Error("Only accepted quotations can be allocated."),
              { status: 409, code: "QUOTE_NOT_ACCEPTED" },
            );
          const lines = (
            await client.query(
              `SELECT product_id AS "productId",quantity FROM quote_lines WHERE quote_id=$1 AND billing_type='one_time'`,
              [quote.id],
            )
          ).rows.map((row) => ({ ...row, quantity: number(row.quantity) }));
          const stockRows = (
            await client.query(
              `SELECT w.id,w.shipping_cost_minor AS "shippingCostMinor",i.product_id AS "productId",(i.available_quantity-i.reserved_quantity) AS quantity FROM warehouses w JOIN inventory_levels i ON i.warehouse_id=w.id WHERE w.workspace_id=$1 AND w.active=true AND i.product_id=ANY($2::uuid[]) FOR UPDATE OF i`,
              [current.user.workspaceId, lines.map((line) => line.productId)],
            )
          ).rows;
          const warehouses = [
            ...new Map(
              stockRows.map((row) => [
                row.id,
                {
                  id: row.id,
                  shippingCostMinor: number(row.shippingCostMinor),
                  stock: {},
                },
              ]),
            ).values(),
          ];
          for (const row of stockRows)
            warehouses.find((item) => item.id === row.id).stock[row.productId] =
              number(row.quantity);
          const allocation = allocateInventory(lines, warehouses);
          const order = (
            await client.query(
              `INSERT INTO orders(workspace_id,quote_id,status) VALUES($1,$2,$3) ON CONFLICT(quote_id) DO UPDATE SET status=EXCLUDED.status,version=orders.version+1,updated_at=now() RETURNING id,version`,
              [
                current.user.workspaceId,
                quote.id,
                allocation.backorderUnits ? "backorder" : "reserved",
              ],
            )
          ).rows[0];
          await client.query("DELETE FROM shipments WHERE order_id=$1", [
            order.id,
          ]);
          for (const shipment of allocation.shipments) {
            await client.query(
              `INSERT INTO shipments(order_id,warehouse_id,status,shipping_cost_minor,lines) VALUES($1,$2,'planned',$3,$4)`,
              [
                order.id,
                shipment.warehouseId,
                shipment.shippingCostMinor,
                JSON.stringify(shipment.lines),
              ],
            );
            for (const line of shipment.lines)
              await client.query(
                `UPDATE inventory_levels SET reserved_quantity=reserved_quantity+$3,version=version+1 WHERE warehouse_id=$1 AND product_id=$2`,
                [shipment.warehouseId, line.productId, line.quantity],
              );
          }
          if (allocation.backorders.length)
            await client.query(
              `INSERT INTO shipments(order_id,status,lines) VALUES($1,'backorder',$2)`,
              [order.id, JSON.stringify(allocation.backorders)],
            );
          const recurring = (
            await client.query(
              `SELECT l.*,p.name FROM quote_lines l JOIN products p ON p.id=l.product_id WHERE l.quote_id=$1 AND l.billing_type='recurring'`,
              [quote.id],
            )
          ).rows;
          for (const line of recurring) {
            const window = billingWindow(line.cadence);
            const netPeriodMinor = Math.round(number(line.unit_price_minor) * number(line.quantity) * (10_000 - number(line.discount_bps)) / 10_000);
            const proratedMinor = prorateMinor(netPeriodMinor, window.activeDays, window.periodDays);
            const subscription = (await client.query(
              `INSERT INTO subscriptions(workspace_id,customer_id,quote_id,product_id,cadence,quantity,unit_price_minor,starts_on,next_bill_on) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
              [current.user.workspaceId, quote.customer_id, quote.id, line.product_id, line.cadence, line.quantity, Math.round(number(line.unit_price_minor) * (10_000 - number(line.discount_bps)) / 10_000), window.startsOn, window.nextBillOn],
            )).rows[0];
            if (proratedMinor > 0) {
              const invoice = (await client.query(`INSERT INTO invoices(workspace_id,customer_id,quote_id,subscription_id,period_start,period_end,total_minor,due_on) VALUES($1,$2,$3,$4,$5,$6,$7,current_date+interval '14 days') RETURNING id`, [current.user.workspaceId, quote.customer_id, quote.id, subscription.id, window.startsOn, window.nextBillOn, proratedMinor])).rows[0];
              await client.query(`INSERT INTO invoice_lines(invoice_id,description,quantity,unit_price_minor,amount_minor) VALUES($1,$2,1,$3,$3)`, [invoice.id, `${line.name} prorated first period`, proratedMinor]);
            }
          }
          const oneTime =
            quote.total_minor -
            number(
              (
                await client.query(
                  `SELECT COALESCE(sum(quantity*unit_price_minor*(10000-discount_bps)/10000),0) AS recurring FROM quote_lines WHERE quote_id=$1 AND billing_type='recurring'`,
                  [quote.id],
                )
              ).rows[0].recurring,
            );
          if (oneTime > 0) {
            const invoice = (
              await client.query(
                `INSERT INTO invoices(workspace_id,customer_id,quote_id,total_minor,due_on) VALUES($1,$2,$3,$4,current_date+interval '14 days') RETURNING id`,
                [
                  current.user.workspaceId,
                  quote.customer_id,
                  quote.id,
                  oneTime,
                ],
              )
            ).rows[0];
            await client.query(
              `INSERT INTO invoice_lines(invoice_id,description,quantity,unit_price_minor,amount_minor) VALUES($1,'One-time quotation items',1,$2,$2)`,
              [invoice.id, oneTime],
            );
          }
          if (allocation.backorderUnits)
            await client.query(
              `INSERT INTO deal_alerts(workspace_id,quote_id,category,severity,title,message) VALUES($1,$2,'fulfillment','high','Backorder risk',$3)`,
              [
                current.user.workspaceId,
                quote.id,
                `${allocation.backorderUnits} units could not be reserved.`,
              ],
            );
          await writeChange(
            client,
            current.user.workspaceId,
            "order",
            order.id,
            order.version,
          );
          await writeAudit(client, current, "fulfillment.allocated", {
            quoteId: quote.id,
            orderId: order.id,
            shipments: allocation.shipments.length,
            backorderUnits: allocation.backorderUnits,
          });
          return { orderId: order.id, ...allocation };
        });
        return c.json({ data });
      } catch (error) {
        return c.json(
          { error: error.message, code: error.code ?? "ALLOCATION_FAILED" },
          error.status ?? 500,
        );
      }
    },
  );

  app.post(
    "/api/invoices/:id/payments",
    auth.capability("billing.manage"),
    async (c) => {
      const unavailable = dbRequired(c, store);
      if (unavailable) return unavailable;
      const parsed = await jsonBody(c, paymentInput);
      if (parsed.error)
        return c.json(
          { error: "Invalid payment.", code: "INVALID_INPUT" },
          400,
        );
      const key = c.req.header("Idempotency-Key");
      if (!key)
        return c.json(
          {
            error: "Idempotency-Key is required.",
            code: "IDEMPOTENCY_REQUIRED",
          },
          400,
        );
      const current = c.get("auth");
      try {
        const data = await store.transaction(async (client) => {
          const invoice = (
            await client.query(
              `SELECT * FROM invoices WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,
              [c.req.param("id"), current.user.workspaceId],
            )
          ).rows[0];
          if (!invoice)
            throw Object.assign(new Error("Invoice not found."), {
              status: 404,
              code: "NOT_FOUND",
            });
          const balance =
            number(invoice.total_minor) - number(invoice.paid_minor);
          if (parsed.data.amountMinor > balance)
            throw Object.assign(
              new Error("Payment exceeds the outstanding balance."),
              { status: 409, code: "OVERPAYMENT" },
            );
          const inserted = await client.query(
            `INSERT INTO payments(invoice_id,amount_minor,reference,recorded_by,idempotency_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT(invoice_id,idempotency_key) DO NOTHING RETURNING id`,
            [
              invoice.id,
              parsed.data.amountMinor,
              parsed.data.reference,
              current.user.id,
              key,
            ],
          );
          if (!inserted.rowCount)
            return {
              invoiceId: invoice.id,
              status: invoice.status,
              idempotent: true,
            };
          const paid = number(invoice.paid_minor) + parsed.data.amountMinor;
          const status = invoiceStatus(
            number(invoice.total_minor),
            paid,
            invoice.due_on,
          );
          await client.query(
            `UPDATE invoices SET paid_minor=$2,status=$3,version=version+1,updated_at=now() WHERE id=$1`,
            [invoice.id, paid, status],
          );
          await writeChange(
            client,
            current.user.workspaceId,
            "invoice",
            invoice.id,
            invoice.version + 1,
          );
          await writeAudit(client, current, "payment.recorded", {
            invoiceId: invoice.id,
            paymentId: inserted.rows[0].id,
            amountMinor: parsed.data.amountMinor,
          });
          return {
            invoiceId: invoice.id,
            paymentId: inserted.rows[0].id,
            status,
            paidMinor: paid,
          };
        });
        return c.json({ data });
      } catch (error) {
        return c.json(
          { error: error.message, code: error.code ?? "PAYMENT_FAILED" },
          error.status ?? 500,
        );
      }
    },
  );

  app.patch(
    "/api/subscriptions/:id",
    auth.capability("billing.manage"),
    async (c) => {
      const unavailable = dbRequired(c, store);
      if (unavailable) return unavailable;
      const parsed = z
        .object({
          status: z.enum(["active", "paused", "cancelled"]),
          expectedVersion: z.number().int().positive(),
        })
        .safeParse(await c.req.json().catch(() => null));
      if (!parsed.success)
        return c.json(
          { error: "Invalid subscription update.", code: "INVALID_INPUT" },
          400,
        );
      const current = c.get("auth");
      const result = await store.query(
        `UPDATE subscriptions SET status=$3,version=version+1 WHERE id=$1 AND workspace_id=$2 AND version=$4 RETURNING id,status,version`,
        [
          c.req.param("id"),
          current.user.workspaceId,
          parsed.data.status,
          parsed.data.expectedVersion,
        ],
      );
      if (!result.rowCount)
        return c.json(
          {
            error: "Subscription changed on another device.",
            code: "VERSION_CONFLICT",
          },
          409,
        );
      await store.query(
        `INSERT INTO sync_changes(workspace_id,entity_type,entity_id,operation,version) VALUES($1,'subscription',$2,'upsert',$3)`,
        [current.user.workspaceId, c.req.param("id"), result.rows[0].version],
      );
      return c.json({ data: result.rows[0] });
    },
  );

  app.get("/api/sync", auth.required, async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const current = c.get("auth");
    const cursor = Math.max(0, Number(c.req.query("cursor") ?? 0));
    const result = await store.query(
      `SELECT cursor,entity_type AS "entityType",entity_id AS "entityId",operation,version,changed_at AS "changedAt" FROM sync_changes WHERE workspace_id=$1 AND cursor>$2 ORDER BY cursor LIMIT 500`,
      [current.user.workspaceId, cursor],
    );
    return c.json({
      data: result.rows,
      nextCursor: result.rows.length
        ? number(result.rows.at(-1).cursor)
        : cursor,
      hasMore: result.rows.length === 500,
    });
  });

  app.get("/api/events", auth.required, async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const current = c.get("auth");
    let cursor = Math.max(0, Number(c.req.query("cursor") ?? 0));
    c.header("X-Accel-Buffering", "no");
    return streamSSE(c, async (stream) => {
      while (!stream.closed) {
        const result = await store.query(
          `SELECT cursor,entity_type AS "entityType",entity_id AS "entityId",operation,version FROM sync_changes WHERE workspace_id=$1 AND cursor>$2 ORDER BY cursor LIMIT 100`,
          [current.user.workspaceId, cursor],
        );
        for (const change of result.rows) {
          cursor = number(change.cursor);
          await stream.writeSSE({
            event: "change",
            id: String(cursor),
            data: JSON.stringify(change),
          });
        }
        await stream.writeSSE({
          event: "heartbeat",
          data: JSON.stringify({ cursor }),
        });
        await stream.sleep(5000);
      }
    });
  });

  app.get("/api/search", auth.required, async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const current = c.get("auth");
    const query = (c.req.query("q") ?? "").trim();
    if (!query) return c.json({ data: [] });
    const scope = quoteScope(current, 3);
    const pattern = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    const result = await store.query(
      `SELECT * FROM (SELECT q.id,'quote' AS type,'Q-'||lpad(q.quote_number::text,4,'0')||' · '||c.name AS label,q.status AS context,q.updated_at FROM quotes q JOIN customers c ON c.id=q.customer_id WHERE q.workspace_id=$1 AND (c.name ILIKE $2 OR q.quote_number::text ILIKE $2)${scope.sql} UNION ALL SELECT p.id,'product',p.name,p.sku,now() FROM products p WHERE p.workspace_id=$1 AND (p.name ILIKE $2 OR p.sku ILIKE $2)) matches ORDER BY updated_at DESC LIMIT 50`,
      [current.user.workspaceId, pattern, ...scope.params],
    );
    return c.json({ data: result.rows });
  });

  app.get("/api/notifications", auth.required, async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const result = await store.query(
      `SELECT id,category,title,message,target_type AS "targetType",target_id AS "targetId",priority,read_at AS "readAt",created_at AS "createdAt" FROM notifications WHERE user_id=$1 AND dismissed_at IS NULL ORDER BY created_at DESC`,
      [c.get("auth").user.id],
    );
    return c.json({ data: result.rows });
  });
  app.post("/api/notifications/read-all", auth.required, async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    await store.query(
      "UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE user_id=$1 AND dismissed_at IS NULL",
      [c.get("auth").user.id],
    );
    return c.json({ data: { ok: true } });
  });
  app.post("/api/notifications/:id/read", auth.required, async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    await store.query(
      "UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2",
      [c.req.param("id"), c.get("auth").user.id],
    );
    return c.json({ data: { ok: true } });
  });
  app.delete("/api/notifications", auth.required, async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    await store.query(
      "UPDATE notifications SET dismissed_at=now() WHERE user_id=$1 AND dismissed_at IS NULL",
      [c.get("auth").user.id],
    );
    return c.json({ data: { ok: true } });
  });

  app.patch("/api/preferences", auth.required, async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const parsed = z
      .object({
        theme: z.enum(["light", "dark", "system"]),
        accent: z.enum(["blue", "green", "amber", "violet"]),
        desktopAlerts: z.boolean(),
        soundAlerts: z.boolean(),
        priorityOnly: z.boolean(),
        dnd: z.boolean(),
      })
      .partial()
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      return c.json(
        { error: "Invalid preferences.", code: "INVALID_INPUT" },
        400,
      );
    const current = c.get("auth");
    const result = await store.query(
      `INSERT INTO user_preferences(user_id,theme,accent,desktop_alerts,sound_alerts,priority_only,dnd) VALUES($1,COALESCE($2,'system'),COALESCE($3,'blue'),COALESCE($4,true),COALESCE($5,true),COALESCE($6,false),COALESCE($7,false)) ON CONFLICT(user_id) DO UPDATE SET theme=COALESCE($2,user_preferences.theme),accent=COALESCE($3,user_preferences.accent),desktop_alerts=COALESCE($4,user_preferences.desktop_alerts),sound_alerts=COALESCE($5,user_preferences.sound_alerts),priority_only=COALESCE($6,user_preferences.priority_only),dnd=COALESCE($7,user_preferences.dnd),updated_at=now() RETURNING theme,accent,desktop_alerts AS "desktopAlerts",sound_alerts AS "soundAlerts",priority_only AS "priorityOnly",dnd`,
      [
        current.user.id,
        parsed.data.theme ?? null,
        parsed.data.accent ?? null,
        parsed.data.desktopAlerts ?? null,
        parsed.data.soundAlerts ?? null,
        parsed.data.priorityOnly ?? null,
        parsed.data.dnd ?? null,
      ],
    );
    return c.json({ data: result.rows[0] });
  });

  app.get("/api/admin/teams", auth.capability("teams.manage"), async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const result = await store.query(
      `SELECT t.id,t.name,t.manager_user_id AS "managerUserId",t.version,COALESCE(json_agg(json_build_object('id',u.id,'fullName',u.full_name,'email',u.email,'role',m.role)) FILTER(WHERE u.id IS NOT NULL),'[]') members FROM sales_teams t LEFT JOIN workspace_memberships m ON m.team_id=t.id LEFT JOIN users u ON u.id=m.user_id WHERE t.workspace_id=$1 GROUP BY t.id ORDER BY t.name`,
      [c.get("auth").user.workspaceId],
    );
    return c.json({ data: result.rows });
  });
  app.post("/api/admin/teams", auth.capability("teams.manage"), async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const parsed = z
      .object({
        name: z.string().trim().min(2).max(80),
        managerUserId: uuid.optional(),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      return c.json({ error: "Invalid team.", code: "INVALID_INPUT" }, 400);
    const current = c.get("auth");
    if (parsed.data.managerUserId) {
      const manager = await store.query(
        `SELECT 1 FROM users u JOIN workspace_memberships m ON m.user_id=u.id WHERE u.id=$1 AND m.workspace_id=$2 AND m.role='sales_manager'`,
        [parsed.data.managerUserId, current.user.workspaceId],
      );
      if (!manager.rowCount)
        return c.json(
          { error: "Sales manager not found.", code: "MANAGER_NOT_FOUND" },
          404,
        );
    }
    const result = await store.query(
      `INSERT INTO sales_teams(workspace_id,name,manager_user_id) VALUES($1,$2,$3) RETURNING id,name,manager_user_id AS "managerUserId",version`,
      [
        current.user.workspaceId,
        parsed.data.name,
        parsed.data.managerUserId ?? null,
      ],
    );
    await store.writeAudit({
      userId: current.user.id,
      workspaceId: current.user.workspaceId,
      action: "team.created",
      metadata: { teamId: result.rows[0].id },
    });
    await writeChange(store, current.user.workspaceId, "team", result.rows[0].id, result.rows[0].version);
    return c.json({ data: result.rows[0] }, 201);
  });

  app.patch("/api/admin/teams/:id", auth.capability("teams.manage"), async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const parsed = z.object({
      name: z.string().trim().min(2).max(80).optional(),
      managerUserId: uuid.nullable().optional(),
      expectedVersion: z.number().int().positive(),
    }).refine((value) => value.name !== undefined || value.managerUserId !== undefined).safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Invalid team update.", code: "INVALID_INPUT" }, 400);
    const current = c.get("auth");
    if (parsed.data.managerUserId) {
      const manager = await store.query(
        `SELECT 1 FROM workspace_memberships WHERE user_id=$1 AND workspace_id=$2 AND team_id=$3 AND role='sales_manager'`,
        [parsed.data.managerUserId, current.user.workspaceId, c.req.param("id")],
      );
      if (!manager.rowCount) return c.json({ error: "Choose a Sales Manager from this team.", code: "MANAGER_NOT_FOUND" }, 400);
    }
    const managerSpecified = parsed.data.managerUserId !== undefined;
    const result = await store.query(
      `UPDATE sales_teams SET name=COALESCE($3,name),manager_user_id=CASE WHEN $4 THEN $5 ELSE manager_user_id END,version=version+1,updated_at=now()
       WHERE id=$1 AND workspace_id=$2 AND version=$6
       RETURNING id,name,manager_user_id AS "managerUserId",version`,
      [c.req.param("id"), current.user.workspaceId, parsed.data.name ?? null, managerSpecified, parsed.data.managerUserId ?? null, parsed.data.expectedVersion],
    );
    if (!result.rowCount) return c.json({ error: "Team changed on another device.", code: "VERSION_CONFLICT" }, 409);
    await store.writeAudit({ userId: current.user.id, workspaceId: current.user.workspaceId, action: "team.updated", metadata: { teamId: c.req.param("id") } });
    await writeChange(store, current.user.workspaceId, "team", result.rows[0].id, result.rows[0].version);
    return c.json({ data: result.rows[0] });
  });

  app.delete("/api/admin/teams/:id", auth.capability("teams.manage"), async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const parsed = z.object({ expectedVersion: z.number().int().positive() }).safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Invalid team version.", code: "INVALID_INPUT" }, 400);
    const current = c.get("auth");
    const dependencies = await store.query(
      `SELECT
        (SELECT count(*)::int FROM workspace_memberships WHERE team_id=$1) AS members,
        (SELECT count(*)::int FROM quotes WHERE team_id=$1) AS quotes`,
      [c.req.param("id")],
    );
    if (number(dependencies.rows[0]?.members) || number(dependencies.rows[0]?.quotes)) {
      return c.json({ error: "Move team members and quotations before deleting this team.", code: "TEAM_IN_USE" }, 409);
    }
    const result = await store.query(
      `DELETE FROM sales_teams WHERE id=$1 AND workspace_id=$2 AND version=$3 RETURNING id`,
      [c.req.param("id"), current.user.workspaceId, parsed.data.expectedVersion],
    );
    if (!result.rowCount) return c.json({ error: "Team changed on another device.", code: "VERSION_CONFLICT" }, 409);
    await store.writeAudit({ userId: current.user.id, workspaceId: current.user.workspaceId, action: "team.deleted", metadata: { teamId: c.req.param("id") } });
    await writeChange(store, current.user.workspaceId, "team", result.rows[0].id, parsed.data.expectedVersion + 1, "delete");
    return c.json({ data: { id: result.rows[0].id } });
  });

  app.patch("/api/admin/teams/:teamId/members/:userId", auth.capability("teams.manage"), async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const parsed = z.object({ role: z.enum(["admin", "sales_rep", "sales_manager", "finance_ops"]) }).safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Invalid member role.", code: "INVALID_INPUT" }, 400);
    const current = c.get("auth");
    if (c.req.param("userId") === current.user.id) return c.json({ error: "Use another admin to change your own access.", code: "SELF_ROLE_CHANGE" }, 409);
    try {
      const data = await store.transaction(async (client) => {
        const membership = (await client.query(
          `SELECT role FROM workspace_memberships WHERE user_id=$1 AND workspace_id=$2 AND team_id=$3 FOR UPDATE`,
          [c.req.param("userId"), current.user.workspaceId, c.req.param("teamId")],
        )).rows[0];
        if (!membership) throw Object.assign(new Error("Team member not found."), { status: 404, code: "MEMBER_NOT_FOUND" });
        if (membership.role === "admin" && parsed.data.role !== "admin") {
          const admins = await client.query(`SELECT count(*)::int AS count FROM workspace_memberships WHERE workspace_id=$1 AND role='admin'`, [current.user.workspaceId]);
          if (number(admins.rows[0].count) <= 1) throw Object.assign(new Error("Keep at least one workspace admin."), { status: 409, code: "LAST_ADMIN" });
        }
        await client.query(
          `UPDATE workspace_memberships SET role=$4 WHERE user_id=$1 AND workspace_id=$2 AND team_id=$3`,
          [c.req.param("userId"), current.user.workspaceId, c.req.param("teamId"), parsed.data.role],
        );
        if (parsed.data.role !== "sales_manager") await client.query(`UPDATE sales_teams SET manager_user_id=NULL,version=version+1,updated_at=now() WHERE id=$1 AND manager_user_id=$2`, [c.req.param("teamId"), c.req.param("userId")]);
        await writeChange(client, current.user.workspaceId, "team", c.req.param("teamId"));
        await writeAudit(client, current, "team.member_role_updated", { teamId: c.req.param("teamId"), userId: c.req.param("userId"), role: parsed.data.role });
        return { userId: c.req.param("userId"), role: parsed.data.role };
      });
      return c.json({ data });
    } catch (error) {
      return c.json({ error: error.message, code: error.code ?? "MEMBER_UPDATE_FAILED" }, error.status ?? 500);
    }
  });

  app.delete("/api/admin/teams/:teamId/members/:userId", auth.capability("teams.manage"), async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const current = c.get("auth");
    if (c.req.param("userId") === current.user.id) return c.json({ error: "You cannot remove yourself from your team.", code: "SELF_REMOVE" }, 409);
    const result = await store.query(
      `UPDATE workspace_memberships SET team_id=NULL WHERE user_id=$1 AND workspace_id=$2 AND team_id=$3 RETURNING user_id`,
      [c.req.param("userId"), current.user.workspaceId, c.req.param("teamId")],
    );
    if (!result.rowCount) return c.json({ error: "Team member not found.", code: "MEMBER_NOT_FOUND" }, 404);
    await store.query(`UPDATE sales_teams SET manager_user_id=NULL,version=version+1,updated_at=now() WHERE id=$1 AND manager_user_id=$2`, [c.req.param("teamId"), c.req.param("userId")]);
    await writeChange(store, current.user.workspaceId, "team", c.req.param("teamId"));
    await store.writeAudit({ userId: current.user.id, workspaceId: current.user.workspaceId, action: "team.member_removed", metadata: { teamId: c.req.param("teamId"), userId: c.req.param("userId") } });
    return c.json({ data: { userId: result.rows[0].user_id } });
  });

  app.get("/api/admin/environment", auth.capability("environment.manage"), async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const current = c.get("auth");
    const mail = await resolveMailSettings(store, config, current.user.workspaceId);
    const smtp = smtpConnectionDetails(mail.smtpUrl);
    return c.json({ data: {
      smtpConfigured: Boolean(mail.smtpUrl),
      smtpHost: smtpHost(mail.smtpUrl),
      smtpPort: smtp.port,
      smtpUsername: smtp.username,
      smtpSecure: smtp.secure,
      smtpHasPassword: smtp.hasPassword,
      source: mail.source,
      mailFrom: mail.mailFrom,
      version: mail.version ?? 0,
      updatedAt: mail.updatedAt ?? null,
      encryptionReady: Boolean(config.settingsEncryptionKey),
    } });
  });

  app.patch("/api/admin/environment", auth.capability("environment.manage"), async (c) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const parsed = z.object({
      smtpUrl: z.string().trim().max(1000).refine((value) => value === "" || /^smtps?:\/\//i.test(value), "Use an smtp:// or smtps:// URL.").optional(),
      smtpHost: z.string().trim().min(1).max(253).regex(/^[a-z0-9.-]+$/i).optional(),
      smtpPort: z.number().int().min(1).max(65535).optional(),
      smtpUsername: z.string().trim().max(254).optional(),
      smtpPassword: z.string().max(512).optional(),
      smtpSecure: z.boolean().optional(),
      mailFrom: z.string().trim().min(3).max(254).optional(),
      clearSmtp: z.boolean().optional(),
    }).refine((value) => value.smtpUrl !== undefined || value.smtpHost !== undefined || value.mailFrom !== undefined || value.clearSmtp).safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Enter valid environment settings.", code: "INVALID_INPUT" }, 400);
    const current = c.get("auth");
    const currentMail = await resolveMailSettings(store, config, current.user.workspaceId);
    const currentSmtp = smtpConnectionDetails(currentMail.smtpUrl);
    const changeSmtp = parsed.data.smtpUrl !== undefined || parsed.data.smtpHost !== undefined || parsed.data.clearSmtp === true;
    let nextSmtpUrl = parsed.data.smtpUrl || null;
    if (parsed.data.smtpHost !== undefined) {
      const password = parsed.data.smtpPassword || (currentSmtp.hasPassword && currentMail.smtpUrl ? decodeURIComponent(new URL(currentMail.smtpUrl).password) : "");
      if (!password) return c.json({ error: "Enter the SMTP password.", code: "SMTP_PASSWORD_REQUIRED" }, 400);
      nextSmtpUrl = buildSmtpUrl({
        host: parsed.data.smtpHost,
        port: parsed.data.smtpPort ?? currentSmtp.port,
        username: parsed.data.smtpUsername ?? currentSmtp.username,
        password,
        secure: parsed.data.smtpSecure ?? currentSmtp.secure,
      });
    }
    if (nextSmtpUrl && !config.settingsEncryptionKey) return c.json({ error: "Server-side encryption is not configured.", code: "ENCRYPTION_UNAVAILABLE" }, 503);
    const encrypted = nextSmtpUrl ? encryptSetting(nextSmtpUrl, config.settingsEncryptionKey) : null;
    await store.query(
      `INSERT INTO workspace_environment_settings(workspace_id,smtp_url_encrypted,mail_from,updated_by)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(workspace_id) DO UPDATE SET
         smtp_url_encrypted=CASE WHEN $5 THEN EXCLUDED.smtp_url_encrypted ELSE workspace_environment_settings.smtp_url_encrypted END,
         mail_from=COALESCE(EXCLUDED.mail_from,workspace_environment_settings.mail_from),
         version=workspace_environment_settings.version+1,updated_by=$4,updated_at=now()`,
      [current.user.workspaceId, encrypted, parsed.data.mailFrom ?? null, current.user.id, changeSmtp],
    );
    await store.writeAudit({ userId: current.user.id, workspaceId: current.user.workspaceId, action: "environment.smtp_updated", metadata: { smtpChanged: changeSmtp, smtpConfigured: Boolean(nextSmtpUrl), mailFromChanged: parsed.data.mailFrom !== undefined } });
    const mail = await resolveMailSettings(store, config, current.user.workspaceId);
    const smtp = smtpConnectionDetails(mail.smtpUrl);
    return c.json({ data: { smtpConfigured: Boolean(mail.smtpUrl), smtpHost: smtp.host, smtpPort: smtp.port, smtpUsername: smtp.username, smtpSecure: smtp.secure, smtpHasPassword: smtp.hasPassword, source: mail.source, mailFrom: mail.mailFrom, version: mail.version, updatedAt: mail.updatedAt, encryptionReady: Boolean(config.settingsEncryptionKey) } });
  });

  const renderReport = async (c, format) => {
    const unavailable = dbRequired(c, store);
    if (unavailable) return unavailable;
    const current = c.get("auth");
    const filter = z.object({
      status: z.enum(["draft", "pending_manager", "pending_finance", "approved", "negotiation", "accepted", "rejected", "expired"]).optional(),
      ownerId: uuid.optional(),
    }).safeParse({ status: c.req.query("status") || undefined, ownerId: c.req.query("ownerId") || undefined });
    if (!filter.success) return c.json({ error: "Invalid report filters.", code: "INVALID_INPUT" }, 400);
    const scoped = await listQuotes(store, current);
    const quotes = scoped.filter((quote) => (!filter.data.status || quote.status === filter.data.status) && (!filter.data.ownerId || quote.ownerUserId === filter.data.ownerId));
    if (format === "xls") {
      const columns = ["Quote", "Customer", "Owner", "Team", "Status", "Value (INR minor)", "Margin bps", "Risk"];
      const rows = quotes.map((quote) => [quote.quoteNumber, quote.customer, quote.owner, quote.team, quote.status, quote.totalMinor, quote.marginBps, quote.riskScore]);
      const cells = (values) => `<Row>${values.map((value) => `<Cell><Data ss:Type="${typeof value === "number" ? "Number" : "String"}">${xml(value)}</Data></Cell>`).join("")}</Row>`;
      const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Deals"><Table>${cells(columns)}${rows.map(cells).join("")}</Table></Worksheet></Workbook>`;
      c.header("Content-Type", "application/vnd.ms-excel; charset=utf-8");
      c.header("Content-Disposition", 'attachment; filename="dealflow360-deals.xls"');
      return c.body(workbook);
    }
    if (format === "pdf") {
      const chunks = [];
      const document = new PDFDocument({ margin: 42, size: "A4" });
      document.on("data", (chunk) => chunks.push(chunk));
      const done = new Promise((resolve) => document.on("end", resolve));
      document.fontSize(20).text("DealFlow360 Deal Report");
      document.fontSize(9).fillColor("#5b6475").text(`Generated ${new Date().toISOString()} · ${quotes.length} role-scoped deals`);
      document.moveDown();
      const total = quotes.reduce((sum, quote) => sum + quote.totalMinor, 0);
      const won = quotes.filter((quote) => quote.status === "accepted").length;
      document.fillColor("#111827").fontSize(11).text(`Pipeline value: INR ${(total / 100).toLocaleString("en-IN")}    Accepted: ${won}    Conversion: ${quotes.length ? Math.round(won / quotes.length * 100) : 0}%`);
      document.moveDown();
      for (const quote of quotes)
        document
          .fontSize(10)
          .text(
            `${quote.quoteNumber}  ${quote.customer}  ${quote.status}  INR ${(quote.totalMinor / 100).toLocaleString("en-IN")}  Risk ${quote.riskScore}`,
          );
      document.end();
      await done;
      c.header("Content-Type", "application/pdf");
      c.header(
        "Content-Disposition",
        'attachment; filename="dealflow360-deals.pdf"',
      );
      return c.body(Buffer.concat(chunks));
    }
    return c.json({ error: "Use pdf or xls.", code: "FORMAT_INVALID" }, 400);
  };

  app.get("/api/reports/deals.pdf", auth.required, (c) => renderReport(c, "pdf"));
  app.get("/api/reports/deals.xls", auth.required, (c) => renderReport(c, "xls"));
}
