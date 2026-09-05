import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getConfig } from './config.js';
import { createStore } from './store/index.js';
import { applySecurityHeaders } from './middleware/security.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerHealthRoute } from './routes/health.js';
import { createAuth } from './middleware/auth.js';
import { registerDomainRoutes } from './routes/domain.js';
import { registerInvitationRoutes } from './routes/invitations.js';

export function createApp({ config = getConfig(), store = createStore(config) } = {}) {
  const app = new Hono();
  applySecurityHeaders(app, config);
  app.use('/api/*', bodyLimit({ maxSize: 2 * 1024 * 1024, onError: (c) => c.json({ error: 'Request is too large.', code: 'BODY_TOO_LARGE' }, 413) }));
  const auth = createAuth({ store, config });
  registerHealthRoute(app, { store });
  registerAuthRoutes(app, { store, config });
  registerInvitationRoutes(app, { store, config, auth });
  registerDomainRoutes(app, { store, config, auth });
  app.all('/api/*', (c) => c.json({ error: 'API route not found.', code: 'NOT_FOUND' }, 404));
  app.notFound((c) => c.json({ error: 'Not found.', code: 'NOT_FOUND' }, 404));
  return { app, config, store };
}
