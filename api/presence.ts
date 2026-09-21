import type { VercelRequest, VercelResponse } from '@vercel/node';
import { asFetch } from './_lib/http';
import { canAccessSurvey } from './_lib/access';
import { sql } from './_lib/db';
import { json, userFromRequest } from './_lib/session';

async function ensurePresenceTable() {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS survey_presence (
      survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email text NOT NULL,
      name text,
      area text NOT NULL DEFAULT 'builder',
      question_id text,
      save_status text NOT NULL DEFAULT 'idle',
      save_epoch integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (survey_id, user_id)
    )
  `;
}

async function handle(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return json({ error: { message: 'Not authenticated' } }, 401);
  await ensurePresenceTable();
  const db = sql();

  if (req.method === 'DELETE') {
    const body = await req.json().catch(() => ({}));
    const surveyId = String(body.survey_id || '');
    if (surveyId) {
      await db`DELETE FROM survey_presence WHERE survey_id = ${surveyId} AND user_id = ${user.id}`;
    }
    return json({ ok: true });
  }

  if (req.method !== 'POST') return json({ error: { message: 'Method not allowed' } }, 405);

  const body = await req.json().catch(() => ({}));
  const surveyId = String(body.survey_id || '');
  if (!surveyId) return json({ error: { message: 'survey_id is required' } }, 400);
  if (!(await canAccessSurvey(user, surveyId))) return json({ error: { message: 'Not authorized' } }, 403);

  const questionId = body.question_id ? String(body.question_id) : null;
  const area = String(body.area || 'builder').slice(0, 32);
  const saveStatus = String(body.save_status || 'idle').slice(0, 16);
  const saveEpoch = Number.isFinite(Number(body.save_epoch)) ? Math.max(0, Math.floor(Number(body.save_epoch))) : 0;
  const name = user.user_metadata?.full_name || user.email.split('@')[0];

  await db`
    INSERT INTO survey_presence (survey_id, user_id, email, name, area, question_id, save_status, save_epoch, updated_at)
    VALUES (${surveyId}, ${user.id}, ${user.email}, ${name}, ${area}, ${questionId}, ${saveStatus}, ${saveEpoch}, now())
    ON CONFLICT (survey_id, user_id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      area = EXCLUDED.area,
      question_id = EXCLUDED.question_id,
      save_status = EXCLUDED.save_status,
      save_epoch = EXCLUDED.save_epoch,
      updated_at = now()
  `;
  await db`DELETE FROM survey_presence WHERE survey_id = ${surveyId} AND updated_at < now() - interval '20 seconds'`;

  const rows = await db`
    SELECT user_id, email, name, area, question_id, save_status, save_epoch, updated_at
    FROM survey_presence
    WHERE survey_id = ${surveyId}
      AND user_id <> ${user.id}
      AND updated_at > now() - interval '15 seconds'
    ORDER BY updated_at DESC
  `;

  return json({ peers: rows });
}

export default (req: VercelRequest, res: VercelResponse) => asFetch(req, res, handle);
