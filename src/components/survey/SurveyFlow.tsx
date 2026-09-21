import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { insertIgnoringUnknownColumns, updateIgnoringUnknownColumns, supabase } from '../../lib/supabaseClient';
import { translations } from './translations';
import SurveyShell from '../chrome/SurveyShell';
import Button from '../chrome/Button';
import { isLng, type Lng } from '../../lib/cn';
import { isResponseCompleted, parseAnswers } from '../../lib/responseFormat';
import { isMatrixComplete, remainingMatrixRows, readLocalizedList } from '../../lib/matrixQuestion';
import MatrixQuestion from './MatrixQuestion';
import {
  clearSurveyDraft,
  getStoredAnswers,
  getStoredLanguage,
  getStoredQuestionIndex,
  getStoredResponseId,
  questionIndexFromAnswers,
  resumeUrl,
  setStoredAnswers,
  setStoredLanguage,
  setStoredQuestionIndex,
  setStoredResponseId,
  withQuestionIndex,
} from '../../lib/surveySession';

type Answers = Record<string, any>;

export default function SurveyFlow() {
  const navigate = useNavigate();
  const { id, rid: resumeRid } = useParams();
  const location = useLocation();

  const searchLng = new URLSearchParams(location.search).get('lng');
  const stateLng = (location.state as { lng?: string; language?: string } | null)?.lng
    ?? (location.state as { language?: string } | null)?.language;
  const persistedLng = id ? getStoredLanguage(id) : null;
  const resolvedLng: Lng = isLng(stateLng)
    ? stateLng
    : isLng(searchLng)
      ? searchLng
      : isLng(persistedLng)
        ? persistedLng
        : 'en';

  const [language, setLanguage] = useState<Lng>(resolvedLng);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [questions, setQuestions] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [laterOpen, setLaterOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const languageRef = useRef(language);
  languageRef.current = language;

  const t = translations[language]?.questions || translations.en.questions;
  const tQuestions = t as typeof translations.en.questions;

  const getLocalized = useCallback(
    (q: any, lng: Lng) => {
      const p = q?.payload ?? {};
      const base = (p.baseLanguage || p.base_language || 'en') as Lng;
      const textMap = p.text;
      const text =
        (textMap && typeof textMap === 'object' ? textMap[lng] || textMap[base] : null) ||
        (typeof q?.text === 'string' ? q.text : '') ||
        (typeof q?.question_text === 'string' ? q.question_text : '') ||
        '';

      let options: any[] = [];
      if (q?.type !== 'yes-no') {
        const payloadOptions = p.options;
        if (payloadOptions && typeof payloadOptions === 'object' && !Array.isArray(payloadOptions)) {
          options =
            Array.isArray(payloadOptions[lng]) && payloadOptions[lng].length > 0
              ? payloadOptions[lng]
              : Array.isArray(payloadOptions[base])
                ? payloadOptions[base]
                : Array.isArray(q?.options)
                  ? q.options
                  : [];
        } else if (Array.isArray(payloadOptions)) {
          options = payloadOptions;
        } else if (Array.isArray(q?.options)) {
          options = q.options;
        }
      }

      const hasOtherOption = q?.hasOtherOption || q?.has_other_option || false;
      if (hasOtherOption && q?.type !== 'matrix' && !options.some((opt) => opt && typeof opt === 'object' && opt.__isOtherOption)) {
        options = [...options, { __text: tQuestions.other || 'Other (please specify)', __isOtherOption: true }];
      }

      const rows = readLocalizedList(p.rows, lng, base);

      return { text, options, rows, hasOtherOption };
    },
    [tQuestions]
  );

  const getLocalizedSection = useCallback((section: any, lng: Lng) => {
    const p = section?.payload || {};
    const base = (p.baseLanguage || p.base_language || 'en') as Lng;
    const nameMap = p.name || p.text;
    const name =
      (nameMap && typeof nameMap === 'object' ? nameMap[lng] || nameMap[base] : null) ||
      (typeof section?.name === 'string' ? section.name : '') ||
      '';
    const descMap = p.description;
    const description =
      (descMap && typeof descMap === 'object' ? descMap[lng] || descMap[base] : null) ||
      (typeof section?.description === 'string' ? section.description : '') ||
      '';
    return { name, description };
  }, []);

  const ensureResponse = useCallback(
    async (surveyId: string, lng: Lng) => {
      const existing = resumeRid || getStoredResponseId(surveyId);
      if (existing) {
        setStoredResponseId(surveyId, existing);
        setResponseId(existing);
        return existing;
      }

      return null;
    },
    [resumeRid]
  );

  const loadSurveyQuestions = useCallback(async () => {
    if (!id) return;
    try {
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('status')
        .eq('id', id)
        .single();
      if (surveyError) throw surveyError;
      if (surveyData?.status !== 'active') {
        navigate(`/survey/${id}/closed`, { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('survey_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const { data: sectionsData } = await supabase
        .from('survey_sections')
        .select('*')
        .eq('survey_id', id)
        .order('order_index', { ascending: true });

      setSections(sectionsData || []);

      const mapped = (data || []).map((row: any, idx: number) => {
        const payload = row.payload || {};
        return {
          ...row,
          order: row.sort_order ?? row.order ?? idx,
          options: row.options
            ? typeof row.options === 'string'
              ? JSON.parse(row.options)
              : row.options
            : [],
          type: row.type ?? payload.type ?? 'single-choice',
          payload,
          text: row.text ?? row.question_text ?? '',
          required: payload.required ?? row.required ?? false,
          hasOtherOption: payload.hasOtherOption ?? row.has_other_option ?? row.hasOtherOption ?? false,
          allowComment: payload.allowComment === true,
          section_id: row.section_id,
          conditional_logic: row.conditional_logic
            ? typeof row.conditional_logic === 'string'
              ? JSON.parse(row.conditional_logic)
              : row.conditional_logic
            : undefined,
        };
      });

      const sectionMap = new Map((sectionsData || []).map((s: any) => [s.id, s.order_index || 0]));
      mapped.sort((a: any, b: any) => {
        if (!a.section_id && !b.section_id) return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (!a.section_id) return -1;
        if (!b.section_id) return 1;
        const sectionOrderA = sectionMap.get(a.section_id) ?? 999;
        const sectionOrderB = sectionMap.get(b.section_id) ?? 999;
        if (sectionOrderA !== sectionOrderB) return sectionOrderA - sectionOrderB;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
      mapped.forEach((q: any, idx: number) => {
        q.order = idx;
      });

      setQuestions(mapped.map((q: any) => ({ ...q })));
      await ensureResponse(id, languageRef.current);
      setLoading(false);
    } catch {
      navigate(`/survey/${id}/closed`, { replace: true });
    }
  }, [ensureResponse, id, navigate]);

  useEffect(() => {
    if (id) setStoredLanguage(id, language);
  }, [id, language]);

  useEffect(() => {
    loadSurveyQuestions();
  }, [loadSurveyQuestions]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      let next = getStoredAnswers(id);
      if (responseId) {
        try {
          const { data } = await supabase
            .from('responses')
            .select('id, survey_id, answers, completed')
            .eq('id', responseId)
            .maybeSingle();
          if (cancelled) return;
          if (data?.survey_id && data.survey_id !== id) {
            navigate(`/survey/${id}/closed`, { replace: true });
            return;
          }
          if (data && isResponseCompleted(data)) {
            clearSurveyDraft(id);
            navigate(`/survey/${id}/thank-you`, { replace: true });
            return;
          }
          const server = parseAnswers(data?.answers);
          const local = getStoredAnswers(id);
          next = { ...server, ...local };
        } catch {
          /* local draft is enough */
        }
      }
      if (cancelled) return;
      if (Object.keys(next).length > 0) {
        setAnswers(next);
        setStoredAnswers(id, next);
      }
      const storedIndex = Math.max(
        questionIndexFromAnswers(next) ?? 0,
        getStoredQuestionIndex(id)
      );
      if (storedIndex > 0) {
        setCurrentQuestion(storedIndex);
        setStoredQuestionIndex(id, storedIndex);
      }
      if (resumeRid) {
        navigate(`/survey/${id}/questions`, { replace: true, state: { lng: languageRef.current, language: languageRef.current } });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, navigate, responseId, resumeRid]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`questions:${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'questions', filter: `survey_id=eq.${id}` },
        () => {
          loadSurveyQuestions();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, loadSurveyQuestions]);

  const saveProgress = async (
    currentAnswers: Answers,
    completed = false,
    index = currentQuestion,
    persist = false
  ): Promise<string | null> => {
    if (!id) return responseId;
    if (!completed && index <= 0 && !persist) return responseId;

    const row: Record<string, unknown> = {
      answers: withQuestionIndex(currentAnswers, index),
      duration_seconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
      language: languageRef.current,
    };
    if (completed) {
      row.completed = true;
      row.status = 'completed';
    } else {
      row.completed = false;
      row.status = 'in_progress';
    }

    let rid = responseId;
    if (!rid) {
      const created = await insertIgnoringUnknownColumns('responses', {
        survey_id: id,
        ...row,
      });
      rid = created?.id || null;
      if (rid) {
        setStoredResponseId(id, rid);
        setResponseId(rid);
      }
      return rid;
    }

    await updateIgnoringUnknownColumns('responses', row, rid);
    return rid;
  };

  const isBranchOnly = (qId: string, qIdx: number) => {
    if (qIdx === 0) return false;
    const currentQ = questions[qIdx];
    const prevQ = questions[qIdx - 1];
    if (currentQ?.section_id !== prevQ?.section_id) return false;
    const targetIds = new Set<string>();
    questions.forEach((q: any) => {
      q.conditional_logic?.forEach((l: any) => {
        if (l.next_question_id) targetIds.add(l.next_question_id);
      });
    });
    if (!targetIds.has(qId)) return false;
    if (!prevQ?.conditional_logic?.length) return false;
    return true;
  };

  const question = questions[currentQuestion];
  const localized = question
    ? getLocalized(question, language)
    : { text: '', options: [] as string[], rows: [] as string[], hasOtherOption: false };

  const visibleQuestions = useMemo(
    () => questions.filter((_, idx) => !isBranchOnly(questions[idx].id, idx)),
    [questions]
  );
  const totalQuestions = visibleQuestions.length;
  const currentVisibleIndex = visibleQuestions.findIndex((q) => q.id === question?.id);
  const progress = totalQuestions > 0 ? ((Math.max(0, currentVisibleIndex) + 1) / totalQuestions) * 100 : 0;

  const nextIndexAfter = (from: number) => {
    let nextIdx = from + 1;
    while (nextIdx < questions.length && isBranchOnly(questions[nextIdx].id, nextIdx)) nextIdx++;
    return nextIdx;
  };
  const finishNext = nextIndexAfter(currentQuestion) >= questions.length;

  const normalizeYesNoAnswer = (localizedAnswer: string): string => {
    const yesLabels = new Set([tQuestions.yes || 'Yes', 'Yes', 'Да', 'Oui', 'Sí']);
    const noLabels = new Set([tQuestions.no || 'No', 'No', 'Нет', 'Non']);
    if (yesLabels.has(localizedAnswer)) return 'Yes';
    if (noLabels.has(localizedAnswer)) return 'No';
    return localizedAnswer;
  };

  const commitAnswers = (next: Answers) => {
    setAnswers(next);
    if (id) setStoredAnswers(id, next);
  };

  const handleAnswer = (value: any) => {
    setFormError('');
    const isMulti = question?.type === 'multiple-choice';
    if (isMulti) {
      const current = answers[question.id];
      const arr = Array.isArray(current) ? current : [];
      const next = arr.includes(value) ? arr.filter((v: any) => v !== value) : [...arr, value];
      commitAnswers({ ...answers, [question.id]: next });
    } else {
      commitAnswers({ ...answers, [question.id]: value });
    }
  };

  const handleMatrixAnswer = (rowIndex: number, columnIndex: number) => {
    if (!question) return;
    setFormError('');
    const current = answers[question.id];
    const map =
      current && typeof current === 'object' && !Array.isArray(current) ? { ...current } : {};
    map[String(rowIndex)] = columnIndex;
    commitAnswers({ ...answers, [question.id]: map });
  };

  const goToOptIn = async (finalAnswers: Answers) => {
    const rid = await saveProgress(finalAnswers, true);
    if (id) clearSurveyDraft(id);
    navigate(`/survey/${id}/opt-in?lng=${encodeURIComponent(language)}&rid=${encodeURIComponent(rid || '')}`, {
      state: { lng: language, language, responseId: rid },
    });
  };

  const handleNext = async () => {
    const matrixColumns = (localized.options || []).map((option: any) =>
      typeof option === 'object' ? String(option.__text || '') : String(option)
    );
    const matrixIncomplete =
      question?.type === 'matrix' &&
      !isMatrixComplete(answers[question.id], localized.rows || [], matrixColumns);
    const unanswered =
      question?.type === 'matrix'
        ? matrixIncomplete
        : answers[question?.id] === undefined ||
          (Array.isArray(answers[question?.id]) && answers[question?.id].length === 0);
    if (question?.required && unanswered) {
      setFormError(
        question.type === 'matrix'
          ? tQuestions.matrixRequired || tQuestions.answerRequired || 'Please rate every item before continuing.'
          : tQuestions.answerRequired || 'Please answer this question before continuing.'
      );
      if (question.type === 'matrix') {
        requestAnimationFrame(() => {
          const nextRow = document.querySelector<HTMLElement>('[data-matrix-row]:not([data-answered])');
          nextRow?.querySelector<HTMLInputElement>('input')?.focus();
        });
      }
      return;
    }

    setSaving(true);
    try {
      if (question?.conditional_logic?.length > 0) {
        let answer = answers[question.id];
        if (question.type === 'yes-no') answer = normalizeYesNoAnswer(answer);
        let logic = question.conditional_logic.find((l: any) => l.answer === answer);
        if (!logic && (question.type === 'single-choice' || question.type === 'multiple-choice')) {
          const currentLanguageOptions = question.payload?.options?.[language] || [];
          const englishOptions = question.payload?.options?.en || [];
          const answerIndex = currentLanguageOptions.indexOf(answer);
          if (answerIndex >= 0 && answerIndex < englishOptions.length) {
            logic = question.conditional_logic.find((l: any) => l.answer === englishOptions[answerIndex]);
          }
        }
        if (logic?.end_survey) {
          await goToOptIn(answers);
          return;
        }
        if (logic?.next_question_id) {
          const nextQuestionIndex = questions.findIndex((q: any) => q.id === logic.next_question_id);
          if (nextQuestionIndex >= 0) {
            await saveProgress(answers, false, nextQuestionIndex);
            setCurrentQuestion(nextQuestionIndex);
            if (id) setStoredQuestionIndex(id, nextQuestionIndex);
            return;
          }
        }
      }

      const nextIdx = nextIndexAfter(currentQuestion);
      if (nextIdx < questions.length) {
        await saveProgress(answers, false, nextIdx);
        setCurrentQuestion(nextIdx);
        if (id) setStoredQuestionIndex(id, nextIdx);
      } else {
        await goToOptIn(answers);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    let prevIdx = currentQuestion - 1;
    while (prevIdx >= 0 && isBranchOnly(questions[prevIdx].id, prevIdx)) prevIdx--;
    if (prevIdx >= 0) {
      setCurrentQuestion(prevIdx);
      if (id) setStoredQuestionIndex(id, prevIdx);
      setFormError('');
    }
  };

  useEffect(() => {
    setCommentOpen(false);
  }, [question?.id]);

  const handleContinueLater = async () => {
    setSaving(true);
    try {
      await saveProgress(answers, false, currentQuestion, true);
      setCopied(false);
      setLaterOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyResume = async () => {
    if (!id || !responseId) return;
    try {
      await navigator.clipboard.writeText(resumeUrl(id, responseId));
      setCopied(true);
    } catch {
      /* the field stays selectable */
    }
  };

  const matrixColumns = (localized.options || []).map((option: any) =>
    typeof option === 'object' ? String(option.__text || '') : String(option)
  );
  const isAnswered =
    question?.type === 'matrix'
      ? isMatrixComplete(answers[question.id], localized.rows || [], matrixColumns)
      : answers[question?.id] !== undefined &&
        (Array.isArray(answers[question?.id]) ? answers[question.id].length > 0 : true);
  const canSkip = !question?.required;

  const handleSkip = () => {
    const next = { ...answers, [question.id]: null };
    commitAnswers(next);
    handleNext();
  };

  if (loading || !question) {
    return (
      <SurveyShell language={language} onLanguageChange={setLanguage}>
        <div className="sheet space-y-4 px-6 py-10" aria-busy="true" aria-live="polite">
          <div className="h-3 w-1/3 bg-canvas" />
          <div className="h-8 w-2/3 bg-canvas" />
          <div className="h-16 w-full bg-canvas" />
        </div>
      </SurveyShell>
    );
  }

  const optionClass = (selected: boolean) =>
    `w-full min-h-12 text-left px-4 py-3 border transition-colors duration-150 ${
      selected ? 'border-navy bg-accent-soft text-ink' : 'border-line bg-surface text-ink hover:border-line-strong'
    }`;

  const commentKey = `${question.id}_comment`;
  const commentValue = answers[commentKey] || '';
  const showComment = Boolean(question.allowComment && question.type !== 'text' && (commentOpen || commentValue));
  const resumeLink = id && responseId ? resumeUrl(id, responseId) : '';

  if (laterOpen) {
    return (
      <SurveyShell
        language={language}
        onLanguageChange={(lng) => {
          setLanguage(lng);
          if (id) setStoredLanguage(id, lng);
        }}
      >
        <article className="sheet px-6 py-8 md:px-10 md:py-10">
          <h1 className="font-serif text-3xl font-semibold text-navy">{tQuestions.continueLaterTitle}</h1>
          <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-ink-muted">
            {tQuestions.continueLaterBody}
          </p>
          <label className="mt-8 block">
            <span className="sr-only">{tQuestions.continueLater}</span>
            <input
              readOnly
              value={resumeLink}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full border border-line-strong bg-surface px-3 py-3 text-sm text-ink"
            />
          </label>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleCopyResume} disabled={!resumeLink}>
              {copied ? tQuestions.copied : tQuestions.copyLink}
            </Button>
            <Button variant="secondary" onClick={() => setLaterOpen(false)}>
              {tQuestions.backToSurvey}
            </Button>
          </div>
        </article>
      </SurveyShell>
    );
  }

  return (
    <SurveyShell
      language={language}
      onLanguageChange={(lng) => {
        setLanguage(lng);
        if (id) setStoredLanguage(id, lng);
      }}
    >
      <div className="mb-6">
        <div className="mb-2 flex items-end justify-between gap-4 text-sm">
          <p className="font-bold text-ink">
            {t.question} {Math.max(1, currentVisibleIndex + 1)} {t.of} {totalQuestions}
          </p>
          <p className="tabular-nums text-ink-subtle">
            {Math.round(progress)}% {t.complete}
          </p>
        </div>
        <div
          className="h-1 w-full bg-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div className="h-full bg-navy transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <article className="sheet px-6 py-8 md:px-10 md:py-10">
        {question.section_id && sections.find((s) => s.id === question.section_id) && (
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-ink-subtle">
            {getLocalizedSection(sections.find((s) => s.id === question.section_id), language).name}
          </p>
        )}

        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-subtle">
          {question.required ? (
            <span className="text-danger">{tQuestions.required || 'Required'}</span>
          ) : (
            <span>{tQuestions.optional || 'Optional'}</span>
          )}
          {question.conditional_logic?.length > 0 && (
            <span className="font-normal normal-case tracking-normal text-ink-muted">
              · {tQuestions.branchHint}
            </span>
          )}
        </div>

        <h1 className="text-balance font-serif text-3xl font-semibold leading-tight text-navy md:text-4xl">{localized.text}</h1>

        {(question.type === 'multiple-choice' || question.type === 'single-choice') && (
          <fieldset className="mt-8 space-y-2">
            <legend className="sr-only">{localized.text}</legend>
            {localized.options?.map((option: any) => {
              const isMulti = question.type === 'multiple-choice';
              const optionText = typeof option === 'object' ? option.__text : option;
              const isOtherOption = typeof option === 'object' && option.__isOtherOption;
              const current = answers[question.id];
              const isSelected = isMulti
                ? (Array.isArray(current) ? current : []).includes(optionText)
                : current === optionText;

              return (
                <div key={optionText}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleAnswer(optionText)}
                    className={optionClass(isSelected)}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center border ${
                          isMulti ? '' : 'rounded-full'
                        } ${isSelected ? 'border-navy bg-navy' : 'border-line-strong'}`}
                        aria-hidden="true"
                      >
                        {isSelected && <span className="size-2 bg-surface" />}
                      </span>
                      <span>{optionText}</span>
                    </span>
                  </button>
                  {isSelected && isOtherOption && (
                    <textarea
                      value={answers[`${question.id}_other`] || ''}
                      onChange={(e) => commitAnswers({ ...answers, [`${question.id}_other`]: e.target.value })}
                      placeholder={tQuestions.placeholder ?? 'Please specify...'}
                      className="mt-2 min-h-24 w-full border border-line-strong bg-surface px-3 py-3 text-base"
                      rows={3}
                    />
                  )}
                </div>
              );
            })}
          </fieldset>
        )}

        {question.type === 'scale' && (
          <div className="mt-8 space-y-4">
            {(question.payload?.scaleMin || question.payload?.scaleMax) && (
              <div className="flex justify-between text-sm text-ink-muted">
                <span>
                  {typeof question.payload.scaleMin === 'object'
                    ? question.payload.scaleMin[language] || question.payload.scaleMin[question.payload.baseLanguage] || ''
                    : question.payload.scaleMin}
                </span>
                <span>
                  {typeof question.payload.scaleMax === 'object'
                    ? question.payload.scaleMax[language] || question.payload.scaleMax[question.payload.baseLanguage] || ''
                    : question.payload.scaleMax}
                </span>
              </div>
            )}
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={localized.text}>
              {Array.from({ length: 5 }, (_, i) => i + 1).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={answers[question.id] === value}
                  onClick={() => handleAnswer(value)}
                  className={`min-h-14 font-serif text-2xl font-semibold ${optionClass(answers[question.id] === value)}`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        )}

        {question.type === 'text' && (
          <textarea
            value={answers[question.id] || ''}
            onChange={(e) => handleAnswer(e.target.value)}
            placeholder={tQuestions.placeholder ?? 'Enter your answer here...'}
            rows={4}
            className="mt-8 min-h-32 w-full border border-line-strong bg-surface px-3 py-3 text-base"
          />
        )}

        {question.type === 'yes-no' && (
          <div className="mt-8 grid grid-cols-2 gap-3">
            {(localized.options.length ? localized.options : [tQuestions.yes ?? 'Yes', tQuestions.no ?? 'No']).map(
              (option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={answers[question.id] === option}
                  onClick={() => handleAnswer(option)}
                  className={`min-h-14 font-bold ${optionClass(answers[question.id] === option)}`}
                >
                  {option}
                </button>
              )
            )}
          </div>
        )}

        {question.type === 'matrix' && (
          <MatrixQuestion
            questionId={question.id}
            stem={localized.text}
            rows={localized.rows || []}
            columns={matrixColumns}
            value={answers[question.id]}
            remainingLabel={(tQuestions.matrixRemaining || '{n} left to rate').replace(
              '{n}',
              String(remainingMatrixRows(answers[question.id], localized.rows || [], matrixColumns))
            )}
            allRatedLabel={tQuestions.matrixAllRated || 'Every item is rated'}
            onSelect={handleMatrixAnswer}
          />
        )}

        {question.type === 'multiple-choice' && (
          <p className="mt-4 text-sm text-ink-subtle">{tQuestions.multiNote}</p>
        )}

        {question.allowComment && question.type !== 'text' && (
          <div className="mt-8 border-t border-line pt-5">
            {showComment ? (
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink-subtle">
                  {tQuestions.commentLabel}
                </span>
                <textarea
                  value={commentValue}
                  onChange={(e) => commitAnswers({ ...answers, [commentKey]: e.target.value })}
                  placeholder={tQuestions.commentPlaceholder}
                  rows={2}
                  className="mt-2 min-h-20 w-full border border-line bg-surface px-3 py-2 text-sm text-ink"
                />
              </label>
            ) : (
              <button
                type="button"
                onClick={() => setCommentOpen(true)}
                className="min-h-11 text-left text-sm text-ink-subtle underline decoration-line underline-offset-4 hover:text-ink"
              >
                {tQuestions.addComment}
              </button>
            )}
          </div>
        )}

        {formError && (
          <p role="alert" className="mt-6 text-sm text-danger">
            {formError}
          </p>
        )}
      </article>

      <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <Button variant="secondary" onClick={handleBack} disabled={currentQuestion === 0}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          {t.back}
        </Button>
        <div className="flex gap-2">
          {canSkip && (
            <Button variant="ghost" onClick={handleSkip}>
              {tQuestions.skip || 'Skip'}
            </Button>
          )}
          <Button onClick={handleNext} disabled={saving}>
            {finishNext ? t.finish : t.next}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      {responseId && (
        <div className="mt-4">
          <button
            type="button"
            onClick={handleContinueLater}
            disabled={saving}
            className="min-h-11 text-xs text-ink-subtle underline decoration-transparent underline-offset-4 hover:text-ink-muted hover:decoration-line"
          >
            {tQuestions.continueLater}
          </button>
        </div>
      )}
    </SurveyShell>
  );
}
