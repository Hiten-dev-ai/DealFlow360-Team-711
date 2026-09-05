import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { hashPassword } from './auth/password.js';
import { hasCapability } from './auth/roles.js';
import { MemoryStore } from './store/memory-store.js';

async function createTestApp() {
  const config = {
    nodeEnv: 'test',
    origin: 'http://127.0.0.1:4173',
    workspaceId: '00000000-0000-4000-8000-000000000711',
    sessionCookieName: 'dealflow_session',
    sessionInactivityMs: 30 * 60 * 1000,
    sessionAbsoluteMs: 8 * 60 * 60 * 1000,
    secureCookies: false,
  };
  const store = new MemoryStore({ workspaceId: config.workspaceId });
  await store.createUser({
    id: randomUUID(),
    email: 'owner@dealflow.test',
    fullName: 'Hiten',
    passwordHash: await hashPassword('correct horse battery staple'),
    roles: ['owner'],
  });
  return { ...createApp({ config, store }), store };
}

describe('backend foundation', () => {
  it('reports a healthy development storage adapter', async () => {
    const { app } = await createTestApp();
    const response = await app.request('/api/health');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ service: 'dealflow360', status: 'ok', database: { status: 'memory' } });
  });

  it('logs in with an opaque session cookie and returns the session', async () => {
    const { app } = await createTestApp();
    const login = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:4173' },
      body: JSON.stringify({ email: 'owner@dealflow.test', password: 'correct horse battery staple' }),
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get('set-cookie');
    expect(cookie).toMatch(/dealflow_session=[^;]+/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);

    const session = await app.request('/api/auth/session', { headers: { Cookie: cookie } });
    expect(session.status).toBe(200);
    await expect(session.json()).resolves.toMatchObject({ authenticated: true, user: { activeRole: 'owner', email: 'owner@dealflow.test' } });
  });

  it('rejects invalid credentials and invalid input', async () => {
    const { app } = await createTestApp();
    const invalid = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@dealflow.test', password: 'wrong password here' }),
    });
    expect(invalid.status).toBe(401);

    const malformed = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'short' }),
    });
    expect(malformed.status).toBe(400);
  });

  it('keeps role capabilities explicit', () => {
    expect(hasCapability('owner', 'roles.manage')).toBe(true);
    expect(hasCapability('admin', 'roles.manage')).toBe(false);
    expect(hasCapability('operator', 'inventory.write')).toBe(true);
    expect(hasCapability('operator', 'inventory.delete')).toBe(false);
  });
});
