# Arogyadisha Database Schema

This document outlines the Phase 1 Database Foundation for the Arogyadisha platform, running on Supabase (PostgreSQL).

## Overview
The schema is designed to support offline-first rural health delivery with a focus on comprehensive clinical tracking, strict identity management, secure auditing, and versioned clinical records.

## Custom Enums
- **`user_role`**: `asha_worker`, `anm`, `mo_doctor`, `specialist`, `admin`, `patient`, `facility_manager`
- **`risk_level`**: `GREEN`, `YELLOW`, `RED`, `CRITICAL`
- **`referral_status`**: `pending`, `accepted`, `in_transit`, `admitted`, `completed`, `cancelled`, `rejected`
- **`appointment_status`**: `scheduled`, `arrived`, `in_progress`, `completed`, `cancelled`, `no_show`
- **`consent_category`**: `data_storage`, `data_sharing`, `ai_analysis`, `notifications`, `caregiver_access`, `research`
- **`consent_status`**: `granted`, `revoked`, `expired`
- **`entity_type`**: `patient`, `referral`, `appointment`, `visit`, `prescription`, `care_episode`
- **`document_type`**: `lab_report`, `prescription`, `id_proof`, `scan`, `other`
- **`assignment_type`**: `primary`, `temporary`

---

## 1. Identity & Facilities

### `facilities`
- `id` (UUID, PK)
- `name` (TEXT)
- `type` (TEXT) - e.g., 'PHC', 'District Hospital'
- `district` (TEXT), `state` (TEXT), `contact_number` (TEXT)
- `is_active` (BOOLEAN)

### `departments`
- `id` (UUID, PK)
- `facility_id` (UUID, FK -> facilities.id)
- `name` (TEXT), `description` (TEXT)

### `profiles` (Extends Supabase `auth.users`)
- `id` (UUID, PK, FK -> auth.users.id)
- `full_name` (TEXT)
- `phone` (TEXT)

### `user_roles`
- `id` (UUID, PK)
- `user_id` (UUID, FK -> profiles.id)
- `role` (`user_role`)

### `facility_users`
- `id` (UUID, PK)
- `user_id` (UUID, FK -> profiles.id)
- `facility_id` (UUID, FK -> facilities.id)
- `department_id` (UUID, FK -> departments.id)
- `is_active` (BOOLEAN)

---

## 2. Patient Entities

### `patients`
- `id` (UUID, PK)
- `patient_id` (TEXT, UNIQUE) - System generated sequence (e.g. `P-1002345`)
- `first_name`, `last_name`, `date_of_birth`, `gender`, `blood_group`
- `address`, `village`, `district`, `pincode`

### `patient_identifiers`
- `id` (UUID, PK)
- `patient_id` (UUID, FK -> patients.id)
- `identifier_type` (TEXT) - e.g. 'Aadhaar', 'ABHA'
- `identifier_value` (TEXT)
- `is_verified` (BOOLEAN)

### `patient_asha_assignments`
- `id` (UUID, PK)
- `patient_id` (UUID, FK -> patients.id)
- `asha_id` (UUID, FK -> profiles.id)
- `assignment_type` (`assignment_type`) - 'primary' or 'temporary'
- `valid_from` (TIMESTAMPTZ), `valid_until` (TIMESTAMPTZ)

### `caregivers` & `caregiver_permissions`
- Links a `patient_id` to a `caregiver_id` (another profile).
- Permissions are strictly tracked for data access control.

---

## 3. Healthcare Entities

### `care_episodes`
- Groups multiple clinical events (visits, referrals, prescriptions) under one logical episode of care.
- `patient_id` (UUID, FK -> patients.id), `status` (TEXT)

### `asha_visits`
- `patient_id` (UUID, FK), `asha_id` (UUID, FK), `care_episode_id` (UUID, FK)
- `symptoms` (JSONB), `vitals` (JSONB), `risk_score` (`risk_level`)

### `referrals`
- `patient_id` (UUID, FK), `source_facility_id` (UUID, FK), `destination_facility_id` (UUID, FK)
- `urgency` (`risk_level`), `status` (`referral_status`)

### `appointment_slots` & `appointments`
- Links `doctor_id` to specific time blocks at a facility/department.
- `appointments` link patients to `appointment_slots`.

### `consultations`, `prescriptions`, `prescription_items`, `diagnostics`
- Standard clinical tracking entities linked via foreign keys to the patient, doctor, and specific care episode.

### `follow_ups` & `treatment_outcomes`
- Used for continuum of care tracking.

---

## 4. Supporting Entities

### `documents`
- Version-controlled document storage referencing `supersedes_id` for document updates without destructive deletion.

### `consent_records`
- `patient_id` (UUID, FK)
- `category` (`consent_category`), `status` (`consent_status`)
- Versioned via `supersedes_id` to maintain a strict history of patient consent.

### `notifications`
- Targeted messaging system linked to specific events (referrals, appointments).

### `audit_logs`
- Secure, **append-only** table (Updates and Deletes are blocked via PostgreSQL rules).
- Tracks `actor_id`, `entity_type`, `entity_id`, `action`, `before_state`, and `after_state`.

---

## Indexing Strategy
Indexes are applied to heavily queried foreign keys and search fields to optimize read performance on large tables, such as:
- `patients.patient_id`
- `patient_identifiers.identifier_value`
- `asha_visits.patient_id` and `asha_visits.asha_id`
- `referrals.status` and `referrals.destination_facility_id`
- `audit_logs.created_at`

## Constraints & Data Integrity
- **Cascading Deletes**: Enabled heavily for child entities (e.g., deleting a patient deletes their identifiers and assignments).
- **Unique Constraints**: Prevents duplicate primary ASHA assignments and duplicate identifiers.
- **Auto-Timestamps**: `created_at` and `updated_at` are managed automatically via triggers on all tables.

---

## 5. Security & Authorization (Row Level Security)

All tables in the database have **Row Level Security (RLS)** enabled, adhering strictly to a contextual access model. Access is evaluated continuously based on `Role + Care Relationship + Facility`.

### Security Definer Functions
To keep policies fast and clean, authorization logic is centralized in Supabase `SECURITY DEFINER` helper functions:
- `auth.has_role(_role)`: Verifies single role.
- `auth.has_any_role(_roles[])`: Verifies multiple roles.
- `auth.is_assigned_asha(_patient_id)`: Verifies if the active user is the assigned ASHA for a patient.
- `auth.is_facility_staff_for_patient(_patient_id)`: Checks if a doctor/staff is at a facility with an active referral or care episode for the patient.
- `auth.is_patient_or_caregiver(_patient_id)`: Checks if the user is linked as an authorized caregiver.
- `auth.can_access_patient(_patient_id)`: The master function used across clinical tables to evaluate all contextual rules.

### Access Rules Enforced

**Patients & Clinical Records (Visits, Appointments, Consultations, Referrals)**
- **Patient/Caregiver**: Can `SELECT` only their own records.
- **ASHA Worker**: Can `SELECT`, `INSERT`, `UPDATE` records only for patients currently assigned to them.
- **Doctor / Hospital Staff**: Can access clinical records only if the patient has an active connection (appointment, referral) to the facility they operate in.
- **System Admin**: Broad access for administration, bypasses most localized checks.

**Audit Logs**
- Secure by design: `UPDATE` and `DELETE` queries on `audit_logs` are completely disabled at the PostgreSQL Rule level.
- Any authenticated user/function can `INSERT`.
- Only `SYSTEM_ADMIN` can `SELECT` from the audit logs.

**Unauthorized Access Behavior**
Any query failing these checks will instantly return `0 rows` without exposing errors, effectively sandboxing every actor to their authorized scope.
