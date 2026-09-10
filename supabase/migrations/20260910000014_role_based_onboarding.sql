-- Phase 15: Role-Based Profile & Onboarding System
-- 20260910000014_role_based_onboarding.sql

-- 1. Profile Status Enum & Column in Profiles
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profile_status_enum') THEN
        CREATE TYPE profile_status_enum AS ENUM ('PROFILE_INCOMPLETE', 'PROFILE_COMPLETE');
    END IF;
END $$;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'PATIENT',
ADD COLUMN IF NOT EXISTS profile_status profile_status_enum DEFAULT 'PROFILE_INCOMPLETE',
ADD COLUMN IF NOT EXISTS onboarding_draft JSONB DEFAULT NULL;

-- 2. Role-Specific Profile Tables

-- A. Patient Profiles
CREATE TABLE IF NOT EXISTS patient_profiles (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    date_of_birth DATE,
    age INT,
    gender TEXT CHECK (gender IN ('M', 'F', 'Other')),
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    village TEXT NOT NULL,
    district TEXT NOT NULL,
    state TEXT NOT NULL,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relation TEXT,
    blood_group TEXT,
    preferred_language TEXT DEFAULT 'en',
    known_allergies TEXT[] DEFAULT '{}',
    existing_conditions TEXT[] DEFAULT '{}',
    medical_history TEXT,
    is_patient_provided BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- B. ASHA Profiles
CREATE TABLE IF NOT EXISTS asha_profiles (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    gender TEXT,
    address TEXT,
    asha_worker_id TEXT NOT NULL,
    assigned_village TEXT NOT NULL,
    block TEXT NOT NULL,
    district TEXT NOT NULL,
    state TEXT NOT NULL,
    primary_phc_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
    primary_phc_name TEXT NOT NULL,
    villages_served TEXT[] DEFAULT '{}',
    availability_timing TEXT,
    supervisor_name TEXT,
    supervisor_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- C. PHC Profiles
CREATE TABLE IF NOT EXISTS phc_profiles (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
    phc_name TEXT NOT NULL,
    facility_code TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT NOT NULL,
    village TEXT NOT NULL,
    block TEXT NOT NULL,
    district TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    operating_hours TEXT NOT NULL,
    doctor_name TEXT NOT NULL,
    doctor_designation TEXT NOT NULL,
    doctor_contact TEXT,
    department TEXT,
    services_offered TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- D. District Hospital Profiles
CREATE TABLE IF NOT EXISTS district_hospital_profiles (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
    hospital_name TEXT NOT NULL,
    facility_code TEXT,
    phone TEXT NOT NULL,
    emergency_phone TEXT,
    email TEXT,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    operating_hours TEXT NOT NULL,
    services_offered TEXT[] DEFAULT '{}',
    specialties_offered TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_patient_profiles_phone ON patient_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_asha_profiles_phc ON asha_profiles(primary_phc_id);
CREATE INDEX IF NOT EXISTS idx_asha_profiles_village ON asha_profiles(assigned_village);
CREATE INDEX IF NOT EXISTS idx_phc_profiles_district ON phc_profiles(district);
CREATE INDEX IF NOT EXISTS idx_district_hospital_profiles_district ON district_hospital_profiles(district);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE asha_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE phc_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE district_hospital_profiles ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Patient Profiles Policies
CREATE POLICY "Patients can view own profile" 
ON patient_profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Patients can insert own profile" 
ON patient_profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Patients can update own profile" 
ON patient_profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Healthcare staff can view patient profiles for care" 
ON patient_profiles FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() 
        AND p.role IN ('ASHA', 'PHC', 'DISTRICT_HOSPITAL', 'asha_worker', 'mo_doctor', 'specialist', 'admin')
    )
);

-- ASHA Profiles Policies
CREATE POLICY "ASHA can view own profile" 
ON asha_profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "ASHA can insert own profile" 
ON asha_profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ASHA can update own profile" 
ON asha_profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "PHC and Admin can view ASHA profiles" 
ON asha_profiles FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() 
        AND p.role IN ('PHC', 'DISTRICT_HOSPITAL', 'mo_doctor', 'admin')
    )
);

-- PHC Profiles Policies
CREATE POLICY "PHC staff can view own profile" 
ON phc_profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "PHC staff can insert own profile" 
ON phc_profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "PHC staff can update own profile" 
ON phc_profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "All authenticated users can view active PHC profiles for directory" 
ON phc_profiles FOR SELECT 
USING (auth.role() = 'authenticated');

-- District Hospital Profiles Policies
CREATE POLICY "DH staff can view own profile" 
ON district_hospital_profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "DH staff can insert own profile" 
ON district_hospital_profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "DH staff can update own profile" 
ON district_hospital_profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "All authenticated users can view active DH profiles for referral directory" 
ON district_hospital_profiles FOR SELECT 
USING (auth.role() = 'authenticated');
