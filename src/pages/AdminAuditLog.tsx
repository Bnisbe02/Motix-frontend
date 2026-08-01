// SOC2 CC6 — Audit log viewer
// This page reads from access_log via the Supabase anon client.
// To enable data access, add an RLS policy in Supabase:
//   CREATE POLICY "Admin reads audit log"
//   ON access_log FOR SELECT TO authenticated
//   USING (auth.jwt()->>'email' = 'beats@fibrecast.com.au');

import { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { SkeletonBlock } from '../components/Skeleton';

const ADMIN_EMAIL = 'beats@fibrecast.com.au';

interface AuditLogEntry {
  id: string;
  user_email: string;
  event_type: string;
  resource: string;
  metadata: Record<string, unknown>;
  ip_address: string;
  created_at: string;
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#4131e0] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function AdminAuditLog() {
  const { user, isLoading: authLoading } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterEmail, setFilterEmail] = useState<string>('');
  const [filterEvent, setFilterEvent] = useState<string>('');

  useEffect(() => {
    const fetchAuditLog = async (): Promise<void> => {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from('access_log')
        .select('id, user_email, event_type, resource, metadata, ip_address, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (fetchError) {
        setError('Failed to load audit log.');
      } else {
        setEntries(data ?? []);
      }
      setIsLoading(false);
    };

    void fetchAuditLog();
  }, []);

  const handleEmailFilterChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setFilterEmail(e.target.value);
  };

  const handleEventFilterChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setFilterEvent(e.target.value);
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesEmail = filterEmail === '' || entry.user_email.toLowerCase().includes(filterEmail.toLowerCase());
      const matchesEvent = filterEvent === '' || entry.event_type === filterEvent;
      return matchesEmail && matchesEvent;
    });
  }, [entries, filterEmail, filterEvent]);

  if (authLoading) return <LoadingSpinner />;
  if (!user || user.email !== ADMIN_EMAIL) {
    return <Navigate to="/app/campaigns" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#191715] text-white py-6 px-8">
        <h1 className="text-heading-2">Audit Log</h1>
        <p className="text-body-sm text-gray-400 mt-1">SOC2 CC6 — authenticated data access events</p>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center gap-4 flex-wrap">
          <input
            type="text"
            placeholder="Filter by email..."
            value={filterEmail}
            onChange={handleEmailFilterChange}
            className="border border-gray-300 rounded-lg px-4 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0] flex-1 min-w-[200px]"
          />
          <select
            value={filterEvent}
            onChange={handleEventFilterChange}
            className="border border-gray-300 rounded-lg px-4 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
          >
            <option value="">All events</option>
            <option value="chat_query">chat_query</option>
            <option value="report_access">report_access</option>
          </select>
          <span className="text-label text-gray-500">
            {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-body-sm text-amber-800">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-label text-gray-500 text-left px-4 py-3">Timestamp (AEST)</th>
                  <th className="text-label text-gray-500 text-left px-4 py-3">User</th>
                  <th className="text-label text-gray-500 text-left px-4 py-3">Event</th>
                  <th className="text-label text-gray-500 text-left px-4 py-3">Resource</th>
                  <th className="text-label text-gray-500 text-left px-4 py-3">IP Address</th>
                  <th className="text-label text-gray-500 text-left px-4 py-3">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={`skeleton-${index}`} className="border-b border-gray-100">
                      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-32" /></td>
                      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-40" /></td>
                      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-28" /></td>
                      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-48" /></td>
                    </tr>
                  ))
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <p className="text-body-sm text-gray-500">
                        No audit events found. Events are recorded when authenticated users query detection data.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => {
                    const timestamp = new Date(entry.created_at).toLocaleString('en-AU', {
                      timeZone: 'Australia/Sydney',
                    });
                    const metadataEntries = Object.entries(entry.metadata);

                    return (
                      <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-body-sm">{timestamp}</td>
                        <td className="px-4 py-3 text-body-sm">{entry.user_email}</td>
                        <td className="px-4 py-3 text-body-sm">{entry.event_type}</td>
                        <td className="px-4 py-3 text-body-sm">{entry.resource}</td>
                        <td className="px-4 py-3 text-body-sm">{entry.ip_address}</td>
                        <td className="px-4 py-3">
                          <div className="text-label text-gray-500 space-y-1">
                            {metadataEntries.map(([key, value]) => (
                              <div key={key}>
                                {key}={String(value)}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
