-- Phase 13: Secure Realtime Communication between PHC and DISTRICT_HOSPITAL
-- 20260910000011_phc_district_hospital_communication.sql

-- 1. Create Hospital Referrals Table (High-security escalation workflow)
CREATE TABLE IF NOT EXISTS hospital_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    source_facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE, -- Referring PHC
    destination_facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE, -- Destination District Hospital
    referring_doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_specialist_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'YELLOW' CHECK (priority IN ('RED', 'YELLOW', 'GREEN')),
    reason TEXT NOT NULL,
    clinical_summary TEXT NOT NULL,
    relevant_report_ids JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'CREATED' CHECK (
        status IN (
            'CREATED',
            'RECEIVED',
            'UNDER_REVIEW',
            'ACCEPTED',
            'REJECTED',
            'ADDITIONAL_INFORMATION_REQUIRED',
            'APPOINTMENT_SCHEDULED',
            'IN_PROGRESS',
            'COMPLETED',
            'RETURNED_TO_PHC'
        )
    ),
    rejection_reason TEXT,
    scheduled_appointment_date DATE,
    scheduled_appointment_time TEXT,
    additional_info_requested TEXT,
    additional_info_provided TEXT,
    treatment_summary TEXT,
    follow_up_instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for high-speed routing & facility isolation queries
CREATE INDEX IF NOT EXISTS idx_hospital_referrals_source ON hospital_referrals(source_facility_id);
CREATE INDEX IF NOT EXISTS idx_hospital_referrals_destination ON hospital_referrals(destination_facility_id);
CREATE INDEX IF NOT EXISTS idx_hospital_referrals_patient ON hospital_referrals(patient_id);
CREATE INDEX IF NOT EXISTS idx_hospital_referrals_status ON hospital_referrals(status);
CREATE INDEX IF NOT EXISTS idx_hospital_referrals_priority ON hospital_referrals(priority);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE hospital_referrals;

-- Enable Row-Level Security
ALTER TABLE hospital_referrals ENABLE ROW LEVEL SECURITY;

-- 2. RLS Security Policies for Strict Facility Isolation
-- PHC staff can select referrals where their facility is the SOURCE
CREATE POLICY "PHC staff can view own outgoing referrals"
ON hospital_referrals FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM facility_users fu
        WHERE fu.user_id = auth.uid()
          AND fu.facility_id = hospital_referrals.source_facility_id
          AND fu.is_active = true
    )
);

-- District Hospital staff can select referrals where their facility is the DESTINATION
CREATE POLICY "District Hospital staff can view incoming referrals"
ON hospital_referrals FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM facility_users fu
        WHERE fu.user_id = auth.uid()
          AND fu.facility_id = hospital_referrals.destination_facility_id
          AND fu.is_active = true
    )
);

-- PHC staff can INSERT new referrals from their facility
CREATE POLICY "PHC staff can create referrals"
ON hospital_referrals FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM facility_users fu
        WHERE fu.user_id = auth.uid()
          AND fu.facility_id = hospital_referrals.source_facility_id
          AND fu.is_active = true
    )
);

-- District Hospital staff can UPDATE referral status, schedule appointments, or request info
CREATE POLICY "District Hospital staff can update assigned referrals"
ON hospital_referrals FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM facility_users fu
        WHERE fu.user_id = auth.uid()
          AND fu.facility_id = hospital_referrals.destination_facility_id
          AND fu.is_active = true
    )
);

-- PHC staff can UPDATE referrals to submit additional requested info
CREATE POLICY "PHC staff can respond to additional info requests"
ON hospital_referrals FOR UPDATE
USING (
    status = 'ADDITIONAL_INFORMATION_REQUIRED' AND
    EXISTS (
        SELECT 1 FROM facility_users fu
        WHERE fu.user_id = auth.uid()
          AND fu.facility_id = hospital_referrals.source_facility_id
          AND fu.is_active = true
    )
);

-- Patient can view referral status for their own record
CREATE POLICY "Patients can view their own hospital referrals"
ON hospital_referrals FOR SELECT
USING (auth.uid() = patient_id);
