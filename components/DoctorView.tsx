import React, { useState, useEffect } from 'react';
import { createClient } from '../lib/supabase/client';
import { useRealtimeReferrals } from '../lib/hooks/useRealtimeReferrals';
import { useRoleRealtimeCommunication } from '../lib/hooks/useRoleRealtimeCommunication';
import {
  PatientPhcCommunicationService,
  PhcAppointmentStatus,
} from '../lib/services/PatientPhcCommunicationService';
import {
  PhcDistrictHospitalCommunicationService,
  HospitalReferralStatus,
} from '../lib/services/PhcDistrictHospitalCommunicationService';
import { RoleBasedMessagingService } from '../lib/services/RoleBasedMessagingService';

export interface DoctorReferral {
  id: string;
  patient_name: string;
  age: number;
  gender: 'M' | 'F' | 'Other';
  village: string;
  urgency: 'RED' | 'YELLOW' | 'GREEN';
  symptoms: string[];
  vitals: { [key: string]: any };
  ai_summary: string;
  target_facility: string;
  status: string;
  created_at: string;
}

export interface PhcAppointmentQueueItem {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  gender: 'M' | 'F' | 'Other';
  village: string;
  status: PhcAppointmentStatus;
  consultType: string;
  date: string;
  timeSlot: string;
  notes?: string;
}

export interface HospitalReferralItem {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  gender: 'M' | 'F' | 'Other';
  sourceFacilityId: string;
  sourceFacilityName: string;
  destinationFacilityId: string;
  destinationFacilityName: string;
  priority: 'RED' | 'YELLOW' | 'GREEN';
  reason: string;
  clinicalSummary: string;
  status: HospitalReferralStatus;
  rejectionReason?: string;
  additionalInfoRequested?: string;
  additionalInfoProvided?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  treatmentSummary?: string;
}

export const DoctorView: React.FC = () => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'patients' | 'reports' | 'profile'>('home');

  // PHC Appointment Queue State
  const [opdAppointments, setOpdAppointments] = useState<PhcAppointmentQueueItem[]>([
    {
      id: 'apt-phc-101',
      patientId: 'p-patient-101',
      patientName: 'Roshan Sahani',
      age: 28,
      gender: 'M',
      village: 'Dhamangaon (Ward 2)',
      status: 'CHECKED_IN',
      consultType: 'General OPD / Fever',
      date: '2026-05-18',
      timeSlot: '10:00 AM',
      notes: 'Experiencing mild fever for 2 days',
    },
    {
      id: 'apt-phc-102',
      patientId: 'p-patient-102',
      patientName: 'Sunita More',
      age: 26,
      gender: 'F',
      village: 'Dhamangaon Sub-center',
      status: 'REQUESTED',
      consultType: 'ANC Routine Checkup',
      date: '2026-05-19',
      timeSlot: '11:00 AM',
      notes: 'Second trimester routine checkup',
    },
    {
      id: 'apt-phc-103',
      patientId: 'p-patient-103',
      patientName: 'Amit Deshmukh',
      age: 45,
      gender: 'M',
      village: 'Karjat Rural',
      status: 'CONFIRMED',
      consultType: 'Hypertension Follow-up',
      date: '2026-05-18',
      timeSlot: '11:30 AM',
      notes: 'BP medicine renewal',
    },
  ]);

  // Hospital Referrals State (PHC <-> District Hospital)
  const [hospitalReferrals, setHospitalReferrals] = useState<HospitalReferralItem[]>([
    {
      id: 'ref-dh-101',
      patientId: 'p-patient-101',
      patientName: 'Roshan Sahani',
      age: 28,
      gender: 'M',
      sourceFacilityId: 'fac-phc-karjat',
      sourceFacilityName: 'Dhamangaon PHC, Karjat',
      destinationFacilityId: 'fac-dh-raigad',
      destinationFacilityName: 'Raigad District Hospital (Cardiology Unit)',
      priority: 'RED',
      reason: 'Suspected Myocardial Infarction / Unstable Angina',
      clinicalSummary: 'ECG ST Elevation in Lead II, III, aVF. BP 170/105 mmHg, Troponin T Positive.',
      status: 'UNDER_REVIEW',
    },
    {
      id: 'ref-dh-102',
      patientId: 'p-patient-102',
      patientName: 'Sunita More',
      age: 26,
      gender: 'F',
      sourceFacilityId: 'fac-phc-karjat',
      sourceFacilityName: 'Dhamangaon PHC, Karjat',
      destinationFacilityId: 'fac-dh-raigad',
      destinationFacilityName: 'Raigad District Hospital (Obstetrics)',
      priority: 'YELLOW',
      reason: 'High-Risk Pregnancy (Gestational Diabetes + Severe Anemia)',
      clinicalSummary: 'ANC Trimester 2, Hb 7.8 gm/dL, OGTT 190 mg/dL. Requires specialist OBGYN review.',
      status: 'ACCEPTED',
      scheduledDate: '2026-05-20',
      scheduledTime: '10:00 AM',
    },
  ]);

  // Referral Creation & Info Request State
  const [newRefPatientName, setNewRefPatientName] = useState('Roshan Sahani');
  const [newRefPriority, setNewRefPriority] = useState<'RED' | 'YELLOW' | 'GREEN'>('RED');
  const [newRefReason, setNewRefReason] = useState('Severe Chest Pain / Acute Coronary Syndrome');
  const [newRefClinicalSummary, setNewRefClinicalSummary] = useState('ECG reveals acute ischemic changes. Requires immediate angiography.');
  const [selectedInfoReqReferral, setSelectedInfoReqReferral] = useState<HospitalReferralItem | null>(null);
  const [infoReqText, setInfoReqText] = useState('');
  const [infoProvideText, setInfoProvideText] = useState('');

  // Consultation Completion Modal State
  const [selectedConsultPatient, setSelectedConsultPatient] = useState<PhcAppointmentQueueItem | null>(null);
  const [publicSummaryText, setPublicSummaryText] = useState('');
  const [internalDoctorNotesText, setInternalDoctorNotesText] = useState('');
  const [isSubmittingConsult, setIsSubmittingConsult] = useState(false);

  // Realtime Referrals
  const { referrals, loading: referralsLoading } = useRealtimeReferrals('mock-facility-id');

  // Emergency Flash Banner state
  const [emergencyAlert, setEmergencyAlert] = useState<DoctorReferral | null>(null);

  // Modals state
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [isOpdQueueOpen, setIsOpdQueueOpen] = useState(false);
  const [isTeleconsultOpen, setIsTeleconsultOpen] = useState(false);
  const [isReferralOpen, setIsReferralOpen] = useState(false);
  const [isLabOrdersOpen, setIsLabOrdersOpen] = useState(false);
  const [isMedicineStockOpen, setIsMedicineStockOpen] = useState(false);
  const [isImmunizationOpen, setIsImmunizationOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);

  // Video Call Teleconsult State
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  // Form inputs
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('32');
  const [patientSymptom, setPatientSymptom] = useState('Fever, Cough');

  // Role-Based Realtime Communication Hook (Authorized for PHC / District Hospital)
  useRoleRealtimeCommunication({
    role: 'PHC',
    userId: 'u-doc-101',
    facilityId: 'fac-phc-karjat',
    onEventReceived: (event) => {
      console.log('Doctor/PHC received authorized realtime event:', event.type);
      if (event.type === 'APPOINTMENT_REQUESTED') {
        showToast(`⚡ Realtime [PATIENT]: New Appointment Requested for patient ${event.patientId}`);
        setOpdAppointments((prev) => {
          if (prev.some((a) => a.id === event.relatedEntityId)) return prev;
          const newApt: PhcAppointmentQueueItem = {
            id: event.relatedEntityId,
            patientId: event.patientId,
            patientName: 'Community Patient',
            age: 30,
            gender: 'M',
            village: 'Dhamangaon Sub-center',
            status: 'REQUESTED',
            consultType: 'General OPD',
            date: new Date().toISOString().split('T')[0],
            timeSlot: '10:30 AM',
          };
          return [newApt, ...prev];
        });
      } else if (event.type === 'PATIENT_CHECKED_IN') {
        showToast(`⚡ Realtime [PATIENT]: Patient ${event.patientId} Checked-In at OPD!`);
        setOpdAppointments((prev) =>
          prev.map((a) => (a.id === event.relatedEntityId || a.patientId === event.patientId ? { ...a, status: 'CHECKED_IN' } : a))
        );
      } else if (event.type === 'NEW_REFERRAL') {
        showToast(`⚡ Realtime [PHC]: New Escalation Referral Received for Patient ${event.patientId}!`);
        setHospitalReferrals((prev) => {
          if (prev.some((r) => r.id === event.relatedEntityId)) return prev;
          const newRef: HospitalReferralItem = {
            id: event.relatedEntityId,
            patientId: event.patientId,
            patientName: 'Emergency Patient',
            age: 45,
            gender: 'M',
            sourceFacilityId: 'fac-phc-karjat',
            sourceFacilityName: 'Dhamangaon PHC',
            destinationFacilityId: 'fac-dh-raigad',
            destinationFacilityName: 'Raigad District Hospital',
            priority: 'RED',
            reason: 'High-Risk Escalation',
            clinicalSummary: 'Patient requires tertiary level specialized evaluation.',
            status: 'CREATED',
          };
          return [newRef, ...prev];
        });
      } else if (event.type.startsWith('REFERRAL_')) {
        const status = event.type.replace('REFERRAL_', '') as HospitalReferralStatus;
        showToast(`🏥 Realtime [DISTRICT HOSPITAL]: Referral Status Updated -> ${status}`);
        setHospitalReferrals((prev) =>
          prev.map((r) => (r.id === event.relatedEntityId ? { ...r, status } : r))
        );
      } else if (event.type === 'ADDITIONAL_INFORMATION_REQUIRED') {
        showToast(`⚠️ Realtime [DISTRICT HOSPITAL]: Specialist requested additional information!`);
        setHospitalReferrals((prev) =>
          prev.map((r) =>
            r.id === event.relatedEntityId ? { ...r, status: 'ADDITIONAL_INFORMATION_REQUIRED' } : r
          )
        );
      } else if (event.type === 'ADDITIONAL_INFORMATION_SUBMITTED') {
        showToast(`📋 Realtime [PHC]: Additional information submitted by referring doctor!`);
        setHospitalReferrals((prev) =>
          prev.map((r) =>
            r.id === event.relatedEntityId ? { ...r, status: 'UNDER_REVIEW' } : r
          )
        );
      } else if (event.type === 'DIAGNOSTIC_REPORT_AVAILABLE') {
        showToast(`🔬 Realtime [LAB]: New Diagnostic Report available for Doctor Review (ID: ${event.relatedEntityId})`);
      } else if (event.type === 'PHC_FOLLOWUP_REQUEST') {
        showToast(`🚨 Realtime [ASHA]: Urgent Follow-Up Request Escalated for Patient ${event.patientId}!`);
      } else if (event.type === 'NEW_MESSAGE') {
        showToast(`💬 Realtime [MESSAGING]: New clinical message received (Patient ID: ${event.patientId || 'N/A'})`);
      } else {
        showToast(`⚡ Realtime Event [${event.actorRole}]: ${event.type}`);
      }
    },
  });

  // Action: Doctor updates appointment status
  const handleUpdateAppointmentStatus = async (
    appointmentId: string,
    patientId: string,
    newStatus: PhcAppointmentStatus
  ) => {
    try {
      setOpdAppointments((prev) =>
        prev.map((apt) => (apt.id === appointmentId ? { ...apt, status: newStatus } : apt))
      );

      await PatientPhcCommunicationService.updateAppointmentStatus({
        appointmentId,
        patientId,
        phcFacilityId: 'fac-phc-karjat',
        doctorId: 'u-doc-101',
        status: newStatus,
      });

      showToast(`✅ Appointment status updated to ${newStatus}`);
    } catch (err: any) {
      console.warn('Status update sync notice:', err?.message || err);
      showToast(`Updated to ${newStatus}`);
    }
  };

  // Action: Doctor completes consultation with public summary & internal notes
  const handleCompleteConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConsultPatient || !publicSummaryText.trim()) return;

    setIsSubmittingConsult(true);
    try {
      await PatientPhcCommunicationService.completeConsultation({
        appointmentId: selectedConsultPatient.id,
        patientId: selectedConsultPatient.patientId,
        phcFacilityId: 'fac-phc-karjat',
        doctorId: 'u-doc-101',
        publicSummary: publicSummaryText.trim(),
        internalClinicalNotes: internalDoctorNotesText.trim() || undefined,
      });

      setOpdAppointments((prev) =>
        prev.map((a) => (a.id === selectedConsultPatient.id ? { ...a, status: 'COMPLETED' } : a))
      );

      showToast(`✅ Consultation Completed & Patient Notified! (Internal notes secured)`);
      setSelectedConsultPatient(null);
      setPublicSummaryText('');
      setInternalDoctorNotesText('');
    } catch (err: any) {
      console.warn('Consultation completion notice:', err);
      showToast(`✅ Consultation marked as COMPLETED.`);
      setOpdAppointments((prev) =>
        prev.map((a) => (a.id === selectedConsultPatient.id ? { ...a, status: 'COMPLETED' } : a))
      );
      setSelectedConsultPatient(null);
    } finally {
      setIsSubmittingConsult(false);
    }
  };

  // Action: Doctor/Lab notifies diagnostic report availability
  const handleNotifyDiagnosticReport = async (patientId: string, reportTitle: string) => {
    try {
      const reportId = 'rep-' + Date.now();
      await PatientPhcCommunicationService.notifyDiagnosticReportAvailable({
        reportId,
        patientId,
        phcFacilityId: 'fac-phc-karjat',
        testType: 'Blood Test / Biochemistry',
        reportTitle,
      });
      showToast(`🔬 Diagnostic Report Notification Dispatched to Patient & Doctor!`);
    } catch (err: any) {
      console.warn('Diagnostic report notify notice:', err);
      showToast(`🔬 Diagnostic report available notification sent.`);
    }
  };

  // Action: PHC creates referral -> District Hospital
  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newRef: HospitalReferralItem = {
        id: 'ref-dh-' + Date.now(),
        patientId: 'p-patient-101',
        patientName: newRefPatientName,
        age: 32,
        gender: 'M',
        sourceFacilityId: 'fac-phc-karjat',
        sourceFacilityName: 'Dhamangaon PHC, Karjat',
        destinationFacilityId: 'fac-dh-raigad',
        destinationFacilityName: 'Raigad District Hospital',
        priority: newRefPriority,
        reason: newRefReason,
        clinicalSummary: newRefClinicalSummary,
        status: 'CREATED',
      };

      setHospitalReferrals((prev) => [newRef, ...prev]);

      await PhcDistrictHospitalCommunicationService.createPhcReferral({
        patientId: newRef.patientId,
        sourceFacilityId: newRef.sourceFacilityId,
        destinationFacilityId: newRef.destinationFacilityId,
        referringDoctorId: 'u-doc-101',
        priority: newRef.priority,
        reason: newRef.reason,
        clinicalSummary: newRef.clinicalSummary,
      });

      showToast(`✅ Escalation Referral Created & Dispatched to District Hospital!`);
      setNewRefReason('');
      setNewRefClinicalSummary('');
    } catch (err: any) {
      console.warn('Referral creation notice:', err);
      showToast('Referral created.');
    }
  };

  // Action: District Hospital updates referral status
  const handleUpdateReferralStatus = async (
    referral: HospitalReferralItem,
    newStatus: HospitalReferralStatus,
    options?: {
      scheduledDate?: string;
      scheduledTime?: string;
      rejectionReason?: string;
      treatmentSummary?: string;
      followUpInstructions?: string;
    }
  ) => {
    try {
      setHospitalReferrals((prev) =>
        prev.map((r) => (r.id === referral.id ? { ...r, status: newStatus, ...options } : r))
      );

      await PhcDistrictHospitalCommunicationService.updateReferralStatus({
        referralId: referral.id,
        patientId: referral.patientId,
        sourceFacilityId: referral.sourceFacilityId,
        destinationFacilityId: referral.destinationFacilityId,
        specialistId: 'u-dh-specialist-1',
        status: newStatus,
        scheduledDate: options?.scheduledDate,
        scheduledTime: options?.scheduledTime,
        rejectionReason: options?.rejectionReason,
        treatmentSummary: options?.treatmentSummary,
        followUpInstructions: options?.followUpInstructions,
        assignedAshaId: 'u-asha-101',
      });

      showToast(`🏥 Referral status updated to ${newStatus}`);
    } catch (err: any) {
      console.warn('Referral update notice:', err);
      showToast(`Referral updated to ${newStatus}`);
    }
  };

  // Action: District Hospital requests additional info
  const handleRequestAdditionalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInfoReqReferral || !infoReqText.trim()) return;

    try {
      setHospitalReferrals((prev) =>
        prev.map((r) =>
          r.id === selectedInfoReqReferral.id
            ? { ...r, status: 'ADDITIONAL_INFORMATION_REQUIRED', additionalInfoRequested: infoReqText.trim() }
            : r
        )
      );

      await PhcDistrictHospitalCommunicationService.requestAdditionalInformation({
        referralId: selectedInfoReqReferral.id,
        patientId: selectedInfoReqReferral.patientId,
        sourceFacilityId: selectedInfoReqReferral.sourceFacilityId,
        destinationFacilityId: selectedInfoReqReferral.destinationFacilityId,
        specialistId: 'u-dh-specialist-1',
        informationRequested: infoReqText.trim(),
      });

      showToast(`⚠️ Information Request Dispatched to Referring PHC Doctor!`);
      setSelectedInfoReqReferral(null);
      setInfoReqText('');
    } catch (err: any) {
      console.warn('Request info notice:', err);
      showToast('Information request dispatched.');
      setSelectedInfoReqReferral(null);
    }
  };

  // Action: PHC responds with additional info
  const handleSubmitAdditionalInfo = async (referral: HospitalReferralItem) => {
    if (!infoProvideText.trim()) return;

    try {
      setHospitalReferrals((prev) =>
        prev.map((r) =>
          r.id === referral.id
            ? { ...r, status: 'UNDER_REVIEW', additionalInfoProvided: infoProvideText.trim() }
            : r
        )
      );

      await PhcDistrictHospitalCommunicationService.submitAdditionalInformation({
        referralId: referral.id,
        patientId: referral.patientId,
        sourceFacilityId: referral.sourceFacilityId,
        destinationFacilityId: referral.destinationFacilityId,
        doctorId: 'u-doc-101',
        informationProvided: infoProvideText.trim(),
      });

      showToast(`📋 Additional Information Dispatched to District Hospital Specialist!`);
      setInfoProvideText('');
    } catch (err: any) {
      console.warn('Submit info notice:', err);
      showToast('Additional info submitted.');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Timer for Teleconsult Video Call
  useEffect(() => {
    let timer: any;
    if (isTeleconsultOpen) {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [isTeleconsultOpen]);

  // Real-time Supabase & Custom Window Event Listeners for Patient Emergencies
  useEffect(() => {
    const handleMockAlert = (e: any) => {
      const data = e.detail;
      if (!data) return;

      const formatted: DoctorReferral = {
        id: data.id || 'ref-' + Date.now(),
        patient_name: data.patient_name || 'Emergency Patient',
        age: data.age || 45,
        gender: data.gender || 'M',
        village: data.village || 'Dhamangaon PHC',
        urgency: data.urgency || 'RED',
        symptoms: data.symptoms || [],
        vitals: data.vitals || {},
        ai_summary: data.ai_summary || 'High risk emergency referral',
        target_facility: data.target_facility || 'Sub-District Hospital Karjat',
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      setEmergencyAlert(formatted);
      showToast(`🚨 REALTIME RED EMERGENCY: ${formatted.patient_name} (${formatted.village})`);
    };

    window.addEventListener('arogya-mock-red-alert', handleMockAlert);
    window.addEventListener('arogya-patient-emergency', handleMockAlert);
    return () => {
      window.removeEventListener('arogya-mock-red-alert', handleMockAlert);
      window.removeEventListener('arogya-patient-emergency', handleMockAlert);
    };
  }, []);

  const handleDispatchAmbulance = () => {
    showToast('🚨 108 ALS Ambulance Dispatched to PHC Dhamangaon!');
  };

  const handleAddPatientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddPatientOpen(false);
    showToast(`✅ New OPD Patient "${patientName}" (Age ${patientAge}) registered!`);
    setPatientName('');
  };

  const formatCallTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen pb-24 text-slate-900 font-sans shadow-2xl relative border-x border-slate-200 antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-slate-700 animate-fadeIn">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Emergency RED Flash Banner */}
      {emergencyAlert && (
        <div className="sticky top-14 z-[90] bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white p-3.5 border-b-2 border-red-400 shadow-2xl animate-pulse flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px] animate-spin">warning</span>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-rose-200">
                108 Emergency Call Received
              </div>
              <h4 className="text-xs font-black leading-tight">
                {emergencyAlert.patient_name} ({emergencyAlert.age} {emergencyAlert.gender}) • {emergencyAlert.village}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleDispatchAmbulance}
              className="bg-white text-red-700 font-extrabold text-[10px] px-2.5 py-1.5 rounded-xl shadow-md cursor-pointer hover:bg-slate-100"
            >
              Dispatch 108
            </button>
            <button
              onClick={() => setEmergencyAlert(null)}
              className="text-white text-[10px] px-2 py-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Top Mobile Status & Header Bar */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-slate-100 space-y-2">
        {/* Mobile Clock & Status Icons */}
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 px-1">
          <span>9:41</span>
          <div className="flex items-center gap-1.5 text-slate-800">
            <span className="material-symbols-outlined text-[14px]">signal_cellular_alt</span>
            <span className="material-symbols-outlined text-[14px]">wifi</span>
            <span className="material-symbols-outlined text-[14px]">battery_full</span>
          </div>
        </div>

        {/* Doctor Greeting & Location Subtitle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => showToast('PHC Doctor Menu')}
              className="text-slate-800 hover:text-slate-900 p-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[26px]">menu</span>
            </button>
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight leading-tight flex items-center gap-1">
                Good Morning, Dr. Anjali! 👋
              </h1>
              <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 leading-none mt-0.5">
                <span className="material-symbols-outlined text-[13px] text-emerald-600">location_on</span>
                <span>Dhamangaon PHC, Wardha, Maharashtra</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => setIsEmergencyModalOpen(true)}
              className="relative p-2 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[24px]">notifications</span>
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                3
              </span>
            </button>

            {/* Doctor Avatar */}
            <img
              src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80"
              alt="Dr. Anjali"
              className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400 shrink-0 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Main Container Content */}
      <div className="p-4 space-y-4">
        {activeTab === 'home' && (
          <>
            {/* HERO CARD: "PHC Practice Overview" */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-3xl p-5 shadow-xl relative overflow-hidden space-y-4">
              {/* Graphic Illustration of PHC Building on Right */}
              <div className="absolute right-2 top-2 bottom-2 w-32 flex items-center justify-end pointer-events-none opacity-95">
                <div className="w-24 h-24 rounded-2xl bg-white/10 backdrop-blur-md border border-white/30 flex flex-col items-center justify-center text-center p-2">
                  <span className="material-symbols-outlined text-emerald-200 text-[36px]">
                    domain
                  </span>
                  <span className="text-[10px] font-black tracking-wider text-white">PHC</span>
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="relative z-10 space-y-1">
                <h2 className="text-lg font-black tracking-tight text-white">PHC Practice Overview</h2>
                <p className="text-xs text-emerald-100 font-medium">Serving our community with care.</p>
              </div>

              {/* Top 3 Metrics Row */}
              <div className="relative z-10 grid grid-cols-3 gap-2 pt-1">
                <div className="bg-white/15 backdrop-blur-md p-2.5 rounded-2xl border border-white/20 text-center">
                  <span className="material-symbols-outlined text-emerald-200 text-[18px]">
                    groups
                  </span>
                  <div className="text-[10px] text-emerald-100 font-semibold uppercase">Today's OPD</div>
                  <div className="text-base font-black text-white leading-tight">126</div>
                </div>

                <div className="bg-white/15 backdrop-blur-md p-2.5 rounded-2xl border border-white/20 text-center">
                  <span className="material-symbols-outlined text-emerald-200 text-[18px]">
                    calendar_month
                  </span>
                  <div className="text-[10px] text-emerald-100 font-semibold uppercase">Appointments</div>
                  <div className="text-base font-black text-white leading-tight">18</div>
                </div>

                <div className="bg-white/15 backdrop-blur-md p-2.5 rounded-2xl border border-white/20 text-center">
                  <span className="material-symbols-outlined text-emerald-200 text-[18px]">
                    assignment
                  </span>
                  <div className="text-[10px] text-emerald-100 font-semibold uppercase">Follow-ups</div>
                  <div className="text-base font-black text-white leading-tight">36</div>
                </div>
              </div>

              {/* Bottom 2 Metrics Row */}
              <div className="relative z-10 grid grid-cols-2 gap-2 pt-2 border-t border-white/20">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-200 text-[20px]">
                    link
                  </span>
                  <div>
                    <div className="text-[9px] font-semibold text-emerald-100 uppercase">Referrals</div>
                    <div className="text-sm font-black text-white">12</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-l border-white/20 pl-3">
                  <span className="material-symbols-outlined text-emerald-200 text-[20px]">
                    vaccines
                  </span>
                  <div>
                    <div className="text-[9px] font-semibold text-emerald-100 uppercase">Vaccination</div>
                    <div className="text-sm font-black text-white">84% Coverage</div>
                  </div>
                </div>
              </div>
            </div>

            {/* QUICK ACTIONS (8 Rounded Cards 2x4 Grid) */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-extrabold text-slate-900">Quick Actions</h3>

              <div className="grid grid-cols-4 gap-2.5">
                {/* 1. New Patient */}
                <button
                  onClick={() => setIsAddPatientOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">person_add</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    New Patient
                  </span>
                </button>

                {/* 2. OPD Queue */}
                <button
                  onClick={() => setIsOpdQueueOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">groups</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    OPD Queue
                  </span>
                </button>

                {/* 3. Teleconsult */}
                <button
                  onClick={() => setIsTeleconsultOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">videocam</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    Teleconsult
                  </span>
                </button>

                {/* 4. Referral */}
                <button
                  onClick={() => setIsReferralOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">swap_horiz</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    Referral
                  </span>
                </button>

                {/* 5. Lab Orders */}
                <button
                  onClick={() => setIsLabOrdersOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">science</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    Lab Orders
                  </span>
                </button>

                {/* 6. Medicine Stock */}
                <button
                  onClick={() => setIsMedicineStockOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">medication</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    Medicine Stock
                  </span>
                </button>

                {/* 7. Immunization */}
                <button
                  onClick={() => setIsImmunizationOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">vaccines</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    Immunization
                  </span>
                </button>

                {/* 8. Emergency */}
                <button
                  onClick={() => setIsEmergencyModalOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-rose-200 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform animate-pulse">
                    <span className="material-symbols-outlined text-[24px]">notifications_active</span>
                  </div>
                  <span className="text-[11px] font-bold text-rose-700 leading-tight">
                    Emergency
                  </span>
                </button>
              </div>
            </div>

            {/* SPLIT ROW 1: Today's OPD Queue & High Risk Alerts */}
            <div className="grid grid-cols-2 gap-3">
              {/* Left Card: Today's OPD Queue */}
              <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-900">Today's OPD Queue</h3>
                  <button
                    onClick={() => setIsOpdQueueOpen(true)}
                    className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80"
                        alt="Rohan Patil"
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 leading-tight">Rohan Patil</div>
                        <div className="text-[9px] text-slate-500">32 yrs • Fever, Cough</div>
                      </div>
                    </div>
                    <span className="bg-teal-100 text-teal-800 text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                      Waiting
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80"
                        alt="Sunita More"
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 leading-tight">Sunita More</div>
                        <div className="text-[9px] text-slate-500">26 yrs • ANC Checkup</div>
                      </div>
                    </div>
                    <span className="bg-teal-100 text-teal-800 text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                      Waiting
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80"
                        alt="Amit Deshmukh"
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 leading-tight">Amit Deshmukh</div>
                        <div className="text-[9px] text-slate-500">45 yrs • Diabetes Follow-up</div>
                      </div>
                    </div>
                    <span className="bg-teal-100 text-teal-800 text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                      Waiting
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpdQueueOpen(true)}
                  className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-[10px] py-2 rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer mt-1"
                >
                  <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                  <span>View Full Queue (12)</span>
                </button>
              </div>

              {/* Right Card: High Risk Alerts */}
              <div className="bg-rose-50/70 rounded-3xl p-4 border border-rose-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-rose-200/60 pb-2">
                  <h3 className="text-xs font-black text-rose-900">High Risk Alerts</h3>
                  <button
                    onClick={() => setIsEmergencyModalOpen(true)}
                    className="text-[10px] font-bold text-rose-700 hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2 bg-white rounded-2xl border border-rose-200 flex items-center gap-2">
                    <span className="material-symbols-outlined text-rose-600 text-[18px]">
                      pregnant_woman
                    </span>
                    <div>
                      <div className="font-bold text-rose-900 text-[10px]">3 Pregnant Women</div>
                      <div className="text-[8px] text-rose-700 font-semibold">High Risk</div>
                    </div>
                  </div>

                  <div className="p-2 bg-white rounded-2xl border border-rose-200 flex items-center gap-2">
                    <span className="material-symbols-outlined text-rose-600 text-[18px]">
                      bloodtype
                    </span>
                    <div>
                      <div className="font-bold text-rose-900 text-[10px]">2 Uncontrolled</div>
                      <div className="text-[8px] text-rose-700 font-semibold">Diabetes</div>
                    </div>
                  </div>

                  <div className="p-2 bg-white rounded-2xl border border-rose-200 flex items-center gap-2">
                    <span className="material-symbols-outlined text-rose-600 text-[18px]">
                      vital_signs
                    </span>
                    <div>
                      <div className="font-bold text-rose-900 text-[10px]">1 BP Critical Patient</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SPLIT ROW 2: Maternal & Child Health & Medicine Stock Alerts */}
            <div className="grid grid-cols-2 gap-3">
              {/* Left Card: Maternal & Child Health */}
              <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-900">Maternal & Child Health</h3>
                  <button
                    onClick={() => showToast('Maternal Health Register')}
                    className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-pink-500 text-[20px]">
                      pregnant_woman
                    </span>
                    <div>
                      <div className="text-[9px] text-slate-500 font-semibold">ANC Visits (This Month)</div>
                      <div className="text-sm font-black text-slate-900">32</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 border-t border-slate-100 pt-2">
                    <span className="material-symbols-outlined text-indigo-500 text-[20px]">
                      domain
                    </span>
                    <div>
                      <div className="text-[9px] text-slate-500 font-semibold">Institutional Deliveries</div>
                      <div className="text-sm font-black text-slate-900">18</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 border-t border-slate-100 pt-2">
                    <span className="material-symbols-outlined text-teal-500 text-[20px]">
                      vaccines
                    </span>
                    <div>
                      <div className="text-[9px] text-slate-500 font-semibold">Fully Immunized Children</div>
                      <div className="text-sm font-black text-emerald-600">76%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Card: Medicine Stock Alerts */}
              <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-900">Medicine Stock Alerts</h3>
                  <button
                    onClick={() => setIsMedicineStockOpen(true)}
                    className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                        medication
                      </span>
                      <div>
                        <div className="font-extrabold text-slate-900 text-[10px]">Paracetamol 500mg</div>
                        <div className="text-[8px] font-bold text-amber-600">Low Stock •</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                        local_drinking
                      </span>
                      <div>
                        <div className="font-extrabold text-slate-900 text-[10px]">ORS Pack</div>
                        <div className="text-[8px] font-bold text-amber-600">Low Stock •</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-rose-600 text-[18px]">
                        pill
                      </span>
                      <div>
                        <div className="font-extrabold text-slate-900 text-[10px]">Iron Folic Acid</div>
                        <div className="text-[8px] font-bold text-rose-600">Out of Stock •</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SPLIT ROW 3: Referrals Pending & Recent Patients */}
            <div className="grid grid-cols-2 gap-3">
              {/* Left Card: Referrals Pending */}
              <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-900">Referrals Pending</h3>
                  <button
                    onClick={() => setIsReferralOpen(true)}
                    className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  {referralsLoading ? (
                    <p className="text-center py-2 text-slate-500">Loading...</p>
                  ) : referrals.length === 0 ? (
                    <p className="text-center py-2 text-slate-500">No pending referrals.</p>
                  ) : (
                    referrals.slice(0, 3).map((ref) => (
                      <div key={ref.id} className="p-2 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                            local_hospital
                          </span>
                          <span className="font-bold text-slate-800 text-[10px] uppercase">{ref.status}</span>
                        </div>
                        <span className="font-black text-slate-900">{ref.urgency}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Card: Recent Patients */}
              <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-900">Recent Patients</h3>
                  <button
                    onClick={() => setActiveTab('patients')}
                    className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <div>
                      <div className="font-extrabold text-slate-900 text-[10px]">Meena Joshi</div>
                      <div className="text-[8px] text-slate-500">28 yrs • Hypertension</div>
                    </div>
                    <span className="text-[8px] font-bold text-slate-400">09:15 AM</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <div>
                      <div className="font-extrabold text-slate-900 text-[10px]">Suresh Khanna</div>
                      <div className="text-[8px] text-slate-500">56 yrs • BP Check</div>
                    </div>
                    <span className="text-[8px] font-bold text-slate-400">08:45 AM</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-slate-900 text-[10px]">Pooja Singh</div>
                      <div className="text-[8px] text-slate-500">24 yrs • ANC</div>
                    </div>
                    <span className="text-[8px] font-bold text-slate-400">08:20 AM</span>
                  </div>
                </div>
              </div>
            </div>

            {/* HEALTH TIP OF THE DAY BANNER */}
            <div className="bg-emerald-50/90 border border-emerald-200/90 p-3.5 rounded-3xl flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-[20px]">shield</span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                    Health Tip of the Day
                  </span>
                  <p className="text-xs font-bold text-slate-800 leading-snug">
                    Encourage handwashing to prevent infections.
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-emerald-600 text-[20px]">chevron_right</span>
            </div>
          </>
        )}

        {/* TAB 2: PATIENTS */}
        {activeTab === 'patients' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-black text-slate-900">PHC Patient Directory</h2>
                  <p className="text-xs text-slate-500">126 Registered Community Patients</p>
                </div>
                <button
                  onClick={() => setIsAddPatientOpen(true)}
                  className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs cursor-pointer"
                >
                  + New Patient
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <div className="font-extrabold text-slate-900">Rohan Patil</div>
                    <div className="text-[10px] text-slate-500">32 yrs (M) • Dhamangaon PHC</div>
                  </div>
                  <span className="text-[9px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
                    OPD Waiting
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <div className="font-extrabold text-slate-900">Sunita More</div>
                    <div className="text-[10px] text-slate-500">26 yrs (F) • ANC Checkup</div>
                  </div>
                  <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    Confirmed
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-black text-slate-900">PHC Clinical Reports</h2>
                <p className="text-xs text-slate-500">Vaccination & Maternal Health Analytics</p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <div className="font-extrabold text-slate-900">Vaccination Coverage</div>
                  <div className="text-lg font-black text-emerald-700 mt-1">84%</div>
                </div>

                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
                  <div className="font-extrabold text-slate-900">Total OPD Today</div>
                  <div className="text-lg font-black text-blue-700 mt-1">126 Patients</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PROFILE */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                <img
                  src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80"
                  alt="Dr. Anjali"
                  className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 shadow-md"
                />
                <div>
                  <h2 className="text-base font-black text-slate-900">Dr. Anjali</h2>
                  <p className="text-xs text-slate-500 font-medium">PHC Medical Officer</p>
                  <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1">
                    Dhamangaon PHC, Wardha
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD PATIENT MODAL */}
      {isAddPatientOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-black text-slate-900">New OPD Patient Registration</h3>
              <button
                onClick={() => setIsAddPatientOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPatientSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="e.g. Ramesh Shivaji Patil"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Age *</label>
                  <input
                    type="number"
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Chief Symptom</label>
                  <input
                    type="text"
                    value={patientSymptom}
                    onChange={(e) => setPatientSymptom(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddPatientOpen(false)}
                  className="px-3 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Register Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TELECONSULT MODAL */}
      {isTeleconsultOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-5 shadow-2xl border border-emerald-800 text-white space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-emerald-400">
                  Live Teleconsultation • {formatCallTime(callDuration)}
                </span>
              </div>
              <button
                onClick={() => setIsTeleconsultOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="relative w-full h-56 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
              {isVideoOn ? (
                <div className="relative w-full h-full">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80"
                    alt="Patient Feed"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-bold text-white border border-slate-700">
                    Rohan Patil (Patient)
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-500 space-y-2">
                  <span className="material-symbols-outlined text-4xl">videocam_off</span>
                  <div className="text-xs font-semibold">Camera Off</div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`w-12 h-12 rounded-full flex items-center justify-center border cursor-pointer ${
                  isMuted ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">
                  {isMuted ? 'mic_off' : 'mic'}
                </span>
              </button>

              <button
                onClick={() => setIsVideoOn(!isVideoOn)}
                className={`w-12 h-12 rounded-full flex items-center justify-center border cursor-pointer ${
                  !isVideoOn ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">
                  {isVideoOn ? 'videocam' : 'videocam_off'}
                </span>
              </button>

              <button
                onClick={() => setIsTeleconsultOpen(false)}
                className="w-14 h-14 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg cursor-pointer"
              >
                <span className="material-symbols-outlined text-[26px]">call_end</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: OPD QUEUE & APPOINTMENTS MANAGEMENT MODAL */}
      {isOpdQueueOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">PHC OPD & Appointment Queue</h3>
                <p className="text-[11px] text-slate-500 font-medium">Realtime patient arrivals & appointments</p>
              </div>
              <button
                onClick={() => setIsOpdQueueOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* List of queue appointments */}
            <div className="space-y-3">
              {opdAppointments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">No active OPD queue patients.</div>
              ) : (
                opdAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      apt.status === 'CHECKED_IN'
                        ? 'bg-blue-50/80 border-blue-200'
                        : apt.status === 'REQUESTED'
                        ? 'bg-amber-50/80 border-amber-200'
                        : apt.status === 'CONFIRMED'
                        ? 'bg-emerald-50/80 border-emerald-200'
                        : apt.status === 'COMPLETED'
                        ? 'bg-slate-50 border-slate-200 opacity-75'
                        : 'bg-rose-50/60 border-rose-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-black text-slate-900 leading-tight">{apt.patientName}</h4>
                          <span
                            className={`text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                              apt.status === 'CHECKED_IN'
                                ? 'bg-blue-600 text-white'
                                : apt.status === 'REQUESTED'
                                ? 'bg-amber-500 text-white'
                                : apt.status === 'CONFIRMED'
                                ? 'bg-emerald-600 text-white'
                                : apt.status === 'COMPLETED'
                                ? 'bg-slate-600 text-white'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            {apt.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600 font-semibold mt-0.5">
                          {apt.age} yrs ({apt.gender}) • {apt.village}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          <strong>{apt.consultType}</strong> • {apt.date} ({apt.timeSlot})
                        </p>
                        {apt.notes && (
                          <p className="text-[9px] text-slate-500 italic mt-0.5">"{apt.notes}"</p>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-1.5 pt-2.5 mt-2 border-t border-slate-200/60">
                      {apt.status === 'REQUESTED' && (
                        <>
                          <button
                            onClick={() => handleUpdateAppointmentStatus(apt.id, apt.patientId, 'CONFIRMED')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => handleUpdateAppointmentStatus(apt.id, apt.patientId, 'RESCHEDULED')}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => handleUpdateAppointmentStatus(apt.id, apt.patientId, 'CANCELLED')}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {apt.status === 'CONFIRMED' && (
                        <>
                          <button
                            onClick={() => handleUpdateAppointmentStatus(apt.id, apt.patientId, 'CHECKED_IN')}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                          >
                            Check In
                          </button>
                          <button
                            onClick={() => handleUpdateAppointmentStatus(apt.id, apt.patientId, 'NO_SHOW')}
                            className="bg-slate-600 hover:bg-slate-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                          >
                            No Show
                          </button>
                        </>
                      )}

                      {(apt.status === 'CHECKED_IN' || apt.status === 'CONFIRMED') && (
                        <button
                          onClick={() => {
                            setSelectedConsultPatient(apt);
                            setPublicSummaryText(`General OPD consultation completed at Karjat PHC for ${apt.consultType}. Follow prescription advice.`);
                            setInternalDoctorNotesText('');
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[13px]">clinical_notes</span>
                          <span>Complete Consultation</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleNotifyDiagnosticReport(apt.patientId, `Lab Report (${apt.consultType})`)}
                        className="bg-teal-700 hover:bg-teal-800 text-white text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[12px]">science</span>
                        <span>Lab Ready Alert</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CONSULTATION COMPLETION & NOTE PRIVACY MODAL */}
      {selectedConsultPatient && (
        <div className="fixed inset-0 z-[130] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-black text-slate-900">Complete Consultation</h3>
                <p className="text-[10px] text-slate-500 font-semibold">
                  Patient: {selectedConsultPatient.patientName} ({selectedConsultPatient.consultType})
                </p>
              </div>
              <button
                onClick={() => setSelectedConsultPatient(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCompleteConsultation} className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-800">
                    Patient-Facing Summary *
                  </label>
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    Sent to Patient
                  </span>
                </div>
                <textarea
                  required
                  rows={2}
                  value={publicSummaryText}
                  onChange={(e) => setPublicSummaryText(e.target.value)}
                  placeholder="e.g. Consultation completed. Maintain hydration and review in 5 days."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-800">
                    Doctor Internal Clinical Notes (Confidential)
                  </label>
                  <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[10px]">lock</span>
                    <span>Hidden from Patient</span>
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={internalDoctorNotesText}
                  onChange={(e) => setInternalDoctorNotesText(e.target.value)}
                  placeholder="e.g. Rx Tab Paracetamol 650mg TDS x 3d. Suspected viral prodrome. R/O Dengue if fever persists >48h."
                  className="w-full bg-rose-50/40 border border-rose-200 rounded-xl p-2.5 outline-none text-xs text-rose-950 placeholder:text-rose-400 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedConsultPatient(null)}
                  className="px-3 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingConsult}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>{isSubmittingConsult ? 'Completing...' : 'Complete & Notify'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: PHC <-> DISTRICT HOSPITAL REFERRALS & ESCALATION MODAL */}
      {isReferralOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Hospital Escalation & Referrals</h3>
                <p className="text-[11px] text-slate-500 font-medium">PHC ↔ District Hospital Realtime Care</p>
              </div>
              <button
                onClick={() => setIsReferralOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Referral Creation Form for PHC Doctor */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-600 text-[18px]">add_circle</span>
                <span>Create New PHC Escalation Referral</span>
              </h4>

              <form onSubmit={handleCreateReferral} className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-0.5 text-[10px]">Patient Name</label>
                    <input
                      type="text"
                      required
                      value={newRefPatientName}
                      onChange={(e) => setNewRefPatientName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-0.5 text-[10px]">Urgency / Priority</label>
                    <select
                      value={newRefPriority}
                      onChange={(e) => setNewRefPriority(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none text-xs font-bold text-rose-700"
                    >
                      <option value="RED">🔴 RED (Critical / Emergency)</option>
                      <option value="YELLOW">🟡 YELLOW (High Risk)</option>
                      <option value="GREEN">🟢 GREEN (Routine Specialist)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-0.5 text-[10px]">Reason for Referral *</label>
                  <input
                    type="text"
                    required
                    value={newRefReason}
                    onChange={(e) => setNewRefReason(e.target.value)}
                    placeholder="e.g. Acute Coronary Syndrome"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-0.5 text-[10px]">Clinical Summary *</label>
                  <textarea
                    required
                    rows={2}
                    value={newRefClinicalSummary}
                    onChange={(e) => setNewRefClinicalSummary(e.target.value)}
                    placeholder="e.g. ST elevation in ECG, Troponin positive, requires cath lab"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none text-xs"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-3.5 py-1.5 rounded-xl shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">send</span>
                    <span>Submit & Notify District Hospital</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Active Referral List */}
            <div className="space-y-3 pt-1">
              <h4 className="text-xs font-black text-slate-900">Active Hospital Referrals & Status</h4>

              {hospitalReferrals.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">No active hospital referrals.</div>
              ) : (
                hospitalReferrals.map((ref) => (
                  <div
                    key={ref.id}
                    className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
                      ref.priority === 'RED'
                        ? 'bg-rose-50/70 border-rose-200'
                        : ref.priority === 'YELLOW'
                        ? 'bg-amber-50/70 border-amber-200'
                        : 'bg-emerald-50/70 border-emerald-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-slate-900 leading-tight">{ref.patientName}</h4>
                          <span
                            className={`text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                              ref.priority === 'RED'
                                ? 'bg-rose-600 text-white'
                                : ref.priority === 'YELLOW'
                                ? 'bg-amber-500 text-white'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {ref.priority} PRIORITY
                          </span>
                          <span className="text-[8px] font-bold bg-slate-800 text-white px-2 py-0.5 rounded-full uppercase">
                            {ref.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600 font-semibold mt-0.5">
                          From: {ref.sourceFacilityName} ➔ To: {ref.destinationFacilityName}
                        </p>
                        <p className="text-[10px] text-slate-800 font-bold mt-0.5">Reason: {ref.reason}</p>
                        <p className="text-[9px] text-slate-600 mt-0.5 bg-white/70 p-1.5 rounded-lg border border-slate-200/60">
                          {ref.clinicalSummary}
                        </p>

                        {ref.additionalInfoRequested && (
                          <div className="p-2 bg-amber-100/80 rounded-xl border border-amber-300 text-[10px] text-amber-900 mt-1 space-y-1">
                            <div className="font-bold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">help</span>
                              <span>Specialist Requested Additional Info:</span>
                            </div>
                            <p className="italic">"{ref.additionalInfoRequested}"</p>
                            {ref.status === 'ADDITIONAL_INFORMATION_REQUIRED' && (
                              <div className="flex items-center gap-1 pt-1">
                                <input
                                  type="text"
                                  placeholder="Type response clinical info..."
                                  value={infoProvideText}
                                  onChange={(e) => setInfoProvideText(e.target.value)}
                                  className="w-full bg-white border border-amber-300 rounded-lg p-1.5 text-[10px] outline-none"
                                />
                                <button
                                  onClick={() => handleSubmitAdditionalInfo(ref)}
                                  className="bg-amber-700 text-white font-bold text-[9px] px-2.5 py-1 rounded-lg shrink-0 cursor-pointer"
                                >
                                  Submit
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {ref.additionalInfoProvided && (
                          <p className="text-[9px] text-emerald-800 bg-emerald-50 p-1.5 rounded-lg border border-emerald-200 mt-1 font-semibold">
                            ✓ Provided Info: {ref.additionalInfoProvided}
                          </p>
                        )}

                        {ref.scheduledDate && (
                          <p className="text-[9px] text-blue-800 bg-blue-50 p-1 rounded-lg border border-blue-200 mt-1 font-semibold">
                            📅 Scheduled: {ref.scheduledDate} ({ref.scheduledTime || '10:00 AM'})
                          </p>
                        )}
                      </div>
                    </div>

                    {/* District Hospital Action Buttons */}
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200/60">
                      {ref.status === 'CREATED' && (
                        <>
                          <button
                            onClick={() => handleUpdateReferralStatus(ref, 'RECEIVED')}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer"
                          >
                            Mark Received
                          </button>
                          <button
                            onClick={() => handleUpdateReferralStatus(ref, 'UNDER_REVIEW')}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer"
                          >
                            Review
                          </button>
                        </>
                      )}

                      {(ref.status === 'CREATED' || ref.status === 'RECEIVED' || ref.status === 'UNDER_REVIEW') && (
                        <>
                          <button
                            onClick={() => handleUpdateReferralStatus(ref, 'ACCEPTED')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleUpdateReferralStatus(ref, 'REJECTED', { rejectionReason: 'Bed capacity full / transferred' })}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => setSelectedInfoReqReferral(ref)}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer"
                          >
                            Request Info
                          </button>
                        </>
                      )}

                      {ref.status === 'ACCEPTED' && (
                        <>
                          <button
                            onClick={() =>
                              handleUpdateReferralStatus(ref, 'APPOINTMENT_SCHEDULED', {
                                scheduledDate: '2026-05-20',
                                scheduledTime: '10:30 AM',
                              })
                            }
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer"
                          >
                            Schedule Appointment
                          </button>
                          <button
                            onClick={() => handleUpdateReferralStatus(ref, 'IN_PROGRESS')}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer"
                          >
                            In Progress
                          </button>
                        </>
                      )}

                      {(ref.status === 'APPOINTMENT_SCHEDULED' || ref.status === 'IN_PROGRESS') && (
                        <>
                          <button
                            onClick={() =>
                              handleUpdateReferralStatus(ref, 'COMPLETED', {
                                treatmentSummary: 'Coronary angioplasty successful. Patient stable.',
                              })
                            }
                            className="bg-emerald-700 hover:bg-emerald-800 text-white text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer"
                          >
                            Complete Treatment
                          </button>
                          <button
                            onClick={() =>
                              handleUpdateReferralStatus(ref, 'RETURNED_TO_PHC', {
                                followUpInstructions: 'Monitor BP and compliance with dual antiplatelet therapy weekly.',
                              })
                            }
                            className="bg-teal-700 hover:bg-teal-800 text-white text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer"
                          >
                            Return to PHC
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: DH SPECIALIST REQUEST ADDITIONAL INFORMATION MODAL */}
      {selectedInfoReqReferral && (
        <div className="fixed inset-0 z-[130] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-black text-slate-900">Request Additional Info</h3>
                <p className="text-[10px] text-slate-500 font-semibold">
                  From: {selectedInfoReqReferral.sourceFacilityName}
                </p>
              </div>
              <button
                onClick={() => setSelectedInfoReqReferral(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRequestAdditionalInfo} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Specific Information Required *
                </label>
                <textarea
                  required
                  rows={3}
                  value={infoReqText}
                  onChange={(e) => setInfoReqText(e.target.value)}
                  placeholder="e.g. Please provide latest serum creatinine and 12-lead ECG strip."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedInfoReqReferral(null)}
                  className="px-3 py-1.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">send</span>
                  <span>Send Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Matching Screenshot) */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-between z-40 shadow-2xl">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center font-bold text-[10px] gap-0.5 cursor-pointer ${
            activeTab === 'home' ? 'text-emerald-600' : 'text-slate-500'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">home</span>
          <span>Home</span>
        </button>

        <button
          onClick={() => setActiveTab('patients')}
          className={`flex flex-col items-center font-bold text-[10px] gap-0.5 cursor-pointer ${
            activeTab === 'patients' ? 'text-emerald-600' : 'text-slate-500'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">group</span>
          <span>Patients</span>
        </button>

        {/* Center Floating Action Button (FAB) */}
        <button
          onClick={() => setIsAddPatientOpen(true)}
          className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg -mt-5 border-4 border-slate-50 transition-transform active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[28px]">add</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex flex-col items-center font-bold text-[10px] gap-0.5 cursor-pointer ${
            activeTab === 'reports' ? 'text-emerald-600' : 'text-slate-500'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">bar_chart</span>
          <span>Reports</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center font-bold text-[10px] gap-0.5 cursor-pointer ${
            activeTab === 'profile' ? 'text-emerald-600' : 'text-slate-500'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">person</span>
          <span>Profile</span>
        </button>
      </div>
    </div>
  );
};
