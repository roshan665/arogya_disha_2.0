-- Phase 7: Appointment, Check-In & Queue
-- 20260904000004_appointments.sql

DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS appointment_slots CASCADE;
DROP TYPE IF EXISTS appointment_status CASCADE;

CREATE TYPE appointment_status AS ENUM (
    'AVAILABLE',
    'BOOKED',
    'CONFIRMED',
    'CHECKED_IN',
    'IN_QUEUE',
    'IN_CONSULTATION',
    'COMPLETED',
    'CANCELLED',
    'RESCHEDULED',
    'NO_SHOW'
);

CREATE TABLE appointment_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    department_id UUID REFERENCES departments(id),
    doctor_id UUID REFERENCES profiles(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status appointment_status DEFAULT 'AVAILABLE' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID NOT NULL REFERENCES appointment_slots(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    status appointment_status DEFAULT 'BOOKED' NOT NULL,
    booked_by UUID NOT NULL REFERENCES profiles(id),
    token_number INT,
    priority_score INT DEFAULT 0,
    priority_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- THE MOST CRITICAL PART: Prevent Double Booking
-- This Partial Unique Index guarantees that a slot_id can only be referenced ONCE 
-- across any active appointment states. If two transactions try to book the same slot,
-- PostgreSQL will throw a unique_violation instantly.
CREATE UNIQUE INDEX idx_appointments_unique_slot ON appointments (slot_id)
WHERE status IN ('BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_QUEUE', 'IN_CONSULTATION');

CREATE INDEX idx_appointments_facility ON appointment_slots(facility_id, doctor_id, start_time);
CREATE INDEX idx_appointments_queue ON appointments(status, priority_score DESC, created_at ASC);

-- Enable Realtime
alter publication supabase_realtime add table appointments;
alter publication supabase_realtime add table appointment_slots;

-- RLS
ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view slots for their facility" ON appointment_slots FOR SELECT USING (true);
CREATE POLICY "Appointments viewable by patient and facility" ON appointments FOR SELECT USING (
    public.can_access_patient(patient_id) 
    OR public.has_role('HOSPITAL_STAFF'::user_role)
);

CREATE POLICY "Authorized users can book appointments" ON appointments FOR INSERT WITH CHECK (
    public.can_access_patient(patient_id)
);
CREATE POLICY "Authorized users can update appointments" ON appointments FOR UPDATE USING (
    public.has_any_role(ARRAY['HOSPITAL_STAFF'::user_role, 'DOCTOR'::user_role, 'HOSPITAL_ADMIN'::user_role])
);
