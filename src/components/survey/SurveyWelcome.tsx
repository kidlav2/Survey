import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { translations } from './translations';
import { supabase } from '../../lib/supabaseClient';
import SurveyShell from '../chrome/SurveyShell';
import Button from '../chrome/Button';
import { isLng, type Lng } from '../../lib/cn';
import { getStoredLanguage, setStoredLanguage } from '../../lib/surveySession';

export default function SurveyWelcome() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  const searchLng = new URLSearchParams(location.search).get('lng');
  const stateLng = (location.state as { lng?: string; language?: string } | null)?.lng
    ?? (location.state as { language?: string } | null)?.language;
  const persistedLng = id ? getStoredLanguage(id) : null;
  const initialLanguage: Lng = isLng(stateLng)
    ? stateLng
    : isLng(searchLng)
      ? searchLng
      : isLng(persistedLng)
        ? persistedLng
        : 'en';

  const [language, setLanguage] = useState<Lng>(initialLanguage);
  const [survey, setSurvey] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('surveys')
          .select('id, title, description, estimated_time, status, show_survey_info')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (cancelled) return;

        if (data?.status !== 'active') {
          navigate(`/survey/${id}/closed`, { replace: true });
          return;
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
  }, [id, navigate]);

  const t = translations[language]?.welcome || translations.en.welcome;
  const showInfo = survey?.show_survey_info !== false;

  const getDescriptionForLanguage = () => {
    if (!survey?.description) return t.description;
    try {
      const parsed = JSON.parse(survey.description);
      if (parsed && typeof parsed === 'object') {
        return parsed[language] || parsed.en || t.description;
      }
    } catch {
      return survey.description;
    }
    return t.description;
  };

  const handleLanguageChange = (lng: Lng) => {
    setLanguage(lng);
    if (id) setStoredLanguage(id, lng);
    navigate(`/survey/${id}/welcome?lng=${encodeURIComponent(lng)}`, {
      replace: true,
      state: { lng, language: lng },
    });
  };

  const handleStart = () => {
    if (id) setStoredLanguage(id, language);
    navigate(`/survey/${id}/questions?lng=${encodeURIComponent(language)}`, {
      state: { lng: language, language },
    });
  };

  useEffect(() => {
    if (unavailable && id) navigate(`/survey/${id}/closed`, { replace: true });
  }, [unavailable, id, navigate]);

  if (unavailable) return null;

  return (
    <SurveyShell language={language} onLanguageChange={handleLanguageChange}>
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
                {t.startButton}
              </Button>
            </div>
          </>
        )}
      </article>
    </SurveyShell>
  );
}
