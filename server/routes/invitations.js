import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { hashPassword } from '../auth/password.js';
import { hashSessionToken } from '../auth/session.js';
import { createRateLimiter } from '../middleware/rate-limit.js';
import { resolveMailSettings } from '../services/environment.js';

const createSchema = z.object({
  email: z.string().trim().email().max(254),
  fullName: z.string().trim().min(2).max(100),
  role: z.enum(['admin', 'sales_rep', 'sales_manager', 'finance_ops']),
  teamId: z.string().uuid().nullable().optional(),
});
const redeemSchema = z.object({ token: z.string().min(20), password: z.string().min(12).max(256) });

export function registerInvitationRoutes(app, { store, config, auth }) {
  const redeemLimited = createRateLimiter({ max: 8 });

  app.post('/api/invitations', auth.capability('users.manage'), async (c) => {
    if (!store.query) return c.json({ error: 'PostgreSQL is required.', code: 'DATABASE_REQUIRED' }, 503);
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Enter valid invitation details.', code: 'INVALID_INPUT' }, 400);
    const current = c.get('auth');
    if (parsed.data.teamId) {
      const team = await store.query('SELECT 1 FROM sales_teams WHERE id=$1 AND workspace_id=$2', [parsed.data.teamId, current.user.workspaceId]);
      if (!team.rowCount) return c.json({ error: 'Sales team not found.', code: 'TEAM_NOT_FOUND' }, 404);
    }
    const token = randomBytes(32).toString('base64url');
    const result = await store.query(
      `INSERT INTO invitations(workspace_id,email,full_name,role,team_id,token_hash,invited_by,expires_at)
       VALUES($1,lower($2),$3,$4,$5,$6,$7,now()+interval '48 hours')
       RETURNING id,email,full_name AS "fullName",role,team_id AS "teamId",expires_at AS "expiresAt"`,
      [current.user.workspaceId, parsed.data.email, parsed.data.fullName, parsed.data.role, parsed.data.teamId ?? null, hashSessionToken(token), current.user.id],
    );
    const link = `${config.origin}/invite?token=${encodeURIComponent(token)}`;
    let delivered = false;
    const mail = await resolveMailSettings(store, config, current.user.workspaceId);
    if (mail.smtpUrl) {
      try {
        const transport = nodemailer.createTransport(mail.smtpUrl);
        await transport.sendMail({ from: mail.mailFrom, to: parsed.data.email, subject: 'Join DealFlow360', text: `Your DealFlow360 invitation expires in 48 hours: ${link}` });
        delivered = true;
      } catch { delivered = false; }
    }
    await store.writeAudit({ userId: current.user.id, workspaceId: current.user.workspaceId, action: 'invitation.created', metadata: { invitationId: result.rows[0].id, role: parsed.data.role, delivered } });
    return c.json({ data: { ...result.rows[0], link, delivered } }, 201);
  });

  app.post('/api/invitations/redeem', async (c) => {
    const ip = c.req.header('X-Real-IP') ?? 'unknown';
    if (redeemLimited(ip)) return c.json({ error: 'Too many attempts. Try again later.', code: 'RATE_LIMITED' }, 429);
    if (!store.transaction) return c.json({ error: 'PostgreSQL is required.', code: 'DATABASE_REQUIRED' }, 503);
    const parsed = redeemSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'The invitation or password is invalid.', code: 'INVALID_INPUT' }, 400);
    try {
      const user = await store.transaction(async (client) => {
        const invite = (await client.query(`UPDATE invitations SET redeemed_at=now() WHERE token_hash=$1 AND redeemed_at IS NULL AND expires_at>now() RETURNING *`, [hashSessionToken(parsed.data.token)])).rows[0];
        if (!invite) throw Object.assign(new Error('This invitation is invalid or expired.'), { status: 401, code: 'INVITATION_INVALID' });
        const passwordHash = await hashPassword(parsed.data.password);
        const created = (await client.query(`INSERT INTO users(workspace_id,email,full_name,password_hash) VALUES($1,$2,$3,$4) RETURNING id,email,full_name AS "fullName"`, [invite.workspace_id, invite.email, invite.full_name, passwordHash])).rows[0];
        await client.query(`INSERT INTO workspace_memberships(user_id,workspace_id,role,team_id) VALUES($1,$2,$3,$4)`, [created.id, invite.workspace_id, invite.role, invite.team_id]);
        await client.query(`INSERT INTO user_preferences(user_id) VALUES($1) ON CONFLICT DO NOTHING`, [created.id]);
        await client.query(`INSERT INTO audit_events(user_id,workspace_id,action,metadata) VALUES($1,$2,'invitation.redeemed',$3)`, [created.id, invite.workspace_id, JSON.stringify({ invitationId: invite.id, role: invite.role })]);
        return { ...created, role: invite.role };
      });
      return c.json({ data: user }, 201);
    } catch (error) {
      if (error.code === '23505') return c.json({ error: 'An account already exists for this email.', code: 'ACCOUNT_EXISTS' }, 409);
      return c.json({ error: error.message ?? 'Could not redeem invitation.', code: error.code ?? 'INVITATION_FAILED' }, error.status ?? 500);
    }
  });
}
