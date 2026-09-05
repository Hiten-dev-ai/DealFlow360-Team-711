import { serve } from '@hono/node-server';
import { createApp } from './app.js';

const { app, config, store } = createApp();
const server = serve({ fetch: app.fetch, hostname: config.host, port: config.port }, (info) => {
  console.log(`DealFlow360 API listening on http://${info.address}:${info.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    server.close();
    await store.close();
    process.exit(0);
  });
}
