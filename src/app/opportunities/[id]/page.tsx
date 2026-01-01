'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, HealthSystem, Opportunity, Contact, OutreachLog, OPPORTUNITY_STATUSES, OpportunityStatus } from '@/lib/supabase';
import Link from 'next/link';

type ContactFormData = {
  name: string;
  role: string;
  email: string;
  phone: string;
  notes: string;
  cadence_days: number;
};

const emptyContactForm: ContactFormData = {
  name: '',
  role: '',
  email: '',
  phone: '',
  notes: '',
  cadence_days: 10,
};

type ContactWithOutreach = Contact & {
  last_contact_date: string | null;
  last_contact_method: string | null;
  days_since_contact: number | null;
};

export default function OpportunityDetailPage() {
  const params = useParams();
  const opportunityId = params.id as string;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [account, setAccount] = useState<HealthSystem | null>(null);
  const [contacts, setContacts] = useState<ContactWithOutreach[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(emptyContactForm);
  const [saving, setSaving] = useState(false);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [logNotes, setLogNotes] = useState<Record<string, string>>({});
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchData = async () => {
    const { data: oppData, error: oppError } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', opportunityId)
      .single();

    if (oppError) {
      console.error('Error fetching opportunity:', oppError);
      setLoading(false);
      return;
    }

    setOpportunity(oppData);

    const { data: accountData } = await supabase
      .from('health_systems')
      .select('*')
      .eq('id', oppData.health_system_id)
      .single();

    setAccount(accountData);

    const { data: contactsData } = await supabase
      .from('contacts')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('name');

    const { data: logsData } = await supabase
      .from('outreach_logs')
      .select('*')
      .order('contact_date', { ascending: false });

    const lastOutreach: Record<string, { date: string; method: string }> = {};
    (logsData || []).forEach((log: OutreachLog) => {
      if (!lastOutreach[log.contact_id]) {
        lastOutreach[log.contact_id] = {
          date: log.contact_date,
          method: log.contact_method,
        };
      }
    });

    const enrichedContacts: ContactWithOutreach[] = (contactsData || []).map((contact: Contact) => {
      const last = lastOutreach[contact.id];
      const daysSince = last
        ? Math.floor((Date.now() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        ...contact,
        last_contact_date: last?.date || null,
        last_contact_method: last?.method || null,
        days_since_contact: daysSince,
      };
    });

    setContacts(enrichedContacts);
    setLoading(false);
  };

  useEffect(() => {
    if (opportunityId) {
      fetchData();
    }
  }, [opportunityId]);

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
          cadence_days: formData.cadence_days,
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
        cadence_days: formData.cadence_days,
        opportunity_id: opportunityId,
        health_system_id: opportunity?.health_system_id,
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
      cadence_days: contact.cadence_days || 10,
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

  const logContact = async (contactId: string, method: 'call' | 'email' | 'meeting') => {
    setLoggingId(contactId);
    const notes = logNotes[contactId] || null;

    const { error } = await supabase.from('outreach_logs').insert({
      contact_id: contactId,
      contact_method: method,
      notes,
    });

    if (error) {
      console.error('Error logging contact:', error);
      alert('Failed to log contact');
    } else {
      setLogNotes((prev) => ({ ...prev, [contactId]: '' }));
      await fetchData();
    }
    setLoggingId(null);
  };

  const handleStatusChange = async (newStatus: OpportunityStatus) => {
    if (!opportunity) return;
    setUpdatingStatus(true);

    const { error } = await supabase
      .from('opportunities')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opportunity.id);

    if (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } else {
      setOpportunity({ ...opportunity, status: newStatus });
    }
    setUpdatingStatus(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!opportunity || !account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Opportunity not found</p>
          <Link href="/accounts" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            Back to Accounts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href={`/accounts/${account.id}`} className="text-blue-600 hover:underline text-sm">
          &larr; Back to {account.name}
        </Link>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <h1 className="text-2xl font-bold">{account.name}</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium">
            {opportunity.product}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <p className="text-gray-500 text-sm">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''} for this opportunity
          </p>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Status:</span>
            <select
              value={opportunity.status || 'prospect'}
              onChange={(e) => handleStatusChange(e.target.value as OpportunityStatus)}
              disabled={updatingStatus}
              className={`text-sm px-2 py-1 rounded-lg border transition ${
                opportunity.status === 'prospect'
                  ? 'bg-yellow-50 border-yellow-300 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-300'
                  : opportunity.status === 'active'
                  ? 'bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                  : 'bg-green-50 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300'
              } ${updatingStatus ? 'opacity-50' : ''}`}
            >
              {OPPORTUNITY_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {opportunity.status !== 'prospect' && (
          <p className="text-xs text-gray-400 mt-2">
            ℹ️ This opportunity is marked as &quot;{opportunity.status}&quot; and won&apos;t appear in the daily to-do list.
          </p>
        )}
      </div>

      {/* Add Contact Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="mb-6 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
        >
          + Add Contact
        </button>
      )}

      {/* Contact Form */}
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
                  placeholder="e.g., john@hospital.org"
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

              <div>
                <label className="block text-sm font-medium mb-1">Cadence (days)</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={formData.cadence_days}
                  onChange={(e) => setFormData({ ...formData, cadence_days: parseInt(e.target.value) || 10 })}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
                <p className="text-xs text-gray-400 mt-1">Days between outreach touches</p>
              </div>

              <div>
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

      {/* Contacts List */}
      {contacts.length === 0 && !showForm ? (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-gray-500 mb-2">No contacts for this opportunity yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-blue-600 hover:underline text-sm"
          >
            Add your first contact
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="border rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold">{contact.name}</h3>
                  {contact.role && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{contact.role}</p>
                  )}
                  {(contact.email || contact.phone) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {contact.email}{contact.email && contact.phone && ' · '}{contact.phone}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                      contact.days_since_contact === null
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : contact.days_since_contact >= (contact.cadence_days || 10)
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : contact.days_since_contact >= (contact.cadence_days || 10) * 0.7
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}
                  >
                    {contact.days_since_contact === null
                      ? 'Never contacted'
                      : contact.days_since_contact === 0
                      ? 'Today'
                      : `${contact.days_since_contact}d ago`}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">{contact.cadence_days || 10}d cadence</p>
                </div>
              </div>

              {/* Quick Log Buttons */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => logContact(contact.id, 'email')}
                  disabled={loggingId === contact.id}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>✉️</span> Email
                </button>
                <button
                  onClick={() => logContact(contact.id, 'call')}
                  disabled={loggingId === contact.id}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>📞</span> Call
                </button>
                <button
                  onClick={() => logContact(contact.id, 'meeting')}
                  disabled={loggingId === contact.id}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>🤝</span> Meeting
                </button>
                <div className="flex-1" />
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

              <input
                type="text"
                placeholder="Add notes (optional)"
                value={logNotes[contact.id] || ''}
                onChange={(e) =>
                  setLogNotes((prev) => ({ ...prev, [contact.id]: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
