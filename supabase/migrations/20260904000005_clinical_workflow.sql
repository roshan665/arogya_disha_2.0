-- Phase 8: Doctor Clinical Workflow
-- 20260904000005_clinical_workflow.sql

DROP TABLE IF EXISTS consultations CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS prescription_items CASCADE;
DROP TABLE IF EXISTS diagnostic_orders CASCADE;
DROP TABLE IF EXISTS diagnostics CASCADE;
DROP TYPE IF EXISTS consultation_status CASCADE;
DROP TYPE IF EXISTS diagnostic_status CASCADE;

CREATE TYPE consultation_status AS ENUM (
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);

CREATE TYPE diagnostic_status AS ENUM (
    'ORDERED',
    'SCHEDULED',
    'SAMPLE_COLLECTED',
    'REPORT_GENERATED',
    'VERIFIED',
    'DOCTOR_REVIEWED',
    'PUBLISHED'
);

CREATE TABLE consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    doctor_id UUID NOT NULL REFERENCES profiles(id),
    symptoms JSONB DEFAULT '[]'::jsonb,
    history TEXT,
    examination TEXT,
    assessment TEXT,
    treatment TEXT,
    outcome TEXT,
    status consultation_status DEFAULT 'IN_PROGRESS' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE prescription_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id),
    medicine TEXT NOT NULL,
    dose TEXT NOT NULL,
    frequency TEXT NOT NULL,
    duration TEXT NOT NULL,
    instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE medication_safety_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_item_id UUID NOT NULL REFERENCES prescription_items(id),
    doctor_id UUID NOT NULL REFERENCES profiles(id),
    alert_type TEXT NOT NULL,
    override_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE diagnostic_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    test_name TEXT NOT NULL,
    status diagnostic_status DEFAULT 'ORDERED' NOT NULL,
    result TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS: Strict append-only for Safety Overrides
ALTER TABLE medication_safety_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Safety overrides are insert-only by doctors" ON medication_safety_overrides FOR INSERT WITH CHECK (
    public.has_role('DOCTOR'::user_role)
);
CREATE POLICY "Safety overrides viewable by authorized" ON medication_safety_overrides FOR SELECT USING (
    public.has_any_role(ARRAY['DOCTOR'::user_role, 'HOSPITAL_ADMIN'::user_role, 'SYSTEM_ADMIN'::user_role])
);
-- NO UPDATE OR DELETE ALLOWED
CREATE RULE prevent_update_safety_overrides AS ON UPDATE TO medication_safety_overrides DO INSTEAD NOTHING;
CREATE RULE prevent_delete_safety_overrides AS ON DELETE TO medication_safety_overrides DO INSTEAD NOTHING;
