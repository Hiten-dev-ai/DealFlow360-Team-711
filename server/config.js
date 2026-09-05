const DEFAULT_WORKSPACE_ID = '00000000-0000-4000-8000-000000000711';

export function getConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? 'development';
  return {
    nodeEnv,
    host: env.HOST ?? '127.0.0.1',
    port: Number(env.PORT ?? 4173),
    origin: env.APP_ORIGIN ?? 'http://127.0.0.1:4173',
    workspaceId: env.WORKSPACE_ID ?? DEFAULT_WORKSPACE_ID,
    databaseUrl: env.DATABASE_URL ?? null,
    sessionCookieName: 'dealflow_session',
    sessionInactivityMs: 30 * 60 * 1000,
    sessionAbsoluteMs: 8 * 60 * 60 * 1000,
    secureCookies: nodeEnv === 'production',
  };
}
