import type { VercelRequest, VercelResponse } from '@vercel/node';
import { asFetch } from './_lib/http';
import { sql } from './_lib/db';
import {
  attachShares,
  canAccessSurvey,
  ensureSharesTable,
  isSurveyOwner,
  normalizeEmail,
} from './_lib/access';
import { json, userFromRequest } from './_lib/session';

type ShareRow = {
  id: string;
  email: string;
  user_id: string | null;
  role: string;
  created_at: string;
  name?: string | null;
};

async function handle(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return json({ error: { message: 'Not authenticated' } }, 401);
  await ensureSharesTable();
  await attachShares(user.id, user.email);

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const surveyId = url.searchParams.get('survey_id') || '';
    if (!surveyId) return json({ error: { message: 'survey_id is required' } }, 400);
    if (!(await canAccessSurvey(user, surveyId))) return json({ error: { message: 'Not authorized' } }, 403);

    const db = sql();
    const ownerRows = await db`
      SELECT u.id, u.email, u.name
      FROM surveys s
      JOIN users u ON u.id = s.owner_id
      WHERE s.id = ${surveyId}
      LIMIT 1
    `;
    const owner = (ownerRows[0] as { id: string; email: string; name?: string } | undefined) || null;
    const shareRows = await db`
      SELECT s.id, s.email, s.user_id, s.role, s.created_at, u.name
      FROM survey_shares s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.survey_id = ${surveyId}
      ORDER BY s.created_at ASC
    `;
    return json({
      owner,
      isOwner: owner?.id === user.id,
      shares: shareRows as ShareRow[],
    });
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const surveyId = String(body.survey_id || '');
    const email = normalizeEmail(String(body.email || ''));
    if (!surveyId || !email || !email.includes('@')) {
      return json({ error: { message: 'Enter a valid email.' } }, 400);
    }
    if (!(await isSurveyOwner(user, surveyId))) {
      return json({ error: { message: 'Only the owner can share this survey.' } }, 403);
    }
    if (email === normalizeEmail(user.email)) {
      return json({ error: { message: 'That is your own email.' } }, 400);
    }

    const db = sql();
    const existingCount = await db`SELECT COUNT(*)::int AS count FROM survey_shares WHERE survey_id = ${surveyId}`;
    if (Number((existingCount[0] as { count?: number })?.count || 0) >= 20) {
      return json({ error: { message: 'This survey already has the maximum number of people.' } }, 400);
    }

    const found = await db`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    const userId = (found[0] as { id?: string } | undefined)?.id || null;
    try {
      const inserted = await db`
        INSERT INTO survey_shares (survey_id, email, user_id, role)
        VALUES (${surveyId}, ${email}, ${userId}, 'editor')
        RETURNING id, email, user_id, role, created_at
      `;
      return json({ share: inserted[0], pending: !userId });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('survey_shares') || message.toLowerCase().includes('unique')) {
        return json({ error: { message: 'This person already has access.' } }, 409);
      }
      throw error;
    }
  }

  if (req.method === 'DELETE') {
    const body = await req.json().catch(() => ({}));
    const shareId = String(body.id || '');
    if (!shareId) return json({ error: { message: 'id is required' } }, 400);
    const db = sql();
    const rows = await db`
      SELECT id, survey_id, email, user_id
      FROM survey_shares
      WHERE id = ${shareId}
      LIMIT 1
    `;
    const share = rows[0] as { id: string; survey_id: string; email: string; user_id: string | null } | undefined;
    if (!share) return json({ error: { message: 'Not found' } }, 404);
    const owner = await isSurveyOwner(user, share.survey_id);
    const self =
      share.user_id === user.id || normalizeEmail(share.email) === normalizeEmail(user.email);
    if (!owner && !self) return json({ error: { message: 'Not authorized' } }, 403);
    await db`DELETE FROM survey_shares WHERE id = ${shareId}`;
    return json({ ok: true });
  }

  return json({ error: { message: 'Method not allowed' } }, 405);
}

export default (req: VercelRequest, res: VercelResponse) => asFetch(req, res, handle);
