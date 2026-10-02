import React, { useEffect } from 'react';
import LanguageToggle from '../survey/LanguageToggle';
import { applyDocumentLanguage, CHROME_UI, chromeLng } from '../../lib/languages';
import type { LanguageOption } from '../../lib/languages';
import { cn } from '../../lib/cn';

interface SurveyShellProps {
  language: string;
  onLanguageChange: (lang: string) => void;
  children: React.ReactNode;
  eyebrow?: string;
  className?: string;
  showLanguage?: boolean;
  languages?: LanguageOption[];
  notice?: React.ReactNode;
}

export default function SurveyShell({
  language,
  onLanguageChange,
  children,
  eyebrow,
  className,
  showLanguage = true,
  languages,
  notice,
}: SurveyShellProps) {
  const chrome = CHROME_UI[chromeLng(language)];
  const toggleLangs = languages && languages.length ? languages : undefined;
  const canToggle = showLanguage && (!toggleLangs || toggleLangs.length > 1);

  useEffect(() => {
    applyDocumentLanguage(language);
  }, [language]);

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <a href="#survey-main" className="skip-link">
        {chrome.skipToContent}
      </a>
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <p className="font-serif text-lg font-semibold tracking-tight text-navy">{eyebrow || chrome.brand}</p>
          {canToggle ? (
            <LanguageToggle
              currentLanguage={language}
              onLanguageChange={onLanguageChange}
              languages={toggleLangs}
            />
          ) : (
            <span />
          )}
        </div>
        {notice ? (
          <div className="border-t border-line bg-accent-soft">
            <p className="mx-auto max-w-3xl px-4 py-2.5 text-sm leading-relaxed text-ink md:px-6">{notice}</p>
          </div>
        ) : null}
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
