import React, { useState, createContext, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export const AdminLanguageContext = createContext<{
  language: 'en' | 'ru' | 'fr' | 'es';
  setLanguage: (lang: 'en' | 'ru' | 'fr' | 'es') => void;
}>({
  language: 'en',
  setLanguage: () => {},
});

export default function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarVisible, setIsDesktopSidebarVisible] = useState(() => {
    const saved = localStorage.getItem('adminSidebarVisible');
    return saved !== null ? saved === 'true' : true;
  });
  const [language, setLanguage] = useState<'en' | 'ru' | 'fr' | 'es'>('en');

  useEffect(() => {
    localStorage.setItem('adminSidebarVisible', String(isDesktopSidebarVisible));
  }, [isDesktopSidebarVisible]);

  return (
    <AdminLanguageContext.Provider value={{ language, setLanguage }}>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)}
          onOpen={() => setIsSidebarOpen(true)}
          isDesktopVisible={isDesktopSidebarVisible}
          onDesktopToggle={() => setIsDesktopSidebarVisible(!isDesktopSidebarVisible)}
        />
        
        {/* Overlay for mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
          />
        )}
        
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          {/* Mobile Header */}
          <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-semibold text-gray-900">Survey Research</h1>
            </div>
            <div className="w-8" /> {/* Spacer for centering */}
          </div>
          
          <Outlet />
        </div>
      </div>
    </AdminLanguageContext.Provider>
  );
}