import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { authTranslations } from './authTranslations';
import AuthShell from '../chrome/AuthShell';
import Button from '../chrome/Button';
import Field from '../chrome/Field';
import { isLng, type Lng } from '../../lib/cn';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState<Lng>(() => {
    const stored = localStorage.getItem('ui_lng');
    return isLng(stored) ? stored : 'en';
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const t = authTranslations[language];

  useEffect(() => {
    if (location.state?.email) setEmail(location.state.email);
  }, [location.state]);

  useEffect(() => {
    localStorage.setItem('ui_lng', language);
  }, [language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        if (signInError.message === 'Email not confirmed') {
          setError(t.emailNotConfirmed);
        } else {
          setError(t.invalidCredentials);
        }
        return;
      }
      navigate('/admin/dashboard');
    } catch {
      setError(t.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      /* same success copy either way */
    } finally {
      setResetSent(true);
      setResetEmail('');
      setLoading(false);
    }
  };

  return (
    <AuthShell language={language} onLanguageChange={setLanguage}>
      <article className="sheet px-6 py-8 md:px-8 md:py-10">
        {showForgotPassword ? (
          <>
            <h1 className="font-serif text-3xl font-semibold text-navy">{t.resetPassword}</h1>
            <p className="mt-2 text-sm text-ink-muted">{t.enterEmailResetLink}</p>
            {resetSent && (
              <p role="status" className="mt-4 border border-ok bg-ok-soft px-3 py-3 text-sm text-ink">
                {t.resetLinkMessage}
              </p>
            )}
            {!resetSent ? (
              <form onSubmit={handleForgotPassword} className="mt-8 space-y-5">
                <Field
                  id="reset-email"
                  label={t.emailAddress}
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  required
                  disabled={loading}
                />
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? t.sending : t.sendResetLink}
                </Button>
              </form>
            ) : (
              <Button className="mt-8 w-full" onClick={() => { setShowForgotPassword(false); setResetSent(false); }}>
                {t.backToLogin}
              </Button>
            )}
            {!resetSent && (
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="mt-4 text-sm font-bold text-navy underline decoration-from-font underline-offset-4"
              >
                {t.backToLogin}
              </button>
            )}
          </>
        ) : (
          <>
            <h1 className="font-serif text-3xl font-semibold text-navy">{t.adminLogin}</h1>
            <p className="mt-2 text-sm text-ink-muted">{t.surveyManagementSystem}</p>

            {location.state?.needsConfirmation && (
              <p role="status" className="mt-6 border border-ok bg-ok-soft px-3 py-3 text-sm text-ink">
                {t.confirmationLinkSent}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-6 border border-danger bg-danger-soft px-3 py-3 text-sm text-danger">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <Field
                id="email"
                label={t.emailAddress}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                required
                disabled={loading}
              />
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-bold text-ink">
                  {t.password}
                </label>
                <div className="flex border border-line-strong bg-surface focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-navy">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-base"
                    placeholder={t.passwordPlaceholder}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="min-h-12 min-w-12 text-ink-muted hover:text-ink"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="mx-auto size-5" /> : <Eye className="mx-auto size-5" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? t.signingIn : t.signIn}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="mt-4 text-sm font-bold text-navy underline decoration-from-font underline-offset-4"
            >
              {t.forgotYourPassword}
            </button>

            <p className="mt-8 border-t border-line pt-6 text-sm text-ink-muted">
              {t.dontHaveAccount}{' '}
              <Link to="/register" className="font-bold text-navy underline decoration-from-font underline-offset-4">
                {t.register}
              </Link>
            </p>
          </>
        )}
      </article>
      <p className="mt-6 text-center text-xs text-ink-subtle">{t.forResearchAdminOnly}</p>
    </AuthShell>
  );
}
