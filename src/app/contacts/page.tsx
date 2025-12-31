'use client';

import { useEffect, useState } from 'react';
import { supabase, Contact, HealthSystem } from '@/lib/supabase';
import Link from 'next/link';

type ContactWithAccount = Contact & {
  health_system: HealthSystem;
};

type ContactFormData = {
  name: string;
  role: string;
  email: string;
  phone: string;
  notes: string;
  health_system_id: string;
};

const emptyContactForm: ContactFormData = {
  name: '',
  role: '',
  email: '',
  phone: '',
  notes: '',
  health_system_id: '',
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactWithAccount[]>([]);
  const [accounts, setAccounts] = useState<HealthSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(emptyContactForm);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const { data: contactsData, error: contactsError } = await supabase
      .from('contacts')
      .select(`
        *,
        health_systems (*)
      `)
      .order('name');

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
    } else {
      const mappedContacts = (contactsData || []).map((c: Contact & { health_systems: HealthSystem }) => ({
        ...c,
        health_system: c.health_systems,
      }));
      setContacts(mappedContacts);
    }

    const { data: accountsData, error: accountsError } = await supabase
      .from('health_systems')
      .select('*')
      .order('name');

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
    } else {
      setAccounts(accountsData || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from('contacts')
        .update({
          name: formData.name,
          role: formData.role || null,
          email: formData.email || null,
          phone: formData.phone || null,
          notes: formData.notes || null,
          health_system_id: formData.health_system_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);

      if (error) {
        console.error('Error updating contact:', error);
        alert('Failed to update contact');
      }
    } else {
      const { error } = await supabase.from('contacts').insert({
        name: formData.name,
        role: formData.role || null,
        email: formData.email || null,
        phone: formData.phone || null,
        notes: formData.notes || null,
        health_system_id: formData.health_system_id,
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

  const handleEdit = (contact: ContactWithAccount) => {
    setFormData({
      name: contact.name,
      role: contact.role || '',
      email: contact.email || '',
      phone: contact.phone || '',
      notes: contact.notes || '',
      health_system_id: contact.health_system_id,
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

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-gray-500 text-sm">{contacts.length} contact{contacts.length !== 1 ? 's' : ''} across {accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            + Add New
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
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Account <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.health_system_id}
                  onChange={(e) => setFormData({ ...formData, health_system_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="">Select an account...</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                {accounts.length === 0 && (
                  <p className="text-sm text-yellow-600 mt-1">
                    No accounts yet. <Link href="/accounts" className="underline">Create an account first</Link>.
                  </p>
                )}
              </div>

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
                disabled={saving || accounts.length === 0}
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
          <p className="text-gray-500 mb-2">No contacts yet</p>
          {accounts.length > 0 ? (
            <button
              onClick={() => setShowForm(true)}
              className="text-blue-600 hover:underline text-sm"
            >
              Add your first contact
            </button>
          ) : (
            <Link href="/accounts" className="text-blue-600 hover:underline text-sm">
              Create an account first
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="border rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold">{contact.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {contact.role && `${contact.role} at `}
                    <Link
                      href={`/accounts/${contact.health_system_id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {contact.health_system?.name}
                    </Link>
                  </p>
                  {(contact.email || contact.phone) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {contact.email}{contact.email && contact.phone && ' · '}{contact.phone}
                    </p>
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
