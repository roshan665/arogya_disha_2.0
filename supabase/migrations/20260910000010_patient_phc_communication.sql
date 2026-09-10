-- Phase 12: Secure Realtime Communication between PATIENT and PHC
-- 20260910000010_patient_phc_communication.sql

-- 1. Create PHC Appointments Table
CREATE TABLE IF NOT EXISTS phc_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (
        status IN ('REQUESTED', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW')
    ),
    consult_type TEXT NOT NULL DEFAULT 'General OPD',
    preferred_date DATE NOT NULL,
    preferred_time_slot TEXT NOT NULL,
    check_in_time TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for high-performance querying
CREATE INDEX IF NOT EXISTS idx_phc_appointments_patient ON phc_appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_phc_appointments_facility ON phc_appointments(facility_id);
CREATE INDEX IF NOT EXISTS idx_phc_appointments_status ON phc_appointments(status);
CREATE INDEX IF NOT EXISTS idx_phc_appointments_date ON phc_appointments(preferred_date);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE phc_appointments;

-- Enable RLS
ALTER TABLE phc_appointments ENABLE ROW LEVEL SECURITY;

-- RLS Policies on phc_appointments
CREATE POLICY "Patients can view their own PHC appointments"
ON phc_appointments FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Patients can request PHC appointments"
ON phc_appointments FOR INSERT
WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients can update own appointment checkin or cancellation"
ON phc_appointments FOR UPDATE
USING (auth.uid() = patient_id)
WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "PHC staff can view appointments for their facility"
ON phc_appointments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM facility_users fu
        WHERE fu.user_id = auth.uid()
          AND fu.facility_id = phc_appointments.facility_id
          AND fu.is_active = true
    )
);

CREATE POLICY "PHC staff can update appointments for their facility"
ON phc_appointments FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM facility_users fu
        WHERE fu.user_id = auth.uid()
          AND fu.facility_id = phc_appointments.facility_id
          AND fu.is_active = true
    )
);

-- 2. Create PHC Consultations Table
CREATE TABLE IF NOT EXISTS phc_consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES phc_appointments(id) ON DELETE SET NULL,
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    public_summary TEXT NOT NULL,
    internal_clinical_notes TEXT,
    completed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_phc_consultations_patient ON phc_consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_phc_consultations_facility ON phc_consultations(facility_id);

ALTER PUBLICATION supabase_realtime ADD TABLE phc_consultations;
ALTER TABLE phc_consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view public summaries of their consultations"
ON phc_consultations FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "PHC doctors and staff can view full consultations for their facility"
ON phc_consultations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM facility_users fu
        WHERE fu.user_id = auth.uid()
          AND fu.facility_id = phc_consultations.facility_id
          AND fu.is_active = true
    )
);

CREATE POLICY "PHC doctors can insert consultation records"
ON phc_consultations FOR INSERT
WITH CHECK (
    auth.uid() = doctor_id AND
    EXISTS (
        SELECT 1 FROM facility_users fu
        WHERE fu.user_id = auth.uid()
          AND fu.facility_id = phc_consultations.facility_id
          AND fu.is_active = true
    )
);

-- 3. Create Patient Diagnostic Reports Table
CREATE TABLE IF NOT EXISTS patient_diagnostic_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    test_type TEXT NOT NULL,
    report_title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'PENDING', 'PROCESSING')),
    file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_patient_diag_reports_patient ON patient_diagnostic_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_diag_reports_facility ON patient_diagnostic_reports(facility_id);

ALTER PUBLICATION supabase_realtime ADD TABLE patient_diagnostic_reports;
ALTER TABLE patient_diagnostic_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view their own diagnostic reports"
ON patient_diagnostic_reports FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "PHC staff can view diagnostic reports for their facility"
ON patient_diagnostic_reports FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM facility_users fu
        WHERE fu.user_id = auth.uid()
          AND fu.facility_id = patient_diagnostic_reports.facility_id
          AND fu.is_active = true
    )
);

CREATE POLICY "Authorized lab and PHC staff can insert diagnostic reports"
ON patient_diagnostic_reports FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM facility_users fu
        WHERE fu.user_id = auth.uid()
          AND fu.facility_id = patient_diagnostic_reports.facility_id
          AND fu.is_active = true
    )
);
