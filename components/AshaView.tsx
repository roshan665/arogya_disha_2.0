import React, { useState } from 'react';

interface AshaViewProps {
  isOffline: boolean;
  onToggleOffline: () => void;
  isSyncing: boolean;
  onSync: () => void;
  lastSyncedText: string;
}

export const AshaView: React.FC<AshaViewProps> = ({
  isOffline,
  onToggleOffline,
  isSyncing,
  onSync,
  lastSyncedText,
}) => {
  const [language, setLanguage] = useState<'mr' | 'en'>('mr');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals / Actions state
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const scheduleList = [
    {
      id: 'sch-1',
      time: '10:00 AM',
      type: 'ANC Checkup',
      highRisk: true,
      patientName: 'Sunita More',
      details: '28 Weeks',
      village: 'Village: Dhamangaon',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      phone: '+91 98220 12345',
    },
    {
      id: 'sch-2',
      time: '12:00 PM',
      type: 'Follow-up',
      highRisk: false,
      patientName: 'Rohan Patil',
      details: 'Fever',
      village: 'Village: Dhamangaon',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      phone: '+91 98220 54321',
    },
    {
      id: 'sch-3',
      time: '02:30 PM',
      type: 'NCD Follow-up',
      highRisk: false,
      patientName: 'Bapurao Jadhav',
      details: 'Diabetes',
      village: 'Village: Dhamangaon',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      phone: '+91 98220 98765',
    },
  ];

  return (
    <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen pb-24 text-slate-900 font-sans shadow-2xl relative border-x border-slate-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-slate-700 animate-fadeIn">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => showToast('Navigation Menu Opened')}
            className="text-slate-700 hover:text-slate-900 p-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[26px]">menu</span>
          </button>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
              Namaste, Asha! 👋
            </h1>
            <p className="text-[11px] font-semibold text-slate-500">
              ASHA Worker • Dhamangaon PHC
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <button
            type="button"
            onClick={() => showToast('You have 3 active health alerts')}
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

      {/* Main Container */}
      <div className="p-4 space-y-4">
        {/* Your Impact Today Hero Banner Card */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-3xl p-5 shadow-xl relative overflow-hidden">
          {/* Hero Illustration Background Graphic */}
          <div className="absolute right-0 bottom-0 top-0 w-2/5 overflow-hidden rounded-r-3xl opacity-90 pointer-events-none">
            <img
              src="/asha_hero.jpg"
              alt="ASHA Worker Illustration"
              className="w-full h-full object-cover object-left"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/90 via-emerald-600/40 to-transparent" />
          </div>

          <div className="relative z-10 max-w-[65%] space-y-3">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Your Impact Today</h2>
              <p className="text-xs text-emerald-100 font-medium">You are making a difference!</p>
            </div>

            {/* Impact Metrics Row */}
            <div className="flex items-center gap-3 pt-1">
              <div className="bg-white/15 backdrop-blur-md p-2.5 rounded-2xl text-center border border-white/20 flex-1">
                <div className="text-lg font-black text-white">42</div>
                <div className="text-[9px] font-bold text-emerald-100 uppercase tracking-wider leading-tight mt-0.5">
                  Families Visited
                </div>
              </div>

              <div className="bg-white/15 backdrop-blur-md p-2.5 rounded-2xl text-center border border-white/20 flex-1">
                <div className="text-lg font-black text-white">18</div>
                <div className="text-[9px] font-bold text-emerald-100 uppercase tracking-wider leading-tight mt-0.5">
                  Patients Assisted
                </div>
              </div>

              <div className="bg-white/15 backdrop-blur-md p-2.5 rounded-2xl text-center border border-white/20 flex-1">
                <div className="text-lg font-black text-white">5</div>
                <div className="text-[9px] font-bold text-emerald-100 uppercase tracking-wider leading-tight mt-0.5">
                  Follow-ups Done
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Health Alert Banner */}
        <div className="bg-emerald-50/90 border border-emerald-200/90 p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[20px]">campaign</span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                Health Alert
              </span>
              <p className="text-xs font-bold text-slate-800 leading-snug">
                डेंग्यू प्रतिबंधासाठी पाणी साचणार नाही याची काळजी घ्या.
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-emerald-600 text-[20px]">chevron_right</span>
        </div>

        {/* Quick Actions Grid (8 Cards) */}
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 mb-2.5">Quick Actions</h3>
          <div className="grid grid-cols-4 gap-2.5">
            {/* Action 1 */}
            <button
              onClick={() => showToast('New House Visit Opened')}
              className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
            >
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[24px]">home</span>
              </div>
              <span className="text-[11px] font-bold text-slate-700 leading-tight">
                New House Visit
              </span>
            </button>

            {/* Action 2 */}
            <button
              onClick={() => showToast('Add Patient Form Opened')}
              className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
            >
              <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[24px]">person_add</span>
              </div>
              <span className="text-[11px] font-bold text-slate-700 leading-tight">
                Add Patient
              </span>
            </button>

            {/* Action 3 */}
            <button
              onClick={() => showToast('Teleconsult Request Initiated')}
              className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
            >
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[24px]">videocam</span>
              </div>
              <span className="text-[11px] font-bold text-slate-700 leading-tight">
                Teleconsult Request
              </span>
            </button>

            {/* Action 4 */}
            <button
              onClick={() => showToast('Health Triage System Opened')}
              className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
            >
              <div className="w-11 h-11 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[24px]">stethoscope</span>
              </div>
              <span className="text-[11px] font-bold text-slate-700 leading-tight">
                Health Triage
              </span>
            </button>

            {/* Action 5 */}
            <button
              onClick={() => showToast('Follow-up Patients List Opened')}
              className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
            >
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[24px]">sync</span>
              </div>
              <span className="text-[11px] font-bold text-slate-700 leading-tight">
                Follow-up Patients
              </span>
            </button>

            {/* Action 6 */}
            <button
              onClick={() => showToast('Referral Tracking Active')}
              className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
            >
              <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[24px]">signpost</span>
              </div>
              <span className="text-[11px] font-bold text-slate-700 leading-tight">
                Referral Tracking
              </span>
            </button>

            {/* Action 7 */}
            <button
              onClick={() => showToast('Medicine Stock Checklist Opened')}
              className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
            >
              <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[24px]">pill</span>
              </div>
              <span className="text-[11px] font-bold text-slate-700 leading-tight">
                Medicine Availability
              </span>
            </button>

            {/* Action 8 */}
            <button
              onClick={() => showToast('🚨 Emergency Escalation Triggered!')}
              className="bg-white p-3 rounded-2xl border border-rose-200 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
            >
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform animate-pulse">
                <span className="material-symbols-outlined text-[24px]">e911_emergency</span>
              </div>
              <span className="text-[11px] font-bold text-rose-700 leading-tight">
                Emergency Escalation
              </span>
            </button>
          </div>
        </div>

        {/* Today's Schedule */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-sm font-extrabold text-slate-900">Today's Schedule</h3>
            <button
              onClick={() => showToast('Viewing Full Schedule')}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="space-y-3 divide-y divide-slate-100">
            {scheduleList.map((item) => (
              <div key={item.id} className="pt-3 first:pt-0 flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="text-[11px] font-extrabold text-teal-700 bg-teal-50 px-2 py-1 rounded-xl text-center shrink-0 border border-teal-200/60">
                    {item.time}
                  </div>

                  <img
                    src={item.avatar}
                    alt={item.patientName}
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200"
                  />

                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-extrabold text-slate-900">{item.type}</h4>
                      {item.highRisk && (
                        <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                          High Risk
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">
                      {item.patientName} • <span className="font-normal text-slate-500">{item.details}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">{item.village}</p>
                  </div>
                </div>

                <button
                  onClick={() => showToast(`Calling ${item.patientName}...`)}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200 transition-colors cursor-pointer"
                  title="Call Patient"
                >
                  <span className="material-symbols-outlined text-[18px]">call</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Important Updates */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-extrabold text-slate-900">Important Updates</h3>
            <button
              onClick={() => showToast('Viewing All Updates')}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="bg-rose-50/70 border border-rose-200/70 p-3.5 rounded-2xl flex items-center justify-between gap-3 cursor-pointer hover:bg-rose-100/70 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[20px]">event</span>
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-rose-900">Pulse Polio Campaign</h4>
                <p className="text-[11px] font-medium text-rose-700">Next drive on 15 May 2026</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-rose-600 text-[20px]">chevron_right</span>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-between z-40 shadow-2xl">
        <button
          type="button"
          onClick={() => showToast('Home View Active')}
          className="flex flex-col items-center text-teal-600 font-bold text-[10px] gap-0.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[22px]">home</span>
          <span>Home</span>
        </button>

        <button
          type="button"
          onClick={() => showToast('Patients Directory')}
          className="flex flex-col items-center text-slate-500 hover:text-slate-900 font-medium text-[10px] gap-0.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[22px]">group</span>
          <span>Patients</span>
        </button>

        {/* Center Floating Action Button */}
        <button
          type="button"
          onClick={() => showToast('Add Visit / Intake Form')}
          className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg -mt-5 border-4 border-slate-50 transition-transform active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[28px]">add</span>
        </button>

        <button
          type="button"
          onClick={() => showToast('Reports & Analytics')}
          className="flex flex-col items-center text-slate-500 hover:text-slate-900 font-medium text-[10px] gap-0.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[22px]">bar_chart</span>
          <span>Reports</span>
        </button>

        <button
          type="button"
          onClick={() => showToast('Profile & Settings')}
          className="flex flex-col items-center text-slate-500 hover:text-slate-900 font-medium text-[10px] gap-0.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[22px]">person</span>
          <span>Profile</span>
        </button>
      </div>
    </div>
  );
};
