import type { VercelRequest, VercelResponse } from '@vercel/node';
import { asFetch } from '../_lib/http';
import { json, userFromRequest } from '../_lib/session';

async function handle(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return json({ session: null, user: null });
  return json({ session: { user }, user });
}

export default (req: VercelRequest, res: VercelResponse) => asFetch(req, res, handle);
