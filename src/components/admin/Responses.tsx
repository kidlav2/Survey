import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileJson } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import ExportModal from './ExportModal';
import Toast from '../common/Toast';
import SkeletonDashboard from '../common/SkeletonDashboard';

interface Response {
  id: string;
  created_at: string;
  respondent_email: string | null;
  survey_id: string;
  answers: Record<string, any> | null;
  // Optional columns if you add them later
  completed?: boolean | null;
  duration_seconds?: number | null;
}

interface ResponseStats {
  totalResponses: number;
  today: number;
  thisWeek: number;
  completionRate: number;
}

export default function Responses() {
  const navigate = useNavigate();
  const [responses, setResponses] = useState<Response[]>([]);
  const [stats, setStats] = useState<ResponseStats>({
    totalResponses: 0,
    today: 0,
    thisWeek: 0,
    completionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [exportModalType, setExportModalType] = useState<'CSV' | 'JSON' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  useEffect(() => {
    loadResponses();
  }, []);

  const loadResponses = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Not authenticated');

      // Fetch surveys for current user
      const { data: surveys, error: surveysError } = await supabase
        .from('surveys')
        .select('id')
        .eq('owner_id', user.id);

      if (surveysError) throw surveysError;

      const surveyIds = surveys?.map(s => s.id) || [];

      if (surveyIds.length === 0) {
        setResponses([]);
        setLoading(false);
        return;
      }

      // Fetch responses for user's surveys
      const { data: allResponses, error: responsesError } = await supabase
        .from('responses')
        .select('*')
        .in('survey_id', surveyIds)
        .order('created_at', { ascending: false });

      if (responsesError) throw responsesError;

      setResponses(allResponses || []);

      // Calculate stats
      const totalResponses = allResponses?.length || 0;
      const completedResponses = allResponses?.filter((r: any) => {
        if (r.completed === true) return true;
        const a = r.answers;
        return a && typeof a === 'object' && Object.keys(a).length > 0;
      }).length || 0;
      const completionRate = totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0;

      // Count today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayCount = allResponses?.filter(r => 
        new Date(r.created_at) >= today
      ).length || 0;

      // Count this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const thisWeekCount = allResponses?.filter(r => 
        new Date(r.created_at) > oneWeekAgo
      ).length || 0;

      setStats({
        totalResponses,
        today: todayCount,
        thisWeek: thisWeekCount,
        completionRate,
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading responses:', error);
      setToast({ message: 'Failed to load responses', type: 'error' });
      setLoading(false);
    }
  };

  const handleExport = (type: 'CSV' | 'JSON') => {
    try {
      if (type === 'CSV') {
        const csv = [
          ['ID', 'Date', 'Email', 'Status', 'Duration'],
          ...responses.map(r => [
            r.id,
            new Date(r.created_at).toLocaleString(),
            r.respondent_email || 'Not provided',
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
        a.download = `responses_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else if (type === 'JSON') {
        const json = JSON.stringify(responses, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `responses_${new Date().toISOString().split('T')[0]}.json`;
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

  const statConfig = [
    {
      label: 'Total Responses',
      value: stats.totalResponses,
      color: 'indigo',
      icon: Download,
    },
    {
      label: 'Today',
      value: stats.today,
      color: 'green',
      icon: Download,
    },
    {
      label: 'This Week',
      value: stats.thisWeek,
      color: 'blue',
      icon: Download,
    },
    {
      label: 'Completion Rate',
      value: `${stats.completionRate}%`,
      color: 'yellow',
      icon: Download,
    },
  ];

  if (loading) {
    return (
      <main className="flex-1">
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900">Responses</h2>
        </header>
        <div className="p-4 md:p-8">
          <SkeletonDashboard />
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
            <h2 className="text-xl md:text-2xl font-semibold text-gray-900">Responses</h2>
            <p className="text-sm text-gray-500 mt-1">View and analyze survey responses</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button 
              onClick={() => setExportModalType('CSV')}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button 
              onClick={() => setExportModalType('JSON')}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium"
            >
              <FileJson className="w-4 h-4" />
              Export JSON
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-4 md:p-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          {statConfig.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-2">
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

        {/* Responses Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-200">
            <h3 className="text-base md:text-lg font-semibold text-gray-900">Recent Responses</h3>
          </div>

          {responses.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No responses found
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden">
                {responses.map((response) => {
                  const isCompleted = response.completed === true || (response.answers && typeof response.answers === 'object' && Object.keys(response.answers).length > 0);
                  return (
                  <div key={response.id} className="p-4 border-b border-gray-200 last:border-b-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">Response #{response.id.slice(0, 8)}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        isCompleted
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {isCompleted ? 'Completed' : 'In Progress'}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Date:</span>
                        <span className="text-gray-900">{new Date(response.created_at).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Email:</span>
                        <span className="text-gray-900">{response.respondent_email || 'Not provided'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Duration:</span>
                        <span className="text-gray-900">
                          {response.duration_seconds ? `${Math.round(response.duration_seconds / 60)} minutes` : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate(`/admin/responses/${response.id}`)}
                      className="mt-3 w-full px-3 py-1.5 text-sm text-indigo-600 border border-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {responses.map((response) => {
                      const isCompleted = response.completed === true || (response.answers && typeof response.answers === 'object' && Object.keys(response.answers).length > 0);
                      return (
                      <tr key={response.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {response.id.slice(0, 8)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {new Date(response.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {response.respondent_email || 'Not provided'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              isCompleted
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {isCompleted ? 'Completed' : 'In Progress'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {response.duration_seconds ? `${Math.round(response.duration_seconds / 60)} minutes` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          <button 
                            onClick={() => navigate(`/admin/responses/${response.id}`)}
                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

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