'use client';

import { useEffect, useState } from 'react';
import { supabase, Contact, HealthSystem, Opportunity, OutreachLog } from '@/lib/supabase';
import Link from 'next/link';

// Helper: Check if a date is a business day (Mon-Fri)
function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
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

type Stats = {
  totalOpportunities: number;
  prospectOpportunities: number;
  activeOpportunities: number;
  wonOpportunities: number;
  totalAccounts: number;
  totalContacts: number;
  contactsDueToday: number;
  contactsOverdue: number;
  outreachThisWeek: number;
  callsThisWeek: number;
  emailsThisWeek: number;
  meetingsThisWeek: number;
  currentStreak: number;
  recentActivity: Array<{
    contactName: string;
    accountName: string;
    product: string;
    method: string;
    date: string;
    notes: string | null;
  }>;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isBizDay = isBusinessDay(today);

    // Get all opportunities with health systems
    const { data: opportunities } = await supabase
      .from('opportunities')
      .select('*, health_systems(*)');

    // Get all health systems
    const { data: accounts } = await supabase
      .from('health_systems')
      .select('*');

    // Get all contacts
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*');

    // Get all outreach logs
    const { data: logs } = await supabase
      .from('outreach_logs')
      .select('*')
      .order('contact_date', { ascending: false });

    // Calculate dates
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const oppsData = opportunities || [];
    const accountsData = accounts || [];
    const contactsData = contacts || [];
    const logsData = logs || [];

    // Count opportunities by status (treat missing status as 'prospect')
    const prospectOpps = oppsData.filter((o: Opportunity) => !o.status || o.status === 'prospect');
    const activeOpps = oppsData.filter((o: Opportunity) => o.status === 'active');
    const wonOpps = oppsData.filter((o: Opportunity) => o.status === 'won');

    // Build maps
    const contactToOpp: Record<string, string> = {};
    const contactToAccount: Record<string, string> = {};
    const contactMap: Record<string, { name: string; accountName: string; product: string }> = {};
    const oppsMap: Record<string, Opportunity & { health_systems: HealthSystem }> = {};

    oppsData.forEach((o: Opportunity & { health_systems: HealthSystem }) => {
      oppsMap[o.id] = o;
    });

    contactsData.forEach((c: Contact) => {
      if (c.opportunity_id) {
        contactToOpp[c.id] = c.opportunity_id;
        const opp = oppsMap[c.opportunity_id];
        if (opp) {
          contactMap[c.id] = {
            name: c.name,
            accountName: opp.health_systems?.name || 'Unknown',
            product: opp.product,
          };
        }
      }
      contactToAccount[c.id] = c.health_system_id;
    });

    // Find last outreach for each contact
    const lastOutreach: Record<string, { date: string; method: string }> = {};
    logsData.forEach((log: OutreachLog) => {
      if (!lastOutreach[log.contact_id]) {
        lastOutreach[log.contact_id] = {
          date: log.contact_date,
          method: log.contact_method,
        };
      }
    });

    // Calculate contacts due today and overdue (only from prospect opportunities)
    const prospectOppIds = new Set(prospectOpps.map((o: Opportunity) => o.id));
    let contactsDueToday = 0;
    let contactsOverdue = 0;

    contactsData.forEach((contact: Contact) => {
      if (!contact.opportunity_id || !prospectOppIds.has(contact.opportunity_id)) return;

      const last = lastOutreach[contact.id];
      let dueDate: Date;

      if (last) {
        const lastContactDate = new Date(last.date);
        lastContactDate.setHours(0, 0, 0, 0);
        dueDate = addBusinessDays(lastContactDate, contact.cadence_days);
      } else {
        // Never contacted - due today
        dueDate = today;
      }

      if (formatDate(dueDate) === formatDate(today)) {
        contactsDueToday++;
      } else if (dueDate < today) {
        contactsOverdue++;
      }
    });

    // This week's logs
    const thisWeekLogs = logsData.filter((log: OutreachLog) =>
      new Date(log.contact_date) >= startOfWeek
    );

    // Activity breakdown this week
    const callsThisWeek = thisWeekLogs.filter((l: OutreachLog) => l.contact_method === 'call').length;
    const emailsThisWeek = thisWeekLogs.filter((l: OutreachLog) => l.contact_method === 'email').length;
    const meetingsThisWeek = thisWeekLogs.filter((l: OutreachLog) => l.contact_method === 'meeting').length;

    // Calculate streak (consecutive business days with any outreach activity)
    let streak = 0;
    const checkDate = new Date(today);
    checkDate.setHours(0, 0, 0, 0);

    // If today is not a business day, start checking from the last business day
    if (!isBizDay) {
      while (!isBusinessDay(checkDate)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    while (true) {
      const dateStr = formatDate(checkDate);
      const hasOutreach = logsData.some((l: OutreachLog) => l.contact_date === dateStr);
      
      if (hasOutreach) {
        streak++;
        // Move to previous business day
        checkDate.setDate(checkDate.getDate() - 1);
        while (!isBusinessDay(checkDate)) {
          checkDate.setDate(checkDate.getDate() - 1);
        }
      } else {
        break;
      }
    }

    // Recent activity (last 5)
    const recentActivity = logsData.slice(0, 5).map((log: OutreachLog) => ({
      contactName: contactMap[log.contact_id]?.name || 'Unknown',
      accountName: contactMap[log.contact_id]?.accountName || 'Unknown',
      product: contactMap[log.contact_id]?.product || '',
      method: log.contact_method,
      date: log.contact_date,
      notes: log.notes,
    }));

    setStats({
      totalOpportunities: oppsData.length,
      prospectOpportunities: prospectOpps.length,
      activeOpportunities: activeOpps.length,
      wonOpportunities: wonOpps.length,
      totalAccounts: accountsData.length,
      totalContacts: contactsData.length,
      contactsDueToday: isBizDay ? contactsDueToday + contactsOverdue : 0,
      contactsOverdue,
      outreachThisWeek: thisWeekLogs.length,
      callsThisWeek,
      emailsThisWeek,
      meetingsThisWeek,
      currentStreak: streak,
      recentActivity,
    });

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!stats) return null;

  const methodIcons: Record<string, string> = {
    call: '📞',
    email: '✉️',
    meeting: '🤝',
  };

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500 text-sm">Your outreach activity at a glance</p>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Link href="/todo" className="bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Due Today</p>
          <p className={`text-3xl font-bold mt-1 ${
            stats.contactsDueToday === 0 ? 'text-green-600' : 'text-blue-600'
          }`}>
            {stats.contactsDueToday}
          </p>
          <p className="text-xs text-gray-400">
            {stats.contactsOverdue > 0 && (
              <span className="text-red-500">{stats.contactsOverdue} overdue</span>
            )}
            {stats.contactsOverdue === 0 && 'contacts to reach'}
          </p>
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">This Week</p>
          <p className="text-3xl font-bold mt-1">{stats.outreachThisWeek}</p>
          <p className="text-xs text-gray-400">total outreach</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Streak</p>
          <p className="text-3xl font-bold mt-1">{stats.currentStreak}</p>
          <p className="text-xs text-gray-400">{stats.currentStreak === 1 ? 'day' : 'days'} in a row</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Prospects</p>
          <p className="text-3xl font-bold mt-1">{stats.prospectOpportunities}</p>
          <p className="text-xs text-gray-400">active opportunities</p>
        </div>
      </div>

      {/* Activity Breakdown & Summary */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Activity Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border shadow-sm">
          <h3 className="font-semibold mb-4">This Week&apos;s Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">✉️</span>
                <span className="text-gray-600 dark:text-gray-300">Emails</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min((stats.emailsThisWeek / Math.max(stats.outreachThisWeek, 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="font-medium w-8 text-right">{stats.emailsThisWeek}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📞</span>
                <span className="text-gray-600 dark:text-gray-300">Calls</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${Math.min((stats.callsThisWeek / Math.max(stats.outreachThisWeek, 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="font-medium w-8 text-right">{stats.callsThisWeek}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🤝</span>
                <span className="text-gray-600 dark:text-gray-300">Meetings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{ width: `${Math.min((stats.meetingsThisWeek / Math.max(stats.outreachThisWeek, 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="font-medium w-8 text-right">{stats.meetingsThisWeek}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border shadow-sm">
          <h3 className="font-semibold mb-4">Pipeline Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Total Opportunities</span>
              <span className="font-medium">{stats.totalOpportunities}</span>
            </div>
            <div className="flex justify-between pl-4 text-sm">
              <span className="text-yellow-600 dark:text-yellow-400">Prospect</span>
              <span className="font-medium">{stats.prospectOpportunities}</span>
            </div>
            <div className="flex justify-between pl-4 text-sm">
              <span className="text-blue-600 dark:text-blue-400">Active</span>
              <span className="font-medium">{stats.activeOpportunities}</span>
            </div>
            <div className="flex justify-between pl-4 text-sm">
              <span className="text-green-600 dark:text-green-400">Won</span>
              <span className="font-medium">{stats.wonOpportunities}</span>
            </div>
            <div className="border-t pt-3 mt-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Accounts</span>
                <span className="font-medium">{stats.totalAccounts}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-600 dark:text-gray-300">Contacts</span>
                <span className="font-medium">{stats.totalContacts}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border shadow-sm">
        <h3 className="font-semibold mb-4">Recent Activity</h3>
        {stats.recentActivity.length === 0 ? (
          <p className="text-gray-500 text-sm">No recent activity. Start reaching out!</p>
        ) : (
          <div className="space-y-3">
            {stats.recentActivity.map((activity, i) => (
              <div key={i} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                <span className="text-xl">{methodIcons[activity.method]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{activity.contactName}</span>
                    <span className="text-gray-500"> at {activity.accountName}</span>
                    {activity.product && (
                      <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {activity.product}
                      </span>
                    )}
                  </p>
                  {activity.notes && (
                    <p className="text-xs text-gray-400 truncate">{activity.notes}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
