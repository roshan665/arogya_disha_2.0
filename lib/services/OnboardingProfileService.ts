import { supabase } from '../supabaseClient';
import { RealtimeRole } from './RealtimeCommunicationService';

export type ProfileStatus = 'PROFILE_INCOMPLETE' | 'PROFILE_COMPLETE';

export interface BaseUserProfile {
  id: string;
  role: RealtimeRole;
  profile_status: ProfileStatus;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  onboarding_draft?: any | null;
  created_at?: string;
  updated_at?: string;
}

export interface PatientProfileData {
  full_name: string;
  date_of_birth?: string;
  age?: number;
  gender: 'M' | 'F' | 'Other';
  phone: string;
  address: string;
  village: string;
  district: string;
  state: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  blood_group?: string;
  preferred_language?: string;
  known_allergies?: string[];
  existing_conditions?: string[];
  medical_history?: string;
  is_patient_provided?: boolean;
}

export interface AshaProfileData {
  full_name: string;
  phone: string;
  email?: string;
  gender?: string;
  address: string;
  asha_worker_id: string;
  assigned_village: string;
  block: string;
  district: string;
  state: string;
  primary_phc_name: string;
  primary_phc_id?: string;
  villages_served?: string[];
  availability_timing?: string;
  supervisor_name?: string;
  supervisor_phone?: string;
}

export interface PhcProfileData {
  phc_name: string;
  facility_code?: string;
  phone: string;
  email?: string;
  address: string;
  village: string;
  block: string;
  district: string;
  state: string;
  pincode: string;
  operating_hours: string;
  doctor_name: string;
  doctor_designation: string;
  doctor_contact?: string;
  department?: string;
  services_offered?: string[];
}

export interface DistrictHospitalProfileData {
  hospital_name: string;
  facility_code?: string;
  phone: string;
  emergency_phone?: string;
  email?: string;
  address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  operating_hours: string;
  services_offered?: string[];
  specialties_offered?: string[];
}

export class OnboardingProfileService {
  /**
   * Normalize input role string to one of the 4 strict roles
   */
  static normalizeRole(rawRole?: string | null): RealtimeRole {
    if (!rawRole) return 'PATIENT';
    const clean = rawRole.trim().toUpperCase();
    if (clean === 'PATIENT') return 'PATIENT';
    if (clean === 'ASHA' || clean === 'ASHA_WORKER' || clean === 'ANM') return 'ASHA';
    if (clean === 'PHC' || clean === 'MO_DOCTOR' || clean === 'PHC_DOCTOR') return 'PHC';
    if (clean === 'DISTRICT_HOSPITAL' || clean === 'SPECIALIST' || clean === 'DH_SPECIALIST')
      return 'DISTRICT_HOSPITAL';
    return 'PATIENT';
  }

  /**
   * 1. Get Profile & Onboarding Status for Authenticated User
   */
  static async getProfileStatus(userId: string): Promise<{
    user: BaseUserProfile | null;
    status: ProfileStatus;
    role: RealtimeRole;
    draft: any | null;
    roleProfile: any | null;
  }> {
    if (!userId) {
      return {
        user: null,
        status: 'PROFILE_INCOMPLETE',
        role: 'PATIENT',
        draft: null,
        roleProfile: null,
      };
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Could not fetch user profile status:', error.message);
      }

      const role = this.normalizeRole(profile?.role);
      const status: ProfileStatus =
        profile?.profile_status === 'PROFILE_COMPLETE' ? 'PROFILE_COMPLETE' : 'PROFILE_INCOMPLETE';

      let roleProfile: any = null;
      if (status === 'PROFILE_COMPLETE') {
        roleProfile = await this.getRoleProfile(userId, role);
      }

      return {
        user: profile
          ? {
              id: profile.id,
              role,
              profile_status: status,
              full_name: profile.full_name,
              phone: profile.phone,
              email: profile.email,
              onboarding_draft: profile.onboarding_draft,
            }
          : null,
        status,
        role,
        draft: profile?.onboarding_draft || null,
        roleProfile,
      };
    } catch (err: any) {
      console.warn('getProfileStatus error:', err);
      return {
        user: null,
        status: 'PROFILE_INCOMPLETE',
        role: 'PATIENT',
        draft: null,
        roleProfile: null,
      };
    }
  }

  /**
   * 2. Save Progressive Onboarding Draft (Save & Resume)
   */
  static async saveDraftProfile(userId: string, draftData: any): Promise<boolean> {
    if (!userId) throw new Error('VALIDATION_ERROR: userId is required to save draft.');

    const { error } = await supabase
      .from('profiles')
      .update({
        onboarding_draft: draftData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.warn('Failed to save onboarding draft:', error.message);
      return false;
    }
    return true;
  }

  /**
   * 3. Complete PATIENT Profile
   */
  static async completePatientProfile(
    userId: string,
    data: PatientProfileData
  ): Promise<{ success: boolean; profile?: PatientProfileData; error?: string }> {
    if (!userId) throw new Error('SECURITY_ERROR: userId is required.');

    // Required Field Validations
    if (!data.full_name || !data.full_name.trim()) {
      throw new Error('VALIDATION_ERROR: Full Name is required.');
    }
    if (!data.phone || !data.phone.trim()) {
      throw new Error('VALIDATION_ERROR: Phone Number is required.');
    }
    if (!data.address || !data.address.trim()) {
      throw new Error('VALIDATION_ERROR: Address is required.');
    }
    if (!data.village || !data.village.trim()) {
      throw new Error('VALIDATION_ERROR: Village/Town/City is required.');
    }
    if (!data.district || !data.district.trim()) {
      throw new Error('VALIDATION_ERROR: District is required.');
    }
    if (!data.state || !data.state.trim()) {
      throw new Error('VALIDATION_ERROR: State is required.');
    }
    if (!data.gender || !['M', 'F', 'Other'].includes(data.gender)) {
      throw new Error('VALIDATION_ERROR: Valid Gender (M, F, Other) is required.');
    }
    if (!data.date_of_birth && (!data.age || data.age <= 0)) {
      throw new Error('VALIDATION_ERROR: Either Date of Birth or a valid Age must be provided.');
    }

    // Phone format check (basic sanity check for digits)
    const phoneClean = data.phone.replace(/[\s-]/g, '');
    if (!/^\+?[0-9]{10,14}$/.test(phoneClean)) {
      throw new Error('VALIDATION_ERROR: Please enter a valid 10-digit mobile phone number.');
    }

    // 1. Insert/Upsert into patient_profiles table
    const { data: inserted, error: insertErr } = await supabase
      .from('patient_profiles')
      .upsert({
        user_id: userId,
        full_name: data.full_name.trim(),
        date_of_birth: data.date_of_birth || null,
        age: data.age || (data.date_of_birth ? this.calculateAge(data.date_of_birth) : null),
        gender: data.gender,
        phone: phoneClean,
        address: data.address.trim(),
        village: data.village.trim(),
        district: data.district.trim(),
        state: data.state.trim(),
        emergency_contact_name: data.emergency_contact_name?.trim() || null,
        emergency_contact_phone: data.emergency_contact_phone?.trim() || null,
        emergency_contact_relation: data.emergency_contact_relation?.trim() || null,
        blood_group: data.blood_group?.trim() || null,
        preferred_language: data.preferred_language || 'en',
        known_allergies: data.known_allergies || [],
        existing_conditions: data.existing_conditions || [],
        medical_history: data.medical_history?.trim() || null,
        is_patient_provided: true,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      throw new Error(`DB_ERROR: Failed to save patient profile: ${insertErr.message}`);
    }

    // 2. Mark profile complete in profiles table
    await supabase
      .from('profiles')
      .update({
        role: 'PATIENT',
        profile_status: 'PROFILE_COMPLETE',
        full_name: data.full_name.trim(),
        phone: phoneClean,
        onboarding_draft: null, // clear draft once completed
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    return { success: true, profile: inserted as PatientProfileData };
  }

  /**
   * 4. Complete ASHA Profile
   */
  static async completeAshaProfile(
    userId: string,
    data: AshaProfileData
  ): Promise<{ success: boolean; profile?: AshaProfileData; error?: string }> {
    if (!userId) throw new Error('SECURITY_ERROR: userId is required.');

    // Validations
    if (!data.full_name || !data.full_name.trim()) {
      throw new Error('VALIDATION_ERROR: Full Name is required.');
    }
    if (!data.phone || !data.phone.trim()) {
      throw new Error('VALIDATION_ERROR: Phone number is required.');
    }
    if (!data.asha_worker_id || !data.asha_worker_id.trim()) {
      throw new Error('VALIDATION_ERROR: ASHA Worker ID / Employee ID is required.');
    }
    if (!data.assigned_village || !data.assigned_village.trim()) {
      throw new Error('VALIDATION_ERROR: Assigned Village is required.');
    }
    if (!data.block || !data.block.trim()) {
      throw new Error('VALIDATION_ERROR: Block is required.');
    }
    if (!data.district || !data.district.trim()) {
      throw new Error('VALIDATION_ERROR: District is required.');
    }
    if (!data.state || !data.state.trim()) {
      throw new Error('VALIDATION_ERROR: State is required.');
    }
    if (!data.primary_phc_name || !data.primary_phc_name.trim()) {
      throw new Error('VALIDATION_ERROR: Primary PHC name is required.');
    }

    const phoneClean = data.phone.replace(/[\s-]/g, '');
    if (!/^\+?[0-9]{10,14}$/.test(phoneClean)) {
      throw new Error('VALIDATION_ERROR: Please enter a valid 10-digit mobile phone number.');
    }

    // 1. Insert/Upsert into asha_profiles
    const { data: inserted, error: insertErr } = await supabase
      .from('asha_profiles')
      .upsert({
        user_id: userId,
        full_name: data.full_name.trim(),
        phone: phoneClean,
        email: data.email?.trim() || null,
        gender: data.gender || 'F',
        address: data.address?.trim() || data.assigned_village.trim(),
        asha_worker_id: data.asha_worker_id.trim(),
        assigned_village: data.assigned_village.trim(),
        block: data.block.trim(),
        district: data.district.trim(),
        state: data.state.trim(),
        primary_phc_name: data.primary_phc_name.trim(),
        primary_phc_id: data.primary_phc_id || null,
        villages_served: data.villages_served && data.villages_served.length > 0 ? data.villages_served : [data.assigned_village.trim()],
        availability_timing: data.availability_timing?.trim() || '9:00 AM - 5:00 PM',
        supervisor_name: data.supervisor_name?.trim() || null,
        supervisor_phone: data.supervisor_phone?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      throw new Error(`DB_ERROR: Failed to save ASHA profile: ${insertErr.message}`);
    }

    // 2. Mark profile complete
    await supabase
      .from('profiles')
      .update({
        role: 'ASHA',
        profile_status: 'PROFILE_COMPLETE',
        full_name: data.full_name.trim(),
        phone: phoneClean,
        onboarding_draft: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    return { success: true, profile: inserted as AshaProfileData };
  }

  /**
   * 5. Complete PHC Profile
   */
  static async completePhcProfile(
    userId: string,
    data: PhcProfileData
  ): Promise<{ success: boolean; profile?: PhcProfileData; error?: string }> {
    if (!userId) throw new Error('SECURITY_ERROR: userId is required.');

    // Validations
    if (!data.phc_name || !data.phc_name.trim()) {
      throw new Error('VALIDATION_ERROR: PHC Facility Name is required.');
    }
    if (!data.phone || !data.phone.trim()) {
      throw new Error('VALIDATION_ERROR: Facility Contact Phone is required.');
    }
    if (!data.address || !data.address.trim()) {
      throw new Error('VALIDATION_ERROR: Facility Address is required.');
    }
    if (!data.village || !data.village.trim()) {
      throw new Error('VALIDATION_ERROR: Village/Town is required.');
    }
    if (!data.block || !data.block.trim()) {
      throw new Error('VALIDATION_ERROR: Block is required.');
    }
    if (!data.district || !data.district.trim()) {
      throw new Error('VALIDATION_ERROR: District is required.');
    }
    if (!data.state || !data.state.trim()) {
      throw new Error('VALIDATION_ERROR: State is required.');
    }
    if (!data.pincode || !data.pincode.trim()) {
      throw new Error('VALIDATION_ERROR: PIN Code is required.');
    }
    if (!data.operating_hours || !data.operating_hours.trim()) {
      throw new Error('VALIDATION_ERROR: Operating Hours are required.');
    }
    if (!data.doctor_name || !data.doctor_name.trim()) {
      throw new Error('VALIDATION_ERROR: Medical Officer / Doctor Name is required.');
    }
    if (!data.doctor_designation || !data.doctor_designation.trim()) {
      throw new Error('VALIDATION_ERROR: Designation is required.');
    }

    const phoneClean = data.phone.replace(/[\s-]/g, '');

    // 1. Insert/Upsert into phc_profiles
    const { data: inserted, error: insertErr } = await supabase
      .from('phc_profiles')
      .upsert({
        user_id: userId,
        phc_name: data.phc_name.trim(),
        facility_code: data.facility_code?.trim() || null,
        phone: phoneClean,
        email: data.email?.trim() || null,
        address: data.address.trim(),
        village: data.village.trim(),
        block: data.block.trim(),
        district: data.district.trim(),
        state: data.state.trim(),
        pincode: data.pincode.trim(),
        operating_hours: data.operating_hours.trim(),
        doctor_name: data.doctor_name.trim(),
        doctor_designation: data.doctor_designation.trim(),
        doctor_contact: data.doctor_contact?.trim() || phoneClean,
        department: data.department?.trim() || 'General Medicine / OPD',
        services_offered: data.services_offered || ['General Consultation', 'Basic Diagnostics', 'Immunization'],
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      throw new Error(`DB_ERROR: Failed to save PHC profile: ${insertErr.message}`);
    }

    // 2. Mark profile complete
    await supabase
      .from('profiles')
      .update({
        role: 'PHC',
        profile_status: 'PROFILE_COMPLETE',
        full_name: data.doctor_name.trim(),
        phone: phoneClean,
        onboarding_draft: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    return { success: true, profile: inserted as PhcProfileData };
  }

  /**
   * 6. Complete DISTRICT_HOSPITAL Profile
   */
  static async completeDistrictHospitalProfile(
    userId: string,
    data: DistrictHospitalProfileData
  ): Promise<{ success: boolean; profile?: DistrictHospitalProfileData; error?: string }> {
    if (!userId) throw new Error('SECURITY_ERROR: userId is required.');

    // Validations
    if (!data.hospital_name || !data.hospital_name.trim()) {
      throw new Error('VALIDATION_ERROR: District Hospital Name is required.');
    }
    if (!data.phone || !data.phone.trim()) {
      throw new Error('VALIDATION_ERROR: Contact Phone is required.');
    }
    if (!data.address || !data.address.trim()) {
      throw new Error('VALIDATION_ERROR: Hospital Address is required.');
    }
    if (!data.city || !data.city.trim()) {
      throw new Error('VALIDATION_ERROR: City is required.');
    }
    if (!data.district || !data.district.trim()) {
      throw new Error('VALIDATION_ERROR: District is required.');
    }
    if (!data.state || !data.state.trim()) {
      throw new Error('VALIDATION_ERROR: State is required.');
    }
    if (!data.pincode || !data.pincode.trim()) {
      throw new Error('VALIDATION_ERROR: PIN Code is required.');
    }
    if (!data.operating_hours || !data.operating_hours.trim()) {
      throw new Error('VALIDATION_ERROR: Operating Hours are required.');
    }

    const phoneClean = data.phone.replace(/[\s-]/g, '');

    // 1. Insert/Upsert into district_hospital_profiles
    const { data: inserted, error: insertErr } = await supabase
      .from('district_hospital_profiles')
      .upsert({
        user_id: userId,
        hospital_name: data.hospital_name.trim(),
        facility_code: data.facility_code?.trim() || null,
        phone: phoneClean,
        emergency_phone: data.emergency_phone?.trim() || null,
        email: data.email?.trim() || null,
        address: data.address.trim(),
        city: data.city.trim(),
        district: data.district.trim(),
        state: data.state.trim(),
        pincode: data.pincode.trim(),
        operating_hours: data.operating_hours.trim(),
        services_offered: data.services_offered || ['Emergency Care', 'Specialist Consultation', 'Inpatient Care'],
        specialties_offered: data.specialties_offered || ['Cardiology', 'Obstetrics & Gynecology', 'Pediatrics', 'Surgery'],
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      throw new Error(`DB_ERROR: Failed to save District Hospital profile: ${insertErr.message}`);
    }

    // 2. Mark profile complete
    await supabase
      .from('profiles')
      .update({
        role: 'DISTRICT_HOSPITAL',
        profile_status: 'PROFILE_COMPLETE',
        full_name: data.hospital_name.trim(),
        phone: phoneClean,
        onboarding_draft: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    return { success: true, profile: inserted as DistrictHospitalProfileData };
  }

  /**
   * 7. Fetch Real Role-Specific Profile Data
   */
  static async getRoleProfile(userId: string, role: RealtimeRole): Promise<any | null> {
    if (!userId) return null;

    try {
      const normalizedRole = this.normalizeRole(role);
      let table = 'patient_profiles';
      if (normalizedRole === 'ASHA') table = 'asha_profiles';
      else if (normalizedRole === 'PHC') table = 'phc_profiles';
      else if (normalizedRole === 'DISTRICT_HOSPITAL') table = 'district_hospital_profiles';

      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn(`Error fetching ${table} for ${userId}:`, error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.warn('getRoleProfile exception:', err);
      return null;
    }
  }

  /**
   * 8. Update Permitted Profile Fields (Cannot change role or unauthorized assignments)
   */
  static async updateRoleProfile(
    userId: string,
    role: RealtimeRole,
    updatedFields: Record<string, any>,
    requesterUserId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!userId) throw new Error('SECURITY_ERROR: userId is required.');
    if (requesterUserId && requesterUserId !== userId) {
      throw new Error('SECURITY_ERROR: Unauthorized: You can only edit your own profile.');
    }

    const normalizedRole = this.normalizeRole(role);
    let table = 'patient_profiles';
    if (normalizedRole === 'ASHA') table = 'asha_profiles';
    else if (normalizedRole === 'PHC') table = 'phc_profiles';
    else if (normalizedRole === 'DISTRICT_HOSPITAL') table = 'district_hospital_profiles';

    // Strip forbidden fields that only administrators can modify
    const safePayload = { ...updatedFields };
    delete safePayload.user_id;
    delete safePayload.role;
    delete safePayload.id;
    delete safePayload.created_at;

    // ASHA cannot arbitrarily change assigned PHC or worker ID
    if (normalizedRole === 'ASHA') {
      delete safePayload.primary_phc_id;
      delete safePayload.asha_worker_id;
    }

    safePayload.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from(table)
      .update(safePayload)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`DB_ERROR: Failed to update profile: ${error.message}`);
    }

    if (safePayload.full_name || safePayload.phone || safePayload.doctor_name || safePayload.hospital_name) {
      const name =
        safePayload.full_name || safePayload.doctor_name || safePayload.hospital_name;
      await supabase
        .from('profiles')
        .update({
          ...(name ? { full_name: name } : {}),
          ...(safePayload.phone ? { phone: safePayload.phone } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    }

    return { success: true };
  }

  private static calculateAge(dobString: string): number {
    const dob = new Date(dobString);
    const diffMs = Date.now() - dob.getTime();
    const ageDate = new Date(diffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }
}
