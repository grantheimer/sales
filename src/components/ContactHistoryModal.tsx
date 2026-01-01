'use client';

import { useEffect, useState } from 'react';
import { supabase, OutreachLog } from '@/lib/supabase';

type ContactHistoryModalProps = {
  contactId: string;
  contactName: string;
  onClose: () => void;
  onDelete?: () => void;
};

export default function ContactHistoryModal({
  contactId,
  contactName,
  onClose,
  onDelete,
}: ContactHistoryModalProps) {
  const [logs, setLogs] = useState<OutreachLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('outreach_logs')
      .select('*')
      .eq('contact_id', contactId)
      .order('contact_date', { ascending: false });

    if (error) {
      console.error('Error fetching logs:', error);
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [contactId]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleDelete = async (logId: string) => {
    if (!confirm('Delete this outreach entry?')) return;
    
    setDeletingId(logId);
    const { error } = await supabase
      .from('outreach_logs')
      .delete()
      .eq('id', logId);

    if (error) {
      console.error('Error deleting log:', error);
      alert('Failed to delete entry');
    } else {
      await fetchLogs();
      onDelete?.();
    }
    setDeletingId(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'email':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
            ✉️ Email
          </span>
        );
      case 'call':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
            📞 Call
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {method}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[80vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold">{contactName}</h2>
            <p className="text-sm text-gray-500">Outreach History</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Close"
          >
            <span className="text-xl text-gray-400">×</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-gray-500">No outreach history yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Log your first email or call to start tracking
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {formatDate(log.contact_date)}
                      </span>
                      {getMethodBadge(log.contact_method)}
                    </div>
                    {log.notes && (
                      <p className="text-sm text-gray-500 mt-1 break-words">
                        {log.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(log.id)}
                    disabled={deletingId === log.id}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
                    aria-label="Delete entry"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-400 text-center">
            {logs.length} outreach {logs.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
      </div>
    </div>
  );
}

