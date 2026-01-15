import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface RenameSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTitle: string;
  onSave: (newTitle: string) => void;
}

export default function RenameSurveyModal({ isOpen, onClose, currentTitle, onSave }: RenameSurveyModalProps) {
  const [title, setTitle] = useState(currentTitle);

  useEffect(() => {
    setTitle(currentTitle);
  }, [currentTitle, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSave(title.trim());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Rename Survey</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-6">
            <div>
              <label htmlFor="survey-title" className="block text-sm font-medium text-gray-700 mb-2">
                Survey Title
              </label>
              <input
                id="survey-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter new survey title"
                autoFocus
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 hover:bg-white text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
