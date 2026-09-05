import { Pool } from 'pg';

export class PostgresStore {
  constructor({ databaseUrl, workspaceId, pool } = {}) {
    this.workspaceId = workspaceId;
    this.pool = pool ?? new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 2_000,
    });
  }

  async findUserByEmail(email) {
    const result = await this.pool.query(
      `SELECT u.id, u.email, u.full_name AS "fullName", u.password_hash AS "passwordHash",
              u.workspace_id AS "workspaceId", array_agg(m.role ORDER BY m.role) AS roles
         FROM users u
         JOIN workspace_memberships m ON m.user_id = u.id AND m.workspace_id = u.workspace_id
        WHERE lower(u.email) = lower($1)
        GROUP BY u.id`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async createSession(session) {
    await this.pool.query(
      `INSERT INTO sessions
        (id, token_hash, user_id, workspace_id, active_role, created_at, last_seen_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0), to_timestamp($7 / 1000.0), to_timestamp($8 / 1000.0))`,
      [session.id, session.tokenHash, session.userId, session.workspaceId, session.activeRole, session.createdAt, session.lastSeenAt, session.expiresAt],
    );
    return session;
  }

  async getSessionByTokenHash(tokenHash) {
    const result = await this.pool.query(
      `SELECT s.id, s.token_hash AS "tokenHash", s.user_id AS "userId", s.workspace_id AS "workspaceId",
              s.active_role AS "activeRole", extract(epoch FROM s.created_at) * 1000 AS "createdAt",
              extract(epoch FROM s.last_seen_at) * 1000 AS "lastSeenAt", extract(epoch FROM s.expires_at) * 1000 AS "expiresAt",
              u.id AS "user_id", u.email, u.full_name AS "fullName", u.password_hash AS "passwordHash",
              array_agg(m.role ORDER BY m.role) AS roles
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         JOIN workspace_memberships m ON m.user_id = s.user_id AND m.workspace_id = s.workspace_id
        WHERE s.token_hash = $1
        GROUP BY s.id, u.id`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    const { user_id: _userId, ...session } = row;
    return { ...session, user: { id: row.user_id, email: row.email, fullName: row.fullName, passwordHash: row.passwordHash, roles: row.roles, workspaceId: row.workspaceId } };
  }

  async touchSession(tokenHash, timestamp) {
    await this.pool.query('UPDATE sessions SET last_seen_at = to_timestamp($2 / 1000.0) WHERE token_hash = $1', [tokenHash, timestamp]);
  }

  async deleteSession(tokenHash) {
    await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }

  async writeAudit(event) {
    await this.pool.query(
      `INSERT INTO audit_events (user_id, workspace_id, action, ip_address, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [event.userId ?? null, event.workspaceId ?? this.workspaceId, event.action, event.ipAddress ?? null, JSON.stringify(event.metadata ?? {})],
    );
  }

  async health() {
    const startedAt = performance.now();
    await this.pool.query('SELECT 1');
    return { status: 'connected', latencyMs: Math.round(performance.now() - startedAt) };
  }

  async close() {
    await this.pool.end();
  }
}
