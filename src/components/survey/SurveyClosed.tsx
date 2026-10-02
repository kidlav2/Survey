import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CHROME_UI, chromeLng, initialSurveyLanguage } from '../../lib/languages';
import { getStoredLanguage } from '../../lib/surveySession';
import SurveyShell from '../chrome/SurveyShell';

export default function SurveyClosed() {
  const navigate = useNavigate();
  const { id } = useParams();
  const persisted = id ? getStoredLanguage(id) : null;
  const language = initialSurveyLanguage(null, persisted);
  const chrome = CHROME_UI[chromeLng(language)];

  return (
    <SurveyShell language={language} onLanguageChange={() => {}} showLanguage={false}>
      <article className="sheet px-6 py-10 md:px-12 md:py-14">
        <h1 className="font-serif text-4xl font-semibold text-navy">{chrome.surveyClosedTitle}</h1>
        <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-ink-muted">
          {chrome.surveyClosedBody}
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-8 text-sm font-bold text-navy underline decoration-from-font underline-offset-4"
        >
          {chrome.back}
        </button>
      </article>
    </SurveyShell>
  );
}
