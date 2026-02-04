import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import LanguageToggle from './LanguageToggle';
import { translations } from './translations';
import SkeletonQuestionFlow from '../common/SkeletonQuestionFlow';
import Toast from '../common/Toast';

// Translation cache to avoid redundant API calls
const translationCache: Record<string, string> = {};

// Translate text using MyMemory API (on-the-fly when user changes language)
async function translateText(text: string, from: string, to: string): Promise<string> {
  if (!text || from === to) return text;
  
  const cacheKey = `${from}|${to}|${text}`;
  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }
  
  try {
    const baseUrl = 'https://api.mymemory.translated.net/get';
    const params = new URLSearchParams({
      q: text.trim(),
      langpair: `${from}|${to}`,
    });
    
    const res = await fetch(`${baseUrl}?${params.toString()}`);
    const data = await res.json();
    
    if (data?.responseStatus === 429) {
      console.warn('Translation limit reached, using original text');
      return text;
    }
    
    const translated = data?.responseData?.translatedText || text;
    translationCache[cacheKey] = translated;
    return translated;
  } catch (error) {
    console.warn('Translation error:', error);
    return text;
  }
}

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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [translatedQuestions, setTranslatedQuestions] = useState<Record<string, any>>({});
  const [isTranslating, setIsTranslating] = useState(false);

  const t = translations[language]?.questions || translations.en.questions;
  const tQuestions = t as typeof translations.en.questions;

  type Lng = 'en' | 'ru' | 'fr' | 'es';

  const getLocalized = useCallback((q: any, lng: Lng) => {
    const p = q?.payload ?? {};
    const base = (p.baseLanguage || p.base_language || 'en') as Lng;
    
    // Check if we have on-the-fly translations for this question
    const translatedQ = translatedQuestions[`${q?.id}_${lng}`];

    // text can be: string OR { en: string, ... }
    const textMap = p.text;
    let text =
      (textMap && typeof textMap === 'object' ? (textMap[lng] || textMap[base]) : null) ||
      (typeof q?.text === 'string' ? q.text : '') ||
      (typeof q?.question_text === 'string' ? q.question_text : '') ||
      '';
    
    // Use on-the-fly translation if available and no pre-existing translation for this language
    if (translatedQ?.text && textMap && typeof textMap === 'object' && !textMap[lng]) {
      text = translatedQ.text;
    }

    // options can be: string[] OR { en: string[], ... }
    // For yes-no questions, always return empty options so translations are used
    let options: any[] = [];
    if (q?.type !== 'yes-no') {
      // Use translated options from payload if available, otherwise fall back to q.options
      const payloadOptions = p.options;
      if (payloadOptions && typeof payloadOptions === 'object' && !Array.isArray(payloadOptions)) {
        // payload.options is a map like { en: [...], ru: [...], ... }
        // Check explicitly if array exists (not just ||) because empty arrays are falsy in JS
        let baseOptions = (Array.isArray(payloadOptions[lng]) && payloadOptions[lng].length > 0 ? payloadOptions[lng] : 
                   Array.isArray(payloadOptions[base]) ? payloadOptions[base] : 
                   Array.isArray(q?.options) ? q.options : []);
        
        // Use on-the-fly translated options if available
        if (translatedQ?.options && Array.isArray(translatedQ.options) && !payloadOptions[lng]) {
          options = translatedQ.options;
        } else {
          options = baseOptions;
        }
      } else if (Array.isArray(payloadOptions)) {
        // payload.options is a direct array (older format) - use translated if available
        options = translatedQ?.options || payloadOptions;
      } else if (Array.isArray(q?.options)) {
        // Fall back to q.options (used for backward compatibility)
        options = translatedQ?.options || q.options;
      }
    } else {
      // For yes-no questions, log why we're not loading options
      console.log(`🔍 Skipping options for yes-no question ${q?.id} - type is yes-no, will use hardcoded Yes/No`);
    }

    // Add "Other" option if hasOtherOption is true
    // Use a special marker object so we can identify it later in the UI
    const hasOtherOption = q?.hasOtherOption || q?.has_other_option || false;
    let hasOther = false;
    if (hasOtherOption && !options.some(opt => opt && typeof opt === 'object' && opt.__isOtherOption)) {
      const otherText = tQuestions.other || 'Other (please specify)';
      options = [...options, { __text: otherText, __isOtherOption: true }];
      hasOther = true;
    }

    return { text, options, hasOtherOption };

  }, [tQuestions, translatedQuestions]);

  // State for translated sections
  const [translatedSections, setTranslatedSections] = useState<Record<string, any>>({});

  const getLocalizedSection = useCallback((section: any, lng: Lng) => {
    const p = section?.payload || {};
    const base = (p.baseLanguage || p.base_language || 'en') as Lng;

    // Check for on-the-fly translations
    const translatedS = translatedSections[`${section?.id}_${lng}`];

    // Get section name
    const nameMap = p.name || p.text;
    let name =
      (nameMap && typeof nameMap === 'object' ? (nameMap[lng] || nameMap[base]) : null) ||
      (typeof section?.name === 'string' ? section.name : '') ||
      '';
    
    // Use on-the-fly translation if available
    if (translatedS?.name) {
      name = translatedS.name;
    }

    // Get section description
    const descMap = p.description;
    let description =
      (descMap && typeof descMap === 'object' ? (descMap[lng] || descMap[base]) : null) ||
      (typeof section?.description === 'string' ? section.description : '') ||
      '';
    
    // Use on-the-fly translation if available
    if (translatedS?.description) {
      description = translatedS.description;
    }

    return { name, description };
  }, [translatedSections]);

  const makeUUID = () => {
    // Use browser crypto when available
    const c: any = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();

    // Fallback (good enough for client-side ids)
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
  };

  const loadSurveyQuestions = useCallback(async () => {
    try {
      console.log('📥 loadSurveyQuestions called');
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
      
      // Add debug info for caching issues
      const timestamp = new Date().toISOString();
      console.log(`📨 Questions loaded at ${timestamp}, count: ${data?.length}`);

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

        // Use row.type as primary source (it's what we just updated in the DB)
        // Only fall back to payload.type if row.type doesn't exist (legacy data)
        const questionType = row.type ?? payload.type ?? 'single-choice';

        console.log(`Question ${idx}:`, {
          id: row.id,
          type: questionType,
          row_type: row.type,
          payload_type: payload.type,
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
          type: questionType,
          payload: payload,
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
      console.log('Question types:', mapped.map(q => ({ id: q.id, type: q.type, text: q.text.substring(0, 30) })));
      console.log('Questions by section:', 
        mapped.reduce((acc: any, q: any) => {
          const section = q.section_id || 'unsectioned';
          if (!acc[section]) acc[section] = [];
          acc[section].push(q.id);
          return acc;
        }, {})
      );
      mapped.forEach((q: any) => {
        console.log(`Question ${q.id} (section: ${q.section_id || 'none'}, order: ${q.order}, type: ${q.type}) conditional_logic:`, q.conditional_logic);
      });

      console.log('Setting questions with new data - ABOUT TO UPDATE STATE');
      
      // Create fresh array to ensure React detects changes
      const freshMapped = mapped.map(q => ({...q}));
      
      console.log('🔄 SETQUESTIONS - Old vs New:');
      console.log('  Old questions[0].text:', questions[0]?.text?.substring(0, 40));
      console.log('  New freshMapped[0].text:', freshMapped[0]?.text?.substring(0, 40));
      
      setQuestions(freshMapped);
      
      console.log('Questions state updated');
      console.log('✅ Sample of fresh questions:');
      freshMapped.slice(0, 3).forEach(q => {
        console.log(`  Q ${q.id.slice(0, 8)}: text="${q.text?.substring(0, 40)}" | payload.text=${!!q.payload?.text}`);
      });
      
      // Check if we already have a responseId for this survey session
      // This prevents creating duplicate responses when user changes language mid-survey
      const existingResponseId = id ? localStorage.getItem(`survey_response_${id}`) : null;
      
      if (existingResponseId) {
        console.log('Found existing response session:', existingResponseId);
        setResponseId(existingResponseId);
      } else {
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
          // Save responseId to localStorage to avoid creating duplicate responses when language changes
          if (id && createdResponseId) {
            localStorage.setItem(`survey_response_${id}`, createdResponseId);
          }
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading questions:', error);
      navigate(`/survey/${id}/closed`, { replace: true });
    }
  }, [id, navigate, language]);

  useEffect(() => {
    setStartedAt(Date.now());
    if (id) {
      localStorage.setItem(`survey_lng_${id}`, language);
    }
    loadSurveyQuestions();
  }, [id, language, loadSurveyQuestions]);

  // On-the-fly translation when language changes and translations are missing
  useEffect(() => {
    const translateMissingQuestions = async () => {
      if (!questions.length || loading) return;
      
      const questionsNeedingTranslation = questions.filter(q => {
        const p = q?.payload ?? {};
        const textMap = p.text;
        const base = (p.baseLanguage || p.base_language || 'en') as string;
        
        // Check if translation exists for current language
        if (textMap && typeof textMap === 'object' && textMap[language]) {
          return false; // Already has translation
        }
        // Check if we already translated this question
        if (translatedQuestions[`${q.id}_${language}`]) {
          return false; // Already translated on-the-fly
        }
        // Need to translate if base language differs from selected
        return base !== language;
      });
      
      if (questionsNeedingTranslation.length === 0) return;
      
      console.log(`🌐 Translating ${questionsNeedingTranslation.length} questions to ${language}...`);
      setIsTranslating(true);
      
      const newTranslations: Record<string, any> = { ...translatedQuestions };
      
      for (const q of questionsNeedingTranslation) {
        try {
          const p = q?.payload ?? {};
          const base = (p.baseLanguage || p.base_language || 'en') as string;
          const textMap = p.text;
          const baseText = (textMap && typeof textMap === 'object' ? textMap[base] : null) || q.text || '';
          
          // Translate question text
          const translatedText = await translateText(baseText, base, language);
          
          // Translate options if any
          let translatedOptions: string[] = [];
          const payloadOptions = p.options;
          if (payloadOptions && typeof payloadOptions === 'object' && !Array.isArray(payloadOptions)) {
            const baseOptions = payloadOptions[base] || [];
            if (Array.isArray(baseOptions) && baseOptions.length > 0) {
              for (const opt of baseOptions) {
                const translatedOpt = await translateText(opt, base, language);
                translatedOptions.push(translatedOpt);
              }
            }
          } else if (Array.isArray(q.options)) {
            for (const opt of q.options) {
              const translatedOpt = await translateText(opt, base, language);
              translatedOptions.push(translatedOpt);
            }
          }
          
          newTranslations[`${q.id}_${language}`] = {
            text: translatedText,
            options: translatedOptions.length > 0 ? translatedOptions : undefined
          };
        } catch (error) {
          console.warn(`Failed to translate question ${q.id}:`, error);
        }
      }
      
      setTranslatedQuestions(newTranslations);
      setIsTranslating(false);
      console.log('✅ On-the-fly translation complete');
    };
    
    translateMissingQuestions();
  }, [questions, language, loading]);

  // On-the-fly translation for sections when language changes
  useEffect(() => {
    const translateMissingSections = async () => {
      if (!sections.length || loading) return;
      
      // Detect base language from section name (check for Cyrillic)
      const detectSectionBaseLang = (name: string) => {
        return /[А-Яа-яЁё]/.test(name) ? 'ru' : 'en';
      };
      
      const sectionsNeedingTranslation = sections.filter(s => {
        const p = s?.payload || {};
        const nameMap = p.name;
        const base = (p.baseLanguage || detectSectionBaseLang(s.name || '')) as string;
        
        // Check if translation exists for current language
        if (nameMap && typeof nameMap === 'object' && nameMap[language]) {
          return false;
        }
        // Check if we already translated this section
        if (translatedSections[`${s.id}_${language}`]) {
          return false;
        }
        // Need to translate if base language differs from selected
        return base !== language;
      });
      
      if (sectionsNeedingTranslation.length === 0) return;
      
      console.log(`🌐 Translating ${sectionsNeedingTranslation.length} sections to ${language}...`);
      
      const newTranslations: Record<string, any> = { ...translatedSections };
      
      for (const s of sectionsNeedingTranslation) {
        try {
          const base = detectSectionBaseLang(s.name || '');
          
          // Translate section name
          const translatedName = s.name ? await translateText(s.name, base, language) : '';
          
          // Translate section description
          const translatedDesc = s.description ? await translateText(s.description, base, language) : '';
          
          newTranslations[`${s.id}_${language}`] = {
            name: translatedName,
            description: translatedDesc
          };
        } catch (error) {
          console.warn(`Failed to translate section ${s.id}:`, error);
        }
      }
      
      setTranslatedSections(newTranslations);
      console.log('✅ Section translation complete');
    };
    
    translateMissingSections();
  }, [sections, language, loading]);

  // Reload questions when page becomes visible (user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible - reload questions to get any updates
        loadSurveyQuestions();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadSurveyQuestions]);

  // Periodic refresh of questions to catch updates from admin panel
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!document.hidden) {
        // Only refresh if page is visible
        console.log('⏰ Periodic refresh - checking for question updates...');
        loadSurveyQuestions();
      }
    }, 30000); // Check for updates every 30 seconds (less frequent to avoid issues)

    return () => clearInterval(intervalId);
  }, [loadSurveyQuestions]);

  // Subscribe to real-time updates of questions
  useEffect(() => {
    if (!id) return;

    console.log('🔔 Setting up real-time subscription for questions...');
    
    // Subscribe to changes in questions table
    const channel = supabase
      .channel(`questions:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'questions',
          filter: `survey_id=eq.${id}`,
        },
        (payload) => {
          console.log('🔄 Real-time update received:', {
            event: payload.eventType,
            tableName: payload.schema,
            newRecord: payload.new ? { id: payload.new.id, type: payload.new.type, text: payload.new.text?.substring(0, 30), options: payload.new.options } : null,
            oldRecord: payload.old ? { id: payload.old.id, type: payload.old.type, text: payload.old.text?.substring(0, 30), options: payload.old.options } : null,
          });
          // Reload all questions when any question changes
          loadSurveyQuestions();
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Unsubscribing from real-time updates');
      supabase.removeChannel(channel);
    };
  }, [id, loadSurveyQuestions]);

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

  // Calculate completion percentage based on answered questions
  const calculateCompletionPercentage = (currentAnswers: Record<string, any>): number => {
    if (questions.length === 0) return 0;
    
    // Count only visible (non-branch-only) questions
    const visibleQs = questions.filter((_, idx) => !isBranchOnly(questions[idx].id, idx));
    if (visibleQs.length === 0) return 0;
    
    // Count how many visible questions have been answered (not null/undefined)
    const answeredCount = visibleQs.filter(q => {
      const answer = currentAnswers[q.id];
      // Check if question has been answered (not null, not undefined, not empty array)
      return answer !== null && answer !== undefined && (Array.isArray(answer) ? answer.length > 0 : true);
    }).length;
    
    console.log('Completion:', {
      answeredCount,
      totalVisible: visibleQs.length,
      percentage: Math.round((answeredCount / visibleQs.length) * 100)
    });
    return answeredCount; // Return count of answered questions instead of percentage
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
  const localized = question ? getLocalized(question, language) : { text: '', options: [] as string[], hasOtherOption: false };
  
  console.log('🔍 Current question state:', {
    currentQuestion,
    questionId: question?.id,
    questionText: question?.text,
    localized: localized.text.substring(0, 50),
    questionsArrayLength: questions.length
  });
  
  // Count only non-branch-only questions across ALL sections for progress tracking
  // Memoize to prevent recalculation on language changes
  const visibleQuestions = useMemo(() => {
    return questions.filter((_, idx) => {
      const isBranch = isBranchOnly(questions[idx].id, idx);
      return !isBranch;
    });
  }, [questions]);
  
  const totalQuestions = visibleQuestions.length;
  
  // Calculate current question position in visible questions across all sections
  // Memoize to prevent recalculation on language changes
  const { currentVisibleIndex, progress } = useMemo(() => {
    const idx = visibleQuestions.findIndex(q => q.id === question?.id);
    const prog = totalQuestions > 0 ? ((Math.max(0, idx) + 1) / totalQuestions) * 100 : 0;
    return { currentVisibleIndex: idx, progress: prog };
  }, [visibleQuestions, question?.id, totalQuestions]);
  
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
      
      // IMPORTANT: Find conditional logic match by option INDEX, not by text value
      // This ensures conditional logic works correctly regardless of language
      let logic = question.conditional_logic.find((l: any) => l.answer === answer);
      
      // If direct match not found, try to find by option index (for multi-language support)
      if (!logic && (question.type === 'single-choice' || question.type === 'multiple-choice')) {
        // Find which English option matches the user's selected answer
        const currentLanguageOptions = question.payload?.options?.[language] || [];
        const englishOptions = question.payload?.options?.en || [];
        
        const answerIndex = currentLanguageOptions.indexOf(answer);
        
        if (answerIndex >= 0 && answerIndex < englishOptions.length) {
          const englishAnswer = englishOptions[answerIndex];
          logic = question.conditional_logic.find((l: any) => l.answer === englishAnswer);
          
          console.log('🔍 Found logic by option index:', { 
            language,
            answerIndex, 
            localizedAnswer: answer, 
            englishAnswer,
            currentLanguageOptions: currentLanguageOptions.slice(0, 2),
            englishOptions: englishOptions.slice(0, 2),
            foundLogic: !!logic 
          });
        } else {
          console.log('⚠️ Answer index not found:', {
            answer,
            answerIndex,
            currentLanguageOptions,
            language
          });
        }
      }
      
      console.log('Checking conditional logic:', {
        questionId: question.id,
        originalAnswer: answers[question.id],
        normalizedAnswer: answer,
        conditionalLogic: question.conditional_logic,
        foundLogic: logic,
        language: language
      });
      
      if (logic) {
        // Check if this condition ends the survey
        if (logic.end_survey) {
          console.log('Survey ended due to conditional logic');
          try {
            // Check minimum completion percentage
            const answeredCount = calculateCompletionPercentage(answers);
            const minAnswered = 1; // Minimum 1 question answered
            
            if (answeredCount < minAnswered) {
              console.log('Survey not saved - less than 1 question answered');
              return;
            }
            
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
            // Clean up the response ID from localStorage after survey is completed
            if (id) {
              localStorage.removeItem(`survey_response_${id}`);
            }
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
        // Check minimum completion percentage
        const answeredCount = calculateCompletionPercentage(answers);
        const minAnswered = 1; // Minimum 1 question answered
        
        if (answeredCount < minAnswered) {
          console.log('Survey not saved - less than 1 question answered');
          return;
        }

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

        // Clean up the response ID from localStorage after survey is completed
        if (id) {
          localStorage.removeItem(`survey_response_${id}`);
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

  // Check if question is answered, including validation for "Other" option
  const isAnswered = (() => {
    const answer = answers[question?.id];
    
    // Basic check - answer exists and not empty
    if (answer === undefined || answer === null) return false;
    if (Array.isArray(answer) && answer.length === 0) return false;
    
    // If answer is "Other" option, check if user entered minimum characters (5)
    if (question?.type === 'single-choice' || question?.type === 'multiple-choice') {
      const localized = getLocalized(question, language);
      const otherOption = localized.options.find((opt: any) => opt?.__isOtherOption);
      
      if (otherOption) {
        const otherText = Array.isArray(answer) ? answer[0] : answer;
        const displayText = otherOption?.__text || 'Other';
        
        // Check if the selected answer is the "Other" option
        if (otherText === displayText) {
          const otherValue = answers[`${question.id}_other`] || '';
          // Require at least 5 characters for "Other" text input
          return otherValue.trim().length >= 5;
        }
      }
    }
    
    return true;
  })();

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
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-700">
                {t.question} {Math.max(1, currentVisibleIndex + 1)} {t.of} {totalQuestions}
              </span>
              {/* Show message based on question type */}
              {question?.id && isBranchOnly(question.id, questions.findIndex(q => q.id === question.id)) ? (
                <div className="text-xs text-gray-600 mt-1">
                  Additional question
                </div>
              ) : question?.conditional_logic && question.conditional_logic.length > 0 && (
                <div className="text-xs text-amber-600 mt-1">
                  Additional questions based on your answer
                </div>
              )}
            </div>
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
                  {(() => {
                    const section = sections.find(s => s.id === question.section_id);
                    const localized = getLocalizedSection(section, language);
                    return (
                      <>
                        <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">
                          {localized.name}
                        </h3>
                        {localized.description && (
                          <p className="text-sm text-gray-600 mt-2">
                            {localized.description}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}
          
          {console.log('Rendering question:', { id: question.id, type: question.type, text: question.text.substring(0, 30) })}
          <h2 className="text-2xl font-semibold text-gray-900 mb-8">{localized.text}</h2>

          {/* Choice Questions */}
          {(question.type === 'multiple-choice' || question.type === 'single-choice') && (
            <div className="space-y-3">
              {localized.options?.map((option: any, optionIndex: number) => {
                const isMulti = question.type === 'multiple-choice';
                const current = answers[question.id];
                
                // Handle both string and object options (object has __isOtherOption flag)
                const optionText = typeof option === 'object' ? option.__text : option;
                const isOtherOption = typeof option === 'object' && option.__isOtherOption;
                
                const isSelected = isMulti
                  ? (Array.isArray(current) ? current : []).includes(optionText)
                  : current === optionText;

                return (
                  <div key={optionText}>
                    <button
                      onClick={() => handleAnswer(optionText)}
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
                        <span>{optionText}</span>
                      </div>
                    </button>
                    
                    {/* Text input for "Other" option */}
                    {isSelected && isOtherOption && (
                      <div className="mt-3">
                        <textarea
                          value={answers[`${question.id}_other`] || ''}
                          onChange={(e) => {
                            setAnswers({
                              ...answers,
                              [`${question.id}_other`]: e.target.value
                            });
                          }}
                          placeholder={tQuestions.placeholder ?? 'Please specify...'}
                          className="w-full px-4 py-3 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          rows={3}
                          autoFocus
                        />
                        <div className={`mt-2 text-sm ${(answers[`${question.id}_other`] || '').length >= 5 ? 'text-green-600' : 'text-gray-600'}`}>
                          {(answers[`${question.id}_other`] || '').length}/5 {tQuestions.characters_minimum || 'characters minimum'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Scale */}
          {question.type === 'scale' && (
            <div className="space-y-6">
              {/* Min and Max Labels */}
              {(question.payload?.scaleMin || question.payload?.scaleMax) && (
                <div className="flex justify-between text-sm text-gray-600 px-2">
                  {question.payload?.scaleMin && (
                    <span>
                      {typeof question.payload.scaleMin === 'object'
                        ? question.payload.scaleMin[language] || question.payload.scaleMin[question.payload.baseLanguage] || ''
                        : question.payload.scaleMin}
                    </span>
                  )}
                  {question.payload?.scaleMax && (
                    <span>
                      {typeof question.payload.scaleMax === 'object'
                        ? question.payload.scaleMax[language] || question.payload.scaleMax[question.payload.baseLanguage] || ''
                        : question.payload.scaleMax}
                    </span>
                  )}
                </div>
              )}
              
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

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={true}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}