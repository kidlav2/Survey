import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Calendar, Clock, Globe, Mail, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import SkeletonSurveyCard from '../common/SkeletonSurveyCard';

interface ResponseData {
  id: string;
  survey_id: string;
  surveyTitle: string;
  created_at: string;
  language?: string | null;
  duration_seconds?: number | null;
  respondent_email: string | null;
  // Column may not exist; we derive completion from answers.
  completed?: boolean | null;
  answers: Record<string, any> | null;
}

interface Question {
  id: string;
  text: string;
  type: string;
}

export default function ResponseDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [questions, setQuestions] = useState<Record<string, Question>>({});
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isCompleted = (r: ResponseData) => {
    return r.completed === true;
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds || seconds <= 0) return 'N/A';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (m <= 0) return `${s}s`;
    return s ? `${m}m ${s}s` : `${m}m`;
  };

  const handleDeleteResponse = async () => {
    if (!id) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('responses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Navigate back to responses list
      navigate('/admin/responses', { replace: true });
    } catch (error) {
      console.error('Error deleting response:', error);
      alert('Failed to delete response. Please try again.');
      setDeleting(false);
    }
  };

  useEffect(() => {
    loadResponseDetail();
  }, [id]);

  const loadResponseDetail = async () => {
    try {
      setLoading(true);

      // Fetch response data
      const { data: responseData, error: responseError } = await supabase
        .from('responses')
        .select('*')
        .eq('id', id)
        .single();

      if (responseError) throw responseError;

      if (!responseData) {
        setResponse(null);
        setLoading(false);
        return;
      }

      // Fetch survey title
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('title')
        .eq('id', responseData.survey_id)
        .single();

      if (surveyError) throw surveyError;

      // Fetch questions for this survey
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('id, text, type')
        .eq('survey_id', responseData.survey_id);

      if (questionsError) throw questionsError;

      // Map questions by ID for easy lookup
      const questionsMap: Record<string, Question> = {};
      (questionsData || []).forEach((q) => {
        questionsMap[q.id] = q;
      });
      setQuestions(questionsMap);

      setResponse({
        ...responseData,
        surveyTitle: surveyData?.title || 'Unknown Survey',
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading response detail:', error);
      setResponse(null);
      setLoading(false);
    }
  };



  if (loading) {
    return (
      <main className="flex-1">
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/admin/responses')}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-xl md:text-2xl font-semibold text-gray-900">Response Details</h2>
          </div>
        </header>
        <div className="p-4 md:p-8">
          <SkeletonSurveyCard />
        </div>
      </main>
    );
  }

  if (!response) {
    return (
      <main className="flex-1">
        <div className="p-8">
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-600">Response not found</p>
            <button
              onClick={() => navigate('/admin/responses')}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              Back to Responses
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/admin/responses')}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-semibold text-gray-900">Response Details</h2>
              <p className="text-sm text-gray-500 mt-1">Response #{response.id.slice(0, 8)}</p>
            </div>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 hover:bg-red-50 rounded transition-colors"
            title="Delete this response"
          >
            <Trash2 className="w-5 h-5 text-red-600" />
          </button>
        </div>
      </header>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-sm w-full p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Response?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this response? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteResponse}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors font-medium"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Main Content */}
      <div className="p-4 md:p-8">
        {/* Response Metadata Card */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="px-4 md:px-6 py-4 border-b border-gray-200">
            <h3 className="text-base md:text-lg font-semibold text-gray-900">Response Information</h3>
          </div>
          
          <div className="p-4 md:p-6">
            {/* Survey Title */}
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">Survey</p>
              <p className="text-base md:text-lg font-medium text-gray-900">{response.surveyTitle}</p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 pt-4 border-t border-gray-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Date Submitted</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(response.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Duration</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDuration(response.duration_seconds)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Language</p>
                  <p className="text-sm font-medium text-gray-900">{response.language || 'Not specified'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Email</p>
                  <p className="text-sm font-medium text-gray-900">{response.respondent_email || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2">Status</p>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  isCompleted(response)
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full mr-2 ${
                    isCompleted(response) ? 'bg-green-600' : 'bg-yellow-600'
                  }`}
                ></div>
                {isCompleted(response) ? 'Completed' : 'Not Completed'}
              </span>
            </div>
          </div>
        </div>

        {/* Answers Card */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 md:px-6 py-4 border-b border-gray-200">
            <h3 className="text-base md:text-lg font-semibold text-gray-900">Survey Responses</h3>
            <p className="text-sm text-gray-500 mt-1">
              {response.answers ? Object.keys(response.answers).length : 0} questions answered
            </p>
          </div>
          
          <div className="p-4 md:p-6">
            {response.answers && Object.keys(response.answers).length > 0 ? (
              <div className="space-y-6">
                {(() => {
                  // Track which answers we've displayed
                  const displayedKeys = new Set<string>();
                  const entries: React.ReactNode[] = [];
                  let questionIndex = 1;

                  // First pass: display all non-_other answers with their associated _other responses
                  Object.entries(response.answers).forEach(([key, answer]) => {
                    if (!key.endsWith('_other') && answer !== undefined && answer !== null) {
                      const question = questions[key];
                      const questionText = question?.text || key;
                      
                      // Check if there's an "_other" response for this question
                      const otherAnswerKey = `${key}_other`;
                      const otherAnswer = response.answers?.[otherAnswerKey];
                      const hasOtherAnswer = otherAnswer && typeof otherAnswer === 'string' && otherAnswer.trim().length > 0;
                      
                      entries.push(
                        <div key={key} className="pb-6 border-b border-gray-200 last:border-b-0 last:pb-0">
                          <div className="mb-3">
                            <div className="flex items-start gap-3">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center">
                                {questionIndex}
                              </span>
                              <div className="flex-1">
                                <p className="text-sm md:text-base font-medium text-gray-900">
                                  {questionText}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="ml-9 space-y-3">
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                              <p className="text-sm md:text-base text-gray-900">
                                {Array.isArray(answer)
                                  ? answer.join(', ')
                                  : typeof answer === 'string'
                                  ? answer
                                  : JSON.stringify(answer)}
                              </p>
                            </div>
                            {hasOtherAnswer && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-xs md:text-sm font-semibold text-blue-700 mb-2">Other (please specify):</p>
                                <p className="text-sm md:text-base text-gray-900 whitespace-pre-wrap">
                                  {otherAnswer}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                      
                      displayedKeys.add(key);
                      if (hasOtherAnswer) {
                        displayedKeys.add(otherAnswerKey);
                      }
                      questionIndex++;
                    }
                  });

                  // Second pass: display any orphaned _other answers (those without a main answer)
                  Object.entries(response.answers).forEach(([key, answer]) => {
                    if (key.endsWith('_other') && !displayedKeys.has(key) && answer && typeof answer === 'string' && answer.trim().length > 0) {
                      // Extract the question ID (remove _other suffix)
                      const questionId = key.slice(0, -6); // Remove "_other"
                      const question = questions[questionId];
                      const questionText = question?.text || questionId;
                      
                      entries.push(
                        <div key={key} className="pb-6 border-b border-gray-200 last:border-b-0 last:pb-0">
                          <div className="mb-3">
                            <div className="flex items-start gap-3">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center">
                                {questionIndex}
                              </span>
                              <div className="flex-1">
                                <p className="text-sm md:text-base font-medium text-gray-900">
                                  {questionText}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="ml-9">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <p className="text-xs md:text-sm font-semibold text-blue-700 mb-2">Other (please specify):</p>
                              <p className="text-sm md:text-base text-gray-900 whitespace-pre-wrap">
                                {answer}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                      
                      displayedKeys.add(key);
                      questionIndex++;
                    }
                  });

                  return entries;
                })()}
              </div>
            ) : (
              <p className="text-gray-500">No answers recorded</p>
            )}
          </div>
        </div>

        {/* Back Button - Mobile */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/admin/responses')}
            className="flex-1 sm:flex-none px-6 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium"
          >
            Back to Responses
          </button>
        </div>
      </div>
    </main>
  );
}