import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();

app.get('/api/health', (c) => c.json({
  service: 'dealflow360',
  status: 'ok',
}));

const port = Number(process.env.PORT ?? 4173);
serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, (info) => {
  console.log(`DealFlow360 API listening on http://${info.address}:${info.port}`);
});
