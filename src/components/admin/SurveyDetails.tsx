import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronDown, Copy, Edit3, BarChart3, Download, FileJson, Trash2, ExternalLink, CheckCircle, Pencil, QrCode, X, Inbox, UserPlus } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabaseClient';
import DeleteSurveyModal from './DeleteSurveyModal';
import RenameSurveyModal from './RenameSurveyModal';
import ShareSurveyModal from './ShareSurveyModal';
import ExportModal from './ExportModal';
import Toast from '../common/Toast';
import SkeletonSurveyCard from '../common/SkeletonSurveyCard';
import { adminTranslations } from './adminTranslations';
import { AdminLanguageContext } from './AdminLayout';
import { isResponseCompleted, isCountableResponse, type QuestionRow, type ResponseRow } from '../../lib/responseFormat';
import { exportResponsesFile } from '../../lib/surveyExport';
import { exportSurveyJson } from '../../lib/surveyImport';
import { previewSurveyUrl } from '../../lib/surveyPreview';
import InactiveSurveyCopyModal from './InactiveSurveyCopyModal';

interface SurveyData {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  languages?: string[];
  owner_id?: string;
  status?: 'active' | 'draft' | string;
}


interface SurveyStats {
  totalResponses: number;
  completionRate: number;
  avgTime: number;
  optInRate: number;
}

function formatDateTime(value?: string | null, fallbackValue?: string | null) {
  const v = value ?? fallbackValue;
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function formatDate(value?: string | null, fallbackValue?: string | null) {
  const v = value ?? fallbackValue;
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}


export default function SurveyDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { language } = useContext(AdminLanguageContext);
  const t = adminTranslations[language];
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [stats, setStats] = useState<SurveyStats>({
    totalResponses: 0,
    completionRate: 0,
    avgTime: 0,
    optInRate: 0,
  });
  const [copied, setCopied] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportModalType, setExportModalType] = useState<'CSV' | 'JSON' | null>(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [copyWarningOpen, setCopyWarningOpen] = useState(false);

  useEffect(() => {
    loadSurveyDetails();
  }, [id]);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showExportDropdown) {
        const target = e.target as HTMLElement;
        if (!target.closest('.export-dropdown-container')) {
          setShowExportDropdown(false);
        }
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showExportDropdown]);

  const loadSurveyDetails = async () => {
    try {
      setLoading(true);

      // Fetch survey data
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('id, title, description, status, created_at, thank_you_message, show_survey_info, estimated_time, owner_id')
        .eq('id', id)
        .single();

      if (surveyError) throw surveyError;

      const { data: { user } } = await supabase.auth.getUser();
      setIsOwner(!surveyData?.owner_id || surveyData.owner_id === user?.id);
      setSurvey(surveyData);

      // Fetch responses for stats
      const { data: responses, error: responsesError } = await supabase
        .from('responses')
        .select('*')
        .eq('survey_id', id);

      if (responsesError) throw responsesError;

      // Calculate stats (DB-backed)
      const counted = (responses || []).filter((r: ResponseRow) => isCountableResponse(r));
      const totalResponses = counted.length;
      const completedResponses = counted.filter((r) => isResponseCompleted(r)).length;
      const completionRate = totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0;

      const hasEmail = (r: any) => {
        const e = (r?.respondent_email ?? r?.email ?? '').toString().trim();
        return e.length > 0;
      };

      const optedInResponses = counted.filter((r: any) => hasEmail(r)).length;
      const optInRate = totalResponses > 0 ? Math.round((optedInResponses / totalResponses) * 100) : 0;

      // Calculate average time (seconds -> minutes)
      const totalSeconds = counted.reduce((sum: number, r: any) => sum + (Number(r?.duration_seconds) || 0), 0) || 0;
      const avgTime = totalResponses > 0 ? Math.round(totalSeconds / totalResponses / 60) : 0;

      setStats({
        totalResponses,
        completionRate,
        avgTime,
        optInRate,
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading survey details:', error);
      setToast({ message: t.failedToLoadDetails, type: 'error' });
      setLoading(false);
    }
  };

  const surveyLink = `${window.location.origin}/survey/${id}`;
  const surveyIsActive = survey?.status === 'active';

  const copyLink = () => {
    navigator.clipboard.writeText(surveyLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyToClipboard = () => {
    if (!surveyIsActive) {
      setCopyWarningOpen(true);
      return;
    }
    copyLink();
  };

  const enableAndCopy = async () => {
    if (!id) return;
    const { error } = await supabase.from('surveys').update({ status: 'active' }).eq('id', id);
    if (!error) {
      setSurvey((current) => (current ? { ...current, status: 'active' } : current));
    }
    copyLink();
    setCopyWarningOpen(false);
  };

  const downloadQRCode = () => {
    const svg = document.getElementById('survey-qr-code');
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 1000;
      canvas.height = 1000;
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, 1000, 1000);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `qr_${survey?.title || 'survey'}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);

    try {
      // Delete survey
      const { error } = await supabase
        .from('surveys')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setIsDeleteModalOpen(false);
      setToast({ message: t.surveyDeleted, type: 'success' });

      // Navigate back after a brief delay
      setTimeout(() => {
        navigate('/admin/surveys');
      }, 1000);
    } catch (error) {
      console.error('Error deleting survey:', error);
      setToast({ message: t.failedToDeleteSurvey, type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRenameSurvey = async (newTitle: string) => {
    try {
      const { error } = await supabase
        .from('surveys')
        .update({ title: newTitle })
        .eq('id', id);

      if (error) throw error;

      setSurvey(survey ? { ...survey, title: newTitle } : null);
      setToast({ message: t.surveyRenamed, type: 'success' });
    } catch (error) {
      console.error('Error renaming survey:', error);
      setToast({ message: t.failedToRenameSurvey, type: 'error' });
    }
  };

  const handleResetQuestions = async () => {
    const confirmReset = window.confirm(
      t.resetResponsesConfirm.replace('{title}', survey?.title || '')
    );
    
    if (!confirmReset) return;

    try {
      console.log('Survey ID:', id);
      
      // First check how many responses exist
      const { data: checkData, error: checkError } = await supabase
        .from('responses')
        .select('id', { count: 'exact' })
        .eq('survey_id', id);

      console.log('Responses check:', { count: checkData?.length, error: checkError });

      // Delete all responses for this survey
      const { data, error } = await supabase
        .from('responses')
        .delete()
        .eq('survey_id', id)
        .select();

      console.log('Delete response:', { data, error, deletedCount: data?.length });

      if (error) {
        console.error('Delete error details:', error);
        throw error;
      }

      if (data && data.length > 0) {
        setToast({ message: t.deletedResponsesCount.replace('{n}', String(data.length)), type: 'success' });
        setTimeout(() => loadSurveyDetails(), 500);
      } else {
        setToast({ message: t.noResponsesToDelete, type: 'error' });
      }
    } catch (error) {
      console.error('Error resetting responses:', error);
      setToast({ message: t.failedToResetResponses, type: 'error' });
    }
  };

  const handleExportQuestions = async () => {
    try {
      // Fetch sections
      const { data: sections, error: sectionsError } = await supabase
        .from('sections')
        .select('*')
        .eq('survey_id', id)
        .order('order', { ascending: true });

      if (sectionsError) throw sectionsError;

      // Fetch questions
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('survey_id', id)
        .order('order', { ascending: true });

      if (questionsError) throw questionsError;

      // Create sections map
      const sectionsMap = new Map(sections?.map(s => [s.id, s]) || []);

      // Format questions with section info
      const exportData = questions?.map((q, index) => {
        const section = q.section_id ? sectionsMap.get(q.section_id) : null;
        const payload = q.payload || {};
        
        return {
          order: index + 1,
          section: section ? {
            name: payload.name?.en || section.name || 'Unnamed Section',
            description: payload.description?.en || section.description || ''
          } : null,
          question: {
            id: q.id,
            type: q.type,
            text: payload.text?.en || q.text,
            options: payload.options?.en || q.options || [],
            required: q.required || false,
            hasOtherOption: q.has_other_option || false,
            conditionalLogic: q.conditional_logic || null,
            translations: {
              ru: payload.text?.ru || null,
              fr: payload.text?.fr || null,
              es: payload.text?.es || null,
              options_ru: payload.options?.ru || null,
              options_fr: payload.options?.fr || null,
              options_es: payload.options?.es || null,
            }
          }
        };
      }) || [];

      const json = JSON.stringify({
        survey: {
          id: survey?.id,
          title: survey?.title,
          exportedAt: new Date().toISOString()
        },
        totalQuestions: exportData.length,
        totalSections: sections?.length || 0,
        questions: exportData
      }, null, 2);

      const blob = new Blob([json], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `questions_${survey?.title}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      setToast({ message: t.questionsExported, type: 'success' });
    } catch (error: any) {
      console.error('Error exporting questions:', error);
      setToast({ message: t.failedToExportQuestions, type: 'error' });
    }
  };

  const handleExport = async (type: 'CSV' | 'JSON', exportOptions?: { includeResponses: boolean; includeContacts: boolean; dateRange: string }) => {
    try {
      const options = exportOptions || { includeResponses: true, includeContacts: false, dateRange: 'all' };
      const { data: responses, error: responsesError } = await supabase
        .from('responses')
        .select('*')
        .eq('survey_id', id);
      if (responsesError) throw responsesError;

      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('survey_id', id)
        .order('sort_order', { ascending: true });
      if (questionsError) throw questionsError;

      exportResponsesFile({
        type,
        responses: ((responses || []) as ResponseRow[]).filter(isCountableResponse),
        questions: (questions || []) as QuestionRow[],
        surveyTitle: survey?.title,
        surveyTitles: survey?.id ? { [survey.id]: survey.title } : undefined,
        includeResponses: options.includeResponses,
        includeContacts: options.includeContacts,
        dateRange: options.dateRange,
        language,
      });

      setToast({ message: `${type} exported successfully`, type: 'success' });
      setExportModalType(null);
    } catch (error) {
      console.error('Error exporting:', error);
      setToast({ message: error instanceof Error ? error.message : t.failedToExportData, type: 'error' });
    }
  };

  if (loading) {
    return (
      <main className="flex-1">
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900">{t.responseDetails || 'Survey Details'}</h2>
        </header>
        <div className="p-4 md:p-8">
          <SkeletonSurveyCard />
        </div>
      </main>
    );
  }

  if (!survey) {
    return (
      <main className="flex-1">
        <div className="p-8">
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-600">{t.surveyNotFound}</p>
            <button
              onClick={() => navigate('/admin/surveys')}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              {t.backToSurveys}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const quickStats = [
    { label: t.responses, value: stats.totalResponses.toString(), icon: BarChart3, color: 'blue' },
    { label: t.completionRate || 'Completion Rate', value: `${stats.completionRate}%`, icon: CheckCircle, color: 'green' },
    { label: t.averageTime || 'Avg. Time', value: `${stats.avgTime} min`, icon: Download, color: 'indigo' },
    { label: t.opInRate || 'Opt-in Rate', value: `${stats.optInRate}%`, icon: FileJson, color: 'red' },
  ];

  return (
    <main className="flex-1">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/admin/surveys')}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-semibold text-gray-900">{t.responseDetails || t.surveys}</h2>
              <p className="text-sm text-gray-500 mt-1">{survey.title}</p>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-1 text-xs font-medium ${
                surveyIsActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              <span className={`mr-2 size-2 rounded-full ${surveyIsActive ? 'bg-green-600' : 'bg-red-600'}`} />
              {surveyIsActive ? t.statusOn : t.statusOff}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-4 md:p-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          {quickStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg bg-${stat.color}-50 flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 text-${stat.color}-600`} />
                  </div>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                </div>
                <p className="text-2xl md:text-3xl font-semibold text-gray-900">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Survey Info Card */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="px-4 md:px-6 py-4 border-b border-gray-200">
            <h3 className="text-base md:text-lg font-semibold text-gray-900">{t.surveyTitle}</h3>
          </div>
          
          <div className="p-4 md:p-6 space-y-6">
            {/* Title */}
            <div>
              <p className="text-sm text-gray-600 mb-2">{t.surveyTitle}</p>
              <div className="flex items-start gap-3">
                <p className="text-base md:text-lg font-medium text-gray-900 flex-1">{survey.title}</p>
                <button
                  onClick={() => setIsRenameModalOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
                  title={t.renamesurvey}
                >
                  <Pencil className="w-4 h-4 text-gray-600 group-hover:text-indigo-600" />
                </button>
              </div>
            </div>

            {/* Share Link */}
            <div>
              <p className="text-sm text-gray-600 mb-2">{t.shareableLink}</p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-2 overflow-x-auto">
                  <code className="text-xs md:text-sm text-gray-700 whitespace-nowrap">{surveyLink}</code>
                </div>
                <div className="flex gap-2 self-center sm:self-auto">
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex-1 sm:flex-initial"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-600">{t.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-700">{t.copy}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsQRModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors text-gray-700 group"
                    title={t.generateQRCode}
                  >
                    <QrCode className="w-4 h-4 text-gray-600 group-hover:text-indigo-600" />
                    <span className="text-sm">{t.generateQRCode}</span>
                  </button>
                </div>
              </div>
              {!surveyIsActive && (
                <p className="mt-3 text-sm leading-relaxed text-amber-800">{t.surveyOffPageHint}</p>
              )}
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 pt-4 border-t border-gray-200">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t.created}</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(survey.created_at, null)}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600 mb-1">{t.lastModified}</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDateTime(survey.updated_at, survey.created_at)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 md:px-6 py-4 border-b border-gray-200">
            <h3 className="text-base md:text-lg font-semibold text-gray-900">{t.actions}</h3>
          </div>
          
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
              <button
                onClick={() => setIsShareOpen(true)}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium justify-center"
              >
                <UserPlus className="w-4 h-4" />
                {t.shareSurvey}
              </button>

              <button
                onClick={() => navigate(`/admin/surveys/${id}/builder`)}
                className="flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium justify-center"
              >
                <Edit3 className="w-4 h-4" />
                {t.editQuestions}
              </button>

              <button
                onClick={() => navigate(id ? `/admin/responses?survey=${encodeURIComponent(id)}` : '/admin/responses')}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium justify-center"
              >
                <Inbox className="w-4 h-4" />
                {t.viewResponses}
              </button>

              <button
                onClick={() => navigate(`/admin/analytics?survey=${id}`)}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium justify-center"
              >
                <BarChart3 className="w-4 h-4" />
                {t.analytics}
              </button>

              <div className="relative export-dropdown-container">
                <button
                  onClick={() => setShowExportDropdown(!showExportDropdown)}
                  className="flex items-center gap-2 px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium justify-center w-full"
                >
                  <Download className="w-4 h-4" />
                  {t.exportData || 'Export Data'}
                  <ChevronDown className={`w-4 h-4 transition-transform ${showExportDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showExportDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden min-w-[180px]" style={{ position: 'absolute' }}>
                    <button
                      onClick={() => {
                        setExportModalType('CSV');
                        setShowExportDropdown(false);
                      }}
                      className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 text-gray-700 w-full text-left transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      {t.exportCSV}
                    </button>
                    <button
                      onClick={() => {
                        setExportModalType('JSON');
                        setShowExportDropdown(false);
                      }}
                      className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 text-gray-700 w-full text-left transition-colors border-t border-gray-100"
                    >
                      <FileJson className="w-4 h-4" />
                      {t.exportJSON}
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={async () => {
                  try {
                    await exportSurveyJson(id as string);
                    setToast({ message: t.surveyFileExported, type: 'success' });
                  } catch (error) {
                    console.error(error);
                    setToast({ message: t.failedToExportSurvey, type: 'error' });
                  }
                }}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium justify-center"
                title="Download the survey structure so you can import it again"
              >
                <FileJson className="w-4 h-4" />
                {t.exportSurvey}
              </button>

              <button
                onClick={() => window.open(previewSurveyUrl(id as string), '_blank', 'noopener,noreferrer')}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium justify-center"
              >
                <ExternalLink className="w-4 h-4" />
                {t.preview}
              </button>

              <button
                onClick={handleExportQuestions}
                className="flex items-center gap-2 px-4 py-3 border border-indigo-300 hover:bg-indigo-50 text-indigo-700 rounded-lg transition-colors font-medium justify-center"
                title="Download all questions with sections as JSON"
              >
                <Download className="w-4 h-4" />
                {t.exportQuestions}
              </button>

              {isOwner && (
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="flex items-center gap-2 px-4 py-3 border border-red-300 hover:bg-red-50 text-red-700 rounded-lg transition-colors font-medium justify-center"
              >
                <Trash2 className="w-4 h-4" />
                {t.deleteSurvey}
              </button>
              )}
              {isOwner && (
              <button
                onClick={handleResetQuestions}
                className="flex items-center gap-2 px-4 py-3 border border-red-300 hover:bg-red-50 text-red-700 rounded-lg transition-colors font-medium justify-center"
              >
                <Trash2 className="w-4 h-4" />
                {t.clearAllResponses}
              </button>
              )}
              {!isOwner && (
                <p className="sm:col-span-2 lg:col-span-3 text-sm text-gray-500">{t.sharedWithYou}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ShareSurveyModal
        isOpen={isShareOpen}
        surveyId={survey.id}
        language={language}
        onClose={() => setIsShareOpen(false)}
      />
      {/* Delete Modal */}
      <DeleteSurveyModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        surveyTitle={survey.title}
        isDeleting={isDeleting}
      />
      
      {/* Rename Modal */}
      <RenameSurveyModal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        currentTitle={survey.title}
        onSave={handleRenameSurvey}
      />
      {/* QR Code Modal */}
      {isQRModalOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 cursor-default"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => setIsQRModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden"
            style={{ maxWidth: '340px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
              <h3 className="text-base font-bold text-gray-900">{t.qrSharing}</h3>
              <button 
                onClick={() => setIsQRModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col items-center justify-center gap-4 bg-white">
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <QRCodeSVG
                  id="survey-qr-code"
                  value={surveyLink}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              
              <div className="text-center w-full">
                <p className="text-sm font-bold text-gray-900 mb-1 truncate px-2">{survey.title}</p>
                <p className="text-xs text-gray-500">{t.openPreview}</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col gap-2">
              <button
                onClick={downloadQRCode}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold text-sm shadow-sm"
              >
                <Download className="w-4 h-4" />
                {t.downloadPng}
              </button>
              <button
                onClick={() => setIsQRModalOpen(false)}
                className="w-full py-2 text-gray-500 hover:text-gray-700 transition-colors text-xs font-bold uppercase tracking-widest"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Export Modals */}
      {exportModalType && (
        <ExportModal
          isOpen={true}
          onClose={() => setExportModalType(null)}
          type={exportModalType}
          onExport={(options) => handleExport(exportModalType, options)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={true}
          onClose={() => setToast(null)}
        />
      )}
      <InactiveSurveyCopyModal
        open={copyWarningOpen}
        language={language}
        onCancel={() => setCopyWarningOpen(false)}
        onCopyAnyway={() => {
          copyLink();
          setCopyWarningOpen(false);
        }}
        onCopyAndEnable={() => {
          void enableAndCopy();
        }}
      />
    </main>
  );
}