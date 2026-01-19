import React from 'react';

export default function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center gap-3 p-4 bg-gray-50">
        <div className="w-5 h-5 bg-gray-300 rounded flex-shrink-0"></div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 bg-gray-300 rounded w-24"></div>
          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
        </div>
        <div className="w-5 h-5 bg-gray-300 rounded flex-shrink-0"></div>
      </div>
    </div>
  );
}
