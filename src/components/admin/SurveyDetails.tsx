import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Copy, Edit3, BarChart3, Download, FileJson, Trash2, ExternalLink, CheckCircle, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import DeleteSurveyModal from './DeleteSurveyModal';
import RenameSurveyModal from './RenameSurveyModal';
import ExportModal from './ExportModal';
import Toast from '../common/Toast';

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

export default function SurveyDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
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

      // Calculate stats
      const totalResponses = responses?.length || 0;
      const completedResponses = responses?.filter(r => r.completed).length || 0;
      const completionRate = totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0;
      const optedInResponses = responses?.filter(r => r.opted_in).length || 0;
      const optInRate = totalResponses > 0 ? Math.round((optedInResponses / totalResponses) * 100) : 0;

      // Calculate average time
      const totalSeconds = responses?.reduce((sum, r) => sum + (r.duration_seconds || 0), 0) || 0;
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
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900">Survey Details</h2>
        </header>
        <div className="p-4 md:p-8 flex items-center justify-center min-h-screen">
          <div className="text-gray-600">Loading...</div>
        </div>
      </main>
    );
  }

  if (!survey) {
    return (
      <main className="flex-1">
        <div className="p-8">
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-600">Survey not found</p>
            <button
              onClick={() => navigate('/admin/surveys')}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              Back to Surveys
            </button>
          </div>
        </div>
      </main>
    );
  }

  const quickStats = [
    { label: 'Responses', value: stats.totalResponses.toString(), icon: BarChart3, color: 'blue' },
    { label: 'Completion Rate', value: `${stats.completionRate}%`, icon: CheckCircle, color: 'green' },
    { label: 'Avg. Time', value: `${stats.avgTime} min`, icon: Download, color: 'indigo' },
    { label: 'Opt-in Rate', value: `${stats.optInRate}%`, icon: FileJson, color: 'red' },
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
              <h2 className="text-xl md:text-2xl font-semibold text-gray-900">Survey Details</h2>
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
            <h3 className="text-base md:text-lg font-semibold text-gray-900">Survey Information</h3>
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
                <button
                  onClick={copyToClipboard}
                  className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors self-center sm:self-auto"
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
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 pt-4 border-t border-gray-200">
              <div>
                <p className="text-sm text-gray-600 mb-1">Created</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(survey.created_at).toLocaleDateString()}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600 mb-1">Last Modified</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(survey.updated_at).toLocaleDateString()}
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