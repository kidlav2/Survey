import type { VercelRequest, VercelResponse } from '@vercel/node';
import { asFetch } from '../_lib/http';
import { clearSessionCookie, json } from '../_lib/session';

async function handle(req: Request) {
  if (req.method !== 'POST') return json({ error: { message: 'Method not allowed' } }, 405);
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
}

export default (req: VercelRequest, res: VercelResponse) => asFetch(req, res, handle);
