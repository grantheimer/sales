'use client';

import { useEffect, useState } from 'react';
import { supabase, Contact, HealthSystem, OutreachLog, PRODUCTS } from '@/lib/supabase';

type Stats = {
  totalContacts: number;
  totalAccounts: number;
  contactsDueToday: number;
  contactsCompletedThisWeek: number;
  contactsDueThisWeek: number;
  weeklyCompletionRate: number;
  totalOutreachThisWeek: number;
  callsThisWeek: number;
  emailsThisWeek: number;
  meetingsThisWeek: number;
  currentStreak: number;
  contactsByProduct: Record<string, number>;
  recentActivity: Array<{
    contactName: string;
    accountName: string;
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
    // Get all contacts with health systems
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*, health_systems(*)');

    // Get all health systems
    const { data: accounts } = await supabase
      .from('health_systems')
      .select('*');

    // Get all outreach logs
    const { data: logs } = await supabase
      .from('outreach_logs')
      .select('*')
      .order('contact_date', { ascending: false });

    // Calculate dates
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const contactsData = contacts || [];
    const accountsData = accounts || [];
    const logsData = logs || [];

    // Build contact ID to name/account map
    const contactMap: Record<string, { name: string; accountName: string; healthSystemId: string }> = {};
    contactsData.forEach((c: Contact & { health_systems: HealthSystem }) => {
      contactMap[c.id] = {
        name: c.name,
        accountName: c.health_systems?.name || 'Unknown',
        healthSystemId: c.health_system_id,
      };
    });

    // Last contact date per contact
    const lastContactDate: Record<string, string> = {};
    logsData.forEach((log: OutreachLog) => {
      if (!lastContactDate[log.contact_id]) {
        lastContactDate[log.contact_id] = log.contact_date;
      }
    });

    // Contacts due today (14+ days since last contact or never contacted)
    const contactsDueToday = contactsData.filter((c: Contact) => {
      const lastDate = lastContactDate[c.id];
      if (!lastDate) return true;
      const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
      return daysSince >= 14;
    }).length;

    // This week's logs
    const thisWeekLogs = logsData.filter((log: OutreachLog) =>
      new Date(log.contact_date) >= startOfWeek
    );

    // Unique contacts reached this week
    const contactsReachedThisWeek = new Set(thisWeekLogs.map((l: OutreachLog) => l.contact_id)).size;

    // Contacts that were due at start of week (simplified: all contacts that hadn't been contacted in 14 days as of start of week)
    const contactsDueStartOfWeek = contactsData.filter((c: Contact) => {
      const lastDate = lastContactDate[c.id];
      if (!lastDate) return true;
      const daysSinceAtWeekStart = Math.floor((startOfWeek.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceAtWeekStart >= 14;
    }).length;

    // Weekly completion rate
    const totalDueThisWeek = Math.max(contactsDueStartOfWeek, contactsDueToday, contactsReachedThisWeek);
    const weeklyCompletionRate = totalDueThisWeek > 0
      ? Math.round((contactsReachedThisWeek / totalDueThisWeek) * 100)
      : 100;

    // Activity breakdown this week
    const callsThisWeek = thisWeekLogs.filter((l: OutreachLog) => l.contact_method === 'call').length;
    const emailsThisWeek = thisWeekLogs.filter((l: OutreachLog) => l.contact_method === 'email').length;
    const meetingsThisWeek = thisWeekLogs.filter((l: OutreachLog) => l.contact_method === 'meeting').length;

    // Calculate streak (consecutive days with activity, going backwards from today)
    let streak = 0;
    const checkDate = new Date(today);
    checkDate.setHours(0, 0, 0, 0);

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const hasActivity = logsData.some((l: OutreachLog) => l.contact_date === dateStr);
      if (hasActivity) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Contacts by product
    const contactsByProduct: Record<string, number> = {};
    contactsData.forEach((c: Contact & { health_systems: HealthSystem }) => {
      (c.products || []).forEach((product: string) => {
        contactsByProduct[product] = (contactsByProduct[product] || 0) + 1;
      });
    });

    // Recent activity (last 5)
    const recentActivity = logsData.slice(0, 5).map((log: OutreachLog) => ({
      contactName: contactMap[log.contact_id]?.name || 'Unknown',
      accountName: contactMap[log.contact_id]?.accountName || 'Unknown',
      method: log.contact_method,
      date: log.contact_date,
      notes: log.notes,
    }));

    setStats({
      totalContacts: contactsData.length,
      totalAccounts: accountsData.length,
      contactsDueToday,
      contactsCompletedThisWeek: contactsReachedThisWeek,
      contactsDueThisWeek: totalDueThisWeek,
      weeklyCompletionRate,
      totalOutreachThisWeek: thisWeekLogs.length,
      callsThisWeek,
      emailsThisWeek,
      meetingsThisWeek,
      currentStreak: streak,
      contactsByProduct,
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
        <p className="text-gray-500 text-sm">Your outreach performance at a glance</p>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Due Today</p>
          <p className="text-3xl font-bold mt-1">{stats.contactsDueToday}</p>
          <p className="text-xs text-gray-400">contacts to reach</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Weekly Rate</p>
          <p className={`text-3xl font-bold mt-1 ${
            stats.weeklyCompletionRate >= 80 ? 'text-green-600' :
            stats.weeklyCompletionRate >= 50 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {stats.weeklyCompletionRate}%
          </p>
          <p className="text-xs text-gray-400">{stats.contactsCompletedThisWeek}/{stats.contactsDueThisWeek} completed</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Current Streak</p>
          <p className="text-3xl font-bold mt-1">{stats.currentStreak}</p>
          <p className="text-xs text-gray-400">{stats.currentStreak === 1 ? 'day' : 'days'} in a row 🔥</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">This Week</p>
          <p className="text-3xl font-bold mt-1">{stats.totalOutreachThisWeek}</p>
          <p className="text-xs text-gray-400">total touches</p>
        </div>
      </div>

      {/* Activity Breakdown & Pipeline */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Activity Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border shadow-sm">
          <h3 className="font-semibold mb-4">This Week&apos;s Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📞</span>
                <span className="text-gray-600 dark:text-gray-300">Calls</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${Math.min((stats.callsThisWeek / Math.max(stats.totalOutreachThisWeek, 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="font-medium w-8 text-right">{stats.callsThisWeek}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">✉️</span>
                <span className="text-gray-600 dark:text-gray-300">Emails</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min((stats.emailsThisWeek / Math.max(stats.totalOutreachThisWeek, 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="font-medium w-8 text-right">{stats.emailsThisWeek}</span>
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
                    style={{ width: `${Math.min((stats.meetingsThisWeek / Math.max(stats.totalOutreachThisWeek, 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="font-medium w-8 text-right">{stats.meetingsThisWeek}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Contacts by Product */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border shadow-sm">
          <h3 className="font-semibold mb-4">Contacts by Product</h3>
          <div className="flex flex-wrap gap-2">
            {PRODUCTS.map((product) => {
              const count = stats.contactsByProduct[product] || 0;
              return (
                <div
                  key={product}
                  className={`px-3 py-2 rounded-lg ${count > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-100 text-gray-400'}`}
                >
                  <span className="text-sm">{product}</span>
                  <span className="font-bold ml-2">{count}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t flex justify-between text-sm text-gray-500">
            <span>{stats.totalAccounts} accounts</span>
            <span>{stats.totalContacts} contacts</span>
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
