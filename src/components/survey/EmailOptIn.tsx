import React, { useState } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { translations } from './translations';
import { updateIgnoringUnknownColumns } from '../../lib/supabaseClient';
import { isLng, type Lng } from '../../lib/cn';
import { getStoredLanguage, getStoredResponseId, setStoredLanguage } from '../../lib/surveySession';
import SurveyShell from '../chrome/SurveyShell';
import Button from '../chrome/Button';
import Field from '../chrome/Field';

export default function EmailOptIn() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const lngFromQuery = searchParams.get('lng');
  const ridFromQuery = searchParams.get('rid');
  const persistedLng = id ? getStoredLanguage(id) : null;
  const initialLng: Lng = isLng(lngFromQuery)
    ? lngFromQuery
    : isLng((location.state as { language?: string } | null)?.language)
      ? ((location.state as { language: Lng }).language)
      : isLng(persistedLng)
        ? persistedLng
        : 'en';

  const [language, setLanguage] = useState<Lng>(initialLng);
  const [optIn, setOptIn] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const persistedRid = id ? getStoredResponseId(id) : null;
  const responseId =
    (location.state as { responseId?: string } | null)?.responseId || ridFromQuery || persistedRid || null;

  const t = translations[language]?.optIn || translations.en.optIn;

  const goThankYou = (lng: Lng) => {
    const rid = responseId ? `&rid=${encodeURIComponent(responseId)}` : '';
    navigate(`/survey/${id}/thank-you?lng=${encodeURIComponent(lng)}${rid}`, { state: { language: lng } });
  };

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (optIn && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setSubmitting(true);
    setEmailError('');

    try {
      if (responseId) {
        await updateIgnoringUnknownColumns(
          'responses',
          optIn && trimmed
            ? { respondent_email: trimmed, opted_in: true, completed: true, status: 'completed' }
            : { opted_in: false, completed: true, status: 'completed' },
          responseId
        );
      }
    } catch {
      /* still let the participant finish */
    }

    if (id) setStoredLanguage(id, language);
    goThankYou(language);
  };

  return (
    <SurveyShell
      language={language}
      onLanguageChange={(lng) => {
        setLanguage(lng);
        if (id) setStoredLanguage(id, lng);
        const rid = responseId ? `&rid=${encodeURIComponent(responseId)}` : '';
        navigate(`/survey/${id}/opt-in?lng=${encodeURIComponent(lng)}${rid}`, {
          replace: true,
          state: { ...(location.state as object), language: lng },
        });
      }}
    >
      <article className="sheet px-6 py-10 md:px-12 md:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-subtle">Optional</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-navy">{t.title}</h1>
        <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-ink-muted">{t.description}</p>

        <label className="mt-8 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
            className="mt-1 size-5 shrink-0 accent-navy"
          />
          <span>
            <span className="block font-bold text-ink">{t.checkbox}</span>
            <span className="mt-1 block text-sm text-ink-muted">{t.checkboxDetail}</span>
          </span>
        </label>

        {optIn && (
          <div className="mt-6">
            <Field
              id="opt-in-email"
              label={t.emailLabel}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              error={emailError}
            />
          </div>
        )}

        <aside className="mt-8 border border-line bg-canvas px-4 py-4 text-sm leading-relaxed text-ink-muted">
          <p className="font-bold text-ink">{t.privacyTitle}</p>
          <p className="mt-1">{t.privacyText}</p>
        </aside>

        <div className="mt-10">
          <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
            {submitting ? '…' : t.submitButton}
          </Button>
        </div>
      </article>
    </SurveyShell>
  );
}
