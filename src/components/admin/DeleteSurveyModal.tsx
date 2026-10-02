import React, { useContext } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AdminLanguageContext } from './AdminLayout';
import { adminTranslations } from './adminTranslations';

interface DeleteSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  surveyTitle: string;
  isDeleting?: boolean;
}

export default function DeleteSurveyModal({ isOpen, onClose, onConfirm, surveyTitle, isDeleting = false }: DeleteSurveyModalProps) {
  const { language } = useContext(AdminLanguageContext);
  const t = adminTranslations[language];
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-6 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{t.deleteSurvey}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            disabled={isDeleting}
            aria-label={t.close}
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
                {t.deleteSurveyConfirm}
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                {t.deleteSurveyForever}
              </p>
              <p className="text-sm font-medium text-gray-900 mb-3">
                “{surveyTitle}”
              </p>
              <p className="text-sm text-gray-600">
                {t.cannotUndo}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors"
              disabled={isDeleting}
            >
              {t.cancel}
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isDeleting ? t.deleting : t.deleteSurvey}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
