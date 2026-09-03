import React, { useState, useEffect } from 'react';
import { createClient } from '../lib/supabase/client';

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

export const DoctorView: React.FC = () => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'patients' | 'reports' | 'profile'>('home');

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
                  <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                        local_hospital
                      </span>
                      <span className="font-bold text-slate-800 text-[10px]">Civil Hospital Wardha</span>
                    </div>
                    <span className="font-black text-slate-900">5</span>
                  </div>

                  <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                        domain
                      </span>
                      <span className="font-bold text-slate-800 text-[10px]">District Hospital Wardha</span>
                    </div>
                    <span className="font-black text-slate-900">7</span>
                  </div>
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
