import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { AdminLanguageContext } from './AdminLayout';
import { adminTranslations } from './adminTranslations';
import Button from '../chrome/Button';
import {
  canonicalAnswers,
  formatDuration,
  isResponseCompleted,
  isCountableResponse,
  languageName,
  parseAnswers,
  questionLabel,
  questionOptions,
  questionRows,
  questionType,
  type QuestionRow,
  type ResponseRow,
} from '../../lib/responseFormat';
import { selectedColumnIndex } from '../../lib/matrixQuestion';

const COLORS = {
  navy: '#31486f',
  accent: '#c45a28',
  ok: '#3f6d52',
  muted: '#8d7d6c',
  line: '#e4d9c8',
  ink: '#3b2f24',
  surface: '#fbf7f0',
  pale: '#8a9bb3',
};
const REST_SLICES = [COLORS.accent, COLORS.ok, COLORS.muted, COLORS.pale];

type SurveyOption = { id: string; title: string };
type ChoiceStat = { label: string; count: number; percent: number };
type Slice = ChoiceStat & { fill: string };
type TextGroup = { text: string; count: number };
type QuestionStat = {
  id: string;
  index: number;
  label: string;
  type: string;
  reached: number;
  answered: number;
  skipped: number;
  kind: 'choice' | 'scale' | 'text' | 'matrix';
  options: ChoiceStat[];
  mean: number | null;
  scaleMin: string;
  scaleMax: string;
  top: ChoiceStat | null;
  groups: TextGroup[];
  extra: number;
  rows?: { label: string; options: ChoiceStat[]; top: ChoiceStat | null }[];
};

function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function timeSeries(responses: ResponseRow[], locale?: string) {
  if (!responses.length) return [];
  const times = responses.map((row) => new Date(row.created_at).getTime());
  const min = startOfDay(new Date(Math.min(...times)));
  const max = startOfDay(new Date(Math.max(...times)));
  const spanDays = Math.max(1, Math.round((max - min) / 86400000) + 1);
  const weekly = spanDays > 42;
  const step = weekly ? 7 : 1;
  const buckets = new Map<number, number>();
  for (let t = min; t <= max; t += step * 86400000) buckets.set(t, 0);
  for (const row of responses) {
    const day = startOfDay(new Date(row.created_at));
    const offset = Math.floor((day - min) / (step * 86400000));
    const key = min + offset * step * 86400000;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, total]) => ({
      key: String(time),
      label: new Date(time).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
      total,
    }));
}

function localizedField(value: unknown, lng: string, base?: string): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object' && !Array.isArray(value)) {
    const map = value as Record<string, unknown>;
    return String(map[lng] || map.en || (base ? map[base] : '') || '').trim();
  }
  return '';
}

function typeLabel(type: string, t: (typeof adminTranslations)['en']) {
  if (type === 'multiple-choice') return t.typeMultiple;
  if (type === 'scale') return t.typeScale;
  if (type === 'text') return t.typeText;
  if (type === 'yes-no') return t.typeYesNo;
  if (type === 'matrix') return t.typeMatrix;
  return t.typeSingle;
}

function displayChoice(label: string, t: (typeof adminTranslations)['en']) {
  if (label === 'Yes' || label === 'true' || label === 'True') return t.answerYes;
  if (label === 'No' || label === 'false' || label === 'False') return t.answerNo;
  return label;
}

function reachedQuestion(row: ResponseRow, questionId: string, questionIndex: number) {
  if (isResponseCompleted(row)) return true;
  const answers = parseAnswers(row.answers);
  const value = answers[questionId];
  if (value != null && value !== '' && !(Array.isArray(value) && value.length === 0)) return true;
  const index = Number(answers.__i);
  return Number.isFinite(index) && index >= questionIndex;
}

function ChoiceBars({
  options,
  display,
}: {
  options: ChoiceStat[];
  display: (label: string) => string;
}) {
  const max = Math.max(1, ...options.map((option) => option.count));
  return (
    <ul className="space-y-2">
      {options.map((option) => {
        const winner = option.count > 0 && option.count === Math.max(...options.map((item) => item.count));
        return (
          <li key={option.label}>
            <div className="mb-0.5 flex items-baseline justify-between gap-2 text-sm">
              <span className={`min-w-0 truncate ${winner ? 'font-semibold text-ink' : 'text-ink'}`}>{display(option.label)}</span>
              <span className="shrink-0 tabular-nums text-ink">
                {option.percent}%
                <span className="ml-1.5 text-ink-muted">({option.count})</span>
              </span>
            </div>
            <div className="h-2 bg-canvas" aria-hidden="true">
              <div
                className="h-full"
                style={{
                  width: `${(option.count / max) * 100}%`,
                  background: winner ? '#31486f' : '#8a9bb3',
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ScaleBars({ options, minLabel, maxLabel }: { options: ChoiceStat[]; minLabel: string; maxLabel: string }) {
  const max = Math.max(1, ...options.map((option) => option.count));
  return (
    <div>
      {(minLabel || maxLabel) && (
        <div className="mb-3 flex justify-between gap-4 text-xs text-ink-muted">
          <span>1 · {minLabel}</span>
          <span>5 · {maxLabel}</span>
        </div>
      )}
      <div className="grid grid-cols-5 gap-1.5">
        {options.map((option) => (
          <div key={option.label} className="flex min-h-20 flex-col items-center justify-end">
            <p className="mb-1 text-xs tabular-nums text-ink-muted">{option.count ? `${option.percent}%` : '—'}</p>
            <div className="flex h-14 w-full items-end bg-canvas">
              <div className="w-full bg-navy" style={{ height: `${(option.count / max) * 100}%` }} />
            </div>
            <p className="mt-1.5 text-sm font-semibold tabular-nums text-navy">{option.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function sliceColors(options: ChoiceStat[]): Slice[] {
  const max = Math.max(0, ...options.map((option) => option.count));
  const soleWinner = options.filter((option) => option.count > 0 && option.count === max).length === 1;
  const palette = [COLORS.navy, ...REST_SLICES];
  let rest = 0;
  return options.map((option, index) => {
    const isWinner = option.count > 0 && option.count === max;
    const fill =
      soleWinner && isWinner
        ? COLORS.navy
        : soleWinner
          ? REST_SLICES[rest++ % REST_SLICES.length]
          : palette[index % palette.length];
    return { ...option, fill };
  });
}

function usesPie(stat: QuestionStat) {
  if (stat.kind !== 'choice') return false;
  if (stat.type === 'multiple-choice') return false;
  return stat.options.length >= 2 && stat.options.length <= 4;
}

function EditorialTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: { percent?: number; count?: number; total?: number; label?: string } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const row = item.payload;
  const title = row?.label || item.name || label;
  const count = row?.count ?? row?.total ?? item.value;
  const percent = row?.percent;
  return (
    <div className="border border-line bg-surface px-2 py-1 text-xs text-ink">
      {title ? <span className="font-medium">{title}</span> : null}
      {percent != null && <span className="ml-2 tabular-nums">{percent}%</span>}
      {count != null && <span className="ml-1.5 tabular-nums text-ink-muted">({count})</span>}
    </div>
  );
}

function MiniDonut({
  data,
  center,
  size = 72,
  ariaLabel,
}: {
  data: Slice[];
  center?: string;
  size?: number;
  ariaLabel: string;
}) {
  const slices = data.filter((item) => item.count > 0);
  if (!slices.length) return null;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={Math.round(size * 0.31)}
            outerRadius={Math.round(size * 0.46)}
            startAngle={90}
            endAngle={-270}
            stroke={COLORS.surface}
            strokeWidth={1}
            paddingAngle={slices.length > 1 ? 1 : 0}
          >
            {slices.map((entry, index) => (
              <Cell key={`${entry.label}-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<EditorialTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {center ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="font-serif text-sm font-semibold tabular-nums text-navy">{center}</span>
        </div>
      ) : null}
    </div>
  );
}

function ChoicePie({
  options,
  display,
  ariaLabel,
}: {
  options: ChoiceStat[];
  display: (label: string) => string;
  ariaLabel: string;
}) {
  const slices = sliceColors(options).map((option) => ({ ...option, label: display(option.label) }));
  const winner = Math.max(0, ...slices.map((item) => item.count));
  const lead = slices.find((item) => item.count === winner && item.count > 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <MiniDonut data={slices} center={lead ? `${lead.percent}%` : undefined} size={136} ariaLabel={ariaLabel} />
      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.map((option) => {
          const isWinner = option.count > 0 && option.count === winner;
          return (
            <li key={option.label} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0" style={{ background: option.fill }} aria-hidden="true" />
                <span className={`min-w-0 truncate ${isWinner ? 'font-semibold text-ink' : 'text-ink'}`}>{option.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-ink">
                {option.percent}%
                <span className="ml-1.5 text-ink-muted">({option.count})</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ResponsesOverTime({
  series,
  title,
}: {
  series: { key: string; label: string; total: number }[];
  title: string;
}) {
  return (
    <div className="h-24" role="img" aria-label={title}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 6, right: 6, left: 2, bottom: 0 }}>
          <defs>
            <linearGradient id="analytics-area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.navy} stopOpacity={0.28} />
              <stop offset="100%" stopColor={COLORS.navy} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fill: COLORS.muted, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: COLORS.line }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <Tooltip content={<EditorialTooltip />} />
          <Area
            type="monotone"
            dataKey="total"
            stroke={COLORS.navy}
            strokeWidth={2}
            fill="url(#analytics-area-fill)"
            dot={false}
            activeDot={{ r: 3, fill: COLORS.navy, stroke: COLORS.surface, strokeWidth: 1 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useContext(AdminLanguageContext);
  const t = adminTranslations[language];
  const locale = language === 'en' ? 'en' : language;
  const [surveys, setSurveys] = useState<SurveyOption[]>([]);
  const [surveyId, setSurveyId] = useState(searchParams.get('survey') || '');
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSurvey, setLoadingSurvey] = useState(false);
  const [completedOnly, setCompletedOnly] = useState(false);

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
      const next =
        (requested && list.some((survey) => survey.id === requested) && requested) ||
        (surveyId && list.some((survey) => survey.id === surveyId) && surveyId) ||
        (list.length === 1 ? list[0].id : '');
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

  const counted = useMemo(() => responses.filter(isCountableResponse), [responses]);
  const viewSet = useMemo(
    () => (completedOnly ? counted.filter(isResponseCompleted) : counted),
    [counted, completedOnly]
  );
  const series = useMemo(() => timeSeries(viewSet, locale), [viewSet, locale]);
  const completedCount = counted.filter(isResponseCompleted).length;
  const incompleteCount = counted.length - completedCount;
  const completionRate = counted.length ? Math.round((completedCount / counted.length) * 100) : 0;
  const avgSeconds = viewSet.length
    ? Math.round(viewSet.reduce((sum, row) => sum + (Number(row.duration_seconds) || 0), 0) / viewSet.length)
    : 0;
  const lastSeven = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    return counted.filter((row) => new Date(row.created_at).getTime() >= cutoff).length;
  }, [counted]);

  const languages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of viewSet) {
      const key = row.language || 'unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const total = viewSet.length || 1;
    return [...counts.entries()]
      .map(([code, count]) => ({
        name: code === 'unknown' ? t.notSpecified : languageName(code),
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [viewSet, t.notSpecified]);

  const questionStats = useMemo<QuestionStat[]>(() => {
    return questions.map((question, questionIndex) => {
      const type = questionType(question);
      const values: unknown[] = [];
      let reached = 0;
      for (const row of viewSet) {
        if (!reachedQuestion(row, question.id, questionIndex)) continue;
        reached += 1;
        const answers = parseAnswers(row.answers);
        const value = answers[question.id];
        if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
        if (
          type === 'matrix' &&
          (typeof value !== 'object' || Array.isArray(value) || !Object.keys(value as object).length)
        ) {
          continue;
        }
        values.push(value);
      }
      const answered = values.length;
      const skipped = Math.max(0, reached - answered);
      const label = questionLabel(question, language);
      const payload = question.payload || {};

      if (type === 'text') {
        const samples = values.map((value) => String(value ?? '').trim()).filter(Boolean);
        const grouped = new Map<string, TextGroup>();
        for (const sample of samples) {
          const key = sample.toLowerCase();
          const existing = grouped.get(key);
          if (existing) existing.count += 1;
          else grouped.set(key, { text: sample, count: 1 });
        }
        const groups = [...grouped.values()].sort((a, b) => b.count - a.count);
        return {
          id: question.id,
          index: questionIndex + 1,
          label,
          type,
          reached,
          answered,
          skipped,
          kind: 'text' as const,
          options: [],
          mean: null,
          scaleMin: '',
          scaleMax: '',
          top: groups[0] ? { label: groups[0].text, count: groups[0].count, percent: answered ? Math.round((groups[0].count / answered) * 100) : 0 } : null,
          groups: groups.slice(0, 12),
          extra: Math.max(0, groups.length - 12),
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
        const top = [...options].sort((a, b) => b.count - a.count)[0] || null;
        return {
          id: question.id,
          index: questionIndex + 1,
          label,
          type,
          reached,
          answered,
          skipped,
          kind: 'scale' as const,
          options,
          mean,
          scaleMin: localizedField(payload.scaleMin, language, payload.baseLanguage),
          scaleMax: localizedField(payload.scaleMax, language, payload.baseLanguage),
          top: top && top.count ? top : null,
          groups: [],
          extra: 0,
        };
      }

      if (type === 'matrix') {
        const columns = questionOptions(question, language);
        const rowLabels = questionRows(question, language);
        const columnLists = [columns];
        const matrixRows = rowLabels.map((rowLabel, rowIndex) => {
          const counts = new Map<string, number>();
          let rowAnswered = 0;
          for (const value of values) {
            const col = selectedColumnIndex(value, rowIndex, columns, columnLists);
            if (col == null) continue;
            rowAnswered += 1;
            const key = columns[col] || String(col);
            counts.set(key, (counts.get(key) || 0) + 1);
          }
          const options = columns.map((key) => ({
            label: key,
            count: counts.get(key) || 0,
            percent: rowAnswered ? Math.round(((counts.get(key) || 0) / rowAnswered) * 100) : 0,
          }));
          const top = [...options].sort((a, b) => b.count - a.count)[0] || null;
          return {
            label: rowLabel,
            options,
            top: top && top.count ? top : null,
          };
        });
        const overallTop =
          matrixRows
            .flatMap((row) => (row.top ? [{ ...row.top, label: `${row.label}: ${row.top.label}` }] : []))
            .sort((a, b) => b.count - a.count)[0] || null;
        return {
          id: question.id,
          index: questionIndex + 1,
          label,
          type,
          reached,
          answered,
          skipped,
          kind: 'matrix' as const,
          options: [],
          mean: null,
          scaleMin: '',
          scaleMax: '',
          top: overallTop,
          groups: [],
          extra: 0,
          rows: matrixRows,
        };
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
      const top = [...options].sort((a, b) => b.count - a.count)[0] || null;
      return {
        id: question.id,
        index: questionIndex + 1,
        label,
        type,
        reached,
        answered,
        skipped,
        kind: 'choice' as const,
        options,
        mean: null,
        scaleMin: '',
        scaleMax: '',
        top: top && top.count ? top : null,
        groups: [],
        extra: 0,
      };
    });
  }, [questions, viewSet, language]);

  const selectedTitle = surveys.find((survey) => survey.id === surveyId)?.title;
  const completionSlices: Slice[] = [
    { label: t.completed, count: completedCount, percent: completionRate, fill: COLORS.navy },
    {
      label: t.inProgress,
      count: incompleteCount,
      percent: counted.length ? Math.round((incompleteCount / counted.length) * 100) : 0,
      fill: COLORS.muted,
    },
  ];
  const languageSlices = sliceColors(
    languages.map((item) => ({ label: item.name, count: item.count, percent: item.percent }))
  );

  return (
    <main className="flex-1">
      <header className="border-b border-line px-4 py-5 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="font-serif text-2xl font-semibold text-navy">{t.analytics}</h2>
            <p className="mt-1 max-w-[65ch] text-sm text-ink-muted">{t.analyticsIntro}</p>
          </div>
          <div className="w-full max-w-md lg:shrink-0">
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
        ) : counted.length === 0 ? (
          <div className="border border-line bg-surface px-6 py-12 text-center">
            <p className="text-ink-muted">{t.noResponsesForAnalytics}</p>
            <Button variant="secondary" className="mt-4" onClick={() => navigate(`/admin/surveys/${surveyId}`)}>
              {selectedTitle || t.surveys}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex border border-line" role="group" aria-label={t.analytics}>
                <button
                  type="button"
                  className={`min-h-10 px-3 text-sm ${!completedOnly ? 'bg-navy text-surface' : 'bg-surface text-ink'}`}
                  onClick={() => setCompletedOnly(false)}
                  aria-pressed={!completedOnly}
                >
                  {t.filterAll}
                </button>
                <button
                  type="button"
                  className={`min-h-10 px-3 text-sm ${completedOnly ? 'bg-navy text-surface' : 'bg-surface text-ink'}`}
                  onClick={() => setCompletedOnly(true)}
                  aria-pressed={completedOnly}
                >
                  {t.filterCompleted}
                </button>
              </div>
              <Button
                variant="secondary"
                onClick={() => navigate(surveyId ? `/admin/responses?survey=${encodeURIComponent(surveyId)}` : '/admin/responses')}
              >
                {t.viewAllResponses}
              </Button>
            </div>

            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <div className="border border-line bg-surface p-4">
                <p className="text-xs text-ink-muted">{t.totalResponses}</p>
                <p className="mt-1 font-serif text-3xl font-semibold tabular-nums text-navy">{viewSet.length}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {lastSeven} {t.lastSevenDays}
                </p>
              </div>
              <div className="border border-line bg-surface p-4">
                <p className="text-xs text-ink-muted">{t.completionRate}</p>
                <div className="mt-1 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-3xl font-semibold tabular-nums text-navy">{completionRate}%</p>
                    <ul className="mt-2 space-y-0.5 text-xs text-ink-muted">
                      {completionSlices.map((item) => (
                        <li key={item.label} className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="size-2 shrink-0" style={{ background: item.fill }} aria-hidden="true" />
                            <span className="truncate">{item.label}</span>
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {item.percent}%
                            <span className="ml-1">({item.count})</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <MiniDonut data={completionSlices} size={76} ariaLabel={t.completionSplit} />
                </div>
              </div>
              <div className="border border-line bg-surface p-4">
                <p className="text-xs text-ink-muted">{t.typicalTime}</p>
                <p className="mt-1 font-serif text-3xl font-semibold tabular-nums text-navy">{formatDuration(avgSeconds)}</p>
              </div>
              <div className="border border-line bg-surface p-4">
                <p className="text-xs text-ink-muted">{t.completed}</p>
                <div className="mt-1 flex items-center gap-3">
                  <p className="min-w-0 flex-1 font-serif text-3xl font-semibold tabular-nums text-navy">
                    {completedCount}
                    <span className="ml-1 text-base font-normal text-ink-muted">/ {counted.length}</span>
                  </p>
                  {languages.length > 1 && (
                    <MiniDonut data={languageSlices} size={64} ariaLabel={t.languageMix} />
                  )}
                </div>
                {languages.length > 1 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-ink-muted">
                    {languageSlices.map((item) => (
                      <li key={item.label} className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="size-2 shrink-0" style={{ background: item.fill }} aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {item.percent}%
                          <span className="ml-1">({item.count})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {series.length > 1 && (
              <section className="border border-line bg-surface p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-serif text-base font-semibold text-navy">{t.overTime}</h3>
                  <p className="text-xs text-ink-muted">
                    {series[0]?.label} – {series[series.length - 1]?.label}
                  </p>
                </div>
                <div className="mt-2">
                  <ResponsesOverTime series={series} title={t.overTime} />
                </div>
              </section>
            )}

            {questionStats.length > 1 && (
              <nav aria-label={t.jumpToQuestion} className="flex flex-wrap gap-1">
                {questionStats.map((stat) => (
                  <a
                    key={stat.id}
                    href={`#q-${stat.id}`}
                    className="inline-flex min-h-8 min-w-8 items-center justify-center border border-line bg-surface px-2 text-sm tabular-nums text-navy"
                  >
                    {stat.index}
                  </a>
                ))}
              </nav>
            )}

            <section className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-label={t.questionBreakdown}>
              {questionStats.map((stat) => {
                const wide =
                  stat.kind === 'matrix' ||
                  (stat.kind === 'text' && stat.groups.length > 5) ||
                  (stat.kind === 'choice' && stat.options.length > 8);
                return (
                  <article
                    key={stat.id}
                    id={`q-${stat.id}`}
                    className={`flex min-h-0 flex-col scroll-mt-20 border border-line bg-surface p-4 ${wide ? 'lg:col-span-2' : ''}`}
                  >
                    <p className="text-xs font-bold tracking-wide text-ink-subtle">
                      Q{stat.index} · {typeLabel(stat.type, t)}
                    </p>
                    <h3 className="mt-1 font-serif text-lg font-semibold text-navy">{stat.label}</h3>
                    <p className="mt-1 text-sm text-ink-muted">
                      {stat.answered} {t.peopleAnswered}
                      {stat.skipped > 0 ? ` · ${stat.skipped} ${t.peopleSkipped}` : ''}
                    </p>

                    {stat.kind === 'scale' && stat.mean != null && (
                      <p className="mt-3 font-serif text-2xl font-semibold tabular-nums text-navy">
                        {stat.mean}
                        <span className="ml-2 font-sans text-sm font-normal text-ink-muted">
                          {t.meanScore} {t.outOfFive}
                        </span>
                      </p>
                    )}

                    {stat.kind !== 'scale' && stat.top && stat.answered > 0 && !usesPie(stat) && (
                      <p className="mt-3 text-sm font-medium text-ink">
                        {stat.kind === 'text' && stat.top.count > 1
                          ? fill(t.sameAnswer, { n: stat.top.count })
                          : fill(t.mostChose, {
                              answer: displayChoice(stat.top.label, t),
                              percent: stat.top.percent,
                            })}
                      </p>
                    )}

                    <div className="mt-4 min-h-0 flex-1">
                      {stat.kind === 'matrix' ? (
                        stat.rows?.some((row) => row.options.some((option) => option.count > 0)) ? (
                          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            {stat.rows.map((row, rowIndex) => (
                              <div key={`${stat.id}-row-${rowIndex}`}>
                                <h4 className="mb-3 font-medium leading-snug text-ink">{row.label}</h4>
                                {row.options.some((option) => option.count > 0) ? (
                                  <ChoiceBars
                                    options={row.options}
                                    display={(label) => displayChoice(label, t)}
                                  />
                                ) : (
                                  <p className="text-sm text-ink-muted">{t.noAnswersRecorded}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-ink-muted">{t.noAnswersRecorded}</p>
                        )
                      ) : stat.kind === 'text' ? (
                        stat.groups.length ? (
                          <ul className={`space-y-2 ${wide ? 'columns-1 sm:columns-2 sm:gap-3' : ''} ${stat.groups.length > 6 ? 'max-h-72 overflow-y-auto' : ''}`}>
                            {stat.groups.map((group) => (
                              <li
                                key={group.text}
                                className="mb-2 break-inside-avoid flex items-start justify-between gap-3 border border-line bg-canvas px-3 py-2 text-sm"
                              >
                                <span className="min-w-0">{group.text}</span>
                                {group.count > 1 && (
                                  <span className="shrink-0 tabular-nums text-ink-muted">×{group.count}</span>
                                )}
                              </li>
                            ))}
                            {stat.extra > 0 && (
                              <li className="text-sm text-ink-muted">
                                +{stat.extra} {t.moreAnswers}
                              </li>
                            )}
                          </ul>
                        ) : (
                          <p className="text-sm text-ink-muted">{t.noAnswersRecorded}</p>
                        )
                      ) : !stat.options.some((option) => option.count > 0) ? (
                        <p className="text-sm text-ink-muted">{t.noAnswersRecorded}</p>
                      ) : stat.kind === 'scale' ? (
                        <ScaleBars options={stat.options} minLabel={stat.scaleMin} maxLabel={stat.scaleMax} />
                      ) : (
                        <>
                          {usesPie(stat) ? (
                            <ChoicePie
                              options={stat.options}
                              display={(label) => displayChoice(label, t)}
                              ariaLabel={stat.label}
                            />
                          ) : (
                            <ChoiceBars options={stat.options} display={(label) => displayChoice(label, t)} />
                          )}
                          {stat.type === 'multiple-choice' && (
                            <p className="mt-3 text-xs text-ink-muted">{t.selectAllThatApply}</p>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
