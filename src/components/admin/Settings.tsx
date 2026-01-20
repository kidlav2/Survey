import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Toast from '../common/Toast';
import SkeletonDashboard from '../common/SkeletonDashboard';
import { adminTranslations } from './adminTranslations';
import { AdminLanguageContext } from './AdminLayout';

export default function Settings() {
  const navigate = useNavigate();
  const { language } = useContext(AdminLanguageContext);
  const t = adminTranslations[language];
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Not authenticated');

      setEmail(user.email || '');
      setFullName(user.user_metadata?.full_name || '');
      setOrganization(user.user_metadata?.organization || '');
      setLoading(false);
    } catch (error) {
      console.error('Error loading user data:', error);
      setToast({ message: t.failedToLoadUserData, type: 'error' });
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          organization: organization,
        },
      });

      if (error) throw error;

      setToast({ message: t.profileUpdated, type: 'success' });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setToast({ message: error?.message || t.failedToUpdateProfile, type: 'error' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setToast({ message: t.passwordsDoNotMatch, type: 'error' });
      return;
    }

    if (newPassword.length < 6) {
      setToast({ message: 'Password must be at least 6 characters', type: 'error' });
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setToast({ message: t.passwordUpdated, type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error updating password:', error);
      setToast({ message: error?.message || t.failedToUpdatePassword, type: 'error' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      setToast({ message: t.failedToLogout, type: 'error' });
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      t.deleteAccountConfirm
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      
      // Delete user account via a database function (RPC)
      // This is necessary because supabase.auth.admin.deleteUser is server-side only
      const { error } = await supabase.rpc('delete_user_account');

      if (error) throw error;

      // Sign out locally after successful deletion
      await supabase.auth.signOut();

      setToast({ message: t.accountDeleted, type: 'success' });
      setTimeout(() => navigate('/login'), 1500);
    } catch (error: any) {
      console.error('Error deleting account:', error);
      setToast({ message: error?.message || t.failedToDeleteAccount, type: 'error' });
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1">
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900">{t.settingsPage}</h2>
        </header>
        <div className="p-4 md:p-8">
          <SkeletonDashboard />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900">{t.settingsPage}</h2>
          <p className="text-sm text-gray-500 mt-1">{t.profileSettings}</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium"
        >
          {t.logout}
        </button>
      </header>

      {/* Main Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-4xl">
          {/* Profile Settings */}
          <div className="bg-white rounded-lg border border-gray-200 mb-6">
            <div className="px-4 md:px-6 py-4 border-b border-gray-200">
              <h3 className="text-base md:text-lg font-semibold text-gray-900">{t.profileSettings}</h3>
              <p className="text-sm text-gray-500 mt-1">{t.profileUpdated}</p>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div className="p-4 md:p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t.fullName}
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={isSavingProfile}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t.email}
                    </label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.organization}
                  </label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isSavingProfile}
                  />
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSavingProfile ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {t.save}...
                      </>
                    ) : (
                      t.save
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Password Settings */}
          <div className="bg-white rounded-lg border border-gray-200 mb-6">
            <div className="px-4 md:px-6 py-4 border-b border-gray-200">
              <h3 className="text-base md:text-lg font-semibold text-gray-900">{t.updatePassword}</h3>
              <p className="text-sm text-gray-500 mt-1">{t.securitySettings}</p>
            </div>

            <form onSubmit={handleUpdatePassword}>
              <div className="p-4 md:p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.newPassword}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isUpdatingPassword}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.confirmPassword}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isUpdatingPassword}
                    required
                  />
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isUpdatingPassword ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {t.updatePassword}...
                      </>
                    ) : (
                      t.updatePassword
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="bg-white rounded-lg border border-red-200">
            <div className="px-4 md:px-6 py-4 border-b border-red-200 bg-red-50">
              <h3 className="text-base md:text-lg font-semibold text-red-900">{t.deleteAccount}</h3>
              <p className="text-sm text-red-600 mt-1">{t.deleteAccountWarning}</p>
            </div>

            <div className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.deleteAccount}</p>
                  <p className="text-sm text-gray-500">{t.deleteAccountWarning}</p>
                </div>
                <button
                  onClick={handleDeleteAccount}
                  className="px-4 py-2 border border-red-600 hover:bg-red-50 text-red-600 rounded-lg transition-colors font-medium self-start sm:self-auto"
                >
                  {t.deleteAccount}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={true}
          onClose={() => setToast(null)}
        />
      )}
    </main>
  );
}