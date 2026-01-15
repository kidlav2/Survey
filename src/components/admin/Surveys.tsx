import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Settings } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import SurveyCard from './SurveyCard';
import CreateSurveyModal from './CreateSurveyModal';
import DeleteSurveyModal from './DeleteSurveyModal';
import Toast from '../common/Toast';

interface Survey {
  id: string;
  title: string;
  description?: string;
  status: 'draft' | 'active';
  created_at: string;
  responses_count: number;
}

export default function Surveys() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<string | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  useEffect(() => {
    loadSurveys();
  }, []);

  const loadSurveys = async () => {
    try {
      setIsLoading(true);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Not authenticated');

      // Fetch surveys for current user
      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSurveys(data || []);
      setErrorMsg(null);
    } catch (error) {
      console.error('Error loading surveys:', error);
      setErrorMsg('Failed to load surveys');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSurvey = async (surveyData: { id: string; title: string; description: string; status: string }) => {
    try {
      // Перезагрузить список surveys
      await loadSurveys();
      
      // Закрыть modal
      setIsModalOpen(false);

      // Открыть сразу в редакторе
      navigate(`/admin/surveys/${surveyData.id}/builder`);
    } catch (error) {
      console.error('Error after survey creation:', error);
      setToast({ 
        message: 'Survey created but failed to refresh list', 
        type: 'warning' 
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSurvey) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('surveys')
        .delete()
        .eq('id', selectedSurvey);

      if (error) throw error;

      setSurveys(surveys.filter(s => s.id !== selectedSurvey));
      setIsDeleteModalOpen(false);
      setSelectedSurvey(null);

      setToast({
        message: 'Survey deleted successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Error deleting survey:', error);
      setToast({
        message: 'Failed to delete survey',
        type: 'error'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex-1">
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900">Surveys</h2>
        </header>
        <div className="p-4 md:p-8 flex items-center justify-center min-h-screen">
          <div className="text-gray-600">Loading surveys...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-semibold text-gray-900">Surveys</h2>
            <p className="text-sm text-gray-500 mt-1">Manage and track your surveys</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Survey
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-4 md:p-8">
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}

        {surveys.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No surveys yet</h3>
            <p className="text-sm text-gray-500 mb-4">Get started by creating your first survey</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Create Survey
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {surveys.map(survey => (
              <SurveyCard
                key={survey.id}
                survey={{
                  id: survey.id,
                  title: survey.title,
                  status: survey.status === 'active' ? 'Active' : 'Draft',
                  responses: survey.responses_count || 0,
                  lastActivity: new Date(survey.created_at).toLocaleDateString(),
                  link: `/survey/${survey.id}`,
                }}
                onDelete={(id) => {
                  setSelectedSurvey(id);
                  setIsDeleteModalOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Survey Modal */}
      <CreateSurveyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateSurvey}
      />

      {/* Delete Survey Modal */}
      <DeleteSurveyModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        surveyTitle={surveys.find(s => s.id === selectedSurvey)?.title || ''}
        isDeleting={isDeleting}
      />

      {/* Toast Notification */}
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
