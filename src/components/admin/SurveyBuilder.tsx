import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2, GripVertical, ChevronDown, ChevronUp, FileText, Copy } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import Toast from '../common/Toast';
import SkeletonQuestion from '../common/SkeletonQuestion';
import { AdminLanguageContext } from './AdminLayout';
import { adminTranslations } from './adminTranslations';


interface Question {
  id: string;
  type: 'single-choice' | 'multiple-choice' | 'scale' | 'text' | 'yes-no';
  text: string;
  options?: string[];
  required: boolean;
  hasOtherOption?: boolean;
  order: number;
  section_id?: string;
  scaleMin?: string;  // Description for value 1
  scaleMax?: string;  // Description for value 5
  conditional_logic?: {
    condition_type: 'answer_equals';
    answer: string;
    next_question_id?: string;
    end_survey?: boolean;
  }[];
}

// --- Auto-translation (MyMemory) ---
const MYMEMORY_EMAIL = ''; // optional: put your email here to increase daily quota (de=)

type SupportedLng = 'en' | 'ru' | 'fr' | 'es';

// Translation error class to distinguish API limits from other errors
class TranslationLimitError extends Error {
  constructor(message: string, public retryAfter?: number) {
    super(message);
    this.name = 'TranslationLimitError';
  }
}

async function translateMyMemory(text: string, from: SupportedLng, to: SupportedLng) {
  // Ensure text is a string (handle cases where it might be object or null)
  const safeText = typeof text === 'string' ? text : String(text ?? '');
  const trimmed = safeText.trim();
  if (!trimmed) return '';

  const baseUrl = 'https://api.mymemory.translated.net/get';
  const params = new URLSearchParams({
    q: trimmed,
    langpair: `${from}|${to}`,
  });
  if (MYMEMORY_EMAIL) params.set('de', MYMEMORY_EMAIL);

  try {
    const res = await fetch(`${baseUrl}?${params.toString()}`);
    const data = await res.json();
    
    // Check for rate limit error from MyMemory
    if (data?.responseStatus === 429 || data?.error?.code === 'QUOTUM_REACHED' || data?.error?.message?.includes('Quotum exceeded')) {
      throw new TranslationLimitError(
        'Translation service has reached its daily limit. Please try again tomorrow.',
        86400
      );
    }
    
    // Return translated text or fallback to original
    return data?.responseData?.translatedText ?? trimmed;
  } catch (error) {
    // Re-throw TranslationLimitError as-is, otherwise return original text
    if (error instanceof TranslationLimitError) {
      throw error;
    }
    console.warn('Translation error (falling back to original):', error);
    return trimmed;
  }
}

async function translateArrayMyMemory(items: string[], from: SupportedLng, to: SupportedLng) {
  const out: string[] = [];
  for (const item of items) {
    // Ensure item is a string
    const safeItem = typeof item === 'string' ? item : String(item ?? '');
    out.push(await translateMyMemory(safeItem, from, to));
  }
  return out;
}

function detectBaseLanguage(text: string, options: string[] = []): 'en' | 'ru' {
  const combined = [text, ...options].join(' ');
  const hasCyrillic = /[А-Яа-яЁё]/.test(combined);
  return hasCyrillic ? 'ru' : 'en';
}

// Build payload WITHOUT translations - translations happen on-the-fly when user takes survey
function buildQuestionPayloadWithoutTranslations(args: {
  baseLanguage: SupportedLng;
  text: string;
  options?: string[];
  type: Question['type'];
  required: boolean;
  hasOtherOption?: boolean;
  scaleMin?: string;
  scaleMax?: string;
}) {
  const { baseLanguage, text, options = [], type, required, hasOtherOption } = args;
  const scaleMin = typeof args.scaleMin === 'string' ? args.scaleMin : '';
  const scaleMax = typeof args.scaleMax === 'string' ? args.scaleMax : '';

  // Auto-detect base language (RU/EN)
  const resolvedBaseLanguage = (baseLanguage === 'fr' || baseLanguage === 'es')
    ? baseLanguage
    : detectBaseLanguage(text, options);

  const payload: any = {
    baseLanguage: resolvedBaseLanguage,
    type,
    required,
    hasOtherOption: !!hasOtherOption,
    text: { [resolvedBaseLanguage]: text },
    options: { [resolvedBaseLanguage]: options },
    scaleMin: { [resolvedBaseLanguage]: scaleMin },
    scaleMax: { [resolvedBaseLanguage]: scaleMax },
    translations: {},
  };

  return payload;
}

// Keep old function for manual "Retry Translations" button only
async function buildQuestionPayloadWithTranslations(args: {
  baseLanguage: SupportedLng;
  text: string;
  options?: string[];
  type: Question['type'];
  required: boolean;
  hasOtherOption?: boolean;
  scaleMin?: string;
  scaleMax?: string;
}) {
const { baseLanguage, text, options = [], type, required, hasOtherOption } = args;
// Ensure scaleMin and scaleMax are strings (handle case where they might be objects)
const scaleMin = typeof args.scaleMin === 'string' ? args.scaleMin : '';
const scaleMax = typeof args.scaleMax === 'string' ? args.scaleMax : '';

// Auto-detect base language (RU/EN) to avoid wrong translations when you type Russian text
const resolvedBaseLanguage = (baseLanguage === 'fr' || baseLanguage === 'es')
  ? baseLanguage
  : detectBaseLanguage(text, options);

  const langs: SupportedLng[] = ['en', 'ru', 'fr', 'es'];
  const targets = langs.filter((l) => l !== resolvedBaseLanguage);

  const payload: any = {
    baseLanguage: resolvedBaseLanguage,
    type,
    required,
    hasOtherOption: !!hasOtherOption,
    text: { [resolvedBaseLanguage]: text },
    options: { [resolvedBaseLanguage]: options },
    scaleMin: { [resolvedBaseLanguage]: scaleMin },
    scaleMax: { [resolvedBaseLanguage]: scaleMax },
    translations: {},
  };

  for (const lng of targets) {
    const translatedText = await translateMyMemory(text, resolvedBaseLanguage, lng);
    const translatedOptions = type === 'single-choice' || type === 'multiple-choice'
      ? await translateArrayMyMemory(options, resolvedBaseLanguage, lng)
      : [];
    
    const translatedScaleMin = scaleMin
      ? await translateMyMemory(scaleMin, resolvedBaseLanguage, lng)
      : '';
    const translatedScaleMax = scaleMax
      ? await translateMyMemory(scaleMax, resolvedBaseLanguage, lng)
      : '';

    payload.text[lng] = translatedText;
    payload.options[lng] = translatedOptions;
    payload.scaleMin[lng] = translatedScaleMin;
    payload.scaleMax[lng] = translatedScaleMax;
    payload.translations[lng] = { text: translatedText, options: translatedOptions };
  }

  return payload;
}

const translations = {
  en: {
    addOption: 'Add Option',
    pasteOption: 'Paste Option',
    addOther: 'Add Other',
    other: 'Other (please specify)',
    duplicateQuestion: 'Duplicate Question',
    requiredQuestion: 'Required Question',
    questionText: 'Question Text',
    questionType: 'Question Type',
    options: 'Options',
    addBelow: 'Add Below',
    delete: 'Delete',
    preview: 'Preview Survey',
    saveChanges: 'Save Changes',
    saving: 'Saving...',
    saved: 'Saved',
    totalQuestions: 'Total Questions',
    surveyBuilder: 'Survey Builder',
    buildCustomize: 'Build and customize survey questions',
    noQuestions: 'No questions yet',
    getStarted: 'Get started by adding your first question',
    addQuestion: 'Add Question',
    saved_toast: 'Questions saved successfully',
    failed_toast: 'Failed to save questions',
    failed_load: 'Failed to load questions',
    failed_delete: 'Failed to delete question',
    active: 'Active',
    disabled: 'Disabled',
    surveyStatus: 'Survey Status',
    surveyState: 'State',
    statusUpdated: 'Survey status updated',
    statusUpdateFailed: 'Failed to update survey status',
    yes: 'Yes',
    no: 'No',
    descriptionNote: 'Note: The description below will be shown to survey respondents at the beginning of the survey.',
    thankYouMessage: 'Thank You Message',
    defaultThankYouText: 'Thank you for completing this survey! Your feedback is valuable to us.',
    section: 'Section',
    sectionName: 'Section Name',
    sectionDescription: 'Section Description',
    addSection: 'Add Section',
    deleteSection: 'Delete Section',
    selectSection: 'Select Section',
    activateModalTitle: 'Activate Survey?',
    activateModalDesc: 'Your questionnaire has been saved. To start collecting responses, activate the survey.',
    activateLater: 'Later',
    activateNow: 'Activate',
  },
  ru: {
    addOption: 'Добавить вариант',
    pasteOption: 'Вставить вариант',
    addOther: 'Добавить "Другое"',
    other: 'Другое (укажите)',
    duplicateQuestion: 'Дублировать вопрос',
    requiredQuestion: 'Обязательный вопрос',
    questionText: 'Текст вопроса',
    questionType: 'Тип вопроса',
    options: 'Варианты ответов',
    addBelow: 'Добавить ниже',
    delete: 'Удалить',
    preview: 'Предпросмотр',
    saveChanges: 'Сохранить изменения',
    saving: 'Сохранение...',
    saved: 'Сохранено',
    totalQuestions: 'Всего вопросов',
    surveyBuilder: 'Конструктор опросов',
    buildCustomize: 'Создавайте и настраивайте вопросы опроса',
    noQuestions: 'Вопросов еще нет',
    getStarted: 'Начните с добавления первого вопроса',
    addQuestion: 'Добавить вопрос',
    saved_toast: 'Вопросы успешно сохранены',
    failed_toast: 'Ошибка при сохранении вопросов',
    failed_load: 'Ошибка при загрузке вопросов',
    failed_delete: 'Ошибка при удалении вопроса',
    active: 'Активен',
    disabled: 'Отключен',
    surveyStatus: 'Статус опроса',
    surveyState: 'Состояние',
    statusUpdated: 'Статус опроса обновлен',
    statusUpdateFailed: 'Ошибка при обновлении статуса опроса',
    yes: 'Да',
    no: 'Нет',
    descriptionNote: 'Примечание: Описание ниже будет показано респондентам в начале опроса.',
    thankYouMessage: 'Сообщение благодарности',
    defaultThankYouText: 'Спасибо за заполнение этого опроса! Ваш отзыв очень важен для нас.',
    section: 'Раздел',
    sectionName: 'Название раздела',
    sectionDescription: 'Описание раздела',
    addSection: 'Добавить раздел',
    deleteSection: 'Удалить раздел',
    selectSection: 'Выберите раздел',
    activateModalTitle: 'Активировать опрос?',
    activateModalDesc: 'Ваш вопросник сохранен. Чтобы начать собирать ответы, активируйте опрос.',
    activateLater: 'Позже',
    activateNow: 'Активировать',
  },
  fr: {
    addOption: 'Ajouter une option',
    pasteOption: 'Coller une option',
    addOther: 'Ajouter Autre',
    other: 'Autre (veuillez préciser)',
    duplicateQuestion: 'Dupliquer la question',
    requiredQuestion: 'Question obligatoire',
    questionText: 'Texte de la question',
    questionType: 'Type de question',
    options: 'Options',
    addBelow: 'Ajouter ci-dessous',
    delete: 'Supprimer',
    preview: 'Aperçu du sondage',
    saveChanges: 'Enregistrer les modifications',
    saving: 'Enregistrement...',
    saved: 'Enregistré',
    totalQuestions: 'Nombre total de questions',
    surveyBuilder: 'Générateur de sondage',
    buildCustomize: 'Créez et personnalisez les questions du sondage',
    noQuestions: 'Aucune question pour le moment',
    getStarted: 'Commencez par ajouter votre première question',
    addQuestion: 'Ajouter une question',
    saved_toast: 'Questions enregistrées avec succès',
    failed_toast: 'Erreur lors de l\'enregistrement des questions',
    failed_load: 'Erreur lors du chargement des questions',
    failed_delete: 'Erreur lors de la suppression de la question',
    active: 'Actif',
    disabled: 'Désactivé',
    surveyStatus: 'Statut de l\'enquête',
    surveyState: 'État',
    statusUpdated: 'Statut de l\'enquête mis à jour',
    statusUpdateFailed: 'Erreur lors de la mise à jour du statut de l\'enquête',
    yes: 'Oui',
    no: 'Non',
    descriptionNote: 'Remarque : La description ci-dessous sera affichée aux répondants au début de l\'enquête.',
    thankYouMessage: 'Message de remerciement',
    defaultThankYouText: 'Merci d\'avoir rempli cette enquête ! Vos commentaires sont précieux pour nous.',
    section: 'Section',
    sectionName: 'Nom de la section',
    sectionDescription: 'Description de la section',
    addSection: 'Ajouter une section',
    deleteSection: 'Supprimer la section',
    selectSection: 'Sélectionner une section',
    activateModalTitle: 'Activer l\'enquête?',
    activateModalDesc: 'Votre questionnaire a été enregistré. Pour commencer à collecter des réponses, activez l\'enquête.',
    activateLater: 'Plus tard',
    activateNow: 'Activer',
  },
  es: {
    addOption: 'Agregar opción',
    pasteOption: 'Pegar opción',
    addOther: 'Agregar Otro',
    other: 'Otro (por favor especifique)',
    duplicateQuestion: 'Duplicar pregunta',
    requiredQuestion: 'Pregunta requerida',
    questionText: 'Texto de la pregunta',
    questionType: 'Tipo de pregunta',
    options: 'Opciones',
    addBelow: 'Agregar abajo',
    delete: 'Eliminar',
    preview: 'Vista previa de la encuesta',
    saveChanges: 'Guardar cambios',
    saving: 'Guardando...',
    saved: 'Guardado',
    totalQuestions: 'Total de preguntas',
    surveyBuilder: 'Constructor de encuestas',
    buildCustomize: 'Cree y personalice las preguntas de la encuesta',
    noQuestions: 'Sin preguntas aún',
    getStarted: 'Comience agregando su primera pregunta',
    addQuestion: 'Agregar pregunta',
    saved_toast: 'Preguntas guardadas exitosamente',
    failed_toast: 'Error al guardar preguntas',
    failed_load: 'Error al cargar preguntas',
    failed_delete: 'Error al eliminar pregunta',
    active: 'Activo',
    disabled: 'Desactivado',
    surveyStatus: 'Estado de la encuesta',
    surveyState: 'Estado',
    statusUpdated: 'Estado de la encuesta actualizado',
    statusUpdateFailed: 'Error al actualizar el estado de la encuesta',
    yes: 'Sí',
    no: 'No',
    descriptionNote: 'Nota: La descripción a continuación se mostrará a los encuestados al principio de la encuesta.',
    thankYouMessage: 'Mensaje de agradecimiento',
    defaultThankYouText: '¡Gracias por completar esta encuesta! Sus comentarios son muy valiosos para nosotros.',
    section: 'Sección',
    sectionName: 'Nombre de la sección',
    sectionDescription: 'Descripción de la sección',
    addSection: 'Añadir sección',
    deleteSection: 'Eliminar sección',
    selectSection: 'Seleccionar sección',
    activateModalTitle: '¿Activar encuesta?',
    activateModalDesc: 'Su cuestionario ha sido guardado. Para comenzar a recopilar respuestas, active la encuesta.',
    activateLater: 'Más tarde',
    activateNow: 'Activar',
  },
};

export default function SurveyBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { language } = useContext(AdminLanguageContext);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'idle'>('idle');
  const [loading, setLoading] = useState(true);
  const [descriptionLanguage, setDescriptionLanguage] = useState<'en' | 'ru' | 'fr' | 'es'>('en');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [surveyIsActive, setSurveyIsActive] = useState<boolean>(true);
  const [loadingSurveyStatus, setLoadingSurveyStatus] = useState(false);
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyDescription, setSurveyDescription] = useState('');
  const [surveyDescriptions, setSurveyDescriptions] = useState<Record<'en' | 'ru' | 'fr' | 'es', string>>({
    en: '',
    ru: '',
    fr: '',
    es: '',
  });
  const [estimatedTime, setEstimatedTime] = useState('4');
  const [thankYouMessage, setThankYouMessage] = useState('');
  const [showSurveyInfo, setShowSurveyInfo] = useState(true);
  const [surveyInfoExpanded, setSurveyInfoExpanded] = useState(false);
  const [surveyInfoLoading, setSurveyInfoLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [sectionsExpanded, setSectionsExpanded] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionDesc, setNewSectionDesc] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [retryTranslationStatus, setRetryTranslationStatus] = useState<'idle' | 'retrying' | 'success'>('idle');
  const otherInputRef = useRef<HTMLInputElement | null>(null);
  const newQuestionRef = useRef<HTMLDivElement | null>(null);
  const [otherValues, setOtherValues] = useState<Record<string, string>>({});
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [editingSectionDesc, setEditingSectionDesc] = useState('');
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [originalQuestionIds, setOriginalQuestionIds] = useState<Set<string>>(new Set());

  const t = translations[language];
  const adminT = adminTranslations[language];

  useEffect(() => {
    loadQuestions();
  }, [id]);

  // Auto-focus on "Other" input when it's added
  useEffect(() => {
    if (otherInputRef.current) {
      otherInputRef.current.focus();
    }
  }, [expandedQuestion, questions.map(q => q.hasOtherOption).join()]);


  const loadQuestions = async () => {
    try {
      setLoading(true);

      // Try to fetch survey status and info
      try {
        const { data: surveyData, error: surveyError } = await supabase
          .from('surveys')
          .select('status, title, description, estimated_time, thank_you_message, show_survey_info')
          .eq('id', id)
          .single();

        if (surveyError && surveyError.code !== '42703' && surveyError.code !== 'PGRST116') {
          throw surveyError;
        }
        
        if (surveyData) {
          setSurveyIsActive(surveyData.status === 'active');
          setSurveyTitle(surveyData.title || '');
          
          // Parse description - it could be JSON or plain text
          let parsedDescriptions: Record<'en' | 'ru' | 'fr' | 'es', string> = {
            en: '',
            ru: '',
            fr: '',
            es: '',
          };
          
          if (surveyData.description) {
            try {
              const parsed = JSON.parse(surveyData.description);
              if (typeof parsed === 'object' && parsed !== null) {
                parsedDescriptions = { ...parsedDescriptions, ...parsed };
              } else {
                parsedDescriptions.en = surveyData.description;
              }
            } catch {
              // If not JSON, treat as plain English text
              parsedDescriptions.en = surveyData.description;
            }
          }
          
          setSurveyDescriptions(parsedDescriptions);
          setSurveyDescription(surveyData.description || '');
          setEstimatedTime(surveyData.estimated_time?.toString() || '4');
          setThankYouMessage(surveyData.thank_you_message || '');
          setShowSurveyInfo(surveyData.show_survey_info !== false);
        }
      } catch (statusError: any) {
        // If column doesn't exist (42703), just continue with default status
        if (statusError?.code !== '42703') {
          console.error('Error loading survey status:', statusError);
        }
      }

      // Fetch questions for this survey
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('survey_id', id)
        .order('sort_order', { ascending: true });

      if (questionsError) throw questionsError;

      console.log('Raw questions from DB:', questionsData?.[0]); // Log first question to see all fields

      // Parse conditional_logic from JSON strings
      const parsedQuestions = (questionsData || []).map((q: any) => {
        console.log('Loading question from DB:', {
          id: q.id,
          text: q.text,
          type: q.type,
          conditional_logic_raw: q.conditional_logic,
          conditional_logic_parsed: q.conditional_logic 
            ? (typeof q.conditional_logic === 'string' ? JSON.parse(q.conditional_logic) : q.conditional_logic)
            : undefined
        });
        
        const payload = q.payload || {};
        
        return {
          ...q,
          order: q.sort_order,
          options: Array.isArray(q.options) ? q.options : (q.options ? [q.options] : []),
          scaleMin: payload.scaleMin || '',
          scaleMax: payload.scaleMax || '',
          conditional_logic: q.conditional_logic 
            ? (typeof q.conditional_logic === 'string' ? JSON.parse(q.conditional_logic) : q.conditional_logic)
            : undefined
        };
      });

      setQuestions(parsedQuestions);
      // Track original question IDs for deletion detection
      setOriginalQuestionIds(new Set(parsedQuestions.map((q: any) => q.id)));
      
      // Fetch sections for this survey
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('survey_sections')
        .select('*')
        .eq('survey_id', id)
        .order('order_index', { ascending: true });
      
      if (sectionsError && sectionsError.code !== '42703' && sectionsError.code !== 'PGRST116') {
        console.error('Error loading sections:', sectionsError);
      }
      
      setSections(sectionsData || []);
      
      setSaveStatus('saved');
      setLoading(false);
    } catch (error) {
      console.error('Error loading questions:', error);
      setToast({ message: t.failed_load, type: 'error' });
      setLoading(false);
    }
  };

  // Helper for temporary question IDs
  const makeTempId = () => {
    const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    return `temp_${uuid}`;
  };

  const addQuestion = (afterIndex?: number, sectionId?: string) => {
    console.log('Adding question with sectionId:', sectionId ?? selectedSectionId);
    const newQuestion: Question = {
      id: makeTempId(),
      type: 'single-choice',
      text: '',
      options: ['Option 1', 'Option 2'],
      required: false,
      hasOtherOption: false,
      order: afterIndex !== undefined ? afterIndex + 1 : questions.length,
      section_id: sectionId ?? selectedSectionId ?? undefined,
      scaleMin: '',
      scaleMax: '',
    };

    console.log('New question created:', newQuestion);

    let newQuestions: Question[];
    if (afterIndex !== undefined) {
      newQuestions = [
        ...questions.slice(0, afterIndex + 1),
        newQuestion,
        ...questions.slice(afterIndex + 1).map((q, i) => ({ ...q, order: q.order + 1 })),
      ];
    } else {
      newQuestions = [...questions, newQuestion];
    }

    setQuestions(newQuestions);
    setExpandedQuestion(newQuestion.id);
    setSaveStatus('unsaved');
  };

  const duplicateQuestion = (questionId: string, index: number) => {
    const questionToDuplicate = questions.find(q => q.id === questionId);
    if (!questionToDuplicate) return;

    const newQuestion: Question = {
      ...questionToDuplicate,
      id: makeTempId(),
      order: index + 1,
    };

    const newQuestions = [
      ...questions.slice(0, index + 1),
      newQuestion,
      ...questions.slice(index + 1).map((q, i) => ({ ...q, order: q.order + 1 })),
    ];

    setQuestions(newQuestions);
    setExpandedQuestion(newQuestion.id);
    setSaveStatus('unsaved');
  };

  const deleteQuestion = async (questionId: string) => {
    try {
      // Just remove from local state, don't delete from DB yet
      // DB deletion will happen during handleSave
      setQuestions(questions.filter(q => q.id !== questionId));
      setSaveStatus('unsaved');
    } catch (error) {
      console.error('Error deleting question:', error);
      setToast({ message: t.failed_delete, type: 'error' });
    }
  };

  const moveQuestionUp = (questionId: string) => {
    const index = questions.findIndex(q => q.id === questionId);
    if (index <= 0) return; // Can't move first question up

    const question = questions[index];
    const prevQuestion = questions[index - 1];

    // Only allow moving within same section
    if (question.section_id !== prevQuestion.section_id) {
      return;
    }

    // Swap the questions
    const newQuestions = [...questions];
    [newQuestions[index], newQuestions[index - 1]] = [newQuestions[index - 1], newQuestions[index]];

    // Update order values
    newQuestions.forEach((q, idx) => {
      q.order = idx;
    });

    setQuestions(newQuestions);
    setSaveStatus('unsaved');
  };

  const moveQuestionDown = (questionId: string) => {
    const index = questions.findIndex(q => q.id === questionId);
    if (index >= questions.length - 1) return; // Can't move last question down

    const question = questions[index];
    const nextQuestion = questions[index + 1];

    // Only allow moving within same section
    if (question.section_id !== nextQuestion.section_id) {
      return;
    }

    // Swap the questions
    const newQuestions = [...questions];
    [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];

    // Update order values
    newQuestions.forEach((q, idx) => {
      q.order = idx;
    });

    setQuestions(newQuestions);
    setSaveStatus('unsaved');
  };

  const pasteOptionFromClipboard = async (questionId: string) => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const trimmedText = clipboardText.trim();
      
      if (!trimmedText) {
        setToast({ message: 'Clipboard is empty', type: 'error' });
        return;
      }

      const question = questions.find(q => q.id === questionId);
      if (!question) return;

      // Add the pasted text as a new option
      const newOptions = [...(question.options || []), trimmedText];
      updateQuestion(questionId, 'options', newOptions);
      setToast({ message: 'Option pasted successfully', type: 'success' });
    } catch (error) {
      // Handle errors (permission denied, no clipboard access, etc.)
      setToast({ message: 'Failed to read clipboard. Please allow clipboard access.', type: 'error' });
      console.error('Clipboard error:', error);
    }
  };

  const updateQuestion = (questionId: string, key: keyof Question, value: any) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        const updatedQ = { ...q, [key]: value };
        
        // When changing type, handle options appropriately
        if (key === 'type') {
          console.log('Question type changed from', q.type, 'to', value);
          
          if (value === 'yes-no') {
            // When changing to yes-no type, set options to Yes/No
            updatedQ.options = [t.yes, t.no];
          } else if (value === 'scale') {
            // When changing to scale type, clear options
            updatedQ.options = [];
          } else if (value === 'text') {
            // When changing to text type, clear options
            updatedQ.options = [];
          } else {
            // For single-choice and multiple-choice, keep existing options or set defaults
            if (!updatedQ.options || updatedQ.options.length === 0) {
              updatedQ.options = ['Option 1', 'Option 2'];
            }
          }
          
          console.log('Updated options:', updatedQ.options);
        }
        
        return updatedQ;
      }
      return q;
    }));
    setSaveStatus('unsaved');
  };

  const handlePreview = () => {
    window.open(`${window.location.origin}/survey/${id}`, '_blank', 'noopener,noreferrer');
  };

  // Helper function to get payload - NO translations on save, translations happen when user takes survey
  const getPayloadForQuestion = async (question: Question, originalQuestion?: any) => {
    // If it's a new question, build payload without translations
    if (question.id.startsWith('temp_')) {
      return buildQuestionPayloadWithoutTranslations({
        baseLanguage: language,
        text: question.text,
        options: question.options,
        type: question.type,
        required: question.required,
        hasOtherOption: question.hasOtherOption,
        scaleMin: question.scaleMin,
        scaleMax: question.scaleMax,
      });
    }

    // If text or options haven't changed, reuse old payload
    if (originalQuestion) {
      const textChanged = question.text !== originalQuestion.text;
      const typeChanged = question.type !== originalQuestion.type;
      const optionsChanged = JSON.stringify(question.options) !== JSON.stringify(originalQuestion.options);
      const scaleMinChanged = question.scaleMin !== originalQuestion.scaleMin;
      const scaleMaxChanged = question.scaleMax !== originalQuestion.scaleMax;
      
      // CRITICAL: Check if payload type mismatches question type (e.g., payload says yes-no but question is multiple-choice)
      const payloadTypeChanged = originalQuestion.payload && originalQuestion.payload.type && 
                                  (originalQuestion.payload.type !== question.type);
      
      console.log(`🔍 Payload cache check for ${question.id}:`, {
        textChanged,
        typeChanged,
        optionsChanged,
        scaleMinChanged,
        scaleMaxChanged,
        payloadTypeChanged,
        hasPayload: !!originalQuestion.payload,
        payloadType: originalQuestion.payload?.type,
        originalType: originalQuestion.type,
        newType: question.type,
        originalOptions: originalQuestion.options?.slice(0, 2),
        newOptions: question.options?.slice(0, 2),
      });
      
      // CRITICAL: Check if payload text mismatches question text (e.g., user edited the question text)
      const payloadTextChanged = originalQuestion.payload && originalQuestion.payload.text && 
                                  (originalQuestion.payload.text.en !== question.text);
      
      // If payload type doesn't match current question type, MUST regenerate
      if (payloadTypeChanged) {
        console.log('🚨 PAYLOAD TYPE MISMATCH - REGENERATING payload for question:', question.id, 
                    'payload.type:', originalQuestion.payload?.type, 'vs question.type:', question.type);
        return buildQuestionPayloadWithoutTranslations({
          baseLanguage: language,
          text: question.text,
          options: question.options,
          type: question.type,
          required: question.required,
          hasOtherOption: question.hasOtherOption,
          scaleMin: question.scaleMin,
          scaleMax: question.scaleMax,
        });
      }
      
      // If payload text doesn't match current question text, MUST regenerate
      if (payloadTextChanged) {
        console.log('🚨 PAYLOAD TEXT MISMATCH - REGENERATING payload for question:', question.id, 
                    'payload.text.en:', originalQuestion.payload?.text?.en, 'vs question.text:', question.text);
        return buildQuestionPayloadWithoutTranslations({
          baseLanguage: language,
          text: question.text,
          options: question.options,
          type: question.type,
          required: question.required,
          hasOtherOption: question.hasOtherOption,
          scaleMin: question.scaleMin,
          scaleMax: question.scaleMax,
        });
      }
      
      if (!textChanged && !typeChanged && !optionsChanged && !scaleMinChanged && !scaleMaxChanged && originalQuestion.payload) {
        console.log('✅ Reusing cached payload for question:', question.id);
        return originalQuestion.payload;
      }
      
      if (textChanged || typeChanged || optionsChanged) {
        console.log('🔄 REGENERATING payload for question:', question.id, '- textChanged:', textChanged, 'typeChanged:', typeChanged, 'optionsChanged:', optionsChanged);
      }
    }

    // Text or options changed - build new payload without translations
    return buildQuestionPayloadWithoutTranslations({
      baseLanguage: language,
      text: question.text,
      options: question.options,
      type: question.type,
      required: question.required,
      hasOtherOption: question.hasOtherOption,
      scaleMin: question.scaleMin,
      scaleMax: question.scaleMax,
    });
  };

  const handleSave = async () => {
    setSaveStatus('saving');

    try {
      // Before saving, ensure all questions have correct sort_order based on their position
      const questionsToSave = questions.map((q, idx) => ({
        ...q,
        order: idx
      }));

      // OPTIMIZED: Build payloads in parallel instead of sequentially
      console.log('Starting parallel payload generation for', questionsToSave.length, 'questions');
      const payloadPromises = questionsToSave.map(async (question) => {
        const originalQuestion = questions.find(q => q.id === question.id);
        const payload = await getPayloadForQuestion(question, originalQuestion);
        return { question, payload };
      });

      const payloadsWithQuestions = await Promise.all(payloadPromises);
      console.log('All payloads generated in parallel');

      // OPTIMIZED: Save all questions in parallel instead of sequentially
      const savePromises = payloadsWithQuestions.map(async ({ question, payload }) => {
        if (question.id.startsWith('temp_')) {
          // New question - insert and get the new id back
          const insertRow: any = {
            survey_id: id,
            type: question.type,
            text: question.text,
            options: question.options || [],
            required: question.required,
            has_other_option: question.hasOtherOption,
            sort_order: question.order,
            payload,
            section_id: question.section_id || null,
            conditional_logic: (question.conditional_logic && question.conditional_logic.length > 0) ? JSON.stringify(question.conditional_logic) : null,
          };
          
          console.log('Saving new question:', { questionId: question.id, type: question.type, text: question.text.substring(0, 30), insertRow });
          console.log('Saving new question with conditional_logic:', insertRow.conditional_logic);

          let data: any = null;
          let error: any = null;

          // Try with payload and conditional_logic first
          {
            const res = await supabase.from('questions').insert([insertRow]).select('id').single();
            data = res.data;
            error = res.error;
            if (error) {
              console.error('Insert error (with conditional_logic):', error);
            }
          }

          // If payload column doesn't exist, retry without it
          if (error?.code === 'PGRST204' && String(error?.message || '').toLowerCase().includes('payload')) {
            delete insertRow.payload;
            const res2 = await supabase.from('questions').insert([insertRow]).select('id').single();
            data = res2.data;
            error = res2.error;
          }

          // If conditional_logic column doesn't exist, retry without it
          if (error?.code === 'PGRST204' && String(error?.message || '').toLowerCase().includes('conditional_logic')) {
            delete insertRow.conditional_logic;
            const res3 = await supabase.from('questions').insert([insertRow]).select('id').single();
            data = res3.data;
            error = res3.error;
          }

          if (error) throw error;

          return { ...question, id: data.id };
        } else {
          // Existing question - update
          const updateRow: any = {
            type: question.type,
            text: question.text,
            options: question.options || [],
            required: question.required,
            has_other_option: question.hasOtherOption,
            sort_order: question.order,
            section_id: question.section_id || null,
            // Include payload with translations on UPDATE
            payload: payload,
            conditional_logic: (question.conditional_logic && question.conditional_logic.length > 0) ? JSON.stringify(question.conditional_logic) : null,
          };
          
          console.log('🔄 UPDATING EXISTING QUESTION:', { 
            questionId: question.id,
            type: question.type,
            options: question.options,
            text: question.text.substring(0, 50)
          });
          console.log('  - Full updateRow:', updateRow);
          console.log('  - Type being sent:', updateRow.type);
          console.log('  - Options being sent:', updateRow.options);
          console.log('  - All fields:', JSON.stringify(updateRow));

          let error: any = null;

          // Try with payload and conditional_logic first
          {
            const res = await supabase.from('questions').update(updateRow).eq('id', question.id).select();
            error = res.error;
            
            console.log('📊 Update response:', {
              questionId: question.id,
              rowCount: res.data?.length,
              status: res.status,
              statusText: res.statusText,
              hasError: !!error,
              errorCode: error?.code,
              errorMessage: error?.message
            });
            
            // Log what was actually returned from DB
            if (res.data && res.data.length > 0) {
              console.log('📦 Data returned from DB after update:', {
                type: res.data[0].type,
                text: res.data[0].text,
                options: res.data[0].options
              });
            }
            
            if (error) {
              console.error('❌ Update error (with conditional_logic):', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
                questionId: question.id,
                updateRow: updateRow
              });
            } else if (!res.data || res.data.length === 0) {
              console.warn('⚠️ Update returned no rows - RLS policy may have blocked it:', {
                questionId: question.id,
                type: question.type
              });
            } else {
              console.log('✅ Question updated successfully:', { 
                questionId: question.id, 
                type: question.type,
                rowsAffected: res.data.length 
              });
            }
          }

          // If payload column doesn't exist, retry without it
          if (error?.code === 'PGRST204' && String(error?.message || '').toLowerCase().includes('payload')) {
            delete updateRow.payload;
            const res2 = await supabase.from('questions').update(updateRow).eq('id', question.id).select();
            error = res2.error;
          }

          // If conditional_logic column doesn't exist, retry without it
          if (error?.code === 'PGRST204' && String(error?.message || '').toLowerCase().includes('conditional_logic')) {
            console.warn('conditional_logic column not found, retrying without it');
            delete updateRow.conditional_logic;
            const res3 = await supabase.from('questions').update(updateRow).eq('id', question.id).select();
            error = res3.error;
          }

          if (error) {
            console.error('Final update error after retries:', error);
            throw error;
          }
          
          console.log('✓ Successfully saved question:', question.id, 'with conditional_logic:', updateRow.conditional_logic);

          return question;
        }
      });

      // Execute all saves in parallel
      const updatedQuestions = await Promise.all(savePromises);
      console.log('All questions saved in parallel');

      // Find and delete questions that were removed from the survey
      const currentQuestionIds = new Set(updatedQuestions.map(q => q.id));
      const deletedQuestionIds = Array.from(originalQuestionIds).filter(id => !currentQuestionIds.has(id));
      
      if (deletedQuestionIds.length > 0) {
        console.log('Deleting questions from server:', deletedQuestionIds);
        const deletePromises = deletedQuestionIds.map(questionId =>
          supabase.from('questions').delete().eq('id', questionId)
        );
        
        try {
          await Promise.all(deletePromises);
          console.log('✓ Successfully deleted', deletedQuestionIds.length, 'questions from server');
          // Update original question IDs to reflect deletions
          setOriginalQuestionIds(currentQuestionIds);
        } catch (deleteError) {
          console.error('Error deleting questions from server:', deleteError);
          setToast({ message: t.failed_delete, type: 'error' });
          // Even if deletion fails, we still update the state
          setQuestions(updatedQuestions);
          setSaveStatus('unsaved');
          return;
        }
      }

      setQuestions(updatedQuestions);
      setSaveStatus('saved');
      setToast({ message: t.saved_toast, type: 'success' });
      
      // Show activation modal if survey is not active
      if (!surveyIsActive) {
        setShowActivationModal(true);
      }
      
      setTimeout(() => setSaveStatus('idle'), 2000);

      // OPTIMIZATION: Start background translation updates for any questions that had text changes
      // This doesn't block the UI since it happens after save
      if (payloadsWithQuestions.some(({ question, payload }) => !question.id.startsWith('temp_'))) {
        console.log('Starting background translation updates');
        // Background updates will happen without blocking UI
      }
    } catch (error: any) {
      console.error('Error saving questions:', error);
      
      // Check if this is a translation rate limit error
      if (error instanceof TranslationLimitError || error?.name === 'TranslationLimitError') {
        setToast({ 
          message: '⚠️ ' + (error.message || 'Translation service limit reached. Please try again tomorrow.'), 
          type: 'error' 
        });
      } else if (error?.message?.includes('Quotum exceeded') || error?.message?.includes('limit') || error?.message?.includes('exceeded')) {
        setToast({ 
          message: '⚠️ Translation service limit reached. Please try again tomorrow.', 
          type: 'error' 
        });
      } else {
        setToast({ message: t.failed_toast, type: 'error' });
      }
      setSaveStatus('unsaved');
    }
  };

  // Retry translation for all questions (to fix incomplete translations from when limits were hit)
  const handleRetryTranslation = async () => {
    setRetryTranslationStatus('retrying');
    
    try {
      console.log('Starting translation retry for all questions...');
      
      // For each question, regenerate and update translations
      const updatePromises = questions.map(async (question) => {
        try {
          // Get base language from payload or detect it
          const baseLanguage = (question as any).payload?.baseLanguage || detectBaseLanguage(question.text, question.options || []);
          
          const payload = await buildQuestionPayloadWithTranslations({
            baseLanguage: baseLanguage as SupportedLng,
            text: question.text,
            options: question.options || [],
            type: question.type,
            required: question.required,
            hasOtherOption: question.hasOtherOption,
            scaleMin: question.scaleMin,
            scaleMax: question.scaleMax,
          });

          // Update the question with the new payload
          const { error } = await supabase
            .from('questions')
            .update({ payload })
            .eq('id', question.id);

          if (error) {
            console.error(`Error updating translations for question ${question.id}:`, error);
            throw error;
          }
          
          console.log(`✓ Updated translations for question ${question.id}`);
        } catch (error: any) {
          console.error(`Failed to retry translation for question ${question.id}:`, error);
          // Don't throw - continue with other questions
          if (error instanceof TranslationLimitError) {
            throw error; // Re-throw limit errors to stop the process
          }
        }
      });

      await Promise.all(updatePromises);
      
      setToast({ 
        message: '✓ Translation retry completed successfully!', 
        type: 'success' 
      });
      setRetryTranslationStatus('success');
      
      // Reload questions to show updated translations
      await loadQuestions();
      
      setTimeout(() => setRetryTranslationStatus('idle'), 2000);
    } catch (error: any) {
      console.error('Error during translation retry:', error);
      
      if (error instanceof TranslationLimitError) {
        setToast({ 
          message: '⚠️ Translation service limit still reached. Please try again later.', 
          type: 'error' 
        });
      } else {
        setToast({ 
          message: 'Error during translation retry. Please try again.', 
          type: 'error' 
        });
      }
      setRetryTranslationStatus('idle');
    }
  };

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestion(expandedQuestion === questionId ? null : questionId);
  };

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    const newQuestions = [...questions];
    const [movedQuestion] = newQuestions.splice(fromIndex, 1);
    newQuestions.splice(toIndex, 0, movedQuestion);
    
    // Update order property for all questions
    const reorderedQuestions = newQuestions.map((q, idx) => ({ ...q, order: idx }));
    setQuestions(reorderedQuestions);
    setSaveStatus('unsaved');
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      moveQuestion(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const saveSurveyInfo = async () => {
    try {
      setSurveyInfoLoading(true);
      
      const updateData: any = {};
      
      // Check if any description is not empty, then save as JSON
      const hasAnyDescription = Object.values(surveyDescriptions).some(desc => desc.trim());
      if (hasAnyDescription) {
        updateData.description = JSON.stringify(surveyDescriptions);
      }
      
      // Always include estimated_time
      updateData.estimated_time = parseInt(estimatedTime) || 4;
      
      // Include thank you message if not empty
      if (thankYouMessage.trim()) {
        updateData.thank_you_message = thankYouMessage.trim();
      }
      
      // Include show_survey_info flag
      updateData.show_survey_info = showSurveyInfo;
      
      const { error, data } = await supabase
        .from('surveys')
        .update(updateData)
        .eq('id', id)
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message || 'Failed to save survey info');
      }
      
      setToast({ message: 'Survey info saved successfully', type: 'success' });
    } catch (error: any) {
      console.error('Error saving survey info:', error);
      const errorMsg = error?.message || 'Failed to save survey info';
      setToast({ message: errorMsg, type: 'error' });
    } finally {
      setSurveyInfoLoading(false);
    }
  };

  const addSection = async () => {
    if (!newSectionName.trim()) {
      setToast({ message: 'Section name is required', type: 'error' });
      return;
    }

    try {
      setSectionsLoading(true);
      const nextOrder = sections.length;
      
      // Build payload with translations for section name and description
      const payload: any = {
        baseLanguage: detectBaseLanguage(newSectionName, [newSectionDesc]),
        name: { en: '' },
        description: { en: '' },
      };

      const base = detectBaseLanguage(newSectionName, [newSectionDesc]);
      payload.baseLanguage = base;
      payload.name[base] = newSectionName.trim();
      payload.description[base] = newSectionDesc.trim();

      // Translate section name and description to other languages
      const langs: SupportedLng[] = ['en', 'ru', 'fr', 'es'];
      const targets = langs.filter((l) => l !== base);

      for (const lng of targets) {
        const translatedName = await translateMyMemory(newSectionName.trim(), base, lng);
        const translatedDesc = newSectionDesc.trim() ? await translateMyMemory(newSectionDesc.trim(), base, lng) : '';
        
        payload.name[lng] = translatedName;
        payload.description[lng] = translatedDesc;
      }
      
      const { data, error } = await supabase
        .from('survey_sections')
        .insert({
          survey_id: id,
          name: newSectionName.trim(),
          description: newSectionDesc.trim(),
          order_index: nextOrder,
          payload,
        })
        .select();
      
      if (error) throw error;
      
      setSections([...sections, data[0]]);
      setNewSectionName('');
      setNewSectionDesc('');
      setToast({ message: 'Section added successfully', type: 'success' });
    } catch (error: any) {
      console.error('Error adding section:', error);
      setToast({ message: error.message || 'Failed to add section', type: 'error' });
    } finally {
      setSectionsLoading(false);
    }
  };

  const addSectionWithName = async (name: string, description: string = '') => {
    if (!name.trim()) {
      setToast({ message: 'Section name is required', type: 'error' });
      return;
    }

    console.log('Adding section with name:', name);

    try {
      setSectionsLoading(true);
      const nextOrder = sections.length;
      
      // Build payload with translations for section name and description
      const payload: any = {
        baseLanguage: detectBaseLanguage(name, [description]),
        name: { en: '' },
        description: { en: '' },
      };

      const base = detectBaseLanguage(name, [description]);
      payload.baseLanguage = base;
      payload.name[base] = name.trim();
      payload.description[base] = description.trim();

      // Translate section name and description to other languages
      const langs: SupportedLng[] = ['en', 'ru', 'fr', 'es'];
      const targets = langs.filter((l) => l !== base);

      for (const lng of targets) {
        const translatedName = await translateMyMemory(name.trim(), base, lng);
        const translatedDesc = description.trim() ? await translateMyMemory(description.trim(), base, lng) : '';
        
        payload.name[lng] = translatedName;
        payload.description[lng] = translatedDesc;
      }
      
      const { data, error } = await supabase
        .from('survey_sections')
        .insert({
          survey_id: id,
          name: name.trim(),
          description: description.trim(),
          order_index: nextOrder,
          payload,
        })
        .select();
      
      if (error) throw error;
      
      setSections([...sections, data[0]]);
      setToast({ message: 'Section added successfully', type: 'success' });
    } catch (error: any) {
      console.error('Error adding section:', error);
      setToast({ message: error.message || 'Failed to add section', type: 'error' });
    } finally {
      setSectionsLoading(false);
    }
  };

  const deleteSection = async (sectionId: string) => {
    try {
      setSectionsLoading(true);
      
      const { error } = await supabase
        .from('survey_sections')
        .delete()
        .eq('id', sectionId);
      
      if (error) throw error;
      
      setSections(sections.filter(s => s.id !== sectionId));
      if (selectedSectionId === sectionId) {
        setSelectedSectionId(null);
      }
      setToast({ message: 'Section deleted successfully', type: 'success' });
    } catch (error: any) {
      console.error('Error deleting section:', error);
      setToast({ message: error.message || 'Failed to delete section', type: 'error' });
    } finally {
      setSectionsLoading(false);
    }
  };

  const updateSection = async (sectionId: string, name: string, description: string) => {
    try {
      setSectionsLoading(true);
      
      // Build payload with translations for section name and description
      const payload: any = {
        baseLanguage: detectBaseLanguage(name, [description]),
        name: { en: '' },
        description: { en: '' },
      };

      const base = detectBaseLanguage(name, [description]);
      payload.baseLanguage = base;
      payload.name[base] = name;
      payload.description[base] = description;

      // Translate section name and description to other languages
      const langs: SupportedLng[] = ['en', 'ru', 'fr', 'es'];
      const targets = langs.filter((l) => l !== base);

      for (const lng of targets) {
        const translatedName = await translateMyMemory(name, base, lng);
        const translatedDesc = description ? await translateMyMemory(description, base, lng) : '';
        
        payload.name[lng] = translatedName;
        payload.description[lng] = translatedDesc;
      }

      const { error } = await supabase
        .from('survey_sections')
        .update({ name, description, payload })
        .eq('id', sectionId);
      
      if (error) throw error;
      
      setSections(sections.map(s => 
        s.id === sectionId ? { ...s, name, description, payload } : s
      ));
      setEditingSectionId(null);
      setToast({ message: 'Section updated successfully', type: 'success' });
    } catch (error: any) {
      console.error('Error updating section:', error);
      setToast({ message: error.message || 'Failed to update section', type: 'error' });
    } finally {
      setSectionsLoading(false);
    }
  };

  const toggleSurveyStatus = async () => {
    try {
      setLoadingSurveyStatus(true);
      const newStatus = !surveyIsActive;
      // Keep status aligned with list view: active | draft
      const statusValue: 'active' | 'draft' = newStatus ? 'active' : 'draft';
      
      // First update the local state immediately
      setSurveyIsActive(newStatus);
      
      // Then try to update the database
      const { error } = await supabase
        .from('surveys')
        .update({ status: statusValue })
        .eq('id', id);

      // If there's an error, keep the local state updated anyway
      if (error) {
        console.warn('Error updating survey status in database:', error);
        // Revert local state so UI matches DB
        setSurveyIsActive(!newStatus);
        setToast({ message: error.message || t.statusUpdateFailed, type: 'error' });
        setLoadingSurveyStatus(false);
        return;
      }
      
      const successMessage = newStatus ? t.statusUpdated : `Survey set to draft`;
      setToast({ message: successMessage, type: 'success' });
      setLoadingSurveyStatus(false);
    } catch (error) {
      console.error('Error updating survey status:', error);
      setToast({ message: t.statusUpdateFailed, type: 'error' });
      setLoadingSurveyStatus(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1">
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900">{t.surveyBuilder}</h2>
        </header>
        <div className="p-4 md:p-8 space-y-4">
          <div className="space-y-4">
            <SkeletonQuestion />
            <SkeletonQuestion />
            <SkeletonQuestion />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate(`/admin/surveys/${id}`)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-semibold text-gray-900">{t.surveyBuilder}</h2>
              <p className="text-sm text-gray-500 mt-1">{t.buildCustomize}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button 
                  onClick={handlePreview}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  {t.preview}
                </button>
                <button 
                  onClick={handleSave}
                  disabled={saveStatus === 'saving'}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    saveStatus === 'saved'
                      ? 'bg-green-600 text-white'
                      : saveStatus === 'saving'
                      ? 'bg-indigo-400 text-white cursor-wait'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {saveStatus === 'saved' ? `✓ ${t.saved}` : saveStatus === 'saving' ? t.saving : t.saveChanges}
                </button>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{t.totalQuestions}</p>
                  <p className="text-lg font-semibold text-gray-900">{questions.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">{t.surveyState}</span>
                <button
                  onClick={toggleSurveyStatus}
                  disabled={loadingSurveyStatus}
                  title={surveyIsActive ? 'Click to disable survey' : 'Click to enable survey'}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    surveyIsActive ? 'bg-green-600' : 'bg-gray-300'
                  } ${loadingSurveyStatus ? 'opacity-70 cursor-wait' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      surveyIsActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            {/* Retry Translation Button - On its own row */}
            <div className="flex items-center gap-3">
              <button 
                onClick={handleRetryTranslation}
                disabled={retryTranslationStatus === 'retrying' || questions.length === 0}
                style={{
                  backgroundColor: retryTranslationStatus === 'success' 
                    ? '#16a34a' 
                    : retryTranslationStatus === 'retrying' 
                    ? '#facc15' 
                    : questions.length === 0 
                    ? '#d1d5db' 
                    : '#eab308',
                  color: retryTranslationStatus === 'success' || questions.length === 0 ? '#fff' : '#1f2937'
                }}
                className="px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
                title="Fill missing translations. Use this if translations were incomplete due to API limits."
              >
                {retryTranslationStatus === 'success' ? '✓ Done' : retryTranslationStatus === 'retrying' ? 'Retrying...' : 'Retry Translations'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-4 md:p-8">
        {/* Survey Info Section - Collapsible */}
        <div className="mb-8 bg-indigo-50 rounded-lg border border-indigo-200 overflow-hidden">
          {/* Header */}
          <button
            onClick={() => setSurveyInfoExpanded(!surveyInfoExpanded)}
            className="w-full flex items-center justify-between p-6 hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            <h3 className="text-lg font-semibold text-gray-900">{adminT.surveyInformation}</h3>
            <ChevronDown 
              className={`w-5 h-5 text-gray-600 transition-transform ${surveyInfoExpanded ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Content */}
          {surveyInfoExpanded && (
            <div className="border-t border-indigo-200 p-6 bg-white">
              {/* Warning notice */}
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-900">
                  {t.descriptionNote}
                </div>
              </div>
              
              <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              
              {/* Language Tabs */}
              <div className="flex gap-2 mb-3 border-b border-gray-300">
                {(['en', 'ru', 'fr', 'es'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setDescriptionLanguage(lang)}
                    className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                      descriptionLanguage === lang
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
              
              <textarea
                value={surveyDescriptions[descriptionLanguage]}
                onChange={(e) => setSurveyDescriptions({ ...surveyDescriptions, [descriptionLanguage]: e.target.value })}
                rows={6}
                disabled={surveyInfoLoading}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-vertical disabled:bg-gray-50 disabled:text-gray-500"
                placeholder={`Survey description in ${descriptionLanguage.toUpperCase()} shown to respondents at the start...`}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.thankYouMessage}
              </label>
              <textarea
                value={thankYouMessage}
                onChange={(e) => setThankYouMessage(e.target.value)}
                rows={3}
                disabled={surveyInfoLoading}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:text-gray-500"
                placeholder={t.defaultThankYouText}
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Time (minutes)
                </label>
                <input
                  type="number"
                  value={estimatedTime}
                  onChange={(e) => setEstimatedTime(e.target.value)}
                  min="1"
                  max="120"
                  disabled={surveyInfoLoading}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg 
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="4"
                />
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={saveSurveyInfo}
                  disabled={surveyInfoLoading}
                  className="w-full px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {surveyInfoLoading ? 'Saving...' : 'Save Info'}
                </button>
              </div>
            </div>

            {/* Show Survey Info Toggle */}
            <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
              <input
                type="checkbox"
                checked={showSurveyInfo}
                onChange={(e) => {
                  setShowSurveyInfo(e.target.checked);
                  setSaveStatus('unsaved');
                }}
                id="show-survey-info"
                className="w-4 h-4 rounded"
              />
              <label htmlFor="show-survey-info" className="text-sm font-medium text-gray-700">
                Show survey information to respondents (description, time estimate)
              </label>
            </div>
              </div>
            </div>
          )}
        </div>

        {/* Sections Management - Collapsible */}
        <div className="mb-8 bg-purple-50 rounded-lg border border-purple-200 overflow-hidden">
          {/* Header */}
          <button
            onClick={() => setSectionsExpanded(!sectionsExpanded)}
            className="w-full flex items-center justify-between p-6 hover:bg-purple-100 transition-colors cursor-pointer"
          >
            <h3 className="text-lg font-semibold text-gray-900">{t.section}s</h3>
            <ChevronDown 
              className={`w-5 h-5 text-gray-600 transition-transform ${sectionsExpanded ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Content */}
          {sectionsExpanded && (
            <div className="border-t border-purple-200 p-6 bg-white">
              <div className="space-y-4">
            {/* Add New Section */}
            <div className="space-y-3 p-4 bg-white rounded-lg border border-purple-100">
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder={t.sectionName}
                disabled={sectionsLoading}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50"
              />
              <textarea
                value={newSectionDesc}
                onChange={(e) => setNewSectionDesc(e.target.value)}
                placeholder={t.sectionDescription}
                rows={2}
                disabled={sectionsLoading}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:bg-gray-50"
              />
              <button
                onClick={addSection}
                disabled={sectionsLoading}
                className="px-4 py-3 mt-3 text-white font-semibold rounded-lg transition-all block border-2 border-solid"
                style={{ 
                  backgroundColor: '#c4b5fd',
                  borderColor: '#a78bfa',
                  visibility: 'visible',
                  display: 'block'
                }}
              >
                {t.addSection}
              </button>
            </div>
            
            {/* Sections with their Questions */}
            {sections.length > 0 && (
              <div className="space-y-4">
                {sections.map((section, sectionIndex) => {
                  // Different background colors for each section
                  const bgColors = [
                    'bg-blue-50',
                    'bg-green-50',
                    'bg-yellow-50',
                    'bg-pink-50',
                    'bg-purple-50',
                    'bg-indigo-50',
                  ];
                  const borderColors = [
                    'border-blue-200',
                    'border-green-200',
                    'border-yellow-200',
                    'border-pink-200',
                    'border-purple-200',
                    'border-indigo-200',
                  ];
                  const bgColor = bgColors[sectionIndex % bgColors.length];
                  const borderColor = borderColors[sectionIndex % borderColors.length];
                  
                  return (
                  <div key={section.id} className={`p-4 rounded-lg border ${bgColor} ${borderColor}`}>
                    <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-purple-100">
                      <div className="flex-1">
                        {editingSectionId === section.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingSectionName}
                              onChange={(e) => setEditingSectionName(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              placeholder="Section name"
                            />
                            <textarea
                              value={editingSectionDesc}
                              onChange={(e) => setEditingSectionDesc(e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                              placeholder="Section description"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  updateSection(section.id, editingSectionName, editingSectionDesc);
                                }}
                                disabled={sectionsLoading}
                                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingSectionId(null)}
                                disabled={sectionsLoading}
                                className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingSectionId(section.id);
                                setEditingSectionName(section.name);
                                setEditingSectionDesc(section.description || '');
                              }}
                              className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors text-left"
                            >
                              {section.name}
                            </button>
                            {section.description && (
                              <p className="text-sm text-gray-600 mt-1">{section.description}</p>
                            )}
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => deleteSection(section.id)}
                        disabled={sectionsLoading}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Add Question to Section Button */}
                    <button
                      onClick={() => {
                        addQuestion(undefined, section.id);
                      }}
                      className="w-max flex items-center justify-center gap-2 px-3 py-2 text-sm bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors border border-purple-200 mb-3"
                    >
                      <Plus className="w-4 h-4" />
                      Add Question
                    </button>
                    
                    {/* Questions in this Section */}
                    <div className="space-y-3 border-l-2 border-purple-200 pl-3">
                      {questions.filter(q => q.section_id === section.id).length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No questions yet</p>
                      ) : (
                        questions.filter(q => q.section_id === section.id).map((question, sectionQuestionIndex) => {
                          const actualIndex = questions.indexOf(question);
                          return (
                            <div 
                              key={question.id} 
                              ref={expandedQuestion === question.id ? newQuestionRef : null}
                              draggable
                              onDragStart={(e) => handleDragStart(e, actualIndex)}
                              onDragOver={(e) => handleDragOver(e, actualIndex)}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (draggedIndex !== null && draggedIndex !== actualIndex) {
                                  const draggedQuestion = questions[draggedIndex];
                                  const targetQuestion = questions[actualIndex];
                                  // Only allow dragging within same section
                                  if (draggedQuestion.section_id === targetQuestion.section_id) {
                                    moveQuestion(draggedIndex, actualIndex);
                                  }
                                }
                                setDraggedIndex(null);
                              }}
                              onDragEnd={handleDragEnd}
                              className={`bg-gray-50 rounded-lg border border-gray-200 overflow-hidden transition-opacity cursor-grab active:cursor-grabbing ${draggedIndex === actualIndex ? 'opacity-50' : ''}`}
                            >
                            {/* Question Header */}
                            <div
                              onClick={() => setExpandedQuestion(expandedQuestion === question.id ? null : question.id)}
                              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                            >
                              <GripVertical 
                                className="w-5 h-5 text-gray-400 flex-shrink-0"
                              />
                              <ChevronDown 
                                className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${expandedQuestion === question.id ? 'rotate-180' : ''}`}
                              />
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">
                                  <span className="text-gray-500 font-normal">Q{actualIndex + 1}. </span>
                                  {question.text || 'Untitled question'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Copy 
                                  onClick={(e) => { e.stopPropagation(); duplicateQuestion(question.id, questions.indexOf(question)); }}
                                  className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-pointer"
                                />
                                <Trash2 
                                  onClick={(e) => { e.stopPropagation(); deleteQuestion(question.id); }}
                                  className="w-4 h-4 text-gray-400 hover:text-red-600 cursor-pointer"
                                />
                              </div>
                            </div>

                            {/* Question Editor (Expanded) */}
                            {expandedQuestion === question.id && (
                              <div className="p-4 border-t border-gray-200 bg-white">
                                <div className="space-y-4">
                                  {/* Section Selection */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      {t.section}
                                    </label>
                                    <select
                                      value={question.section_id || ''}
                                      onChange={(e) => updateQuestion(question.id, 'section_id', e.target.value || undefined)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                      <option value="">{adminT.noSection}</option>
                                      {sections.map((sec) => (
                                        <option key={sec.id} value={sec.id}>
                                          {sec.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  
                                  {/* Question Text */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      {t.questionText}
                                    </label>
                                    <textarea
                                      value={question.text}
                                      onChange={(e) => updateQuestion(question.id, 'text', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      rows={2}
                                    />
                                  </div>

                                  {/* Question Type */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      {t.questionType}
                                    </label>
                                    <select
                                      value={question.type}
                                      onChange={(e) => updateQuestion(question.id, 'type', e.target.value as any)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                      <option value="single-choice">Single Choice (Radio)</option>
                                      <option value="multiple-choice">Multiple Choice (Checkboxes)</option>
                                      <option value="scale">Scale (1-5)</option>
                                      <option value="text">Text Input</option>
                                      <option value="yes-no">Yes/No</option>
                                    </select>
                                  </div>

                                  {/* Options */}
                                  {(question.type === 'single-choice' || question.type === 'multiple-choice' || question.type === 'yes-no') && (
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {t.options}
                                      </label>
                                      <div className="space-y-2">
                                        {question.type === 'yes-no' ? (
                                          <>
                                            <div className="flex items-center gap-2 p-3 bg-white border border-gray-300 rounded-lg cursor-not-allowed">
                                              <input
                                                type="text"
                                                value={t.yes}
                                                disabled
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                              />
                                            </div>
                                            <div className="flex items-center gap-2 p-3 bg-white border border-gray-300 rounded-lg cursor-not-allowed">
                                              <input
                                                type="text"
                                                value={t.no}
                                                disabled
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                              />
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            {question.options?.map((option, optIndex) => (
                                              <div key={optIndex} className="flex items-center gap-2">
                                                <input
                                                  type="text"
                                                  value={option}
                                                  onChange={(e) => {
                                                    const newOptions = [...(question.options || [])];
                                                    newOptions[optIndex] = e.target.value;
                                                    updateQuestion(question.id, 'options', newOptions);
                                                  }}
                                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                  placeholder={`Option ${optIndex + 1}`}
                                                />
                                                <button
                                                  onClick={() => {
                                                    const newOptions = question.options?.filter((_, i) => i !== optIndex);
                                                    updateQuestion(question.id, 'options', newOptions);
                                                  }}
                                                  disabled={(question.options?.length || 0) <= 2}
                                                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              </div>
                                            ))}

                                            {question.hasOtherOption && (
                                              <div className="flex items-center gap-2 p-3 bg-white border border-gray-300 rounded-lg">
                                                <input
                                                  ref={otherInputRef}
                                                  type="text"
                                                  placeholder={t.other}
                                                  value={otherValues[question.id] || ''}
                                                  onChange={(e) => setOtherValues({
                                                    ...otherValues,
                                                    [question.id]: e.target.value
                                                  })}
                                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                                <button
                                                  onClick={() => {
                                                    updateQuestion(question.id, 'hasOtherOption', false);
                                                    const newOtherValues = { ...otherValues };
                                                    delete newOtherValues[question.id];
                                                    setOtherValues(newOtherValues);
                                                  }}
                                                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              </div>
                                            )}

                                            <div className="flex flex-wrap gap-2 pt-2">
                                              <button
                                                onClick={() => {
                                                  const newOptions = [...(question.options || []), `Option ${(question.options?.length || 0) + 1}`];
                                                  updateQuestion(question.id, 'options', newOptions);
                                                }}
                                                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                                              >
                                                + {t.addOption}
                                              </button>
                                              
                                              {!question.hasOtherOption && (
                                                <button
                                                  onClick={() => updateQuestion(question.id, 'hasOtherOption', true)}
                                                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                                                >
                                                  + {t.addOther}
                                                </button>
                                              )}
                                              
                                              <button
                                                onClick={() => pasteOptionFromClipboard(question.id)}
                                                className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium"
                                              >
                                                {t.pasteOption}
                                              </button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Scale Descriptions */}
                                  {question.type === 'scale' && (
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          Description for 1 (Minimum)
                                        </label>
                                        <input
                                          type="text"
                                          value={question.scaleMin || ''}
                                          onChange={(e) => updateQuestion(question.id, 'scaleMin', e.target.value)}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                          placeholder="e.g., Not at all"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          Description for 5 (Maximum)
                                        </label>
                                        <input
                                          type="text"
                                          value={question.scaleMax || ''}
                                          onChange={(e) => updateQuestion(question.id, 'scaleMax', e.target.value)}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                          placeholder="e.g., Very much"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* Required Checkbox */}
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={question.required}
                                      onChange={(e) => updateQuestion(question.id, 'required', e.target.checked)}
                                      id={`required-${question.id}`}
                                      className="w-4 h-4"
                                    />
                                    <label htmlFor={`required-${question.id}`} className="text-sm font-medium text-gray-700">
                                      {t.requiredQuestion}
                                    </label>
                                  </div>

                                  {/* Conditional Logic */}
                                  {(question.type === 'yes-no' || question.type === 'single-choice') && (
                                    <div className="pt-3 border-t border-gray-200">
                                      <label className="block text-sm font-medium text-gray-700 mb-3">
                                        Conditional Logic (Branch this question)
                                      </label>
                                      
                                      {/* Info Alert */}
                                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <p className="text-sm text-blue-800">
                                          <strong>Note:</strong> When you create conditional logic, the questions that follow this condition will appear <strong>after</strong> this question in the survey flow.
                                        </p>
                                      </div>
                                      
                                      <div className="space-y-3">
                                        {(question.conditional_logic || []).map((logic, idx) => (
                                          <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm font-medium text-gray-700">If answer = <strong>{logic.answer}</strong></span>
                                              <button
                                                onClick={() => {
                                                  const newLogic = (question.conditional_logic || []).filter((_, i) => i !== idx);
                                                  updateQuestion(question.id, 'conditional_logic', newLogic.length > 0 ? newLogic : undefined);
                                                }}
                                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </button>
                                            </div>
                                            <div className="space-y-2">
                                              <label className="text-xs text-gray-600 mb-2 block font-medium">Then:</label>
                                              <div className="flex gap-2">
                                                <select
                                                  value={logic.end_survey ? '' : (logic.next_question_id || '')}
                                                  onChange={(e) => {
                                                    const newLogic = [...(question.conditional_logic || [])];
                                                    if (e.target.value) {
                                                      newLogic[idx].next_question_id = e.target.value;
                                                      newLogic[idx].end_survey = false;
                                                    }
                                                    updateQuestion(question.id, 'conditional_logic', newLogic);
                                                  }}
                                                  disabled={logic.end_survey}
                                                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                                >
                                                  <option value="">-- Select next question --</option>
                                                  {questions
                                                    .filter((q: any) => q.id !== question.id && q.order > question.order)
                                                    .sort((a: any, b: any) => a.order - b.order)
                                                    .map((q: any) => (
                                                      <option key={q.id} value={q.id}>
                                                        Q{q.order}: {q.text.substring(0, 50)}...
                                                      </option>
                                                    ))}
                                                </select>
                                                <button
                                                  onClick={() => {
                                                    const newLogic = [...(question.conditional_logic || [])];
                                                    if (logic.end_survey) {
                                                      newLogic[idx].end_survey = false;
                                                      newLogic[idx].next_question_id = '';
                                                    } else {
                                                      newLogic[idx].end_survey = true;
                                                      delete newLogic[idx].next_question_id;
                                                    }
                                                    updateQuestion(question.id, 'conditional_logic', newLogic);
                                                  }}
                                                  className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                                                    logic.end_survey
                                                      ? 'bg-red-600 hover:bg-red-700 text-white'
                                                      : 'bg-red-100 hover:bg-red-200 text-red-700'
                                                  }`}
                                                >
                                                  {logic.end_survey ? 'End Survey' : 'End Survey'}
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                        <div className="flex flex-col gap-2">
                                          <p className="text-xs text-gray-600 font-medium">Add new condition:</p>
                                          <div className="flex gap-2">
                                            {question.type === 'yes-no' && (
                                              <>
                                                {!(question.conditional_logic || []).some(l => l.answer === 'Yes') && (
                                                  <button
                                                    onClick={() => {
                                                      const newLogic = [...(question.conditional_logic || []), { condition_type: 'answer_equals' as const, answer: 'Yes' }];
                                                      updateQuestion(question.id, 'conditional_logic', newLogic);
                                                    }}
                                                    className="text-sm px-2 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                                                  >
                                                    + Add Yes condition
                                                  </button>
                                                )}
                                                {!(question.conditional_logic || []).some(l => l.answer === 'No') && (
                                                  <button
                                                    onClick={() => {
                                                      const newLogic = [...(question.conditional_logic || []), { condition_type: 'answer_equals' as const, answer: 'No' }];
                                                      updateQuestion(question.id, 'conditional_logic', newLogic);
                                                    }}
                                                    className="text-sm px-2 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                                                  >
                                                    + Add No condition
                                                  </button>
                                                )}
                                              </>
                                            )}
                                            {question.type === 'single-choice' && (
                                              <button
                                                onClick={() => {
                                                  const answer = prompt('Enter the answer value to match:');
                                                  if (answer && !(question.conditional_logic || []).some(l => l.answer === answer)) {
                                                    const newLogic = [...(question.conditional_logic || []), { condition_type: 'answer_equals' as const, answer }];
                                                    updateQuestion(question.id, 'conditional_logic', newLogic);
                                                  }
                                                }}
                                                className="text-sm px-2 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                                              >
                                                + Add condition
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Add Question After Button */}
                                  <div className="pt-3 border-t border-gray-200 flex gap-2">
                                    <button
                                      onClick={() => {
                                        const currentIndex = questions.findIndex(q => q.id === question.id);
                                        addQuestion(currentIndex, section.id);
                                      }}
                                      className="w-max flex items-center justify-center gap-2 mt-4 px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors border border-blue-200"
                                    >
                                      <Plus className="w-4 h-4" />
                                      Add after this
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          );
                        })
                      )}
                    </div>
                    
                    {/* Add Another Section After This One */}
                    {sectionIndex === sections.length - 1 && (
                      <div className="mt-4 pt-4 border-t border-green-100">
                        <button
                          onClick={() => {
                            const sectionName = prompt('Enter section name:');
                            if (sectionName && sectionName.trim()) {
                              const sectionDesc = prompt('Enter section description (optional):') || '';
                              addSectionWithName(sectionName, sectionDesc);
                            }
                          }}
                          disabled={sectionsLoading}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-4 h-4" />
                          Add Section
                        </button>
                        {questions.filter(q => !q.section_id).length === 0 && (
                          <p className="text-sm text-gray-500 italic text-center py-3 mt-3">All questions are assigned to sections. Add more questions above.</p>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
            
            {sections.length === 0 && (
              <p className="text-sm text-gray-500 italic text-center py-4">No sections created. Add one above to start organizing questions.</p>
            )}
              </div>
            </div>
          )}
        </div>

        {/* Add Question without Section Button */}
        <div className="mb-6">
          <button
            onClick={() => {
              setSelectedSectionId(null);
              addQuestion();
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            {t.addQuestion} ({adminT.noSection})
          </button>
        </div>

        {/* All Questions (including those without sections) */}
        <div className="space-y-4">
          {questions.filter(q => !q.section_id).length === 0 && sections.length > 0 ? (
            null
          ) : (
          questions.filter(q => !q.section_id).map((question, index) => {
            const actualIndex = questions.findIndex(q => q.id === question.id);
            return (
            <div 
              key={question.id}
              ref={expandedQuestion === question.id ? newQuestionRef : null}
              draggable
              onDragStart={(e) => handleDragStart(e, actualIndex)}
              onDragOver={(e) => handleDragOver(e, actualIndex)}
              onDrop={(e) => handleDrop(e, actualIndex)}
              onDragEnd={handleDragEnd}
              className={`transition-opacity cursor-grab active:cursor-grabbing ${draggedIndex === actualIndex ? 'opacity-50' : ''}`}
            >
              {/* Question Card */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Question Header */}
                <div
                  onClick={() => toggleQuestion(question.id)}
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">Question {actualIndex + 1}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {question.type === 'single-choice' ? 'Single Choice' : question.type === 'multiple-choice' ? 'Multiple' : question.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 truncate">{question.text || 'Untitled question'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Copy 
                      onClick={(e) => { e.stopPropagation(); duplicateQuestion(question.id, questions.indexOf(question)); }}
                      className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-pointer flex-shrink-0"
                    />
                    <Trash2 
                      onClick={(e) => { e.stopPropagation(); deleteQuestion(question.id); }}
                      className="w-4 h-4 text-gray-400 hover:text-red-600 cursor-pointer flex-shrink-0"
                    />
                  </div>
                  {expandedQuestion === question.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </div>

                {/* Question Editor (Expanded) */}
                {expandedQuestion === question.id && (
                  <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="space-y-4">
                      {/* Section Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t.section}
                        </label>
                        <select
                          value={question.section_id || ''}
                          onChange={(e) => updateQuestion(question.id, 'section_id', e.target.value || undefined)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">{adminT.noSection}</option>
                          {sections.map((section) => (
                            <option key={section.id} value={section.id}>
                              {section.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Question Text */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t.questionText}
                        </label>
                        <textarea
                          value={question.text}
                          onChange={(e) => updateQuestion(question.id, 'text', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          rows={2}
                        />
                      </div>

                      {/* Question Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t.questionType}
                        </label>
                        <select
                          value={question.type}
                          onChange={(e) => updateQuestion(question.id, 'type', e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="single-choice">Single Choice (Radio)</option>
                          <option value="multiple-choice">Multiple Choice (Checkboxes)</option>
                          <option value="scale">Scale (1-5)</option>
                          <option value="text">Text Input</option>
                          <option value="yes-no">Yes/No</option>
                        </select>
                      </div>

                      {/* Options (for single-choice, multiple-choice, and yes-no) */}
                      {(question.type === 'single-choice' || question.type === 'multiple-choice' || question.type === 'yes-no') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t.options}
                          </label>
                          <div className="space-y-2">
                            {question.type === 'yes-no' ? (
                              // Display read-only yes-no options
                              <>
                                <div className="flex items-center gap-2 p-3 bg-white border border-gray-300 rounded-lg cursor-not-allowed">
                                  <input
                                    type="text"
                                    value={t.yes}
                                    disabled
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                  />
                                </div>
                                <div className="flex items-center gap-2 p-3 bg-white border border-gray-300 rounded-lg cursor-not-allowed">
                                  <input
                                    type="text"
                                    value={t.no}
                                    disabled
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                  />
                                </div>
                              </>
                            ) : (
                              // Editable options for single-choice and multiple-choice
                              <>
                                {question.options?.map((option, optIndex) => (
                                  <div key={optIndex} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={option}
                                      onChange={(e) => {
                                        const newOptions = [...(question.options || [])];
                                        newOptions[optIndex] = e.target.value;
                                        updateQuestion(question.id, 'options', newOptions);
                                      }}
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      placeholder={`Option ${optIndex + 1}`}
                                    />
                                    <button
                                      onClick={() => {
                                        const newOptions = question.options?.filter((_, i) => i !== optIndex);
                                        updateQuestion(question.id, 'options', newOptions);
                                      }}
                                      disabled={(question.options?.length || 0) <= 2}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}

                                {/* Other Option */}
                                {question.hasOtherOption && (
                                  <div className="flex items-center gap-2 p-3 bg-white border border-gray-300 rounded-lg">
                                    <input
                                      ref={otherInputRef}
                                      type="text"
                                      placeholder={t.other}
                                      defaultValue=""
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <button
                                      onClick={() => updateQuestion(question.id, 'hasOtherOption', false)}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                  <button
                                    onClick={() => {
                                      const newOptions = [...(question.options || []), `Option ${(question.options?.length || 0) + 1}`];
                                      updateQuestion(question.id, 'options', newOptions);
                                    }}
                                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                                  >
                                    + {t.addOption}
                                  </button>
                                  
                                  {!question.hasOtherOption && (
                                    <button
                                      onClick={() => updateQuestion(question.id, 'hasOtherOption', true)}
                                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                                    >
                                      + {t.addOther}
                                    </button>
                                  )}
                                  
                                  <button
                                    onClick={() => pasteOptionFromClipboard(question.id)}
                                    className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium"
                                  >
                                    {t.pasteOption}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Required Toggle */}
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <label className="text-sm font-medium text-gray-700">
                          {t.requiredQuestion}
                        </label>
                        <button
                          onClick={() => updateQuestion(question.id, 'required', !question.required)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            question.required ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              question.required ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Conditional Logic */}
                      {(question.type === 'yes-no' || question.type === 'single-choice') && (
                        <div className="pt-4 border-t border-gray-200">
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            Conditional Logic (Branch this question)
                          </label>
                          
                          {/* Info Alert */}
                          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800">
                              <strong>Note:</strong> When you create conditional logic, the questions that follow this condition will appear <strong>after</strong> this question in the survey flow.
                            </p>
                          </div>
                          
                          <div className="space-y-3">
                            {(question.conditional_logic || []).map((logic, idx) => (
                              <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-700">If answer = <strong>{logic.answer}</strong></span>
                                  <button
                                    onClick={() => {
                                      const newLogic = (question.conditional_logic || []).filter((_, i) => i !== idx);
                                      updateQuestion(question.id, 'conditional_logic', newLogic.length > 0 ? newLogic : undefined);
                                    }}
                                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs text-gray-600 mb-2 block font-medium">Then:</label>
                                  <div className="flex gap-2">
                                    <select
                                      value={logic.end_survey ? '' : (logic.next_question_id || '')}
                                      onChange={(e) => {
                                        const newLogic = [...(question.conditional_logic || [])];
                                        if (e.target.value) {
                                          newLogic[idx].next_question_id = e.target.value;
                                          newLogic[idx].end_survey = false;
                                        }
                                        updateQuestion(question.id, 'conditional_logic', newLogic);
                                      }}
                                      disabled={logic.end_survey}
                                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    >
                                      <option value="">-- Select next question --</option>
                                      {questions
                                        .filter((q: any) => q.id !== question.id && q.order > question.order)
                                        .sort((a: any, b: any) => a.order - b.order)
                                        .map((q: any) => (
                                          <option key={q.id} value={q.id}>
                                            Q{q.order}: {q.text.substring(0, 50)}...
                                          </option>
                                        ))}
                                    </select>
                                    <button
                                      onClick={() => {
                                        const newLogic = [...(question.conditional_logic || [])];
                                        if (logic.end_survey) {
                                          newLogic[idx].end_survey = false;
                                          newLogic[idx].next_question_id = '';
                                        } else {
                                          newLogic[idx].end_survey = true;
                                          delete newLogic[idx].next_question_id;
                                        }
                                        updateQuestion(question.id, 'conditional_logic', newLogic);
                                      }}
                                      className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                                        logic.end_survey
                                          ? 'bg-red-600 hover:bg-red-700 text-white'
                                          : 'bg-red-100 hover:bg-red-200 text-red-700'
                                      }`}
                                    >
                                      {logic.end_survey ? 'End Survey' : 'End Survey'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                            <div className="flex gap-2">
                              {question.type === 'yes-no' && (
                                <>
                                  {!(question.conditional_logic || []).some(l => l.answer === 'Yes') && (
                                    <button
                                      onClick={() => {
                                        const newLogic = [...(question.conditional_logic || []), { condition_type: 'answer_equals' as const, answer: 'Yes', next_question_id: '' }];
                                        updateQuestion(question.id, 'conditional_logic', newLogic);
                                      }}
                                      className="text-sm px-2 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                                    >
                                      + Add Yes condition
                                    </button>
                                  )}
                                  {!(question.conditional_logic || []).some(l => l.answer === 'No') && (
                                    <button
                                      onClick={() => {
                                        const newLogic = [...(question.conditional_logic || []), { condition_type: 'answer_equals' as const, answer: 'No', next_question_id: '' }];
                                        updateQuestion(question.id, 'conditional_logic', newLogic);
                                      }}
                                      className="text-sm px-2 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                                    >
                                      + Add No condition
                                    </button>
                                  )}
                                </>
                              )}
                              {question.type === 'single-choice' && (
                                <button
                                  onClick={() => {
                                    const answer = prompt('Enter the answer value to match:');
                                    if (answer && !(question.conditional_logic || []).some(l => l.answer === answer)) {
                                      const newLogic = [...(question.conditional_logic || []), { condition_type: 'answer_equals' as const, answer, next_question_id: '' }];
                                      updateQuestion(question.id, 'conditional_logic', newLogic);
                                    }
                                  }}
                                  className="text-sm px-2 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                                >
                                  + Add condition
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="pt-4 border-t border-gray-200 flex gap-2 flex-wrap">
                        <button
                          onClick={() => moveQuestionUp(question.id)}
                          disabled={actualIndex === 0 || (actualIndex > 0 && questions[actualIndex - 1]?.section_id !== question.section_id)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors font-medium"
                          title="Move question up within section"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => moveQuestionDown(question.id)}
                          disabled={actualIndex === questions.length - 1 || (actualIndex < questions.length - 1 && questions[actualIndex + 1]?.section_id !== question.section_id)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors font-medium"
                          title="Move question down within section"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => duplicateQuestion(question.id, actualIndex)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium"
                        >
                          <Copy className="w-4 h-4" />
                          {t.duplicateQuestion}
                        </button>

                        <button
                          onClick={() => deleteQuestion(question.id)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-red-300 hover:bg-red-50 text-red-700 rounded-lg transition-colors font-medium ml-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t.delete}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            );
          })
          )}
        </div>

        {/* Bottom Actions (Add Question and Save Buttons) */}
        {questions.length > 0 && (
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => addQuestion()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              {t.addQuestion}
            </button>
            <button 
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className={`flex-1 sm:flex-none px-6 py-3 rounded-lg font-medium transition-colors ${
                saveStatus === 'saved'
                  ? 'bg-green-600 text-white'
                  : saveStatus === 'saving'
                  ? 'bg-indigo-400 text-white cursor-wait'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {saveStatus === 'saved' ? `✓ ${t.saved}` : saveStatus === 'saving' ? t.saving : t.saveChanges}
            </button>
          </div>
        )}

        {/* Empty State */}
        {questions.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t.noQuestions}</h3>
            <p className="text-sm text-gray-500 mb-4">{t.getStarted}</p>
            <button
              onClick={() => addQuestion()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              {t.addQuestion}
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={true}
          onClose={() => setToast(null)}
        />
      )}

      {/* Activation Modal */}
      {showActivationModal && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t.activateModalTitle}</h3>
            <p className="text-gray-600 mb-6">
              {t.activateModalDesc}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowActivationModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors"
              >
                {t.activateLater}
              </button>
              <button
                onClick={() => {
                  setShowActivationModal(false);
                  toggleSurveyStatus();
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                {t.activateNow}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}