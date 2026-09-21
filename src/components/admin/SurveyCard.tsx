import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, CheckCircle, ExternalLink, Trash2, QrCode, X, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

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
  onToggleStatus: (id: string, newStatus: 'active' | 'draft') => void;
  shared?: boolean;
  canDelete?: boolean;
}

export default function SurveyCard({ survey, onDelete, onToggleStatus, shared = false, canDelete = true }: SurveyCardProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = React.useState(false);
  const [isToggling, setIsToggling] = React.useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = React.useState(false);

  const { id, title, status, responses, lastActivity, link } = survey;
  const fullLink = link;
  const isActive = status === 'Active';

  const downloadQRCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    const svg = document.getElementById(`card-qrcode-${id}`);
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
      downloadLink.download = `survey-qr-${id}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

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

  const handleSendSurvey = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(`Survey with ID ${id} sent!`);
    // Add your logic to send the survey here
  };

  const handleToggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isToggling) return;
    
    setIsToggling(true);
    const newStatus = isActive ? 'draft' : 'active';
    await onToggleStatus(id, newStatus);
    setIsToggling(false);
  };

  const statusColors = {
    Active: 'bg-green-100 text-green-800',
    Disabled: 'bg-gray-100 text-gray-800',
  };

  return (
    <div 
      onClick={() => navigate(`/admin/surveys/${id}`)}
      className={`bg-white rounded-lg border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer relative ${isQRModalOpen ? 'z-50' : 'z-0'}`}
    >
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate" title={title}>{title}</h3>
          <div className="text-sm text-gray-600">
            <span>{responses} responses</span>
            {shared && <span className="ml-2 text-indigo-700">· Shared with you</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status]}`}>
            {status === 'Active' && <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>}
            {status === 'Disabled' && <div className="w-2 h-2 bg-red-600 rounded-full mr-2"></div>}
            {status}
          </span>
          <button
            onClick={handleToggleStatus}
            disabled={isToggling}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
              isActive ? 'bg-green-600' : 'bg-gray-300'
            }`}
            title={isActive ? 'Disable survey' : 'Enable survey'}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsQRModalOpen(true);
            }}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
            title="View QR Code"
          >
            <QrCode className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {canDelete && (
        <button
          onClick={handleDelete}
          className="px-3 py-2 border border-red-100 hover:bg-red-50 text-red-600 rounded-lg transition-colors flex-shrink-0"
          title="Delete survey"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        )}
        
        <button
          onClick={handleManage}
          className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center"
        >
          Manage Survey
        </button>
      </div>

      {/* QR Code Modal */}
      {isQRModalOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 cursor-default"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            e.stopPropagation();
            setIsQRModalOpen(false);
          }}
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
                  id={`card-qrcode-${id}`}
                  value={fullLink}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-sm font-semibold text-gray-900 text-center truncate w-full px-2">
                {title}
              </p>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col gap-2">
              <button
                onClick={downloadQRCode}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-bold shadow-sm"
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
    </div>
  );
}