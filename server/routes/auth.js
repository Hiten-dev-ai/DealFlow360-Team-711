import { z } from 'zod';
import { chooseDefaultRole } from '../auth/roles.js';
import { createSessionRecord, createSessionToken, hashSessionToken, isSessionActive } from '../auth/session.js';
import { verifyPassword } from '../auth/password.js';
import { readCookie, sessionCookie } from '../http/cookies.js';
import { createRateLimiter } from '../middleware/rate-limit.js';
import { csrfTokenForSession } from '../auth/csrf.js';

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(256),
});

function publicUser(user, activeRole) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: user.roles,
    activeRole,
    teamId: user.teamId ?? null,
  };
}

function clientIp(c) {
  return c.req.header('X-Real-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? null;
}

export function registerAuthRoutes(app, { store, config }) {
  const loginLimited = createRateLimiter({ max: 8 });

  app.post('/api/auth/login', async (c) => {
    if (loginLimited(clientIp(c))) return c.json({ error: 'Too many sign-in attempts. Try again later.' }, 429);
    const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Enter a valid email and password.', code: 'INVALID_INPUT' }, 400);

    const user = await store.findUserByEmail(parsed.data.email);
    const valid = user ? await verifyPassword(user.passwordHash, parsed.data.password) : false;
    if (!valid) return c.json({ error: 'Invalid email or password.', code: 'AUTH_INVALID' }, 401);

    const activeRole = chooseDefaultRole(user.roles);
    const token = createSessionToken();
    const session = createSessionRecord({ token, user, activeRole, config });
    await store.createSession(session);
    await store.writeAudit({ userId: user.id, workspaceId: user.workspaceId, action: 'auth.login', ipAddress: clientIp(c) });
    c.header('Set-Cookie', sessionCookie(config.sessionCookieName, token, config, Math.floor(config.sessionAbsoluteMs / 1000)));
    return c.json({ user: publicUser(user, activeRole), csrfToken: csrfTokenForSession(token) });
  });

  app.get('/api/auth/session', async (c) => {
    const token = readCookie(c.req, config.sessionCookieName);
    const session = token ? await store.getSessionByTokenHash(hashSessionToken(token)) : null;
    if (!session || !isSessionActive(session, config)) return c.json({ error: 'Authentication required.', code: 'AUTH_REQUIRED' }, 401);
    await store.touchSession(session.tokenHash, Date.now());
    return c.json({ authenticated: true, user: publicUser(session.user, session.activeRole), csrfToken: csrfTokenForSession(token) });
  });

  app.post('/api/auth/logout', async (c) => {
    const token = readCookie(c.req, config.sessionCookieName);
    if (token) await store.deleteSession(hashSessionToken(token));
    c.header('Set-Cookie', sessionCookie(config.sessionCookieName, '', config, 0));
    return c.json({ ok: true });
  });
}
