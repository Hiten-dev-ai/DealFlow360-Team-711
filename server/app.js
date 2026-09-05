import { Hono } from 'hono';
import { getConfig } from './config.js';
import { createStore } from './store/index.js';
import { applySecurityHeaders } from './middleware/security.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerHealthRoute } from './routes/health.js';

export function createApp({ config = getConfig(), store = createStore(config) } = {}) {
  const app = new Hono();
  applySecurityHeaders(app, config);
  registerHealthRoute(app, { store });
  registerAuthRoutes(app, { store, config });
  app.all('/api/*', (c) => c.json({ error: 'API route not found.', code: 'NOT_FOUND' }, 404));
  app.notFound((c) => c.json({ error: 'Not found.', code: 'NOT_FOUND' }, 404));
  return { app, config, store };
}
