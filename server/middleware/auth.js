import { capabilitiesForRole } from '../auth/roles.js';
import { hashSessionToken, isSessionActive } from '../auth/session.js';
import { readCookie } from '../http/cookies.js';

export function createAuth({ store, config }) {
  async function resolve(c) {
    const token = readCookie(c.req, config.sessionCookieName);
    const session = token ? await store.getSessionByTokenHash(hashSessionToken(token)) : null;
    if (!session || !isSessionActive(session, config)) return null;
    await store.touchSession(session.tokenHash, Date.now());
    return { token, session, user: session.user, role: session.activeRole, capabilities: capabilitiesForRole(session.activeRole) };
  }

  const required = async (c, next) => {
    const auth = await resolve(c);
    if (!auth) return c.json({ error: 'Authentication required.', code: 'AUTH_REQUIRED' }, 401);
    c.set('auth', auth);
    await next();
  };

  const capability = (name) => async (c, next) => {
    const auth = c.get('auth') ?? await resolve(c);
    if (!auth) return c.json({ error: 'Authentication required.', code: 'AUTH_REQUIRED' }, 401);
    if (!auth.capabilities.includes(name)) return c.json({ error: 'You do not have access to this operation.', code: 'FORBIDDEN' }, 403);
    c.set('auth', auth);
    await next();
  };

  return { resolve, required, capability };
}
