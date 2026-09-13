import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { translations } from './translations';
import { isLng, type Lng } from '../../lib/cn';
import { getStoredLanguage } from '../../lib/surveySession';
import SurveyShell from '../chrome/SurveyShell';

export default function SurveyClosed() {
  const navigate = useNavigate();
  const { id } = useParams();
  const persisted = id ? getStoredLanguage(id) : null;
  const language: Lng = isLng(persisted) ? persisted : 'en';
  const t = translations[language]?.welcome || translations.en.welcome;

  return (
    <SurveyShell language={language} onLanguageChange={() => {}} showLanguage={false}>
      <article className="sheet px-6 py-10 md:px-12 md:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-subtle">
          {t.footer}
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-navy">Survey closed</h1>
        <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-ink-muted">
          This survey is not accepting responses right now. If you think that is a mistake, contact
          the person who sent you the link.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-8 text-sm font-bold text-navy underline decoration-from-font underline-offset-4"
        >
          Back
        </button>
      </article>
    </SurveyShell>
  );
}
