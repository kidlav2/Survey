import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { translations } from './translations';
import { supabase } from '../../lib/supabaseClient';
import SurveyShell from '../chrome/SurveyShell';
import Button from '../chrome/Button';
import {
  chromeLng,
  initialSurveyLanguage,
  languagesFromMaps,
  parseLocalizedJson,
  pickLocalizedText,
  toggleLanguagesForSurvey,
} from '../../lib/languages';
import { getStoredLanguage, hasSurveyDraft, setStoredLanguage } from '../../lib/surveySession';
import { canPreviewInactiveSurvey, isPreviewRequest, withPreviewParam } from '../../lib/surveyPreview';

export default function SurveyWelcome() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  const searchLng = new URLSearchParams(location.search).get('lng');
  const stateLng = (location.state as { lng?: string; language?: string } | null)?.lng
    ?? (location.state as { language?: string } | null)?.language;
  const persistedLng = id ? getStoredLanguage(id) : null;
  const initialLanguage = initialSurveyLanguage(stateLng || searchLng, persistedLng);

  const [language, setLanguage] = useState(initialLanguage);
  const [survey, setSurvey] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [previewMode, setPreviewMode] = useState(isPreviewRequest(location.search));

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('surveys')
          .select('id, title, description, estimated_time, status, show_survey_info, owner_id')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (cancelled) return;

        const wantsPreview = isPreviewRequest(location.search);
        if (data?.status !== 'active') {
          const allowed = wantsPreview && (await canPreviewInactiveSurvey(id, data?.owner_id));
          if (!allowed) {
            navigate(`/survey/${id}/closed`, { replace: true });
            return;
          }
          if (!cancelled) setPreviewMode(true);
        }

        setSurvey(data);
      } catch {
        if (!cancelled) setUnavailable(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, location.search, navigate]);

  const t = translations[chromeLng(language)]?.welcome || translations.en.welcome;
  const showInfo = survey?.show_survey_info !== false;
  const canContinue = Boolean(id && hasSurveyDraft(id));
  const descriptionMap = parseLocalizedJson(survey?.description);
  const contentLanguages = languagesFromMaps(descriptionMap);
  const toggleLanguages = toggleLanguagesForSurvey(language, contentLanguages);

  const getDescriptionForLanguage = () => {
    if (!survey?.description) return t.description;
    return pickLocalizedText(survey.description, language, t.description);
  };

  const handleLanguageChange = (lng: string) => {
    setLanguage(lng);
    if (id) setStoredLanguage(id, lng);
    navigate(withPreviewParam(`/survey/${id}/welcome?lng=${encodeURIComponent(lng)}`, previewMode), {
      replace: true,
      state: { lng, language: lng },
    });
  };

  const handleStart = () => {
    if (id) setStoredLanguage(id, language);
    navigate(withPreviewParam(`/survey/${id}/questions?lng=${encodeURIComponent(language)}`, previewMode), {
      state: { lng: language, language, preview: previewMode },
    });
  };

  useEffect(() => {
    if (unavailable && id) navigate(`/survey/${id}/closed`, { replace: true });
  }, [unavailable, id, navigate]);

  if (unavailable) return null;

  return (
    <SurveyShell
      language={language}
      onLanguageChange={handleLanguageChange}
      languages={toggleLanguages}
      notice={previewMode ? (t.previewBanner || t.previewLabel) : undefined}
    >
      <article className="sheet px-6 py-10 md:px-12 md:py-14">
        {loading ? (
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            <div className="h-8 w-2/3 bg-canvas" />
            <div className="h-4 w-full bg-canvas" />
            <div className="h-4 w-5/6 bg-canvas" />
          </div>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-subtle">
              {t.footer}
            </p>
            <h1 className="mt-3 font-serif text-4xl font-semibold text-navy md:text-5xl">
              {survey?.title || t.title}
            </h1>
            {showInfo && (
              <div className="mt-6 max-w-[65ch] space-y-4 text-base leading-relaxed text-ink-muted">
                {getDescriptionForLanguage()
                  .split('\n')
                  .map((paragraph: string, index: number) =>
                    paragraph.trim() ? <p key={index}>{paragraph}</p> : null
                  )}
              </div>
            )}
            {showInfo && (
              <p className="mt-8 border-t border-line pt-6 text-sm text-ink-muted">
                <span className="font-bold text-ink">{t.estimatedTime}: </span>
                {survey?.estimated_time || '4'} {t.minutes || 'minutes'}
              </p>
            )}
            <p className="mt-4 max-w-[65ch] text-sm leading-relaxed text-ink-muted">{t.privacy}</p>
            <div className="mt-10">
              <Button onClick={handleStart} className="w-full sm:w-auto">
                {canContinue ? t.continueButton || t.startButton : t.startButton}
              </Button>
            </div>
          </>
        )}
      </article>
    </SurveyShell>
  );
}
