import { calculateQuote } from '../domain/rules.js';

const DAY_MS = 86_400_000;
const uuid = (block, index) => `${block}-0000-4000-8000-${String(index).padStart(12, '0')}`;
const daysFromNow = (days) => new Date(Date.now() + days * DAY_MS);
const dateOnly = (days) => daysFromNow(days).toISOString().slice(0, 10);

const extraProducts = [
  ['71130000-0000-4000-8000-000000000005', 0, 'DF-ANALYTICS', 'Revenue Intelligence', 'recurring', 'monthly', 2800000, 650000],
  ['71130000-0000-4000-8000-000000000006', 0, 'DF-CPQ', 'Guided CPQ', 'recurring', 'monthly', 3600000, 850000],
  ['71130000-0000-4000-8000-000000000007', 0, 'DF-PORTAL', 'Customer Deal Room', 'recurring', 'monthly', 2200000, 500000],
  ['71130000-0000-4000-8000-000000000008', 0, 'DF-AUDIT', 'Compliance Audit Vault', 'recurring', 'yearly', 21600000, 4900000],
  ['71130000-0000-4000-8000-000000000009', 1, 'MIGRATE', 'Data Migration Pack', 'one_time', null, 18000000, 8000000],
  ['71130000-0000-4000-8000-000000000010', 1, 'TRAIN', 'Sales Enablement Workshop', 'one_time', null, 6500000, 2200000],
  ['71130000-0000-4000-8000-000000000011', 1, 'IMPLEMENT', 'Implementation Sprint', 'one_time', null, 32000000, 15000000],
  ['71130000-0000-4000-8000-000000000012', 1, 'SUCCESS', 'Dedicated Success Manager', 'recurring', 'monthly', 7500000, 3000000],
  ['71130000-0000-4000-8000-000000000013', 2, 'EDGE-200', 'Edge Gateway Pro', 'one_time', null, 22000000, 14000000],
  ['71130000-0000-4000-8000-000000000014', 2, 'SCAN-MOB', 'Mobile Scan Kit', 'one_time', null, 8500000, 5300000],
  ['71130000-0000-4000-8000-000000000015', 2, 'PRINT-Z', 'Thermal Dispatch Printer', 'one_time', null, 5200000, 3400000],
  ['71130000-0000-4000-8000-000000000016', 2, 'SENSOR-IOT', 'Warehouse Sensor Pack', 'one_time', null, 12500000, 7900000],
];

const extraCustomers = [
  ['Orion Mobility', 'buying@orion.example', 2, 0],
  ['BluePeak Logistics', 'sourcing@bluepeak.example', 0, 4200000],
  ['Meridian Foods', 'procurement@meridian.example', 0, 0],
  ['Vertex Manufacturing', 'commercial@vertex.example', 1, 0],
  ['Cedar Health Systems', 'operations@cedarhealth.example', 0, 1800000],
  ['Kitewave Telecom', 'enterprise@kitewave.example', 0, 0],
  ['Nimbus Energy', 'supply@nimbusenergy.example', 2, 0],
  ['Atlas Consumer Goods', 'purchasing@atlasgoods.example', 0, 6400000],
  ['Silverline Pharma', 'digital@silverline.example', 1, 0],
  ['RapidRoute Couriers', 'technology@rapidroute.example', 0, 900000],
  ['Evergreen Textiles', 'systems@evergreen.example', 0, 0],
  ['NovaHome Retail', 'growth@novahome.example', 2, 0],
  ['Pioneer Auto Parts', 'procurement@pioneerauto.example', 0, 3200000],
  ['Suncrest Hospitality', 'it@suncrest.example', 0, 0],
  ['UrbanBasket Commerce', 'platform@urbanbasket.example', 1, 0],
  ['Ironwood Engineering', 'salesops@ironwood.example', 0, 0],
  ['CoralPay Services', 'partnerships@coralpay.example', 2, 0],
  ['Greenfield Agritech', 'business@greenfield.example', 0, 1100000],
  ['Summit Office Supply', 'orders@summitoffice.example', 0, 0],
  ['Lighthouse Education', 'admin@lighthouseedu.example', 1, 0],
];

const settings = {
  managerScore: 40,
  financeScore: 70,
  financeValueMinor: 100_000_000,
  marginFloorBps: 2000,
  discountWeight: 45,
  marginWeight: 30,
  valueWeight: 15,
  overdueWeight: 10,
};

export const smokeDataSummary = Object.freeze({
  customers: 24,
  products: 16,
  quotations: 42,
  notificationsPerUser: 32,
});

export async function seedSmokeData(client, { workspaceId, users, team, tiers, categories, products, customers, warehouses }) {
  const allProducts = [...products];
  for (const [id, categoryIndex, sku, name, billingType, cadence, priceMinor, costMinor] of extraProducts) {
    const row = [id, categories[categoryIndex][0], sku, name, billingType, cadence, priceMinor, costMinor];
    allProducts.push(row);
    await client.query(
      `INSERT INTO products(id,workspace_id,category_id,sku,name,billing_type,cadence,price_minor,cost_minor)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT(id) DO UPDATE SET category_id=EXCLUDED.category_id,sku=EXCLUDED.sku,name=EXCLUDED.name,
       billing_type=EXCLUDED.billing_type,cadence=EXCLUDED.cadence,price_minor=EXCLUDED.price_minor,cost_minor=EXCLUDED.cost_minor,active=true`,
      [id, workspaceId, ...row.slice(1)],
    );
  }

  const allCustomers = [...customers];
  for (let index = 0; index < extraCustomers.length; index += 1) {
    const [name, email, tierIndex, overdueMinor] = extraCustomers[index];
    const id = uuid('71140000', index + 5);
    const row = [id, tiers[tierIndex][0], name, email, name, overdueMinor];
    allCustomers.push(row);
    await client.query(
      `INSERT INTO customers(id,workspace_id,tier_id,name,email,company,overdue_minor)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT(id) DO UPDATE SET tier_id=EXCLUDED.tier_id,name=EXCLUDED.name,email=EXCLUDED.email,
       company=EXCLUDED.company,overdue_minor=EXCLUDED.overdue_minor,version=customers.version+1,updated_at=now()`,
      [id, workspaceId, ...row.slice(1)],
    );
  }

  const statuses = ['draft', 'pending_manager', 'pending_finance', 'approved', 'negotiation', 'accepted', 'accepted', 'rejected', 'expired', 'approved'];
  const discounts = [0, 300, 700, 1200, 1800, 2500];
  const quoteRecords = [];
  let lineIndex = 1;
  let approvalIndex = 1;
  let revisionIndex = 1;
  let negotiationIndex = 1;

  for (let index = 0; index < smokeDataSummary.quotations; index += 1) {
    const quoteId = uuid('71160000', index + 1);
    const customer = allCustomers[index % allCustomers.length];
    const firstProduct = allProducts[(index * 3) % allProducts.length];
    let secondProduct = allProducts[(index * 3 + 5) % allProducts.length];
    if (secondProduct[0] === firstProduct[0]) secondProduct = allProducts[(index + 1) % allProducts.length];
    const discountBps = discounts[index % discounts.length];
    const rawLines = [
      { product: firstProduct, quantity: 1 + (index % 4), discountBps },
      { product: secondProduct, quantity: 1 + (index % 3), discountBps: Math.max(0, discountBps - 300) },
    ];
    const customerTierIndex = Math.max(0, tiers.findIndex((tier) => customer[1] === tier[0]));
    const calculationLines = rawLines.map(({ product, quantity, discountBps: lineDiscount }) => {
      const categoryIndex = categories.findIndex((category) => category[0] === product[1]);
      const ceilingBps = [[700, 500, 300], [1100, 900, 700], [1500, 1200, 1000]][customerTierIndex][categoryIndex];
      return { quantity, discountBps: lineDiscount, unitPriceMinor: product[6], unitCostMinor: product[7], ceilingBps };
    });
    const overdueRisk = tiers[customerTierIndex][2];
    const calculation = calculateQuote(calculationLines, { overdueRisk }, settings);
    const status = statuses[index % statuses.length];
    const revision = ['negotiation', 'accepted'].includes(status) ? 2 : 1;
    const route = status === 'pending_finance'
      ? ['manager', 'finance']
      : status === 'pending_manager'
        ? ['manager']
        : calculation.approvalRoute;
    const riskScore = status === 'pending_finance'
      ? Math.max(72, calculation.riskScore)
      : status === 'pending_manager'
        ? Math.max(46, calculation.riskScore)
        : calculation.riskScore;
    const ownerUserId = index % 6 === 0 ? users.admin : users.sales_rep;
    const updatedDaysAgo = index % 9 === 0 ? 8 : index % 6;
    const createdAt = daysFromNow(-(48 - index));
    const updatedAt = daysFromNow(-updatedDaysAgo);
    const submittedAt = status === 'draft' ? null : daysFromNow(-(updatedDaysAgo + 2));
    const acceptedAt = status === 'accepted' ? daysFromNow(-updatedDaysAgo) : null;
    await client.query(
      `INSERT INTO quotes(id,workspace_id,quote_number,customer_id,owner_user_id,team_id,status,revision,
       subtotal_minor,discount_minor,total_minor,cost_minor,margin_bps,risk_score,approval_route,valid_until,
       version,submitted_at,accepted_at,created_at,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,1,$17,$18,$19,$20)
       ON CONFLICT(id) DO UPDATE SET customer_id=EXCLUDED.customer_id,owner_user_id=EXCLUDED.owner_user_id,
       team_id=EXCLUDED.team_id,status=EXCLUDED.status,revision=EXCLUDED.revision,subtotal_minor=EXCLUDED.subtotal_minor,
       discount_minor=EXCLUDED.discount_minor,total_minor=EXCLUDED.total_minor,cost_minor=EXCLUDED.cost_minor,
       margin_bps=EXCLUDED.margin_bps,risk_score=EXCLUDED.risk_score,approval_route=EXCLUDED.approval_route,
       valid_until=EXCLUDED.valid_until,submitted_at=EXCLUDED.submitted_at,accepted_at=EXCLUDED.accepted_at,
       created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at`,
      [quoteId, workspaceId, 711001 + index, customer[0], ownerUserId, team.id, status, revision,
        calculation.subtotalMinor, calculation.discountMinor, calculation.totalMinor, calculation.costMinor,
        calculation.marginBps, riskScore, route, status === 'expired' ? dateOnly(-3) : dateOnly(14 + (index % 21)),
        submittedAt, acceptedAt, createdAt, updatedAt],
    );
    await client.query('DELETE FROM quote_lines WHERE quote_id=$1', [quoteId]);
    const storedLines = [];
    for (const { product, quantity, discountBps: lineDiscount } of rawLines) {
      const id = uuid('71161000', lineIndex++);
      storedLines.push({ productId: product[0], quantity, discountBps: lineDiscount, unitPriceMinor: product[6] });
      await client.query(
        `INSERT INTO quote_lines(id,quote_id,product_id,quantity,unit_price_minor,unit_cost_minor,discount_bps,billing_type,cadence)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, quoteId, product[0], quantity, product[6], product[7], lineDiscount, product[4], product[5]],
      );
    }

    await client.query('DELETE FROM approval_requests WHERE quote_id=$1', [quoteId]);
    const approvalRows = [];
    if (status === 'pending_manager') approvalRows.push(['manager', 'pending', null]);
    if (status === 'pending_finance') approvalRows.push(['manager', 'approved', users.sales_manager], ['finance', 'pending', null]);
    if (['approved', 'accepted', 'negotiation'].includes(status)) {
      for (const stage of route) approvalRows.push([stage, 'approved', stage === 'manager' ? users.sales_manager : users.finance_ops]);
    }
    if (status === 'rejected') approvalRows.push(['manager', 'rejected', users.sales_manager]);
    for (const [stage, approvalStatus, decidedBy] of approvalRows) {
      await client.query(
        `INSERT INTO approval_requests(id,quote_id,quote_revision,stage,status,assigned_team_id,decided_by,reason,decided_at,created_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [uuid('71162000', approvalIndex++), quoteId, revision, stage, approvalStatus, team.id, decidedBy,
          approvalStatus === 'rejected' ? 'Commercial terms require revision.' : approvalStatus === 'approved' ? 'Approved within governed limits.' : null,
          decidedBy ? daysFromNow(-(updatedDaysAgo + 1)) : null, daysFromNow(-(updatedDaysAgo + 3))],
      );
    }

    await client.query('DELETE FROM quote_revisions WHERE quote_id=$1', [quoteId]);
    await client.query(
      `INSERT INTO quote_revisions(id,quote_id,revision,snapshot,reason,created_by,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [uuid('71172000', revisionIndex++), quoteId, revision, JSON.stringify({ status, totals: calculation, lines: storedLines }),
        revision > 1 ? 'Customer negotiation revision' : 'Initial commercial draft', ownerUserId, createdAt],
    );
    await client.query('DELETE FROM negotiations WHERE quote_id=$1', [quoteId]);
    if (['negotiation', 'accepted', 'rejected'].includes(status)) {
      const action = status === 'accepted' ? 'accept' : status === 'rejected' ? 'reject' : 'counteroffer';
      await client.query(
        `INSERT INTO negotiations(id,quote_id,quote_revision,actor_type,action,message,requested_lines,created_at)
         VALUES($1,$2,$3,'customer',$4,$5,$6,$7)`,
        [uuid('71171000', negotiationIndex++), quoteId, revision, action,
          action === 'counteroffer' ? 'Please review the revised volume and commercial terms.' : action === 'accept' ? 'Commercial offer accepted.' : 'Offer declined for this cycle.',
          action === 'counteroffer' ? JSON.stringify(storedLines) : null, updatedAt],
      );
    }
    quoteRecords.push({ id: quoteId, customerId: customer[0], status, lines: storedLines, totalMinor: calculation.totalMinor, updatedDaysAgo });
  }

  const accepted = quoteRecords.filter((quote) => quote.status === 'accepted');
  let shipmentIndex = 1;
  for (let index = 0; index < Math.max(0, accepted.length - 2); index += 1) {
    const quote = accepted[index];
    const orderStatus = ['reserved', 'picking', 'partially_shipped', 'shipped', 'completed', 'backorder'][index % 6];
    const order = (await client.query(
      `INSERT INTO orders(id,workspace_id,quote_id,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(quote_id) DO UPDATE SET status=EXCLUDED.status,updated_at=EXCLUDED.updated_at RETURNING id`,
      [uuid('71163000', index + 1), workspaceId, quote.id, orderStatus, daysFromNow(-(12 + index)), daysFromNow(-(index % 5))],
    )).rows[0];
    await client.query('DELETE FROM shipments WHERE order_id=$1', [order.id]);
    const split = index % 3 === 0 ? 2 : 1;
    for (let part = 0; part < split; part += 1) {
      const warehouse = warehouses[(index + part) % warehouses.length];
      const isBackorder = orderStatus === 'backorder' && part === split - 1;
      const shipmentStatus = isBackorder ? 'backorder' : orderStatus === 'completed' ? 'delivered' : orderStatus === 'shipped' ? 'shipped' : orderStatus === 'partially_shipped' && part === 0 ? 'shipped' : orderStatus === 'picking' ? 'picking' : 'planned';
      const lines = quote.lines.map((line) => ({ productId: line.productId, quantity: Math.max(1, Math.ceil(line.quantity / split)) }));
      await client.query(
        `INSERT INTO shipments(id,order_id,warehouse_id,status,shipping_cost_minor,lines,created_at,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [uuid('71164000', shipmentIndex++), order.id, isBackorder ? null : warehouse[0], shipmentStatus,
          isBackorder ? 0 : warehouse[3], JSON.stringify(lines), daysFromNow(-(10 + index)), daysFromNow(-(index % 4))],
      );
    }
  }

  const recurringProducts = allProducts.filter((product) => product[4] === 'recurring');
  const subscriptions = [];
  for (let index = 0; index < 14; index += 1) {
    const quote = accepted[index % accepted.length];
    const product = recurringProducts[index % recurringProducts.length];
    const status = index % 7 === 5 ? 'paused' : index % 11 === 7 ? 'cancelled' : 'active';
    const id = uuid('71165000', index + 1);
    subscriptions.push({ id, quote, product, status });
    await client.query(
      `INSERT INTO subscriptions(id,workspace_id,customer_id,quote_id,product_id,cadence,quantity,unit_price_minor,status,starts_on,next_bill_on,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT(id) DO UPDATE SET customer_id=EXCLUDED.customer_id,quote_id=EXCLUDED.quote_id,product_id=EXCLUDED.product_id,
       cadence=EXCLUDED.cadence,quantity=EXCLUDED.quantity,unit_price_minor=EXCLUDED.unit_price_minor,status=EXCLUDED.status,
       starts_on=EXCLUDED.starts_on,next_bill_on=EXCLUDED.next_bill_on`,
      [id, workspaceId, quote.customerId, quote.id, product[0], product[5], 1 + (index % 5), product[6], status,
        dateOnly(-(75 - index * 2)), dateOnly(3 + index * 3), daysFromNow(-(60 - index))],
    );
  }

  for (let index = 0; index < 24; index += 1) {
    const quote = accepted[index % accepted.length];
    const subscription = index < subscriptions.length ? subscriptions[index] : null;
    const totalMinor = subscription ? subscription.product[6] * (1 + (index % 4)) : Math.max(1500000, Math.round(quote.totalMinor * 0.58));
    const invoiceStatus = ['due', 'partially_paid', 'paid', 'overdue', 'due', 'paid'][index % 6];
    const paidMinor = invoiceStatus === 'paid' ? totalMinor : invoiceStatus === 'partially_paid' ? Math.round(totalMinor * 0.45) : 0;
    const invoiceId = uuid('71166000', index + 1);
    const dueOn = invoiceStatus === 'overdue' ? dateOnly(-(8 + index)) : dateOnly(7 + (index % 24));
    await client.query(
      `INSERT INTO invoices(id,workspace_id,customer_id,quote_id,subscription_id,period_start,period_end,invoice_number,status,total_minor,paid_minor,due_on,created_at,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT(id) DO UPDATE SET customer_id=EXCLUDED.customer_id,quote_id=EXCLUDED.quote_id,subscription_id=EXCLUDED.subscription_id,
       period_start=EXCLUDED.period_start,period_end=EXCLUDED.period_end,status=EXCLUDED.status,total_minor=EXCLUDED.total_minor,
       paid_minor=EXCLUDED.paid_minor,due_on=EXCLUDED.due_on,updated_at=EXCLUDED.updated_at`,
      [invoiceId, workspaceId, quote.customerId, quote.id, subscription?.id ?? null,
        subscription ? dateOnly(-(30 + index)) : null, subscription ? dateOnly(-index) : null, 711001 + index,
        invoiceStatus, totalMinor, paidMinor, dueOn, daysFromNow(-(32 - index)), daysFromNow(-(index % 7))],
    );
    await client.query('DELETE FROM invoice_lines WHERE invoice_id=$1', [invoiceId]);
    await client.query(
      `INSERT INTO invoice_lines(id,invoice_id,description,quantity,unit_price_minor,amount_minor) VALUES($1,$2,$3,$4,$5,$6)`,
      [uuid('71167000', index + 1), invoiceId, subscription ? `${subscription.product[3]} subscription` : 'Accepted commercial services', 1, totalMinor, totalMinor],
    );
    if (paidMinor > 0) {
      await client.query(
        `INSERT INTO payments(id,invoice_id,amount_minor,reference,received_at,recorded_by,idempotency_key)
         VALUES($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT(id) DO UPDATE SET amount_minor=EXCLUDED.amount_minor,reference=EXCLUDED.reference,received_at=EXCLUDED.received_at`,
        [uuid('71168000', index + 1), invoiceId, paidMinor, `DEMO-NEFT-${String(index + 1).padStart(4, '0')}`,
          daysFromNow(-(index % 11)), users.finance_ops, `demo-payment-${index + 1}`],
      );
    }
  }

  const alertTemplates = [
    ['discount', 'high', 'Discount exception', 'Discount exceeds the customer tier ceiling.'],
    ['margin', 'high', 'Margin compression', 'Projected margin is below the governed floor.'],
    ['stalled', 'medium', 'Stalled quotation', 'No customer activity has been recorded recently.'],
    ['backorder', 'high', 'Backorder exposure', 'Confirmed demand exceeds currently allocatable stock.'],
    ['invoice', 'medium', 'Invoice follow-up', 'Payment is due or partially outstanding.'],
    ['renewal', 'low', 'Renewal approaching', 'A recurring agreement is approaching its next billing date.'],
  ];
  for (let index = 0; index < 30; index += 1) {
    const quote = quoteRecords[index % quoteRecords.length];
    const [category, severity, title, message] = alertTemplates[index % alertTemplates.length];
    await client.query(
      `INSERT INTO deal_alerts(id,workspace_id,quote_id,category,severity,title,message,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT(id) DO UPDATE SET quote_id=EXCLUDED.quote_id,category=EXCLUDED.category,severity=EXCLUDED.severity,
       title=EXCLUDED.title,message=EXCLUDED.message,resolved_at=null,created_at=EXCLUDED.created_at`,
      [uuid('71169000', index + 1), workspaceId, quote.id, category, severity, title, message, daysFromNow(-(index % 18))],
    );
  }

  const notificationTemplates = [
    ['approval', 'Approval waiting', 'A governed quotation needs a decision.', true],
    ['customer', 'Customer activity', 'A customer viewed or updated a commercial offer.', false],
    ['fulfillment', 'Fulfillment update', 'Warehouse allocation or shipment status changed.', false],
    ['billing', 'Payment update', 'An invoice balance or payment state changed.', true],
    ['risk', 'Deal health signal', 'A commercial risk signal needs attention.', true],
    ['subscription', 'Subscription milestone', 'A recurring billing milestone is approaching.', false],
  ];
  const userIds = Object.values(users);
  let notificationIndex = 1;
  for (const userId of userIds) {
    for (let index = 0; index < smokeDataSummary.notificationsPerUser; index += 1) {
      const quote = quoteRecords[index % quoteRecords.length];
      const [category, title, message, priority] = notificationTemplates[index % notificationTemplates.length];
      await client.query(
        `INSERT INTO notifications(id,workspace_id,user_id,category,title,message,target_type,target_id,priority,read_at,dismissed_at,created_at)
         VALUES($1,$2,$3,$4,$5,$6,'quote',$7,$8,$9,null,$10)
         ON CONFLICT(id) DO UPDATE SET user_id=EXCLUDED.user_id,category=EXCLUDED.category,title=EXCLUDED.title,
         message=EXCLUDED.message,target_id=EXCLUDED.target_id,priority=EXCLUDED.priority,read_at=EXCLUDED.read_at,
         dismissed_at=null,created_at=EXCLUDED.created_at`,
        [uuid('71170000', notificationIndex++), workspaceId, userId, category, title, message, quote.id, priority,
          index % 4 === 0 ? daysFromNow(-(index % 9)) : null, daysFromNow(-(index % 16))],
      );
    }
  }

  const auditActions = ['quote.created', 'quote.submitted', 'approval.approved', 'portal.link_created', 'quote.accepted', 'fulfillment.allocated', 'invoice.created', 'payment.recorded'];
  for (let index = 0; index < 24; index += 1) {
    const quote = quoteRecords[index % quoteRecords.length];
    await client.query(
      `INSERT INTO audit_events(id,user_id,workspace_id,action,metadata,created_at) VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(id) DO UPDATE SET user_id=EXCLUDED.user_id,action=EXCLUDED.action,metadata=EXCLUDED.metadata,created_at=EXCLUDED.created_at`,
      [uuid('71173000', index + 1), index % 3 === 0 ? users.sales_rep : index % 3 === 1 ? users.sales_manager : users.finance_ops,
        workspaceId, auditActions[index % auditActions.length], JSON.stringify({ quoteId: quote.id, demo: true }), daysFromNow(-(24 - index))],
    );
  }
}
