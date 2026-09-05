export function registerHealthRoute(app, { store }) {
  app.get('/api/health', async (c) => {
    try {
      const database = await store.health();
      return c.json({
        service: 'dealflow360',
        status: database.status === 'connected' || database.status === 'memory' ? 'ok' : 'degraded',
        database,
        uptimeSeconds: Math.floor(process.uptime()),
      });
    } catch {
      return c.json({
        service: 'dealflow360',
        status: 'degraded',
        database: { status: 'unavailable' },
        uptimeSeconds: Math.floor(process.uptime()),
      }, 503);
    }
  });
}
