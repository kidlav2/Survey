import React from 'react';

export default function SkeletonDashboard() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="h-4 bg-gray-300 rounded w-24 mb-3"></div>
            <div className="h-8 bg-gray-300 rounded w-16 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-32"></div>
          </div>
        ))}
      </div>

      {/* Surveys Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
            {/* Title */}
            <div className="h-6 bg-gray-300 rounded w-3/4 mb-3"></div>
            
            {/* Description */}
            <div className="space-y-2 mb-4">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
            
            {/* Stats */}
            <div className="flex gap-4 mb-4 pt-4 border-t border-gray-200">
              <div className="flex-1">
                <div className="h-3 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-5 bg-gray-300 rounded w-8"></div>
              </div>
              <div className="flex-1">
                <div className="h-3 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-5 bg-gray-300 rounded w-8"></div>
              </div>
              <div className="flex-1">
                <div className="h-3 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-5 bg-gray-300 rounded w-12"></div>
              </div>
            </div>
            
            {/* Buttons */}
            <div className="flex gap-2">
              <div className="flex-1 h-9 bg-gray-300 rounded"></div>
              <div className="flex-1 h-9 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
