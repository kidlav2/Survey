import type { VercelRequest, VercelResponse } from '@vercel/node';
import { asFetch } from '../_lib/http';
import { attachShares } from '../_lib/access';
import { sql } from '../_lib/db';
import { createSession, json, sessionCookie, verifyPassword } from '../_lib/session';

async function handle(req: Request) {
  if (req.method !== 'POST') return json({ error: { message: 'Method not allowed' } }, 405);
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const db = sql();
  const rows = await db`SELECT id, email, name, password_hash FROM users WHERE email = ${email} LIMIT 1`;
  const user = rows[0] as { id: string; email: string; name?: string; password_hash: string } | undefined;
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return json({ error: { message: 'Invalid login credentials' } }, 401);
  }
  const token = await createSession(user.id);
  try {
    await attachShares(user.id, user.email);
  } catch {
    /* table may not exist yet on first deploy */
  }
  return json(
    {
      user: { id: user.id, email: user.email, user_metadata: { full_name: user.name } },
      session: { user: { id: user.id, email: user.email } },
    },
    200,
    { 'set-cookie': sessionCookie(token) }
  );
}

export default (req: VercelRequest, res: VercelResponse) => asFetch(req, res, handle);
