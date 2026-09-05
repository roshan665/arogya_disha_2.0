-- Phase 9: Realtime Notifications
-- 20260904000006_notifications.sql

DROP TABLE IF EXISTS notifications CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;

CREATE TYPE notification_type AS ENUM (
    'REFERRAL_CREATED',
    'REFERRAL_ACCEPTED',
    'REFERRAL_REJECTED',
    'APPOINTMENT_BOOKED',
    'APPOINTMENT_CANCELLED',
    'APPOINTMENT_RESCHEDULED',
    'PATIENT_CHECKED_IN',
    'QUEUE_CHANGED',
    'CONSULTATION_COMPLETED',
    'FOLLOW_UP_CREATED',
    'DIAGNOSTIC_RESULT_AVAILABLE',
    'EMERGENCY_CREATED',
    'TRANSFER_CREATED',
    'TRANSFER_ACCEPTED',
    'TRANSFER_REJECTED'
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type notification_type NOT NULL,
    entity_id UUID NOT NULL, -- The ID of the referral, appointment, etc.
    entity_type TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Realtime
alter publication supabase_realtime add table notifications;

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only read own notifications" ON notifications FOR SELECT USING (
    user_id = auth.uid()
);

-- Note: In a true production app, insertion should ideally be restricted to trusted backend 
-- or postgres triggers, but for our architecture, any authenticated user can trigger a workflow 
-- which generates a notification for someone else.
CREATE POLICY "Users can insert notifications" ON notifications FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
);

CREATE POLICY "Users can mark own notifications as read" ON notifications FOR UPDATE USING (
    user_id = auth.uid()
) WITH CHECK (
    user_id = auth.uid()
);
