import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sql } from './db';

const COOKIE = 'fs_session';

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error('SESSION_SECRET is not set');
  return value;
}

function sign(token: string) {
  return createHmac('sha256', secret()).update(token).digest('hex');
}

export type AuthUser = {
  id: string;
  email: string;
  user_metadata?: { full_name?: string; organization?: string };
};

export function parseCookies(header: string | null) {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function sessionCookie(token: string, maxAge = 60 * 60 * 24 * 30) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  const signed = `${token}.${sign(token)}`;
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  const db = sql();
  await db`INSERT INTO sessions (user_id, token, expires_at) VALUES (${userId}, ${signed}, ${expires})`;
  return signed;
}

export async function userFromRequest(req: Request): Promise<AuthUser | null> {
  const cookies = parseCookies(req.headers.get('cookie'));
  const token = cookies[COOKIE];
  if (!token) return null;
  const [raw, mac] = token.split('.');
  if (!raw || !mac) return null;
  const expected = sign(raw);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const db = sql();
  const rows = await db`
    SELECT u.id, u.email, u.name, u.organization
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > now()
    LIMIT 1
  `;
  const row = rows[0] as { id: string; email: string; name?: string; organization?: string } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    user_metadata: { full_name: row.name || undefined, organization: row.organization || undefined },
  };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}
