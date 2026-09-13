import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { authTranslations } from './authTranslations';
import AuthShell from '../chrome/AuthShell';
import Button from '../chrome/Button';
import Field from '../chrome/Field';
import { isLng, type Lng } from '../../lib/cn';

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [language, setLanguage] = useState<Lng>(() => {
    const stored = localStorage.getItem('ui_lng');
    return isLng(stored) ? stored : 'en';
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const t = authTranslations[language];

  useEffect(() => {
    if (location.state?.email) setEmail(location.state.email);
  }, [location.state]);

  useEffect(() => {
    localStorage.setItem('ui_lng', language);
  }, [language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg(t.passwordsMustMatch);
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: { full_name: name },
        },
      });
      if (error) throw error;
      navigate('/login', { state: { email, needsConfirmation: true } });
    } catch (err: any) {
      setErrorMsg(err?.message ?? t.registrationFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell language={language} onLanguageChange={setLanguage}>
      <article className="sheet px-6 py-8 md:px-8 md:py-10">
        <h1 className="font-serif text-3xl font-semibold text-navy">{t.createAdminAccount}</h1>
        <p className="mt-2 text-sm text-ink-muted">{t.registerForSurvey}</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <Field
            id="name"
            label={t.fullName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.fullNamePlaceholder}
            required
            autoComplete="name"
          />
          <Field
            id="email"
            label={t.emailAddress}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.emailPlaceholder}
            required
            autoComplete="email"
          />
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-bold text-ink">{t.password}</label>
            <div className="flex border border-line-strong bg-surface">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-base"
                required
                autoComplete="new-password"
                minLength={8}
              />
              <button
                type="button"
                className="min-h-12 min-w-12 text-ink-muted"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="mx-auto size-5" /> : <Eye className="mx-auto size-5" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="block text-sm font-bold text-ink">{t.confirmPassword}</label>
            <div className="flex border border-line-strong bg-surface">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-base"
                required
                autoComplete="new-password"
                minLength={8}
              />
              <button
                type="button"
                className="min-h-12 min-w-12 text-ink-muted"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowConfirmPassword((v) => !v)}
              >
                {showConfirmPassword ? <EyeOff className="mx-auto size-5" /> : <Eye className="mx-auto size-5" />}
              </button>
            </div>
          </div>
          {errorMsg && (
            <p role="alert" className="text-sm text-danger">{errorMsg}</p>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t.creating : t.createAccount}
          </Button>
        </form>
        <p className="mt-8 border-t border-line pt-6 text-sm text-ink-muted">
          {t.alreadyHaveAccount}{' '}
          <Link to="/login" className="font-bold text-navy underline decoration-from-font underline-offset-4">
            {t.signInRegister}
          </Link>
        </p>
      </article>
      <p className="mt-6 text-center text-xs text-ink-subtle">{t.forResearchAdminOnly}</p>
    </AuthShell>
  );
}
