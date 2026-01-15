import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning';
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, isVisible, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
  };

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  };

  const iconStyles = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-yellow-600',
  };

  const Icon = icons[type];

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${styles[type]} min-w-[300px] max-w-md`}>
        <Icon className={`w-5 h-5 flex-shrink-0 ${iconStyles[type]}`} />
        <p className="text-sm font-medium flex-1">{message}</p>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/50 rounded transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
