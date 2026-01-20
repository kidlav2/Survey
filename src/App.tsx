import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ResetPassword from './components/auth/ResetPassword';
import ConfirmEmail from './components/auth/ConfirmEmail';
import AdminLayout from './components/admin/AdminLayout';
import Dashboard from './components/admin/Dashboard';
import Surveys from './components/admin/Surveys';
import SurveyDetails from './components/admin/SurveyDetails';
import SurveyBuilder from './components/admin/SurveyBuilder';
import Responses from './components/admin/Responses';
import ResponseDetail from './components/admin/ResponseDetail';
import Contacts from './components/admin/Contacts';
import Settings from './components/admin/Settings';
import LanguageSelection from './components/survey/LanguageSelection';
import SurveyWelcome from './components/survey/SurveyWelcome';
import SurveyFlow from './components/survey/SurveyFlow';
import EmailOptIn from './components/survey/EmailOptIn';
import ThankYou from './components/survey/ThankYou';
import SurveyClosed from './components/survey/SurveyClosed';
import NotFound from './components/common/NotFound';
import SkeletonDashboard from './components/common/SkeletonDashboard';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session on app load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <SkeletonDashboard />
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/admin/dashboard" replace />} />
        <Route path="/register" element={!session ? <Register /> : <Navigate to="/admin/dashboard" replace />} />
        <Route path="/auth/confirm" element={<ConfirmEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Admin Routes - Protected */}
        <Route path="/admin" element={session ? <AdminLayout /> : <Navigate to="/login" replace />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="surveys" element={<Surveys />} />
          <Route path="surveys/:id" element={<SurveyDetails />} />
          <Route path="surveys/:id/builder" element={<SurveyBuilder />} />
          <Route path="responses" element={<Responses />} />
          <Route path="responses/:id" element={<ResponseDetail />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Public Survey Routes */} 
        <Route path="/survey/:id" element={<LanguageSelection />} />
        <Route path="/survey/:id/closed" element={<SurveyClosed />} />
        <Route path="/survey/:id/welcome" element={<SurveyWelcome />} />
        <Route path="/survey/:id/questions" element={<SurveyFlow />} />
        <Route path="/survey/:id/opt-in" element={<EmailOptIn />} />
        <Route path="/survey/:id/thank-you" element={<ThankYou />} />
        
        {/* Default Route */}
        <Route path="/" element={<Navigate to={session ? "/admin/dashboard" : "/login"} replace />} />
        
        {/* 404 Not Found - Must be last */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}