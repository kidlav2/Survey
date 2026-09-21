import type { VercelRequest, VercelResponse } from '@vercel/node';
import { asFetch } from '../_lib/http';
import { attachShares } from '../_lib/access';
import { sql } from '../_lib/db';
import { createSession, hashPassword, json, sessionCookie } from '../_lib/session';

async function handle(req: Request) {
  if (req.method !== 'POST') return json({ error: { message: 'Method not allowed' } }, 405);
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const name = String(body.name || body.full_name || '').trim();
  if (!email || password.length < 8) {
    return json({ error: { message: 'Enter an email and a password of at least 8 characters.' } }, 400);
  }
  const db = sql();
  const existing = await db`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (existing[0]) return json({ error: { message: 'This email is already registered.' } }, 400);
  const password_hash = await hashPassword(password);
  const created = await db`
    INSERT INTO users (email, password_hash, name)
    VALUES (${email}, ${password_hash}, ${name || null})
    RETURNING id, email, name
  `;
  const user = created[0] as { id: string; email: string; name?: string };
  try {
    await attachShares(user.id, user.email);
  } catch {
    /* table may not exist yet on first deploy */
  }
  const token = await createSession(user.id);
  return json(
    { user: { id: user.id, email: user.email, user_metadata: { full_name: user.name } } },
    200,
    { 'set-cookie': sessionCookie(token) }
  );
}

export default (req: VercelRequest, res: VercelResponse) => asFetch(req, res, handle);
