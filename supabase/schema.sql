-- ==============================================================================
-- ArogyaDisha Healthcare Platform - Database Schema
-- Supabase PostgreSQL Setup for Offline-First Rural Health Delivery
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Custom Enumeration Types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'asha_worker',
        'anm',
        'mo_doctor',
        'specialist',
        'admin'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE risk_level AS ENUM (
        'GREEN',
        'YELLOW',
        'RED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE sync_state AS ENUM (
        'synced',
        'pending',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE referral_status AS ENUM (
        'pending',
        'accepted',
        'in_transit',
        'admitted',
        'completed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'asha_worker',
    phone TEXT,
    facility_name TEXT DEFAULT 'Primary Health Centre (PHC)',
    district TEXT,
    sub_center TEXT,
    abha_hpr_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Patients Table
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    abha_id TEXT UNIQUE,
    name TEXT NOT NULL,
    age INT CHECK (age >= 0 AND age <= 125),
    gender TEXT CHECK (gender IN ('M', 'F', 'Other')),
    contact_number TEXT,
    village TEXT NOT NULL,
    household_number TEXT,
    assigned_worker_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    last_risk_score risk_level DEFAULT 'GREEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Clinical Visits Table
CREATE TABLE IF NOT EXISTS public.visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    symptoms JSONB NOT NULL DEFAULT '[]'::jsonb,
    vitals JSONB NOT NULL DEFAULT '{}'::jsonb,
    risk_score risk_level NOT NULL DEFAULT 'GREEN',
    ai_summary TEXT,
    recommended_action TEXT,
    marathi_translation TEXT,
    sync_status sync_state NOT NULL DEFAULT 'synced',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Emergency & Higher Center Referrals Table
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    referring_worker_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_facility TEXT NOT NULL,
    department TEXT NOT NULL,
    urgency risk_level NOT NULL DEFAULT 'RED',
    clinical_notes TEXT,
    status referral_status NOT NULL DEFAULT 'pending',
    ambulance_dispatched BOOLEAN NOT NULL DEFAULT false,
    ambulance_eta_mins INT,
    attending_doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. High-Performance Indices
CREATE INDEX IF NOT EXISTS idx_patients_assigned_worker ON public.patients(assigned_worker_id);
CREATE INDEX IF NOT EXISTS idx_patients_village ON public.patients(village);
CREATE INDEX IF NOT EXISTS idx_patients_abha ON public.patients(abha_id);

CREATE INDEX IF NOT EXISTS idx_visits_patient ON public.visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_worker ON public.visits(worker_id);
CREATE INDEX IF NOT EXISTS idx_visits_risk_score ON public.visits(risk_score);
CREATE INDEX IF NOT EXISTS idx_visits_created ON public.visits(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referrals_patient ON public.referrals(patient_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_urgency ON public.referrals(urgency);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON public.referrals(created_at DESC);

-- 8. Auto-Updated Timestamp Triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_patients_updated_at ON public.patients;
CREATE TRIGGER set_patients_updated_at
    BEFORE UPDATE ON public.patients
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_visits_updated_at ON public.visits;
CREATE TRIGGER set_visits_updated_at
    BEFORE UPDATE ON public.visits
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_referrals_updated_at ON public.referrals;
CREATE TRIGGER set_referrals_updated_at
    BEFORE UPDATE ON public.referrals
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 9. Automatically Create Profile on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Healthcare Worker'),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'asha_worker'::user_role)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies
-- Profiles: Authenticated users can read all profiles and update their own
CREATE POLICY "Profiles are viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Patients: Authenticated healthcare workers can view and manage patients
CREATE POLICY "Authenticated workers can view patients"
    ON public.patients FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated workers can insert patients"
    ON public.patients FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated workers can update patients"
    ON public.patients FOR UPDATE
    TO authenticated
    USING (true);

-- Visits: Authenticated workers can view and record visits
CREATE POLICY "Authenticated workers can view visits"
    ON public.visits FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated workers can insert visits"
    ON public.visits FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated workers can update visits"
    ON public.visits FOR UPDATE
    TO authenticated
    USING (true);

-- Referrals: Full access for authenticated staff (ASHA/Doctors/District dispatch)
CREATE POLICY "Authenticated workers can view referrals"
    ON public.referrals FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated workers can create referrals"
    ON public.referrals FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated workers can update referrals"
    ON public.referrals FOR UPDATE
    TO authenticated
    USING (true);

-- 12. Supabase Realtime Publication for Live Emergency Triage & Referrals
ALTER PUBLICATION supabase_realtime ADD TABLE public.referrals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;
