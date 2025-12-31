-- MIGRATION: Add contacts table and update outreach_logs
-- Run this in your Supabase SQL Editor

-- Step 1: Create contacts table
CREATE TABLE contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  health_system_id UUID REFERENCES health_systems(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Migrate existing contact data from health_systems to contacts table
-- (This preserves any contacts you've already added)
INSERT INTO contacts (health_system_id, name, role, email, phone, notes)
SELECT id, contact_name, contact_role, contact_email, contact_phone, NULL
FROM health_systems
WHERE contact_name IS NOT NULL AND contact_name != '';

-- Step 3: Add contact_id column to outreach_logs
ALTER TABLE outreach_logs ADD COLUMN contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE;

-- Step 4: Migrate existing outreach logs to link to contacts
-- (Links logs to the first contact found for each health system)
UPDATE outreach_logs ol
SET contact_id = (
  SELECT c.id FROM contacts c
  WHERE c.health_system_id = ol.health_system_id
  LIMIT 1
)
WHERE ol.contact_id IS NULL;

-- Step 5: Remove old health_system_id column from outreach_logs (optional, can keep for reference)
-- Uncomment the next line if you want to remove it:
-- ALTER TABLE outreach_logs DROP COLUMN health_system_id;

-- Step 6: Remove contact fields from health_systems table
ALTER TABLE health_systems DROP COLUMN IF EXISTS contact_name;
ALTER TABLE health_systems DROP COLUMN IF EXISTS contact_role;
ALTER TABLE health_systems DROP COLUMN IF EXISTS contact_email;
ALTER TABLE health_systems DROP COLUMN IF EXISTS contact_phone;

-- Step 7: Create index for faster queries
CREATE INDEX idx_contacts_health_system ON contacts(health_system_id);
CREATE INDEX idx_outreach_logs_contact_date ON outreach_logs(contact_id, contact_date DESC);

-- Step 8: Enable RLS and create policies for contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on contacts" ON contacts
  FOR ALL USING (true) WITH CHECK (true);
