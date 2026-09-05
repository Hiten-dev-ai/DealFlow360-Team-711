import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { PostgresStore } from './store/postgres-store.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const origin = 'http://127.0.0.1:4199';
const workspaceId = '00000000-0000-4000-8000-000000000711';
let store;

function config() {
  return { nodeEnv: 'test', origin, workspaceId, databaseUrl, host: '127.0.0.1', port: 4199, sessionCookieName: 'dealflow_session', portalCookieName: 'dealflow_portal', sessionInactivityMs: 30 * 60 * 1000, sessionAbsoluteMs: 8 * 60 * 60 * 1000, invitationMs: 48 * 60 * 60 * 1000, portalLinkMs: 30 * 60 * 1000, releaseId: 'integration', smtpUrl: null, mailFrom: 'test@example.com', settingsEncryptionKey: 'integration-only-encryption-key', secureCookies: false };
}

async function request(app, path, { method = 'GET', body, auth } = {}) {
  const headers = { Origin: origin };
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) { headers.Cookie = auth.cookie; headers['X-CSRF-Token'] = auth.csrfToken; }
  return app.request(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

async function login(app, email, password) {
  const response = await request(app, '/api/auth/login', { method: 'POST', body: { email, password } });
  expect(response.status).toBe(200);
  const data = await response.json();
  return { cookie: response.headers.get('set-cookie').split(';')[0], csrfToken: data.csrfToken, user: data.user };
}

describe.runIf(Boolean(databaseUrl))('PostgreSQL end-to-end flow', () => {
  afterAll(async () => store?.close());
  it('runs quote through approvals, portal acceptance, allocation, billing and payment', async () => {
    store = new PostgresStore({ databaseUrl, workspaceId });
    const { app } = createApp({ config: config(), store });
    const sales = await login(app, 'sujith@dealflow360.demo', process.env.DEMO_SALES_PASSWORD);
    const admin = await login(app, 'hiten@dealflow360.demo', process.env.DEMO_ADMIN_PASSWORD);
    const bootstrap = await request(app, '/api/bootstrap', { auth: sales });
    expect(bootstrap.status).toBe(200);
    const initial = (await bootstrap.json()).data;
    expect(initial.quotes.length).toBeGreaterThan(20);
    expect(initial.customers.length).toBeGreaterThanOrEqual(24);
    expect(initial.catalog.length).toBeGreaterThanOrEqual(16);
    expect(initial.fulfillment).toEqual([]);
    expect(initial.subscriptions).toEqual([]);
    expect(initial.invoices).toEqual([]);
    expect(initial.teams).toEqual([]);
    const visibleQuoteIds = new Set(initial.quotes.map((quote) => quote.id));
    expect(initial.alerts.every((alert) => visibleQuoteIds.has(alert.quoteId))).toBe(true);

    const environmentDenied = await request(app, '/api/admin/environment', { auth: sales });
    expect(environmentDenied.status).toBe(403);
    const environmentSaved = await request(app, '/api/admin/environment', { method: 'PATCH', auth: admin, body: { smtpUrl: 'smtp://user:secret@localhost:2525', mailFrom: 'DealFlow360 <test@example.com>' } });
    expect(environmentSaved.status).toBe(200);
    const environmentData = (await environmentSaved.json()).data;
    expect(environmentData).toMatchObject({ smtpConfigured: true, smtpHost: 'localhost', source: 'workspace' });
    expect(JSON.stringify(environmentData)).not.toContain('secret');
    expect((await request(app, '/api/admin/environment', { method: 'PATCH', auth: admin, body: { clearSmtp: true } })).status).toBe(200);

    const createdTeamResponse = await request(app, '/api/admin/teams', { method: 'POST', auth: admin, body: { name: 'Integration Team' } });
    expect(createdTeamResponse.status).toBe(201);
    const createdTeam = (await createdTeamResponse.json()).data;
    const renamedTeamResponse = await request(app, `/api/admin/teams/${createdTeam.id}`, { method: 'PATCH', auth: admin, body: { name: 'Integration Team Renamed', expectedVersion: Number(createdTeam.version) } });
    expect(renamedTeamResponse.status).toBe(200);
    const renamedTeam = (await renamedTeamResponse.json()).data;
    expect(renamedTeam.name).toBe('Integration Team Renamed');
    expect((await request(app, `/api/admin/teams/${createdTeam.id}`, { method: 'DELETE', auth: admin, body: { expectedVersion: Number(renamedTeam.version) } })).status).toBe(200);

    const search = await request(app, '/api/search?q=Beta', { auth: sales });
    expect(search.status).toBe(200);
    expect((await search.json()).data.length).toBeGreaterThan(0);
    const deniedAllocation = await request(app, '/api/fulfillment/quotes/00000000-0000-4000-8000-000000000001/allocate', { method: 'POST', auth: sales });
    expect(deniedAllocation.status).toBe(403);
    const preferences = await request(app, '/api/preferences', { method: 'PATCH', auth: sales, body: { dnd: true } });
    expect(preferences.status).toBe(200);
    expect((await preferences.json()).data.dnd).toBe(true);
    const notifications = await request(app, '/api/notifications/read-all', { method: 'POST', auth: sales });
    expect(notifications.status).toBe(200);

    const pdf = await request(app, '/api/reports/deals.pdf', { auth: sales });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toContain('application/pdf');
    expect((await pdf.arrayBuffer()).byteLength).toBeGreaterThan(500);
    const xls = await request(app, '/api/reports/deals.xls', { auth: sales });
    expect(xls.status).toBe(200);
    expect(xls.headers.get('content-type')).toContain('application/vnd.ms-excel');
    expect(await xls.text()).toContain('<Workbook');

    const customer = initial.customers[0];
    const oneTime = initial.catalog.find((product) => product.billingType === 'one_time');
    const recurring = initial.catalog.find((product) => product.billingType === 'recurring');

    const createdResponse = await request(app, '/api/quotes', { method: 'POST', auth: sales, body: { customerId: customer.id, lines: [{ productId: oneTime.id, quantity: 10, discountBps: 2000 }, { productId: recurring.id, quantity: 1, discountBps: 0 }] } });
    const createdPayload = await createdResponse.json();
    expect(createdResponse.status, JSON.stringify(createdPayload)).toBe(201);
    const quote = createdPayload.data;
    expect(quote.approvalRoute).toEqual(['manager', 'finance']);
    expect((await request(app, `/api/quotes/${quote.id}/portal-link`, { method: 'POST', auth: sales })).status).toBe(404);
    expect((await request(app, `/api/quotes/${quote.id}/submit`, { method: 'POST', auth: sales })).status).toBe(200);

    const manager = await login(app, 'manager@dealflow360.demo', process.env.DEMO_MANAGER_PASSWORD);
    const managerData = (await (await request(app, '/api/bootstrap', { auth: manager })).json()).data;
    const managerApproval = managerData.approvals.find((approval) => approval.quoteId === quote.id);
    expect(managerApproval).toBeTruthy();
    expect((await request(app, `/api/approvals/${managerApproval.id}/decision`, { method: 'POST', auth: manager, body: { decision: 'approve' } })).status).toBe(200);

    const finance = await login(app, 'finance@dealflow360.demo', process.env.DEMO_FINANCE_PASSWORD);
    const financeData = (await (await request(app, '/api/bootstrap', { auth: finance })).json()).data;
    const financeApproval = financeData.approvals.find((approval) => approval.quoteId === quote.id);
    expect(financeApproval).toBeTruthy();
    expect((await request(app, `/api/approvals/${financeApproval.id}/decision`, { method: 'POST', auth: finance, body: { decision: 'approve' } })).status).toBe(200);

    const expiredLinkResponse = await request(app, `/api/quotes/${quote.id}/portal-link`, { method: 'POST', auth: sales });
    expect(expiredLinkResponse.status).toBe(200);
    const expiredLinkData = (await expiredLinkResponse.json()).data;
    await store.query(`UPDATE portal_links SET expires_at=now()-interval '1 minute' WHERE id=$1`, [expiredLinkData.id]);
    const expiredToken = new URL(expiredLinkData.link).searchParams.get('token');
    expect((await request(app, '/api/portal/redeem', { method: 'POST', body: { token: expiredToken } })).status).toBe(401);

    const linkResponse = await request(app, `/api/quotes/${quote.id}/portal-link`, { method: 'POST', auth: sales });
    expect(linkResponse.status).toBe(200);
    const token = new URL((await linkResponse.json()).data.link).searchParams.get('token');
    const redeem = await request(app, '/api/portal/redeem', { method: 'POST', body: { token } });
    expect(redeem.status).toBe(200);
    const portalData = await redeem.json();
    const portal = { cookie: redeem.headers.get('set-cookie').split(';')[0], csrfToken: portalData.csrfToken };
    expect((await request(app, '/api/portal/redeem', { method: 'POST', body: { token } })).status).toBe(401);
    const scopedPortalQuote = await request(app, '/api/portal/quote', { auth: portal });
    expect(scopedPortalQuote.status).toBe(200);
    expect((await scopedPortalQuote.json()).data.id).toBe(quote.id);
    expect((await request(app, '/api/portal/quote/respond', { method: 'POST', auth: portal, body: { action: 'accept' } })).status).toBe(200);

    const allocation = await request(app, `/api/fulfillment/quotes/${quote.id}/allocate`, { method: 'POST', auth: finance });
    expect(allocation.status).toBe(200);
    const completed = (await (await request(app, '/api/bootstrap', { auth: finance })).json()).data;
    expect(completed.fulfillment.length).toBeGreaterThan(0);
    expect(completed.subscriptions.length).toBeGreaterThan(0);
    expect(completed.invoices.length).toBeGreaterThan(0);
    const subscription = completed.subscriptions.find((record) => record.quoteId === quote.id && record.status === 'active');
    expect(subscription).toBeTruthy();
    const paused = await request(app, `/api/subscriptions/${subscription.id}`, { method: 'PATCH', auth: finance, body: { status: 'paused', expectedVersion: Number(subscription.version) } });
    expect(paused.status).toBe(200);
    const invoice = completed.invoices.find((record) => record.quoteId === quote.id) ?? completed.invoices[0];
    const balance = Number(invoice.totalMinor) - Number(invoice.paidMinor);
    const payment = await request(app, `/api/invoices/${invoice.id}/payments`, { method: 'POST', auth: finance, body: { amountMinor: balance, reference: 'E2E-TEST' } });
    payment.headers;
    expect(payment.status).toBe(400);
    const partial = await app.request(`/api/invoices/${invoice.id}/payments`, { method: 'POST', headers: { Origin: origin, Cookie: finance.cookie, 'X-CSRF-Token': finance.csrfToken, 'Content-Type': 'application/json', 'Idempotency-Key': 'e2e-decimal-payment' }, body: JSON.stringify({ amountMinor: 12345, reference: 'E2E-PARTIAL' }) });
    expect(partial.status).toBe(200);
    const repeated = await app.request(`/api/invoices/${invoice.id}/payments`, { method: 'POST', headers: { Origin: origin, Cookie: finance.cookie, 'X-CSRF-Token': finance.csrfToken, 'Content-Type': 'application/json', 'Idempotency-Key': 'e2e-decimal-payment' }, body: JSON.stringify({ amountMinor: 12345, reference: 'E2E-PARTIAL' }) });
    expect(repeated.status).toBe(200);
    expect((await repeated.json()).data.idempotent).toBe(true);
    const paid = await app.request(`/api/invoices/${invoice.id}/payments`, { method: 'POST', headers: { Origin: origin, Cookie: finance.cookie, 'X-CSRF-Token': finance.csrfToken, 'Content-Type': 'application/json', 'Idempotency-Key': 'e2e-payment' }, body: JSON.stringify({ amountMinor: balance - 12345, reference: 'E2E-TEST' }) });
    expect(paid.status).toBe(200);

    const adminWorkspace = (await (await request(app, '/api/bootstrap', { auth: admin })).json()).data;
    const primaryTeam = adminWorkspace.teams.find((team) => team.members.some((member) => member.id === sales.user.id));
    expect(primaryTeam).toBeTruthy();
    expect((await request(app, `/api/admin/teams/${primaryTeam.id}/members/${sales.user.id}`, { method: 'PATCH', auth: admin, body: { role: 'sales_manager' } })).status).toBe(200);
    expect((await request(app, `/api/admin/teams/${primaryTeam.id}/members/${sales.user.id}`, { method: 'PATCH', auth: admin, body: { role: 'sales_rep' } })).status).toBe(200);
    expect((await request(app, `/api/admin/teams/${primaryTeam.id}/members/${admin.user.id}`, { method: 'DELETE', auth: admin })).status).toBe(409);
  }, 30_000);
});
