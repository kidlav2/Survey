import { randomBytes } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { asFetch } from '../_lib/http';
import { sql } from '../_lib/db';
import { hashPassword, json, userFromRequest } from '../_lib/session';

async function handle(req: Request) {
  if (req.method !== 'POST') return json({ error: { message: 'Method not allowed' } }, 405);
  const body = await req.json().catch(() => ({}));
  const db = sql();

  const sessionUser = await userFromRequest(req);
  if (body.email && !body.password && !body.token && !sessionUser) {
    const email = String(body.email).trim().toLowerCase();
    const rows = await db`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    const user = rows[0] as { id: string } | undefined;
    if (user) {
      const token = randomBytes(24).toString('hex');
      const expires = new Date(Date.now() + 1000 * 60 * 60).toISOString();
      await db`INSERT INTO password_resets (user_id, token, expires_at) VALUES (${user.id}, ${token}, ${expires})`;
    }
    return json({ ok: true });
  }

  if (body.token && body.password) {
    const token = String(body.token);
    const password = String(body.password);
    if (password.length < 8) return json({ error: { message: 'Password must be at least 8 characters.' } }, 400);
    const rows = await db`
      SELECT user_id FROM password_resets
      WHERE token = ${token} AND expires_at > now()
      LIMIT 1
    `;
    const row = rows[0] as { user_id: string } | undefined;
    if (!row) return json({ error: { message: 'Reset link is invalid or expired.' } }, 400);
    const password_hash = await hashPassword(password);
    await db`UPDATE users SET password_hash = ${password_hash} WHERE id = ${row.user_id}`;
    await db`DELETE FROM password_resets WHERE token = ${token}`;
    return json({ ok: true });
  }

  const user = sessionUser;
  if (!user) return json({ error: { message: 'Not authenticated' } }, 401);
  if (body.password) {
    if (String(body.password).length < 8) {
      return json({ error: { message: 'Password must be at least 8 characters.' } }, 400);
    }
    const password_hash = await hashPassword(String(body.password));
    await db`UPDATE users SET password_hash = ${password_hash} WHERE id = ${user.id}`;
  }
  if (body.email) {
    const email = String(body.email).trim().toLowerCase();
    await db`UPDATE users SET email = ${email} WHERE id = ${user.id}`;
  }
  if (body.name !== undefined) {
    await db`UPDATE users SET name = ${body.name ? String(body.name) : null} WHERE id = ${user.id}`;
  }
  if (body.organization !== undefined) {
    await db`UPDATE users SET organization = ${body.organization ? String(body.organization) : null} WHERE id = ${user.id}`;
  }
  const rows = await db`SELECT id, email, name, organization FROM users WHERE id = ${user.id} LIMIT 1`;
  const updated = rows[0] as { id: string; email: string; name?: string; organization?: string };
  return json({
    user: {
      id: updated.id,
      email: updated.email,
      user_metadata: { full_name: updated.name, organization: updated.organization },
    },
  });
}

export default (req: VercelRequest, res: VercelResponse) => asFetch(req, res, handle);
