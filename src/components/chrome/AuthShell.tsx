import React from 'react';
import { LANGUAGES, type Lng, cn } from '../../lib/cn';

interface AuthShellProps {
  language: Lng;
  onLanguageChange: (lang: Lng) => void;
  children: React.ReactNode;
}

export default function AuthShell({ language, onLanguageChange, children }: AuthShellProps) {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <a href="#auth-main" className="skip-link">
        Skip to content
      </a>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <p className="font-serif text-xl font-semibold text-navy">Survey Research</p>
          <div role="group" aria-label="Language" className="flex gap-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                aria-pressed={language === lang.code}
                aria-label={lang.name}
                onClick={() => onLanguageChange(lang.code)}
                className={cn(
                  'min-h-10 min-w-10 px-2.5 text-xs font-bold tracking-wide',
                  language === lang.code
                    ? 'bg-navy text-surface'
                    : 'text-ink-muted hover:bg-surface hover:text-ink'
                )}
              >
                {lang.short}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main id="auth-main" className="mx-auto flex w-full max-w-md flex-col px-4 py-12 md:py-20">
        {children}
      </main>
    </div>
  );
}
