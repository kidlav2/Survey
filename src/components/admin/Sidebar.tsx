import React, { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Inbox, BarChart3, Users, Settings, X, ChevronLeft, Menu } from 'lucide-react';
import { adminTranslations } from './adminTranslations';
import { AdminLanguageContext } from './AdminLayout';
import { LANGUAGES, cn } from '../../lib/cn';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  isDesktopVisible?: boolean;
  onDesktopToggle?: () => void;
}

export default function Sidebar({ isOpen, onClose, isDesktopVisible = true, onDesktopToggle }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage } = useContext(AdminLanguageContext);
  const t = adminTranslations[language];

  const navItems = [
    { icon: LayoutDashboard, label: t.dashboard, path: '/admin/dashboard' },
    { icon: FileText, label: t.surveys, path: '/admin/surveys' },
    { icon: Inbox, label: t.responses, path: '/admin/responses' },
    { icon: BarChart3, label: t.analytics, path: '/admin/analytics' },
    { icon: Users, label: t.contacts, path: '/admin/contacts' },
    { icon: Settings, label: t.settings, path: '/admin/settings' },
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  const Nav = ({ onItem }: { onItem: (path: string) => void }) => (
    <nav className="min-h-0 space-y-1 overflow-y-auto px-3" aria-label="Admin">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
        return (
          <button
            key={item.path}
            type="button"
            onClick={() => onItem(item.path)}
            className={cn(
              'flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm transition-colors duration-150',
              isActive ? 'bg-sidebar-accent text-surface' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-surface'
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  const Lang = ({ onPick }: { onPick?: () => void }) => (
    <div className="border-t border-sidebar-border p-3">
      <div role="group" aria-label="Language" className="grid grid-cols-4 gap-1">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            aria-pressed={language === lang.code}
            aria-label={lang.name}
            onClick={() => {
              setLanguage(lang.code);
              onPick?.();
            }}
            className={cn(
              'min-h-10 text-xs font-bold tracking-wide',
              language === lang.code ? 'bg-accent text-surface' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent'
            )}
          >
            {lang.short}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {isDesktopVisible && (
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col self-start overflow-hidden bg-navy text-sidebar-foreground lg:flex">
          <div className="flex shrink-0 items-start justify-between gap-2 px-5 py-6">
            <div>
              <p className="font-serif text-xl font-semibold">{t.surveyResearch}</p>
              <p className="mt-1 text-xs tracking-wide text-sidebar-foreground/60">{t.adminPortal}</p>
            </div>
            <button
              type="button"
              onClick={onDesktopToggle}
              className="min-h-10 min-w-10 text-sidebar-foreground/70 hover:text-surface"
              aria-label="Hide sidebar"
            >
              <ChevronLeft className="mx-auto size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Nav onItem={navigate} />
          </div>
          <div className="shrink-0">
            <Lang />
          </div>
        </aside>
      )}

      {!isDesktopVisible && (
        <div className="sticky top-0 z-50 hidden h-dvh w-14 shrink-0 flex-col items-center self-start bg-navy py-4 lg:flex">
          <button
            type="button"
            onClick={() => onDesktopToggle?.()}
            className="min-h-11 min-w-11 text-surface"
            aria-label="Open sidebar"
          >
            <Menu className="mx-auto size-5" />
          </button>
        </div>
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-30 flex max-h-dvh min-h-dvh w-60 flex-col bg-navy text-sidebar-foreground transition-transform duration-200 lg:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-start justify-between px-5 py-6">
          <div>
            <p className="font-serif text-xl font-semibold">{t.surveyResearch}</p>
            <p className="mt-1 text-xs text-sidebar-foreground/60">{t.adminPortal}</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-10 min-w-10" aria-label="Close menu">
            <X className="mx-auto size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Nav onItem={handleNavigate} />
        </div>
        <div className="shrink-0">
          <Lang onPick={onClose} />
        </div>
      </aside>
    </>
  );
}
