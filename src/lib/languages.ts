import { LANGUAGES, isLng, type Lng } from './cn';

export type { Lng };
export { LANGUAGES, isLng };

export type LanguageOption = { code: string; name: string; short: string };

export const CONTENT_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', short: 'EN' },
  { code: 'ru', name: 'Русский', short: 'RU' },
  { code: 'fr', name: 'Français', short: 'FR' },
  { code: 'es', name: 'Español', short: 'ES' },
  { code: 'de', name: 'Deutsch', short: 'DE' },
  { code: 'it', name: 'Italiano', short: 'IT' },
  { code: 'pt', name: 'Português', short: 'PT' },
  { code: 'uk', name: 'Українська', short: 'UK' },
  { code: 'pl', name: 'Polski', short: 'PL' },
  { code: 'nl', name: 'Nederlands', short: 'NL' },
  { code: 'zh', name: '中文', short: 'ZH' },
  { code: 'ja', name: '日本語', short: 'JA' },
  { code: 'ko', name: '한국어', short: 'KO' },
  { code: 'ar', name: 'العربية', short: 'AR' },
  { code: 'tr', name: 'Türkçe', short: 'TR' },
  { code: 'sv', name: 'Svenska', short: 'SV' },
  { code: 'cs', name: 'Čeština', short: 'CS' },
  { code: 'el', name: 'Ελληνικά', short: 'EL' },
  { code: 'he', name: 'עברית', short: 'HE' },
  { code: 'hi', name: 'हिन्दी', short: 'HI' },
  { code: 'vi', name: 'Tiếng Việt', short: 'VI' },
  { code: 'id', name: 'Bahasa Indonesia', short: 'ID' },
  { code: 'th', name: 'ไทย', short: 'TH' },
  { code: 'fi', name: 'Suomi', short: 'FI' },
  { code: 'no', name: 'Norsk', short: 'NO' },
  { code: 'da', name: 'Dansk', short: 'DA' },
  { code: 'ro', name: 'Română', short: 'RO' },
  { code: 'hu', name: 'Magyar', short: 'HU' },
  { code: 'bg', name: 'Български', short: 'BG' },
];

const BY_CODE = new Map(CONTENT_LANGUAGES.map((lang) => [lang.code, lang]));

export const CHROME_UI: Record<
  Lng,
  {
    skipToContent: string;
    brand: string;
    language: string;
    openMenu: string;
    hideSidebar: string;
    openSidebar: string;
    closeMenu: string;
    surveyClosedTitle: string;
    surveyClosedBody: string;
    back: string;
  }
> = {
  en: {
    skipToContent: 'Skip to content',
    brand: 'fromSurvey',
    language: 'Language',
    openMenu: 'Open menu',
    hideSidebar: 'Hide sidebar',
    openSidebar: 'Open sidebar',
    closeMenu: 'Close menu',
    surveyClosedTitle: 'Survey closed',
    surveyClosedBody:
      'This survey is not accepting responses right now. If you think that is a mistake, contact the person who sent you the link.',
    back: 'Back',
  },
  ru: {
    skipToContent: 'К содержанию',
    brand: 'fromSurvey',
    language: 'Язык',
    openMenu: 'Открыть меню',
    hideSidebar: 'Скрыть меню',
    openSidebar: 'Открыть меню',
    closeMenu: 'Закрыть меню',
    surveyClosedTitle: 'Опрос закрыт',
    surveyClosedBody:
      'Сейчас этот опрос не принимает ответы. Если это ошибка, напишите тому, кто прислал ссылку.',
    back: 'Назад',
  },
  fr: {
    skipToContent: 'Aller au contenu',
    brand: 'fromSurvey',
    language: 'Langue',
    openMenu: 'Ouvrir le menu',
    hideSidebar: 'Masquer le menu',
    openSidebar: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    surveyClosedTitle: 'Enquête fermée',
    surveyClosedBody:
      'Cette enquête n’accepte plus de réponses pour le moment. Si cela vous semble une erreur, contactez la personne qui vous a envoyé le lien.',
    back: 'Retour',
  },
  es: {
    skipToContent: 'Saltar al contenido',
    brand: 'fromSurvey',
    language: 'Idioma',
    openMenu: 'Abrir menú',
    hideSidebar: 'Ocultar menú',
    openSidebar: 'Abrir menú',
    closeMenu: 'Cerrar menú',
    surveyClosedTitle: 'Encuesta cerrada',
    surveyClosedBody:
      'Esta encuesta no acepta respuestas ahora. Si cree que es un error, contacte a quien le envió el enlace.',
    back: 'Volver',
  },
};

export function normalizeLang(value: string | null | undefined): string {
  const code = String(value || '')
    .trim()
    .split(/[-_]/)[0]
    .toLowerCase();
  return /^[a-z]{2}$/.test(code) ? code : '';
}

export function languageOption(code: string): LanguageOption {
  const normalized = normalizeLang(code) || 'en';
  return (
    BY_CODE.get(normalized) || {
      code: normalized,
      name: normalized.toUpperCase(),
      short: normalized.toUpperCase(),
    }
  );
}

export function languageLabel(code: string) {
  return languageOption(code).name;
}

export function chromeLng(code: string | null | undefined): Lng {
  const normalized = normalizeLang(code);
  return isLng(normalized) ? normalized : 'en';
}

export function browserLanguage(): string {
  if (typeof navigator === 'undefined') return 'en';
  const list = navigator.languages?.length ? [...navigator.languages] : [navigator.language];
  for (const raw of list) {
    const code = normalizeLang(raw);
    if (code) return code;
  }
  return 'en';
}

export function browserUiLanguage(): Lng {
  const code = browserLanguage();
  return isLng(code) ? code : 'en';
}

export function preferredUiLanguage(): Lng {
  try {
    const saved = localStorage.getItem('ui_lng');
    if (isLng(saved)) return saved;
  } catch {
    /* private mode */
  }
  return browserUiLanguage();
}

export function applyDocumentLanguage(code: string | null | undefined) {
  if (typeof document === 'undefined') return;
  const normalized = normalizeLang(code) || 'en';
  document.documentElement.lang = normalized;
  document.title = CHROME_UI[chromeLng(normalized)].brand;
}

export function uniqueLanguages(codes: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const code of codes) {
    const normalized = normalizeLang(code);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  const rank = (code: string) => {
    const index = CONTENT_LANGUAGES.findIndex((lang) => lang.code === code);
    return index >= 0 ? index : CONTENT_LANGUAGES.length + out.indexOf(code);
  };
  return out.sort((a, b) => rank(a) - rank(b));
}

function looksTranslated(value: unknown) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((item) => String(item ?? '').trim());
  return false;
}

export function languagesFromMaps(...sources: unknown[]): string[] {
  const found: string[] = [];
  for (const source of sources) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      if (looksTranslated(value)) found.push(key);
    }
  }
  return uniqueLanguages(found);
}

export function parseLocalizedJson(raw: unknown): Record<string, string> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, string>;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, string>;
    } catch {
      return null;
    }
  }
  return null;
}

export function pickLocalizedText(
  source: unknown,
  language: string,
  fallback = ''
): string {
  if (!source) return fallback;
  if (typeof source === 'string') {
    const parsed = parseLocalizedJson(source);
    if (parsed) return pickLocalizedText(parsed, language, fallback);
    return source.trim() || fallback;
  }
  if (typeof source !== 'object' || Array.isArray(source)) return fallback;
  const map = source as Record<string, unknown>;
  const code = normalizeLang(language);
  const candidates = [code, chromeLng(code), 'en', 'ru', 'fr', 'es', ...Object.keys(map)];
  for (const key of candidates) {
    const value = map[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
}

export function initialSurveyLanguage(explicit?: string | null, persisted?: string | null): string {
  return normalizeLang(explicit) || normalizeLang(persisted) || browserUiLanguage();
}

export function toggleLanguagesForSurvey(uiLanguage: string, contentLanguages: string[]): LanguageOption[] {
  const codes = uniqueLanguages([uiLanguage, ...contentLanguages]);
  return codes.map(languageOption);
}
