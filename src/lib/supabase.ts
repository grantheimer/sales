import { createClient } from '@supabase/supabase-js';

// Use placeholder during build, real values at runtime
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const PRODUCTS = [
  'Core',
  'Coding Intelligence',
  'Discovery',
  'Periop',
  'Procedure',
  'Medical Necessity',
  'Precision Sets',
  'Normalize',
] as const;

export type Product = typeof PRODUCTS[number];

export type HealthSystem = {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OpportunityStatus = 'prospect' | 'active' | 'won';

export const OPPORTUNITY_STATUSES: { value: OpportunityStatus; label: string }[] = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'active', label: 'Active' },
  { value: 'won', label: 'Won' },
];

export type Opportunity = {
  id: string;
  health_system_id: string;
  product: string;
  status: OpportunityStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  health_system_id: string;
  opportunity_id: string | null;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  cadence_days: number;
  created_at: string;
  updated_at: string;
};

export type OutreachLog = {
  id: string;
  contact_id: string;
  contact_date: string;
  contact_method: 'call' | 'email';
  notes: string | null;
  created_at: string;
};

export type OpportunityWithDetails = Opportunity & {
  health_system: HealthSystem;
  contacts: Contact[];
  last_email_date: string | null;
  days_since_email: number | null;
  emails_this_week: number;
};

export type HealthSystemWithOpportunities = HealthSystem & {
  opportunities: Opportunity[];
};
