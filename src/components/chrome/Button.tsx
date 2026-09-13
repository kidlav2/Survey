import React from 'react';
import { cn } from '../../lib/cn';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export default function Button({
  variant = 'primary',
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-12 items-center justify-center gap-2 px-5 text-sm font-bold transition-colors duration-150 disabled:opacity-50',
        variant === 'primary' && 'bg-accent text-surface hover:bg-accent-hover',
        variant === 'secondary' && 'border border-line-strong bg-surface text-ink hover:bg-canvas',
        variant === 'ghost' && 'text-ink-muted hover:bg-canvas hover:text-ink',
        variant === 'danger' && 'bg-danger text-surface hover:opacity-90',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
