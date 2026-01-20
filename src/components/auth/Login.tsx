import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, ArrowLeft, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { authTranslations } from './authTranslations';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState<'en' | 'ru' | 'fr' | 'es'>('en');

  const t = authTranslations[language];

  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
    }
  }, [location.state]);

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [showRegisterSuggestion, setShowRegisterSuggestion] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowRegisterSuggestion(false);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message === 'Invalid login credentials') {
          setError(t.emailNotRegistered);
          // Show suggestion to register if email might not exist
          setShowRegisterSuggestion(true);
        } else if (error.message === 'Email not confirmed') {
          setError(t.emailNotConfirmed);
          setShowRegisterSuggestion(false);
        } else {
          setError(error.message);
          setShowRegisterSuggestion(false);
        }
        return;
      }

      navigate('/admin/dashboard');
    } catch (err) {
      setError('An error occurred. Please try again.');
      setShowRegisterSuggestion(false);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Attempt to send reset email
      // Note: Supabase will not reveal if email exists or not for security
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: '/reset-password',
      });

      if (error) {
        // For security, we show the same message regardless of whether email exists
        setResetSent(true);
        setResetEmail('');
        return;
      }

      setResetSent(true);
      setResetEmail('');
    } catch (err) {
      // For security, don't reveal if email exists or not
      setResetSent(true);
      setResetEmail('');
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Top Bar with Language Toggle */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
          <div className="flex items-center justify-end">
            <div className="flex gap-2">
              {(['en', 'ru', 'fr', 'es'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                    language === lang
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {lang === 'en' ? 'Eng' : lang === 'ru' ? 'Рус' : lang === 'fr' ? 'Fra' : 'Esp'}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-6">
          <div className="w-full max-w-md">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 md:p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-50 rounded-full mb-4">
                <Mail className="w-6 h-6 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                {t.resetPassword}
              </h1>
              <p className="text-sm text-gray-600">
                {t.enterEmailResetLink}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Success Message */}
            {resetSent && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                <p className="font-medium mb-1">{t.checkYourEmail}</p>
                <p>{t.resetLinkMessage}</p>
              </div>
            )}

            {/* Form */}
            {!resetSent ? (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-2">
                    {t.emailAddress}
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={t.emailPlaceholder}
                    required
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? t.sending : t.sendResetLink}
                </button>
              </form>
            ) : (
              <button
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetSent(false);
                  setError('');
                  setResetEmail('');
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                {t.backToLogin}
              </button>
            )}

            {/* Back Link Button */}
            {!resetSent && (
              <button
                onClick={() => {
                  setShowForgotPassword(false);
                  setError('');
                  setResetEmail('');
                  setResetSent(false);
                }}
                className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                {t.backToLogin}
              </button>
            )}
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            {t.forResearchAdminOnly}
          </p>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar with Language Toggle */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
        <div className="flex items-center justify-end">
          <div className="flex gap-2">
            {(['en', 'ru', 'fr', 'es'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                  language === lang
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {lang === 'en' ? 'Eng' : lang === 'ru' ? 'Рус' : lang === 'fr' ? 'Fra' : 'Esp'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-50 rounded-full mb-4">
              <Lock className="w-6 h-6 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              {t.adminLogin}
            </h1>
            <p className="text-sm text-gray-600">
              {t.surveyManagementSystem}
            </p>
          </div>

          {/* Success/Info Message */}
          {location.state?.needsConfirmation && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  {t.accountCreatedSuccessfully}
                </p>
                <p className="text-xs text-green-700 mt-1">
                  {t.confirmationLinkSent}
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 mb-3">
                {error}
              </p>
              {showRegisterSuggestion && (
                <div className="pt-3 border-t border-red-200">
                  <p className="text-sm text-red-600 mb-2">
                    {t.dontHaveAccountError}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/register', { state: { email } })}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 underline"
                  >
                    {t.createNewAccount}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                {t.emailAddress}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={t.emailPlaceholder}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                {t.password}
              </label>
              <div className="flex items-center w-full border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 bg-white overflow-hidden">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 px-4 py-2 bg-transparent focus:outline-none"
                  placeholder={t.passwordPlaceholder}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="px-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none bg-transparent"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? t.signingIn : t.signIn}
            </button>
          </form>

          {/* Forgot Password Link */}
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {t.forgotYourPassword}
            </button>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center border-t border-gray-200 pt-6">
            <p className="text-sm text-gray-600">
              {t.dontHaveAccount}{' '}
              <button
                onClick={() => navigate('/register')}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {t.register}
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          {t.forResearchAdminOnly}
        </p>
      </div>
      </div>
    </div>
  );
}