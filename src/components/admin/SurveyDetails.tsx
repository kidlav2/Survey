import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Copy, Edit3, BarChart3, Download, FileJson, Trash2, ExternalLink, CheckCircle, Pencil, QrCode, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabaseClient';
import DeleteSurveyModal from './DeleteSurveyModal';
import RenameSurveyModal from './RenameSurveyModal';
import ExportModal from './ExportModal';
import Toast from '../common/Toast';
import SkeletonSurveyCard from '../common/SkeletonSurveyCard';
import { adminTranslations } from './adminTranslations';
import { AdminLanguageContext } from './AdminLayout';

interface SurveyData {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  languages?: string[];
}


interface SurveyStats {
  totalResponses: number;
  completionRate: number;
  avgTime: number;
  optInRate: number;
}

function formatDateTime(value?: string | null, fallbackValue?: string | null) {
  const v = value ?? fallbackValue;
  if (!v) return 'N/A';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
}

function formatDate(value?: string | null, fallbackValue?: string | null) {
  const v = value ?? fallbackValue;
  if (!v) return 'N/A';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportModalType, setExportModalType] = useState<'CSV' | 'JSON' | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  useEffect(() => {
    loadSurveyDetails();
  }, [id]);

  const loadSurveyDetails = async () => {
    try {
      setLoading(true);

      // Fetch survey data
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', id)
        .single();

      if (surveyError) throw surveyError;

      setSurvey(surveyData);

      // Fetch responses for stats
      const { data: responses, error: responsesError } = await supabase
        .from('responses')
        .select('*')
        .eq('survey_id', id);

      if (responsesError) throw responsesError;

      // Calculate stats (DB-backed)
      const totalResponses = responses?.length || 0;

      const isCompleted = (r: any) => {
        const a = r?.answers;
        if (a == null) return false;
        if (typeof a === 'string') {
          const s = a.trim();
          if (!s || s === '{}' || s === 'null') return false;
          try {
            const obj = JSON.parse(s);
            return obj && typeof obj === 'object' && Object.keys(obj).length > 0;
          } catch {
            // If it's a non-empty string but not JSON, treat as completed
            return s.length > 0;
          }
        }
        if (typeof a === 'object') return Object.keys(a).length > 0;
        return Boolean(a);
      };

      const completedResponses = responses?.filter((r: any) => isCompleted(r)).length || 0;
      const completionRate = totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0;

      const hasEmail = (r: any) => {
        const e = (r?.respondent_email ?? r?.email ?? '').toString().trim();
        return e.length > 0;
      };

      const optedInResponses = responses?.filter((r: any) => hasEmail(r)).length || 0;
      const optInRate = totalResponses > 0 ? Math.round((optedInResponses / totalResponses) * 100) : 0;

      // Calculate average time (seconds -> minutes)
      const totalSeconds = responses?.reduce((sum: number, r: any) => sum + (Number(r?.duration_seconds) || 0), 0) || 0;
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
      setToast({ message: 'Failed to load survey details', type: 'error' });
      setLoading(false);
    }
  };

  const surveyLink = `${window.location.origin}/survey/${id}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(surveyLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      setToast({ message: 'Survey deleted successfully', type: 'success' });

      // Navigate back after a brief delay
      setTimeout(() => {
        navigate('/admin/surveys');
      }, 1000);
    } catch (error) {
      console.error('Error deleting survey:', error);
      setToast({ message: 'Failed to delete survey', type: 'error' });
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
      setToast({ message: 'Survey renamed successfully', type: 'success' });
    } catch (error) {
      console.error('Error renaming survey:', error);
      setToast({ message: 'Failed to rename survey', type: 'error' });
    }
  };

  const handleExport = async (type: 'CSV' | 'JSON') => {
    try {
      // Fetch responses for export
      const { data: responses, error: responsesError } = await supabase
        .from('responses')
        .select('*')
        .eq('survey_id', id);

      if (responsesError) throw responsesError;

      if (type === 'CSV') {
        const csv = [
          ['ID', 'Date', 'Email', 'Status', 'Duration'],
          ...(responses || []).map(r => [
            r.id,
            new Date(r.created_at).toLocaleString(),
            r.email || 'Not provided',
            r.completed ? 'Completed' : 'In Progress',
            r.duration_seconds ? `${Math.round(r.duration_seconds / 60)} minutes` : 'N/A'
          ])
        ]
          .map(row => row.map(cell => `"${cell}"`).join(','))
          .join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `responses_${survey?.title}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else if (type === 'JSON') {
        const json = JSON.stringify(responses, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `responses_${survey?.title}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }

      setToast({ 
        message: `${type} exported successfully`, 
        type: 'success' 
      });
      setExportModalType(null);
    } catch (error) {
      console.error('Error exporting:', error);
      setToast({ message: 'Failed to export data', type: 'error' });
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
              <h2 className="text-xl md:text-2xl font-semibold text-gray-900">{t.responseDetails || 'Survey Details'}</h2>
              <p className="text-sm text-gray-500 mt-1">{survey.title}</p>
            </div>
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
              <p className="text-sm text-gray-600 mb-2">Survey Title</p>
              <div className="flex items-start gap-3">
                <p className="text-base md:text-lg font-medium text-gray-900 flex-1">{survey.title}</p>
                <button
                  onClick={() => setIsRenameModalOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
                  title="Rename survey"
                >
                  <Pencil className="w-4 h-4 text-gray-600 group-hover:text-indigo-600" />
                </button>
              </div>
            </div>

            {/* Share Link */}
            <div>
              <p className="text-sm text-gray-600 mb-2">Shareable Link</p>
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
                        <span className="text-sm text-green-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-700">Copy</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsQRModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors text-gray-700 group"
                    title="Generate QR Code"
                  >
                    <QrCode className="w-4 h-4 text-gray-600 group-hover:text-indigo-600" />
                    <span className="text-sm">QR Code</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 pt-4 border-t border-gray-200">
              <div>
                <p className="text-sm text-gray-600 mb-1">Created</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(survey.created_at, null)}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600 mb-1">Last Modified</p>
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
            <h3 className="text-base md:text-lg font-semibold text-gray-900">Actions</h3>
          </div>
          
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                onClick={() => navigate(`/admin/surveys/${id}/builder`)}
                className="flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium justify-center"
              >
                <Edit3 className="w-4 h-4" />
                Edit Questions
              </button>

              <button
                onClick={() => navigate('/admin/responses')}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium justify-center"
              >
                <BarChart3 className="w-4 h-4" />
                View Responses
              </button>

              <button
                onClick={() => setExportModalType('CSV')}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium justify-center"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>

              <button
                onClick={() => setExportModalType('JSON')}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium justify-center"
              >
                <FileJson className="w-4 h-4" />
                Export JSON
              </button>

              <button
                onClick={() => window.open(surveyLink, '_blank', 'noopener,noreferrer')}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium justify-center"
              >
                <ExternalLink className="w-4 h-4" />
                Preview
              </button>

              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="flex items-center gap-2 px-4 py-3 border border-red-300 hover:bg-red-50 text-red-700 rounded-lg transition-colors font-medium justify-center"
              >
                <Trash2 className="w-4 h-4" />
                Delete Survey
              </button>
            </div>
          </div>
        </div>
      </div>

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
              <h3 className="text-base font-bold text-gray-900">QR Code sharing</h3>
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
                <p className="text-xs text-gray-500">Scan code to open survey</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col gap-2">
              <button
                onClick={downloadQRCode}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold text-sm shadow-sm"
              >
                <Download className="w-4 h-4" />
                Download PNG
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
          onExport={() => handleExport(exportModalType)}
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
    </main>
  );
}