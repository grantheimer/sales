'use client';

import { useEffect, useState } from 'react';
import { supabase, Contact, HealthSystem, ContactWithDetails } from '@/lib/supabase';
import Link from 'next/link';

export default function TodoPage() {
  const [contacts, setContacts] = useState<ContactWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [logNotes, setLogNotes] = useState<Record<string, string>>({});
  const [loggingId, setLoggingId] = useState<string | null>(null);

  const fetchContacts = async () => {
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

    const { data: allLogs } = await supabase
      .from('outreach_logs')
      .select('contact_id, contact_date, contact_method')
      .order('contact_date', { ascending: false });

    const contactLastOutreach: Record<string, { date: string; method: string }> = {};
    const accountLastOutreach: Record<string, string> = {};

    (allLogs || []).forEach((log) => {
      if (!contactLastOutreach[log.contact_id]) {
        contactLastOutreach[log.contact_id] = {
          date: log.contact_date,
          method: log.contact_method,
        };
      }
    });

    const contactToHealthSystem: Record<string, string> = {};
    (contactsData || []).forEach((contact: Contact & { health_systems: HealthSystem }) => {
      contactToHealthSystem[contact.id] = contact.health_system_id;
    });

    (allLogs || []).forEach((log) => {
      const healthSystemId = contactToHealthSystem[log.contact_id];
      if (healthSystemId && !accountLastOutreach[healthSystemId]) {
        accountLastOutreach[healthSystemId] = log.contact_date;
      }
    });

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

  const dueContacts = contacts.filter(
    (c) => c.days_since_contact === null || c.days_since_contact >= 14
  );

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
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Today&apos;s To-Do</h1>
        <p className="text-gray-500 text-sm">Contacts due for outreach (14+ days since last contact)</p>
      </div>

      {sortedDueContacts.length === 0 ? (
        <div className="text-center py-16 bg-green-50 dark:bg-green-900/20 rounded-xl">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-xl text-green-700 dark:text-green-300 font-medium">All caught up!</p>
          <p className="text-gray-500 mt-1">No outreach due today.</p>
          <Link href="/contacts" className="text-blue-600 hover:underline mt-4 inline-block text-sm">
            Add more contacts to track
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-semibold text-lg">{sortedDueContacts.length}</span>
              {' '}contact{sortedDueContacts.length !== 1 ? 's' : ''} to reach out to
            </p>
          </div>

          {sortedDueContacts.map((contact) => (
            <div
              key={contact.id}
              className="border rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-lg font-semibold">{contact.name}</h2>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {contact.role && `${contact.role} at `}
                    <span className="font-medium">{contact.health_system?.name}</span>
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                      contact.days_since_contact === null
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : contact.days_since_contact >= 21
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                    }`}
                  >
                    {contact.days_since_contact === null
                      ? 'Never contacted'
                      : `${contact.days_since_contact}d overdue`}
                  </span>
                  <p className="text-xs text-gray-400">
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
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>📞</span> Call
                </button>
                <button
                  onClick={() => logContact(contact.id, 'email')}
                  disabled={loggingId === contact.id}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>✉️</span> Email
                </button>
                <button
                  onClick={() => logContact(contact.id, 'meeting')}
                  disabled={loggingId === contact.id}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-1.5"
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
                className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
