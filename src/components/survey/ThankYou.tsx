import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { translations } from './translations';
import { isLng, type Lng } from '../../lib/cn';
import { getStoredLanguage, setStoredLanguage } from '../../lib/surveySession';
import SurveyShell from '../chrome/SurveyShell';

export default function ThankYou() {
  const { id } = useParams();
  const location = useLocation();
  const searchLng = new URLSearchParams(location.search).get('lng');
  const persisted = id ? getStoredLanguage(id) : null;
  const initial: Lng = isLng((location.state as { language?: string } | null)?.language)
    ? (location.state as { language: Lng }).language
    : isLng(searchLng)
      ? searchLng
      : isLng(persisted)
        ? persisted
        : 'en';

  const [language, setLanguage] = useState<Lng>(initial);
  const [thankYouMessage, setThankYouMessage] = useState('');

  const t = translations[language]?.thankYou || translations.en.thankYou;

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
        /* default copy is enough */
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
    >
      <article className="sheet px-6 py-10 md:px-12 md:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-ok">Recorded</p>
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
