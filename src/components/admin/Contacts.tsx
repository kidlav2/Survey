import React, { useState, useEffect } from 'react';
import { Search, Download, Mail, CheckCircle, Users } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import Toast from '../common/Toast';

interface Contact {
  id: string;
  email: string;
  created_at: string;
  opted_in: boolean;
}

interface ContactStats {
  totalContacts: number;
  optInRate: number;
  thisWeek: number;
}

export default function Contacts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<ContactStats>({ totalContacts: 0, optInRate: 0, thisWeek: 0 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Not authenticated');

      // Fetch contacts (emails from responses)
      const { data: responses, error: responsesError } = await supabase
        .from('responses')
        .select('id, email, created_at, opted_in, survey_id')
        .not('email', 'is', null)
        .order('created_at', { ascending: false });

      if (responsesError) throw responsesError;

      // Filter contacts for user's surveys only
      const { data: surveys, error: surveysError } = await supabase
        .from('surveys')
        .select('id')
        .eq('owner_id', user.id);

      if (surveysError) throw surveysError;

      const surveyIds = surveys?.map(s => s.id) || [];
      const userContacts = responses?.filter(r => surveyIds.includes(r.survey_id)) || [];

      setContacts(userContacts as Contact[]);

      // Calculate stats
      const totalContacts = userContacts.length;
      const optedInCount = userContacts.filter(c => c.opted_in).length;
      const optInRate = totalContacts > 0 ? Math.round((optedInCount / totalContacts) * 100) : 0;

      // Count this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const thisWeekCount = userContacts.filter(c => 
        new Date(c.created_at) > oneWeekAgo
      ).length;

      setStats({
        totalContacts,
        optInRate,
        thisWeek: thisWeekCount,
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading contacts:', error);
      setToast({ message: 'Failed to load contacts', type: 'error' });
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportContacts = async () => {
    try {
      const csv = [
        ['Email', 'Date Collected', 'Opted In'],
        ...contacts.map(c => [
          c.email,
          new Date(c.created_at).toLocaleString(),
          c.opted_in ? 'Yes' : 'No'
        ])
      ]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      setToast({ message: 'Contacts exported successfully', type: 'success' });
    } catch (error) {
      console.error('Error exporting contacts:', error);
      setToast({ message: 'Failed to export contacts', type: 'error' });
    }
  };

  if (loading) {
    return (
      <main className="flex-1">
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900">Contacts</h2>
        </header>
        <div className="p-4 md:p-8 flex items-center justify-center min-h-screen">
          <div className="text-gray-600">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-semibold text-gray-900">Contacts</h2>
            <p className="text-sm text-gray-500 mt-1">Manage collected email addresses</p>
          </div>
          <button 
            onClick={exportContacts}
            className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors font-medium"
          >
            <Download className="w-4 h-4" />
            Export Contacts
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-4 md:p-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Mail className="w-5 h-5 text-indigo-600" />
              </div>
              <p className="text-sm text-gray-600">Total Contacts</p>
            </div>
            <p className="text-2xl md:text-3xl font-semibold text-gray-900">{stats.totalContacts}</p>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">Opt-in Rate</p>
            </div>
            <p className="text-2xl md:text-3xl font-semibold text-gray-900">{stats.optInRate}%</p>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600">This Week</p>
            </div>
            <p className="text-2xl md:text-3xl font-semibold text-gray-900">{stats.thisWeek}</p>
          </div>
        </div>

        {/* Contacts List */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-200">
            <h3 className="text-base md:text-lg font-semibold text-gray-900">Contact List</h3>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden">
            {filteredContacts.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No contacts found</div>
            ) : (
              filteredContacts.map((contact) => (
                <div key={contact.id} className="p-4 border-b border-gray-200 last:border-b-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{contact.email}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date(contact.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      contact.opted_in
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {contact.opted_in ? 'Opted In' : 'No Opt-in'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">From: Survey Opt-in</p>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date Collected
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      No contacts found
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {contact.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        Survey Opt-in
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {new Date(contact.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            contact.opted_in
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {contact.opted_in ? 'Opted In' : 'No Opt-in'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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