import React from 'react';

export default function SkeletonQuestion() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
      {/* Question Header */}
      <div className="flex items-center gap-3 p-4 bg-gray-50">
        <div className="w-5 h-5 bg-gray-300 rounded flex-shrink-0"></div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 bg-gray-300 rounded w-20"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>
        <div className="w-5 h-5 bg-gray-300 rounded flex-shrink-0"></div>
      </div>

      {/* Question Content (Expanded) */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-4">
        {/* Question Text Input */}
        <div>
          <div className="h-4 bg-gray-300 rounded w-24 mb-2"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>

        {/* Question Type Select */}
        <div>
          <div className="h-4 bg-gray-300 rounded w-32 mb-2"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>

        {/* Options */}
        <div>
          <div className="h-4 bg-gray-300 rounded w-24 mb-3"></div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 h-10 bg-gray-200 rounded"></div>
              <div className="w-10 h-10 bg-gray-200 rounded"></div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 h-10 bg-gray-200 rounded"></div>
              <div className="w-10 h-10 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>

        {/* Required Toggle */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="h-4 bg-gray-300 rounded w-32"></div>
          <div className="w-11 h-6 bg-gray-300 rounded-full"></div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t border-gray-200">
          <div className="flex-1 h-9 bg-gray-200 rounded"></div>
          <div className="flex-1 h-9 bg-gray-200 rounded"></div>
          <div className="flex-1 h-9 bg-gray-200 rounded ml-auto"></div>
        </div>
      </div>
    </div>
  );
}
