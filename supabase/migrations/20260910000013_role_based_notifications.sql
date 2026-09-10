-- ============================================================================
-- Migration: 20260910000013_role_based_notifications.sql
-- Role-Based Notification System Schema, Audit Logs & RLS
-- ============================================================================

CREATE TYPE notification_priority_level AS ENUM (
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
);

CREATE TABLE IF NOT EXISTS role_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NULL,
  recipient_role realtime_user_role NOT NULL,
  recipient_facility_id TEXT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  patient_id UUID NULL,
  related_entity_id UUID NULL,
  related_entity_type TEXT NULL,
  priority notification_priority_level DEFAULT 'NORMAL' NOT NULL,
  is_read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  read_at TIMESTAMPTZ NULL,
  idempotency_key TEXT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS notification_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NULL REFERENCES role_notifications(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  sender_id UUID NULL,
  recipient_user_id UUID NULL,
  recipient_role realtime_user_role NOT NULL,
  recipient_facility_id TEXT NULL,
  related_entity_id UUID NULL,
  related_entity_type TEXT NULL,
  delivery_status TEXT DEFAULT 'DELIVERED' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Ultra-fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_role_notifications_recipient_user ON role_notifications(recipient_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_role_notifications_recipient_role_facility ON role_notifications(recipient_role, recipient_facility_id, is_read);
CREATE INDEX IF NOT EXISTS idx_role_notifications_patient ON role_notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_role_notifications_created ON role_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_notifications_idempotency ON role_notifications(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_notification_audit_logs_created ON notification_audit_logs(created_at DESC);

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE role_notifications;

-- Enable Row Level Security
ALTER TABLE role_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_audit_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Security Function: can_access_notification
-- Strictly verifies that the requesting user matches the recipient_user_id,
-- or belongs to the authorized role / facility scope.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION can_access_notification(
  p_notif_id UUID,
  p_user_id UUID,
  p_role realtime_user_role,
  p_facility_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notif role_notifications%ROWTYPE;
BEGIN
  SELECT * INTO v_notif FROM role_notifications WHERE id = p_notif_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 1. Direct user recipient
  IF v_notif.recipient_user_id IS NOT NULL AND v_notif.recipient_user_id = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- 2. PATIENT: only their own patient_id
  IF p_role = 'PATIENT' THEN
    RETURN v_notif.patient_id IS NOT NULL AND v_notif.patient_id = p_user_id;
  END IF;

  -- 3. ASHA: assigned patient notifications
  IF p_role = 'ASHA' THEN
    IF v_notif.recipient_role = 'ASHA' AND (v_notif.recipient_user_id IS NULL OR v_notif.recipient_user_id = p_user_id) THEN
      IF v_notif.patient_id IS NOT NULL THEN
        RETURN EXISTS (
          SELECT 1 FROM patients WHERE id = v_notif.patient_id AND asha_id = p_user_id
        );
      END IF;
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- 4. PHC: matching facility
  IF p_role = 'PHC' THEN
    IF v_notif.recipient_role = 'PHC' THEN
      IF v_notif.recipient_facility_id IS NOT NULL THEN
        RETURN v_notif.recipient_facility_id = p_facility_id;
      END IF;
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- 5. DISTRICT_HOSPITAL: matching facility
  IF p_role = 'DISTRICT_HOSPITAL' THEN
    IF v_notif.recipient_role = 'DISTRICT_HOSPITAL' THEN
      IF v_notif.recipient_facility_id IS NOT NULL THEN
        RETURN v_notif.recipient_facility_id = p_facility_id;
      END IF;
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  RETURN FALSE;
END;
$$;

-- RLS Policies: role_notifications
CREATE POLICY "Users can only read authorized notifications"
ON role_notifications
FOR SELECT
USING (
  can_access_notification(
    id,
    auth.uid(),
    (auth.jwt() -> 'user_metadata' ->> 'role')::realtime_user_role,
    auth.jwt() -> 'user_metadata' ->> 'facility_id'
  )
);

CREATE POLICY "System can insert role notifications"
ON role_notifications
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can mark own authorized notifications as read"
ON role_notifications
FOR UPDATE
USING (
  can_access_notification(
    id,
    auth.uid(),
    (auth.jwt() -> 'user_metadata' ->> 'role')::realtime_user_role,
    auth.jwt() -> 'user_metadata' ->> 'facility_id'
  )
);

-- RLS Policies: notification_audit_logs (Supervisors / Admin read only)
CREATE POLICY "Admins can view notification audit logs"
ON notification_audit_logs
FOR SELECT
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'system_admin')
);
