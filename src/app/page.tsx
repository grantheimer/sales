'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, Contact, HealthSystem, ContactWithDetails } from '@/lib/supabase';
import Link from 'next/link';

export default function Dashboard() {
  const [contacts, setContacts] = useState<ContactWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [logNotes, setLogNotes] = useState<Record<string, string>>({});
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  };

  const fetchContacts = async () => {
    // Fetch all contacts with their health system
    const { data: contactsData, error: contactsError } = await supabase
      .from('contacts')
      .select(`
        *,
        health_systems (*)
      `)
      .order('name');

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
      setLoading(false);
      return;
    }

    // Get all outreach logs to calculate last contact dates
    const { data: allLogs } = await supabase
      .from('outreach_logs')
      .select('contact_id, contact_date, contact_method')
      .order('contact_date', { ascending: false });

    // Build a map of contact_id -> last outreach
    const contactLastOutreach: Record<string, { date: string; method: string }> = {};
    // Build a map of health_system_id -> last outreach (any contact)
    const accountLastOutreach: Record<string, string> = {};

    // First pass: build contact -> last outreach map
    (allLogs || []).forEach((log) => {
      if (!contactLastOutreach[log.contact_id]) {
        contactLastOutreach[log.contact_id] = {
          date: log.contact_date,
          method: log.contact_method,
        };
      }
    });

    // Map contacts to their health system IDs for account-level calculation
    const contactToHealthSystem: Record<string, string> = {};
    (contactsData || []).forEach((contact: Contact & { health_systems: HealthSystem }) => {
      contactToHealthSystem[contact.id] = contact.health_system_id;
    });

    // Second pass: build account -> last outreach map
    (allLogs || []).forEach((log) => {
      const healthSystemId = contactToHealthSystem[log.contact_id];
      if (healthSystemId && !accountLastOutreach[healthSystemId]) {
        accountLastOutreach[healthSystemId] = log.contact_date;
      }
    });

    // Enrich contacts with last contact info
    const enrichedContacts: ContactWithDetails[] = (contactsData || []).map(
      (contact: Contact & { health_systems: HealthSystem }) => {
        const lastOutreach = contactLastOutreach[contact.id];
        const lastContactDate = lastOutreach?.date || null;
        const daysSinceContact = lastContactDate
          ? Math.floor((Date.now() - new Date(lastContactDate).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        const accountLastDate = accountLastOutreach[contact.health_system_id];
        const daysSinceAccountContact = accountLastDate
          ? Math.floor((Date.now() - new Date(accountLastDate).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        return {
          ...contact,
          health_system: contact.health_systems,
          last_contact_date: lastContactDate,
          last_contact_method: lastOutreach?.method || null,
          days_since_contact: daysSinceContact,
          days_since_account_contact: daysSinceAccountContact,
        };
      }
    );

    setContacts(enrichedContacts);
    setLoading(false);
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const logContact = async (contactId: string, method: 'call' | 'email' | 'meeting') => {
    setLoggingId(contactId);
    const notes = logNotes[contactId] || null;

    const { error } = await supabase.from('outreach_logs').insert({
      contact_id: contactId,
      contact_method: method,
      notes: notes,
    });

    if (error) {
      console.error('Error logging contact:', error);
      alert('Failed to log contact');
    } else {
      setLogNotes((prev) => ({ ...prev, [contactId]: '' }));
      await fetchContacts();
    }
    setLoggingId(null);
  };

  // Filter to show contacts due for outreach (14+ days or never contacted)
  const dueContacts = contacts.filter(
    (c) => c.days_since_contact === null || c.days_since_contact >= 14
  );

  // Sort by most overdue first (never contacted at top, then by days)
  const sortedDueContacts = dueContacts.sort((a, b) => {
    if (a.days_since_contact === null && b.days_since_contact === null) return 0;
    if (a.days_since_contact === null) return -1;
    if (b.days_since_contact === null) return 1;
    return b.days_since_contact - a.days_since_contact;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Today&apos;s Outreach</h1>
        <div className="flex gap-2">
          <Link
            href="/contacts"
            className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            All Contacts
          </Link>
          <Link
            href="/accounts"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Accounts
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {sortedDueContacts.length === 0 ? (
        <div className="text-center py-12 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-xl text-green-700 dark:text-green-300">All caught up! No outreach due today.</p>
          <Link href="/contacts" className="text-blue-600 hover:underline mt-2 inline-block">
            Add contacts to track
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {sortedDueContacts.length} contact{sortedDueContacts.length !== 1 ? 's' : ''} due for outreach
          </p>

          {sortedDueContacts.map((contact) => (
            <div
              key={contact.id}
              className="border rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-xl font-semibold">{contact.name}</h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {contact.role && `${contact.role} at `}
                    <span className="font-medium">{contact.health_system?.name}</span>
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <span
                    className={`inline-block px-2 py-1 rounded text-sm ${
                      contact.days_since_contact === null
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : contact.days_since_contact >= 21
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                    }`}
                  >
                    {contact.days_since_contact === null
                      ? 'Never contacted'
                      : `${contact.days_since_contact} days ago`}
                  </span>
                  <p className="text-xs text-gray-500">
                    Account: {contact.days_since_account_contact === null
                      ? 'never'
                      : `${contact.days_since_account_contact}d ago`}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => logContact(contact.id, 'call')}
                  disabled={loggingId === contact.id}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1"
                >
                  <span>📞</span> Call
                </button>
                <button
                  onClick={() => logContact(contact.id, 'email')}
                  disabled={loggingId === contact.id}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1"
                >
                  <span>✉️</span> Email
                </button>
                <button
                  onClick={() => logContact(contact.id, 'meeting')}
                  disabled={loggingId === contact.id}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-1"
                >
                  <span>🤝</span> Meeting
                </button>
              </div>

              <input
                type="text"
                placeholder="Add notes (optional) - e.g., 'left voicemail'"
                value={logNotes[contact.id] || ''}
                onChange={(e) =>
                  setLogNotes((prev) => ({ ...prev, [contact.id]: e.target.value }))
                }
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
