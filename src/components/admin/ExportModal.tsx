import React, { useState } from 'react';
import { X, Download } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'CSV' | 'JSON';
  onExport: () => void;
}

export default function ExportModal({ isOpen, onClose, type, onExport }: ExportModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeResponses: true,
    includeContacts: false,
    dateRange: 'all',
  });

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    // Simulate export delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsExporting(false);
    onExport();
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Export {type}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            disabled={isExporting}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-4">Select what to include in your export:</p>
            
            <div className="space-y-3">
              {/* Include Responses */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeResponses}
                  onChange={(e) => setExportOptions({ ...exportOptions, includeResponses: e.target.checked })}
                  className="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  disabled={isExporting}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Survey Responses</p>
                  <p className="text-xs text-gray-500">All survey response data</p>
                </div>
              </label>

              {/* Include Contacts */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeContacts}
                  onChange={(e) => setExportOptions({ ...exportOptions, includeContacts: e.target.checked })}
                  className="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  disabled={isExporting}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Contact Information</p>
                  <p className="text-xs text-gray-500">Email addresses from opt-ins</p>
                </div>
              </label>
            </div>
          </div>

          {/* Date Range */}
          <div className="pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <select
              value={exportOptions.dateRange}
              onChange={(e) => setExportOptions({ ...exportOptions, dateRange: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isExporting}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 hover:bg-white text-gray-700 rounded-lg text-sm font-medium transition-colors"
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || (!exportOptions.includeResponses && !exportOptions.includeContacts)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download {type}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
