-- Phase 1: Database Foundation Migration
-- 20260904000000_foundation_schema.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- ENUMERATIONS
-- ==========================================

CREATE TYPE user_role AS ENUM ('asha_worker', 'anm', 'mo_doctor', 'specialist', 'admin', 'patient', 'facility_manager');
CREATE TYPE risk_level AS ENUM ('GREEN', 'YELLOW', 'RED', 'CRITICAL');
CREATE TYPE referral_status AS ENUM ('pending', 'accepted', 'in_transit', 'admitted', 'completed', 'cancelled', 'rejected');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show');
CREATE TYPE consent_category AS ENUM ('data_storage', 'data_sharing', 'ai_analysis', 'notifications', 'caregiver_access', 'research');
CREATE TYPE consent_status AS ENUM ('granted', 'revoked', 'expired');
CREATE TYPE entity_type AS ENUM ('patient', 'referral', 'appointment', 'visit', 'prescription', 'care_episode');
CREATE TYPE document_type AS ENUM ('lab_report', 'prescription', 'id_proof', 'scan', 'other');
CREATE TYPE assignment_type AS ENUM ('primary', 'temporary');

-- ==========================================
-- 1. IDENTITY & FACILITIES
-- ==========================================

-- Facilities
CREATE TABLE facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- e.g., 'PHC', 'District Hospital', 'Sub Center'
    district TEXT NOT NULL,
    state TEXT NOT NULL,
    contact_number TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Departments
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(facility_id, name)
);

-- Profiles (extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- User Roles (Many-to-Many mapping for users to roles)
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, role)
);

-- Facility Users (Mapping users to facilities/departments)
CREATE TABLE facility_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, facility_id, department_id)
);

-- ==========================================
-- 2. PATIENT ENTITIES
-- ==========================================

-- Patients
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT UNIQUE NOT NULL, -- System generated (e.g. P-1002345)
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('M', 'F', 'Other')),
    blood_group TEXT,
    address TEXT NOT NULL,
    village TEXT NOT NULL,
    district TEXT NOT NULL,
    pincode TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sequence & Trigger for patient_id generation
CREATE SEQUENCE patient_id_seq START 1000000;

CREATE OR REPLACE FUNCTION generate_patient_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.patient_id IS NULL OR NEW.patient_id = '' THEN
    NEW.patient_id := 'P-' || nextval('patient_id_seq')::TEXT;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_patient_id
BEFORE INSERT ON patients
FOR EACH ROW EXECUTE FUNCTION generate_patient_id();


-- Patient Identifiers (Aadhaar, ABHA, etc.)
CREATE TABLE patient_identifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    identifier_type TEXT NOT NULL, -- 'Aadhaar', 'ABHA', 'VoterID'
    identifier_value TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(identifier_type, identifier_value)
);

-- Patient-ASHA Assignments
CREATE TABLE patient_asha_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    asha_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assignment_type assignment_type NOT NULL DEFAULT 'primary',
    valid_from TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    valid_until TIMESTAMPTZ, -- Null for primary unless reassigned
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Ensure only one active primary assignment per patient
CREATE UNIQUE INDEX idx_unique_primary_asha ON patient_asha_assignments(patient_id) 
WHERE assignment_type = 'primary' AND valid_until IS NULL;


-- Caregivers
CREATE TABLE caregivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    caregiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, -- Caregiver is also a user (patient role)
    relationship TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(patient_id, caregiver_id)
);

-- Caregiver Permissions
CREATE TABLE caregiver_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
    permission TEXT NOT NULL, -- e.g., 'view_records', 'manage_appointments'
    granted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(caregiver_id, permission)
);

-- ==========================================
-- 3. HEALTHCARE ENTITIES
-- ==========================================

-- Care Episodes
CREATE TABLE care_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- active, closed
    started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ASHA Visits
CREATE TABLE asha_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    asha_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    care_episode_id UUID REFERENCES care_episodes(id) ON DELETE SET NULL,
    visit_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    symptoms JSONB NOT NULL DEFAULT '[]'::jsonb,
    vitals JSONB NOT NULL DEFAULT '{}'::jsonb,
    risk_score risk_level NOT NULL DEFAULT 'GREEN',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Referrals
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    care_episode_id UUID REFERENCES care_episodes(id) ON DELETE SET NULL,
    source_facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
    destination_facility_id UUID NOT NULL REFERENCES facilities(id),
    destination_department_id UUID REFERENCES departments(id),
    referring_user_id UUID NOT NULL REFERENCES profiles(id),
    urgency risk_level NOT NULL DEFAULT 'YELLOW',
    reason TEXT NOT NULL,
    clinical_notes TEXT,
    status referral_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Appointment Slots
CREATE TABLE appointment_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_booked BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CHECK (end_time > start_time)
);

-- Appointments
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    slot_id UUID NOT NULL REFERENCES appointment_slots(id),
    referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL,
    care_episode_id UUID REFERENCES care_episodes(id) ON DELETE SET NULL,
    status appointment_status NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(slot_id) -- A slot can only be booked once
);

-- Consultations
CREATE TABLE consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    doctor_id UUID NOT NULL REFERENCES profiles(id),
    care_episode_id UUID REFERENCES care_episodes(id) ON DELETE SET NULL,
    chief_complaint TEXT NOT NULL,
    clinical_findings TEXT,
    diagnosis TEXT,
    notes TEXT,
    consultation_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Prescriptions
CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    doctor_id UUID NOT NULL REFERENCES profiles(id),
    care_episode_id UUID REFERENCES care_episodes(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Prescription Items
CREATE TABLE prescription_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    medication_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    duration_days INT NOT NULL,
    instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Diagnostics
CREATE TABLE diagnostics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    test_name TEXT NOT NULL,
    test_category TEXT,
    results TEXT,
    result_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, cancelled
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Follow-ups
CREATE TABLE follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    care_episode_id UUID REFERENCES care_episodes(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, missed
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Treatment Outcomes
CREATE TABLE treatment_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    care_episode_id UUID NOT NULL REFERENCES care_episodes(id) ON DELETE CASCADE,
    outcome_summary TEXT NOT NULL,
    outcome_status TEXT NOT NULL, -- recovered, chronic, deceased, referred_out
    recorded_by UUID NOT NULL REFERENCES profiles(id),
    recorded_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 4. SUPPORTING ENTITIES
-- ==========================================

-- Documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES profiles(id),
    document_type document_type NOT NULL,
    file_url TEXT NOT NULL,
    title TEXT NOT NULL,
    version INT DEFAULT 1 NOT NULL,
    supersedes_id UUID REFERENCES documents(id), -- For versioning
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Consent Records (Versioned)
CREATE TABLE consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    category consent_category NOT NULL,
    status consent_status NOT NULL DEFAULT 'granted',
    recorded_by UUID NOT NULL REFERENCES profiles(id),
    ip_address TEXT,
    device_info TEXT,
    version INT DEFAULT 1 NOT NULL,
    supersedes_id UUID REFERENCES consent_records(id), -- For versioning history
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal', -- normal, high, urgent
    related_patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    related_referral_id UUID REFERENCES referrals(id) ON DELETE CASCADE,
    related_appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Audit Logs (Append Only)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    actor_role TEXT,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    entity_type entity_type NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL, -- e.g., 'CREATE', 'UPDATE', 'DELETE', 'VIEW'
    reason TEXT,
    source TEXT,
    session_info TEXT,
    before_state JSONB,
    after_state JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Prevent Updates and Deletes on Audit Logs
CREATE RULE prevent_audit_log_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE prevent_audit_log_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- ==========================================
-- INDEXES
-- ==========================================

-- Identity & Facilities
CREATE INDEX idx_facility_users_user ON facility_users(user_id);
CREATE INDEX idx_facility_users_facility ON facility_users(facility_id);

-- Patients
CREATE INDEX idx_patients_patient_id ON patients(patient_id);
CREATE INDEX idx_patient_identifiers_value ON patient_identifiers(identifier_value);
CREATE INDEX idx_patient_asha_assignments_patient ON patient_asha_assignments(patient_id);
CREATE INDEX idx_patient_asha_assignments_asha ON patient_asha_assignments(asha_id);

-- Healthcare
CREATE INDEX idx_care_episodes_patient ON care_episodes(patient_id);
CREATE INDEX idx_asha_visits_patient ON asha_visits(patient_id);
CREATE INDEX idx_asha_visits_asha ON asha_visits(asha_id);
CREATE INDEX idx_referrals_patient ON referrals(patient_id);
CREATE INDEX idx_referrals_dest_facility ON referrals(destination_facility_id);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_appointment_slots_doctor ON appointment_slots(doctor_id);
CREATE INDEX idx_appointment_slots_time ON appointment_slots(start_time);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_slot ON appointments(slot_id);
CREATE INDEX idx_consultations_patient ON consultations(patient_id);
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_follow_ups_due_date ON follow_ups(due_date);

-- Supporting
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ==========================================
-- TRIGGERS FOR UPDATED_AT
-- ==========================================

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_facilities_updated_at BEFORE UPDATE ON facilities FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_facility_users_updated_at BEFORE UPDATE ON facility_users FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_patient_asha_assignments_updated_at BEFORE UPDATE ON patient_asha_assignments FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_care_episodes_updated_at BEFORE UPDATE ON care_episodes FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_asha_visits_updated_at BEFORE UPDATE ON asha_visits FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_referrals_updated_at BEFORE UPDATE ON referrals FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_consultations_updated_at BEFORE UPDATE ON consultations FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_prescriptions_updated_at BEFORE UPDATE ON prescriptions FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_diagnostics_updated_at BEFORE UPDATE ON diagnostics FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_follow_ups_updated_at BEFORE UPDATE ON follow_ups FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
