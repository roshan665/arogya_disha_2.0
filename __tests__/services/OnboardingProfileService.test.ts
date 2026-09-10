import { OnboardingProfileService } from '../../lib/services/OnboardingProfileService';
import { supabase } from '../../lib/supabaseClient';

jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('OnboardingProfileService & Role-Based RBAC Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Role Normalization', () => {
    it('normalizes various role representations to the 4 exact canonical roles', () => {
      expect(OnboardingProfileService.normalizeRole('patient')).toBe('PATIENT');
      expect(OnboardingProfileService.normalizeRole('PATIENT')).toBe('PATIENT');
      expect(OnboardingProfileService.normalizeRole('asha_worker')).toBe('ASHA');
      expect(OnboardingProfileService.normalizeRole('ASHA')).toBe('ASHA');
      expect(OnboardingProfileService.normalizeRole('phc_doctor')).toBe('PHC');
      expect(OnboardingProfileService.normalizeRole('PHC')).toBe('PHC');
      expect(OnboardingProfileService.normalizeRole('district_hospital')).toBe('DISTRICT_HOSPITAL');
      expect(OnboardingProfileService.normalizeRole('DISTRICT_HOSPITAL')).toBe('DISTRICT_HOSPITAL');
      expect(OnboardingProfileService.normalizeRole('UNKNOWN' as any)).toBe('PATIENT');
    });
  });

  describe('2. PATIENT Onboarding & Validation', () => {
    it('rejects patient onboarding when required fields are missing', async () => {
      await expect(
        OnboardingProfileService.completePatientProfile('u-pat-1', {
          full_name: '',
          phone: '9840219283',
          address: 'Ward 2',
          village: 'Dhamangaon',
          district: 'Raigad',
          state: 'Maharashtra',
          gender: 'M',
          age: 28,
        })
      ).rejects.toThrow('VALIDATION_ERROR: Full Name is required.');
    });

    it('rejects patient onboarding when phone number is invalid', async () => {
      await expect(
        OnboardingProfileService.completePatientProfile('u-pat-1', {
          full_name: 'Roshan Sahani',
          phone: '123',
          address: 'Ward 2',
          village: 'Dhamangaon',
          district: 'Raigad',
          state: 'Maharashtra',
          gender: 'M',
          age: 28,
        })
      ).rejects.toThrow('VALIDATION_ERROR: Please enter a valid 10-digit mobile phone number.');
    });

    it('successfully completes patient profile and marks profile_status = COMPLETE', async () => {
      const mockPatientUpsert = jest.fn().mockReturnValue({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'pp-1',
                user_id: 'u-pat-1',
                full_name: 'Roshan Sahani',
                is_patient_provided: true,
              },
              error: null,
            }),
        }),
      });

      const mockProfilesUpdate = jest.fn().mockReturnValue({
        eq: () => Promise.resolve({ error: null }),
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'patient_profiles') {
          return { upsert: mockPatientUpsert };
        }
        if (table === 'profiles') {
          return { update: mockProfilesUpdate };
        }
        return {};
      });

      const result = await OnboardingProfileService.completePatientProfile('u-pat-1', {
        full_name: 'Roshan Sahani',
        phone: '9840219283',
        address: 'Ward 2 (Gavali Galli)',
        village: 'Dhamangaon',
        district: 'Raigad',
        state: 'Maharashtra',
        gender: 'M',
        age: 28,
        emergency_contact_name: 'Sanjay Sahani',
        emergency_contact_phone: '9822010800',
        emergency_contact_relation: 'Father',
        known_allergies: ['Penicillin'],
        existing_conditions: ['Hypertension'],
      });

      expect(result.success).toBe(true);
      expect(result.profile?.full_name).toBe('Roshan Sahani');
      expect(result.profile?.is_patient_provided).toBe(true);
      expect(mockProfilesUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ profile_status: 'PROFILE_COMPLETE' })
      );
    });
  });

  describe('3. ASHA Onboarding & Work Assignment', () => {
    it('validates required ASHA fields and saves profile', async () => {
      const mockAshaUpsert = jest.fn().mockReturnValue({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'ap-1',
                user_id: 'u-asha-1',
                full_name: 'Sunita More',
                assigned_village: 'Dhamangaon',
                primary_phc_name: 'Dhamangaon PHC',
              },
              error: null,
            }),
        }),
      });

      const mockProfilesUpdate = jest.fn().mockReturnValue({
        eq: () => Promise.resolve({ error: null }),
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'asha_profiles') {
          return { upsert: mockAshaUpsert };
        }
        if (table === 'profiles') {
          return { update: mockProfilesUpdate };
        }
        return {};
      });

      const result = await OnboardingProfileService.completeAshaProfile('u-asha-1', {
        full_name: 'Sunita More',
        phone: '9840219283',
        address: 'Dhamangaon Village',
        asha_worker_id: 'ASHA-MH-2024-884',
        assigned_village: 'Dhamangaon',
        block: 'Karjat',
        district: 'Raigad',
        state: 'Maharashtra',
        primary_phc_name: 'Dhamangaon PHC',
        villages_served: ['Dhamangaon', 'Palsari'],
      });

      expect(result.success).toBe(true);
      expect(result.profile?.assigned_village).toBe('Dhamangaon');
      expect(mockProfilesUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ profile_status: 'PROFILE_COMPLETE' })
      );
    });
  });

  describe('4. PHC & District Hospital Onboarding', () => {
    it('completes PHC profile with configured services and operating hours', async () => {
      const mockPhcUpsert = jest.fn().mockReturnValue({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'phc-1',
                user_id: 'u-doc-1',
                phc_name: 'Dhamangaon Primary Health Centre',
                doctor_name: 'Dr. Amit Deshmukh',
                services_offered: ['General Consultation', 'Maternal Health', 'Immunization'],
              },
              error: null,
            }),
        }),
      });

      const mockProfilesUpdate = jest.fn().mockReturnValue({
        eq: () => Promise.resolve({ error: null }),
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'phc_profiles') {
          return { upsert: mockPhcUpsert };
        }
        if (table === 'profiles') {
          return { update: mockProfilesUpdate };
        }
        return {};
      });

      const result = await OnboardingProfileService.completePhcProfile('u-doc-1', {
        phc_name: 'Dhamangaon Primary Health Centre',
        phone: '9822010800',
        doctor_name: 'Dr. Amit Deshmukh',
        doctor_designation: 'Medical Officer',
        address: 'Near Gram Panchayat',
        village: 'Dhamangaon',
        block: 'Karjat',
        district: 'Raigad',
        state: 'Maharashtra',
        pincode: '410201',
        operating_hours: '9:00 AM - 5:00 PM (24x7 Emergency)',
        services_offered: ['General Consultation', 'Maternal Health', 'Immunization'],
      });

      expect(result.success).toBe(true);
      expect(result.profile?.doctor_name).toBe('Dr. Amit Deshmukh');
      expect(result.profile?.services_offered).toEqual(['General Consultation', 'Maternal Health', 'Immunization']);
    });

    it('completes District Hospital profile with configured specialties and emergency contact', async () => {
      const mockDhUpsert = jest.fn().mockReturnValue({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'dh-1',
                user_id: 'u-dh-1',
                hospital_name: 'Raigad District General Hospital',
                specialties_offered: ['Cardiology', 'Orthopedics', 'Pediatrics', 'Gynecology'],
              },
              error: null,
            }),
        }),
      });

      const mockProfilesUpdate = jest.fn().mockReturnValue({
        eq: () => Promise.resolve({ error: null }),
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'district_hospital_profiles') {
          return { upsert: mockDhUpsert };
        }
        if (table === 'profiles') {
          return { update: mockProfilesUpdate };
        }
        return {};
      });

      const result = await OnboardingProfileService.completeDistrictHospitalProfile('u-dh-1', {
        hospital_name: 'Raigad District General Hospital',
        phone: '9822001122',
        emergency_phone: '108',
        email: 'raigad.dh@hospital.gov.in',
        address: 'Alibag Main Road',
        city: 'Alibag',
        district: 'Raigad',
        state: 'Maharashtra',
        pincode: '402201',
        operating_hours: '24x7 Emergency & Trauma',
        services_offered: ['Emergency Services', 'Specialist Consultation', 'Surgery', 'Diagnostics'],
        specialties_offered: ['Cardiology', 'Orthopedics', 'Pediatrics', 'Gynecology'],
      });

      expect(result.success).toBe(true);
      expect(result.profile?.hospital_name).toBe('Raigad District General Hospital');
      expect(result.profile?.specialties_offered).toContain('Cardiology');
    });
  });

  describe('5. RBAC & Profile Update Protection', () => {
    it('prevents role escalation or modifying unauthorized administrative fields', async () => {
      let updatedPayload: any = null;
      const mockPatientUpdate = jest.fn().mockReturnValue({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'pp-1',
                user_id: 'u-pat-1',
                full_name: 'Roshan Sahani Updated',
              },
              error: null,
            }),
        }),
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'patient_profiles') {
          return {
            update: (payload: any) => {
              updatedPayload = payload;
              return {
                eq: () => Promise.resolve({ error: null }),
              };
            },
          };
        }
        if (table === 'profiles') {
          return {
            update: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          };
        }
        return {};
      });

      const result = await OnboardingProfileService.updateRoleProfile(
        'u-pat-1',
        'PATIENT',
        {
          full_name: 'Roshan Sahani Updated',
          role: 'ADMIN', // Unauthorized attempt to escalate role
          user_id: 'u-admin-1', // Unauthorized attempt to change ID
        },
        'u-pat-1'
      );

      expect(result.success).toBe(true);
      expect(updatedPayload.role).toBeUndefined();
      expect(updatedPayload.user_id).toBeUndefined();
    });

    it('rejects profile update if requested by an unauthorized user', async () => {
      await expect(
        OnboardingProfileService.updateRoleProfile(
          'u-pat-1',
          'PATIENT',
          { full_name: 'Tampered Name' },
          'u-attacker-999' // Different actor
        )
      ).rejects.toThrow('SECURITY_ERROR: Unauthorized');
    });
  });

  describe('6. Save & Resume Progressive Draft Flow', () => {
    it('saves partially completed draft data for later completion without marking status complete', async () => {
      const mockProfilesUpdate = jest.fn().mockReturnValue({
        eq: () => Promise.resolve({ error: null }),
      });

      (supabase.from as jest.Mock).mockReturnValue({ update: mockProfilesUpdate });

      const result = await OnboardingProfileService.saveDraftProfile(
        'u-asha-1',
        { role: 'ASHA', stepData: { fullName: 'Sunita', assignedVillage: 'Dhamangaon' } }
      );

      expect(result).toBe(true);
      expect(mockProfilesUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          onboarding_draft: expect.objectContaining({
            role: 'ASHA',
            stepData: { fullName: 'Sunita', assignedVillage: 'Dhamangaon' },
          }),
        })
      );
    });
  });
});
