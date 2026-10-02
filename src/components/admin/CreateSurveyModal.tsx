import React, { useContext, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import ImportFromFile from './ImportFromFile';
import Button from '../chrome/Button';
import Field from '../chrome/Field';
import { AdminLanguageContext } from './AdminLayout';
import { adminTranslations } from './adminTranslations';

interface CreateSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate?: (survey: { id: string; title: string; description: string; status: string }) => void;
}

export default function CreateSurveyModal({ isOpen, onClose, onCreate }: CreateSurveyModalProps) {
  const { language } = useContext(AdminLanguageContext);
  const t = adminTranslations[language];
  const [tab, setTab] = useState<'blank' | 'ai'>('ai');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('6');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const finish = (survey: { id: string; title: string; description: string; status: string }) => {
    onCreate?.(survey);
    setTitle('');
    setDescription('');
    setEstimatedTime('6');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t.titleRequired);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error(t.notAuthenticated);
      const { data, error: createError } = await supabase
        .from('surveys')
        .insert([{
          title: title.trim(),
          description: description.trim(),
          estimated_time: parseInt(estimatedTime, 10) || 6,
          owner_id: user.id,
          status: 'draft',
        }])
        .select()
        .single();
      if (createError) throw createError;
      finish({
        id: data.id,
        title: data.title,
        description: data.description,
        status: data.status,
      });
    } catch (err: any) {
      setError(err?.message || t.failedToCreate);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="sheet flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-serif text-2xl font-semibold text-navy">{t.newSurvey}</h2>
          <button type="button" onClick={onClose} className="min-h-10 min-w-10" aria-label={t.close}>
            <X className="mx-auto size-5" />
          </button>
        </div>

        <div className="flex border-b border-line px-6">
          <button
            type="button"
            onClick={() => setTab('ai')}
            className={`min-h-12 px-3 text-sm font-bold ${tab === 'ai' ? 'border-b-2 border-navy text-navy' : 'text-ink-muted'}`}
          >
            {t.fromAiFile}
          </button>
          <button
            type="button"
            onClick={() => setTab('blank')}
            className={`min-h-12 px-3 text-sm font-bold ${tab === 'blank' ? 'border-b-2 border-navy text-navy' : 'text-ink-muted'}`}
          >
            {t.blankSurvey}
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-6">
          {tab === 'ai' ? (
            <ImportFromFile
              mode="create"
              onImported={(id) => finish({ id, title: t.importedSurvey, description: '', status: 'draft' })}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <p role="alert" className="border border-danger bg-danger-soft px-3 py-3 text-sm text-danger">
                  {error}
                </p>
              )}
              <Field
                id="title"
                label={t.surveyTitleLabel}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                disabled={isLoading}
                placeholder={t.titlePlaceholder}
              />
              <div className="space-y-2">
                <label htmlFor="description" className="block text-sm font-bold text-ink">
                  {t.description}
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  disabled={isLoading}
                  className="w-full border border-line-strong bg-surface px-3 py-3 text-base"
                />
              </div>
              <Field
                id="estimatedTime"
                label={t.estimatedMinutes}
                type="number"
                min={1}
                max={120}
                value={estimatedTime}
                onChange={(e) => setEstimatedTime(e.target.value)}
                disabled={isLoading}
              />
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? t.creating : t.createEmptySurvey}
                </Button>
                <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading} className="flex-1">
                  {t.cancel}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
