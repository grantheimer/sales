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
  major_opportunities: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  health_system_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  products: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OutreachLog = {
  id: string;
  contact_id: string;
  contact_date: string;
  contact_method: 'call' | 'email' | 'meeting';
  notes: string | null;
  created_at: string;
};

export type ContactWithDetails = Contact & {
  health_system: HealthSystem;
  last_contact_date: string | null;
  last_contact_method: string | null;
  days_since_contact: number | null;
  days_since_account_contact: number | null;
};

export type HealthSystemWithContacts = HealthSystem & {
  contacts: Contact[];
  last_contact_date: string | null;
};
