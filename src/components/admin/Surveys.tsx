import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Settings, ArrowUpDown } from 'lucide-react';
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
  updated_at?: string;
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
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'responses' | 'status' | 'modified'>(() => {
    const saved = localStorage.getItem('survey_sort_preference');
    return (saved as any) || 'date';
  });
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortButtonRef, setSortButtonRef] = useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    loadSurveys();
  }, []);

  useEffect(() => {
    localStorage.setItem('survey_sort_preference', sortBy);
  }, [sortBy]);

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

      // Get responses count for each survey
      const surveysWithCounts = await Promise.all(
        (data || []).map(async (survey) => {
          const { count, error: countError } = await supabase
            .from('responses')
            .select('*', { count: 'exact', head: true })
            .eq('survey_id', survey.id);

          return {
            ...survey,
            responses_count: countError ? 0 : (count || 0),
          };
        })
      );

      setSurveys(surveysWithCounts);
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

  const getSortedSurveys = () => {
    const sorted = [...surveys];
    
    switch (sortBy) {
      case 'title':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'responses':
        return sorted.sort((a, b) => (b.responses_count || 0) - (a.responses_count || 0));
      case 'status':
        return sorted.sort((a, b) => {
          if (a.status === 'active' && b.status !== 'active') return -1;
          if (a.status !== 'active' && b.status === 'active') return 1;
          return 0;
        });
      case 'modified':
        return sorted.sort((a, b) => {
          const aTime = new Date(a.updated_at || a.created_at).getTime();
          const bTime = new Date(b.updated_at || b.created_at).getTime();
          return bTime - aTime;
        });
      case 'date':
      default:
        return sorted.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  };

  const handleToggleStatus = async (surveyId: string, newStatus: 'active' | 'draft') => {
    try {
      const { error } = await supabase
        .from('surveys')
        .update({ status: newStatus })
        .eq('id', surveyId);

      if (error) throw error;

      // Update local state
      setSurveys(surveys.map(s => 
        s.id === surveyId ? { ...s, status: newStatus } : s
      ));

      setToast({
        message: `Survey ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error updating survey status:', error);
      setToast({
        message: 'Failed to update survey status',
        type: 'error'
      });
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
          <div 
            className="flex items-center gap-3"
            style={{
              flexDirection: window.innerWidth < 640 ? 'row' : 'row-reverse'
            }}
          >
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Survey</span>
              <span className="sm:hidden">Create</span>
            </button>
            
            {/* Sort Dropdown */}
            {surveys.length > 0 && (
              <>
                <button
                  ref={setSortButtonRef}
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium whitespace-nowrap"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Sort Dropdown Menu - Outside of header flow */}
      {showSortMenu && sortButtonRef && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowSortMenu(false)}
          />
          <div 
            className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 w-[calc(100%-2rem)] max-w-[12rem] mx-4 sm:mx-0 sm:w-auto"
            style={{
              top: `${sortButtonRef.getBoundingClientRect().bottom + 8}px`,
              left: typeof window !== 'undefined' && window.innerWidth < 640 
                ? '1rem'
                : 'auto',
              right: typeof window !== 'undefined' && window.innerWidth >= 640
                ? `${window.innerWidth - sortButtonRef.getBoundingClientRect().right}px`
                : '1rem',
            }}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSortBy('date'); setShowSortMenu(false); }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                sortBy === 'date' ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-700'
              }`}
            >
              Date Created
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSortBy('modified'); setShowSortMenu(false); }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                sortBy === 'modified' ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-700'
              }`}
            >
              Last Modified
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSortBy('title'); setShowSortMenu(false); }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                sortBy === 'title' ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-700'
              }`}
            >
              Title (A-Z)
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSortBy('responses'); setShowSortMenu(false); }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                sortBy === 'responses' ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-700'
              }`}
            >
              Response Count
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSortBy('status'); setShowSortMenu(false); }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                sortBy === 'status' ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-700'
              }`}
            >
              Status (Active First)
            </button>
          </div>
        </>
      )}

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
            {getSortedSurveys().map(survey => (
              <SurveyCard
                key={survey.id}
                survey={{
                  id: survey.id,
                  title: survey.title,
                  status: survey.status === 'active' ? 'Active' : 'Disabled',
                  responses: survey.responses_count || 0,
                  lastActivity: new Date(survey.created_at).toLocaleDateString(),
                  link: `/survey/${survey.id}`,
                }}
                onDelete={(id) => {
                  setSelectedSurvey(id);
                  setIsDeleteModalOpen(true);
                }}
                onToggleStatus={handleToggleStatus}
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
