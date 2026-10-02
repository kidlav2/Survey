import React from 'react';
import { LANGUAGES, cn } from '../../lib/cn';
import { languageOption, type LanguageOption } from '../../lib/languages';

interface LanguageToggleProps {
  currentLanguage: string;
  onLanguageChange: (lang: string) => void;
  languages?: LanguageOption[];
}

export default function LanguageToggle({
  currentLanguage,
  onLanguageChange,
  languages = LANGUAGES,
}: LanguageToggleProps) {
  const options = languages.length ? languages : LANGUAGES;
  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex max-w-full flex-wrap items-center border border-line bg-surface p-0.5"
    >
      {options.map((lang) => {
        const option = languageOption(lang.code);
        const selected = currentLanguage === option.code;
        return (
          <button
            key={option.code}
            type="button"
            aria-pressed={selected}
            aria-label={option.name}
            onClick={() => onLanguageChange(option.code)}
            className={cn(
              'min-h-10 min-w-10 px-2.5 text-xs font-bold tracking-wide transition-colors duration-150',
              selected
                ? 'bg-navy text-surface'
                : 'text-ink-muted hover:bg-canvas hover:text-ink'
            )}
          >
            {option.short}
          </button>
        );
      })}
    </div>
  );
}
