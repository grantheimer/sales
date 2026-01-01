'use client';

import { useEffect, useState } from 'react';
import { supabase, Contact, HealthSystem, Opportunity, OutreachLog } from '@/lib/supabase';
import Link from 'next/link';

type ContactWithDueInfo = Contact & {
  health_system: HealthSystem;
  opportunity: Opportunity;
  last_contact_date: string | null;
  days_since_contact: number | null;
  days_overdue: number;
  due_date: string;
  is_rollover: boolean;
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

// Helper: Get the previous business day from a given date
function getPreviousBusinessDay(fromDate: Date): Date {
  const prev = new Date(fromDate);
  prev.setDate(prev.getDate() - 1);
  while (!isBusinessDay(prev)) {
    prev.setDate(prev.getDate() - 1);
  }
  return prev;
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
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [logNotes, setLogNotes] = useState<Record<string, string>>({});
  const [isBusinessDayToday, setIsBusinessDayToday] = useState(true);

  const fetchData = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDate(today);
    
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
        dueDate = addBusinessDays(lastContactDate, contact.cadence_days);
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

  const logOutreach = async (contactId: string, method: 'call' | 'email' | 'meeting') => {
    setLoggingId(contactId);
    const notes = logNotes[contactId] || null;

    const { error } = await supabase.from('outreach_logs').insert({
      contact_id: contactId,
      contact_method: method,
      notes,
    });

    if (error) {
      console.error('Error logging outreach:', error);
      alert('Failed to log outreach');
    } else {
      setLogNotes((prev) => ({ ...prev, [contactId]: '' }));
      await fetchData();
    }
    setLoggingId(null);
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
      <div className="min-h-screen p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Daily To-Do</h1>
          <p className="text-gray-500 text-sm">Outreach activities for today</p>
        </div>

        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-xl">
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
      <div className="min-h-screen p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Daily To-Do</h1>
          <p className="text-gray-500 text-sm">Outreach activities for today</p>
        </div>

        <div className="text-center py-16 bg-green-50 dark:bg-green-900/20 rounded-xl">
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
  const dueToday = todayContacts.filter(c => !c.is_rollover).length;

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
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
        {todayContacts.map((contact) => (
          <div
            key={contact.id}
            className={`border rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm ${
              contact.is_rollover ? 'border-red-300 dark:border-red-700' : ''
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold">{contact.name}</h2>
                  {contact.role && (
                    <span className="text-gray-500 text-sm">- {contact.role}</span>
                  )}
                  {contact.is_rollover && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 font-medium">
                      Rollover ({contact.days_overdue}d overdue)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {contact.health_system.name}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    {contact.opportunity.product}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {contact.last_contact_date
                    ? `Last contact: ${new Date(contact.last_contact_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${contact.days_since_contact}d ago)`
                    : 'Never contacted'
                  }
                  {' · '}
                  {contact.cadence_days}d cadence
                </p>
              </div>
              <Link
                href={`/opportunities/${contact.opportunity.id}`}
                className="text-xs text-blue-600 hover:underline"
              >
                View opportunity
              </Link>
            </div>

            <div className="flex gap-2 mb-2">
              <button
                onClick={() => logOutreach(contact.id, 'email')}
                disabled={loggingId === contact.id}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>✉️</span> Email
              </button>
              <button
                onClick={() => logOutreach(contact.id, 'call')}
                disabled={loggingId === contact.id}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>📞</span> Call
              </button>
              <button
                onClick={() => logOutreach(contact.id, 'meeting')}
                disabled={loggingId === contact.id}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>🤝</span> Meeting
              </button>
            </div>

            <input
              type="text"
              placeholder="Notes (optional)"
              value={logNotes[contact.id] || ''}
              onChange={(e) =>
                setLogNotes((prev) => ({ ...prev, [contact.id]: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        ))}
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
    </div>
  );
}
