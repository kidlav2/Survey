import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, FileJson } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import ExportModal from './ExportModal';
import Toast from '../common/Toast';
import SkeletonDashboard from '../common/SkeletonDashboard';
import { adminTranslations } from './adminTranslations';
import { AdminLanguageContext } from './AdminLayout';
import { formatDuration, isResponseCompleted, isCountableResponse, type QuestionRow, type ResponseRow } from '../../lib/responseFormat';
import { exportResponsesFile } from '../../lib/surveyExport';
import Button from '../chrome/Button';

export default function Responses() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useContext(AdminLanguageContext);
  const t = adminTranslations[language];
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [surveys, setSurveys] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportModalType, setExportModalType] = useState<'CSV' | 'JSON' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [filterSurvey, setFilterSurvey] = useState(() => searchParams.get('survey') || 'all');

  useEffect(() => {
    void loadResponses();
    const onFocus = () => {
      if (!document.hidden) void loadResponses();
    };
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, []);

  useEffect(() => {
    const next = searchParams.get('survey') || 'all';
    setFilterSurvey(next);
  }, [searchParams]);

  useEffect(() => {
    if (!surveys.length || filterSurvey === 'all') return;
    if (!surveys.some((survey) => survey.id === filterSurvey)) {
      setFilterSurvey('all');
      setSearchParams({});
    }
  }, [surveys, filterSurvey, setSearchParams]);

  const selectFilter = (id: string) => {
    setFilterSurvey(id);
    if (id === 'all') setSearchParams({});
    else setSearchParams({ survey: id });
  };

  const loadResponses = async () => {
    try {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Not authenticated');

      const { data: surveyRows, error: surveysError } = await supabase
        .from('surveys')
        .select('id, title')
        .eq('owner_id', user.id);
      if (surveysError) throw surveysError;
      setSurveys(surveyRows || []);
      const surveyIds = (surveyRows || []).map((survey) => survey.id);
      if (!surveyIds.length) {
        setResponses([]);
        setQuestions([]);
        return;
      }

      const [{ data: allResponses, error: responsesError }, { data: allQuestions, error: questionsError }] = await Promise.all([
        supabase.from('responses').select('*').in('survey_id', surveyIds).order('created_at', { ascending: false }),
        supabase.from('questions').select('*').in('survey_id', surveyIds).order('sort_order', { ascending: true }),
      ]);
      if (responsesError) throw responsesError;
      if (questionsError) throw questionsError;
      setResponses(allResponses || []);
      setQuestions(allQuestions || []);
    } catch (error) {
      console.error('Error loading responses:', error);
      setToast({ message: 'Failed to load responses', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const surveyTitles = useMemo(
    () => Object.fromEntries(surveys.map((survey) => [survey.id, survey.title])),
    [surveys]
  );

  const visible = useMemo(() => {
    const filtered = responses.filter(
      (row) => isCountableResponse(row) && (filterSurvey === 'all' || row.survey_id === filterSurvey)
    );
    return sortBy === 'newest' ? filtered : [...filtered].reverse();
  }, [responses, filterSurvey, sortBy]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const week = new Date();
    week.setDate(week.getDate() - 7);
    const completed = visible.filter(isResponseCompleted).length;
    return {
      totalResponses: visible.length,
      today: visible.filter((row) => new Date(row.created_at) >= today).length,
      thisWeek: visible.filter((row) => new Date(row.created_at) > week).length,
      completionRate: visible.length ? Math.round((completed / visible.length) * 100) : 0,
    };
  }, [visible]);

  const handleExport = async (
    type: 'CSV' | 'JSON',
    exportOptions?: { includeResponses: boolean; includeContacts: boolean; dateRange: string }
  ) => {
    try {
      const options = exportOptions || { includeResponses: true, includeContacts: false, dateRange: 'all' };
      const surveyTitle = filterSurvey === 'all' ? 'all-surveys' : surveyTitles[filterSurvey];
      const scopedQuestions = filterSurvey === 'all' ? questions : questions.filter((q) => q.survey_id === filterSurvey);
      exportResponsesFile({
        type,
        responses: visible,
        questions: scopedQuestions,
        surveyTitle,
        surveyTitles,
        includeResponses: options.includeResponses,
        includeContacts: options.includeContacts,
        dateRange: options.dateRange,
        language,
      });
      setToast({ message: t.exportedSuccessfully.replace('{type}', type), type: 'success' });
      setExportModalType(null);
    } catch (error) {
      console.error('Error exporting:', error);
      setToast({ message: error instanceof Error ? error.message : 'Failed to export data', type: 'error' });
    }
  };

  if (loading) {
    return (
      <main className="flex-1">
        <header className="border-b border-line px-4 py-5 md:px-8">
          <h2 className="font-serif text-2xl font-semibold text-navy">{t.responsesPage}</h2>
        </header>
        <div className="p-4 md:p-8">
          <SkeletonDashboard />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <header className="border-b border-line px-4 py-5 md:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-navy">{t.responsesPage}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t.viewAndAnalyze}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setExportModalType('CSV')}>
              <Download className="size-4" />
              {t.exportCSV}
            </Button>
            <Button variant="secondary" onClick={() => setExportModalType('JSON')}>
              <FileJson className="size-4" />
              {t.exportJSON}
            </Button>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: t.totalResponses, value: stats.totalResponses },
            { label: t.today, value: stats.today },
            { label: t.thisWeek, value: stats.thisWeek },
            { label: t.completionRate, value: `${stats.completionRate}%` },
          ].map((stat) => (
            <div key={stat.label} className="border border-line bg-surface p-5">
              <p className="text-sm text-ink-muted">{stat.label}</p>
              <p className="mt-2 font-serif text-3xl font-semibold text-navy">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden border border-line bg-surface">
          <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
            <h3 className="font-serif text-lg font-semibold text-navy">
              {filterSurvey === 'all' ? t.allResponses : surveyTitles[filterSurvey] || t.allResponses}
            </h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="filter-survey">
                {t.allSurveys}
              </label>
              <select
                id="filter-survey"
                value={filterSurvey}
                onChange={(e) => selectFilter(e.target.value)}
                className="min-h-11 border border-line-strong bg-surface px-3 text-sm"
              >
                <option value="all">{t.allSurveys}</option>
                {surveys.map((survey) => (
                  <option key={survey.id} value={survey.id}>
                    {survey.title}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="sort-responses">
                {t.sort}
              </label>
              <select
                id="sort-responses"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
                className="min-h-11 border border-line-strong bg-surface px-3 text-sm"
              >
                <option value="newest">{t.newestFirst}</option>
                <option value="oldest">{t.oldestFirst}</option>
              </select>
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="p-6 text-center text-ink-muted">{t.noResponses}</p>
          ) : (
            <>
              <div className="block md:hidden">
                {visible.map((response) => {
                  const completed = isResponseCompleted(response);
                  return (
                    <div key={response.id} className="border-b border-line p-4 last:border-b-0">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{surveyTitles[response.survey_id] || response.id.slice(0, 8)}</span>
                        <span className={`px-2 py-0.5 text-xs font-bold ${completed ? 'bg-ok-soft text-ok' : 'bg-accent-soft text-accent'}`}>
                          {completed ? t.completed : t.inProgress}
                        </span>
                      </div>
                      <p className="text-sm text-ink-muted">{new Date(response.created_at).toLocaleString()}</p>
                      <p className="text-sm">{response.respondent_email || t.notProvided}</p>
                      <Button variant="secondary" className="mt-3 w-full" onClick={() => navigate(`/admin/responses/${response.id}${filterSurvey !== 'all' ? `?survey=${encodeURIComponent(filterSurvey)}` : ''}`)}>
                        {t.view}
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead className="border-b border-line bg-canvas">
                    <tr>
                      {[t.surveyTitle, t.date, t.email, t.status, t.duration, t.view].map((heading) => (
                        <th key={heading} className="px-6 py-3 text-left text-xs font-bold tracking-wide text-ink-muted uppercase">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((response) => {
                      const completed = isResponseCompleted(response);
                      return (
                        <tr key={response.id} className="border-b border-line last:border-b-0">
                          <td className="px-6 py-4 text-sm font-medium">{surveyTitles[response.survey_id] || response.id.slice(0, 8)}</td>
                          <td className="px-6 py-4 text-sm">{new Date(response.created_at).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm">{response.respondent_email || t.notProvided}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 text-xs font-bold ${completed ? 'bg-ok-soft text-ok' : 'bg-accent-soft text-accent'}`}>
                              {completed ? t.completed : t.inProgress}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">{formatDuration(response.duration_seconds)}</td>
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/responses/${response.id}${filterSurvey !== 'all' ? `?survey=${encodeURIComponent(filterSurvey)}` : ''}`)}
                              className="min-h-11 text-sm font-bold text-navy hover:underline"
                            >
                              {t.view}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {exportModalType && (
        <ExportModal
          isOpen={true}
          onClose={() => setExportModalType(null)}
          type={exportModalType}
          onExport={(options) => handleExport(exportModalType, options)}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} isVisible={true} onClose={() => setToast(null)} />
      )}
    </main>
  );
}
