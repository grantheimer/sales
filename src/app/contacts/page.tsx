'use client';

import { useEffect, useState } from 'react';
import { supabase, Contact, HealthSystem, Opportunity } from '@/lib/supabase';
import Link from 'next/link';

type ContactWithDetails = Contact & {
  health_system: HealthSystem;
  opportunity: Opportunity | null;
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This removes their outreach history.`)) {
      return;
    }

    const { error } = await supabase.from('contacts').delete().eq('id', id);

    if (error) {
      console.error('Error deleting contact:', error);
      alert('Failed to delete contact');
    } else {
      await fetchData();
    }
  };

  const fetchData = async () => {
    const { data: contactsData } = await supabase
      .from('contacts')
      .select('*')
      .order('name');

    const { data: accountsData } = await supabase
      .from('health_systems')
      .select('*');

    const { data: oppsData } = await supabase
      .from('opportunities')
      .select('*');

    const accountsMap: Record<string, HealthSystem> = {};
    (accountsData || []).forEach((a: HealthSystem) => {
      accountsMap[a.id] = a;
    });

    const oppsMap: Record<string, Opportunity> = {};
    (oppsData || []).forEach((o: Opportunity) => {
      oppsMap[o.id] = o;
    });

    const enrichedContacts: ContactWithDetails[] = (contactsData || []).map((contact: Contact) => ({
      ...contact,
      health_system: accountsMap[contact.health_system_id],
      opportunity: contact.opportunity_id ? oppsMap[contact.opportunity_id] : null,
    }));

    setContacts(enrichedContacts);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  // Group contacts by account
  const contactsByAccount: Record<string, ContactWithDetails[]> = {};
  contacts.forEach((contact) => {
    const accountId = contact.health_system_id;
    if (!contactsByAccount[accountId]) {
      contactsByAccount[accountId] = [];
    }
    contactsByAccount[accountId].push(contact);
  });

  const accountIds = Object.keys(contactsByAccount).sort((a, b) => {
    const nameA = contactsByAccount[a][0]?.health_system?.name || '';
    const nameB = contactsByAccount[b][0]?.health_system?.name || '';
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-gray-500 text-sm">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''} across {accountIds.length} account{accountIds.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        To add contacts, go to an account and add them to a specific opportunity.
      </p>

      {contacts.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-gray-500 mb-2">No contacts yet</p>
          <Link href="/accounts" className="text-blue-600 hover:underline text-sm">
            Go to Accounts to add opportunities and contacts
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {accountIds.map((accountId) => {
            const accountContacts = contactsByAccount[accountId];
            const accountName = accountContacts[0]?.health_system?.name || 'Unknown';

            return (
              <div key={accountId}>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="font-semibold text-lg">{accountName}</h2>
                  <span className="text-sm text-gray-500">
                    ({accountContacts.length} contact{accountContacts.length !== 1 ? 's' : ''})
                  </span>
                </div>

                <div className="space-y-2">
                  {accountContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="border rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{contact.name}</h3>
                            {contact.opportunity && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                {contact.opportunity.product}
                              </span>
                            )}
                          </div>
                          {contact.role && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">{contact.role}</p>
                          )}
                          {(contact.email || contact.phone) && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {contact.email}{contact.email && contact.phone && ' · '}{contact.phone}
                            </p>
                          )}
                          {!contact.opportunity_id && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                              No opportunity
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {contact.opportunity_id && (
                            <Link
                              href={`/opportunities/${contact.opportunity_id}`}
                              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                              View
                            </Link>
                          )}
                          <button
                            onClick={() => handleDelete(contact.id, contact.name)}
                            className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
