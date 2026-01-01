-- COMBINED MIGRATION: Run this to apply all missing schema updates
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Migration V4: Add cadence_days to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS cadence_days INTEGER NOT NULL DEFAULT 10;

-- Migration V5: Add status to opportunities
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'prospect';

-- Optional: Add check constraint for status (may fail if already exists, that's OK)
DO $$
BEGIN
  ALTER TABLE opportunities ADD CONSTRAINT opportunities_status_check 
    CHECK (status IN ('prospect', 'active', 'won'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Optional: Add index for faster status filtering
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);

-- Verify the changes
SELECT 
  'contacts.cadence_days exists: ' || 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'cadence_days'
  ) THEN 'YES' ELSE 'NO' END AS cadence_check,
  'opportunities.status exists: ' || 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'opportunities' AND column_name = 'status'
  ) THEN 'YES' ELSE 'NO' END AS status_check;

