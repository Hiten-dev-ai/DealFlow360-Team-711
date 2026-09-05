export function applySecurityHeaders(app, config) {
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'same-origin');
    c.header('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:");
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
      const requestOrigin = c.req.header('Origin');
      if (requestOrigin && requestOrigin !== config.origin) {
        return c.json({ error: 'Cross-origin request rejected.', code: 'CSRF_REJECTED' }, 403);
      }
    }
    await next();
  });
}
