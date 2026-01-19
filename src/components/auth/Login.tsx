import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      navigate('/admin/dashboard');
    } catch (err) {
      setError('An error occurred. Please try again.');
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
        redirectTo: `${window.location.origin}/reset-password`,
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 md:p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-50 rounded-full mb-4">
                <Mail className="w-6 h-6 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                Reset Password
              </h1>
              <p className="text-sm text-gray-600">
                Enter your email address to receive a password reset link
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
                <p className="font-medium mb-1">Check your email!</p>
                <p>If an account exists with this email address, you'll receive a password reset link shortly. Please check your inbox and spam folder.</p>
              </div>
            )}

            {/* Form */}
            {!resetSent ? (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="admin@research.edu"
                    required
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
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
                Back to Login
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
                Back to Login
              </button>
            )}
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            For research administration use only
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-50 rounded-full mb-4">
              <Lock className="w-6 h-6 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Admin Login
            </h1>
            <p className="text-sm text-gray-600">
              Survey Management System
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="admin@research.edu"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="flex items-center w-full border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 bg-white overflow-hidden">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 px-4 py-2 bg-transparent focus:outline-none"
                  placeholder="••••••••"
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
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Forgot Password Link */}
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Forgot your password?
            </button>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center border-t border-gray-200 pt-6">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/register')}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Register
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          For research administration use only
        </p>
      </div>
    </div>
  );
}