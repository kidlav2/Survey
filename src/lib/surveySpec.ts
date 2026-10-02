import { languageLabel, normalizeLang, uniqueLanguages } from './languages';

export type QuestionType = 'single-choice' | 'multiple-choice' | 'scale' | 'text' | 'yes-no' | 'matrix';
export type SupportedLng = string;

export type Localized = string | Record<string, string>;
export type LocalizedList = string[] | Record<string, string[]>;

export type SurveyQuestionSpec = {
  text: Localized;
  type?: QuestionType | string;
  required?: boolean;
  hasOtherOption?: boolean;
  options?: LocalizedList;
  rows?: LocalizedList;
  scaleMin?: Localized;
  scaleMax?: Localized;
  showIfPreviousAnswer?: string[];
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
  baseLanguage?: string;
  languages?: string[];
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
          "text": "How difficult is each of the following for you right now?",
          "type": "matrix",
          "required": true,
          "options": ["Not difficult", "Somewhat", "Very difficult", "Not applicable"],
          "rows": [
            "Finding a quiet place to work",
            "Getting help from staff",
            "Accessing online resources"
          ]
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
- [required] How difficult is each of the following for you right now? (matrix)
  scale: Not difficult | Somewhat | Very difficult | Not applicable
  - Finding a quiet place to work
  - Getting help from staff
  - Accessing online resources
- [optional] Anything else we should know? (text)
`;

export function buildAiSurveyPrompt(opts: { sourceLanguage: string; extraLanguages?: string[] }): string {
  const source = normalizeLang(opts.sourceLanguage) || 'en';
  const extra = uniqueLanguages(opts.extraLanguages || []).filter((code) => code !== source);
  const sourceName = languageLabel(source);
  const extraList = extra.map((code) => `${languageLabel(code)} (${code})`).join(', ');
  const translate = extra.length > 0;
  const languageRules = translate
    ? `- Write the entire survey in ${sourceName} only. Set "baseLanguage" to "${source}".\n- Set "translate": true. After upload the app will add these languages: ${extraList}. Do not write those languages yourself.\n- The app translates every string separately by machine. Write short, literal text: no idioms, no slang, and the same word for the same thing everywhere.`
    : `- Write the entire survey in ${sourceName} only. Set "baseLanguage" to "${source}".\n- Set "translate": false. Do not add other languages. This survey is only for ${sourceName}.`;

  return `You are a senior survey methodologist. Design a professional survey for the brief at the end of this message.

Write the full survey as ONE JSON file. Do not wrap it in markdown fences. Do not add commentary.
The survey must be ready to send as it is: no placeholders, no notes to me.
If the brief does not say what the survey is for or who will answer it, ask me up to 5 short questions in one message, in the language of my brief, and wait. Otherwise ask nothing: make sensible assumptions and write the JSON.

How the app shows the survey:
- One question per screen, usually on a phone. Every question must make sense on its own. Never write "as above", "the previous question" or "if yes".
- A question has no help text. Everything the respondent needs must be in the question and its options.
- Respondents see the section name above each question. They never see the section description: it is a note for the survey owner.
- A question with required: true cannot be passed without an answer. Only a question with required: false shows a Skip button.
- The welcome screen shows the title, the description, the estimated time and the app's own privacy note.
- After the last question the app has its own optional contact step. Do not ask for a name, email or phone number unless the brief says so.

Plan first (do not output the plan):
- List what the brief needs to learn. Every question must serve one of these needs. Cut questions that are only interesting, and never ask the same thing twice.
- Do not ask what the brief says is already known.
- Fit the time limit in the brief. If there is none, stay under 10 minutes. Count every question, follow-ups included: 20 seconds per choice question, 10 per yes-no or scale question, 10 per matrix row, 60 per text question, 20 for the optional closing question. Add 50% when the audience is not used to online forms. If the total is over the limit, cut the least important questions. Set estimatedTime to the total in minutes, rounded up.

Order:
- Start with easy factual questions and go from general to specific.
- One topic per section, about 3 to 7 questions each. Never make a section for a single question, unless that question is a matrix: put it into a related section. Section names are 1 to 4 words.
- Put sensitive and personal questions near the end.
- Finish with one optional text question that invites anything else.

Wording:
- Use the words the audience uses. No jargon, no abbreviations.
- Keep each question to one short sentence.
- One idea per question. If a question joins two things with "and" or "or", split it.
- Stay neutral: no leading or loaded wording, no double negatives.
- Ask about facts and what people actually did before asking for opinions. Ask about plans only when the brief needs them.
- Name the time frame ("in the last 12 months") instead of "recently" or "usually".
- No leading numbers like "1.".

Answer options:
- single-choice and multiple-choice MUST have an "options" array of short answers, parallel in form, in a logical order.
- Options cover every realistic answer, including "None of these" when that can happen. Aim for 3 to 7 options before the opt-out.
- single-choice options must not overlap in meaning. Number ranges cover every possible value, with no gaps, no overlaps and open ends: "Under 18", "18–34", "35–54", "55 or older".
- Use multiple-choice when more than one answer can be true.
- Rating labels are symmetric: the same number of negative and positive steps, for example "Very bad", "Bad", "Good", "Very good".
- Name brands, products or services only when you are sure they fit the audience. If you are not sure, list fewer and set hasOtherOption: true.
- Set hasOtherOption: true only when the list cannot be complete. The app then adds "Other, please specify" with a text box, so never write an option that means other yourself ("Other", "Other services", "Something else").

Opt-outs instead of skipping:
- Nobody is forced to guess and nobody skips silently: a question with answer options is passed by choosing an opt-out, not by a Skip button.
- Every single-choice, multiple-choice and matrix question is required: true and ends with one opt-out as its last option or column, written in the survey language. Pick the one that fits: "Don't know" for facts, "Not decided yet" for plans, "Not sure" for opinions, "Not applicable" when the question may not apply to someone, "Prefer not to say" for sensitive topics.
- yes-no and scale have no room for an opt-out. Use them only when every respondent can answer, with required: true. yes-no is for plain facts ("Do you have a car?"). For intentions, interest and opinions ("Would you...?", "Are you interested...?") use single-choice with graded answers and an opt-out.
- text is the only type that may be optional, because it has no options to choose from. Use required: false for it unless the survey is useless without that answer.
- Always write "required" explicitly.

Question types (use exactly these):
- "single-choice", "multiple-choice": see above.
- "yes-no": no options.
- "scale": always 1 to 5. Add scaleMin (meaning of 1) and scaleMax (meaning of 5). 1 is the low or negative end.
- "matrix": use when one stem rates several items on the same scale. The stem is a short question that fits every row, and all rows have the same grammatical form. matrix MUST have "options" (2–7 short column labels, the opt-out included) and "rows" (2–6 items to rate). Order the columns from the low or negative end to the high or positive end, then the opt-out. Prefer 5 columns or fewer: on a phone every row lists all of them. When an item may not apply to someone, use "Not applicable" as the opt-out column instead of asking a filter question first.
- "text": for answers that options cannot cover. Keep these few: typing is slow.

Follow-up logic:
- A question can be shown only to people who gave certain answers to the question right before it. Add "showIfPreviousAnswer": ["answer", ...] to the follow-up question.
- The question right before it must be single-choice or yes-no and sit in the same section. Copy the answers exactly from its options. For a yes-no question use "Yes" or "No".
- Only one follow-up per question. A follow-up may have its own follow-up.
- Use it only when a question makes no sense for part of the respondents. The follow-up still makes sense on its own and follows every rule above.
- Anything more complex (the question depends on a multiple-choice answer, on an earlier question, or needs several follow-ups) cannot use logic. Then write the question so everyone can answer it, with "Not applicable" as the opt-out, or merge both questions into one.
- Never ask a question whose only job is to set up the next one, unless the next one uses showIfPreviousAnswer.

Language:
${languageRules}

Title and description:
- title: short and specific.
- description: 1 to 3 sentences on what the survey is for and how the answers will be used. Never say that answers are anonymous or confidential: the app shows its own privacy note.

Check before you answer:
- The JSON is valid and uses only the fields shown below.
- Every single-choice, multiple-choice and matrix question is required and ends with an opt-out. Only text questions are optional. Every question has "required".
- Every showIfPreviousAnswer value is an exact copy of an option of the question right before it.
- Number ranges have no gaps and no overlaps. Rating labels are symmetric. No option means other.
- The last question is an optional text question. No section holds one lone question, except a matrix.
- The description says nothing about anonymity or confidentiality.
- estimatedTime is an integer number of minutes and fits the limit.
- Read the survey once as a respondent from the audience: no question forces a guess, repeats another one or needs the previous one to make sense.

JSON shape:
{
  "title": "...",
  "description": "...",
  "estimatedTime": 6,
  "baseLanguage": "${source}",
  "translate": ${translate},
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
          "options": ["...", "...", "<opt-out>"]
        },
        {
          "text": "...",
          "type": "multiple-choice",
          "required": true,
          "hasOtherOption": true,
          "showIfPreviousAnswer": ["<an option of the question right before>"],
          "options": ["...", "...", "<opt-out>"]
        },
        {
          "text": "...",
          "type": "matrix",
          "required": true,
          "options": ["...", "...", "...", "<opt-out>"],
          "rows": ["...", "..."]
        },
        {
          "text": "...",
          "type": "scale",
          "required": true,
          "scaleMin": "...",
          "scaleMax": "..."
        },
        { "text": "...", "type": "yes-no", "required": true },
        { "text": "...", "type": "text", "required": false }
      ]
    }
  ]
}

Brief:
Goal (what will you decide with the answers):
Audience (who answers, how well they know the topic):
What I need to learn:
What I already know (do not ask this):
Time limit in minutes:
Topics to avoid:
`;
}

export const AI_SURVEY_PROMPT = buildAiSurveyPrompt({ sourceLanguage: 'en' });

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
  // Valid JSON goes first: the relaxed pass rewrites curly quotes, which breaks text that contains them.
  const attempts = [
    candidate,
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
  if (['matrix', 'grid', 'likert-grid', 'rating-grid', 'likert-matrix'].includes(raw)) return 'matrix';
  return 'single-choice';
}

function asText(value: Localized | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  for (const lang of LANGS) {
    const text = value[lang];
    if (typeof text === 'string' && text.trim()) return text.trim();
  }
  for (const text of Object.values(value)) {
    if (typeof text === 'string' && text.trim()) return text.trim();
  }
  return '';
}

function inferBaseLanguage(spec: SurveySpec): SupportedLng {
  const specified = normalizeLang(spec.baseLanguage);
  if (specified) return specified;
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
  const showIf = input?.showIfPreviousAnswer ?? input?.show_if_previous_answer;
  return {
    text: input?.text || input?.question || '',
    type: normalizeType(input?.type),
    required: required === false || required === 'optional' ? false : Boolean(required ?? true),
    hasOtherOption: Boolean(input?.hasOtherOption ?? input?.has_other_option),
    options: input?.options || input?.choices || input?.columns || [],
    rows: input?.rows || input?.items || input?.statements || [],
    scaleMin: input?.scaleMin || input?.scale_min || input?.minLabel,
    scaleMax: input?.scaleMax || input?.scale_max || input?.maxLabel,
    showIfPreviousAnswer: (Array.isArray(showIf) ? showIf : showIf == null ? [] : [showIf])
      .map((answer: unknown) => String(answer ?? '').trim())
      .filter(Boolean),
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
    if (type === 'matrix') {
      if (!optionCount(currentQuestion.options)) {
        currentQuestion.options = ['Not difficult', 'Somewhat', 'Very difficult', 'Not applicable'];
      }
      if (!optionCount(currentQuestion.rows)) {
        currentQuestion.rows = ['Item 1', 'Item 2'];
      }
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
      /^[-*]\s+\[(required|optional|req|opt)\]\s+(.+?)(?:\s*\((single-choice|multiple-choice|single|multiple|multi|text|scale|yes-no|yesno|matrix|grid|likert-grid|rating-grid)\))?\s*$/i
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
      const columns = optionText.match(/^(scale|columns|labels):\s*(.+)/i);
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
      if (columns) {
        currentQuestion.options = columns[2].split(/\s*\|\s*/).map((part) => part.trim()).filter(Boolean);
        currentQuestion.type = 'matrix';
        continue;
      }
      if (normalizeType(currentQuestion.type) === 'matrix') {
        const rows = Array.isArray(currentQuestion.rows) ? currentQuestion.rows : [];
        rows.push(optionText);
        currentQuestion.rows = rows;
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
  return Math.max(0, ...Object.values(options).map((list) => (Array.isArray(list) ? list.length : 0)));
}

export function localizedString(value: Localized | undefined, lang: SupportedLng): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value[lang] === 'string' && value[lang].trim()) return value[lang].trim();
  for (const code of LANGS) {
    if (typeof value[code] === 'string' && value[code].trim()) return value[code].trim();
  }
  for (const text of Object.values(value)) {
    if (typeof text === 'string' && text.trim()) return text.trim();
  }
  return '';
}

export function localizedOptions(value: LocalizedList | undefined, lang: SupportedLng): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (Array.isArray(value[lang]) && value[lang].length) return value[lang].map((item) => String(item));
  for (const code of LANGS) {
    if (Array.isArray(value[code]) && value[code].length) return value[code].map((item) => String(item));
  }
  for (const list of Object.values(value)) {
    if (Array.isArray(list) && list.length) return list.map((item) => String(item));
  }
  return [];
}

export function hasFullLocalization(value: Localized | undefined): value is Record<string, string> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.values(value).some((text) => typeof text === 'string' && text.trim())
  );
}

export { flattenQuestions };
