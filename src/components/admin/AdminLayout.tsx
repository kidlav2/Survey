import React, { useState, createContext, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { isLng, type Lng } from '../../lib/cn';

export const AdminLanguageContext = createContext<{
  language: Lng;
  setLanguage: (lang: Lng) => void;
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
  const [language, setLanguage] = useState<Lng>(() => {
    const saved = localStorage.getItem('ui_lng');
    return isLng(saved) ? saved : 'en';
  });

  useEffect(() => {
    localStorage.setItem('adminSidebarVisible', String(isDesktopSidebarVisible));
  }, [isDesktopSidebarVisible]);

  useEffect(() => {
    localStorage.setItem('ui_lng', language);
  }, [language]);

  return (
    <AdminLanguageContext.Provider value={{ language, setLanguage }}>
      <div className="flex min-h-dvh bg-canvas text-ink">
        <a href="#admin-main" className="skip-link">
          Skip to content
        </a>
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isDesktopVisible={isDesktopSidebarVisible}
          onDesktopToggle={() => setIsDesktopSidebarVisible(!isDesktopSidebarVisible)}
        />

        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-ink/40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-canvas px-4 py-3 lg:hidden">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="min-h-11 min-w-11 text-ink"
              aria-label="Open menu"
            >
              <svg className="mx-auto size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <p className="font-serif text-base font-semibold text-navy">Survey Research</p>
            <span className="w-11" />
          </div>
          <div id="admin-main" className="flex-1">
            <Outlet />
          </div>
        </div>
      </div>
    </AdminLanguageContext.Provider>
  );
}
