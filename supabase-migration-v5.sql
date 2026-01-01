-- MIGRATION V5: Add status to opportunities for tracking lifecycle
-- Run this in your Supabase SQL Editor

-- Add status column with default 'prospect'
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'prospect';

-- Add check constraint to ensure valid status values
ALTER TABLE opportunities ADD CONSTRAINT opportunities_status_check 
  CHECK (status IN ('prospect', 'active', 'won'));

-- Create index for faster filtering by status
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);

