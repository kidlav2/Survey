import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Inbox, Users, Settings, X } from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
  { icon: FileText, label: 'Surveys', path: '/admin/surveys' },
  { icon: Inbox, label: 'Responses', path: '/admin/responses' },
  { icon: Users, label: 'Contacts', path: '/admin/contacts' },
  { icon: Settings, label: 'Settings', path: '/admin/settings' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 min-h-screen flex-shrink-0 flex-col">
        <div className="p-6">
          <h1 className="text-xl font-semibold text-gray-900">Survey Research</h1>
          <p className="text-sm text-gray-500 mt-1">Admin Portal</p>
        </div>
        
        <nav className="px-3 space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-30 transform transition-transform duration-300 ease-in-out lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Survey Research</h1>
            <p className="text-sm text-gray-500 mt-1">Admin Portal</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <button
                key={item.label}
                onClick={() => handleNavigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}