import React from 'react';

export default function SkeletonResponseTable() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
      {/* Table Header */}
      <div className="flex items-center gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="w-4 h-4 bg-gray-300 rounded flex-shrink-0"></div>
        <div className="flex-1 h-4 bg-gray-300 rounded w-24"></div>
        <div className="flex-1 h-4 bg-gray-300 rounded w-32"></div>
        <div className="flex-1 h-4 bg-gray-300 rounded w-24"></div>
        <div className="w-10 h-4 bg-gray-300 rounded"></div>
      </div>

      {/* Table Rows */}
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-200 hover:bg-gray-50">
          <div className="w-4 h-4 bg-gray-200 rounded flex-shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-2 bg-gray-100 rounded w-1/2"></div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div className="flex gap-1">
            <div className="w-8 h-8 bg-gray-200 rounded"></div>
            <div className="w-8 h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
