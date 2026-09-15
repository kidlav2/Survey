const ridKey = (surveyId: string) => `survey_rid_${surveyId}`;
const lngKey = (surveyId: string) => `survey_lng_${surveyId}`;
const answersKey = (surveyId: string) => `survey_answers_${surveyId}`;
const indexKey = (surveyId: string) => `survey_qidx_${surveyId}`;

export function getStoredResponseId(surveyId: string): string | null {
  try {
    return localStorage.getItem(ridKey(surveyId));
  } catch {
    return null;
  }
}

export function setStoredResponseId(surveyId: string, responseId: string) {
  try {
    localStorage.setItem(ridKey(surveyId), responseId);
  } catch {
    /* private mode */
  }
}

export function getStoredLanguage(surveyId: string): string | null {
  try {
    return localStorage.getItem(lngKey(surveyId));
  } catch {
    return null;
  }
}

export function setStoredLanguage(surveyId: string, language: string) {
  try {
    localStorage.setItem(lngKey(surveyId), language);
  } catch {
    /* private mode */
  }
}

export function getStoredAnswers(surveyId: string): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(answersKey(surveyId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function setStoredAnswers(surveyId: string, answers: Record<string, unknown>) {
  try {
    localStorage.setItem(answersKey(surveyId), JSON.stringify(answers));
  } catch {
    /* private mode */
  }
}

export function getStoredQuestionIndex(surveyId: string): number {
  try {
    const raw = localStorage.getItem(indexKey(surveyId));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function setStoredQuestionIndex(surveyId: string, index: number) {
  try {
    localStorage.setItem(indexKey(surveyId), String(index));
  } catch {
    /* private mode */
  }
}

export const PROGRESS_KEY = '__i';

export function isInternalAnswerKey(key: string) {
  return key.startsWith('__') || key.endsWith('_other') || key.endsWith('_comment');
}

export function withQuestionIndex(answers: Record<string, unknown>, index: number) {
  return { ...answers, [PROGRESS_KEY]: index };
}

export function questionIndexFromAnswers(answers: Record<string, unknown>): number | null {
  const n = Number(answers[PROGRESS_KEY]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function hasSurveyDraft(surveyId: string): boolean {
  const index = getStoredQuestionIndex(surveyId);
  if (index > 0) return true;
  return Object.keys(getStoredAnswers(surveyId)).some((key) => !isInternalAnswerKey(key));
}

export function resumePath(surveyId: string, responseId: string) {
  return `/survey/${surveyId}/r/${responseId}`;
}

export function resumeUrl(surveyId: string, responseId: string) {
  return `${window.location.origin}${resumePath(surveyId, responseId)}`;
}

export function clearSurveyDraft(surveyId: string) {
  try {
    localStorage.removeItem(answersKey(surveyId));
    localStorage.removeItem(indexKey(surveyId));
    localStorage.removeItem(ridKey(surveyId));
  } catch {
    /* private mode */
  }
}
