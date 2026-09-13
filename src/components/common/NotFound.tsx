import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../chrome/Button';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 text-ink">
      <div className="max-w-md">
        <p className="font-serif text-6xl font-semibold text-navy">404</p>
        <h1 className="mt-4 font-serif text-3xl font-semibold">This page is not here</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-muted">
          The link may be incomplete, or the survey may have been removed.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => navigate(-1)}>Go back</Button>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}
