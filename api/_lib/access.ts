import { sql } from './db';
import type { AuthUser } from './session';

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function attachShares(userId: string, email: string) {
  const db = sql();
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  await db`
    UPDATE survey_shares
    SET user_id = ${userId}
    WHERE lower(email) = ${normalized}
      AND (user_id IS NULL OR user_id = ${userId})
  `;
}

export async function accessibleSurveyIds(user: AuthUser): Promise<string[]> {
  const db = sql();
  const email = normalizeEmail(user.email);
  const rows = await db`
    SELECT id FROM surveys WHERE owner_id = ${user.id}
    UNION
    SELECT survey_id AS id FROM survey_shares
    WHERE user_id = ${user.id} OR lower(email) = ${email}
  `;
  return rows.map((row) => String((row as { id: string }).id));
}

export async function isSurveyOwner(user: AuthUser, surveyId: string) {
  const db = sql();
  const rows = await db`SELECT 1 FROM surveys WHERE id = ${surveyId} AND owner_id = ${user.id} LIMIT 1`;
  return Boolean(rows[0]);
}

export async function canAccessSurvey(user: AuthUser, surveyId: string) {
  const db = sql();
  const email = normalizeEmail(user.email);
  const rows = await db`
    SELECT EXISTS (
      SELECT 1 FROM surveys WHERE id = ${surveyId} AND owner_id = ${user.id}
      UNION ALL
      SELECT 1 FROM survey_shares
      WHERE survey_id = ${surveyId} AND (user_id = ${user.id} OR lower(email) = ${email})
    ) AS ok
  `;
  return Boolean((rows[0] as { ok?: boolean } | undefined)?.ok);
}

export async function ensureSharesTable() {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS survey_shares (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      email text NOT NULL,
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL DEFAULT 'editor',
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (survey_id, email)
    )
  `;
}
