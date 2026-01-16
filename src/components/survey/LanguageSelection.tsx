import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Globe } from 'lucide-react';

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
] as const;

type Lng = (typeof languages)[number]['code'];

export default function LanguageSelection() {
  const navigate = useNavigate();
  const { id } = useParams();

  const handleLanguageSelect = (lng: Lng) => {
    if (!id) return;

    // Persist for refresh safety
    localStorage.setItem(`survey_lng_${id}`, lng);

    // Go to welcome screen
    navigate(`/survey/${id}/welcome?lng=${encodeURIComponent(lng)}`, {
      state: { lng, language: lng },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Globe className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Choose your language</h1>
            <p className="text-sm text-gray-600">Select your preferred language to continue</p>
          </div>

          <div className="space-y-3">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => handleLanguageSelect(l.code)}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group"
              >
                <span className="text-2xl" role="img" aria-label={l.name}>
                  {l.flag}
                </span>
                <span className="flex-1 text-lg font-medium text-gray-900 group-hover:text-indigo-900">
                  {l.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">Internal Survey Research Project</p>
        </div>
      </div>
    </div>
  );
}
