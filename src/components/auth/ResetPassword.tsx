import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Check if we have a valid token
  const token = searchParams.get('access_token');
  const type = searchParams.get('type');
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  useEffect(() => {
    if (errorParam) {
      setError(`Error: ${decodeURIComponent(errorDescription || errorParam)}`);
    }
  }, [errorParam, errorDescription]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      // Update password using the session from the link
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // If token has expired or no token
  if (errorParam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 md:p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-red-50 rounded-full mb-4">
              <Lock className="w-6 h-6 text-red-600" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Link Expired
            </h1>
            <p className="text-gray-600 mb-6">
              {error || 'The password reset link has expired or is invalid.'}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              Back to Login
            </button>
            <button
              onClick={() => navigate('/login')}
              className="mt-3 w-full px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Request New Reset Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 md:p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 rounded-full mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Password Reset Successful
            </h1>
            <p className="text-gray-600 mb-6">
              Your password has been reset successfully. You'll be redirected to the login page in a few seconds.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              Go to Login
            </button>
          </div>
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
              Set New Password
            </h1>
            <p className="text-sm text-gray-600">
              Enter your new password below
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
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
                  minLength={8}
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
              <p className="text-xs text-gray-500 mt-1">
                Must be at least 8 characters long
              </p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="flex items-center w-full border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 bg-white overflow-hidden">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="flex-1 px-4 py-2 bg-transparent focus:outline-none"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="px-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none bg-transparent"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
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
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center border-t border-gray-200 pt-6">
            <p className="text-sm text-gray-600">
              Remember your password?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Back to Login
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
