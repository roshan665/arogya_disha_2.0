-- Phase 10: Offline Sync, Security, Consent, Emergency
-- 20260904000007_phase10_sync_emergency.sql

-- 1. Sync Idempotency & Conflict Detection (MVCC)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 NOT NULL;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 NOT NULL;

CREATE TABLE sync_queue_logs (
    transaction_id TEXT PRIMARY KEY,
    actor_id UUID NOT NULL REFERENCES profiles(id),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Versioned Append-Only Consent
DROP TABLE IF EXISTS patient_consents CASCADE;
DROP TABLE IF EXISTS consent_records CASCADE;
DROP TYPE IF EXISTS consent_status CASCADE;

CREATE TYPE consent_status AS ENUM ('GRANTED', 'REVOKED');

CREATE TABLE patient_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    actor_id UUID NOT NULL REFERENCES profiles(id), -- Who collected/recorded it
    granted_to_facility_id UUID REFERENCES facilities(id),
    granted_to_user_id UUID REFERENCES profiles(id),
    scope TEXT NOT NULL, -- e.g., 'ALL_CLINICAL_RECORDS', 'EMERGENCY_ONLY'
    status consent_status DEFAULT 'GRANTED' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS: Strict Append-Only for Consents
ALTER TABLE patient_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Consents are viewable by authorized personnel" ON patient_consents FOR SELECT USING (true);
CREATE POLICY "Consents are insert-only" ON patient_consents FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE RULE prevent_update_consents AS ON UPDATE TO patient_consents DO INSTEAD NOTHING;
CREATE RULE prevent_delete_consents AS ON DELETE TO patient_consents DO INSTEAD NOTHING;

-- 3. Emergency & Priority Overrides
-- Extending audit_logs capabilities is inherent since it takes JSON.
-- We ensure audit logs are strictly append-only.
CREATE RULE prevent_update_audit_logs AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE prevent_delete_audit_logs AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
