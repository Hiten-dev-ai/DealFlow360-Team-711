import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { PostgresStore } from './store/postgres-store.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const origin = 'http://127.0.0.1:4199';
const workspaceId = '00000000-0000-4000-8000-000000000711';
let store;

function config() {
  return { nodeEnv: 'test', origin, workspaceId, databaseUrl, host: '127.0.0.1', port: 4199, sessionCookieName: 'dealflow_session', portalCookieName: 'dealflow_portal', sessionInactivityMs: 30 * 60 * 1000, sessionAbsoluteMs: 8 * 60 * 60 * 1000, invitationMs: 48 * 60 * 60 * 1000, portalLinkMs: 30 * 60 * 1000, releaseId: 'integration', smtpUrl: null, mailFrom: 'test@example.com', secureCookies: false };
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
    const bootstrap = await request(app, '/api/bootstrap', { auth: sales });
    expect(bootstrap.status).toBe(200);
    const initial = (await bootstrap.json()).data;
    const customer = initial.customers[0];
    const oneTime = initial.catalog.find((product) => product.billingType === 'one_time');
    const recurring = initial.catalog.find((product) => product.billingType === 'recurring');

    const createdResponse = await request(app, '/api/quotes', { method: 'POST', auth: sales, body: { customerId: customer.id, lines: [{ productId: oneTime.id, quantity: 10, discountBps: 2000 }, { productId: recurring.id, quantity: 1, discountBps: 0 }] } });
    const createdPayload = await createdResponse.json();
    expect(createdResponse.status, JSON.stringify(createdPayload)).toBe(201);
    const quote = createdPayload.data;
    expect(quote.approvalRoute).toEqual(['manager', 'finance']);
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

    const linkResponse = await request(app, `/api/quotes/${quote.id}/portal-link`, { method: 'POST', auth: sales });
    expect(linkResponse.status).toBe(200);
    const token = new URL((await linkResponse.json()).data.link).searchParams.get('token');
    const redeem = await request(app, '/api/portal/redeem', { method: 'POST', body: { token } });
    expect(redeem.status).toBe(200);
    const portalData = await redeem.json();
    const portal = { cookie: redeem.headers.get('set-cookie').split(';')[0], csrfToken: portalData.csrfToken };
    expect((await request(app, '/api/portal/quote/respond', { method: 'POST', auth: portal, body: { action: 'accept' } })).status).toBe(200);

    const allocation = await request(app, `/api/fulfillment/quotes/${quote.id}/allocate`, { method: 'POST', auth: finance });
    expect(allocation.status).toBe(200);
    const completed = (await (await request(app, '/api/bootstrap', { auth: finance })).json()).data;
    expect(completed.fulfillment.length).toBeGreaterThan(0);
    expect(completed.subscriptions.length).toBeGreaterThan(0);
    expect(completed.invoices.length).toBeGreaterThan(0);
    const invoice = completed.invoices.find((record) => record.quoteId === quote.id) ?? completed.invoices[0];
    const payment = await request(app, `/api/invoices/${invoice.id}/payments`, { method: 'POST', auth: finance, body: { amountMinor: Number(invoice.totalMinor) - Number(invoice.paidMinor), reference: 'E2E-TEST' } });
    payment.headers;
    expect(payment.status).toBe(400);
    const paid = await app.request(`/api/invoices/${invoice.id}/payments`, { method: 'POST', headers: { Origin: origin, Cookie: finance.cookie, 'X-CSRF-Token': finance.csrfToken, 'Content-Type': 'application/json', 'Idempotency-Key': 'e2e-payment' }, body: JSON.stringify({ amountMinor: Number(invoice.totalMinor) - Number(invoice.paidMinor), reference: 'E2E-TEST' }) });
    expect(paid.status).toBe(200);
  }, 30_000);
});
