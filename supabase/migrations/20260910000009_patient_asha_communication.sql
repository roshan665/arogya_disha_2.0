-- Phase 12: Patient-ASHA Realtime Communication & Escalations
-- 20260910000009_patient_asha_communication.sql

-- 1. Patient Assistance Requests Table
CREATE TABLE IF NOT EXISTS patient_assistance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    asha_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL, -- 'GENERAL_ASSISTANCE', 'HOME_VISIT', 'SYMPTOM_CONCERN', 'MEDICINE_REFILL', 'ANC_CHECKUP'
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'CONTACTED', 'VISIT_SCHEDULED', 'FOLLOW_UP_REQUIRED', 'COMPLETED'
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexing for fast queries
CREATE INDEX IF NOT EXISTS idx_assistance_requests_patient ON patient_assistance_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_assistance_requests_asha ON patient_assistance_requests(asha_id);
CREATE INDEX IF NOT EXISTS idx_assistance_requests_status ON patient_assistance_requests(status);

-- Enable RLS
ALTER TABLE patient_assistance_requests ENABLE ROW LEVEL SECURITY;

-- RLS: Patient can only view their own requests
CREATE POLICY "Patients can view own assistance requests"
ON patient_assistance_requests FOR SELECT
USING (
    patient_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM caregivers c
        WHERE c.caregiver_id = auth.uid() AND c.patient_id = patient_assistance_requests.patient_id
    ) OR
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN patients pt ON pt.id = patient_assistance_requests.patient_id
        WHERE p.id = auth.uid()
    )
);

-- RLS: Patient can insert their own assistance requests
CREATE POLICY "Patients can insert own assistance requests"
ON patient_assistance_requests FOR INSERT
WITH CHECK (
    auth.role() = 'authenticated'
);

-- RLS: ASHA can view requests only for assigned patients
CREATE POLICY "ASHAs can view assistance requests for assigned patients"
ON patient_assistance_requests FOR SELECT
USING (
    asha_id = auth.uid() OR
    public.is_assigned_asha(patient_id)
);

-- RLS: ASHA can update requests for assigned patients
CREATE POLICY "ASHAs can update assistance requests for assigned patients"
ON patient_assistance_requests FOR UPDATE
USING (
    asha_id = auth.uid() OR
    public.is_assigned_asha(patient_id)
)
WITH CHECK (
    asha_id = auth.uid() OR
    public.is_assigned_asha(patient_id)
);

-- 2. ASHA Follow-Up Records Table
CREATE TABLE IF NOT EXISTS asha_follow_up_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    asha_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    follow_up_type TEXT NOT NULL, -- 'patient_contacted', 'home_visit_completed', 'patient_missed_appointment', 'patient_needs_phc_consultation', 'follow_up_required'
    public_patient_update TEXT NOT NULL, -- Safe update visible to patient
    internal_asha_notes TEXT, -- Confidential clinical notes for ASHA and Doctor only
    escalate_to_phc BOOLEAN DEFAULT false NOT NULL,
    phc_facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
    scheduled_date DATE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_asha_follow_up_patient ON asha_follow_up_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_asha_follow_up_asha ON asha_follow_up_records(asha_id);
CREATE INDEX IF NOT EXISTS idx_asha_follow_up_phc ON asha_follow_up_records(phc_facility_id) WHERE escalate_to_phc = true;

-- Enable RLS
ALTER TABLE asha_follow_up_records ENABLE ROW LEVEL SECURITY;

-- RLS: Patient can read their follow-up records (public patient updates)
CREATE POLICY "Patients can read follow-ups for themselves"
ON asha_follow_up_records FOR SELECT
USING (
    patient_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM caregivers c
        WHERE c.caregiver_id = auth.uid() AND c.patient_id = asha_follow_up_records.patient_id
    ) OR
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN patients pt ON pt.id = asha_follow_up_records.patient_id
        WHERE p.id = auth.uid()
    )
);

-- RLS: ASHA can manage follow-up records for assigned patients
CREATE POLICY "ASHAs can manage follow-ups for assigned patients"
ON asha_follow_up_records FOR ALL
USING (
    asha_id = auth.uid() OR
    public.is_assigned_asha(patient_id)
);

-- RLS: PHC Doctors can view escalated follow-up records
CREATE POLICY "PHC staff can view escalated follow-ups"
ON asha_follow_up_records FOR SELECT
USING (
    escalate_to_phc = true AND
    EXISTS (
        SELECT 1 FROM facility_users fu
        WHERE fu.user_id = auth.uid() AND fu.facility_id = asha_follow_up_records.phc_facility_id
    )
);
