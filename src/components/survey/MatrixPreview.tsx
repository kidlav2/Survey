import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SurveyShell from '../chrome/SurveyShell';
import Button from '../chrome/Button';
import MatrixQuestion from './MatrixQuestion';
import { isMatrixComplete, remainingMatrixRows } from '../../lib/matrixQuestion';
import type { Lng } from '../../lib/cn';

const COLUMNS = ['Not difficult', 'Somewhat', 'Very difficult', 'Not applicable'];
const ROWS = [
  'Finding funding for your work',
  'Communicating with others in the food system',
  'Getting data in time to use it',
  'Working with policy and regulation',
  'Finding the right people to collaborate with',
];

const optionClass = (selected: boolean) =>
  `w-full min-h-12 text-left px-4 py-3 border transition-colors duration-150 ${
    selected ? 'border-navy bg-accent-soft text-ink' : 'border-line bg-surface text-ink hover:border-line-strong'
  }`;

export default function MatrixPreview() {
  const [language, setLanguage] = useState<Lng>('en');
  const [step, setStep] = useState(0);
  const [frequency, setFrequency] = useState('');
  const [matrix, setMatrix] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  const total = 2;
  const progress = ((step + 1) / total) * 100;

  if (step === 2) {
    return (
      <SurveyShell language={language} onLanguageChange={setLanguage}>
        <article className="sheet px-6 py-8 md:px-10 md:py-10">
          <h1 className="font-serif text-3xl font-semibold text-navy">That’s the matrix</h1>
          <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-ink-muted">
            Question 1 was a normal list: one answer. Question 2 asked the same scale about five
            different things, without turning them into five separate pages.
          </p>
          <div className="mt-8">
            <Button onClick={() => { setStep(0); setFrequency(''); setMatrix({}); setError(''); }}>
              Start over
            </Button>
          </div>
        </article>
      </SurveyShell>
    );
  }

  return (
    <SurveyShell language={language} onLanguageChange={setLanguage}>
      <div className="mb-6">
        <div className="mb-2 flex items-end justify-between gap-4 text-sm">
          <p className="font-bold text-ink">Question {step + 1} of {total}</p>
          <p className="tabular-nums text-ink-subtle">{Math.round(progress)}% complete</p>
        </div>
        <div className="h-1 w-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <div className="h-full bg-navy transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <article className="sheet px-6 py-8 md:px-10 md:py-10">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-danger">Required</div>

        {step === 0 ? (
          <>
            <h1 className="text-balance font-serif text-3xl font-semibold leading-tight text-navy md:text-4xl">
              How often do you work with others in the food system?
            </h1>
            <fieldset className="mt-8 space-y-2">
              <legend className="sr-only">How often do you work with others in the food system?</legend>
              {['Weekly', 'Monthly', 'Rarely', 'Never'].map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={frequency === option}
                  onClick={() => { setError(''); setFrequency(option); }}
                  className={optionClass(frequency === option)}
                >
                  {option}
                </button>
              ))}
            </fieldset>
          </>
        ) : (
          <>
            <h1 className="text-balance font-serif text-3xl font-semibold leading-tight text-navy md:text-4xl">
              How difficult is each of the following for you right now?
            </h1>
            <MatrixQuestion
              questionId="demo-matrix"
              stem="How difficult is each of the following for you right now?"
              rows={ROWS}
              columns={COLUMNS}
              value={matrix}
              remainingLabel={`${remainingMatrixRows(matrix, ROWS, COLUMNS)} left to rate`}
              allRatedLabel="Every item is rated"
              onSelect={(row, col) => {
                setError('');
                setMatrix((current) => ({ ...current, [String(row)]: col }));
              }}
            />
          </>
        )}

        {error && (
          <p role="alert" className="mt-6 text-sm text-danger">{error}</p>
        )}
      </article>

      <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <Button variant="secondary" onClick={() => { setError(''); setStep(0); }} disabled={step === 0}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back
        </Button>
        <Button
          onClick={() => {
            if (step === 0 && !frequency) {
              setError('Please answer this question before continuing.');
              return;
            }
            if (step === 1 && !isMatrixComplete(matrix, ROWS, COLUMNS)) {
              setError('Please rate every item before continuing.');
              requestAnimationFrame(() => {
                document.querySelector<HTMLElement>('[data-matrix-row]:not([data-answered])')?.querySelector('input')?.focus();
              });
              return;
            }
            setError('');
            setStep(step + 1);
          }}
        >
          {step === 1 ? 'Finish' : 'Next'}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </SurveyShell>
  );
}
