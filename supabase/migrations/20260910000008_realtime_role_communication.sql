-- Phase 11: Realtime Role-Based Communication Foundation
-- 20260910000008_realtime_role_communication.sql

-- 1. Create Realtime Role Enum strictly matching the 4 core roles
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'realtime_role') THEN
        CREATE TYPE realtime_role AS ENUM ('PATIENT', 'ASHA', 'PHC', 'DISTRICT_HOSPITAL');
    END IF;
END $$;

-- 2. Create Realtime Events Table
-- Minimal event payload table for secure, authorized healthcare event dispatch
CREATE TABLE IF NOT EXISTS realtime_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- e.g., 'REFERRAL_CREATED', 'APPOINTMENT_BOOKED', 'EMERGENCY_TRIGGERED', 'FOLLOW_UP_ASSIGNED'
    actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    actor_role realtime_role NOT NULL,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    related_entity_id UUID NOT NULL,
    related_entity_type TEXT NOT NULL, -- 'referral', 'appointment', 'visit', 'diagnostic', 'follow_up', 'emergency', 'consultation', 'message'
    recipient_type realtime_role NOT NULL, -- 'PATIENT', 'ASHA', 'PHC', 'DISTRICT_HOSPITAL'
    recipient_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Specific user (for 1-to-1)
    recipient_facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL, -- Target facility (PHC or DH)
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for high-throughput realtime filtering
CREATE INDEX IF NOT EXISTS idx_realtime_events_patient ON realtime_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_realtime_events_recipient_user ON realtime_events(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_events_recipient_facility ON realtime_events(recipient_facility_id);
CREATE INDEX IF NOT EXISTS idx_realtime_events_created_at ON realtime_events(created_at DESC);

-- 3. Enable Realtime on the table
ALTER PUBLICATION supabase_realtime ADD TABLE realtime_events;

-- 4. Enable Row Level Security
ALTER TABLE realtime_events ENABLE ROW LEVEL SECURITY;

-- 5. Security Definer Helper: Evaluates whether active user is authorized to receive a realtime event
CREATE OR REPLACE FUNCTION public.can_receive_realtime_event(
    _recipient_type realtime_role,
    _recipient_user_id UUID,
    _recipient_facility_id UUID,
    _patient_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    _uid UUID := auth.uid();
BEGIN
    -- 1. Direct user-targeted events (if specified)
    IF _recipient_user_id IS NOT NULL AND _recipient_user_id = _uid THEN
        RETURN true;
    END IF;

    -- 2. PATIENT Scope: Can receive events only about themselves or linked caregiver
    IF _recipient_type = 'PATIENT' THEN
        RETURN (
            _recipient_user_id = _uid OR
            EXISTS (
                SELECT 1 FROM caregivers c
                WHERE c.caregiver_id = _uid AND c.patient_id = _patient_id
            ) OR
            EXISTS (
                SELECT 1 FROM profiles p
                JOIN patients pt ON pt.patient_id = p.phone OR pt.id = _patient_id
                WHERE p.id = _uid
            )
        );
    END IF;

    -- 3. ASHA Scope: Can receive events only about assigned patients / follow-ups
    IF _recipient_type = 'ASHA' THEN
        RETURN (
            -- User is active ASHA and currently assigned to this patient
            EXISTS (
                SELECT 1 FROM patient_asha_assignments paa
                WHERE paa.asha_id = _uid 
                  AND paa.patient_id = _patient_id
                  AND paa.valid_until IS NULL
            ) OR
            -- Or direct user recipient
            _recipient_user_id = _uid
        );
    END IF;

    -- 4. PHC Scope: Can receive events related to patients under its care, appointments, or referrals
    IF _recipient_type = 'PHC' THEN
        RETURN EXISTS (
            SELECT 1 FROM facility_users fu
            JOIN facilities f ON f.id = fu.facility_id
            WHERE fu.user_id = _uid 
              AND fu.is_active = true
              AND (f.type ILIKE '%PHC%' OR f.type ILIKE '%Primary%' OR f.type ILIKE '%Sub%')
              AND (
                  -- Either explicitly targeted to this facility
                  fu.facility_id = _recipient_facility_id OR
                  -- Or patient has an active appointment/referral/visit at this facility
                  EXISTS (
                      SELECT 1 FROM referrals r
                      WHERE r.patient_id = _patient_id 
                        AND (r.destination_facility_id = fu.facility_id OR r.source_facility_id = fu.facility_id)
                  ) OR
                  EXISTS (
                      SELECT 1 FROM appointments a
                      JOIN appointment_slots s ON s.id = a.slot_id
                      JOIN departments d ON d.id = s.department_id
                      WHERE a.patient_id = _patient_id AND d.facility_id = fu.facility_id
                  )
              )
        );
    END IF;

    -- 5. DISTRICT_HOSPITAL Scope: Can receive events related to active hospital referrals/care
    IF _recipient_type = 'DISTRICT_HOSPITAL' THEN
        RETURN EXISTS (
            SELECT 1 FROM facility_users fu
            JOIN facilities f ON f.id = fu.facility_id
            WHERE fu.user_id = _uid 
              AND fu.is_active = true
              AND (f.type ILIKE '%Hospital%' OR f.type ILIKE '%District%' OR f.type ILIKE '%DH%' OR f.type ILIKE '%SDH%')
              AND (
                  -- Explicitly targeted to this district hospital
                  fu.facility_id = _recipient_facility_id OR
                  -- Or hospital has active referral (incoming/outgoing) for patient
                  EXISTS (
                      SELECT 1 FROM referrals r
                      WHERE r.patient_id = _patient_id 
                        AND (r.destination_facility_id = fu.facility_id OR r.source_facility_id = fu.facility_id)
                  )
              )
        );
    END IF;

    -- Default deny
    RETURN false;
END;
$$;

-- 6. RLS Policies on realtime_events

-- SELECT: Enforced via the can_receive_realtime_event function
CREATE POLICY "Authorized users can select realtime events" 
ON realtime_events FOR SELECT 
USING (
    public.can_receive_realtime_event(recipient_type, recipient_user_id, recipient_facility_id, patient_id)
);

-- INSERT: Authenticated users can dispatch realtime events within workflow execution
CREATE POLICY "Authenticated users can insert realtime events" 
ON realtime_events FOR INSERT 
WITH CHECK (
    auth.role() = 'authenticated'
);

-- 7. Strict Append-Only rules (prevent modifications or deletions to protect audit trail)
CREATE RULE prevent_update_realtime_events AS ON UPDATE TO realtime_events DO INSTEAD NOTHING;
CREATE RULE prevent_delete_realtime_events AS ON DELETE TO realtime_events DO INSTEAD NOTHING;
