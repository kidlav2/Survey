import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Button from '../chrome/Button';

export default function ConfirmEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        if (error) {
          setStatus('error');
          setMessage(decodeURIComponent(errorDescription || error));
          return;
        }
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          setStatus('error');
          setMessage('Failed to confirm email. Please try again.');
          return;
        }
        setStatus('success');
        setMessage('Email confirmed.');
        setTimeout(() => navigate(session ? '/admin/dashboard' : '/login'), 2500);
      } catch (err: any) {
        setStatus('error');
        setMessage(err?.message || 'An error occurred during email confirmation.');
      }
    };
    confirmEmail();
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 text-ink">
      <article className="sheet w-full max-w-md px-6 py-10">
        <h1 className="font-serif text-3xl font-semibold text-navy">
          {status === 'loading' ? 'Confirming email' : status === 'error' ? 'Confirmation failed' : 'Email confirmed'}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          {status === 'loading' ? 'Please wait a moment.' : message}
        </p>
        {status === 'error' && (
          <div className="mt-8 flex flex-col gap-3">
            <Button onClick={() => navigate('/register')}>Back to register</Button>
            <Button variant="secondary" onClick={() => navigate('/login')}>Back to login</Button>
          </div>
        )}
        {status === 'success' && (
          <div className="mt-8">
            <Button onClick={() => navigate('/admin/dashboard')}>Go to dashboard</Button>
          </div>
        )}
      </article>
    </div>
  );
}
