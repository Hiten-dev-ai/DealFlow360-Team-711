import { createHash, randomBytes } from 'node:crypto';

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createSessionRecord({ token, user, activeRole, config, now = Date.now() }) {
  return {
    id: randomBytes(16).toString('hex'),
    tokenHash: hashSessionToken(token),
    userId: user.id,
    workspaceId: user.workspaceId,
    activeRole,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + config.sessionAbsoluteMs,
  };
}

export function isSessionActive(session, config, now = Date.now()) {
  return Boolean(
    session
      && session.expiresAt > now
      && session.lastSeenAt > now - config.sessionInactivityMs,
  );
}
