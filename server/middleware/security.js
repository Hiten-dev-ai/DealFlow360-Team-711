import { csrfMatches } from '../auth/csrf.js';
import { readCookie } from '../http/cookies.js';

export function applySecurityHeaders(app, config) {
  app.use('*', async (c, next) => {
    if (c.req.path.startsWith('/api/')) c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'same-origin');
    c.header('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:");
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
      const requestOrigin = c.req.header('Origin');
      if (requestOrigin !== config.origin) {
        return c.json({ error: 'Cross-origin request rejected.', code: 'CSRF_REJECTED' }, 403);
      }
      const isPublicAuth = ['/api/auth/login', '/api/invitations/redeem', '/api/portal/redeem'].includes(c.req.path);
      const protectedToken = c.req.path.startsWith('/api/portal/')
        ? readCookie(c.req, config.portalCookieName)
        : readCookie(c.req, config.sessionCookieName);
      if (!isPublicAuth && protectedToken && !csrfMatches(protectedToken, c.req.header('X-CSRF-Token'))) {
        return c.json({ error: 'Security token is missing or invalid.', code: 'CSRF_REJECTED' }, 403);
      }
    }
    await next();
  });
}
