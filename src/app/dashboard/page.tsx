'use client';

import { useEffect, useState } from 'react';
import { supabase, Contact, OutreachLog, ContactOpportunity, Opportunity } from '@/lib/supabase';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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

// Helper: Get Monday of a given week
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper: Get week number of year (ISO week)
function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

type ActivityRecord = {
  date: string;
  contactName: string;
  contactTitle: string;
  method: string;
};

type ChartDataPoint = {
  name: string;
  touches: number;
  fullLabel?: string;
};

type Stats = {
  contactsDueToday: number;
  dailyData: ChartDataPoint[];
  weeklyData: ChartDataPoint[];
  monthlyData: ChartDataPoint[];
  yearTotal: number;
  recentActivity: ActivityRecord[];
  weekActivity: ActivityRecord[];
  monthActivity: ActivityRecord[];
  quarterActivity: ActivityRecord[];
};

type ViewKey = 'daily' | 'weekly' | 'monthly';
type RecentViewKey = 'last5' | 'week' | 'month' | 'quarter';

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<ViewKey>('daily');
  const [recentView, setRecentView] = useState<RecentViewKey>('last5');
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isBizDay = isBusinessDay(today);
    const thisYear = today.getFullYear();

    // Get all opportunities
    const { data: opportunities } = await supabase
      .from('opportunities')
      .select('*');

    // Get all contacts
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*');

    // Get contact-opportunity assignments
    const { data: assignments } = await supabase
      .from('contact_opportunities')
      .select('*');

    // Get all outreach logs
    const { data: logs } = await supabase
      .from('outreach_logs')
      .select('*')
      .order('contact_date', { ascending: false });

    const oppsData = opportunities || [];
    const contactsData = contacts || [];
    const assignmentsData = assignments || [];
    const logsData = logs || [];

    // Build contact map for lookups
    const contactMap: Record<string, { name: string; role: string }> = {};
    contactsData.forEach((c: Contact) => {
      contactMap[c.id] = {
        name: c.name,
        role: c.role || '',
      };
    });

    // Find last outreach for each contact-opportunity pair
    const lastOutreach: Record<string, { date: string }> = {};
    logsData.forEach((log: OutreachLog) => {
      const key = `${log.contact_id}-${log.opportunity_id}`;
      if (!lastOutreach[key]) {
        lastOutreach[key] = { date: log.contact_date };
      }
    });

    // Calculate contacts due today (only from prospect opportunities)
    const prospectOppIds = new Set(
      oppsData.filter((o: Opportunity) => !o.status || o.status === 'prospect').map((o: Opportunity) => o.id)
    );

    let contactsDueToday = 0;
    let contactsOverdue = 0;

    assignmentsData.forEach((assignment: ContactOpportunity) => {
      if (!prospectOppIds.has(assignment.opportunity_id)) return;

      const key = `${assignment.contact_id}-${assignment.opportunity_id}`;
      const last = lastOutreach[key];
      let dueDate: Date;

      if (last) {
        const lastContactDate = new Date(last.date);
        lastContactDate.setHours(0, 0, 0, 0);
        dueDate = addBusinessDays(lastContactDate, assignment.cadence_days);
      } else {
        dueDate = today;
      }

      if (formatDate(dueDate) === formatDate(today)) {
        contactsDueToday++;
      } else if (dueDate < today) {
        contactsOverdue++;
      }
    });

    // Filter logs for this year only (for all chart views)
    const yearLogs = logsData.filter((log: OutreachLog) => {
      const logDate = new Date(log.contact_date);
      return logDate.getFullYear() === thisYear;
    });

    // --- DAILY DATA (Mon-Fri of current week) ---
    const monday = getMonday(today);
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const dailyData: ChartDataPoint[] = dayNames.map((name, i) => {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      const dateStr = formatDate(dayDate);
      const fullLabel = dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      const touches = yearLogs.filter((log: OutreachLog) => log.contact_date === dateStr).length;
      return { name, touches, fullLabel };
    });

    // --- WEEKLY DATA (52 weeks) ---
    const weeklyData: ChartDataPoint[] = [];
    for (let week = 1; week <= 52; week++) {
      // Find start of this week (Monday)
      const jan1 = new Date(thisYear, 0, 1);
      const daysToFirstMonday = (8 - jan1.getDay()) % 7 || 7;
      const firstMonday = new Date(thisYear, 0, 1 + daysToFirstMonday);
      const weekStart = new Date(firstMonday);
      weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekStartStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const weekEndStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fullLabel = `Week ${week}: ${weekStartStr} - ${weekEndStr}`;

      const touches = yearLogs.filter((log: OutreachLog) => {
        const logDate = new Date(log.contact_date);
        return getWeekNumber(logDate) === week && logDate.getFullYear() === thisYear;
      }).length;

      weeklyData.push({ name: '', touches, fullLabel });
    }

    // --- MONTHLY DATA (12 months) ---
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData: ChartDataPoint[] = monthNames.map((name, i) => {
      const fullLabel = new Date(thisYear, i, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const touches = yearLogs.filter((log: OutreachLog) => {
        const logDate = new Date(log.contact_date);
        return logDate.getMonth() === i && logDate.getFullYear() === thisYear;
      }).length;
      return { name, touches, fullLabel };
    });

    // Year total
    const yearTotal = yearLogs.length;

    // Calculate date boundaries for recent activity
    const startOfWeek = getMonday(today);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Map logs to activity records
    const mapToActivity = (log: OutreachLog): ActivityRecord => ({
      date: log.contact_date,
      contactName: contactMap[log.contact_id]?.name || 'Unknown',
      contactTitle: contactMap[log.contact_id]?.role || '',
      method: log.contact_method,
    });

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
      dailyData,
      weeklyData,
      monthlyData,
      yearTotal,
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

  // Get chart data based on selected view
  const getChartData = (): ChartDataPoint[] => {
    switch (selectedView) {
      case 'daily':
        return stats.dailyData;
      case 'weekly':
        return stats.weeklyData;
      case 'monthly':
        return stats.monthlyData;
      default:
        return stats.dailyData;
    }
  };

  const chartData = getChartData();

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

  const viewButtons: { key: ViewKey; label: string }[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ];

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataPoint }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{data.fullLabel}</p>
          <p className="text-sm text-blue-600 dark:text-blue-400">{data.touches} {data.touches === 1 ? 'touch' : 'touches'}</p>
        </div>
      );
    }
    return null;
  };

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
            {viewButtons.map((btn) => (
              <button
                key={btn.key}
                onClick={() => setSelectedView(btn.key)}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  selectedView === btn.key
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`h-64 ${selectedView === 'weekly' ? 'overflow-x-auto' : ''}`}>
          <div style={{ width: selectedView === 'weekly' ? '1200px' : '100%', height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis
                  dataKey="name"
                  tick={selectedView === 'weekly' ? false : { fontSize: 12 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                <Bar dataKey="touches" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#3b82f6" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-4 text-center">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {currentYear} touches: {stats.yearTotal}
          </span>
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
