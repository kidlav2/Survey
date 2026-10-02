import { insertIgnoringUnknownColumns, supabase, updateIgnoringUnknownColumns } from './supabaseClient';
import { uniqueLanguages } from './languages';
import {
  EXAMPLE_SURVEY_JSON,
  flattenQuestions,
  hasFullLocalization,
  localizedOptions,
  localizedString,
  type QuestionType,
  type SurveyQuestionSpec,
  type SurveySectionSpec,
  type SurveySpec,
  type SupportedLng,
} from './surveySpec';

async function translateMyMemory(text: string, from: string, to: string) {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';
  const params = new URLSearchParams({ q: trimmed, langpair: `${from}|${to}` });
  const res = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`);
  if (!res.ok) return trimmed;
  const data = await res.json();
  return (data?.responseData?.translatedText as string) || trimmed;
}

async function fillLangMap(
  source: string | Record<string, string> | undefined,
  base: string,
  targets: string[]
): Promise<Record<string, string>> {
  const langs = uniqueLanguages([base, ...targets]);
  const map: Record<string, string> = {};
  if (hasFullLocalization(source)) {
    for (const lng of langs) map[lng] = source[lng] || '';
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string' && value.trim() && !map[key]) map[key] = value;
    }
  } else {
    map[base] = typeof source === 'string' ? source.trim() : localizedString(source, base);
  }
  if (!targets.length) {
    return { [base]: map[base] || '' };
  }
  for (const lng of langs) {
    if (lng === base || map[lng] || !map[base]) continue;
    map[lng] = await translateMyMemory(map[base], base, lng);
  }
  return map;
}

async function fillOptionsMap(
  source: SurveyQuestionSpec['options'],
  base: string,
  targets: string[]
): Promise<Record<string, string[]>> {
  const langs = uniqueLanguages([base, ...targets]);
  const map: Record<string, string[]> = {};
  if (source && !Array.isArray(source)) {
    for (const lng of langs) map[lng] = source[lng] || [];
    for (const [key, value] of Object.entries(source)) {
      if (Array.isArray(value) && value.length && !map[key]?.length) map[key] = value.map(String);
    }
  } else {
    map[base] = Array.isArray(source) ? source.map(String) : [];
  }
  if (!targets.length) {
    return { [base]: map[base] || [] };
  }
  for (const lng of langs) {
    if (lng === base || (map[lng] && map[lng].length) || !map[base]?.length) continue;
    const translated: string[] = [];
    for (const option of map[base]) {
      translated.push(await translateMyMemory(option, base, lng));
    }
    map[lng] = translated;
  }
  return map;
}

function detectBase(spec: SurveySpec, fallback: SupportedLng = 'en'): SupportedLng {
  const specified = String(spec.baseLanguage || '').trim().toLowerCase();
  if (/^[a-z]{2}$/.test(specified)) return specified;
  const sample = `${localizedString(spec.title, fallback)} ${localizedString(spec.description, fallback)}`;
  return /[А-Яа-яЁё]/.test(sample) ? 'ru' : fallback;
}

async function questionPayload(question: SurveyQuestionSpec, base: SupportedLng, targets: string[]) {
  const type = (question.type as QuestionType) || 'single-choice';
  const text = await fillLangMap(question.text, base, targets);
  const options = await fillOptionsMap(question.options, base, targets);
  const rows = await fillOptionsMap(question.rows, base, targets);
  const scaleMin = await fillLangMap(question.scaleMin, base, targets);
  const scaleMax = await fillLangMap(question.scaleMax, base, targets);
  const extra = uniqueLanguages([base, ...targets]).filter((lng) => lng !== base);
  return {
    baseLanguage: base,
    type,
    required: question.required !== false,
    hasOtherOption: Boolean(question.hasOtherOption),
    text,
    options,
    rows,
    scaleMin,
    scaleMax,
    translations: Object.fromEntries(
      extra.map((lng) => [lng, { text: text[lng], options: options[lng], rows: rows[lng] }])
    ),
  };
}

type BranchRule = { condition_type: 'answer_equals'; answer: string; next_question_id: string };
type ImportedQuestion = { id: string; type: string; options: Record<string, string[]> };

const YES_ANSWERS = new Set(['yes', 'да', 'oui', 'sí', 'si', 'true']);
const NO_ANSWERS = new Set(['no', 'нет', 'non', 'false']);
const answerKey = (value: unknown) => String(value ?? '').trim().toLowerCase();

// Turns "show this question only after these answers to the previous one" into the rules the builder writes.
export function followUpRules(parent: ImportedQuestion, followUpId: string, wanted: string[]): BranchRule[] {
  const answers = new Set<string>();
  const lists = Object.values(parent.options || {}).filter((list) => Array.isArray(list) && list.length);
  for (const raw of wanted) {
    const value = answerKey(raw);
    if (parent.type === 'yes-no') {
      if (YES_ANSWERS.has(value)) answers.add('Yes');
      if (NO_ANSWERS.has(value)) answers.add('No');
      continue;
    }
    if (parent.type !== 'single-choice') continue;
    let index = -1;
    for (const list of lists) {
      index = list.findIndex((option) => answerKey(option) === value);
      if (index >= 0) break;
    }
    if (index < 0) continue;
    // The survey screen matches the answer by its text, so every language needs its own rule.
    for (const list of lists) {
      const text = list[index];
      if (!text) continue;
      const namesAnotherOption = lists.some((other) =>
        other.some((option, i) => i !== index && answerKey(option) === answerKey(text))
      );
      if (!namesAnotherOption) answers.add(text);
    }
  }
  return [...answers].map((answer) => ({ condition_type: 'answer_equals', answer, next_question_id: followUpId }));
}

export type ImportProgress = (message: string) => void;

export async function importSurveySpec(args: {
  spec: SurveySpec;
  ownerId: string;
  surveyId?: string;
  languages?: string[];
  translate?: boolean;
  onProgress?: ImportProgress;
}): Promise<{ surveyId: string; questionCount: number; sectionCount: number }> {
  const base = detectBase(args.spec);
  const targets = uniqueLanguages(args.languages || []).filter((lng) => lng !== base);
  const spec = args.spec;
  args.onProgress?.('Saving survey…');

  let surveyId = args.surveyId;
  const createdNewSurvey = !surveyId;
  const title = localizedString(spec.title, base) || 'Untitled survey';
  const descriptionMap = await fillLangMap(spec.description, base, targets);
  const description = JSON.stringify(descriptionMap);
  const estimatedTime = spec.estimatedTime || 5;

  if (!surveyId) {
    const { data, error } = await supabase
      .from('surveys')
      .insert({
        title,
        description,
        estimated_time: estimatedTime,
        owner_id: args.ownerId,
        status: 'draft',
      })
      .select('id')
      .single();
    if (error) throw error;
    surveyId = data.id as string;
  }

  const sections: SurveySectionSpec[] = spec.sections?.length
    ? spec.sections
    : [{ name: '', description: '', questions: spec.questions || [] }];

  let questionCount = 0;
  let sectionCount = 0;
  let sortOrder = 0;
  let nextSectionOrder = 0;
  const totalQuestions = flattenQuestions(spec);
  const branchRules = new Map<string, BranchRule[]>();

  if (args.surveyId) {
    const { data: lastQuestion } = await supabase
      .from('questions')
      .select('sort_order')
      .eq('survey_id', surveyId)
      .order('sort_order', { ascending: false })
      .limit(1);
    sortOrder = (lastQuestion?.[0]?.sort_order ?? -1) + 1;
    const { data: lastSection } = await supabase
      .from('survey_sections')
      .select('order_index')
      .eq('survey_id', surveyId)
      .order('order_index', { ascending: false })
      .limit(1);
    nextSectionOrder = (lastSection?.[0]?.order_index ?? -1) + 1;
  }

  try {
    for (const [sectionIndex, section] of sections.entries()) {
      let sectionId: string | null = null;
      const sectionName = localizedString(section.name, base);
      if (sectionName) {
        args.onProgress?.(`Section ${sectionIndex + 1}: ${sectionName}`);
        const nameMap = await fillLangMap(section.name, base, targets);
        const descMap = await fillLangMap(section.description, base, targets);
        const payload = { baseLanguage: base, name: nameMap, description: descMap };
        const data = await insertIgnoringUnknownColumns('survey_sections', {
          survey_id: surveyId,
          name: sectionName,
          description: localizedString(section.description, base),
          order_index: nextSectionOrder,
          payload,
        });
        sectionId = data.id as string;
        sectionCount += 1;
        nextSectionOrder += 1;
      }

      let previous: ImportedQuestion | null = null;
      for (const question of section.questions || []) {
        questionCount += 1;
        const text = localizedString(question.text, base);
        args.onProgress?.(`Question ${questionCount} of ${totalQuestions}: ${text.slice(0, 48)}`);
        const type = (question.type as QuestionType) || 'single-choice';
        const payload = await questionPayload(question, base, targets);
        const row = await insertIgnoringUnknownColumns('questions', {
          survey_id: surveyId,
          type,
          text,
          options: localizedOptions(question.options, base),
          required: question.required !== false,
          has_other_option: Boolean(question.hasOtherOption),
          sort_order: sortOrder,
          payload,
          section_id: sectionId,
        });
        if (previous && question.showIfPreviousAnswer?.length) {
          const rules = followUpRules(previous, row.id, question.showIfPreviousAnswer);
          if (rules.length) branchRules.set(previous.id, [...(branchRules.get(previous.id) || []), ...rules]);
        }
        previous = { id: row.id, type, options: payload.options };
        sortOrder += 1;
      }
    }

    if (branchRules.size) args.onProgress?.('Linking follow-up questions…');
    for (const [questionId, rules] of branchRules) {
      await updateIgnoringUnknownColumns('questions', { conditional_logic: JSON.stringify(rules) }, questionId);
    }
  } catch (error) {
    if (createdNewSurvey && surveyId) {
      await supabase.from('surveys').delete().eq('id', surveyId);
    }
    throw error;
  }

  return { surveyId, questionCount, sectionCount };
}

export function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadExampleJson() {
  downloadTextFile('survey-example.json', EXAMPLE_SURVEY_JSON.trim() + '\n');
}

function asLocalized(value: unknown) {
  if (!value) return '';
  if (typeof value === 'object') return value as SurveySpec['title'];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* plain text */
    }
    return value;
  }
  return String(value);
}

function questionFromRow(row: any): SurveyQuestionSpec {
  const payload = row.payload || {};
  return {
    text: payload.text || row.text || '',
    type: payload.type || row.type || 'single-choice',
    required: payload.required ?? row.required ?? true,
    hasOtherOption: payload.hasOtherOption ?? row.has_other_option ?? false,
    options: payload.options || row.options || [],
    rows: payload.rows || [],
    scaleMin: payload.scaleMin,
    scaleMax: payload.scaleMax,
  };
}

export async function exportSurveyJson(surveyId: string) {
  const { data: survey, error: surveyError } = await supabase.from('surveys').select('*').eq('id', surveyId).single();
  if (surveyError) throw surveyError;

  const { data: sections, error: sectionError } = await supabase
    .from('survey_sections')
    .select('*')
    .eq('survey_id', surveyId)
    .order('order_index', { ascending: true });
  if (sectionError) throw sectionError;

  const { data: questions, error: questionError } = await supabase
    .from('questions')
    .select('*')
    .eq('survey_id', surveyId)
    .order('sort_order', { ascending: true });
  if (questionError) throw questionError;

  const bySection = new Map<string, any[]>();
  const unsectioned: any[] = [];
  for (const question of questions || []) {
    if (question.section_id) {
      const list = bySection.get(question.section_id) || [];
      list.push(question);
      bySection.set(question.section_id, list);
    } else {
      unsectioned.push(question);
    }
  }

  const spec: SurveySpec = {
    title: survey.title,
    description: asLocalized(survey.description),
    estimatedTime: survey.estimated_time || 5,
    translate: true,
    sections: (sections || []).map((section: any) => {
      const payload = section.payload || {};
      return {
        name: payload.name || section.name || 'Section',
        description: payload.description || section.description || '',
        questions: (bySection.get(section.id) || []).map(questionFromRow),
      };
    }),
    questions: [],
  };
  if (unsectioned.length) {
    spec.sections = [
      ...(spec.sections || []),
      { name: '', description: '', questions: unsectioned.map(questionFromRow) },
    ];
  }

  const filename = `${String(survey.title || 'survey').replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 48) || 'survey'}.json`;
  downloadTextFile(filename, JSON.stringify(spec, null, 2) + '\n');
}
