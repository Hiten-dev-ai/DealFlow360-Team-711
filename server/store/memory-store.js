export class MemoryStore {
  constructor({ workspaceId }) {
    this.workspaceId = workspaceId;
    this.users = new Map();
    this.sessions = new Map();
    this.auditEvents = [];
    this.isMemory = true;
  }

  async createUser({ id, email, fullName, passwordHash, roles, teamId = null }) {
    const user = { id, email: email.toLowerCase(), fullName, passwordHash, roles, teamId, workspaceId: this.workspaceId };
    this.users.set(user.email, user);
    return user;
  }

  async findUserByEmail(email) {
    return this.users.get(email.toLowerCase()) ?? null;
  }

  async createSession(session) {
    this.sessions.set(session.tokenHash, session);
    return session;
  }

  async getSessionByTokenHash(tokenHash) {
    const session = this.sessions.get(tokenHash);
    if (!session) return null;
    const user = [...this.users.values()].find((candidate) => candidate.id === session.userId);
    return user ? { ...session, user } : null;
  }

  async touchSession(tokenHash, timestamp) {
    const session = this.sessions.get(tokenHash);
    if (session) session.lastSeenAt = timestamp;
  }

  async deleteSession(tokenHash) {
    this.sessions.delete(tokenHash);
  }

  async writeAudit(event) {
    this.auditEvents.push({ ...event, createdAt: event.createdAt ?? Date.now() });
  }

  async health() {
    return { status: 'memory', latencyMs: 0 };
  }

  async close() {}
}
