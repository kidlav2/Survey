import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Clock, FileText } from 'lucide-react';
import LanguageToggle from './LanguageToggle';
import { translations } from './translations';
import { supabase } from '../../lib/supabaseClient';

export default function SurveyWelcome() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  
  const searchLng = new URLSearchParams(location.search).get('lng');
  const stateLng = (location.state as any)?.lng ?? (location.state as any)?.language;
  const persistedLng = id ? localStorage.getItem(`survey_lng_${id}`) : null;
  const initialLanguage = (stateLng || searchLng || persistedLng || 'en') as 'en' | 'ru' | 'fr' | 'es';
  const [language, setLanguage] = useState<'en' | 'ru' | 'fr' | 'es'>(initialLanguage);
  const [survey, setSurvey] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSurveyStatus();
  }, [id]);

  const checkSurveyStatus = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('surveys')
        .select('id, title, description, estimated_time, status')
        .eq('id', id)
        .single();

      if (error) throw error;

      setSurvey(data);

      if (data?.status !== 'active') {
        navigate(`/survey/${id}/closed`, { replace: true });
      }
    } catch (error) {
      console.error('Error checking survey status:', error);
      navigate(`/survey/${id}/closed`, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const t = translations[language]?.welcome || translations.en.welcome;

  const handleStart = () => {
    navigate(`/survey/${id}/questions?lng=${encodeURIComponent(language)}`, {
      state: { lng: language, language },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      {/* Language Toggle */}
      <div className="fixed top-6 right-6 z-10">
        <LanguageToggle currentLanguage={language} onLanguageChange={setLanguage} />
      </div>

      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 rounded-full mb-4">
              <FileText className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-3">
              {survey?.title || t.title}
            </h1>
            <p className="text-gray-600 leading-relaxed">
              {survey?.description || t.description}
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8 border border-gray-200">
            <div className="flex items-start gap-4">
              <Clock className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">{t.estimatedTime}</p>
                <p className="text-sm text-gray-600">{survey?.estimated_time || '5'} {t.minutes || 'minutes'}</p>
              </div>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="mb-8">
            <p className="text-sm text-gray-600 leading-relaxed">
              {t.privacy}
            </p>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleStart}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-4 px-6 rounded-lg transition-colors"
          >
            {t.startButton}
          </button>

          {/* Footer */}
          <p className="text-center text-xs text-gray-500 mt-6">
            {t.footer}
          </p>
        </div>
      </div>
    </div>
  );
}