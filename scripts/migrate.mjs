import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'));
loadEnvFile(resolve(process.cwd(), '.env'));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const dumpPath = process.env.DUMP_PATH || '/tmp/fromsurvey-migrate/dump.json';
const sql = neon(url);

function statementsFrom(schema) {
  return schema
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('--'));
}

async function insertRows(table, columns, rows) {
  let inserted = 0;
  for (const row of rows) {
    const cols = columns.filter((col) => row[col] !== undefined);
    if (!cols.length) continue;
    const values = cols.map((col) => {
      const value = row[col];
      if (value !== null && typeof value === 'object') return JSON.stringify(value);
      return value;
    });
    const marks = cols.map((col, i) => {
      const json = ['options', 'payload', 'conditional_logic', 'answers'].includes(col);
      return json ? `$${i + 1}::jsonb` : `$${i + 1}`;
    });
    await sql.query(
      `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${marks.join(', ')}) ON CONFLICT (id) DO NOTHING`,
      values
    );
    inserted += 1;
  }
  return inserted;
}

const schema = readFileSync(resolve(process.cwd(), 'db/schema.sql'), 'utf8');
for (const statement of statementsFrom(schema)) {
  await sql.query(statement);
}
console.log('schema applied');

if (existsSync(dumpPath)) {
  const dump = JSON.parse(readFileSync(dumpPath, 'utf8'));
  const surveys = await insertRows(
    'surveys',
    ['id', 'title', 'description', 'status', 'created_at', 'owner_id', 'estimated_time', 'thank_you_message', 'show_survey_info'],
    dump.surveys || []
  );
  const sections = await insertRows(
    'survey_sections',
    ['id', 'survey_id', 'name', 'description', 'order_index', 'created_at'],
    dump.survey_sections || []
  );
  const questions = await insertRows(
    'questions',
    [
      'id',
      'survey_id',
      'type',
      'text',
      'options',
      'required',
      'has_other_option',
      'sort_order',
      'created_at',
      'payload',
      'section_id',
      'conditional_logic',
    ],
    dump.questions || []
  );
  const responses = await insertRows(
    'responses',
    [
      'id',
      'survey_id',
      'respondent_email',
      'answers',
      'created_at',
      'duration_seconds',
      'language',
      'opted_in',
      'completed',
      'lng',
    ],
    dump.responses || []
  );
  console.log(`loaded surveys=${surveys} sections=${sections} questions=${questions} responses=${responses}`);
} else {
  console.log(`no dump at ${dumpPath}`);
}

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (email && password) {
  const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  let userId = existing[0]?.id;
  if (!userId) {
    const hash = await bcrypt.hash(password, 10);
    const created = await sql`
      INSERT INTO users (email, password_hash, name)
      VALUES (${email}, ${hash}, ${process.env.BOOTSTRAP_ADMIN_NAME || 'Admin'})
      RETURNING id
    `;
    userId = created[0].id;
    console.log('bootstrap admin created');
  } else {
    console.log('bootstrap admin already exists');
  }
  await sql`
    UPDATE surveys
    SET owner_id = ${userId}
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = surveys.owner_id)
  `;
  console.log('orphan surveys claimed');
}
