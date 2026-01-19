import React from 'react';

export default function SkeletonQuestionFlow() {
  return (
    <div className="w-full max-w-2xl mx-auto animate-pulse">
      {/* Welcome Section */}
      <div className="text-center mb-8 space-y-4">
        <div className="h-8 bg-gray-300 rounded w-2/3 mx-auto"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6 mx-auto"></div>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <div className="h-4 bg-gray-300 rounded w-20"></div>
            <div className="h-4 bg-gray-300 rounded w-16"></div>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-gray-300"></div>
          </div>
        </div>

        {/* Question Title */}
        <div className="mb-6">
          <div className="h-6 bg-gray-300 rounded w-3/4 mb-2"></div>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-6">
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between gap-3">
          <div className="h-10 bg-gray-200 rounded w-24"></div>
          <div className="h-10 bg-gray-300 rounded w-24"></div>
        </div>
      </div>
    </div>
  );
}
