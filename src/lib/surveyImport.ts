import { insertIgnoringUnknownColumns, supabase } from './supabaseClient';
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

const LANGS: SupportedLng[] = ['en', 'ru', 'fr', 'es'];

async function translateMyMemory(text: string, from: SupportedLng, to: SupportedLng) {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';
  const params = new URLSearchParams({ q: trimmed, langpair: `${from}|${to}` });
  const res = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`);
  if (!res.ok) return trimmed;
  const data = await res.json();
  return (data?.responseData?.translatedText as string) || trimmed;
}

async function fillLangMap(
  source: string | Partial<Record<SupportedLng, string>> | undefined,
  base: SupportedLng,
  translate: boolean
): Promise<Record<SupportedLng, string>> {
  const map: Record<SupportedLng, string> = { en: '', ru: '', fr: '', es: '' };
  if (hasFullLocalization(source)) {
    for (const lng of LANGS) map[lng] = source[lng] || '';
  } else {
    map[base] = typeof source === 'string' ? source.trim() : localizedString(source, base);
  }
  if (!translate) {
    for (const lng of LANGS) if (!map[lng]) map[lng] = map[base];
    return map;
  }
  for (const lng of LANGS) {
    if (map[lng] || !map[base]) continue;
    map[lng] = await translateMyMemory(map[base], base, lng);
  }
  return map;
}

async function fillOptionsMap(
  source: SurveyQuestionSpec['options'],
  base: SupportedLng,
  translate: boolean
): Promise<Record<SupportedLng, string[]>> {
  const map: Record<SupportedLng, string[]> = { en: [], ru: [], fr: [], es: [] };
  if (source && !Array.isArray(source)) {
    for (const lng of LANGS) map[lng] = source[lng] || [];
  } else {
    map[base] = Array.isArray(source) ? source.map(String) : [];
  }
  if (!translate) {
    for (const lng of LANGS) if (!map[lng].length) map[lng] = map[base];
    return map;
  }
  for (const lng of LANGS) {
    if (map[lng].length || !map[base].length) continue;
    const translated: string[] = [];
    for (const option of map[base]) {
      translated.push(await translateMyMemory(option, base, lng));
    }
    map[lng] = translated;
  }
  return map;
}

function detectBase(spec: SurveySpec, fallback: SupportedLng = 'en'): SupportedLng {
  if (spec.baseLanguage && LANGS.includes(spec.baseLanguage)) return spec.baseLanguage;
  const sample = `${localizedString(spec.title, fallback)} ${localizedString(spec.description, fallback)}`;
  return /[А-Яа-яЁё]/.test(sample) ? 'ru' : fallback;
}

async function questionPayload(question: SurveyQuestionSpec, base: SupportedLng, translate: boolean) {
  const type = (question.type as QuestionType) || 'single-choice';
  const text = await fillLangMap(question.text, base, translate);
  const options = await fillOptionsMap(question.options, base, translate);
  const rows = await fillOptionsMap(question.rows, base, translate);
  const scaleMin = await fillLangMap(question.scaleMin, base, translate);
  const scaleMax = await fillLangMap(question.scaleMax, base, translate);
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
      LANGS.filter((lng) => lng !== base).map((lng) => [lng, { text: text[lng], options: options[lng], rows: rows[lng] }])
    ),
  };
}

export type ImportProgress = (message: string) => void;

export async function importSurveySpec(args: {
  spec: SurveySpec;
  ownerId: string;
  surveyId?: string;
  translate?: boolean;
  onProgress?: ImportProgress;
}): Promise<{ surveyId: string; questionCount: number; sectionCount: number }> {
  const base = detectBase(args.spec);
  const translate = args.translate ?? args.spec.translate !== false;
  const spec = args.spec;
  args.onProgress?.('Saving survey…');

  let surveyId = args.surveyId;
  const createdNewSurvey = !surveyId;
  const title = localizedString(spec.title, base) || 'Untitled survey';
  const descriptionMap = await fillLangMap(spec.description, base, translate);
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
        const nameMap = await fillLangMap(section.name, base, translate);
        const descMap = await fillLangMap(section.description, base, translate);
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

      for (const question of section.questions || []) {
        questionCount += 1;
        const text = localizedString(question.text, base);
        args.onProgress?.(`Question ${questionCount} of ${totalQuestions}: ${text.slice(0, 48)}`);
        const type = (question.type as QuestionType) || 'single-choice';
        const payload = await questionPayload(question, base, translate);
        await insertIgnoringUnknownColumns('questions', {
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
        sortOrder += 1;
      }
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
