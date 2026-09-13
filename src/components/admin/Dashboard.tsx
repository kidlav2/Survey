import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, Mail, Clock, Copy, Plus, CheckCircle, QrCode, X, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabaseClient';
import CreateSurveyModal from './CreateSurveyModal';
import Toast from '../common/Toast';
import SkeletonDashboard from '../common/SkeletonDashboard';
import { adminTranslations } from './adminTranslations';
import { AdminLanguageContext } from './AdminLayout';

interface DashboardMetrics {
  totalResponses: number;
  emailsCollected: number;
  lastActivity: string;
}

interface ActiveSurvey {
  id: string;
  title: string;
  responses_count: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { language } = useContext(AdminLanguageContext);
  const [copied, setCopied] = React.useState(false);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({ totalResponses: 0, emailsCollected: 0, lastActivity: 'No activity' });
  const [activeSurvey, setActiveSurvey] = useState<ActiveSurvey | null>(null);
  const [loading, setLoading] = useState(true);
  const [languageCounts, setLanguageCounts] = useState<Record<string, number>>({});
  const [recentActivity, setRecentActivity] = useState<Array<{ label: string; when: string; tone: 'primary' | 'muted'; surveyId?: string }>>([]);

  const t = adminTranslations[language];

  useEffect(() => {
    loadDashboardData();

    // Subscribe to real-time updates on responses
    const onFocus = () => {
      if (!document.hidden) loadDashboardData();
    };
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
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
        .order('created_at', { ascending: false });

      if (surveysError) throw surveysError;

      if (surveys && surveys.length > 0) {
        // Get total stats from ALL surveys
        const { data: allResponses, error: allResponsesError } = await supabase
          .from('responses')
          .select('respondent_email, opted_in, created_at, language, survey_id')
          .in('survey_id', surveys.map(s => s.id));

        if (allResponsesError) throw allResponsesError;

        const totalResponsesCount = allResponses?.length || 0;
        const totalEmailsCount = allResponses?.filter((r: any) => r.opted_in && r.respondent_email && r.respondent_email.trim() !== '').length || 0;
        const lastResponseAt = allResponses && allResponses.length > 0 
          ? allResponses.reduce((latest: any, current: any) => {
              const latestDate = new Date(latest.created_at).getTime();
              const currentDate = new Date(current.created_at).getTime();
              return currentDate > latestDate ? current : latest;
            }).created_at
          : null;
        const lastEmailAt = allResponses
          ?.filter((r: any) => r.opted_in && r.respondent_email && r.respondent_email.trim() !== '')
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at || null;

        // Find survey with most recent activity (last response)
        let surveyWithLatestActivity = surveys[0];
        let latestResponseTime = new Date(0);
        
        for (const survey of surveys) {
          const surveyResponses = allResponses?.filter((r: any) => r.survey_id === survey.id) || [];
          if (surveyResponses.length > 0) {
            const latestResponse = surveyResponses.reduce((latest: any, current: any) => {
              const latestDate = new Date(latest.created_at).getTime();
              const currentDate = new Date(current.created_at).getTime();
              return currentDate > latestDate ? current : latest;
            });
            const responseTime = new Date(latestResponse.created_at);
            if (responseTime > latestResponseTime) {
              latestResponseTime = responseTime;
              surveyWithLatestActivity = survey;
            }
          }
        }

        const survey = surveyWithLatestActivity;
        const surveyResponseCount = allResponses?.filter((r: any) => r.survey_id === survey.id).length || 0;
        
        console.log('All surveys stats:', { totalResponses: totalResponsesCount, totalEmails: totalEmailsCount });
        
        // Get language breakdown ONLY for the active survey
        const counts: Record<string, number> = {};
        (allResponses || [])
          .filter((r: any) => r.survey_id === survey.id)
          .forEach((r: any) => {
            const code = (r?.language ?? null) as string | null;
            if (!code) return;
            counts[code] = (counts[code] || 0) + 1;
          });
        setLanguageCounts(counts);

        if (allResponsesError) throw allResponsesError;

        // Old code removed - now using aggregated data from all surveys above

        setActiveSurvey({
          id: survey.id,
          title: survey.title,
          responses_count: surveyResponseCount,
        });

        setMetrics({
          totalResponses: totalResponsesCount,
          emailsCollected: totalEmailsCount,
          lastActivity: relativeTime(lastResponseAt),
        });

        const activity: Array<{ label: string; when: string; tone: 'primary' | 'muted'; surveyId?: string }> = [];

        if (lastResponseAt) {
          activity.push({ label: t.newResponseSubmitted, when: relativeTime(lastResponseAt), tone: 'primary', surveyId: activeSurvey?.id });
        }

        if (lastEmailAt) {
          activity.push({ label: t.newEmailCollected, when: relativeTime(lastEmailAt), tone: 'primary', surveyId: activeSurvey?.id });
        }

        const createdAt = (survey as any).created_at ?? null;
        if (createdAt) {
          activity.push({ label: t.surveyCreated, when: relativeTime(createdAt), tone: 'muted', surveyId: activeSurvey?.id });
        }

        setRecentActivity(activity.slice(0, 10));
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      const msg = error?.message || error?.error_description || 'Failed to load dashboard data';
      setToast({ message: msg, type: 'error' });
      setLoading(false);
    }
  };

  const metricColorClasses: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
    green: { bg: 'bg-green-50', text: 'text-green-600' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-600' },
  };

  const languageBreakdown = (counts: Record<string, number>) => {
    const items: Array<{ code: string; label: string; count: number }> = [
      { code: 'en', label: 'EN', count: counts.en || 0 },
      { code: 'ru', label: 'RU', count: counts.ru || 0 },
      { code: 'fr', label: 'FR', count: counts.fr || 0 },
      { code: 'es', label: 'ES', count: counts.es || 0 },
    ];

    const total = items.reduce((sum, i) => sum + i.count, 0);
    if (total === 0) return 'No responses yet';

    return items
      .filter(i => i.count > 0)
      .map(i => `${i.label}: ${i.count}`)
      .join('  ');
  };

  const relativeTime = (iso?: string | null) => {
    if (!iso) return 'No activity';
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.round((now - then) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.round(diffHr / 24);
    return `${diffDay}d ago`;
  };

  const metricCards = [
    { label: t.totalResponses, value: metrics.totalResponses, icon: Inbox, color: 'blue', path: '/admin/responses' },
    { label: t.emailsCollected, value: metrics.emailsCollected, icon: Mail, color: 'green', path: '/admin/contacts' },
    { label: t.lastActivity, value: metrics.lastActivity, icon: Clock, color: 'gray', path: null },
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

  const downloadQRCode = () => {
    if (!activeSurvey) return;
    const svg = document.getElementById(`dashboard-qrcode-${activeSurvey.id}`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = 1000;
      canvas.height = 1000;
      ctx?.drawImage(img, 0, 0, 1000, 1000);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `survey-qr-${activeSurvey.id}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-navy">{t.dashboard}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t.internalSurveyResearchProject}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-4 md:p-8">
        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          {metricCards.map((metric) => {
            return (
              <button
                key={metric.label}
                onClick={() => metric.path && navigate(metric.path)}
                className={`bg-white rounded-lg border border-gray-200 p-6 text-left transition-all ${
                  metric.path ? 'hover:border-indigo-300 hover:shadow-sm cursor-pointer' : 'cursor-default'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-ink-muted">{metric.label}</p>
                </div>
                <div className="mt-4">
                  <p className="font-serif text-3xl font-semibold text-navy">{metric.value}</p>
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
            {t.createSurvey}
          </button>
        </div>

        {/* Active Survey Overview */}
        {activeSurvey ? (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 md:px-6 py-4 border-b border-gray-200">
              <h3 className="text-base md:text-lg font-semibold text-gray-900">{t.activeSurveys}</h3>
              <p className="text-sm text-gray-500 mt-1">{t.currentResearchProjectOverview}</p>
            </div>
            
            <div className="p-4 md:p-6">
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-2">{t.surveyTitle}</p>
                <p className="text-lg md:text-xl font-semibold text-gray-900">
                  {activeSurvey.title}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 mb-2">{t.shareableSurveyLink}</p>
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
                  <button
                    onClick={() => setIsQRModalOpen(true)}
                    className="p-2.5 border border-gray-300 hover:bg-white rounded-lg transition-colors self-center sm:self-auto"
                    title="View QR Code"
                  >
                    <QrCode className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
                {copied && (
                  <p className="text-sm text-green-600 mt-2">{t.linkCopied}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{t.language} ({t.responses})</p>
                  <p className="text-base font-medium text-gray-900">{languageBreakdown(languageCounts)}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-1">{t.totalResponses}</p>
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
            <h3 className="text-base md:text-lg font-semibold text-gray-900">{t.recentActivity}</h3>
          </div>
          
          <div className="p-4 md:p-6">
            <div className="space-y-4">
              {recentActivity.length === 0 ? (
                <div className="text-sm text-gray-600">{t.noActivity}</div>
              ) : (
                recentActivity.map((item, idx) => (
                  <div
                    key={`${item.label}-${idx}`}
                    className={`flex items-start gap-3 ${idx < recentActivity.length - 1 ? 'pb-4 border-b border-gray-100' : ''}`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-2 ${item.tone === 'primary' ? 'bg-indigo-600' : 'bg-gray-300'}`}
                    ></div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{item.when}</p>
                    </div>
                  </div>
                ))
              )}
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

      {/* QR Code Modal */}
      {isQRModalOpen && activeSurvey && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">QR Code</h2>
              <button
                onClick={() => setIsQRModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 text-center">
              <QRCodeSVG
                id={`dashboard-qrcode-${activeSurvey.id}`}
                value={surveyLink}
                size={256}
                level="H"
                includeMargin={true}
              />
              <p className="text-xs text-gray-500 mt-4 mb-6">{activeSurvey.title}</p>
              
              <div className="flex gap-3">
                <button
                  onClick={downloadQRCode}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => setIsQRModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
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
