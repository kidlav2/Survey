import React from 'react';
import LanguageToggle from '../survey/LanguageToggle';
import type { Lng } from '../../lib/cn';
import { cn } from '../../lib/cn';

interface SurveyShellProps {
  language: Lng;
  onLanguageChange: (lang: Lng) => void;
  children: React.ReactNode;
  eyebrow?: string;
  className?: string;
  showLanguage?: boolean;
}

export default function SurveyShell({
  language,
  onLanguageChange,
  children,
  eyebrow = 'Research survey',
  className,
  showLanguage = true,
}: SurveyShellProps) {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <a href="#survey-main" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <p className="font-serif text-lg font-semibold tracking-tight text-navy">{eyebrow}</p>
          {showLanguage ? (
            <LanguageToggle currentLanguage={language} onLanguageChange={onLanguageChange} />
          ) : (
            <span />
          )}
        </div>
      </header>
      <main
        id="survey-main"
        className={cn('mx-auto flex w-full max-w-3xl flex-col px-4 py-10 md:px-6 md:py-16', className)}
      >
        {children}
      </main>
    </div>
  );
}
