export type QuestionType = 'single-choice' | 'multiple-choice' | 'scale' | 'text' | 'yes-no';
export type SupportedLng = 'en' | 'ru' | 'fr' | 'es';

export type Localized = string | Partial<Record<SupportedLng, string>>;
export type LocalizedList = string[] | Partial<Record<SupportedLng, string[]>>;

export type SurveyQuestionSpec = {
  text: Localized;
  type?: QuestionType | string;
  required?: boolean;
  hasOtherOption?: boolean;
  options?: LocalizedList;
  scaleMin?: Localized;
  scaleMax?: Localized;
};

export type SurveySectionSpec = {
  name: Localized;
  description?: Localized;
  questions: SurveyQuestionSpec[];
};

export type SurveySpec = {
  title: Localized;
  description?: Localized;
  estimatedTime?: number;
  baseLanguage?: SupportedLng;
  translate?: boolean;
  sections?: SurveySectionSpec[];
  questions?: SurveyQuestionSpec[];
};

export const EXAMPLE_SURVEY_JSON = `{
  "title": "Campus library research survey",
  "description": "A short study of how students use the library. Answers are anonymous.",
  "estimatedTime": 6,
  "baseLanguage": "en",
  "translate": true,
  "sections": [
    {
      "name": "About you",
      "description": "A few facts so we can group answers.",
      "questions": [
        {
          "text": "What is your year of study?",
          "type": "single-choice",
          "required": true,
          "options": ["First year", "Second year", "Third year", "Fourth year", "Graduate"]
        },
        {
          "text": "How often do you visit the library?",
          "type": "single-choice",
          "required": true,
          "options": ["Daily", "Weekly", "Monthly", "Rarely", "Never"]
        }
      ]
    },
    {
      "name": "Experience",
      "questions": [
        {
          "text": "Which of these matter most to you?",
          "type": "multiple-choice",
          "required": true,
          "hasOtherOption": true,
          "options": ["Quiet space", "Opening hours", "Computers", "Staff help"]
        },
        {
          "text": "How easy is it to find a seat?",
          "type": "scale",
          "required": true,
          "scaleMin": "Very hard",
          "scaleMax": "Very easy"
        },
        {
          "text": "Would you recommend the library to a friend?",
          "type": "yes-no",
          "required": true
        },
        {
          "text": "Anything else we should know?",
          "type": "text",
          "required": false
        }
      ]
    }
  ]
}
`;

export const EXAMPLE_SURVEY_MD = `# Campus library research survey

A short study of how students use the library. Answers are anonymous.

~ 6 minutes

## About you
A few facts so we can group answers.

- [required] What is your year of study? (single)
  - First year
  - Second year
  - Third year
  - Fourth year
  - Graduate
- [required] How often do you visit the library? (single)
  - Daily
  - Weekly
  - Monthly
  - Rarely
  - Never

## Experience

- [required] Which of these matter most to you? (multiple)
  - Quiet space
  - Opening hours
  - Computers
  - Staff help
- [required] How easy is it to find a seat? (scale)
  min: Very hard
  max: Very easy
- [required] Would you recommend the library to a friend? (yes-no)
- [optional] Anything else we should know? (text)
`;

export const AI_SURVEY_PROMPT = `You are helping me build a research survey for a university web app.

Write the full survey as ONE JSON file. Do not wrap it in markdown fences. Do not add commentary.

Rules:
- Put related questions into sections.
- Mark each question required: true or required: false. Use required only when the answer is essential.
- Use exactly these types: "single-choice", "multiple-choice", "scale", "text", "yes-no".
- single-choice and multiple-choice MUST have an "options" array of short answers.
- Set hasOtherOption: true only when "Other, please specify" is useful.
- For scale questions, add scaleMin (meaning of 1) and scaleMax (meaning of 5).
- Keep wording plain, one idea per question, no leading numbers like "1.".
- Write the survey in the source language I specify. Set "baseLanguage" to en, ru, fr, or es.
- Set "translate": true so the app can fill the other three languages after upload.
- estimatedTime is minutes, integer.

JSON shape:
{
  "title": "...",
  "description": "...",
  "estimatedTime": 6,
  "baseLanguage": "en",
  "translate": true,
  "sections": [
    {
      "name": "...",
      "description": "...",
      "questions": [
        {
          "text": "...",
          "type": "single-choice",
          "required": true,
          "hasOtherOption": false,
          "options": ["...", "..."]
        }
      ]
    }
  ]
}

Topic / audience / what I need to learn:
`;

const LANGS: SupportedLng[] = ['en', 'ru', 'fr', 'es'];

function stripFences(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json|markdown|md)?\s*([\s\S]*?)```$/i);
  return (fenced ? fenced[1] : trimmed).trim();
}

function relaxJson(text: string) {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1');
}

function extractBalancedObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function collectJsonCandidates(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (value: string | null) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };
  for (const fence of raw.matchAll(/```(?:json|jsonc)?\s*([\s\S]*?)```/gi)) {
    const inner = fence[1].trim();
    add(inner.startsWith('{') ? inner : extractBalancedObject(inner));
  }
  add(extractBalancedObject(raw));
  return out;
}

function parseRelaxedJson(candidate: string): unknown | null {
  const attempts = [
    relaxJson(candidate),
    relaxJson(candidate.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null')),
  ];
  for (const text of attempts) {
    try {
      return JSON.parse(text);
    } catch {
      continue;
    }
  }
  return null;
}

function questionCount(value: unknown): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  const data = value as Record<string, unknown>;
  const fromSections = Array.isArray(data.sections)
    ? data.sections.reduce((n, section) => {
        const questions = (section as { questions?: unknown })?.questions;
        return n + (Array.isArray(questions) ? questions.length : 0);
      }, 0)
    : 0;
  const fromQuestions = Array.isArray(data.questions) ? data.questions.length : 0;
  return fromSections + fromQuestions;
}

function unwrapSurvey(value: unknown): unknown | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (questionCount(value) > 0) return value;
  const data = value as Record<string, unknown>;
  for (const key of ['survey', 'data', 'result', 'payload', 'content']) {
    if (questionCount(data[key]) > 0) return data[key];
  }
  const nested = Object.values(data).filter((item) => questionCount(item) > 0);
  return nested.length === 1 ? nested[0] : null;
}

function tryParseJson(raw: string): unknown | null {
  const parsed: unknown[] = [];
  for (const candidate of collectJsonCandidates(raw)) {
    const unwrapped = unwrapSurvey(parseRelaxedJson(candidate));
    if (unwrapped) parsed.push(unwrapped);
  }
  if (parsed.length === 0) return null;
  parsed.sort((a, b) => questionCount(b) - questionCount(a));
  return parsed[0];
}

function normalizeType(value?: string): QuestionType {
  const raw = (value || '').toLowerCase().trim();
  if (['multiple', 'multiple-choice', 'multi', 'checkbox', 'checkboxes'].includes(raw)) return 'multiple-choice';
  if (['text', 'open', 'open-ended', 'textarea', 'long-text'].includes(raw)) return 'text';
  if (['scale', 'likert', 'rating', '1-5'].includes(raw)) return 'scale';
  if (['yes-no', 'yesno', 'boolean', 'yn'].includes(raw)) return 'yes-no';
  return 'single-choice';
}

function asText(value: Localized | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  return (value.en || value.ru || value.fr || value.es || '').trim();
}

function inferBaseLanguage(spec: SurveySpec): SupportedLng {
  if (spec.baseLanguage && LANGS.includes(spec.baseLanguage)) return spec.baseLanguage;
  const sample = [asText(spec.title), asText(spec.description)].join(' ');
  return /[А-Яа-яЁё]/.test(sample) ? 'ru' : 'en';
}

function flattenQuestions(spec: SurveySpec): number {
  const fromSections = (spec.sections || []).reduce((n, s) => n + (s.questions?.length || 0), 0);
  return fromSections + (spec.questions?.length || 0);
}

export function parseSurveyFile(raw: string, filename = 'survey.json'): SurveySpec {
  const text = stripFences(raw);
  if (!text) throw new Error('The file is empty.');

  const preferMarkdown = /\.(md|markdown)$/i.test(filename);
  const fromJson = () => {
    const parsed = tryParseJson(raw) ?? tryParseJson(text);
    return parsed ? normalizeSpec(parsed) : null;
  };

  if (!preferMarkdown) {
    const spec = fromJson();
    if (spec) return spec;
  }

  try {
    return parseMarkdownSurvey(text);
  } catch (markdownError) {
    if (preferMarkdown) {
      const spec = fromJson();
      if (spec) return spec;
    }
    const fromMarkdown = markdownError instanceof Error ? markdownError.message : '';
    throw new Error(
      'Could not find a valid survey JSON in this text. Paste the whole ChatGPT reply — the { } block is enough, extra words around it are fine.' +
        (fromMarkdown ? ` (${fromMarkdown})` : '')
    );
  }
}

function normalizeSpec(input: unknown): SurveySpec {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('The file must be a JSON object with title and questions or sections.');
  }
  const data = input as Record<string, any>;
  const spec: SurveySpec = {
    title: data.title || data.name || 'Untitled survey',
    description: data.description || '',
    estimatedTime: Number(data.estimatedTime ?? data.estimated_time ?? 5) || 5,
    baseLanguage: data.baseLanguage || data.base_language,
    translate: data.translate !== false,
    sections: Array.isArray(data.sections) ? data.sections.map(normalizeSection) : [],
    questions: Array.isArray(data.questions) ? data.questions.map(normalizeQuestion) : [],
  };
  if (flattenQuestions(spec) === 0) {
    throw new Error('No questions found. Add a sections array or a questions array.');
  }
  spec.baseLanguage = inferBaseLanguage(spec);
  return spec;
}

function normalizeSection(input: any): SurveySectionSpec {
  return {
    name: input?.name || input?.title || 'Section',
    description: input?.description || '',
    questions: Array.isArray(input?.questions) ? input.questions.map(normalizeQuestion) : [],
  };
}

function normalizeQuestion(input: any): SurveyQuestionSpec {
  const required = input?.required ?? input?.isRequired ?? input?.is_required;
  return {
    text: input?.text || input?.question || '',
    type: normalizeType(input?.type),
    required: required === false || required === 'optional' ? false : Boolean(required ?? true),
    hasOtherOption: Boolean(input?.hasOtherOption ?? input?.has_other_option),
    options: input?.options || input?.choices || [],
    scaleMin: input?.scaleMin || input?.scale_min || input?.minLabel,
    scaleMax: input?.scaleMax || input?.scale_max || input?.maxLabel,
  };
}

function parseMarkdownSurvey(source: string): SurveySpec {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const spec: SurveySpec = {
    title: 'Untitled survey',
    description: '',
    estimatedTime: 5,
    translate: true,
    sections: [],
    questions: [],
  };

  let descriptionLines: string[] = [];
  let currentSection: SurveySectionSpec | null = null;
  let currentQuestion: SurveyQuestionSpec | null = null;
  let seenTitle = false;

  const questionBucket = () => {
    if (currentSection) return currentSection.questions;
    spec.questions = spec.questions || [];
    return spec.questions;
  };

  const commitQuestion = () => {
    if (!currentQuestion) return;
    if (!asText(currentQuestion.text)) {
      currentQuestion = null;
      return;
    }
    const type = normalizeType(currentQuestion.type);
    currentQuestion.type = type;
    if ((type === 'single-choice' || type === 'multiple-choice') && !optionCount(currentQuestion.options)) {
      currentQuestion.options = ['Option 1', 'Option 2'];
    }
    questionBucket().push(currentQuestion);
    currentQuestion = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) continue;

    const time = trimmed.match(/^~\s*(\d+)\s*(min|mins|minutes)?/i);
    if (time) {
      spec.estimatedTime = Number(time[1]) || spec.estimatedTime;
      continue;
    }

    if (trimmed.startsWith('# ') && !trimmed.startsWith('##')) {
      spec.title = trimmed.slice(2).trim();
      seenTitle = true;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      commitQuestion();
      currentSection = {
        name: trimmed.slice(3).trim() || 'Section',
        description: '',
        questions: [],
      };
      spec.sections = spec.sections || [];
      spec.sections.push(currentSection);
      continue;
    }

    const questionMatch = trimmed.match(
      /^[-*]\s+\[(required|optional|req|opt)\]\s+(.+?)(?:\s*\((single-choice|multiple-choice|single|multiple|multi|text|scale|yes-no|yesno)\))?\s*$/i
    );
    if (questionMatch) {
      commitQuestion();
      const flag = questionMatch[1].toLowerCase();
      const rest = questionMatch[2].trim();
      currentQuestion = {
        text: rest,
        type: questionMatch[3] ? normalizeType(questionMatch[3]) : undefined,
        required: flag === 'required' || flag === 'req',
        options: [],
      };
      continue;
    }

    const optionMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (currentQuestion && optionMatch && !trimmed.match(/^\[(required|optional)/i)) {
      const optionText = optionMatch[1].trim();
      const min = optionText.match(/^min:\s*(.+)/i);
      const max = optionText.match(/^max:\s*(.+)/i);
      if (min) {
        currentQuestion.scaleMin = min[1].trim();
        currentQuestion.type = currentQuestion.type || 'scale';
        continue;
      }
      if (max) {
        currentQuestion.scaleMax = max[1].trim();
        currentQuestion.type = currentQuestion.type || 'scale';
        continue;
      }
      const list = Array.isArray(currentQuestion.options) ? currentQuestion.options : [];
      list.push(optionText);
      currentQuestion.options = list;
      if (!currentQuestion.type) currentQuestion.type = 'single-choice';
      continue;
    }

    const minLine = trimmed.match(/^min:\s*(.+)/i);
    const maxLine = trimmed.match(/^max:\s*(.+)/i);
    if (currentQuestion && minLine) {
      currentQuestion.scaleMin = minLine[1].trim();
      currentQuestion.type = 'scale';
      continue;
    }
    if (currentQuestion && maxLine) {
      currentQuestion.scaleMax = maxLine[1].trim();
      currentQuestion.type = 'scale';
      continue;
    }

    if (currentSection && !currentSection.questions.length && !currentQuestion) {
      currentSection.description = [currentSection.description, trimmed].filter(Boolean).join('\n');
      continue;
    }

    if (!seenTitle) {
      spec.title = trimmed;
      seenTitle = true;
      continue;
    }

    if (!currentSection && !currentQuestion) {
      descriptionLines.push(trimmed.replace(/^>\s?/, ''));
    }
  }

  commitQuestion();
  if (descriptionLines.length) spec.description = descriptionLines.join('\n');
  spec.baseLanguage = inferBaseLanguage(spec);
  if (flattenQuestions(spec) === 0) {
    throw new Error('No questions found. Use lines like: - [required] Your question? (single)');
  }
  return spec;
}

function optionCount(options?: LocalizedList) {
  if (!options) return 0;
  if (Array.isArray(options)) return options.length;
  return Math.max(...LANGS.map((lng) => options[lng]?.length || 0), 0);
}

export function localizedString(value: Localized | undefined, lang: SupportedLng): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return (value[lang] || value.en || value.ru || value.fr || value.es || '').trim();
}

export function localizedOptions(value: LocalizedList | undefined, lang: SupportedLng): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item));
  return (value[lang] || value.en || value.ru || value.fr || value.es || []).map((item) => String(item));
}

export function hasFullLocalization(value: Localized | undefined): value is Partial<Record<SupportedLng, string>> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && (value.en || value.ru || value.fr || value.es));
}

export { flattenQuestions };
