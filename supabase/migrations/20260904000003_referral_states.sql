-- Phase 6: Referral Workflow & Realtime
-- 20260904000003_referral_states.sql

-- Expand referral_status enum
ALTER TYPE referral_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE referral_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE referral_status ADD VALUE IF NOT EXISTS 'pending_acceptance';
-- 'accepted', 'rejected', 'cancelled', 'completed' already exist from Phase 1
ALTER TYPE referral_status ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE referral_status ADD VALUE IF NOT EXISTS 'checked_in';
ALTER TYPE referral_status ADD VALUE IF NOT EXISTS 'in_consultation';
ALTER TYPE referral_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE referral_status ADD VALUE IF NOT EXISTS 'transferred';

-- Add Rejection Reason to Referrals table
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS transfer_to_facility_id UUID REFERENCES facilities(id);

-- Enable Realtime for Referrals
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table referrals;

-- Ensure RLS on Referrals allows the source and destination to view the referral
-- (This was handled in Phase 2, but just reinforcing the realtime delivery scope)
