import { realpathSync } from 'node:fs';
import { basename } from 'node:path';

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
    portalCookieName: 'dealflow_portal',
    sessionInactivityMs: 30 * 60 * 1000,
    sessionAbsoluteMs: 8 * 60 * 60 * 1000,
    invitationMs: 48 * 60 * 60 * 1000,
    portalLinkMs: 30 * 60 * 1000,
    releaseId: env.RELEASE_ID ?? basename(realpathSync(process.cwd())),
    smtpUrl: env.SMTP_URL ?? null,
    mailFrom: env.MAIL_FROM ?? 'DealFlow360 <no-reply@dealflow360.athergrid.dev>',
    secureCookies: nodeEnv === 'production',
  };
}
