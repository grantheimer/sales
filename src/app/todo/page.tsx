'use client';

import { useEffect, useState } from 'react';
import { supabase, Contact, HealthSystem, Opportunity, OutreachLog } from '@/lib/supabase';
import Link from 'next/link';
import ContactHistoryModal from '@/components/ContactHistoryModal';
import { buildLlmPromptForContact } from '@/lib/emailPrompt';

type ContactWithDueInfo = Contact & {
  health_system: HealthSystem;
  opportunity: Opportunity;
  last_contact_date: string | null;
  days_since_contact: number | null;
  days_overdue: number;
  due_date: string;
  is_rollover: boolean;
};

type OutreachSelection = {
  emailed: boolean;
  called: boolean;
  notes: string;
};

// Helper: Check if a date is a business day (Mon-Fri)
function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 0 = Sunday, 6 = Saturday
}

// Helper: Get the next business day from a given date
function getNextBusinessDay(fromDate: Date): Date {
  const next = new Date(fromDate);
  next.setDate(next.getDate() + 1);
  while (!isBusinessDay(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

// Helper: Count business days between two dates (not including start, including end)
function countBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  current.setDate(current.getDate() + 1);
  
  while (current <= endDate) {
    if (isBusinessDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// Helper: Add business days to a date
function addBusinessDays(startDate: Date, businessDays: number): Date {
  const result = new Date(startDate);
  let daysAdded = 0;
  
  while (daysAdded < businessDays) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) {
      daysAdded++;
    }
  }
  return result;
}

// Helper: Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper: Format date for display
function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'short', 
    day: 'numeric' 
  });
}

export default function TodoPage() {
  const [todayContacts, setTodayContacts] = useState<ContactWithDueInfo[]>([]);
  const [nextDayContacts, setNextDayContacts] = useState<ContactWithDueInfo[]>([]);
  const [nextBusinessDay, setNextBusinessDay] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBusinessDayToday, setIsBusinessDayToday] = useState(true);
  
  // Selection state for each contact
  const [selections, setSelections] = useState<Record<string, OutreachSelection>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Per-contact LLM prompt state
  const [promptEdits, setPromptEdits] = useState<Record<string, string>>({});
  const [openPromptIds, setOpenPromptIds] = useState<Record<string, boolean>>({});
  const [copiedContactId, setCopiedContactId] = useState<string | null>(null);
  
  // History modal state
  const [historyContactId, setHistoryContactId] = useState<string | null>(null);
  const [historyContactName, setHistoryContactName] = useState<string>('');

  const fetchData = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if today is a business day
    const isBizDay = isBusinessDay(today);
    setIsBusinessDayToday(isBizDay);
    
    // Calculate next business day
    const nextBizDay = getNextBusinessDay(today);
    setNextBusinessDay(nextBizDay);

    // Get all opportunities with health systems
    const { data: allOppsData } = await supabase
      .from('opportunities')
      .select('*, health_systems(*)');

    // Filter to prospects (status is 'prospect' or null/undefined for backwards compatibility)
    const oppsData = (allOppsData || []).filter(
      (o: Opportunity) => !o.status || o.status === 'prospect'
    );

    // Get contacts for prospect opportunities
    const prospectOppIds = (oppsData || []).map((o: Opportunity) => o.id);
    
    if (prospectOppIds.length === 0) {
      setTodayContacts([]);
      setNextDayContacts([]);
      setLoading(false);
      return;
    }

    const { data: contactsData } = await supabase
      .from('contacts')
      .select('*')
      .in('opportunity_id', prospectOppIds);

    // Get all outreach logs
    const { data: logsData } = await supabase
      .from('outreach_logs')
      .select('*')
      .order('contact_date', { ascending: false });

    // Build maps
    const oppsMap: Record<string, Opportunity & { health_systems: HealthSystem }> = {};
    (oppsData || []).forEach((opp: Opportunity & { health_systems: HealthSystem }) => {
      oppsMap[opp.id] = opp;
    });

    // Find last outreach for each contact (any type counts)
    const lastOutreach: Record<string, { date: string; method: string }> = {};
    (logsData || []).forEach((log: OutreachLog) => {
      if (!lastOutreach[log.contact_id]) {
        lastOutreach[log.contact_id] = {
          date: log.contact_date,
          method: log.contact_method,
        };
      }
    });

    // Calculate due dates and build contact list
    const allDueContacts: ContactWithDueInfo[] = [];

    (contactsData || []).forEach((contact: Contact) => {
      const opp = oppsMap[contact.opportunity_id || ''];
      if (!opp) return;

      const last = lastOutreach[contact.id];
      let dueDate: Date;
      let daysSinceContact: number | null = null;

      if (last) {
        // Calculate due date based on last contact + cadence
        const lastContactDate = new Date(last.date);
        lastContactDate.setHours(0, 0, 0, 0);
        daysSinceContact = Math.floor((today.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Due date is last contact date + cadence_days (in business days)
        dueDate = addBusinessDays(lastContactDate, contact.cadence_days || 10);
      } else {
        // Never contacted - due today (or first business day if weekend)
        dueDate = isBizDay ? today : nextBizDay;
      }

      const dueDateStr = formatDate(dueDate);
      const daysOverdue = countBusinessDays(dueDate, today);
      const isRollover = dueDate < today && isBizDay;

      allDueContacts.push({
        ...contact,
        health_system: opp.health_systems,
        opportunity: opp,
        last_contact_date: last?.date || null,
        days_since_contact: daysSinceContact,
        days_overdue: daysOverdue,
        due_date: dueDateStr,
        is_rollover: isRollover,
      });
    });

    // Filter for today's contacts (due today or overdue/rollover)
    const todaysDue = allDueContacts
      .filter(c => {
        const dueDate = new Date(c.due_date);
        dueDate.setHours(0, 0, 0, 0);
        // Due today or overdue
        return dueDate <= today;
      })
      .sort((a, b) => {
        // Rollovers first, then by days overdue, then by account name
        if (a.is_rollover !== b.is_rollover) return a.is_rollover ? -1 : 1;
        if (a.days_overdue !== b.days_overdue) return b.days_overdue - a.days_overdue;
        return a.health_system.name.localeCompare(b.health_system.name);
      });

    // Filter for next business day's contacts
    const nextDaysDue = allDueContacts
      .filter(c => {
        const dueDate = new Date(c.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return formatDate(dueDate) === formatDate(nextBizDay);
      })
      .sort((a, b) => a.health_system.name.localeCompare(b.health_system.name));

    setTodayContacts(todaysDue);
    setNextDayContacts(nextDaysDue);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleSelection = (contactId: string, field: 'emailed' | 'called') => {
    setSelections(prev => ({
      ...prev,
      [contactId]: {
        emailed: prev[contactId]?.emailed || false,
        called: prev[contactId]?.called || false,
        notes: prev[contactId]?.notes || '',
        [field]: !prev[contactId]?.[field],
      },
    }));
  };

  const updateNotes = (contactId: string, notes: string) => {
    setSelections(prev => ({
      ...prev,
      [contactId]: {
        emailed: prev[contactId]?.emailed || false,
        called: prev[contactId]?.called || false,
        notes,
      },
    }));
  };

  const handleSubmit = async (contactId: string) => {
    const selection = selections[contactId];
    if (!selection?.emailed && !selection?.called) {
      alert('Please select at least one action (Emailed or Called)');
      return;
    }

    setSubmittingId(contactId);

    const logs: { contact_id: string; contact_method: string; notes: string | null }[] = [];
    
    if (selection.emailed) {
      logs.push({
        contact_id: contactId,
        contact_method: 'email',
        notes: selection.notes || null,
      });
    }
    
    if (selection.called) {
      logs.push({
        contact_id: contactId,
        contact_method: 'call',
        notes: selection.notes || null,
      });
    }

    const { error } = await supabase.from('outreach_logs').insert(logs);

    if (error) {
      console.error('Error logging outreach:', error);
      alert('Failed to log outreach');
    } else {
      // Clear selection and refresh
      setSelections(prev => {
        const newSelections = { ...prev };
        delete newSelections[contactId];
        return newSelections;
      });
      await fetchData();
    }
    
    setSubmittingId(null);
  };

  const openHistory = (contactId: string, contactName: string) => {
    setHistoryContactId(contactId);
    setHistoryContactName(contactName);
  };

  const closeHistory = () => {
    setHistoryContactId(null);
    setHistoryContactName('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  // Non-business day view
  if (!isBusinessDayToday) {
    return (
      <div className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Daily To-Do</h1>
          <p className="text-gray-500 text-sm">Outreach activities for today</p>
        </div>

        <div className="text-center py-12 sm:py-16 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="text-5xl mb-4">🏖️</div>
          <p className="text-xl font-medium text-gray-700 dark:text-gray-300">No Activities Due Today</p>
          <p className="text-gray-500 mt-2">It&apos;s the weekend! Enjoy your time off.</p>
        </div>

        {nextBusinessDay && nextDayContacts.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <p className="text-blue-700 dark:text-blue-300 font-medium">
              📅 Next business day: {formatDisplayDate(nextBusinessDay)}
            </p>
            <p className="text-blue-600 dark:text-blue-400 text-sm mt-1">
              {nextDayContacts.length} action{nextDayContacts.length !== 1 ? 's' : ''} due
            </p>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/dashboard" className="text-blue-600 hover:underline text-sm">
            View Dashboard →
          </Link>
        </div>
      </div>
    );
  }

  // All activities completed view
  if (todayContacts.length === 0) {
    return (
      <div className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Daily To-Do</h1>
          <p className="text-gray-500 text-sm">Outreach activities for today</p>
        </div>

        <div className="text-center py-12 sm:py-16 bg-green-50 dark:bg-green-900/20 rounded-xl">
          <div className="text-5xl mb-4">🎉</div>
          <p className="text-xl font-medium text-green-700 dark:text-green-300">
            All of today&apos;s activities have been completed!
          </p>
          <p className="text-gray-500 mt-2">Great work staying on top of your outreach.</p>
        </div>

        {nextBusinessDay && nextDayContacts.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <p className="text-blue-700 dark:text-blue-300 font-medium">
              📅 Next business day: {formatDisplayDate(nextBusinessDay)}
            </p>
            <p className="text-blue-600 dark:text-blue-400 text-sm mt-1">
              {nextDayContacts.length} action{nextDayContacts.length !== 1 ? 's' : ''} due
            </p>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/dashboard" className="text-blue-600 hover:underline text-sm">
            View Dashboard →
          </Link>
        </div>
      </div>
    );
  }

  // Regular view with today's activities
  const rolloverCount = todayContacts.filter(c => c.is_rollover).length;

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Daily To-Do</h1>
        <p className="text-gray-500 text-sm">Outreach activities for today</p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <p className="text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-lg text-blue-600">{todayContacts.length}</span>
            {' '}action{todayContacts.length !== 1 ? 's' : ''} to complete
          </p>
          {rolloverCount > 0 && (
            <span className="text-sm px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
              {rolloverCount} rollover
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {todayContacts.map((contact) => {
          const selection = selections[contact.id] || { emailed: false, called: false, notes: '' };
          const hasSelection = selection.emailed || selection.called;

          const defaultPrompt = buildLlmPromptForContact(contact);
          const prompt = promptEdits[contact.id] ?? defaultPrompt;
          const isPromptOpen = openPromptIds[contact.id] ?? false;

          return (
            <div
              key={contact.id}
              className={`border rounded-xl p-4 sm:p-3 bg-gray-800 dark:bg-gray-800 shadow-sm ${
                contact.is_rollover ? 'border-red-400' : 'border-gray-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3 sm:mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => openHistory(contact.id, contact.name)}
                      className="font-semibold text-base sm:text-lg text-white hover:underline text-left"
                    >
                      {contact.name}
                    </button>
                    {contact.is_rollover && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 font-medium">
                        Rollover ({contact.days_overdue}d overdue)
                      </span>
                    )}
                  </div>
                  {contact.role && (
                    <p className="text-sm sm:text-base text-gray-400 mt-0.5">{contact.role}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-sm sm:text-base text-gray-300 dark:text-gray-300">
                      {contact.health_system.name}
                    </span>
                    <span className="text-xs sm:text-sm px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      {contact.opportunity.product}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    {contact.last_contact_date
                      ? `Last: ${new Date(contact.last_contact_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${contact.days_since_contact}d ago)`
                      : 'Never contacted'
                    }
                    {' · '}
                    {contact.cadence_days || 10}d cadence
                  </p>
                </div>
                <Link
                  href={`/opportunities/${contact.opportunity.id}`}
                  className="text-xs sm:text-sm text-blue-400 hover:underline shrink-0"
                >
                  View Opportunity →
                </Link>
              </div>

              {/* Notes */}
              <input
                type="text"
                placeholder="Notes (optional)"
                value={selection.notes}
                onChange={(e) => updateNotes(contact.id, e.target.value)}
                className="w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 mb-3"
              />

              {/* Email Address */}
              <div className="flex items-center gap-2 mb-3">
                {contact.email ? (
                  <>
                    <span className="text-sm text-gray-300">{contact.email}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(contact.email!);
                        } catch (err) {
                          console.error('Failed to copy email', err);
                        }
                      }}
                      className="text-gray-400 hover:text-white transition"
                      title="Copy email"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <span className="text-sm text-gray-500 italic">No email</span>
                )}
              </div>

              {/* LLM prompt for drafting outreach email */}
              <div className="mb-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(prompt);
                        setCopiedContactId(contact.id);
                        setTimeout(() => setCopiedContactId(null), 1500);
                      } catch (err) {
                        console.error('Failed to copy LLM prompt', err);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-gray-700 text-white hover:bg-gray-600"
                  >
                    <span>📋</span>
                    <span>Copy LLM Prompt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenPromptIds((prev) => ({
                        ...prev,
                        [contact.id]: !isPromptOpen,
                      }))
                    }
                    className="text-xs text-blue-300 hover:text-blue-200 hover:underline"
                  >
                    {isPromptOpen ? 'Hide LLM Prompt' : 'Show LLM Prompt'}
                  </button>
                  {copiedContactId === contact.id && (
                    <span className="text-xs text-green-400">Copied!</span>
                  )}
                </div>

                {isPromptOpen && (
                  <div className="mt-2">
                    <textarea
                      value={prompt}
                      onChange={(e) =>
                        setPromptEdits((prev) => ({
                          ...prev,
                          [contact.id]: e.target.value,
                        }))
                      }
                      rows={8}
                      className="w-full text-xs sm:text-sm leading-snug border border-gray-600 rounded-lg bg-gray-900 text-gray-100 p-2 font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Toggle Buttons */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => toggleSelection(contact.id, 'emailed')}
                  className={`flex-1 sm:flex-none px-4 py-3 sm:py-2.5 text-sm sm:text-base font-medium rounded-lg transition flex items-center justify-center gap-1.5 ${
                    selection.emailed
                      ? 'bg-green-600 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {selection.emailed && <span>✓</span>} Emailed
                </button>
                <button
                  onClick={() => toggleSelection(contact.id, 'called')}
                  className={`flex-1 sm:flex-none px-4 py-3 sm:py-2.5 text-sm sm:text-base font-medium rounded-lg transition flex items-center justify-center gap-1.5 ${
                    selection.called
                      ? 'bg-green-600 text-white'
                      : 'bg-orange-500 text-white hover:bg-orange-600'
                  }`}
                >
                  {selection.called && <span>✓</span>} Called
                </button>
              </div>

              {/* Submit Button */}
              <button
                onClick={() => handleSubmit(contact.id)}
                disabled={submittingId === contact.id || !hasSelection}
                className={`w-full py-3 sm:py-2.5 text-sm sm:text-base font-medium rounded-lg transition flex items-center justify-center gap-2 ${
                  hasSelection
                    ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                } disabled:opacity-50`}
              >
                {submittingId === contact.id ? (
                  'Saving...'
                ) : (
                  <>
                    <span>✓</span> Mark Complete
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Next business day preview */}
      {nextBusinessDay && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <p className="text-blue-700 dark:text-blue-300 font-medium">
            📅 Next business day: {formatDisplayDate(nextBusinessDay)}
          </p>
          <p className="text-blue-600 dark:text-blue-400 text-sm mt-1">
            {nextDayContacts.length} action{nextDayContacts.length !== 1 ? 's' : ''} due
          </p>
        </div>
      )}

      {/* History Modal */}
      {historyContactId && (
        <ContactHistoryModal
          contactId={historyContactId}
          contactName={historyContactName}
          onClose={closeHistory}
          onDelete={fetchData}
        />
      )}
    </div>
  );
}
