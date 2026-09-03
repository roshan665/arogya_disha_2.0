import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import { saveVisitOffline } from '../lib/db';

interface PatientViewProps {
  user?: any;
}

export const PatientView: React.FC<PatientViewProps> = ({ user }) => {
  const router = useRouter();
  const [language, setLanguage] = useState<'mr' | 'en'>('mr');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'appointments' | 'reports' | 'profile'>('home');

  // Modals state
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isAshaChatModalOpen, setIsAshaChatModalOpen] = useState(false);
  const [isBookAppointmentOpen, setIsBookAppointmentOpen] = useState(false);
  const [isMedicineReminderOpen, setIsMedicineReminderOpen] = useState(false);
  const [isHealthRecordsOpen, setIsHealthRecordsOpen] = useState(false);
  const [isLabReportsOpen, setIsLabReportsOpen] = useState(false);
  const [isHealthTipsOpen, setIsHealthTipsOpen] = useState(false);
  const [isNearbyServicesOpen, setIsNearbyServicesOpen] = useState(false);

  // 108 Emergency Simulator
  const [etaMins, setEtaMins] = useState(8);

  // ASHA Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; time: string }>>([
    { sender: 'ASHA Sunita', text: 'Namaste Roshan! How are you feeling today? Remember your ANC checkup on 15 May.', time: '09:15 AM' },
  ]);
  const [inputMsg, setInputMsg] = useState('');

  // Appointment Form State
  const [aptType, setAptType] = useState('ANC Checkup');
  const [aptDate, setAptDate] = useState('2024-05-15');
  const [aptTime, setAptTime] = useState('10:00 AM');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const patientName = user?.user_metadata?.full_name || 'Roshan';
  const abhaId = '91-8402-1928-3012';

  // 108 Ambulance ETA Timer
  useEffect(() => {
    let timer: any;
    if (isEmergencyModalOpen && etaMins > 1) {
      timer = setInterval(() => {
        setEtaMins((prev) => Math.max(1, prev - 1));
      }, 10000);
    }
    return () => clearInterval(timer);
  }, [isEmergencyModalOpen, etaMins]);

  // Function: Trigger 108 Emergency & Broadcast to Doctor / Admin Portals
  const handleTrigger108Emergency = async () => {
    setIsEmergencyModalOpen(true);
    setEtaMins(8);

    const timestamp = new Date().toISOString();
    const mockReferralId = 'ref-patient-' + Math.floor(1000 + Math.random() * 9000);

    const emergencyPayload = {
      id: mockReferralId,
      patient_id: 'p-patient-101',
      patient_name: patientName,
      age: 28,
      gender: 'M' as const,
      village: 'Dhamangaon Sub-center',
      urgency: 'RED' as const,
      risk_score: 'RED' as const,
      symptoms: ['Patient-Initiated 108 Call', 'Acute Medical Emergency', 'High Pulse'],
      vitals: {
        bp_systolic: 140,
        bp_diastolic: 90,
        heart_rate: 110,
        spo2: 95,
        temperature: 99.1,
      },
      ai_summary:
        `PATIENT EMERGENCY CALL: Patient ${patientName} triggered 108 ALS Ambulance from Patient Portal. Immediate Medical Transport requested.`,
      recommended_action:
        'Dispatch 108 ALS Unit MH-14-EM-1084 immediately to Dhamangaon PHC Sub-center.',
      marathi_translation:
        'रुग्णाने थेट १०८ रुग्णवाहिका मागवली आहे. धामणगाव उपकेंद्रावर रुग्णवाहिका पाठवा.',
      target_facility: 'Sub-District Hospital (SDH) Karjat - Emergency Unit',
      department: 'Emergency & Trauma Care',
      status: 'pending',
      created_at: timestamp,
      referring_worker: `Patient Self-Escalation (ABHA: ${abhaId})`,
      ambulance_dispatched: true,
      ambulance_eta_mins: 8,
    };

    // 1. Save to Supabase
    const supabase = createClient();
    try {
      await supabase.from('referrals').insert({
        target_facility: emergencyPayload.target_facility,
        department: emergencyPayload.department,
        urgency: 'RED',
        clinical_notes: emergencyPayload.ai_summary,
        status: 'pending',
        ambulance_dispatched: true,
        ambulance_eta_mins: 8,
      });
    } catch (err) {
      console.warn('Supabase referral insert info:', err);
    }

    // 2. Save local Dexie backup
    try {
      await saveVisitOffline({
        name: patientName,
        symptoms: emergencyPayload.symptoms,
        vitals: emergencyPayload.vitals,
        risk_score: 'RED',
        ai_summary: emergencyPayload.ai_summary,
        recommended_action: emergencyPayload.recommended_action,
        marathi_translation: emergencyPayload.marathi_translation,
        sync_status: 'synced',
      });
    } catch (e) {
      console.warn('Dexie save visit info:', e);
    }

    // 3. Dispatch Custom Event so Doctor / Admin dashboards update live!
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('arogya-mock-red-alert', { detail: emergencyPayload }));
      window.dispatchEvent(new CustomEvent('arogya-patient-emergency', { detail: emergencyPayload }));
    }

    showToast('🚨 108 Emergency Call Transmitted! Doctor & Dispatcher Notified.');
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const newMsg = {
      sender: 'You',
      text: inputMsg.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setInputMsg('');

    // Auto-reply simulation from ASHA Worker
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'ASHA Sunita',
          text: 'Thank you for reaching out, Roshan. I have noted your request and will follow up with PHC Karjat doctor.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 1500);
  };

  const handleBookAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsBookAppointmentOpen(false);
    showToast(`📅 Appointment booked for ${aptDate} at ${aptTime} (${aptType})`);
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

      {/* Top Mobile Status & Header Bar */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-slate-100 space-y-2">
        {/* Status Bar Clock */}
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 px-1">
          <span>9:41</span>
          <div className="flex items-center gap-1.5 text-slate-800">
            <span className="material-symbols-outlined text-[14px]">signal_cellular_alt</span>
            <span className="material-symbols-outlined text-[14px]">wifi</span>
            <span className="material-symbols-outlined text-[14px]">battery_full</span>
          </div>
        </div>

        {/* User Greeting & Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => showToast('Patient Navigation Menu')}
              className="text-slate-800 hover:text-slate-900 p-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[26px]">menu</span>
            </button>
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight leading-tight flex items-center gap-1">
                Good Morning, {patientName}! 👋
              </h1>
              <p className="text-[11px] font-medium text-slate-500 leading-none mt-0.5">
                Take charge of your health today.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => showToast('3 Active Health Notifications')}
              className="relative p-2 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[24px]">notifications</span>
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                3
              </span>
            </button>

            {/* Language Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                type="button"
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200 flex items-center gap-1 cursor-pointer transition-all"
              >
                <span>{language === 'mr' ? 'मराठी' : 'English'}</span>
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>

              {showLanguageMenu && (
                <div className="absolute right-0 mt-1 w-32 bg-white rounded-2xl shadow-xl border border-slate-200 py-1 z-50 animate-fadeIn">
                  <button
                    onClick={() => {
                      setLanguage('mr');
                      setShowLanguageMenu(false);
                      showToast('भाषा बदलली: मराठी');
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center justify-between"
                  >
                    <span>मराठी</span>
                    {language === 'mr' && <span className="text-emerald-600 font-bold">✓</span>}
                  </button>
                  <button
                    onClick={() => {
                      setLanguage('en');
                      setShowLanguageMenu(false);
                      showToast('Language set to English');
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center justify-between"
                  >
                    <span>English</span>
                    {language === 'en' && <span className="text-emerald-600 font-bold">✓</span>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Container Content */}
      <div className="p-4 space-y-4">
        {activeTab === 'home' && (
          <>
            {/* HERO CARD: "Your Health Overview" */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-3xl p-5 shadow-xl relative overflow-hidden space-y-4">
              {/* Graphic Illustration on Right */}
              <div className="absolute right-2 top-2 bottom-2 w-32 flex items-center justify-end pointer-events-none opacity-95">
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80"
                    alt="Patient Health Illustration"
                    className="w-24 h-24 rounded-full object-cover border-2 border-white/40 shadow-lg"
                  />
                  <div className="absolute bottom-1 right-2 w-8 h-8 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-md">
                    <span className="material-symbols-outlined text-white text-[18px]">add</span>
                  </div>
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="relative z-10 space-y-1">
                <h2 className="text-lg font-black tracking-tight text-white">Your Health Overview</h2>
                <p className="text-xs text-emerald-100 font-medium">Small steps, big impact!</p>
              </div>

              {/* 4 Glassmorphism Vitals Columns */}
              <div className="relative z-10 grid grid-cols-4 gap-2 pt-2 border-t border-white/20 text-center">
                {/* Heart Rate */}
                <div className="space-y-0.5">
                  <span className="material-symbols-outlined text-emerald-200 text-[18px]">
                    favorite
                  </span>
                  <div className="text-sm font-black text-white leading-tight">72</div>
                  <div className="text-[9px] text-emerald-100 font-semibold uppercase">bpm</div>
                  <div className="text-[9px] text-emerald-200 font-medium">Heart Rate</div>
                </div>

                {/* Blood Pressure */}
                <div className="space-y-0.5 border-l border-white/15 pl-1">
                  <span className="material-symbols-outlined text-emerald-200 text-[18px]">
                    water_drop
                  </span>
                  <div className="text-sm font-black text-white leading-tight">120/80</div>
                  <div className="text-[9px] text-emerald-100 font-semibold uppercase">mmHg</div>
                  <div className="text-[9px] text-emerald-200 font-medium">Blood Pressure</div>
                </div>

                {/* Blood Sugar */}
                <div className="space-y-0.5 border-l border-white/15 pl-1">
                  <span className="material-symbols-outlined text-emerald-200 text-[18px]">
                    bloodtype
                  </span>
                  <div className="text-sm font-black text-white leading-tight">98</div>
                  <div className="text-[9px] text-emerald-100 font-semibold uppercase">mg/dL</div>
                  <div className="text-[9px] text-emerald-200 font-medium">Blood Sugar</div>
                </div>

                {/* Weight */}
                <div className="space-y-0.5 border-l border-white/15 pl-1">
                  <span className="material-symbols-outlined text-emerald-200 text-[18px]">
                    medical_services
                  </span>
                  <div className="text-sm font-black text-white leading-tight">65</div>
                  <div className="text-[9px] text-emerald-100 font-semibold uppercase">kg</div>
                  <div className="text-[9px] text-emerald-200 font-medium">Weight</div>
                </div>
              </div>
            </div>

            {/* "Connect with Your ASHA" BANNER */}
            <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-3xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <img
                  src="https://images.unsplash.com/photo-1594824813566-8885565d8363?w=150&auto=format&fit=crop&q=80"
                  alt="ASHA Worker Avatar"
                  className="w-11 h-11 rounded-full object-cover border-2 border-emerald-400 shrink-0"
                />
                <div>
                  <h3 className="text-xs font-black text-slate-900 leading-tight">
                    Connect with Your ASHA
                  </h3>
                  <p className="text-[10px] font-semibold text-emerald-800">
                    ASHA Worker • Dhamangaon PHC
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAshaChatModalOpen(true)}
                className="bg-white hover:bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-300 shadow-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[16px] text-emerald-600">chat</span>
                <span>Contact ASHA</span>
              </button>
            </div>

            {/* QUICK ACTIONS (8 Rounded Cards Grid) */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-extrabold text-slate-900">Quick Actions</h3>

              <div className="grid grid-cols-4 gap-2.5">
                {/* 1. Contact ASHA */}
                <button
                  onClick={() => setIsAshaChatModalOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">support_agent</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    Contact ASHA
                  </span>
                </button>

                {/* 2. Call Ambulance */}
                <button
                  onClick={handleTrigger108Emergency}
                  className="bg-white p-3 rounded-2xl border border-rose-200 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform animate-pulse">
                    <span className="material-symbols-outlined text-[24px]">airport_shuttle</span>
                  </div>
                  <span className="text-[11px] font-bold text-rose-700 leading-tight">
                    Call Ambulance
                  </span>
                </button>

                {/* 3. Book Appointment */}
                <button
                  onClick={() => setIsBookAppointmentOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">calendar_month</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    Book Appointment
                  </span>
                </button>

                {/* 4. Medicine Reminder */}
                <button
                  onClick={() => setIsMedicineReminderOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">pill</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    Medicine Reminder
                  </span>
                </button>

                {/* 5. Health Records */}
                <button
                  onClick={() => setIsHealthRecordsOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">post_add</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    Health Records
                  </span>
                </button>

                {/* 6. Lab Reports */}
                <button
                  onClick={() => setIsLabReportsOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">science</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    Lab Reports
                  </span>
                </button>

                {/* 7. Health Tips */}
                <button
                  onClick={() => setIsHealthTipsOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">lightbulb</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    Health Tips
                  </span>
                </button>

                {/* 8. Nearby Services */}
                <button
                  onClick={() => setIsNearbyServicesOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">location_on</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    Nearby Services
                  </span>
                </button>
              </div>
            </div>

            {/* HEALTH INSIGHTS SECTION */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">Health Insights</h3>
                <button
                  onClick={() => showToast('Viewing complete Health Analytics')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  View All
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Left Card: Health Score */}
                <div className="bg-emerald-50/60 p-4 rounded-3xl border border-emerald-200/80 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-xs font-black text-slate-900">You're doing good!</h4>
                    <p className="text-[10px] font-medium text-slate-500">Keep it up to stay healthy.</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xl font-black text-slate-900">
                        8.5<span className="text-xs text-slate-400 font-semibold">/10</span>
                      </div>
                      <div className="text-[10px] font-bold text-emerald-700">Health Score</div>
                    </div>

                    {/* Progress Gauge */}
                    <div className="relative w-12 h-12 shrink-0">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#d1fae5"
                          strokeWidth="3.8"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="4"
                          strokeDasharray="85, 100"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Right Stack: Trackers */}
                <div className="bg-white p-3 rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                        directions_walk
                      </span>
                      <div>
                        <div className="text-[10px] font-bold text-slate-900">Walk</div>
                        <div className="text-[9px] text-slate-500 font-medium">6,000 steps</div>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">chevron_right</span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-500 text-[18px]">
                        local_drinking
                      </span>
                      <div>
                        <div className="text-[10px] font-bold text-slate-900">Water</div>
                        <div className="text-[9px] text-slate-500 font-medium">5 glasses</div>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">chevron_right</span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-purple-500 text-[18px]">
                        bedtime
                      </span>
                      <div>
                        <div className="text-[10px] font-bold text-slate-900">Sleep</div>
                        <div className="text-[9px] text-slate-500 font-medium">7 hrs</div>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">chevron_right</span>
                  </div>
                </div>
              </div>
            </div>

            {/* EMERGENCY SERVICES SECTION */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-extrabold text-slate-900">Emergency Services</h3>

              <div className="grid grid-cols-2 gap-3">
                {/* Call Ambulance */}
                <button
                  onClick={handleTrigger108Emergency}
                  className="bg-rose-50/90 hover:bg-rose-100 p-3.5 rounded-3xl border border-rose-200/90 flex items-center justify-between transition-all cursor-pointer text-left active:scale-95"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <span className="material-symbols-outlined text-[22px]">call</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-rose-900 leading-tight">Call Ambulance</h4>
                      <p className="text-[10px] font-bold text-rose-700">24x7 Emergency</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-rose-600 text-[18px]">chevron_right</span>
                </button>

                {/* Emergency Helpline */}
                <a
                  href="tel:108"
                  className="bg-rose-50/90 hover:bg-rose-100 p-3.5 rounded-3xl border border-rose-200/90 flex items-center justify-between transition-all cursor-pointer text-left active:scale-95"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                      <span className="material-symbols-outlined text-[22px]">notifications_active</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-rose-900 leading-tight">Emergency Helpline</h4>
                      <p className="text-[10px] font-bold text-rose-700">108 / 104</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-rose-600 text-[18px]">chevron_right</span>
                </a>
              </div>
            </div>

            {/* UPCOMING APPOINTMENTS SECTION */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">Upcoming Appointments</h3>
                <button
                  onClick={() => setIsBookAppointmentOpen(true)}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  View All
                </button>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Date Box */}
                  <div className="w-14 h-14 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center shrink-0">
                    <span className="text-base font-black text-slate-900 leading-none">15</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">May</span>
                  </div>

                  {/* Appointment Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-extrabold text-slate-900">ANC Checkup</h4>
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full">
                        Confirmed
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                      10:00 AM • Sunita More
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">Dhamangaon PHC</p>
                  </div>
                </div>

                {/* Call Button */}
                <button
                  onClick={() => showToast('Calling ASHA Sunita More...')}
                  className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 flex items-center justify-center shrink-0 cursor-pointer transition-colors border border-slate-200"
                >
                  <span className="material-symbols-outlined text-[20px]">call</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-black text-slate-900">Your Appointments</h2>
                  <p className="text-xs text-slate-500">Dhamangaon PHC & ASHA Visits</p>
                </div>
                <button
                  onClick={() => setIsBookAppointmentOpen(true)}
                  className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs hover:bg-emerald-500 cursor-pointer"
                >
                  + Book New
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded-md">
                        Upcoming
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900 mt-1">ANC Routine Checkup</h3>
                    </div>
                    <span className="text-xs font-black text-emerald-800 bg-white px-2 py-1 rounded-xl border border-emerald-200">
                      15 May
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    With <strong>Sunita More (ASHA)</strong> • 10:00 AM
                  </p>
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
                <h2 className="text-base font-black text-slate-900">Diagnostic Reports</h2>
                <p className="text-xs text-slate-500">Laboratory & Vitals History</p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-900">CBC Complete Blood Count</div>
                    <div className="text-[10px] text-slate-500">12 May 2024 • Normal</div>
                  </div>
                  <button
                    onClick={() => showToast('Downloading Report PDF...')}
                    className="text-xs font-bold text-emerald-600 hover:underline"
                  >
                    Download
                  </button>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-900">Fasting Blood Sugar Test</div>
                    <div className="text-[10px] text-slate-500">08 May 2024 • 98 mg/dL</div>
                  </div>
                  <button
                    onClick={() => showToast('Downloading Report PDF...')}
                    className="text-xs font-bold text-emerald-600 hover:underline"
                  >
                    Download
                  </button>
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
                <div className="w-16 h-16 rounded-full bg-emerald-600 text-white font-black text-xl flex items-center justify-center shadow-md">
                  RP
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">{patientName}</h2>
                  <p className="text-xs text-slate-500 font-medium">ABHA ID: {abhaId}</p>
                  <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1">
                    PM-JAY Active
                  </span>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs py-3 rounded-2xl transition-colors cursor-pointer"
              >
                Sign Out of Account
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: 108 EMERGENCY AMBULANCE TRACKER MODAL */}
      {isEmergencyModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-300 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                <h3 className="text-lg font-black text-rose-900">108 ALS Ambulance En-Route</h3>
              </div>
              <button
                onClick={() => setIsEmergencyModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-gradient-to-br from-rose-950 via-slate-900 to-slate-950 text-white p-5 rounded-2xl border border-rose-800/80 space-y-4 text-center">
              <div className="flex items-center justify-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <span className="material-symbols-outlined text-[20px] animate-spin">sync</span>
                <span>Live GPS Telemetry Active</span>
              </div>

              <div className="text-4xl font-black text-white tracking-tight">
                {etaMins} <span className="text-lg font-bold text-rose-300">MINS ETA</span>
              </div>

              <div className="bg-white/10 p-3 rounded-xl border border-white/20 text-xs text-slate-200 space-y-1">
                <div>
                  <strong>Ambulance Unit:</strong> MH-14-EM-1084 (ALS)
                </div>
                <div>
                  <strong>Driver:</strong> Ramesh Shinde (ID: 108-MH-402)
                </div>
              </div>

              <div className="text-[11px] text-emerald-400 font-semibold">
                ✓ PHC Medical Officer & Emergency Room Pre-Notified Live
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="tel:108"
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-3 rounded-2xl shadow-md text-center flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
                <span>Call Driver Directly</span>
              </a>
              <button
                onClick={() => setIsEmergencyModalOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-3 rounded-2xl cursor-pointer"
              >
                Minimize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ASHA CHAT MODAL */}
      {isAshaChatModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <img
                  src="https://images.unsplash.com/photo-1594824813566-8885565d8363?w=150&auto=format&fit=crop&q=80"
                  alt="ASHA Worker Avatar"
                  className="w-9 h-9 rounded-full object-cover border border-emerald-400"
                />
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900">ASHA Sunita More</h3>
                  <span className="text-[9px] font-bold text-emerald-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsAshaChatModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Chat Messages */}
            <div className="h-48 overflow-y-auto space-y-2 p-2 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-2xl max-w-[85%] space-y-0.5 ${
                    msg.sender === 'You'
                      ? 'bg-emerald-600 text-white ml-auto rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                  }`}
                >
                  <p>{msg.text}</p>
                  <div className="text-[8px] opacity-70 text-right">{msg.time}</div>
                </div>
              ))}
            </div>

            {/* Chat Input Form */}
            <form onSubmit={handleSendChatMessage} className="flex gap-2">
              <input
                type="text"
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                placeholder="Type a message to ASHA..."
                className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
              />
              <button
                type="submit"
                className="bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: BOOK APPOINTMENT MODAL */}
      {isBookAppointmentOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-black text-slate-900">Book Doctor Appointment</h3>
              <button
                onClick={() => setIsBookAppointmentOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBookAppointment} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Consultation Type</label>
                <select
                  value={aptType}
                  onChange={(e) => setAptType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 outline-none"
                >
                  <option value="ANC Checkup">ANC Checkup (Routine)</option>
                  <option value="Routine Doctor Consult">Routine Doctor Consult (PHC)</option>
                  <option value="ASHA Home Visit">ASHA Home Visit Checkup</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Preferred Date</label>
                <input
                  type="date"
                  value={aptDate}
                  onChange={(e) => setAptDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Preferred Time Slot</label>
                <select
                  value={aptTime}
                  onChange={(e) => setAptTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 outline-none"
                >
                  <option value="10:00 AM">10:00 AM</option>
                  <option value="02:00 PM">02:00 PM</option>
                  <option value="04:30 PM">04:30 PM</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBookAppointmentOpen(false)}
                  className="px-3 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-xs hover:bg-emerald-500 cursor-pointer"
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: MEDICINE REMINDER MODAL */}
      {isMedicineReminderOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-black text-slate-900">Medicine Reminders</h3>
              <button
                onClick={() => setIsMedicineReminderOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 flex justify-between items-center">
                <div>
                  <div className="font-extrabold text-slate-900">Tab Iron & Folic Acid</div>
                  <div className="text-[10px] text-blue-700">1 Tablet Daily after lunch</div>
                </div>
                <span className="text-[10px] font-bold text-blue-800 bg-white px-2 py-1 rounded-xl border border-blue-200">
                  01:00 PM
                </span>
              </div>

              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 flex justify-between items-center">
                <div>
                  <div className="font-extrabold text-slate-900">Tab Calcium 500mg</div>
                  <div className="text-[10px] text-blue-700">1 Tablet Daily after dinner</div>
                </div>
                <span className="text-[10px] font-bold text-blue-800 bg-white px-2 py-1 rounded-xl border border-blue-200">
                  08:30 PM
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: HEALTH RECORDS MODAL */}
      {isHealthRecordsOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-black text-slate-900">Digital ABHA Health Records</h3>
              <button
                onClick={() => setIsHealthRecordsOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="font-bold text-slate-900">ANC Health Card</div>
                <div className="text-[10px] text-slate-500">Sub-center Dhamangaon • Verified</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="font-bold text-slate-900">Immunization Record</div>
                <div className="text-[10px] text-slate-500">TT Vaccine Dose 1 Completed</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: LAB REPORTS MODAL */}
      {isLabReportsOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-black text-slate-900">Lab Diagnostic Reports</h3>
              <button
                onClick={() => setIsLabReportsOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-900">Hemoglobin (Hb) Test</div>
                  <div className="text-[10px] text-emerald-700">12.5 g/dL • Normal</div>
                </div>
                <button
                  onClick={() => showToast('Downloading Hb Report...')}
                  className="text-xs font-bold text-emerald-600 hover:underline"
                >
                  Download
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-900">Fasting Blood Sugar</div>
                  <div className="text-[10px] text-emerald-700">98 mg/dL • Normal</div>
                </div>
                <button
                  onClick={() => showToast('Downloading Sugar Report...')}
                  className="text-xs font-bold text-emerald-600 hover:underline"
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: HEALTH TIPS MODAL */}
      {isHealthTipsOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-black text-slate-900">Daily Health Tips</h3>
              <button
                onClick={() => setIsHealthTipsOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-1">
                <div className="font-bold text-amber-900">Hydration & Nutrition</div>
                <p className="text-amber-800">
                  Drink at least 8-10 glasses of clean water daily and include green leafy vegetables in your diet.
                </p>
                <div className="text-[10px] font-semibold text-amber-700 italic pt-1 border-t border-amber-200">
                  मराठी: दररोज किमान ८-१० पेले पाणी प्या आणि हिरव्या पालेभाज्या खा.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: NEARBY SERVICES MODAL */}
      {isNearbyServicesOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-black text-slate-900">Nearby Health Services</h3>
              <button
                onClick={() => setIsNearbyServicesOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="font-bold text-slate-900">Dhamangaon Sub-center</div>
                <div className="text-[10px] text-slate-500">0.8 km away • Open 24x7</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="font-bold text-slate-900">Primary Health Centre (PHC) Karjat</div>
                <div className="text-[10px] text-slate-500">4.2 km away • OPD Active</div>
              </div>
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
          onClick={() => setActiveTab('appointments')}
          className={`flex flex-col items-center font-bold text-[10px] gap-0.5 cursor-pointer ${
            activeTab === 'appointments' ? 'text-emerald-600' : 'text-slate-500'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">calendar_today</span>
          <span>Appointments</span>
        </button>

        {/* Center Floating Action Button (FAB) */}
        <button
          onClick={() => setIsBookAppointmentOpen(true)}
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
