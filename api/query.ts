import type { VercelRequest, VercelResponse } from '@vercel/node';
import { asFetch } from './_lib/http';
import { runQuery, type QueryBody } from './_lib/query';
import { json, userFromRequest } from './_lib/session';

async function handle(req: Request) {
  if (req.method !== 'POST') return json({ error: { message: 'Method not allowed' } }, 405);
  const body = (await req.json()) as QueryBody;
  const user = await userFromRequest(req);
  const result = await runQuery(body, user);
  return json(result, result.error ? 400 : 200);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await asFetch(req, res, handle);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Query failed';
    const status = message === 'Not authorized' ? 401 : 400;
    res.status(status).json({ data: null, error: { message } });
  }
}
