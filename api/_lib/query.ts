import { accessibleSurveyIds, canAccessSurvey, isSurveyOwner } from './access';
import { COLUMNS, JSON_COLUMNS, isTable, sql, type TableName } from './db';
import type { AuthUser } from './session';

export type Filter = { type: 'eq' | 'in'; col: string; val: unknown };
export type QueryBody = {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete';
  select?: string;
  filters?: Filter[];
  order?: { col: string; ascending?: boolean };
  data?: Record<string, unknown> | Record<string, unknown>[];
  single?: boolean;
  maybeSingle?: boolean;
  limit?: number;
  count?: 'exact';
  head?: boolean;
};

function colOk(table: TableName, col: string) {
  return COLUMNS[table].includes(col);
}

function selectCols(table: TableName, spec?: string) {
  if (!spec || spec === '*') return COLUMNS[table].map((c) => `"${c}"`).join(', ');
  const cols = spec.split(',').map((c) => c.trim()).filter((c) => colOk(table, c));
  if (!cols.length) return COLUMNS[table].map((c) => `"${c}"`).join(', ');
  return cols.map((c) => `"${c}"`).join(', ');
}

function encodeValue(col: string, value: unknown) {
  if (value === undefined) return null;
  if (JSON_COLUMNS.has(col) && value !== null && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

async function isActiveSurvey(id: string) {
  const db = sql();
  const rows = await db`SELECT status FROM surveys WHERE id = ${id} LIMIT 1`;
  return String((rows[0] as { status?: string } | undefined)?.status) === 'active';
}

async function resolveSurveyId(table: TableName, filters: Filter[], data?: Record<string, unknown>) {
  if (table === 'surveys') {
    const id = filters.find((f) => f.type === 'eq' && f.col === 'id')?.val;
    return typeof id === 'string' ? id : null;
  }
  if (typeof data?.survey_id === 'string') return data.survey_id;
  const fromFilter = filters.find((f) => f.type === 'eq' && f.col === 'survey_id')?.val;
  if (typeof fromFilter === 'string') return fromFilter;
  const rowId = filters.find((f) => f.type === 'eq' && f.col === 'id')?.val;
  if (typeof rowId !== 'string') return null;
  const db = sql();
  const rows = await db.query(`SELECT survey_id FROM "${table}" WHERE id = $1 LIMIT 1`, [rowId]);
  return String((rows[0] as { survey_id?: string } | undefined)?.survey_id || '') || null;
}

async function assertPublicAccess(table: TableName, op: QueryBody['op'], filters: Filter[], data?: Record<string, unknown>) {
  if (op === 'select' && table === 'surveys') {
    const id = filters.find((f) => f.type === 'eq' && f.col === 'id')?.val;
    if (typeof id === 'string' && (await isActiveSurvey(id))) return;
    throw new Error('Not authorized');
  }
  if (op === 'select' && (table === 'questions' || table === 'survey_sections')) {
    const surveyId = filters.find((f) => f.type === 'eq' && f.col === 'survey_id')?.val;
    if (typeof surveyId === 'string' && (await isActiveSurvey(surveyId))) return;
    throw new Error('Not authorized');
  }
  if (table === 'responses' && (op === 'insert' || op === 'update' || op === 'select')) {
    if (op === 'insert') {
      const surveyId = data?.survey_id;
      if (typeof surveyId === 'string' && (await isActiveSurvey(surveyId))) return;
    }
    if (op === 'update' || op === 'select') {
      const id = filters.find((f) => f.type === 'eq' && f.col === 'id')?.val;
      if (typeof id === 'string') return;
    }
  }
  throw new Error('Not authorized');
}

async function assertUserAccess(
  user: AuthUser,
  table: TableName,
  op: QueryBody['op'],
  filters: Filter[],
  data?: Record<string, unknown>
) {
  if (table === 'surveys' && op === 'insert') {
    if (data) data.owner_id = user.id;
    return;
  }
  if (table === 'surveys' && op === 'delete') {
    const id = filters.find((f) => f.type === 'eq' && f.col === 'id')?.val;
    if (typeof id === 'string' && (await isSurveyOwner(user, id))) return;
    throw new Error('Not authorized');
  }
  if (table === 'surveys' && op === 'update') {
    if (data) delete data.owner_id;
    const id = filters.find((f) => f.type === 'eq' && f.col === 'id')?.val;
    if (typeof id === 'string' && (await canAccessSurvey(user, id))) return;
    throw new Error('Not authorized');
  }
  if (table === 'surveys' && op === 'select') {
    const id = filters.find((f) => f.type === 'eq' && f.col === 'id')?.val;
    if (typeof id === 'string') {
      if ((await canAccessSurvey(user, id)) || (await isActiveSurvey(id))) return;
      throw new Error('Not authorized');
    }
    const idIn = filters.find((f) => f.type === 'in' && f.col === 'id');
    if (idIn && Array.isArray(idIn.val)) {
      const allowed = new Set(await accessibleSurveyIds(user));
      idIn.val = idIn.val.filter((value) => typeof value === 'string' && allowed.has(value));
      return;
    }
    filters.push({ type: 'in', col: 'id', val: await accessibleSurveyIds(user) });
    return;
  }

  if (table === 'responses' && op === 'insert') {
    const surveyId = typeof data?.survey_id === 'string' ? data.survey_id : null;
    if (surveyId && ((await isActiveSurvey(surveyId)) || (await canAccessSurvey(user, surveyId)))) return;
    throw new Error('Not authorized');
  }
  if (table === 'responses' && (op === 'update' || op === 'select')) {
    const id = filters.find((f) => f.type === 'eq' && f.col === 'id')?.val;
    if (typeof id === 'string') return;
  }
  if (table === 'responses' && op === 'delete') {
    const surveyId = await resolveSurveyId(table, filters, data);
    if (surveyId && (await canAccessSurvey(user, surveyId))) return;
    throw new Error('Not authorized');
  }

  const surveyId = await resolveSurveyId(table, filters, data);
  if (surveyId) {
    if ((await canAccessSurvey(user, surveyId)) || (op === 'select' && (await isActiveSurvey(surveyId)))) return;
    throw new Error('Not authorized');
  }

  const surveyIds = filters.find((f) => f.type === 'in' && (f.col === 'survey_id' || f.col === 'id'))?.val;
  if (Array.isArray(surveyIds)) {
    const allowed = new Set(await accessibleSurveyIds(user));
    if (surveyIds.every((id) => typeof id === 'string' && allowed.has(id))) return;
    throw new Error('Not authorized');
  }

  throw new Error('Not authorized');
}

async function assertAccess(user: AuthUser | null, table: TableName, op: QueryBody['op'], filters: Filter[], data?: Record<string, unknown>) {
  if (!user) return assertPublicAccess(table, op, filters, data);
  return assertUserAccess(user, table, op, filters, data);
}

export async function runQuery(body: QueryBody, user: AuthUser | null) {
  if (!isTable(body.table)) throw new Error('Unknown table');
  const table = body.table;
  const filters = [...(body.filters || [])];
  if (user && table === 'surveys' && body.op === 'select') {
    const ownerEq = filters.find((filter) => filter.type === 'eq' && filter.col === 'owner_id' && filter.val === user.id);
    if (ownerEq) {
      const ids = await accessibleSurveyIds(user);
      const index = filters.indexOf(ownerEq);
      filters.splice(index, 1, { type: 'in', col: 'id', val: ids });
    }
  }
  for (const filter of filters) {
    if (!colOk(table, filter.col)) throw new Error('Unknown column');
  }
  if (body.order && !colOk(table, body.order.col)) throw new Error('Unknown column');

  const row = Array.isArray(body.data) ? body.data[0] : body.data;
  await assertAccess(user, table, body.op, filters, row);

  const db = sql();
  const quoted = `"${table}"`;

  if (body.op === 'select') {
    let text = `SELECT ${selectCols(table, body.select)} FROM ${quoted}`;
    const values: unknown[] = [];
    const where: string[] = [];
    filters.forEach((filter) => {
      if (filter.type === 'eq') {
        values.push(filter.val);
        where.push(`"${filter.col}" = $${values.length}`);
      } else if (filter.type === 'in') {
        const list = Array.isArray(filter.val) ? filter.val : [];
        if (!list.length) {
          where.push('FALSE');
          return;
        }
        const marks = list.map((item) => {
          values.push(item);
          return `$${values.length}`;
        });
        where.push(`"${filter.col}" IN (${marks.join(',')})`);
      }
    });
    if (where.length) text += ` WHERE ${where.join(' AND ')}`;
    if (body.order) {
      text += ` ORDER BY "${body.order.col}" ${body.order.ascending === false ? 'DESC' : 'ASC'}`;
    }
    const limit = Number(body.limit);
    if (Number.isFinite(limit) && limit > 0) {
      text += ` LIMIT ${Math.min(Math.floor(limit), 5000)}`;
    }

    let count: number | null = null;
    if (body.count === 'exact') {
      const countText = `SELECT COUNT(*)::int AS count FROM ${quoted}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`;
      const counted = await db.query(countText, values);
      count = Number((counted[0] as { count?: number } | undefined)?.count || 0);
      if (body.head) return { data: null, count, error: null };
    }

    const rows = await db.query(text, values);
    if (body.single || body.maybeSingle) {
      const first = rows[0] || null;
      if (body.single && !first) return { data: null, count, error: { message: 'No rows' } };
      return { data: first, count, error: null };
    }
    return { data: rows, count, error: null };
  }

  if (body.op === 'insert') {
    const rows = Array.isArray(body.data) ? body.data : body.data ? [body.data] : [];
    if (!rows.length) return { data: null, error: { message: 'Nothing to insert' } };
    const inserted = [];
    for (const item of rows) {
      const cols = Object.keys(item).filter((key) => colOk(table, key));
      if (!cols.length) return { data: null, error: { message: 'No valid columns' } };
      const values = cols.map((col) => encodeValue(col, item[col]));
      const marks = cols.map((col, i) => (JSON_COLUMNS.has(col) ? `$${i + 1}::jsonb` : `$${i + 1}`));
      const returning = body.select && body.select !== '*' ? selectCols(table, body.select) : '*';
      const result = await db.query(
        `INSERT INTO ${quoted} (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${marks.join(',')}) RETURNING ${returning}`,
        values
      );
      inserted.push(result[0]);
    }
    if (body.single || rows.length === 1) return { data: inserted[0], error: null };
    return { data: inserted, error: null };
  }

  if (body.op === 'update') {
    if (!row) return { data: null, error: { message: 'Nothing to update' } };
    const cols = Object.keys(row).filter((key) => colOk(table, key) && key !== 'id');
    if (!cols.length) return { data: [], error: null };
    const values: unknown[] = [];
    const sets = cols.map((col) => {
      values.push(encodeValue(col, row[col]));
      return JSON_COLUMNS.has(col) ? `"${col}" = $${values.length}::jsonb` : `"${col}" = $${values.length}`;
    });
    const where: string[] = [];
    filters.forEach((filter) => {
      if (filter.type === 'eq') {
        values.push(filter.val);
        where.push(`"${filter.col}" = $${values.length}`);
      }
    });
    if (!where.length) return { data: null, error: { message: 'Update without filter' } };
    const returning = body.select ? selectCols(table, body.select) : '*';
    const result = await db.query(
      `UPDATE ${quoted} SET ${sets.join(', ')} WHERE ${where.join(' AND ')} RETURNING ${returning}`,
      values
    );
    return { data: result, error: null };
  }

  if (body.op === 'delete') {
    const values: unknown[] = [];
    const where: string[] = [];
    filters.forEach((filter) => {
      if (filter.type === 'eq') {
        values.push(filter.val);
        where.push(`"${filter.col}" = $${values.length}`);
      }
    });
    if (!where.length) return { data: null, error: { message: 'Delete without filter' } };
    await db.query(`DELETE FROM ${quoted} WHERE ${where.join(' AND ')}`, values);
    return { data: null, error: null };
  }

  return { data: null, error: { message: 'Unknown op' } };
}
