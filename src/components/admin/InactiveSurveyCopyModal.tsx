import React from 'react';
import { createPortal } from 'react-dom';
import { adminTranslations } from './adminTranslations';
import type { Lng } from '../../lib/cn';
import Button from '../chrome/Button';

type Props = {
  open: boolean;
  language: Lng;
  onCancel: () => void;
  onCopyAnyway: () => void;
  onCopyAndEnable: () => void;
};

export default function InactiveSurveyCopyModal({
  open,
  language,
  onCancel,
  onCopyAnyway,
  onCopyAndEnable,
}: Props) {
  if (!open) return null;
  const t = adminTranslations[language];

  // Rendered in <body>: each survey card is its own stacking layer, so inside a card the overlay would sit under the next cards.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/50 p-4">
      <div className="sheet w-full max-w-md px-6 py-6" role="dialog" aria-modal="true" aria-labelledby="inactive-survey-title">
        <h2 id="inactive-survey-title" className="font-serif text-2xl font-semibold text-navy">
          {t.surveyOffTitle}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t.surveyOffCopyHint}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={onCopyAndEnable}>{t.copyAndEnable}</Button>
          <Button variant="secondary" onClick={onCopyAnyway}>
            {t.copyAnyway}
          </Button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 text-sm font-bold text-navy underline decoration-from-font underline-offset-4"
          >
            {t.cancel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
