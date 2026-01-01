'use client';

import { useEffect, useState } from 'react';
import { supabase, Opportunity, HealthSystem, Contact, OutreachLog, OpportunityStatus } from '@/lib/supabase';
import Link from 'next/link';

type OpportunityWithDetails = Opportunity & {
  health_system: HealthSystem;
  contact_count: number;
  last_outreach_date: string | null;
};

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<OpportunityWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | 'all'>('all');

  const fetchData = async () => {
    // Get opportunities with health systems
    const { data: oppsData } = await supabase
      .from('opportunities')
      .select('*, health_systems(*)');

    // Get contacts
    const { data: contactsData } = await supabase
      .from('contacts')
      .select('*');

    // Get outreach logs
    const { data: logsData } = await supabase
      .from('outreach_logs')
      .select('*')
      .order('contact_date', { ascending: false });

    // Build contact to opportunity map
    const contactToOpp: Record<string, string> = {};
    const contactCountByOpp: Record<string, number> = {};

    (contactsData || []).forEach((c: Contact) => {
      if (c.opportunity_id) {
        contactToOpp[c.id] = c.opportunity_id;
        contactCountByOpp[c.opportunity_id] = (contactCountByOpp[c.opportunity_id] || 0) + 1;
      }
    });

    // Find last outreach date per opportunity
    const lastOutreachByOpp: Record<string, string> = {};

    (logsData || []).forEach((log: OutreachLog) => {
      const oppId = contactToOpp[log.contact_id];
      if (oppId && !lastOutreachByOpp[oppId]) {
        lastOutreachByOpp[oppId] = log.contact_date;
      }
    });

    // Build enriched opportunities
    const enrichedOpps: OpportunityWithDetails[] = (oppsData || []).map(
      (opp: Opportunity & { health_systems: HealthSystem }) => ({
        ...opp,
        health_system: opp.health_systems,
        contact_count: contactCountByOpp[opp.id] || 0,
        last_outreach_date: lastOutreachByOpp[opp.id] || null,
      })
    );

    // Sort by status (prospect first), then by account name, then product
    enrichedOpps.sort((a, b) => {
      const statusOrder = { prospect: 0, active: 1, won: 2 };
      const statusCompare = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
      if (statusCompare !== 0) return statusCompare;
      const accountCompare = a.health_system.name.localeCompare(b.health_system.name);
      if (accountCompare !== 0) return accountCompare;
      return a.product.localeCompare(b.product);
    });

    setOpportunities(enrichedOpps);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  // Filter opportunities by status
  const filteredOpportunities = statusFilter === 'all'
    ? opportunities
    : opportunities.filter(o => o.status === statusFilter);

  // Group by account
  const oppsByAccount: Record<string, OpportunityWithDetails[]> = {};
  filteredOpportunities.forEach((opp) => {
    const accountId = opp.health_system_id;
    if (!oppsByAccount[accountId]) {
      oppsByAccount[accountId] = [];
    }
    oppsByAccount[accountId].push(opp);
  });

  const accountIds = Object.keys(oppsByAccount).sort((a, b) => {
    const nameA = oppsByAccount[a][0]?.health_system?.name || '';
    const nameB = oppsByAccount[b][0]?.health_system?.name || '';
    return nameA.localeCompare(nameB);
  });

  // Count by status
  const prospectCount = opportunities.filter(o => o.status === 'prospect').length;
  const activeCount = opportunities.filter(o => o.status === 'active').length;
  const wonCount = opportunities.filter(o => o.status === 'won').length;

  const getStatusBadge = (status: OpportunityStatus) => {
    switch (status) {
      case 'prospect':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      case 'active':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'won':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Opportunities</h1>
          <p className="text-gray-500 text-sm">
            {opportunities.length} opportunit{opportunities.length !== 1 ? 'ies' : 'y'} total
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300">
            {prospectCount} Prospect
          </span>
          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
            {activeCount} Active
          </span>
          <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
            {wonCount} Won
          </span>
        </div>
      </div>

      {/* Status Filter */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-gray-500">Filter:</span>
        <div className="flex gap-1">
          {(['all', 'prospect', 'active', 'won'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 text-sm rounded-lg transition ${
                statusFilter === status
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filteredOpportunities.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-gray-500 mb-2">
            {opportunities.length === 0 
              ? 'No opportunities yet' 
              : `No ${statusFilter} opportunities`}
          </p>
          {opportunities.length === 0 && (
            <Link href="/accounts" className="text-blue-600 hover:underline text-sm">
              Go to Accounts to add solutions
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {accountIds.map((accountId) => {
            const accountOpps = oppsByAccount[accountId];
            const accountName = accountOpps[0]?.health_system?.name || 'Unknown';

            return (
              <div key={accountId}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-lg">{accountName}</h2>
                    <span className="text-sm text-gray-500">
                      ({accountOpps.length} opportunit{accountOpps.length !== 1 ? 'ies' : 'y'})
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {accountOpps.map((opp) => (
                    <div
                      key={opp.id}
                      className="border rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium">
                                {opp.product}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(opp.status)}`}>
                                {opp.status.charAt(0).toUpperCase() + opp.status.slice(1)}
                              </span>
                              <span className="text-sm text-gray-500">
                                {opp.contact_count} contact{opp.contact_count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {opp.last_outreach_date && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                Last outreach: {new Date(opp.last_outreach_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            )}
                          </div>
                        </div>
                        <Link
                          href={`/opportunities/${opp.id}`}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                          {opp.contact_count === 0 ? 'Add Contacts' : 'Manage'}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
