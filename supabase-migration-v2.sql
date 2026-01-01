-- MIGRATION V2: Update schema for ArubaCRM
-- Run this in your Supabase SQL Editor

-- Step 1: Add major_opportunities to health_systems
ALTER TABLE health_systems ADD COLUMN IF NOT EXISTS major_opportunities INTEGER NOT NULL DEFAULT 0;

-- Step 2: Add products array to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS products TEXT[] NOT NULL DEFAULT '{}';

-- Step 3: Remove old columns from health_systems (optional - can keep for historical data)
-- Uncomment these if you want to remove the old columns:
-- ALTER TABLE health_systems DROP COLUMN IF EXISTS deal_stage;
-- ALTER TABLE health_systems DROP COLUMN IF EXISTS revenue_potential;

-- Step 4: If you want to clean up and remove the old columns, run these:
ALTER TABLE health_systems DROP COLUMN IF EXISTS deal_stage;
ALTER TABLE health_systems DROP COLUMN IF EXISTS revenue_potential;
