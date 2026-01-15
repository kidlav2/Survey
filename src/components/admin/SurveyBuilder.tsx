import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2, GripVertical, ChevronDown, ChevronUp, FileText, Copy } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import Toast from '../common/Toast';

interface Question {
  id: string;
  type: 'single-choice' | 'multiple-choice' | 'scale' | 'text' | 'yes-no';
  text: string;
  options?: string[];
  required: boolean;
  hasOtherOption?: boolean;
  order: number;
}

const translations = {
  en: {
    addOption: 'Add Option',
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
  },
  ru: {
    addOption: 'Добавить вариант',
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
  },
  fr: {
    addOption: 'Ajouter une option',
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
  },
  es: {
    addOption: 'Agregar opción',
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
  },
};

export default function SurveyBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'idle'>('idle');
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<'en' | 'ru' | 'fr' | 'es'>('en');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const t = translations[language];

  useEffect(() => {
    loadQuestions();
  }, [id]);

  const loadQuestions = async () => {
    try {
      setLoading(true);

      // Fetch questions for this survey
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('survey_id', id)
        .order('order', { ascending: true });

      if (questionsError) throw questionsError;

      setQuestions(questionsData || []);
      setSaveStatus('saved');
      setLoading(false);
    } catch (error) {
      console.error('Error loading questions:', error);
      setToast({ message: t.failed_load, type: 'error' });
      setLoading(false);
    }
  };

  const addQuestion = (afterIndex?: number) => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      type: 'single-choice',
      text: '',
      options: ['Option 1', 'Option 2'],
      required: false,
      hasOtherOption: false,
      order: afterIndex !== undefined ? afterIndex + 1 : questions.length,
    };

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
      id: Date.now().toString(),
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
      // If it's a saved question (not just created), delete from DB
      if (!questionId.includes('Date.now')) {
        const { error } = await supabase
          .from('questions')
          .delete()
          .eq('id', questionId);

        if (error) throw error;
      }

      setQuestions(questions.filter(q => q.id !== questionId));
      setSaveStatus('unsaved');
    } catch (error) {
      console.error('Error deleting question:', error);
      setToast({ message: t.failed_delete, type: 'error' });
    }
  };

  const updateQuestion = (questionId: string, key: keyof Question, value: any) => {
    setQuestions(questions.map(q => q.id === questionId ? { ...q, [key]: value } : q));
    setSaveStatus('unsaved');
  };

  const handlePreview = () => {
    window.open(`/survey/${id}`, '_blank', 'noopener,noreferrer');
  };

  const handleSave = async () => {
    setSaveStatus('saving');

    try {
      // Save all questions
      for (const question of questions) {
        if (question.id.includes('Date.now')) {
          // New question - insert
          const { error } = await supabase
            .from('questions')
            .insert([{
              survey_id: id,
              type: question.type,
              text: question.text,
              options: question.options,
              required: question.required,
              hasOtherOption: question.hasOtherOption,
              order: question.order,
            }]);

          if (error) throw error;
        } else {
          // Existing question - update
          const { error } = await supabase
            .from('questions')
            .update({
              type: question.type,
              text: question.text,
              options: question.options,
              required: question.required,
              hasOtherOption: question.hasOtherOption,
              order: question.order,
            })
            .eq('id', question.id);

          if (error) throw error;
        }
      }

      setSaveStatus('saved');
      setToast({ message: t.saved_toast, type: 'success' });
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving questions:', error);
      setToast({ message: t.failed_toast, type: 'error' });
      setSaveStatus('unsaved');
    }
  };

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestion(expandedQuestion === questionId ? null : questionId);
  };

  if (loading) {
    return (
      <main className="flex-1">
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900">{t.surveyBuilder}</h2>
        </header>
        <div className="p-4 md:p-8 flex items-center justify-center min-h-screen">
          <div className="text-gray-600">Loading...</div>
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
            <div className="text-right sm:ml-4">
              <p className="text-xs text-gray-500">{t.totalQuestions}</p>
              <p className="text-lg font-semibold text-gray-900">{questions.length}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-4 md:p-8">
        {/* Add Question Button at Top */}
        <div className="mb-6">
          <button
            onClick={() => addQuestion()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            {t.addQuestion}
          </button>
        </div>

        {/* Questions List */}
        <div className="space-y-4">
          {questions.map((question, index) => (
            <div key={question.id}>
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
                      <span className="text-sm font-medium text-gray-900">Question {index + 1}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {question.type === 'single-choice' ? 'Single Choice' : question.type === 'multiple-choice' ? 'Multiple' : question.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 truncate">{question.text || 'Untitled question'}</p>
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

                      {/* Options (for single-choice and multiple-choice) */}
                      {(question.type === 'single-choice' || question.type === 'multiple-choice') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t.options}
                          </label>
                          <div className="space-y-2">
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
                                  type="text"
                                  value={t.other}
                                  disabled
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
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
                            </div>
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

                      {/* Action Buttons */}
                      <div className="pt-4 border-t border-gray-200 flex gap-2 flex-wrap">
                        <button
                          onClick={() => addQuestion(index)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-indigo-300 hover:bg-indigo-50 text-indigo-700 rounded-lg transition-colors font-medium"
                        >
                          <Plus className="w-4 h-4" />
                          {t.addBelow}
                        </button>
                        
                        <button
                          onClick={() => duplicateQuestion(question.id, index)}
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

              {/* Add Question Between Questions */}
              {index < questions.length - 1 && (
                <div className="flex justify-center py-2">
                  <button
                    onClick={() => addQuestion(index)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Add question below"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Empty State */}
        {questions.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
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
    </main>
  );
}