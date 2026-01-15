import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, Mail, Clock, Copy, Plus, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import CreateSurveyModal from './CreateSurveyModal';
import Toast from '../common/Toast';

interface DashboardMetrics {
  totalResponses: number;
  emailsCollected: number;
  lastActivity: string;
}

interface ActiveSurvey {
  id: string;
  title: string;
  status: 'draft' | 'active';
  responses_count: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [copied, setCopied] = React.useState(false);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({ totalResponses: 0, emailsCollected: 0, lastActivity: 'No activity' });
  const [activeSurvey, setActiveSurvey] = useState<ActiveSurvey | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Not authenticated');

      // Fetch surveys
      const { data: surveys, error: surveysError } = await supabase
        .from('surveys')
        .select('*')
        .eq('owner_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (surveysError) throw surveysError;

      if (surveys && surveys.length > 0) {
        const survey = surveys[0];
        
        // Fetch responses count
        const { count: responsesCount, error: responsesError } = await supabase
          .from('responses')
          .select('*', { count: 'exact', head: true })
          .eq('survey_id', survey.id);

        if (responsesError) throw responsesError;

        // Fetch emails count
        const { count: emailsCount, error: emailsError } = await supabase
          .from('responses')
          .select('*', { count: 'exact', head: true })
          .eq('survey_id', survey.id)
          .not('email', 'is', null);

        if (emailsError) throw emailsError;

        setActiveSurvey({
          id: survey.id,
          title: survey.title,
          status: survey.status,
          responses_count: responsesCount || 0,
        });

        setMetrics({
          totalResponses: responsesCount || 0,
          emailsCollected: emailsCount || 0,
          lastActivity: '2 hours ago', // можно обновить при наличии timestamps
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setToast({ message: 'Failed to load dashboard data', type: 'error' });
      setLoading(false);
    }
  };

  const metricColorClasses: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
    green: { bg: 'bg-green-50', text: 'text-green-600' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-600' },
  };

  const metricCards = [
    { label: 'Total Responses', value: metrics.totalResponses, icon: Inbox, color: 'blue', path: '/admin/responses' },
    { label: 'Emails Collected', value: metrics.emailsCollected, icon: Mail, color: 'green', path: '/admin/contacts' },
    { label: 'Last Activity', value: metrics.lastActivity, icon: Clock, color: 'gray', path: null },
  ];

  const surveyLink = activeSurvey ? `${window.location.origin}/survey/${activeSurvey.id}` : '';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(surveyLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setToast({ message: 'Could not copy link. Please copy it manually.', type: 'error' });
    }
  };

  const handleCreateSurvey = (surveyData: { id: string }) => {
    setToast({ message: 'Survey created successfully', type: 'success' });
    setIsModalOpen(false);
    loadDashboardData(); // Refresh data
    navigate(`/admin/surveys/${surveyData.id}/builder`);
  };

  if (loading) {
    return (
      <main className="flex-1">
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900">Dashboard</h2>
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
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Internal Survey Research Project</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-4 md:p-8">
        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          {metricCards.map((metric) => {
            const Icon = metric.icon;
            return (
              <button
                key={metric.label}
                onClick={() => metric.path && navigate(metric.path)}
                className={`bg-white rounded-lg border border-gray-200 p-6 text-left transition-all ${
                  metric.path ? 'hover:border-indigo-300 hover:shadow-sm cursor-pointer' : 'cursor-default'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${metricColorClasses[metric.color]?.bg ?? 'bg-gray-50'}`}>
                    <Icon className={`w-6 h-6 ${metricColorClasses[metric.color]?.text ?? 'text-gray-600'}`} />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-600">{metric.label}</p>
                  <p className="text-2xl md:text-3xl font-semibold text-gray-900 mt-1">{metric.value}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Create Survey Button */}
        <div className="mb-6 md:mb-8">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center md:justify-start gap-2 w-full md:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Create New Survey
          </button>
        </div>

        {/* Active Survey Overview */}
        {activeSurvey ? (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 md:px-6 py-4 border-b border-gray-200">
              <h3 className="text-base md:text-lg font-semibold text-gray-900">Active Survey</h3>
              <p className="text-sm text-gray-500 mt-1">Current research project overview</p>
            </div>
            
            <div className="p-4 md:p-6">
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-2">Survey Title</p>
                <p className="text-lg md:text-xl font-semibold text-gray-900">
                  {activeSurvey.title}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 mb-2">Shareable Survey Link</p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1 bg-white border border-gray-200 rounded px-3 py-2 overflow-x-auto">
                    <code className="text-xs md:text-sm text-gray-700 whitespace-nowrap">{surveyLink}</code>
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="p-2.5 border border-gray-300 hover:bg-white rounded-lg transition-colors self-center sm:self-auto"
                    title="Copy link"
                  >
                    {copied ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5 text-gray-600" />
                    )}
                  </button>
                </div>
                {copied && (
                  <p className="text-sm text-green-600 mt-2">Link copied to clipboard!</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Status</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    activeSurvey.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {activeSurvey.status === 'active' && <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>}
                    {activeSurvey.status.charAt(0).toUpperCase() + activeSurvey.status.slice(1)}
                  </span>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 mb-1">Language</p>
                  <p className="text-base font-medium text-gray-900">English</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Responses</p>
                  <p className="text-base font-medium text-gray-900">{activeSurvey.responses_count}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate(`/admin/surveys/${activeSurvey.id}`)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Manage Survey
                </button>
                <button
                  onClick={() => navigate('/admin/responses')}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  View Responses
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <p className="text-gray-600 mb-4">No active surveys yet</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
            >
              Create Your First Survey
            </button>
          </div>
        )}

        {/* Recent Activity */}
        <div className="mt-6 bg-white rounded-lg border border-gray-200">
          <div className="px-4 md:px-6 py-4 border-b border-gray-200">
            <h3 className="text-base md:text-lg font-semibold text-gray-900">Recent Activity</h3>
          </div>
          
          <div className="p-4 md:p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3 pb-4 border-b border-gray-100">
                <div className="w-2 h-2 bg-indigo-600 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">New response submitted</p>
                  <p className="text-xs text-gray-500 mt-1">2 hours ago</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 pb-4 border-b border-gray-100">
                <div className="w-2 h-2 bg-indigo-600 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">New email collected</p>
                  <p className="text-xs text-gray-500 mt-1">4 hours ago</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-gray-300 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">Survey link accessed</p>
                  <p className="text-xs text-gray-500 mt-1">6 hours ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Survey Modal */}
      <CreateSurveyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateSurvey}
      />

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
