-- ============================================================================
-- Migration: 20260910000012_role_based_messaging.sql
-- Role-Based Restricted Messaging Schema & RLS Policies
-- ============================================================================

CREATE TYPE conversation_channel_type AS ENUM (
  'PATIENT_ASHA',
  'PATIENT_PHC',
  'ASHA_PHC',
  'PHC_DISTRICT_HOSPITAL',
  'DISTRICT_HOSPITAL_PATIENT'
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type conversation_channel_type NOT NULL,
  patient_id UUID NOT NULL,
  asha_id UUID NULL,
  phc_facility_id TEXT NULL,
  dh_facility_id TEXT NULL,
  referral_id UUID NULL REFERENCES hospital_referrals(id) ON DELETE SET NULL,
  care_episode_id TEXT NULL,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role realtime_user_role NOT NULL,
  recipient_id UUID NULL,
  patient_id UUID NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ NULL
);

-- Indexes for ultra-fast query and authorization
CREATE INDEX IF NOT EXISTS idx_conversations_channel_patient ON conversations(channel_type, patient_id);
CREATE INDEX IF NOT EXISTS idx_conversations_asha ON conversations(asha_id);
CREATE INDEX IF NOT EXISTS idx_conversations_phc ON conversations(phc_facility_id);
CREATE INDEX IF NOT EXISTS idx_conversations_dh ON conversations(dh_facility_id);
CREATE INDEX IF NOT EXISTS idx_conversations_referral ON conversations(referral_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Security Function: can_access_conversation
-- Strictly verifies that the requesting user is a legitimate participant in
-- the conversation based on their role, ID, patient assignment, or facility.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION can_access_conversation(
  p_conv_id UUID,
  p_user_id UUID,
  p_role realtime_user_role,
  p_facility_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv conversations%ROWTYPE;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = p_conv_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- PATIENT: Only their own patient_id
  IF p_role = 'PATIENT' THEN
    RETURN v_conv.patient_id = p_user_id;
  END IF;

  -- ASHA: Assigned ASHA for this conversation or patient
  IF p_role = 'ASHA' THEN
    IF v_conv.asha_id IS NOT NULL AND v_conv.asha_id = p_user_id THEN
      RETURN TRUE;
    END IF;
    -- Check if patient is in ASHA's assigned cohort
    RETURN EXISTS (
      SELECT 1 FROM patients WHERE id = v_conv.patient_id AND asha_id = p_user_id
    );
  END IF;

  -- PHC: Belongs to referring or assigned PHC facility
  IF p_role = 'PHC' THEN
    IF v_conv.phc_facility_id IS NOT NULL AND v_conv.phc_facility_id = p_facility_id THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- DISTRICT_HOSPITAL: Belongs to destination DH facility
  IF p_role = 'DISTRICT_HOSPITAL' THEN
    IF v_conv.dh_facility_id IS NOT NULL AND v_conv.dh_facility_id = p_facility_id THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  RETURN FALSE;
END;
$$;

-- RLS Policy: conversations
CREATE POLICY "Users can only select authorized conversations"
ON conversations
FOR SELECT
USING (
  can_access_conversation(
    id,
    auth.uid(),
    (auth.jwt() -> 'user_metadata' ->> 'role')::realtime_user_role,
    auth.jwt() -> 'user_metadata' ->> 'facility_id'
  )
);

CREATE POLICY "Users can only insert authorized conversations"
ON conversations
FOR INSERT
WITH CHECK (
  can_access_conversation(
    id,
    auth.uid(),
    (auth.jwt() -> 'user_metadata' ->> 'role')::realtime_user_role,
    auth.jwt() -> 'user_metadata' ->> 'facility_id'
  )
);

-- RLS Policy: messages
CREATE POLICY "Users can only select messages in authorized conversations"
ON messages
FOR SELECT
USING (
  can_access_conversation(
    conversation_id,
    auth.uid(),
    (auth.jwt() -> 'user_metadata' ->> 'role')::realtime_user_role,
    auth.jwt() -> 'user_metadata' ->> 'facility_id'
  )
);

CREATE POLICY "Users can only insert messages into authorized conversations"
ON messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND can_access_conversation(
    conversation_id,
    auth.uid(),
    (auth.jwt() -> 'user_metadata' ->> 'role')::realtime_user_role,
    auth.jwt() -> 'user_metadata' ->> 'facility_id'
  )
);

CREATE POLICY "Recipients can update read_at on authorized messages"
ON messages
FOR UPDATE
USING (
  can_access_conversation(
    conversation_id,
    auth.uid(),
    (auth.jwt() -> 'user_metadata' ->> 'role')::realtime_user_role,
    auth.jwt() -> 'user_metadata' ->> 'facility_id'
  )
);
