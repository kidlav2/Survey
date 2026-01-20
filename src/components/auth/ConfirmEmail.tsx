import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export default function ConfirmEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        // Get the token from URL
        const token = searchParams.get('token');
        const type = searchParams.get('type');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Check for errors from Supabase
        if (error) {
          setStatus('error');
          setMessage(decodeURIComponent(errorDescription || error));
          return;
        }

        // Handle email confirmation (type=signup or type=email)
        if (type === 'signup' || type === 'email') {
          // The token is automatically processed by Supabase when we call getSession
          // Just verify the session is established
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            setStatus('error');
            setMessage('Failed to confirm email. Please try again.');
            return;
          }

          if (session) {
            // Email confirmed successfully
            setStatus('success');
            setMessage('Email confirmed successfully!');
            
            // Redirect to dashboard after 3 seconds
            setTimeout(() => {
              navigate('/admin/dashboard');
            }, 3000);
          } else {
            // Try to refresh session with the token in URL
            const { error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              setStatus('error');
              setMessage('Email confirmation failed. Please try registering again.');
              return;
            }

            setStatus('success');
            setMessage('Email confirmed successfully!');
            
            setTimeout(() => {
              navigate('/admin/dashboard');
            }, 3000);
          }
        } else {
          setStatus('error');
          setMessage('Invalid confirmation link.');
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err?.message || 'An error occurred during email confirmation.');
      }
    };

    confirmEmail();
  }, [searchParams, navigate]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 md:p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-50 rounded-full mb-4">
              <Loader className="w-6 h-6 text-indigo-600 animate-spin" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Confirming Email
            </h1>
            <p className="text-gray-600">
              Please wait while we confirm your email address...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 md:p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-red-50 rounded-full mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Confirmation Failed
            </h1>
            <p className="text-gray-600 mb-6">
              {message || 'Email confirmation failed. Please try registering again.'}
            </p>
            <button
              onClick={() => navigate('/register')}
              className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors mb-3"
            >
              Back to Register
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 md:p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 rounded-full mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Email Confirmed!
            </h1>
            <p className="text-gray-600 mb-6">
              Your email has been confirmed successfully. You'll be redirected to your dashboard in a few seconds.
            </p>
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
