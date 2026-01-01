-- MIGRATION V4: Add cadence_days to contacts
-- Run this in your Supabase SQL Editor

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS cadence_days INTEGER NOT NULL DEFAULT 10;
