export type QuestionRow = {
  id: string;
  survey_id?: string;
  text?: string;
  type?: string;
  sort_order?: number;
  payload?: any;
  options?: unknown;
  has_other_option?: boolean;
  required?: boolean;
  section_id?: string | null;
};

export type ResponseRow = {
  id: string;
  survey_id: string;
  created_at: string;
  answers?: unknown;
  completed?: boolean | null;
  status?: string | null;
  opted_in?: boolean | null;
  respondent_email?: string | null;
  email?: string | null;
  language?: string | null;
  duration_seconds?: number | null;
};

export function parseAnswers(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

export function isResponseCompleted(r: Pick<ResponseRow, 'completed' | 'status' | 'answers'>): boolean {
  if (r.completed === true) return true;
  if (String(r.status || '').toLowerCase() === 'completed') return true;
  if (r.completed === false) return false;
  const answers = parseAnswers(r.answers);
  return Object.keys(answers).some((key) => !key.endsWith('_other') && answers[key] != null && answers[key] !== '');
}

export function questionType(q: QuestionRow): string {
  return String(q.type || q.payload?.type || 'single-choice');
}

export function questionLabel(q: QuestionRow, lng = 'en'): string {
  const payload = q.payload || {};
  const text = payload.text;
  if (text && typeof text === 'object' && !Array.isArray(text)) {
    return String(text[lng] || text.en || text[payload.baseLanguage] || q.text || q.id).trim();
  }
  if (typeof text === 'string' && text.trim()) return text.trim();
  return String(q.text || q.id).trim();
}

export function formatAnswerValue(value: unknown): string {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.map(formatAnswerValue).filter(Boolean).join(', ');
  if (typeof value === 'object') return Object.values(value as object).map(formatAnswerValue).filter(Boolean).join(', ');
  return String(value);
}

function optionLists(q: QuestionRow): string[][] {
  const payload = q.payload || {};
  const fromPayload = payload.options;
  const lists: string[][] = [];
  if (fromPayload && typeof fromPayload === 'object' && !Array.isArray(fromPayload)) {
    for (const arr of Object.values(fromPayload)) {
      if (Array.isArray(arr)) lists.push(arr.map(String));
    }
  } else if (Array.isArray(fromPayload)) {
    lists.push(fromPayload.map(String));
  }
  const column = q.options;
  if (Array.isArray(column)) lists.push(column.map(String));
  else if (typeof column === 'string') {
    try {
      const parsed = JSON.parse(column);
      if (Array.isArray(parsed)) lists.push(parsed.map(String));
    } catch {
      /* ignore */
    }
  }
  return lists;
}

export function questionOptions(q: QuestionRow, lng = 'en'): string[] {
  const payload = q.payload || {};
  const options = payload.options;
  if (options && typeof options === 'object' && !Array.isArray(options)) {
    const localized = options[lng] || options.en || options[payload.baseLanguage];
    if (Array.isArray(localized) && localized.length) return localized.map(String);
  }
  const lists = optionLists(q);
  return lists[0] || [];
}

export function canonicalAnswers(value: unknown, q: QuestionRow): string[] {
  const raw = Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
  const lists = optionLists(q);
  const base = lists[0] || [];
  return raw
    .filter((item) => item != null && item !== '')
    .map((item) => {
      const text = String(item);
      for (const list of lists) {
        const index = list.indexOf(text);
        if (index >= 0 && base[index]) return String(base[index]);
      }
      const yes = new Set(['Yes', 'Да', 'Oui', 'Sí', 'true', 'True']);
      const no = new Set(['No', 'Нет', 'Non', 'false', 'False']);
      if (yes.has(text)) return 'Yes';
      if (no.has(text)) return 'No';
      return text;
    });
}

export function answerRowsForResponse(questions: QuestionRow[], answersRaw: unknown, lng = 'en') {
  const answers = parseAnswers(answersRaw);
  const sorted = [...questions].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const known = new Set(sorted.map((q) => q.id));
  const rows = sorted.map((q, i) => {
    const other = formatAnswerValue(answers[`${q.id}_other`]);
    const raw = answers[q.id];
    const skipped = raw === undefined || raw === null || (Array.isArray(raw) && raw.length === 0);
    const main = formatAnswerValue(raw);
    return {
      id: q.id,
      index: i + 1,
      label: questionLabel(q, lng),
      type: questionType(q),
      answer: skipped ? '' : other ? `${main}${main ? ' — ' : ''}${other}` : main,
      skipped,
    };
  });
  const extras = Object.keys(answers).filter((key) => !known.has(key) && !key.endsWith('_other'));
  extras.forEach((key) => {
    rows.push({
      id: key,
      index: rows.length + 1,
      label: key,
      type: 'text',
      answer: formatAnswerValue(answers[key]),
      skipped: false,
    });
  });
  return rows;
}

export function filterByDateRange<T extends { created_at: string }>(rows: T[], range: string): T[] {
  if (!range || range === 'all') return rows;
  const now = new Date();
  const start = new Date(now);
  if (range === 'today') start.setHours(0, 0, 0, 0);
  else if (range === 'week') start.setDate(now.getDate() - 7);
  else if (range === 'month') start.setDate(now.getDate() - 30);
  else return rows;
  return rows.filter((row) => new Date(row.created_at) >= start);
}

export function formatDuration(seconds?: number | null, empty = '—'): string {
  if (!seconds || seconds <= 0) return empty;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  if (minutes <= 0) return `${rest}s`;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

export function languageName(code?: string | null): string {
  const names: Record<string, string> = { en: 'English', ru: 'Русский', fr: 'Français', es: 'Español' };
  if (!code) return '—';
  return names[code] || code;
}
