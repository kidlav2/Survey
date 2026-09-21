import type { VercelRequest, VercelResponse } from '@vercel/node';
import { asFetch } from '../_lib/http';
import { sql } from '../_lib/db';
import { clearSessionCookie, json, userFromRequest } from '../_lib/session';

async function handle(req: Request) {
  if (req.method !== 'POST') return json({ error: { message: 'Method not allowed' } }, 405);
  const user = await userFromRequest(req);
  if (!user) return json({ error: { message: 'Not authenticated' } }, 401);
  const db = sql();
  await db`DELETE FROM users WHERE id = ${user.id}`;
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
}

export default (req: VercelRequest, res: VercelResponse) => asFetch(req, res, handle);
