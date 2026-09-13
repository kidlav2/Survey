import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { AdminLanguageContext } from './AdminLayout';
import { adminTranslations } from './adminTranslations';
import Button from '../chrome/Button';
import {
  canonicalAnswers,
  formatDuration,
  isResponseCompleted,
  languageName,
  parseAnswers,
  questionLabel,
  questionOptions,
  questionType,
  type QuestionRow,
  type ResponseRow,
} from '../../lib/responseFormat';

type SurveyOption = { id: string; title: string };

type ChoiceStat = { label: string; count: number; percent: number };
type QuestionStat =
  | { id: string; label: string; type: string; answered: number; kind: 'choice'; options: ChoiceStat[] }
  | { id: string; label: string; type: string; answered: number; kind: 'scale'; options: ChoiceStat[]; mean: number | null }
  | { id: string; label: string; type: string; answered: number; kind: 'text'; samples: string[]; extra: number };

function monthBars(responses: ResponseRow[]) {
  const counts = new Map<string, number>();
  for (const row of responses) {
    const date = new Date(row.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.keys()].sort().map((key) => {
    const [year, month] = key.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return {
      key,
      label: date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
      count: counts.get(key) || 0,
    };
  });
}

function BarList({ options }: { options: ChoiceStat[] }) {
  const max = Math.max(1, ...options.map((option) => option.count));
  return (
    <ul className="space-y-3">
      {options.map((option) => (
        <li key={option.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="min-w-0 break-words text-ink">{option.label}</span>
            <span className="shrink-0 tabular-nums text-ink-muted">
              {option.count} · {option.percent}%
            </span>
          </div>
          <div className="h-2.5 bg-canvas" aria-hidden="true">
            <div className="h-full bg-navy" style={{ width: `${(option.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useContext(AdminLanguageContext);
  const t = adminTranslations[language];
  const [surveys, setSurveys] = useState<SurveyOption[]>([]);
  const [surveyId, setSurveyId] = useState(searchParams.get('survey') || '');
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSurvey, setLoadingSurvey] = useState(false);

  useEffect(() => {
    void loadSurveys();
  }, []);

  useEffect(() => {
    if (!surveyId) {
      setResponses([]);
      setQuestions([]);
      setLoadingSurvey(false);
      return;
    }
    let cancelled = false;
    const load = async (id: string) => {
      try {
        setLoadingSurvey(true);
        const [{ data: responseData, error: responseError }, { data: questionData, error: questionError }] = await Promise.all([
          supabase.from('responses').select('*').eq('survey_id', id).order('created_at', { ascending: true }),
          supabase.from('questions').select('*').eq('survey_id', id).order('sort_order', { ascending: true }),
        ]);
        if (responseError) throw responseError;
        if (questionError) throw questionError;
        if (cancelled) return;
        setResponses(responseData || []);
        setQuestions(questionData || []);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setResponses([]);
          setQuestions([]);
        }
      } finally {
        if (!cancelled) setLoadingSurvey(false);
      }
    };
    void load(surveyId);
    return () => {
      cancelled = true;
    };
  }, [surveyId]);

  const loadSurveys = async () => {
    try {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Not authenticated');
      const { data, error } = await supabase.from('surveys').select('id, title').eq('owner_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      const list = data || [];
      setSurveys(list);
      const requested = searchParams.get('survey');
      const next = list.some((survey) => survey.id === requested)
        ? requested!
        : list.length === 1
          ? list[0].id
          : requested && list.some((survey) => survey.id === requested)
            ? requested
            : surveyId && list.some((survey) => survey.id === surveyId)
              ? surveyId
              : '';
      if (next && next !== surveyId) setSurveyId(next);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const selectSurvey = (id: string) => {
    setSurveyId(id);
    if (id) setSearchParams({ survey: id });
    else setSearchParams({});
  };

  const byDay = useMemo(() => monthBars(responses), [responses]);

  const completedCount = responses.filter(isResponseCompleted).length;
  const completionRate = responses.length ? Math.round((completedCount / responses.length) * 100) : 0;
  const avgSeconds = responses.length
    ? Math.round(responses.reduce((sum, row) => sum + (Number(row.duration_seconds) || 0), 0) / responses.length)
    : 0;
  const emails = responses.filter((row) => (row.respondent_email || row.email || '').toString().trim()).length;

  const languages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of responses) {
      const key = row.language || 'unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const total = responses.length || 1;
    return [...counts.entries()]
      .map(([code, count]) => ({
        label: code === 'unknown' ? t.notSpecified || 'Not specified' : languageName(code),
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [responses, language]);

  const questionStats = useMemo<QuestionStat[]>(() => {
    return questions.map((question) => {
      const type = questionType(question);
      const values: unknown[] = [];
      for (const row of responses) {
        const answers = parseAnswers(row.answers);
        if (answers[question.id] === undefined || answers[question.id] === null) continue;
        values.push(answers[question.id]);
      }
      const answered = values.length;
      const label = questionLabel(question, language);

      if (type === 'text') {
        const samples = values.map((value) => String(value ?? '').trim()).filter(Boolean);
        return {
          id: question.id,
          label,
          type,
          answered,
          kind: 'text',
          samples: samples.slice(0, 8),
          extra: Math.max(0, samples.length - 8),
        };
      }

      const counts = new Map<string, number>();
      const bump = (key: string) => counts.set(key, (counts.get(key) || 0) + 1);
      if (type === 'scale') {
        for (const value of values) bump(String(value));
        const numeric = values.map(Number).filter((n) => Number.isFinite(n));
        const mean = numeric.length ? Math.round((numeric.reduce((a, b) => a + b, 0) / numeric.length) * 10) / 10 : null;
        const options = [1, 2, 3, 4, 5].map((n) => {
          const count = counts.get(String(n)) || 0;
          return { label: String(n), count, percent: answered ? Math.round((count / answered) * 100) : 0 };
        });
        return { id: question.id, label, type, answered, kind: 'scale', options, mean };
      }

      const known = questionOptions(question, language);
      for (const value of values) {
        const parts = canonicalAnswers(value, question);
        if (!parts.length) continue;
        for (const part of parts) bump(part);
      }
      const keys = [...new Set([...known, ...counts.keys()])];
      const options = keys.map((key) => ({
        label: key,
        count: counts.get(key) || 0,
        percent: answered ? Math.round(((counts.get(key) || 0) / answered) * 100) : 0,
      }));
      return { id: question.id, label, type, answered, kind: 'choice', options };
    });
  }, [questions, responses, language]);

  const maxDay = Math.max(1, ...byDay.map((day) => day.count));
  const selectedTitle = surveys.find((survey) => survey.id === surveyId)?.title;

  return (
    <main className="flex-1">
      <header className="border-b border-line px-4 py-5 md:px-8">
        <h2 className="font-serif text-2xl font-semibold text-navy">{t.analytics}</h2>
        <p className="mt-1 max-w-[65ch] text-sm text-ink-muted">{t.analyticsIntro}</p>
        <div className="mt-4 max-w-lg">
          <label htmlFor="analytics-survey" className="mb-2 block text-sm font-bold">
            {t.surveys}
          </label>
          <select
            id="analytics-survey"
            value={surveyId}
            onChange={(e) => selectSurvey(e.target.value)}
            className="min-h-12 w-full border border-line-strong bg-surface px-3 text-sm"
            disabled={loading || surveys.length === 0}
          >
            <option value="">{loading ? t.loading : t.pickSurvey}</option>
            {surveys.map((survey) => (
              <option key={survey.id} value={survey.id}>
                {survey.title}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="p-4 md:p-8">
        {loading ? (
          <p className="text-ink-muted">{t.loading}</p>
        ) : !surveyId ? (
          <div className="border border-line bg-surface px-6 py-12 text-center">
            <BarChart3 className="mx-auto size-8 text-navy" aria-hidden="true" />
            <p className="mt-3 text-ink-muted">{surveys.length ? t.pickSurvey : t.noSurveysForAnalytics}</p>
            {!surveys.length && (
              <Button className="mt-4" onClick={() => navigate('/admin/surveys')}>
                {t.surveys}
              </Button>
            )}
          </div>
        ) : loadingSurvey ? (
          <p className="text-ink-muted">{t.loading}</p>
        ) : responses.length === 0 ? (
          <div className="border border-line bg-surface px-6 py-12 text-center">
            <p className="text-ink-muted">{t.noResponsesForAnalytics}</p>
            <Button variant="secondary" className="mt-4" onClick={() => navigate(`/admin/surveys/${surveyId}`)}>
              {selectedTitle || t.surveys}
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: t.totalResponses, value: String(responses.length) },
                { label: t.completionRate, value: `${completionRate}%` },
                { label: t.averageTime, value: formatDuration(avgSeconds) },
                { label: t.emailsCollected, value: String(emails) },
              ].map((stat) => (
                <div key={stat.label} className="border border-line bg-surface p-5">
                  <p className="text-sm text-ink-muted">{stat.label}</p>
                  <p className="mt-2 font-serif text-3xl font-semibold text-navy">{stat.value}</p>
                </div>
              ))}
            </section>

            <section className="border border-line bg-surface p-5 md:p-6">
              <h3 className="font-serif text-lg font-semibold text-navy">{t.overTime}</h3>
              <p className="mt-1 text-sm text-ink-muted">{byDay.map((day) => day.label).join(' – ')}</p>
              <div className="mt-6 flex h-44 items-end gap-1 sm:gap-2" role="img" aria-label={t.overTime}>
                {byDay.map((day) => (
                  <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-[11px] tabular-nums text-ink-muted">{day.count || ''}</span>
                    <div className="flex h-28 w-full items-end bg-canvas">
                      <div
                        className="w-full bg-navy"
                        style={{ height: `${(day.count / maxDay) * 100}%` }}
                        title={`${day.label}: ${day.count}`}
                      />
                    </div>
                    <span className="w-full truncate text-center text-[10px] text-ink-subtle">{day.label}</span>
                  </div>
                ))}
              </div>
            </section>

            {languages.length > 0 && (
              <section className="border border-line bg-surface p-5 md:p-6">
                <h3 className="font-serif text-lg font-semibold text-navy">{t.language}</h3>
                <div className="mt-5">
                  <BarList options={languages} />
                </div>
              </section>
            )}

            <section className="space-y-5">
              <h3 className="font-serif text-lg font-semibold text-navy">{t.questionBreakdown}</h3>
              {questionStats.map((stat) => (
                <article key={stat.id} className="border border-line bg-surface p-5 md:p-6">
                  <p className="text-xs font-bold tracking-wide text-ink-subtle">{stat.type}</p>
                  <h4 className="mt-1 font-medium text-ink">{stat.label}</h4>
                  <p className="mt-1 text-sm text-ink-muted">
                    {stat.answered} {t.questionsAnswered}
                    {stat.kind === 'scale' && stat.mean != null ? ` · ${t.meanScore} ${stat.mean}` : ''}
                  </p>
                  <div className="mt-5">
                    {stat.kind === 'text' ? (
                      stat.samples.length ? (
                        <ul className="space-y-2">
                          {stat.samples.map((sample, index) => (
                            <li key={`${stat.id}-${index}`} className="border border-line bg-canvas px-3 py-2 text-sm">
                              {sample}
                            </li>
                          ))}
                          {stat.extra > 0 && <li className="text-sm text-ink-muted">+{stat.extra}</li>}
                        </ul>
                      ) : (
                        <p className="text-sm text-ink-muted">{t.noAnswersRecorded}</p>
                      )
                    ) : stat.options.some((option) => option.count > 0) ? (
                      <BarList options={stat.options} />
                    ) : (
                      <p className="text-sm text-ink-muted">{t.noAnswersRecorded}</p>
                    )}
                  </div>
                </article>
              ))}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
