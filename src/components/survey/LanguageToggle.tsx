import React from 'react';

interface LanguageToggleProps {
  currentLanguage: 'en' | 'ru' | 'fr' | 'es';
  onLanguageChange: (lang: 'en' | 'ru' | 'fr' | 'es') => void;
}

export default function LanguageToggle({ currentLanguage, onLanguageChange }: LanguageToggleProps) {
  const languages: Array<'en' | 'ru' | 'fr' | 'es'> = ['en', 'ru', 'fr', 'es'];

  return (
    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
      {languages.map((lang) => (
        <button
          key={lang}
          onClick={() => onLanguageChange(lang)}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            currentLanguage === lang
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}