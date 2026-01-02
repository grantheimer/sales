'use client';

import { useEffect, useState } from 'react';
import { supabase, Contact, OutreachLog } from '@/lib/supabase';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

type ActivityRecord = {
  date: string;
  contactName: string;
  contactTitle: string;
  method: string;
};

type Stats = {
  contactsDueToday: number;
  activityByPeriod: {
    weekly: { calls: number; emails: number };
    monthly: { calls: number; emails: number };
    annual: { calls: number; emails: number };
  };
  recentActivity: ActivityRecord[];
  weekActivity: ActivityRecord[];
  monthActivity: ActivityRecord[];
  quarterActivity: ActivityRecord[];
};

type PeriodKey = 'weekly' | 'monthly' | 'annual';
type RecentViewKey = 'last5' | 'week' | 'month' | 'quarter';

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('weekly');
  const [recentView, setRecentView] = useState<RecentViewKey>('last5');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isBizDay = isBusinessDay(today);

    // Get all opportunities
    const { data: opportunities } = await supabase
      .from('opportunities')
      .select('*');

    // Get all contacts with their related data
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*');

    // Get all outreach logs
    const { data: logs } = await supabase
      .from('outreach_logs')
      .select('*')
      .order('contact_date', { ascending: false });

    const oppsData = opportunities || [];
    const contactsData = contacts || [];
    const logsData = logs || [];

    // Build contact map for lookups
    const contactMap: Record<string, { name: string; role: string }> = {};
    contactsData.forEach((c: Contact) => {
      contactMap[c.id] = {
        name: c.name,
        role: c.role || '',
      };
    });

    // Find last outreach for each contact
    const lastOutreach: Record<string, { date: string }> = {};
    logsData.forEach((log: OutreachLog) => {
      if (!lastOutreach[log.contact_id]) {
        lastOutreach[log.contact_id] = { date: log.contact_date };
      }
    });

    // Calculate contacts due today (only from prospect opportunities)
    const prospectOppIds = new Set(
      oppsData.filter(o => !o.status || o.status === 'prospect').map(o => o.id)
    );

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
        dueDate = today;
      }

      if (formatDate(dueDate) === formatDate(today)) {
        contactsDueToday++;
      } else if (dueDate < today) {
        contactsOverdue++;
      }
    });

    // Calculate date boundaries
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Filter logs by period
    const weeklyLogs = logsData.filter((log: OutreachLog) =>
      new Date(log.contact_date) >= startOfWeek
    );
    const monthlyLogs = logsData.filter((log: OutreachLog) =>
      new Date(log.contact_date) >= thirtyDaysAgo
    );
    const annualLogs = logsData.filter((log: OutreachLog) =>
      new Date(log.contact_date) >= oneYearAgo
    );

    // Count by method for each period
    const countByMethod = (logs: OutreachLog[]) => ({
      calls: logs.filter(l => l.contact_method === 'call').length,
      emails: logs.filter(l => l.contact_method === 'email').length,
    });

    // Map logs to activity records
    const mapToActivity = (log: OutreachLog): ActivityRecord => ({
      date: log.contact_date,
      contactName: contactMap[log.contact_id]?.name || 'Unknown',
      contactTitle: contactMap[log.contact_id]?.role || '',
      method: log.contact_method,
    });

    // Filter for recent activity views
    const weekActivityLogs = logsData.filter((log: OutreachLog) =>
      new Date(log.contact_date) >= startOfWeek
    );
    const monthActivityLogs = logsData.filter((log: OutreachLog) =>
      new Date(log.contact_date) >= thirtyDaysAgo
    );
    const quarterActivityLogs = logsData.filter((log: OutreachLog) =>
      new Date(log.contact_date) >= ninetyDaysAgo
    );

    setStats({
      contactsDueToday: isBizDay ? contactsDueToday + contactsOverdue : 0,
      activityByPeriod: {
        weekly: countByMethod(weeklyLogs),
        monthly: countByMethod(monthlyLogs),
        annual: countByMethod(annualLogs),
      },
      recentActivity: logsData.slice(0, 5).map(mapToActivity),
      weekActivity: weekActivityLogs.map(mapToActivity),
      monthActivity: monthActivityLogs.map(mapToActivity),
      quarterActivity: quarterActivityLogs.map(mapToActivity),
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

  // Prepare chart data
  const chartData = [
    {
      name: selectedPeriod === 'weekly' ? 'This Week' : selectedPeriod === 'monthly' ? 'Last 30 Days' : 'This Year',
      Calls: stats.activityByPeriod[selectedPeriod].calls,
      Emails: stats.activityByPeriod[selectedPeriod].emails,
    },
  ];

  // Get current activity list based on view selection
  const getActivityList = (): ActivityRecord[] => {
    switch (recentView) {
      case 'week':
        return stats.weekActivity;
      case 'month':
        return stats.monthActivity;
      case 'quarter':
        return stats.quarterActivity;
      default:
        return stats.recentActivity;
    }
  };

  const activityList = getActivityList();

  const periodButtons: { key: PeriodKey; label: string }[] = [
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'annual', label: 'Annual' },
  ];

  const recentViewButtons: { key: RecentViewKey; label: string }[] = [
    { key: 'last5', label: 'Last 5' },
    { key: 'week', label: 'Last Week' },
    { key: 'month', label: 'Last 30 Days' },
    { key: 'quarter', label: 'Last 90 Days' },
  ];

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500 text-sm">Your outreach activity at a glance</p>
      </div>

      {/* Due Today Banner */}
      <Link
        href="/todo"
        className={`block mb-6 rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow ${
          stats.contactsDueToday === 0
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        }`}
      >
        <p className={`text-2xl font-bold ${
          stats.contactsDueToday === 0 ? 'text-green-700 dark:text-green-400' : 'text-blue-700 dark:text-blue-400'
        }`}>
          Due Today: {stats.contactsDueToday} {stats.contactsDueToday === 1 ? 'activity' : 'activities'}
        </p>
      </Link>

      {/* Activity Tracker */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <h3 className="font-semibold text-lg">Activity Tracker</h3>
          <div className="flex gap-1">
            {periodButtons.map((btn) => (
              <button
                key={btn.key}
                onClick={() => setSelectedPeriod(btn.key)}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  selectedPeriod === btn.key
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={100} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Calls" fill="#22c55e" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Emails" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 flex justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-gray-600 dark:text-gray-300">
              Calls: {stats.activityByPeriod[selectedPeriod].calls}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span className="text-gray-600 dark:text-gray-300">
              Emails: {stats.activityByPeriod[selectedPeriod].emails}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <h3 className="font-semibold text-lg">Recent Activity</h3>
          <div className="flex flex-wrap gap-1">
            {recentViewButtons.map((btn) => (
              <button
                key={btn.key}
                onClick={() => setRecentView(btn.key)}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  recentView === btn.key
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {activityList.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">No activity found for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400">Name</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400">Title</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400">Method</th>
                </tr>
              </thead>
              <tbody>
                {activityList.map((activity, i) => (
                  <tr key={i} className="border-b last:border-0 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-2 px-2 whitespace-nowrap">
                      {new Date(activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-2 px-2 font-medium">{activity.contactName}</td>
                    <td className="py-2 px-2 text-gray-500 dark:text-gray-400">{activity.contactTitle || '-'}</td>
                    <td className="py-2 px-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        activity.method === 'call'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {activity.method === 'call' ? '📞' : '✉️'} {activity.method}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activityList.length > 10 && (
          <p className="text-xs text-gray-400 mt-3 text-center">
            Showing {activityList.length} activities
          </p>
        )}
      </div>
    </div>
  );
}
