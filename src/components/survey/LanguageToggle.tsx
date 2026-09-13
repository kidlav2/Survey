import React from 'react';
import { LANGUAGES, type Lng, cn } from '../../lib/cn';

interface LanguageToggleProps {
  currentLanguage: Lng;
  onLanguageChange: (lang: Lng) => void;
}

export default function LanguageToggle({ currentLanguage, onLanguageChange }: LanguageToggleProps) {
  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center border border-line bg-surface p-0.5"
    >
      {LANGUAGES.map((lang) => {
        const selected = currentLanguage === lang.code;
        return (
          <button
            key={lang.code}
            type="button"
            aria-pressed={selected}
            aria-label={lang.name}
            onClick={() => onLanguageChange(lang.code)}
            className={cn(
              'min-h-10 min-w-10 px-2.5 text-xs font-bold tracking-wide transition-colors duration-150',
              selected
                ? 'bg-navy text-surface'
                : 'text-ink-muted hover:bg-canvas hover:text-ink'
            )}
          >
            {lang.short}
          </button>
        );
      })}
    </div>
  );
}
