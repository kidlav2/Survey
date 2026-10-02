import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { translations } from './translations';
import { chromeLng, initialSurveyLanguage } from '../../lib/languages';
import SurveyShell from '../chrome/SurveyShell';
import { getStoredLanguage, setStoredLanguage } from '../../lib/surveySession';
import { isPreviewRequest } from '../../lib/surveyPreview';

export default function ThankYou() {
  const { id } = useParams();
  const location = useLocation();
  const searchLng = new URLSearchParams(location.search).get('lng');
  const persisted = id ? getStoredLanguage(id) : null;
  const initial = initialSurveyLanguage(
    (location.state as { language?: string } | null)?.language || searchLng,
    persisted
  );

  const [language, setLanguage] = useState(initial);
  const [thankYouMessage, setThankYouMessage] = useState('');

  const t = translations[chromeLng(language)]?.thankYou || translations.en.thankYou;
  const previewMode =
    isPreviewRequest(location.search) || Boolean((location.state as { preview?: boolean } | null)?.preview);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('surveys')
          .select('thank_you_message')
          .eq('id', id)
          .single();
        if (!cancelled && data?.thank_you_message) {
          setThankYouMessage(data.thank_you_message);
        }
      } catch {
        /* keep default copy */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <SurveyShell
      language={language}
      onLanguageChange={(lng) => {
        setLanguage(lng);
        if (id) setStoredLanguage(id, lng);
      }}
      notice={
        previewMode
          ? translations[chromeLng(language)]?.welcome?.previewBanner || translations.en.welcome.previewBanner
          : undefined
      }
    >
      <article className="sheet px-6 py-10 md:px-12 md:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-ok">{t.recorded || 'Recorded'}</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-navy">{t.title}</h1>
        <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-ink-muted">
          {thankYouMessage || t.description}
        </p>
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="font-serif text-xl font-semibold text-ink">{t.nextStepsTitle}</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-muted">
            {t.nextSteps.map((step: string, index: number) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </section>
        <p className="mt-10 text-sm text-ink-subtle">{t.footer}</p>
      </article>
    </SurveyShell>
  );
}
