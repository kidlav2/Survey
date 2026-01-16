import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import LanguageToggle from './LanguageToggle';
import { translations } from './translations';

export default function SurveyFlow() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  const searchLng = new URLSearchParams(location.search).get('lng');
  const stateLng = (location.state as any)?.lng ?? (location.state as any)?.language;
  const persistedLng = id ? localStorage.getItem(`survey_lng_${id}`) : null;
  const resolvedLng = (stateLng || searchLng || persistedLng || 'en') as 'en' | 'ru' | 'fr' | 'es';

  const [language, setLanguage] = useState<'en' | 'ru' | 'fr' | 'es'>(resolvedLng);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());

  const t = translations[language]?.questions || translations.en.questions;

  useEffect(() => {
    setStartedAt(Date.now());
    if (id) {
      localStorage.setItem(`survey_lng_${id}`, language);
    }
    loadSurveyQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (id) {
      localStorage.setItem(`survey_lng_${id}`, language);
    }
  }, [id, language]);

  const loadSurveyQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('survey_id', id)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      console.log('Raw questions data:', data);

      const mapped = (data || []).map((row: any, idx: number) => {
        const payload = row.payload || {};
        const options = payload.options ?? row.options ?? [];

        console.log(`Question ${idx}:`, {
          id: row.id,
          type: payload.type ?? row.type,
          options: options,
          payload: payload,
        });

        return {
          ...row,
          order: row.sort_order ?? row.order ?? idx,
          options: options,
          type: payload.type ?? row.type,
          text: payload.text ?? row.text ?? row.question_text ?? '',
          required: payload.required ?? row.required ?? false,
          hasOtherOption:
            payload.hasOtherOption ?? row.has_other_option ?? row.hasOtherOption ?? false,
        };
      });

      console.log('Mapped questions:', mapped);

      setQuestions(mapped);
      setLoading(false);
    } catch (error) {
      console.error('Error loading questions:', error);
      setLoading(false);
    }
  };

  const question = questions[currentQuestion];
  const totalQuestions = questions.length;
  const progress = totalQuestions > 0 ? ((currentQuestion + 1) / totalQuestions) * 100 : 0;

  const handleAnswer = (value: any) => {
    const isMulti = question?.type === 'multiple-choice';

    if (isMulti) {
      const current = answers[question.id];
      const arr = Array.isArray(current) ? current : [];
      const newAnswers = arr.includes(value)
        ? arr.filter((v: any) => v !== value)
        : [...arr, value];
      setAnswers({ ...answers, [question.id]: newAnswers });
    } else {
      setAnswers({ ...answers, [question.id]: value });
    }
  };

  const handleNext = async () => {
    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Final submit: insert response with answers + duration + language
      try {
        const { data, error } = await supabase
          .from('responses')
          .insert({
            survey_id: id,
            answers: answers,
            duration_seconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
            language: language,
          })
          .select()
          .single();

        if (error) throw error;

        const newResponseId = data?.id ?? null;
        setResponseId(newResponseId);

        navigate(`/survey/${id}/opt-in?lng=${encodeURIComponent(language)}`, {
          state: { lng: language, language, responseId: newResponseId },
        });
      } catch (error) {
        console.error('Error submitting survey:', error);
        // stay on the page so the user can retry
      }
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const isAnswered =
    answers[question?.id] !== undefined &&
    (Array.isArray(answers[question?.id]) ? answers[question?.id].length > 0 : true);

  if (loading || !question) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading survey...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      {/* Language Toggle */}
      <div className="fixed top-6 right-6">
        <LanguageToggle currentLanguage={language} onLanguageChange={setLanguage} />
      </div>

      <div className="max-w-3xl w-full">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {t.question} {currentQuestion + 1} {t.of} {totalQuestions}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(progress)}% {t.complete}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 md:p-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-8">{question.text}</h2>

          {/* Choice Questions */}
          {(question.type === 'multiple-choice' || question.type === 'single-choice') && (
            <div className="space-y-3">
              {question.options?.map((option: string) => {
                const isMulti = question.type === 'multiple-choice';
                const current = answers[question.id];
                const isSelected = isMulti
                  ? (Array.isArray(current) ? current : []).includes(option)
                  : current === option;

                return (
                  <button
                    key={option}
                    onClick={() => handleAnswer(option)}
                    className={`w-full text-left px-6 py-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'border-indigo-600' : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <div className="w-3 h-3 rounded-full bg-indigo-600" />}
                      </div>
                      <span>{option}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Scale */}
          {question.type === 'scale' && (
            <div className="space-y-6">
              <div className="flex justify-between gap-3">
                {Array.from({ length: 5 }, (_, i) => i + 1).map((value) => (
                  <button
                    key={value}
                    onClick={() => handleAnswer(value)}
                    className={`flex-1 aspect-square rounded-lg border-2 transition-all ${
                      answers[question.id] === value
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-center h-full">
                      <span className="text-2xl font-semibold">{value}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Text Input */}
          {question.type === 'text' && (
            <textarea
              value={answers[question.id] || ''}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder="Enter your answer here..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}

          {/* Yes/No */}
          {question.type === 'yes-no' && (
            <div className="flex gap-4">
              {['Yes', 'No'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer(option)}
                  className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all font-medium ${
                    answers[question.id] === option
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {/* Multiple selection note */}
          {question.type === 'multiple-choice' && (
            <p className="text-sm text-gray-500 mt-4">You can select multiple options</p>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentQuestion === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              currentQuestion === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            {t.back}
          </button>

          <button
            onClick={handleNext}
            disabled={!isAnswered}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg font-medium transition-colors ${
              isAnswered
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {currentQuestion < totalQuestions - 1 ? t.next : t.finish}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}