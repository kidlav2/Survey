import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Calendar, Clock, Globe, Mail, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import SkeletonSurveyCard from '../common/SkeletonSurveyCard';
import Button from '../chrome/Button';
import { AdminLanguageContext } from './AdminLayout';
import { adminTranslations } from './adminTranslations';
import {
  answerRowsForResponse,
  formatDuration,
  isResponseCompleted,
  languageName,
  type QuestionRow,
  type ResponseRow,
} from '../../lib/responseFormat';

export default function ResponseDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { language } = useContext(AdminLanguageContext);
  const t = adminTranslations[language];
  const [response, setResponse] = useState<(ResponseRow & { surveyTitle: string }) | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteResponse = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('responses').delete().eq('id', id);
      if (error) throw error;
      navigate('/admin/responses', { replace: true });
    } catch (error) {
      console.error('Error deleting response:', error);
      setDeleting(false);
    }
  };

  useEffect(() => {
    void loadResponseDetail();
  }, [id]);

  const loadResponseDetail = async () => {
    try {
      setLoading(true);
      const { data: responseData, error: responseError } = await supabase
        .from('responses')
        .select('*')
        .eq('id', id)
        .single();
      if (responseError) throw responseError;
      if (!responseData) {
        setResponse(null);
        return;
      }

      const { data: surveyData } = await supabase.from('surveys').select('title').eq('id', responseData.survey_id).single();
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('survey_id', responseData.survey_id)
        .order('sort_order', { ascending: true });
      if (questionsError) throw questionsError;

      setQuestions(questionsData || []);
      setResponse({
        ...responseData,
        surveyTitle: surveyData?.title || t.surveyTitle,
      });
    } catch (error) {
      console.error('Error loading response detail:', error);
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1">
        <header className="border-b border-line px-4 py-5 md:px-8">
          <h2 className="font-serif text-2xl font-semibold text-navy">{t.responseDetails}</h2>
        </header>
        <div className="p-4 md:p-8">
          <SkeletonSurveyCard />
        </div>
      </main>
    );
  }

  if (!response) {
    return (
      <main className="flex-1 p-8">
        <div className="border border-line bg-surface px-6 py-10 text-center">
          <p className="text-ink-muted">Response not found</p>
          <Button className="mt-4" onClick={() => navigate('/admin/responses')}>
            {t.backToResponses}
          </Button>
        </div>
      </main>
    );
  }

  const completed = isResponseCompleted(response);
  const rows = answerRowsForResponse(questions, response.answers, language);
  const answered = rows.filter((row) => !row.skipped);
  const skippedCount = rows.length - answered.length;

  return (
    <main className="flex-1">
      <header className="border-b border-line px-4 py-5 md:px-8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin/responses')}
              className="mt-1 min-h-11 min-w-11 text-ink-muted hover:text-ink"
              aria-label={t.backToResponses}
            >
              <ChevronLeft className="mx-auto size-5" />
            </button>
            <div>
              <h2 className="font-serif text-2xl font-semibold text-navy">{t.responseDetails}</h2>
              <p className="mt-1 text-sm text-ink-muted">{response.surveyTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="min-h-11 min-w-11 text-danger hover:bg-danger-soft"
            aria-label="Delete this response"
          >
            <Trash2 className="mx-auto size-5" />
          </button>
        </div>
      </header>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(28, 22, 16, 0.45)' }}>
          <div role="dialog" aria-modal="true" className="w-full max-w-sm border border-line bg-surface p-6">
            <h3 className="font-serif text-lg font-semibold text-navy">Delete this response?</h3>
            <p className="mt-2 text-sm text-ink-muted">This cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                {t.cancel}
              </Button>
              <Button variant="danger" onClick={() => void handleDeleteResponse()} disabled={deleting}>
                {deleting ? t.loading : t.delete}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 p-4 md:p-8">
        <section className="border border-line bg-surface p-5 md:p-6">
          <h3 className="font-serif text-lg font-semibold text-navy">Response information</h3>
          <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex gap-3">
              <Calendar className="mt-0.5 size-5 text-navy" aria-hidden="true" />
              <div>
                <dt className="text-sm text-ink-muted">{t.date}</dt>
                <dd className="text-sm font-medium">{new Date(response.created_at).toLocaleString()}</dd>
              </div>
            </div>
            <div className="flex gap-3">
              <Clock className="mt-0.5 size-5 text-navy" aria-hidden="true" />
              <div>
                <dt className="text-sm text-ink-muted">{t.duration}</dt>
                <dd className="text-sm font-medium">{formatDuration(response.duration_seconds)}</dd>
              </div>
            </div>
            <div className="flex gap-3">
              <Globe className="mt-0.5 size-5 text-navy" aria-hidden="true" />
              <div>
                <dt className="text-sm text-ink-muted">{t.language}</dt>
                <dd className="text-sm font-medium">{languageName(response.language)}</dd>
              </div>
            </div>
            <div className="flex gap-3">
              <Mail className="mt-0.5 size-5 text-navy" aria-hidden="true" />
              <div>
                <dt className="text-sm text-ink-muted">{t.email}</dt>
                <dd className="text-sm font-medium">{response.respondent_email || t.notProvided}</dd>
              </div>
            </div>
          </dl>
          <p className="mt-5 text-sm">
            <span className={`inline-flex min-h-8 items-center px-3 text-xs font-bold ${completed ? 'bg-ok-soft text-ok' : 'bg-accent-soft text-accent'}`}>
              {completed ? t.completed : t.inProgress}
            </span>
          </p>
        </section>

        <section className="border border-line bg-surface">
          <div className="border-b border-line px-5 py-4 md:px-6">
            <h3 className="font-serif text-lg font-semibold text-navy">Answers</h3>
            <p className="mt-1 text-sm text-ink-muted">
              {answered.length} {t.questionsAnswered}
              {skippedCount ? ` · ${skippedCount} ${t.skipped}` : ''}
            </p>
          </div>
          <div className="divide-y divide-line">
            {answered.length === 0 ? (
              <p className="px-5 py-8 text-ink-muted md:px-6">{t.noAnswersRecorded}</p>
            ) : (
              answered.map((row) => (
                <article key={row.id} className="px-5 py-5 md:px-6">
                  <p className="text-xs font-bold tracking-wide text-ink-subtle">Q{row.index}</p>
                  <h4 className="mt-1 font-medium text-ink">{row.label}</h4>
                  <p className="mt-3 border border-line-strong bg-canvas px-4 py-3 text-sm text-ink">
                    {row.answer}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>

        <Button variant="secondary" onClick={() => navigate('/admin/responses')}>
          {t.backToResponses}
        </Button>
      </div>
    </main>
  );
}
