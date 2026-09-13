import React from 'react';
import { cn } from '../../lib/cn';

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export default function Field({ id, label, hint, error, className, ...props }: FieldProps) {
  const fieldId = id ?? props.name ?? 'field';
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={fieldId} className="block text-sm font-bold text-ink">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={cn(
          'min-h-12 w-full border bg-surface px-3 text-base text-ink placeholder:text-ink-subtle',
          error ? 'border-danger' : 'border-line-strong',
          className
        )}
        {...props}
      />
      {hint && !error ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
