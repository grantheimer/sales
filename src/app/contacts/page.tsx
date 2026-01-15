'use client';

import { useEffect, useState } from 'react';
import { supabase, Contact, HealthSystem, Opportunity, ContactOpportunity } from '@/lib/supabase';
import Link from 'next/link';
import ContactEditModal from '@/components/ContactEditModal';

type OpportunityWithCadence = Opportunity & { cadence_days: number; assignment_id: string };

type ContactWithDetails = Contact & {
  health_system: HealthSystem;
  opportunities: OpportunityWithCadence[];
};

type SortColumn = 'name' | 'role' | 'account' | 'email' | null;

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting state - default to Name A-Z
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit modal state
  const [editingContact, setEditingContact] = useState<ContactWithDetails | null>(null);

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

    const { data: assignmentsData } = await supabase
      .from('contact_opportunities')
      .select('*');

    const accountsMap: Record<string, HealthSystem> = {};
    (accountsData || []).forEach((a: HealthSystem) => {
      accountsMap[a.id] = a;
    });

    const oppsMap: Record<string, Opportunity> = {};
    (oppsData || []).forEach((o: Opportunity) => {
      oppsMap[o.id] = o;
    });

    // Build a map of contact_id -> opportunities with cadence
    const contactOppsMap: Record<string, OpportunityWithCadence[]> = {};
    (assignmentsData || []).forEach((assignment: ContactOpportunity) => {
      const opp = oppsMap[assignment.opportunity_id];
      if (opp) {
        if (!contactOppsMap[assignment.contact_id]) {
          contactOppsMap[assignment.contact_id] = [];
        }
        contactOppsMap[assignment.contact_id].push({
          ...opp,
          cadence_days: assignment.cadence_days,
          assignment_id: assignment.id,
        });
      }
    });

    const enrichedContacts: ContactWithDetails[] = (contactsData || []).map((contact: Contact) => ({
      ...contact,
      health_system: accountsMap[contact.health_system_id],
      opportunities: contactOppsMap[contact.id] || [],
    }));

    setContacts(enrichedContacts);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This removes their outreach history.`)) {
      return;
    }

    const { error } = await supabase.from('contacts').delete().eq('id', id);

    if (error) {
      console.error('Error deleting contact:', error);
      alert('Failed to delete contact');
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await fetchData();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const count = selectedIds.size;
    if (!confirm(`Delete ${count} contact${count !== 1 ? 's' : ''}? This removes their outreach history.`)) {
      return;
    }

    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('contacts').delete().in('id', ids);

    if (error) {
      console.error('Error deleting contacts:', error);
      alert('Failed to delete contacts');
    } else {
      setSelectedIds(new Set());
      await fetchData();
    }
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const clearSort = () => {
    setSortColumn(null);
    setSortDirection('asc');
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Get sorted/grouped contacts
  const getSortedContacts = (): ContactWithDetails[] | Record<string, ContactWithDetails[]> => {
    if (sortColumn === null) {
      // Group by account, alphabetized
      const contactsByAccount: Record<string, ContactWithDetails[]> = {};
      contacts.forEach((contact) => {
        const accountId = contact.health_system_id;
        if (!contactsByAccount[accountId]) {
          contactsByAccount[accountId] = [];
        }
        contactsByAccount[accountId].push(contact);
      });

      // Sort contacts within each account by name
      Object.values(contactsByAccount).forEach((accountContacts) => {
        accountContacts.sort((a, b) => a.name.localeCompare(b.name));
      });

      return contactsByAccount;
    }

    // Flatten and sort by column
    const sorted = [...contacts].sort((a, b) => {
      let aVal: string;
      let bVal: string;

      switch (sortColumn) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'role':
          aVal = a.role || '';
          bVal = b.role || '';
          break;
        case 'account':
          aVal = a.health_system?.name || '';
          bVal = b.health_system?.name || '';
          break;
        case 'email':
          aVal = a.email || '';
          bVal = b.email || '';
          break;
        default:
          return 0;
      }

      const comparison = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  };

  const formatOpportunities = (opportunities: OpportunityWithCadence[]): string => {
    if (opportunities.length === 0) return '—';
    return opportunities.map((opp) => opp.product).join(', ');
  };

  const SortableHeader = ({
    column,
    label,
  }: {
    column: SortColumn;
    label: string;
  }) => (
    <th
      onClick={() => handleSort(column)}
      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider select-none"
    >
      <span className="flex items-center gap-1">
        {label}
        {sortColumn === column ? (
          <span className="text-blue-600">{sortDirection === 'asc' ? '▲' : '▼'}</span>
        ) : (
          <span className="text-gray-300 dark:text-gray-600">▲</span>
        )}
      </span>
    </th>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  const sortedData = getSortedContacts();
  const isGrouped = sortColumn === null;
  const accountIds = isGrouped
    ? Object.keys(sortedData as Record<string, ContactWithDetails[]>).sort((a, b) => {
        const nameA = (sortedData as Record<string, ContactWithDetails[]>)[a][0]?.health_system?.name || '';
        const nameB = (sortedData as Record<string, ContactWithDetails[]>)[b][0]?.health_system?.name || '';
        return nameA.localeCompare(nameB);
      })
    : [];

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-gray-500 text-sm">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''} across{' '}
            {new Set(contacts.map((c) => c.health_system_id)).size} account
            {new Set(contacts.map((c) => c.health_system_id)).size !== 1 ? 's' : ''}
          </p>
        </div>
        {sortColumn !== null && (
          <button
            onClick={clearSort}
            className="text-sm text-blue-600 hover:underline"
          >
            Clear sort (group by account)
          </button>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-4">
        To add contacts, go to an account and add them to a specific opportunity.
      </p>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4 flex items-center justify-between">
          <span className="text-sm">
            {selectedIds.size} contact{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleBulkDelete}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          >
            Delete Selected
          </button>
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-gray-500 mb-2">No contacts yet</p>
          <Link href="/accounts" className="text-blue-600 hover:underline text-sm">
            Go to Accounts to add opportunities and contacts
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-xl bg-white dark:bg-gray-800 shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-3 py-2 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === contacts.length && contacts.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </th>
                <SortableHeader column="name" label="Name" />
                <SortableHeader column="role" label="Role" />
                <SortableHeader column="account" label="Account" />
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Opportunities
                </th>
                <SortableHeader column="email" label="Email" />
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isGrouped ? (
                // Grouped view
                accountIds.map((accountId) => {
                  const accountContacts = (sortedData as Record<string, ContactWithDetails[]>)[accountId];
                  const accountName = accountContacts[0]?.health_system?.name || 'Unknown';

                  return (
                    <>
                      {/* Account header row */}
                      <tr key={`header-${accountId}`} className="bg-gray-100 dark:bg-gray-750">
                        <td colSpan={7} className="px-3 py-2">
                          <span className="font-semibold text-sm">{accountName}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            ({accountContacts.length} contact{accountContacts.length !== 1 ? 's' : ''})
                          </span>
                        </td>
                      </tr>
                      {/* Contact rows */}
                      {accountContacts.map((contact) => (
                        <ContactRow
                          key={contact.id}
                          contact={contact}
                          isSelected={selectedIds.has(contact.id)}
                          onToggleSelect={() => toggleSelect(contact.id)}
                          onEdit={() => setEditingContact(contact)}
                          onDelete={() => handleDelete(contact.id, contact.name)}
                          formatOpportunities={formatOpportunities}
                        />
                      ))}
                    </>
                  );
                })
              ) : (
                // Flat sorted view
                (sortedData as ContactWithDetails[]).map((contact) => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    isSelected={selectedIds.has(contact.id)}
                    onToggleSelect={() => toggleSelect(contact.id)}
                    onEdit={() => setEditingContact(contact)}
                    onDelete={() => handleDelete(contact.id, contact.name)}
                    formatOpportunities={formatOpportunities}
                    showAccount
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editingContact && (
        <ContactEditModal
          contact={editingContact}
          onClose={() => setEditingContact(null)}
          onSave={fetchData}
        />
      )}
    </div>
  );
}

// Extracted row component for reuse
function ContactRow({
  contact,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
  formatOpportunities,
  showAccount = false,
}: {
  contact: ContactWithDetails;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  formatOpportunities: (opportunities: OpportunityWithCadence[]) => string;
  showAccount?: boolean;
}) {
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="rounded border-gray-300 dark:border-gray-600"
        />
      </td>
      <td className="px-3 py-2 text-sm font-medium">{contact.name}</td>
      <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
        {contact.role || '—'}
      </td>
      <td className="px-3 py-2 text-sm">
        {showAccount ? (
          contact.health_system?.name || '—'
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
        {formatOpportunities(contact.opportunities)}
      </td>
      <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
        {contact.email || '—'}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="px-2 py-1 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
