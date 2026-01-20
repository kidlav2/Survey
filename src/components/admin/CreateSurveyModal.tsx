import React, { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface CreateSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate?: (survey: { id: string; title: string; description: string; status: string }) => void;
}

export default function CreateSurveyModal({ isOpen, onClose, onCreate }: CreateSurveyModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('5');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Survey title is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Not authenticated');

      // Create survey in database
      const { data, error: createError } = await supabase
        .from('surveys')
        .insert([{
          title: title.trim(),
          description: description.trim(),
          estimated_time: parseInt(estimatedTime) || 5,
          owner_id: user.id,
          status: 'draft',
        }])
        .select()
        .single();

      if (createError) throw createError;

      // Call onCreate callback if provided
      if (onCreate) {
        onCreate({
          id: data.id,
          title: data.title,
          description: data.description,
          status: data.status,
        });
      }
      
      // Reset form
      setTitle('');
      setDescription('');
      setEstimatedTime('5');
      setError(null);
      
      onClose();
    } catch (err: any) {
      console.error('Error creating survey:', err);
      setError(err?.message || 'Failed to create survey');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-6 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New Survey</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Survey Title *
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={isLoading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg 
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="e.g., User Experience Research Survey 2026"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isLoading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg 
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="Brief description of the survey purpose and goals"
            />
          </div>

          <div>
            <label htmlFor="estimatedTime" className="block text-sm font-medium text-gray-700 mb-2">
              Estimated Time to Complete (minutes)
            </label>
            <input
              type="number"
              id="estimatedTime"
              value={estimatedTime}
              onChange={(e) => setEstimatedTime(e.target.value)}
              min="1"
              max="120"
              disabled={isLoading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg 
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="5"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <span className="font-medium">Note:</span> After creating the survey, you can configure 
              questions, logic, and distribution settings in the survey management panel.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </>
              ) : (
                'Create Survey'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
