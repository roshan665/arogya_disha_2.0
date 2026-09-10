'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import {
  OnboardingProfileService,
  PatientProfileData,
  AshaProfileData,
  PhcProfileData,
  DistrictHospitalProfileData,
} from '../../lib/services/OnboardingProfileService';
import { RealtimeRole } from '../../lib/services/RealtimeCommunicationService';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<RealtimeRole>('PATIENT');
  const [language, setLanguage] = useState<'en' | 'mr' | 'hi'>('en');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [autoSavedTime, setAutoSavedTime] = useState<string | null>(null);

  // Form State: Patient
  const [patientData, setPatientData] = useState<PatientProfileData>({
    full_name: '',
    date_of_birth: '',
    age: undefined,
    gender: 'F',
    phone: '',
    address: '',
    village: '',
    district: 'Raigad',
    state: 'Maharashtra',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: 'Spouse',
    blood_group: 'O+',
    preferred_language: 'en',
    known_allergies: [],
    existing_conditions: [],
    medical_history: '',
  });

  // Form State: ASHA
  const [ashaData, setAshaData] = useState<AshaProfileData>({
    full_name: '',
    phone: '',
    email: '',
    gender: 'F',
    address: '',
    asha_worker_id: '',
    assigned_village: '',
    block: 'Karjat',
    district: 'Raigad',
    state: 'Maharashtra',
    primary_phc_name: 'Karjat Primary Health Centre',
    villages_served: [],
    availability_timing: '9:00 AM - 5:00 PM',
    supervisor_name: '',
    supervisor_phone: '',
  });

  // Form State: PHC
  const [phcData, setPhcData] = useState<PhcProfileData>({
    phc_name: '',
    facility_code: '',
    phone: '',
    email: '',
    address: '',
    village: '',
    block: 'Karjat',
    district: 'Raigad',
    state: 'Maharashtra',
    pincode: '410201',
    operating_hours: '24x7 Emergency & 9:00 AM - 5:00 PM OPD',
    doctor_name: '',
    doctor_designation: 'Medical Officer (MBBS)',
    doctor_contact: '',
    department: 'General Medicine / Outpatient',
    services_offered: ['General Consultation', 'Maternal Health', 'Child Health', 'Immunization', 'Basic Diagnostics'],
  });

  // Form State: District Hospital
  const [dhData, setDhData] = useState<DistrictHospitalProfileData>({
    hospital_name: '',
    facility_code: '',
    phone: '',
    emergency_phone: '108',
    email: '',
    address: '',
    city: 'Alibag',
    district: 'Raigad',
    state: 'Maharashtra',
    pincode: '402201',
    operating_hours: '24x7 Emergency & Tertiary Care',
    services_offered: ['Emergency Services', 'Specialist Consultation', 'Inpatient ICU', 'Surgery', 'Advanced Diagnostics'],
    specialties_offered: ['Cardiology', 'Obstetrics & Gynecology', 'Pediatrics', 'General Surgery', 'Orthopedics'],
  });

  // Helper inputs for tags/lists
  const [allergyInput, setAllergyInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [villageInput, setVillageInput] = useState('');

  // 1. Initial Load & Session Check
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      setUserId(user.id);
      const role = OnboardingProfileService.normalizeRole(user.user_metadata?.role);
      setUserRole(role);

      // Check current profile status
      const statusRes = await OnboardingProfileService.getProfileStatus(user.id);
      if (statusRes.status === 'PROFILE_COMPLETE') {
        redirectToDashboard(role);
        return;
      }

      // Pre-fill from draft or user metadata
      const draft = statusRes.draft;
      const initialName = user.user_metadata?.full_name || '';

      if (role === 'PATIENT') {
        setPatientData((prev) => ({
          ...prev,
          full_name: draft?.full_name || initialName,
          phone: draft?.phone || prev.phone,
          ...(draft || {}),
        }));
      } else if (role === 'ASHA') {
        setAshaData((prev) => ({
          ...prev,
          full_name: draft?.full_name || initialName,
          email: user.email || prev.email,
          ...(draft || {}),
        }));
      } else if (role === 'PHC') {
        setPhcData((prev) => ({
          ...prev,
          phc_name: draft?.phc_name || user.user_metadata?.facility_name || prev.phc_name,
          doctor_name: draft?.doctor_name || initialName,
          email: user.email || prev.email,
          ...(draft || {}),
        }));
      } else if (role === 'DISTRICT_HOSPITAL') {
        setDhData((prev) => ({
          ...prev,
          hospital_name: draft?.hospital_name || user.user_metadata?.facility_name || prev.hospital_name,
          email: user.email || prev.email,
          ...(draft || {}),
        }));
      }

      setLoading(false);
    };

    init();
  }, [router]);

  const redirectToDashboard = (role: RealtimeRole) => {
    if (role === 'PATIENT') router.push('/patient');
    else if (role === 'ASHA') router.push('/asha');
    else router.push('/doctor');
  };

  // 2. Auto-save Draft progressively
  const saveDraft = useCallback(async () => {
    if (!userId) return;
    let dataToSave: any = null;
    if (userRole === 'PATIENT') dataToSave = patientData;
    else if (userRole === 'ASHA') dataToSave = ashaData;
    else if (userRole === 'PHC') dataToSave = phcData;
    else if (userRole === 'DISTRICT_HOSPITAL') dataToSave = dhData;

    if (dataToSave) {
      await OnboardingProfileService.saveDraftProfile(userId, dataToSave);
      setAutoSavedTime(new Date().toLocaleTimeString());
    }
  }, [userId, userRole, patientData, ashaData, phcData, dhData]);

  useEffect(() => {
    if (!loading && userId) {
      const timer = setTimeout(() => {
        saveDraft();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [patientData, ashaData, phcData, dhData, loading, userId, saveDraft]);

  // 3. Handle Profile Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      if (userRole === 'PATIENT') {
        await OnboardingProfileService.completePatientProfile(userId, patientData);
      } else if (userRole === 'ASHA') {
        await OnboardingProfileService.completeAshaProfile(userId, ashaData);
      } else if (userRole === 'PHC') {
        await OnboardingProfileService.completePhcProfile(userId, phcData);
      } else if (userRole === 'DISTRICT_HOSPITAL') {
        await OnboardingProfileService.completeDistrictHospitalProfile(userId, dhData);
      }

      setSuccessMsg(
        language === 'mr'
          ? 'तुमची प्रोफाइल यशस्वीरित्या पूर्ण झाली! डॅशबोर्डवर नेले जात आहे...'
          : language === 'hi'
          ? 'आपकी प्रोफाइल सफलतापूर्वक पूरी हो गई! डैशबोर्ड पर पुनर्निर्देशित किया जा रहा है...'
          : 'Profile completed successfully! Redirecting to your dashboard...'
      );

      setTimeout(() => {
        redirectToDashboard(userRole);
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to complete profile. Please check required fields.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm font-medium">Verifying Profile Status...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 relative antialiased py-12 selection:bg-emerald-500 selection:text-white">
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-3xl bg-slate-900/90 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative z-10 space-y-8">
        {/* Top Header & Language Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-3xl">
                {userRole === 'PATIENT'
                  ? 'person'
                  : userRole === 'ASHA'
                  ? 'volunteer_activism'
                  : userRole === 'PHC'
                  ? 'local_hospital'
                  : 'domain'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {userRole}
                </span>
                {autoSavedTime && (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Draft saved {autoSavedTime}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                {userRole === 'PATIENT' &&
                  (language === 'mr'
                    ? 'आरोग्य प्रोफाइल पूर्ण करा'
                    : language === 'hi'
                    ? 'स्वास्थ्य प्रोफाइल पूरा करें'
                    : 'Complete Your Health Profile')}
                {userRole === 'ASHA' &&
                  (language === 'mr'
                    ? 'आशा कार्यकर्ता प्रोफाइल पूर्ण करा'
                    : language === 'hi'
                    ? 'आशा कार्यकर्ता प्रोफाइल पूरा करें'
                    : 'Complete ASHA Profile')}
                {userRole === 'PHC' &&
                  (language === 'mr'
                    ? 'प्रा.आ.केंद्र व डॉक्टर सेटअप'
                    : language === 'hi'
                    ? 'पीएचसी व डॉक्टर सेटअप'
                    : 'Complete PHC Facility Setup')}
                {userRole === 'DISTRICT_HOSPITAL' &&
                  (language === 'mr'
                    ? 'जिल्हा रुग्णालय प्रोफाइल पूर्ण करा'
                    : language === 'hi'
                    ? 'जिला अस्पताल प्रोफाइल पूरा करें'
                    : 'Complete District Hospital Profile')}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                {language === 'mr'
                  ? 'अचूक आरोग्य सेवा व पाठपुराव्यासाठी आवश्यक खरी माहिती भरा'
                  : language === 'hi'
                  ? 'सटीक स्वास्थ्य सेवाओं और फॉलो-अप के लिए वास्तविक जानकारी दर्ज करें'
                  : 'Enter your real details to connect with ArogyaDisha rural healthcare network'}
              </p>
            </div>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 self-start sm:self-center">
            {(['en', 'mr', 'hi'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  language === lang
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'en' ? 'English' : lang === 'mr' ? 'मराठी' : 'हिंदी'}
              </button>
            ))}
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 p-4 rounded-2xl text-xs font-semibold flex items-start gap-3">
            <span className="material-symbols-outlined text-red-400 text-xl shrink-0">error</span>
            <div>{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 p-4 rounded-2xl text-xs font-semibold flex items-start gap-3">
            <span className="material-symbols-outlined text-emerald-400 text-xl shrink-0">
              check_circle
            </span>
            <div>{successMsg}</div>
          </div>
        )}

        {/* FORM BEGIN */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ========================================================================= */}
          {/* 1. PATIENT FORM */}
          {/* ========================================================================= */}
          {userRole === 'PATIENT' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={patientData.full_name}
                    onChange={(e) => setPatientData({ ...patientData, full_name: e.target.value })}
                    placeholder="e.g. Roshan Sahani"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Phone Number (10 Digits) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={patientData.phone}
                    onChange={(e) => setPatientData({ ...patientData, phone: e.target.value })}
                    placeholder="e.g. 9822012345"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={patientData.date_of_birth || ''}
                    onChange={(e) => setPatientData({ ...patientData, date_of_birth: e.target.value })}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Age (Years)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={patientData.age || ''}
                    onChange={(e) =>
                      setPatientData({ ...patientData, age: parseInt(e.target.value) || undefined })
                    }
                    placeholder="e.g. 28"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Gender <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={patientData.gender}
                    onChange={(e) => setPatientData({ ...patientData, gender: e.target.value as any })}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="F">Female (स्त्री)</option>
                    <option value="M">Male (पुरुष)</option>
                    <option value="Other">Other (इतर)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Village / Town / City <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={patientData.village}
                    onChange={(e) => setPatientData({ ...patientData, village: e.target.value })}
                    placeholder="e.g. Dhamangaon"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    District <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={patientData.district}
                    onChange={(e) => setPatientData({ ...patientData, district: e.target.value })}
                    placeholder="e.g. Raigad"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    State <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={patientData.state}
                    onChange={(e) => setPatientData({ ...patientData, state: e.target.value })}
                    placeholder="e.g. Maharashtra"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Residential Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={patientData.address}
                  onChange={(e) => setPatientData({ ...patientData, address: e.target.value })}
                  placeholder="e.g. House No. 42, Near Maruti Mandir, Ward 2"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Emergency Contact */}
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Emergency Contact (आपत्कालीन संपर्क)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Contact Person Name
                    </label>
                    <input
                      type="text"
                      value={patientData.emergency_contact_name || ''}
                      onChange={(e) =>
                        setPatientData({ ...patientData, emergency_contact_name: e.target.value })
                      }
                      placeholder="e.g. Anita Sahani"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Emergency Phone
                    </label>
                    <input
                      type="tel"
                      value={patientData.emergency_contact_phone || ''}
                      onChange={(e) =>
                        setPatientData({ ...patientData, emergency_contact_phone: e.target.value })
                      }
                      placeholder="e.g. 9822100000"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Relationship
                    </label>
                    <input
                      type="text"
                      value={patientData.emergency_contact_relation || ''}
                      onChange={(e) =>
                        setPatientData({ ...patientData, emergency_contact_relation: e.target.value })
                      }
                      placeholder="e.g. Spouse / Parent"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Patient-Reported Health Profile */}
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    Patient-Reported Health Profile
                  </h3>
                  <span className="text-[10px] bg-slate-700/80 px-2 py-0.5 rounded text-slate-300">
                    Patient-Provided Information
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Blood Group
                    </label>
                    <select
                      value={patientData.blood_group || 'O+'}
                      onChange={(e) => setPatientData({ ...patientData, blood_group: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Known Allergies (e.g. Penicillin, Dust)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={allergyInput}
                        onChange={(e) => setAllergyInput(e.target.value)}
                        placeholder="Add allergy..."
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (allergyInput.trim()) {
                            setPatientData({
                              ...patientData,
                              known_allergies: [...(patientData.known_allergies || []), allergyInput.trim()],
                            });
                            setAllergyInput('');
                          }
                        }}
                        className="px-3 py-1.5 bg-emerald-600 rounded-xl text-xs font-bold"
                      >
                        + Add
                      </button>
                    </div>
                    {patientData.known_allergies && patientData.known_allergies.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {patientData.known_allergies.map((a, i) => (
                          <span
                            key={i}
                            className="bg-red-500/20 text-red-300 border border-red-500/30 text-[11px] px-2 py-0.5 rounded-lg flex items-center gap-1"
                          >
                            {a}
                            <button
                              type="button"
                              onClick={() =>
                                setPatientData({
                                  ...patientData,
                                  known_allergies: patientData.known_allergies?.filter((_, idx) => idx !== i),
                                })
                              }
                              className="text-red-400 hover:text-white"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Relevant Medical Notes / Past History
                  </label>
                  <textarea
                    rows={2}
                    value={patientData.medical_history || ''}
                    onChange={(e) => setPatientData({ ...patientData, medical_history: e.target.value })}
                    placeholder="Mention any known past surgeries, hypertension, diabetes..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. ASHA FORM */}
          {/* ========================================================================= */}
          {userRole === 'ASHA' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    ASHA Worker Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ashaData.full_name}
                    onChange={(e) => setAshaData({ ...ashaData, full_name: e.target.value })}
                    placeholder="e.g. Sunita Suresh Patil"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Official Mobile Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={ashaData.phone}
                    onChange={(e) => setAshaData({ ...ashaData, phone: e.target.value })}
                    placeholder="e.g. 9822100884"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    ASHA Worker ID / Employee Code <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ashaData.asha_worker_id}
                    onChange={(e) => setAshaData({ ...ashaData, asha_worker_id: e.target.value })}
                    placeholder="e.g. ASHA-MH-2024-884"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Primary PHC Facility <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ashaData.primary_phc_name}
                    onChange={(e) => setAshaData({ ...ashaData, primary_phc_name: e.target.value })}
                    placeholder="e.g. Karjat Primary Health Centre"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Assigned Primary Village <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ashaData.assigned_village}
                    onChange={(e) => setAshaData({ ...ashaData, assigned_village: e.target.value })}
                    placeholder="e.g. Dhamangaon"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Block / Taluka <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ashaData.block}
                    onChange={(e) => setAshaData({ ...ashaData, block: e.target.value })}
                    placeholder="e.g. Karjat"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    District <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ashaData.district}
                    onChange={(e) => setAshaData({ ...ashaData, district: e.target.value })}
                    placeholder="e.g. Raigad"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Additional Villages Served */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Other Villages / Hamlets Served
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={villageInput}
                    onChange={(e) => setVillageInput(e.target.value)}
                    placeholder="Add hamlet / wadi (e.g. Patil Wadi)..."
                    className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (villageInput.trim()) {
                        setAshaData({
                          ...ashaData,
                          villages_served: [...(ashaData.villages_served || []), villageInput.trim()],
                        });
                        setVillageInput('');
                      }
                    }}
                    className="px-4 py-3 bg-emerald-600 rounded-xl text-xs font-bold"
                  >
                    + Add Village
                  </button>
                </div>
                {ashaData.villages_served && ashaData.villages_served.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {ashaData.villages_served.map((v, i) => (
                      <span
                        key={i}
                        className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-2.5 py-1 rounded-xl flex items-center gap-1.5"
                      >
                        {v}
                        <button
                          type="button"
                          onClick={() =>
                            setAshaData({
                              ...ashaData,
                              villages_served: ashaData.villages_served?.filter((_, idx) => idx !== i),
                            })
                          }
                          className="text-emerald-400 hover:text-white"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Supervisor ANM / Medical Officer Name
                  </label>
                  <input
                    type="text"
                    value={ashaData.supervisor_name || ''}
                    onChange={(e) => setAshaData({ ...ashaData, supervisor_name: e.target.value })}
                    placeholder="e.g. Rekha Patil (ANM)"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Supervisor Contact Number
                  </label>
                  <input
                    type="tel"
                    value={ashaData.supervisor_phone || ''}
                    onChange={(e) => setAshaData({ ...ashaData, supervisor_phone: e.target.value })}
                    placeholder="e.g. 9822100123"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. PHC FORM */}
          {/* ========================================================================= */}
          {userRole === 'PHC' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    PHC Facility Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={phcData.phc_name}
                    onChange={(e) => setPhcData({ ...phcData, phc_name: e.target.value })}
                    placeholder="e.g. Karjat Primary Health Centre"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Facility Contact Phone <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phcData.phone}
                    onChange={(e) => setPhcData({ ...phcData, phone: e.target.value })}
                    placeholder="e.g. 02148220011"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Medical Officer / Doctor In-Charge <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={phcData.doctor_name}
                    onChange={(e) => setPhcData({ ...phcData, doctor_name: e.target.value })}
                    placeholder="e.g. Dr. Amit Deshmukh"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Designation & Qualifications <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={phcData.doctor_designation}
                    onChange={(e) => setPhcData({ ...phcData, doctor_designation: e.target.value })}
                    placeholder="e.g. Medical Officer (MBBS, DNB)"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Village / Town <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={phcData.village}
                    onChange={(e) => setPhcData({ ...phcData, village: e.target.value })}
                    placeholder="e.g. Karjat"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    District <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={phcData.district}
                    onChange={(e) => setPhcData({ ...phcData, district: e.target.value })}
                    placeholder="e.g. Raigad"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    PIN Code <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={phcData.pincode}
                    onChange={(e) => setPhcData({ ...phcData, pincode: e.target.value })}
                    placeholder="e.g. 410201"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Operating Hours & OPD Timings <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={phcData.operating_hours}
                  onChange={(e) => setPhcData({ ...phcData, operating_hours: e.target.value })}
                  placeholder="e.g. 24x7 Emergency & 9:00 AM - 5:00 PM OPD"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white"
                />
              </div>

              {/* Available Services Configuration */}
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Actual Configured Services Offered
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    'General Consultation',
                    'Maternal Health',
                    'Child Health',
                    'Basic Diagnostics',
                    'Immunization',
                    'NCD Screening',
                    'Teleconsultation',
                    'Minor OT / Dressing',
                  ].map((service) => {
                    const isChecked = phcData.services_offered?.includes(service);
                    return (
                      <label
                        key={service}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const cur = phcData.services_offered || [];
                            if (e.target.checked) {
                              setPhcData({ ...phcData, services_offered: [...cur, service] });
                            } else {
                              setPhcData({
                                ...phcData,
                                services_offered: cur.filter((s) => s !== service),
                              });
                            }
                          }}
                          className="accent-emerald-500 rounded"
                        />
                        {service}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. DISTRICT HOSPITAL FORM */}
          {/* ========================================================================= */}
          {userRole === 'DISTRICT_HOSPITAL' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    District Hospital Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={dhData.hospital_name}
                    onChange={(e) => setDhData({ ...dhData, hospital_name: e.target.value })}
                    placeholder="e.g. Raigad District Civil Hospital"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Hospital Phone / Landline <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={dhData.phone}
                    onChange={(e) => setDhData({ ...dhData, phone: e.target.value })}
                    placeholder="e.g. 02141222011"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    City / Location <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={dhData.city}
                    onChange={(e) => setDhData({ ...dhData, city: e.target.value })}
                    placeholder="e.g. Alibag"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    District <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={dhData.district}
                    onChange={(e) => setDhData({ ...dhData, district: e.target.value })}
                    placeholder="e.g. Raigad"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    PIN Code <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={dhData.pincode}
                    onChange={(e) => setDhData({ ...dhData, pincode: e.target.value })}
                    placeholder="e.g. 402201"
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Hospital Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={dhData.address}
                  onChange={(e) => setDhData({ ...dhData, address: e.target.value })}
                  placeholder="e.g. Civil Hospital Campus, Near Collector Office, Alibag"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white"
                />
              </div>

              {/* Specialties Configuration */}
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Actual Active Clinical Specialties
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    'Cardiology',
                    'Obstetrics & Gynecology',
                    'Pediatrics',
                    'General Surgery',
                    'Orthopedics',
                    'Neurology',
                    'Pulmonology',
                    'Emergency & Trauma ICU',
                  ].map((spec) => {
                    const isChecked = dhData.specialties_offered?.includes(spec);
                    return (
                      <label
                        key={spec}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const cur = dhData.specialties_offered || [];
                            if (e.target.checked) {
                              setDhData({ ...dhData, specialties_offered: [...cur, spec] });
                            } else {
                              setDhData({
                                ...dhData,
                                specialties_offered: cur.filter((s) => s !== spec),
                              });
                            }
                          }}
                          className="accent-emerald-500 rounded"
                        />
                        {spec}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              <span className="text-red-400">*</span> Required information saved securely to verified database
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <span>Complete & Go to Dashboard</span>
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
