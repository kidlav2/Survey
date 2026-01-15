import React, { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Mail, Shield } from 'lucide-react';
import LanguageToggle from './LanguageToggle';
import { translations } from './translations';

export default function EmailOptIn() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [language, setLanguage] = useState<'en' | 'ru' | 'fr' | 'es'>(location.state?.language || 'en');
  const [optIn, setOptIn] = useState(false);
  const [email, setEmail] = useState('');

  const t = translations[language]?.optIn || translations.en.optIn;

  const handleSubmit = () => {
    navigate(`/survey/${id}/thank-you`, { state: { language } });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      {/* Language Toggle */}
      <div className="fixed top-6 right-6">
        <LanguageToggle currentLanguage={language} onLanguageChange={setLanguage} />
      </div>

      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 rounded-full mb-4">
              <Mail className="w-7 h-7 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              {t.title}
            </h2>
            <p className="text-gray-600">
              {t.description}
            </p>
          </div>

          {/* Opt-in Checkbox */}
          <div className="mb-6">
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center mt-0.5">
                <input
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  className="w-5 h-5 border-2 border-gray-300 rounded cursor-pointer 
                           checked:bg-indigo-600 checked:border-indigo-600
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                />
              </div>
              <div>
                <span className="text-gray-900 font-medium">
                  {t.checkbox}
                </span>
                <p className="text-sm text-gray-600 mt-1">
                  {t.checkboxDetail}
                </p>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Trust Note */}
          <div className="bg-gray-50 rounded-lg p-4 mb-8 border border-gray-200">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-900 mb-1">{t.privacyTitle}</p>
                <p>
                  {t.privacyText}
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={optIn && !email}
            className={`w-full py-4 px-6 rounded-lg font-medium transition-colors ${
              optIn && !email
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {t.submitButton}
          </button>
        </div>
      </div>
    </div>
  );
}