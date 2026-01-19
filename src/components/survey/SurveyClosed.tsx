import React from 'react';
import { XCircle } from 'lucide-react';

export default function SurveyClosed() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            Survey Closed
          </h1>
          
          <p className="text-gray-600 mb-2">
            This survey is currently not accepting responses.
          </p>
          
          <p className="text-gray-600 mb-6">
            Thank you for your interest in participating!
          </p>
          
          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              If you believe this is an error, please contact the survey administrator.
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">Internal Survey Research Project</p>
        </div>
      </div>
    </div>
  );
}
