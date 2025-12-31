'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, HealthSystem, Contact } from '@/lib/supabase';
import Link from 'next/link';

type ContactFormData = {
  name: string;
  role: string;
  email: string;
  phone: string;
  notes: string;
};

const emptyContactForm: ContactFormData = {
  name: '',
  role: '',
  email: '',
  phone: '',
  notes: '',
};

export default function AccountDetailPage() {
  const params = useParams();
  const accountId = params.id as string;

  const [account, setAccount] = useState<HealthSystem | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(emptyContactForm);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const { data: accountData, error: accountError } = await supabase
      .from('health_systems')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accountError) {
      console.error('Error fetching account:', accountError);
      setLoading(false);
      return;
    }

    setAccount(accountData);

    const { data: contactsData, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .eq('health_system_id', accountId)
      .order('name');

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
    } else {
      setContacts(contactsData || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (accountId) {
      fetchData();
    }
  }, [accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from('contacts')
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);

      if (error) {
        console.error('Error updating contact:', error);
        alert('Failed to update contact');
      }
    } else {
      const { error } = await supabase.from('contacts').insert({
        ...formData,
        health_system_id: accountId,
      });

      if (error) {
        console.error('Error creating contact:', error);
        alert('Failed to create contact');
      }
    }

    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyContactForm);
    await fetchData();
  };

  const handleEdit = (contact: Contact) => {
    setFormData({
      name: contact.name,
      role: contact.role || '',
      email: contact.email || '',
      phone: contact.phone || '',
      notes: contact.notes || '',
    });
    setEditingId(contact.id);
    setShowForm(true);
  };

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

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyContactForm);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Account not found</p>
          <Link href="/accounts" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            Back to Accounts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <Link href="/accounts" className="text-blue-600 hover:underline text-sm">
            &larr; Back to Accounts
          </Link>
          <h1 className="text-2xl font-bold mt-1">{account.name}</h1>
          <p className="text-gray-500 text-sm capitalize">
            {account.deal_stage.replace('-', ' ')}
            {account.revenue_potential && ` · ${account.revenue_potential}`}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            + Add Contact
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-6 p-5 border rounded-xl bg-white dark:bg-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Contact' : 'New Contact'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="e.g., John Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Role / Title</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="e.g., VP of Operations"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="e.g., john@mayoclinic.org"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="e.g., (555) 123-4567"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Notes</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Any notes about this contact..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Add Contact'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {contacts.length === 0 && !showForm ? (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-gray-500 mb-2">No contacts at this account yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-blue-600 hover:underline text-sm"
          >
            Add your first contact
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-gray-500 text-sm mb-3">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          </p>

          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="border rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold">{contact.name}</h3>
                  {contact.role && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{contact.role}</p>
                  )}
                  {(contact.email || contact.phone) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {contact.email}{contact.email && contact.phone && ' · '}{contact.phone}
                    </p>
                  )}
                  {contact.notes && (
                    <p className="text-xs text-gray-400 mt-1 italic">{contact.notes}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(contact)}
                    className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    Edit
                  </button>
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
      )}
    </div>
  );
}
