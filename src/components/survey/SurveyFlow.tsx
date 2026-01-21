import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import LanguageToggle from './LanguageToggle';
import { translations } from './translations';
import SkeletonQuestionFlow from '../common/SkeletonQuestionFlow';

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
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());

  const t = translations[language]?.questions || translations.en.questions;
  const tQuestions = t as typeof translations.en.questions;

  type Lng = 'en' | 'ru' | 'fr' | 'es';

  const getLocalized = useCallback((q: any, lng: Lng) => {
    const p = q?.payload ?? {};
    const base = (p.baseLanguage || p.base_language || 'en') as Lng;

    // text can be: string OR { en: string, ... }
    const textMap = p.text;
    const text =
      (textMap && typeof textMap === 'object' ? (textMap[lng] || textMap[base]) : null) ||
      (typeof q?.text === 'string' ? q.text : '') ||
      (typeof q?.question_text === 'string' ? q.question_text : '') ||
      '';

    // options can be: string[] OR { en: string[], ... }
    // For yes-no questions, always return empty options so translations are used
    let options: any[] = [];
    if (q?.type !== 'yes-no') {
      const optMap = p.options;
      options =
        (optMap && typeof optMap === 'object' && !Array.isArray(optMap)
          ? (optMap[lng] || optMap[base] || [])
          : Array.isArray(optMap)
            ? optMap
            : Array.isArray(q?.options)
              ? q.options
              : []);
    }

    // Add "Other" option if hasOtherOption is true
    const otherText = tQuestions.other || 'Other (please specify)';
    const hasOtherOption = q?.hasOtherOption || q?.has_other_option || false;
    if (hasOtherOption && !options.some(opt => opt?.toLowerCase?.().includes('other'))) {
      options = [...options, otherText];
    }

    return { text, options };

  }, [tQuestions]);

  const makeUUID = () => {
    // Use browser crypto when available
    const c: any = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();

    // Fallback (good enough for client-side ids)
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
  };

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
      // First check survey status
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('status')
        .eq('id', id)
        .single();

      if (surveyError) throw surveyError;

      // If survey is not active, redirect to closed page
      if (surveyData?.status !== 'active') {
        navigate(`/survey/${id}/closed`, { replace: true });
        return;
      }

      // Load questions if survey is active
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('survey_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Load sections for this survey
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('survey_sections')
        .select('*')
        .eq('survey_id', id)
        .order('order_index', { ascending: true });
      
      if (sectionsError && sectionsError.code !== '42703' && sectionsError.code !== 'PGRST116') {
        console.error('Error loading sections:', sectionsError);
      }
      
      setSections(sectionsData || []);

      console.log('Raw questions data:', data);
      console.log('Sections data:', sectionsData);

      const mapped = (data || []).map((row: any, idx: number) => {
        const payload = row.payload || {};
        const options = Array.isArray(row.options) ? row.options : [];

        console.log(`Question ${idx}:`, {
          id: row.id,
          type: payload.type ?? row.type,
          options: options,
          conditional_logic: row.conditional_logic,
          payload: payload,
          section_id: row.section_id,
          sort_order: row.sort_order,
          created_at: row.created_at,
        });

        return {
          ...row,
          order: row.sort_order ?? row.order ?? idx,
          options: row.options 
            ? (typeof row.options === 'string' ? JSON.parse(row.options) : row.options)
            : [],
          type: payload.type ?? row.type,
          text: row.text ?? row.question_text ?? '',
          required: payload.required ?? row.required ?? false,
          hasOtherOption:
            payload.hasOtherOption ?? row.has_other_option ?? row.hasOtherOption ?? false,
          section_id: row.section_id,
          conditional_logic: row.conditional_logic 
            ? (typeof row.conditional_logic === 'string' ? JSON.parse(row.conditional_logic) : row.conditional_logic)
            : undefined
        };
      });

      // Sort questions properly: 
      // 1. Questions without section_id come first (unsectioned)
      // 2. Questions with section_id are sorted by section order, then by their sort_order within section
      const sectionMap = new Map(sectionsData?.map(s => [s.id, s.order_index || 0]) || []);
      
      console.log('Section map:', Array.from(sectionMap.entries()));
      console.log('Before sorting - questions:', mapped.map((q: any) => ({ 
        id: q.id, 
        section_id: q.section_id, 
        sort_order: q.sort_order,
        text: q.text.substring(0, 20)
      })));
      
      mapped.sort((a, b) => {
        // Both unsectioned
        if (!a.section_id && !b.section_id) {
          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        }
        
        // Only a is unsectioned - comes first
        if (!a.section_id) return -1;
        if (!b.section_id) return 1;
        
        // Both sectioned
        const sectionOrderA = sectionMap.get(a.section_id) ?? 999;
        const sectionOrderB = sectionMap.get(b.section_id) ?? 999;
        
        if (sectionOrderA !== sectionOrderB) {
          return sectionOrderA - sectionOrderB;
        }
        
        // Same section - sort by sort_order
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });

      console.log('After sorting - questions:', mapped.map((q: any) => ({ 
        id: q.id, 
        section_id: q.section_id, 
        sort_order: q.sort_order,
        order: q.order,
        text: q.text.substring(0, 20)
      })));

      // Re-index the order field based on final sorted position
      mapped.forEach((q, idx) => {
        q.order = idx;
      });

      console.log('Mapped questions:', mapped);
      console.log('Total questions loaded:', mapped.length);
      console.log('Questions by section:', 
        mapped.reduce((acc: any, q: any) => {
          const section = q.section_id || 'unsectioned';
          if (!acc[section]) acc[section] = [];
          acc[section].push(q.id);
          return acc;
        }, {})
      );
      mapped.forEach((q: any) => {
        console.log(`Question ${q.id} (section: ${q.section_id || 'none'}, order: ${q.order}) conditional_logic:`, q.conditional_logic);
      });

      setQuestions(mapped);
      
      // Create response record in DB immediately when survey starts
      // Don't generate ID manually - let DB create UUID automatically
      let insertError: any = null;
      let createdResponseId: string | null = null;
      
      // Try with status column first
      const { error: statusError, data: statusData } = await supabase
        .from('responses')
        .insert({
          survey_id: id,
          answers: {},
          duration_seconds: 0,
          language: language,
          status: 'in_progress',
        })
        .select('id');

      if (statusError) {
        console.warn('Status column not available, trying without it:', statusError);
        // If status column doesn't exist, retry without it
        const { error: fallbackError, data: fallbackData } = await supabase
          .from('responses')
          .insert({
            survey_id: id,
            answers: {},
            duration_seconds: 0,
            language: language,
          })
          .select('id');
        insertError = fallbackError;
        createdResponseId = fallbackData?.[0]?.id || null;
      } else {
        createdResponseId = statusData?.[0]?.id || null;
      }

      if (insertError) {
        console.error('Error creating response record:', insertError);
        console.error('Error details:', insertError?.message, insertError?.details, insertError?.code);
      } else {
        console.log('Response record created:', createdResponseId);
        setResponseId(createdResponseId);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading questions:', error);
      navigate(`/survey/${id}/closed`, { replace: true });
    }
  };

  // Save progress to DB
  const saveProgress = async (currentAnswers: Record<string, any>) => {
    if (!responseId) {
      console.warn('No responseId set, cannot save progress');
      return;
    }

    try {
      console.log('Saving progress for response:', responseId, 'with answers:', currentAnswers);
      const { error } = await supabase
        .from('responses')
        .update({
          answers: currentAnswers,
          duration_seconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
        })
        .eq('id', responseId);

      if (error) {
        console.error('Error saving progress:', error);
      } else {
        console.log('Progress saved successfully');
      }
    } catch (error) {
      console.error('Error in saveProgress:', error);
    }
  };

  // Check if a question is only used as a branch target (not in main sequential flow)
  const isBranchOnly = (qId: string, qIdx: number) => {
    // First question is never branch-only
    if (qIdx === 0) return false;
    
    // First question of a new section is never branch-only
    const currentQ = questions[qIdx];
    const prevQ = questions[qIdx - 1];
    if (currentQ?.section_id !== prevQ?.section_id) {
      return false; // Section change - this is a main sequence question
    }
    
    // Collect all question IDs that are branch targets
    const targetIds = new Set<string>();
    questions.forEach((q: any) => {
      if (q.conditional_logic?.length > 0) {
        q.conditional_logic.forEach((l: any) => {
          if (l.next_question_id) targetIds.add(l.next_question_id);
        });
      }
    });
    
    // If this question is NOT a branch target, it's not branch-only
    if (!targetIds.has(qId)) {
      return false;
    }
    
    // A question is branch-only if it's a target and immediately follows a question with conditional_logic
    if (!prevQ?.conditional_logic?.length) {
      return false; // Previous question doesn't have conditional_logic
    }
    
    // Previous question has conditional_logic - this is a branch target
    return true; // Branch-only
  };

  const question = questions[currentQuestion];
  const localized = question ? getLocalized(question, language) : { text: '', options: [] as string[] };
  
  // Count only non-branch-only questions across ALL sections for progress tracking
  const visibleQuestions = questions.filter((_, idx) => {
    const isBranch = isBranchOnly(questions[idx].id, idx);
    return !isBranch;
  });
  const totalQuestions = visibleQuestions.length;
  
  // Calculate current question position in visible questions across all sections
  const currentVisibleIndex = visibleQuestions.findIndex(q => q.id === question?.id);
  const progress = totalQuestions > 0 ? ((Math.max(0, currentVisibleIndex) + 1) / totalQuestions) * 100 : 0;
  
  console.log('Progress calculation:', {
    totalLoadedQuestions: questions.length,
    currentQuestion,
    currentQuestionId: question?.id,
    currentQuestionSection: question?.section_id,
    visibleQuestionsCount: visibleQuestions.length,
    visibleQuestionsIds: visibleQuestions.map((q: any) => ({ id: q.id, section: q.section_id, text: q.text.substring(0, 30) })),
    currentVisibleIndex,
    progress: Math.round(progress),
    branchOnlyQuestions: questions
      .map((q: any, idx: number) => ({
        id: q.id,
        section: q.section_id,
        isBranchOnly: isBranchOnly(q.id, idx)
      }))
      .filter((q: any) => q.isBranchOnly)
  });

  const normalizeYesNoAnswer = (localized: string): string => {
    // Normalize yes/no answers to English for conditional logic comparison
    const yesLabels = new Set([
      tQuestions.yes || 'Yes',
      'Yes',
      'Да',
      'Oui',
      'Sí'
    ]);
    const noLabels = new Set([
      tQuestions.no || 'No',
      'No',
      'Нет',
      'Non',
      'No'
    ]);
    
    if (yesLabels.has(localized)) return 'Yes';
    if (noLabels.has(localized)) return 'No';
    return localized;
  };

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
    // Save progress to DB before moving to next question
    await saveProgress(answers);

    // Check if current question has conditional logic
    if (question && question.conditional_logic && question.conditional_logic.length > 0) {
      let answer = answers[question.id];
      
      // Normalize yes/no answers for conditional logic matching
      if (question.type === 'yes-no') {
        answer = normalizeYesNoAnswer(answer);
      }
      
      const logic = question.conditional_logic.find((l: any) => l.answer === answer);
      
      console.log('Checking conditional logic:', {
        questionId: question.id,
        originalAnswer: answers[question.id],
        normalizedAnswer: answer,
        conditionalLogic: question.conditional_logic,
        foundLogic: logic
      });
      
      if (logic) {
        // Check if this condition ends the survey
        if (logic.end_survey) {
          console.log('Survey ended due to conditional logic');
          try {
            // Update response with final data
            const updateData: any = { answers, duration_seconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)), completed: true };
            
            const { error: updateError } = await supabase
              .from('responses')
              .update(updateData)
              .eq('id', responseId);

            if (updateError) {
              console.error('Error updating response:', updateError);
            } else {
              console.log('Response updated successfully at survey end');
            }

            const newResponseId = responseId || makeUUID();
            navigate(`/survey/${id}/opt-in?lng=${encodeURIComponent(language)}&rid=${encodeURIComponent(newResponseId)}`, {
              state: { lng: language, language, responseId: newResponseId },
            });
          } catch (error) {
            console.error('Error ending survey:', error);
          }
          return;
        }
        
        // Otherwise, branch to next_question_id
        if (logic.next_question_id) {
          // Find the next question by ID
          const nextQuestionIndex = questions.findIndex((q: any) => q.id === logic.next_question_id);
          console.log('Branching to question:', { nextQuestionIndex, targetId: logic.next_question_id });
          if (nextQuestionIndex >= 0) {
            // Jump to branch target - don't skip it even if branch-only
            setCurrentQuestion(nextQuestionIndex);
            return;
          }
        }
      }
    }

    // Default behavior - move to next non-branch-only question
    let nextIdx = currentQuestion + 1;
    while (nextIdx < questions.length && isBranchOnly(questions[nextIdx].id, nextIdx)) {
      console.log('Skipping branch-only question at index:', nextIdx);
      nextIdx++;
    }
    
    console.log('Moving to next question:', { from: currentQuestion, to: nextIdx, isBranchOnly: nextIdx < questions.length && isBranchOnly(questions[nextIdx].id, nextIdx) });
    
    if (nextIdx < questions.length) {
      setCurrentQuestion(nextIdx);
    } else {
      // Final submit: update response status to completed
      try {
        const finalAnswers = answers;
        const finalDuration = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
        const updateData: any = {
          answers: finalAnswers,
          duration_seconds: finalDuration,
          completed: true,
        };

        const { error: updateError } = await supabase
          .from('responses')
          .update(updateData)
          .eq('id', responseId);

        if (updateError) {
          console.error('Error updating response:', updateError);
        } else {
          console.log('Survey completed and response saved successfully');
        }

        navigate(`/survey/${id}/opt-in?lng=${encodeURIComponent(language)}&rid=${encodeURIComponent(responseId)}`, {
          state: { lng: language, language, responseId: responseId },
        });
      } catch (error) {
        console.error('Error completing survey:', error);
        // stay on the page so the user can retry
      }
    }
  };

  const handleBack = () => {
    let prevIdx = currentQuestion - 1;
    while (prevIdx >= 0 && isBranchOnly(questions[prevIdx].id, prevIdx)) {
      prevIdx--;
    }
    if (prevIdx >= 0) {
      setCurrentQuestion(prevIdx);
    }
  };

  const isAnswered =
    answers[question?.id] !== undefined &&
    (Array.isArray(answers[question?.id]) ? answers[question?.id].length > 0 : true);

  const canSkip = !question?.required;

  const handleSkip = () => {
    // Mark question as skipped (null value)
    setAnswers({ ...answers, [question.id]: null });
    handleNext();
  };

  if (loading || !question) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        {/* Language Toggle */}
        <div className="fixed top-6 right-6">
          <LanguageToggle currentLanguage={language} onLanguageChange={setLanguage} />
        </div>
        <SkeletonQuestionFlow />
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
              {t.question} {Math.max(1, currentVisibleIndex + 1)} {t.of} {totalQuestions}
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
          {/* Section Header */}
          {question?.section_id && (
            <div className="mb-6 pb-4 border-b border-gray-200">
              {sections.find(s => s.id === question.section_id) && (
                <>
                  <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">
                    {sections.find(s => s.id === question.section_id)?.name}
                  </h3>
                  {sections.find(s => s.id === question.section_id)?.description && (
                    <p className="text-sm text-gray-600 mt-2">
                      {sections.find(s => s.id === question.section_id)?.description}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          
          <h2 className="text-2xl font-semibold text-gray-900 mb-8">{localized.text}</h2>

          {/* Choice Questions */}
          {(question.type === 'multiple-choice' || question.type === 'single-choice') && (
            <div className="space-y-3">
              {localized.options?.map((option: string, optionIndex: number) => {
                const isMulti = question.type === 'multiple-choice';
                const current = answers[question.id];
                const isSelected = isMulti
                  ? (Array.isArray(current) ? current : []).includes(option)
                  : current === option;
                
                // Check if this is the "Other" option (last option when hasOtherOption is true)
                const isOtherOption = question.hasOtherOption && optionIndex === (localized.options?.length - 1);

                return (
                  <div key={option}>
                    <button
                      onClick={() => handleAnswer(option)}
                      className={`w-full text-left px-6 py-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isMulti ? (
                          // Square checkbox for multiple-choice
                          <div
                            className={`w-5 h-5 border-2 flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                            }`}
                          >
                            {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                        ) : (
                          // Round radio button for single-choice
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'border-indigo-600' : 'border-gray-300'
                            }`}
                          >
                            {isSelected && <div className="w-3 h-3 rounded-full bg-indigo-600" />}
                          </div>
                        )}
                        <span>{option}</span>
                      </div>
                    </button>
                    
                    {/* Text input for "Other" option */}
                    {isSelected && isOtherOption && (
                      <textarea
                        value={answers[`${question.id}_other`] || ''}
                        onChange={(e) => {
                          setAnswers({
                            ...answers,
                            [`${question.id}_other`]: e.target.value
                          });
                        }}
                        placeholder={tQuestions.placeholder ?? 'Please specify...'}
                        className="w-full mt-3 px-4 py-3 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        rows={3}
                      />
                    )}
                  </div>
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
              placeholder={tQuestions.placeholder ?? 'Enter your answer here...'}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}

          {/* Yes/No */}
          {question.type === 'yes-no' && (
            <div className="flex gap-4">
              {(localized.options.length ? localized.options : [tQuestions.yes ?? 'Yes', tQuestions.no ?? 'No']).map((option) => (
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
            <p className="text-sm text-gray-500 mt-4">{tQuestions.multiNote ?? 'You can select multiple options'}</p>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="mt-6 flex justify-between items-center gap-3">
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

          <div className="flex gap-2">
            {canSkip && (
              <button
                onClick={handleSkip}
                className="px-6 py-3 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors"
              >
                Skip
              </button>
            )}
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
    </div>
  );
}