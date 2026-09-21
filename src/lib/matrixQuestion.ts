export const DEFAULT_MATRIX_COLUMNS: Record<string, string[]> = {
  en: ['Not difficult', 'Somewhat', 'Very difficult', 'Not applicable'],
  ru: ['Несложно', 'Скорее сложно', 'Очень сложно', 'Не применимо'],
  fr: ['Pas difficile', 'Assez difficile', 'Très difficile', 'Sans objet'],
  es: ['Nada difícil', 'Algo difícil', 'Muy difícil', 'No aplica'],
};

export const DEFAULT_MATRIX_ROWS: Record<string, string[]> = {
  en: ['Item 1', 'Item 2'],
  ru: ['Пункт 1', 'Пункт 2'],
  fr: ['Élément 1', 'Élément 2'],
  es: ['Ítem 1', 'Ítem 2'],
};

export function defaultMatrixColumns(lng = 'en') {
  return [...(DEFAULT_MATRIX_COLUMNS[lng] || DEFAULT_MATRIX_COLUMNS.en)];
}

export function defaultMatrixRows(lng = 'en') {
  return [...(DEFAULT_MATRIX_ROWS[lng] || DEFAULT_MATRIX_ROWS.en)];
}

export function readLocalizedList(source: unknown, lng = 'en', base?: string): string[] {
  if (!source) return [];
  if (Array.isArray(source)) return source.map((item) => String(item ?? ''));
  if (typeof source === 'object') {
    const map = source as Record<string, unknown>;
    const pick = map[lng] || map.en || (base ? map[base] : undefined) || Object.values(map).find(Array.isArray);
    if (Array.isArray(pick)) return pick.map((item) => String(item ?? ''));
  }
  return [];
}

export function visibleRowIndices(rows: string[]) {
  return rows.map((row, index) => (String(row || '').trim() ? index : -1)).filter((index) => index >= 0);
}

export function selectedColumnIndex(
  value: unknown,
  rowIndex: number,
  columns: string[],
  otherColumnLists: string[][] = []
): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = (value as Record<string, unknown>)[String(rowIndex)];
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < columns.length) return raw;
  const asNum = Number(raw);
  if (Number.isInteger(asNum) && String(asNum) === String(raw).trim() && asNum >= 0 && asNum < columns.length) {
    return asNum;
  }
  const text = String(raw);
  const direct = columns.indexOf(text);
  if (direct >= 0) return direct;
  for (const list of otherColumnLists) {
    const index = list.indexOf(text);
    if (index >= 0 && index < columns.length) return index;
  }
  return null;
}

export function isMatrixComplete(value: unknown, rows: string[], columns: string[]) {
  const indices = visibleRowIndices(rows);
  if (!indices.length || columns.length < 2) return false;
  return indices.every((index) => selectedColumnIndex(value, index, columns) != null);
}

export function remainingMatrixRows(value: unknown, rows: string[], columns: string[]) {
  const indices = visibleRowIndices(rows);
  return indices.filter((index) => selectedColumnIndex(value, index, columns) == null).length;
}

export function formatMatrixAnswer(value: unknown, rows: string[], columns: string[], otherColumnLists: string[][] = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  return rows
    .map((row, index) => {
      const label = String(row || '').trim();
      if (!label) return '';
      const col = selectedColumnIndex(value, index, columns, otherColumnLists);
      if (col == null) return '';
      return `${label}: ${columns[col] || col}`;
    })
    .filter(Boolean)
    .join('; ');
}
