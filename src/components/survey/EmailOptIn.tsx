import React, { useState } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { Mail, Shield } from 'lucide-react';
import LanguageToggle from './LanguageToggle';
import { translations } from './translations';
import { supabase } from '../../lib/supabaseClient';

export default function EmailOptIn() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  type Lng = 'en' | 'ru' | 'fr' | 'es';
  const lngFromQuery = searchParams.get('lng') as Lng | null;
  const ridFromQuery = searchParams.get('rid');

  const persistedLng = id ? (localStorage.getItem(`survey_lng_${id}`) as Lng | null) : null;
  const initialLng: Lng = (lngFromQuery && ['en', 'ru', 'fr', 'es'].includes(lngFromQuery))
    ? lngFromQuery
    : (location.state?.language as Lng) || persistedLng || 'en';

  const [language, setLanguage] = useState<Lng>(initialLng);
  const [optIn, setOptIn] = useState(false);
  const [email, setEmail] = useState('');

  // responseId can arrive via route state OR query param OR localStorage
  const persistedRid = id ? localStorage.getItem(`survey_rid_${id}`) : null;
  const responseId = (location.state?.responseId as string | undefined) || ridFromQuery || persistedRid || null;

  const t = translations[language]?.optIn || translations.en.optIn;

  const handleSubmit = async () => {
    if (id && responseId) {
      localStorage.setItem(`survey_rid_${id}`, responseId);
    }

    // If opted-in and email provided
    if (optIn && email) {
      try {
        if (!responseId) {
          console.warn('Response ID not found; cannot save email. Ensure SurveyFlow navigates with rid param or state.responseId.', {
            state: location.state,
            ridFromQuery,
            persistedRid,
          });
        } else {
          const { error } = await supabase
            .from('responses')
            .update({ respondent_email: email })
            .eq('id', responseId);

          if (import.meta.env.DEV) {
            console.log('Saving opt-in email for response:', { responseId, email });
          }

          if (error) throw error;
        }
      } catch (error) {
        console.error('Error saving email:', error);
        // Do not block navigation
      }
    }

    // Navigate regardless
    if (id) localStorage.setItem(`survey_lng_${id}`, language);
    const rid = responseId ? `&rid=${encodeURIComponent(responseId)}` : '';
    navigate(`/survey/${id}/thank-you?lng=${encodeURIComponent(language)}${rid}`, { state: { language } });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      {/* Language Toggle */}
      <div className="fixed top-6 right-6">
        <LanguageToggle
          currentLanguage={language}
          onLanguageChange={(lng) => {
            setLanguage(lng);
            if (id) localStorage.setItem(`survey_lng_${id}`, lng);
            const rid = responseId ? `&rid=${encodeURIComponent(responseId)}` : '';
            navigate(`/survey/${id}/opt-in?lng=${encodeURIComponent(lng)}${rid}`, {
              replace: true,
              state: { ...location.state, language: lng },
            });
          }}
        />
      </div>

      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 rounded-full mb-4">
              <Mail className="w-7 h-7 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">{t.title}</h2>
            <p className="text-gray-600">{t.description}</p>
          </div>

          {/* Opt-in Checkbox */}
          <div className="mb-6">
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center mt-0.5">
                <input
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  className="w-5 h-5 border-2 border-gray-300 rounded cursor-pointer checked:bg-indigo-600 checked:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                />
              </div>
              <div>
                <span className="text-gray-900 font-medium">{t.checkbox}</span>
                <p className="text-sm text-gray-600 mt-1">{t.checkboxDetail}</p>
              </div>
            </label>
          </div>

          {/* Email Input (conditional) */}
          {optIn && (
            <div className="mb-6 animate-fadeIn">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                {t.emailLabel}
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Trust Note */}
          <div className="bg-gray-50 rounded-lg p-4 mb-8 border border-gray-200">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-900 mb-1">{t.privacyTitle}</p>
                <p>{t.privacyText}</p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={optIn && !email}
            className={`w-full py-4 px-6 rounded-lg font-medium transition-colors ${
              optIn && !email ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {t.submitButton}
          </button>
        </div>
      </div>
    </div>
  );
}