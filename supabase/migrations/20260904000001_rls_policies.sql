-- Phase 2: Roles, Permissions & RLS
-- 20260904000001_rls_policies.sql

-- ==========================================
-- 1. ROLE MAPPING & EXTENSIONS
-- ==========================================

-- We will add the requested roles to the existing user_role ENUM
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'PATIENT';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ASHA_WORKER';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'DOCTOR';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'HOSPITAL_STAFF';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'HOSPITAL_ADMIN';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SYSTEM_ADMIN';

-- ==========================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_users ENABLE ROW LEVEL SECURITY;

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_asha_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_permissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE care_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE asha_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_outcomes ENABLE ROW LEVEL SECURITY;

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 3. SECURITY DEFINER HELPER FUNCTIONS
-- ==========================================

-- Function to check if a user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_role user_role)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = _role
  );
$$;

-- Function to check if a user has any of a list of roles
CREATE OR REPLACE FUNCTION public.has_any_role(_roles user_role[])
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = ANY(_roles)
  );
$$;

-- Function to check if a patient is assigned to an ASHA
CREATE OR REPLACE FUNCTION public.is_assigned_asha(_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM patient_asha_assignments
    WHERE asha_id = auth.uid() 
      AND patient_id = _patient_id
      AND valid_until IS NULL
  );
$$;

-- Function to check if a doctor/staff is authorized for a patient via facility/care relationships
CREATE OR REPLACE FUNCTION public.is_facility_staff_for_patient(_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER AS $$
  -- Checks if patient has an active care episode, referral, or appointment at a facility the user belongs to
  SELECT EXISTS (
    SELECT 1 FROM facility_users fu
    WHERE fu.user_id = auth.uid() AND fu.is_active = true
      AND EXISTS (
        -- Patient referred to this facility
        SELECT 1 FROM referrals r
        WHERE r.patient_id = _patient_id 
          AND r.destination_facility_id = fu.facility_id
      )
  );
$$;

-- Function to check if user is the patient themselves (or their caregiver)
CREATE OR REPLACE FUNCTION public.is_patient_or_caregiver(_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER AS $$
  -- Allows a caregiver to access their linked patient.
  SELECT EXISTS (
    SELECT 1 FROM caregivers c
    WHERE c.caregiver_id = auth.uid() AND c.patient_id = _patient_id
  );
$$;

-- Master function for patient clinical record access
CREATE OR REPLACE FUNCTION public.can_access_patient(_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 
    public.has_any_role(ARRAY['SYSTEM_ADMIN'::user_role, 'HOSPITAL_ADMIN'::user_role]) OR
    public.is_patient_or_caregiver(_patient_id) OR
    (public.has_role('ASHA_WORKER'::user_role) AND public.is_assigned_asha(_patient_id)) OR
    ((public.has_any_role(ARRAY['DOCTOR'::user_role, 'HOSPITAL_STAFF'::user_role])) AND public.is_facility_staff_for_patient(_patient_id));
$$;

-- ==========================================
-- 4. RLS POLICIES
-- ==========================================

-- PROFILES & ROLES
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admins can read all profiles" ON profiles FOR SELECT USING (public.has_role('SYSTEM_ADMIN'::user_role));

CREATE POLICY "Users can view own roles" ON user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can manage user roles" ON user_roles FOR ALL USING (public.has_role('SYSTEM_ADMIN'::user_role));

-- PATIENTS
CREATE POLICY "Patients viewable by authorized users" ON patients
FOR SELECT USING (public.can_access_patient(id));

CREATE POLICY "ASHAs and Admins can insert patients" ON patients
FOR INSERT WITH CHECK (public.has_any_role(ARRAY['ASHA_WORKER'::user_role, 'SYSTEM_ADMIN'::user_role, 'HOSPITAL_ADMIN'::user_role, 'HOSPITAL_STAFF'::user_role]));

CREATE POLICY "Authorized users can update patients" ON patients
FOR UPDATE USING (public.can_access_patient(id));

-- CLINICAL RECORDS (Visits, Referrals, Appointments, etc)
-- Care Episodes
CREATE POLICY "Authorized access to care episodes" ON care_episodes FOR SELECT USING (public.can_access_patient(patient_id));
-- Asha Visits
CREATE POLICY "Authorized access to ASHA visits" ON asha_visits FOR SELECT USING (public.can_access_patient(patient_id));
CREATE POLICY "ASHAs can insert visits" ON asha_visits FOR INSERT WITH CHECK (public.has_role('ASHA_WORKER'::user_role) AND public.is_assigned_asha(patient_id));
-- Referrals
CREATE POLICY "Authorized access to referrals" ON referrals FOR SELECT USING (public.can_access_patient(patient_id));
CREATE POLICY "Authorized creation of referrals" ON referrals FOR INSERT WITH CHECK (public.can_access_patient(patient_id));
CREATE POLICY "Authorized update of referrals" ON referrals FOR UPDATE USING (public.can_access_patient(patient_id));
-- Consultations
CREATE POLICY "Authorized access to consultations" ON consultations FOR SELECT USING (public.can_access_patient(patient_id));
CREATE POLICY "Doctors can insert consultations" ON consultations FOR INSERT WITH CHECK (public.has_role('DOCTOR'::user_role));
-- Prescriptions
CREATE POLICY "Authorized access to prescriptions" ON prescriptions FOR SELECT USING (public.can_access_patient(patient_id));
CREATE POLICY "Doctors can insert prescriptions" ON prescriptions FOR INSERT WITH CHECK (public.has_role('DOCTOR'::user_role));

-- SUPPORTING
-- Consent
CREATE POLICY "Authorized access to consent" ON consent_records FOR SELECT USING (public.can_access_patient(patient_id));
-- Documents
CREATE POLICY "Authorized access to documents" ON documents FOR SELECT USING (public.can_access_patient(patient_id));
-- Notifications
CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT USING (recipient_id = auth.uid());

-- AUDIT LOGS
CREATE POLICY "Audit logs insertable by anyone" ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Audit logs viewable only by System Admin" ON audit_logs FOR SELECT USING (public.has_role('SYSTEM_ADMIN'::user_role));
