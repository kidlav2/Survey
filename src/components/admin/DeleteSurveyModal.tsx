import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  surveyTitle: string;
  isDeleting?: boolean;
}

export default function DeleteSurveyModal({ isOpen, onClose, onConfirm, surveyTitle, isDeleting = false }: DeleteSurveyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Delete Survey</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            disabled={isDeleting}
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                Are you sure you want to delete this survey?
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                You are about to permanently delete:
              </p>
              <p className="text-sm font-medium text-gray-900 mb-3">
                "{surveyTitle}"
              </p>
              <p className="text-sm text-gray-600">
                This action cannot be undone. All survey responses and associated data will be permanently removed.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors"
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Deleting...
                </>
              ) : (
                'Delete Survey'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}