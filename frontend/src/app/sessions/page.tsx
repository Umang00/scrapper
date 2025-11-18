'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Key, CheckCircle, XCircle } from 'lucide-react';

interface Session {
  id: string;
  platform: string;
  account_identifier: string;
  credential_type: string;
  is_valid: boolean;
  last_validated_at: string | null;
  created_at: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    const response = await apiClient.listSessions();

    if (response.status === 'success' && response.data) {
      setSessions(response.data as Session[]);
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Authentication Sessions</h1>
        <p className="text-gray-600 mt-2">
          Manage platform authentication credentials and sessions
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Key className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Sessions</h3>
          <p className="text-gray-600">Upload credentials to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Platform
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Account
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Last Validated
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {session.platform}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {session.account_identifier}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {session.credential_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {session.is_valid ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        Valid
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle className="w-4 h-4" />
                        Invalid
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {session.last_validated_at
                      ? new Date(session.last_validated_at).toLocaleString()
                      : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="font-semibold mb-2 text-yellow-900">Note</h3>
        <p className="text-sm text-yellow-800">
          Session upload functionality will be added in the next iteration. For now,
          use the API endpoint directly to upload credentials.
        </p>
      </div>
    </div>
  );
}
