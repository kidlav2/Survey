import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, CheckCircle, ExternalLink, Trash2 } from 'lucide-react';

interface SurveyCardProps {
  survey: {
    id: string;
    title: string;
    status: 'Active' | 'Disabled' | 'Draft';
    responses: number;
    lastActivity: string;
    link: string;
  };
  onDelete: (id: string) => void;
}

export default function SurveyCard({ survey, onDelete }: SurveyCardProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = React.useState(false);

  const { id, title, status, responses, lastActivity, link } = survey;
  const fullLink = `${window.location.origin}${link}`;

  const copyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(fullLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openSurvey = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(fullLink, '_blank');
  };

  const handleManage = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/admin/surveys/${id}`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(id);
  };

  const statusColors = {
    Active: 'bg-green-100 text-green-800',
    Disabled: 'bg-gray-100 text-gray-800',
    Draft: 'bg-amber-100 text-amber-800',
  };

  return (
    <div 
      onClick={() => navigate(`/admin/surveys/${id}`)}
      className="bg-white rounded-lg border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>{responses} responses</span>
            <span>•</span>
            <span>{lastActivity}</span>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status]}`}>
          {status === 'Active' && <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>}
          {status}
        </span>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2">
          <code className="text-xs text-gray-700 flex-1 truncate">{fullLink}</code>
          <button
            onClick={copyToClipboard}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
            title="Copy link"
          >
            {copied ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4 text-gray-600" />
            )}
          </button>
          <button
            onClick={openSurvey}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
            title="Open survey"
          >
            <ExternalLink className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleManage}
          className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Manage Survey
        </button>
        <button
          onClick={handleDelete}
          className="px-3 py-2 border border-red-300 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
          title="Delete survey"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}