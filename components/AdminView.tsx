import React, { useState, useEffect } from 'react';

export const AdminView: React.FC = () => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<string>('Overview');

  // Filters State
  const [facilityType, setFacilityType] = useState<string>('All Facility Types');
  const [district, setDistrict] = useState<string>('All Districts');
  const [block, setBlock] = useState<string>('All Blocks');
  const [dateRange, setDateRange] = useState<string>('01 May 2025 - 31 May 2025');
  const [locationFilter, setLocationFilter] = useState<string>('All Locations');

  // Emergency Alert Counter state
  const [emergencyCases, setEmergencyCases] = useState<number>(642);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Real-time Event Listener for Patient Emergency Calls
  useEffect(() => {
    const handleEmergency = (e: any) => {
      const detail = e.detail;
      setEmergencyCases((prev) => prev + 1);
      showToast(`🚨 REALTIME ANALYTICS ALERT: New Emergency Referral logged from ${detail?.patient_name || 'Patient'}!`);
    };

    window.addEventListener('arogya-patient-emergency', handleEmergency);
    window.addEventListener('arogya-mock-red-alert', handleEmergency);
    return () => {
      window.removeEventListener('arogya-patient-emergency', handleEmergency);
      window.removeEventListener('arogya-mock-red-alert', handleEmergency);
    };
  }, []);

  const handleExportReport = () => {
    showToast('📥 Exporting Health Analytics PDF Report...');
  };

  const handleApplyFilters = () => {
    showToast(`✅ Analytics updated for ${facilityType}, ${district}, ${block}`);
  };

  return (
    <div className="w-full min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased flex">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[100] bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-fadeIn">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-white border-r border-slate-200 p-5 flex flex-col justify-between shrink-0 hidden lg:flex min-h-screen">
        <div className="space-y-6">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-[22px]">shield</span>
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 leading-tight">Health System</h2>
            </div>
          </div>

          {/* Navigation Items List */}
          <nav className="space-y-1 text-xs font-bold text-slate-600">
            {[
              { name: 'Overview', icon: 'grid_view' },
              { name: 'Facilities', icon: 'domain' },
              { name: 'Patients', icon: 'group' },
              { name: 'Services', icon: 'medical_services' },
              { name: 'Health Indicators', icon: 'show_chart' },
              { name: 'Maps', icon: 'map' },
              { name: 'Reports', icon: 'description' },
              { name: 'Alerts', icon: 'notifications' },
              { name: 'Analytics', icon: 'analytics', badge: 'New' },
              { name: 'Settings', icon: 'settings' },
            ].map((item) => {
              const isActive = activeNav === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    setActiveNav(item.name);
                    showToast(`Navigated to ${item.name}`);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 font-extrabold shadow-2xs'
                      : 'hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                      {item.icon}
                    </span>
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Quick Filters Box at Bottom of Sidebar */}
        <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-2 text-xs">
          <div className="font-extrabold text-slate-800 text-[11px] mb-1">Quick Filters</div>

          <select
            value={facilityType}
            onChange={(e) => setFacilityType(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl p-2 text-[11px] outline-none cursor-pointer"
          >
            <option value="All Facility Types">All Facility Types</option>
            <option value="PHC">Primary Health Centre (PHC)</option>
            <option value="CHC">Community Health Centre (CHC)</option>
            <option value="District Hospital">District Hospital</option>
          </select>

          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl p-2 text-[11px] outline-none cursor-pointer"
          >
            <option value="All Districts">All Districts</option>
            <option value="Wardha">Wardha</option>
            <option value="Yavatmal">Yavatmal</option>
            <option value="Amravati">Amravati</option>
          </select>

          <select
            value={block}
            onChange={(e) => setBlock(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl p-2 text-[11px] outline-none cursor-pointer"
          >
            <option value="All Blocks">All Blocks</option>
            <option value="Arvi">Arvi</option>
            <option value="Karjat">Karjat</option>
            <option value="Dhamangaon">Dhamangaon</option>
          </select>

          <button
            onClick={handleApplyFilters}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-xs mt-1"
          >
            Apply Filters
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-6 space-y-6 overflow-x-hidden">
        {/* TOP HEADER BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Health Analytics Dashboard</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Unified view of PHC, Health Centers & District Hospital
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            {/* Date Range Selector */}
            <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex items-center gap-2 cursor-pointer text-slate-700">
              <span className="material-symbols-outlined text-[16px] text-slate-400">calendar_today</span>
              <span>{dateRange}</span>
              <span className="material-symbols-outlined text-[16px] text-slate-400">expand_more</span>
            </div>

            {/* Location Selector */}
            <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex items-center gap-2 cursor-pointer text-slate-700">
              <span className="material-symbols-outlined text-[16px] text-slate-400">location_on</span>
              <span>{locationFilter}</span>
              <span className="material-symbols-outlined text-[16px] text-slate-400">expand_more</span>
            </div>

            {/* Export Report Button */}
            <button
              onClick={handleExportReport}
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>Export Report</span>
            </button>
          </div>
        </div>

        {/* 6 TOP KPI METRIC CARDS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Total OPD Visits */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">Total OPD Visits</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">groups</span>
              </div>
            </div>
            <div className="text-xl font-black text-slate-900 leading-none">28,547</div>
            <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
              <span>↑ 12.4%</span>
              <span className="text-slate-400 font-normal">vs Apr 2025</span>
            </div>
          </div>

          {/* Card 2: Total Patients */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">Total Patients</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">person</span>
              </div>
            </div>
            <div className="text-xl font-black text-slate-900 leading-none">17,892</div>
            <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
              <span>↑ 10.8%</span>
              <span className="text-slate-400 font-normal">vs Apr 2025</span>
            </div>
          </div>

          {/* Card 3: Total IPD Admissions */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">Total IPD Admissions</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">hotel</span>
              </div>
            </div>
            <div className="text-xl font-black text-slate-900 leading-none">1,156</div>
            <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
              <span>↑ 8.6%</span>
              <span className="text-slate-400 font-normal">vs Apr 2025</span>
            </div>
          </div>

          {/* Card 4: Deliveries */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">Deliveries</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">child_care</span>
              </div>
            </div>
            <div className="text-xl font-black text-slate-900 leading-none">356</div>
            <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
              <span>↑ 14.2%</span>
              <span className="text-slate-400 font-normal">vs Apr 2025</span>
            </div>
          </div>

          {/* Card 5: Emergency Cases */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">Emergency Cases</span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px] animate-pulse">e911_emergency</span>
              </div>
            </div>
            <div className="text-xl font-black text-slate-900 leading-none">{emergencyCases}</div>
            <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
              <span>↑ 9.3%</span>
              <span className="text-slate-400 font-normal">vs Apr 2025</span>
            </div>
          </div>

          {/* Card 6: Immunization Coverage */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">Immunization</span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">vaccines</span>
              </div>
            </div>
            <div className="text-xl font-black text-slate-900 leading-none">84%</div>
            <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
              <span>↑ 6.5%</span>
              <span className="text-slate-400 font-normal">vs Apr 2025</span>
            </div>
          </div>
        </div>

        {/* MIDDLE SECTION ROW 1: OPD Trend, Service Distribution, Geographic Map */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Chart 1: OPD Trend Line Chart (5 cols) */}
          <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900">OPD Trend</h3>
              <button onClick={() => showToast('OPD Trend Details')} className="text-[11px] font-bold text-blue-600 cursor-pointer hover:underline">
                View Details
              </button>
            </div>

            {/* SVG Line Chart */}
            <div className="relative h-44 w-full pt-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 300 120">
                <path
                  d="M0,80 L25,50 L50,65 L75,45 L100,75 L125,70 L150,35 L175,55 L200,45 L225,25 L250,55 L275,20 L300,40"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="150" cy="35" r="4" fill="#2563eb" />
                <circle cx="225" cy="25" r="4" fill="#2563eb" />
                <circle cx="275" cy="20" r="4" fill="#2563eb" />
              </svg>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2">
                <span>01 May</span>
                <span>08 May</span>
                <span>15 May</span>
                <span>22 May</span>
                <span>31 May</span>
              </div>
            </div>
          </div>

          {/* Chart 2: Service Wise Distribution Donut Chart (4 cols) */}
          <div className="lg:col-span-3 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900">Service Wise Distribution</h3>
              <button onClick={() => showToast('Service Distribution')} className="text-[11px] font-bold text-blue-600 cursor-pointer hover:underline">
                View Details
              </button>
            </div>

            <div className="flex items-center gap-4 py-2">
              {/* Donut Chart SVG */}
              <div className="relative w-28 h-28 shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="4"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="4"
                    strokeDasharray="62.5, 100"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#14b8a6"
                    strokeWidth="4"
                    strokeDasharray="15.3, 100"
                    strokeDashoffset="-62.5"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="4"
                    strokeDasharray="10.7, 100"
                    strokeDashoffset="-77.8"
                  />
                </svg>
              </div>

              {/* Legend List */}
              <div className="space-y-1 text-[11px] font-bold text-slate-700">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span>OPD (62.5%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                  <span>IPD (15.3%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Lab Tests (10.7%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Imaging (5.8%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span>Others (5.7%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart 3: Geographic Overview District Map (5 cols) */}
          <div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900">Geographic Overview</h3>
              <div className="flex items-center gap-1 text-slate-400 text-xs">
                <button onClick={() => showToast('Map Zoomed In')} className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-200">
                  +
                </button>
                <button onClick={() => showToast('Map Zoomed Out')} className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-200">
                  -
                </button>
              </div>
            </div>

            {/* District Choropleth Map Graphic */}
            <div className="relative h-44 w-full bg-emerald-50/40 rounded-2xl p-3 border border-emerald-100 overflow-hidden flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 300 150">
                <path d="M20,40 Q60,10 100,50 T180,60 T260,30 L280,100 Q200,140 120,120 Z" fill="#059669" opacity="0.85" />
                <path d="M40,60 Q80,40 120,70 T200,80 L220,120 Q150,130 90,110 Z" fill="#10b981" opacity="0.7" />
                <path d="M80,30 Q120,20 160,50 T220,40 L240,80 Q180,90 120,80 Z" fill="#34d399" opacity="0.6" />
                <path d="M120,50 Q150,40 180,70 T240,60 L250,90 Q200,100 150,90 Z" fill="#a7f3d0" opacity="0.8" />
              </svg>

              {/* Legend overlay */}
              <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md p-2 rounded-xl border border-slate-200 text-[9px] font-bold text-slate-700 space-y-1 shadow-2xs">
                <div className="text-[10px] font-black text-slate-900">OPD Visits</div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-700" />
                  <span>3,000+</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  <span>1,500 - 3,000</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-300" />
                  <span>500 - 1,500</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE SECTION ROW 2: Demographics & Disease Burden */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Chart 4: Patient Demographics (5 cols) */}
          <div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900">Patient Demographics</h3>
              <button onClick={() => showToast('Demographics Breakdown')} className="text-[11px] font-bold text-blue-600 cursor-pointer hover:underline">
                View Details
              </button>
            </div>

            <div className="flex items-center gap-6 py-2">
              {/* Donut Chart SVG */}
              <div className="relative w-32 h-32 shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#2563eb" strokeWidth="5" strokeDasharray="22.1, 100" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#4f46e5" strokeWidth="5" strokeDasharray="34.8, 100" strokeDashoffset="-22.1" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f59e0b" strokeWidth="5" strokeDasharray="31.2, 100" strokeDashoffset="-56.9" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#a855f7" strokeWidth="5" strokeDasharray="11.9, 100" strokeDashoffset="-88.1" />
                </svg>
              </div>

              {/* Demographics Legend */}
              <div className="space-y-2 text-xs font-bold text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-600" />
                  <span>0-18 Years: <strong className="text-slate-900">22.1%</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-indigo-600" />
                  <span>19-35 Years: <strong className="text-slate-900">34.8%</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span>36-60 Years: <strong className="text-slate-900">31.2%</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500" />
                  <span>60+ Years: <strong className="text-slate-900">11.9%</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart 5: Disease Burden Top 5 (7 cols) */}
          <div className="lg:col-span-7 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900">Disease Burden (Top 5)</h3>
              <button onClick={() => showToast('Disease Burden Breakdown')} className="text-[11px] font-bold text-blue-600 cursor-pointer hover:underline">
                View Details
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-bold text-slate-800 mb-1">
                  <span>Hypertension</span>
                  <span className="font-extrabold text-slate-900">2,845</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: '85%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-800 mb-1">
                  <span>Diabetes</span>
                  <span className="font-extrabold text-slate-900">2,312</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: '70%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-800 mb-1">
                  <span>Respiratory Infections</span>
                  <span className="font-extrabold text-slate-900">1,875</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: '55%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-800 mb-1">
                  <span>Fever</span>
                  <span className="font-extrabold text-slate-900">1,654</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: '48%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-800 mb-1">
                  <span>Arthritis</span>
                  <span className="font-extrabold text-slate-900">1,245</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: '38%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE SECTION ROW 3: Facility Performance, Monthly Comparison, Immunization Gauge, Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Table: Facility Performance (4 cols) */}
          <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900">Facility Performance</h3>
              <button onClick={() => showToast('Facility Scores')} className="text-[11px] font-bold text-blue-600 cursor-pointer hover:underline">
                View Details
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] font-semibold">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold">
                    <th className="py-2">Facility Type</th>
                    <th className="py-2">Total OPD</th>
                    <th className="py-2">IPD</th>
                    <th className="py-2">Deliveries</th>
                    <th className="py-2">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="py-2 font-extrabold text-slate-900">PHC</td>
                    <td>12,842</td>
                    <td>432</td>
                    <td>196</td>
                    <td className="text-emerald-600 font-bold">82%</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-extrabold text-slate-900">CHC</td>
                    <td>7,653</td>
                    <td>312</td>
                    <td>98</td>
                    <td className="text-emerald-600 font-bold">78%</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-extrabold text-slate-900">Sub-District</td>
                    <td>4,215</td>
                    <td>248</td>
                    <td>42</td>
                    <td className="text-amber-600 font-bold">74%</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-extrabold text-slate-900">District Hosp</td>
                    <td>3,837</td>
                    <td>164</td>
                    <td>20</td>
                    <td className="text-amber-600 font-bold">71%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Chart 6: Monthly Comparison (3 cols) */}
          <div className="lg:col-span-3 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900">Monthly Comparison</h3>
              <span className="text-[10px] font-bold text-slate-400">OPD Visits</span>
            </div>

            {/* Dual Bar Chart */}
            <div className="h-40 flex items-end justify-between px-2 pt-4">
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-end gap-1">
                  <div className="w-3 bg-blue-300 rounded-t-sm" style={{ height: '70px' }} />
                  <div className="w-3 bg-blue-600 rounded-t-sm" style={{ height: '90px' }} />
                </div>
                <span className="text-[9px] font-bold text-slate-500">PHC</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="flex items-end gap-1">
                  <div className="w-3 bg-blue-300 rounded-t-sm" style={{ height: '50px' }} />
                  <div className="w-3 bg-blue-600 rounded-t-sm" style={{ height: '65px' }} />
                </div>
                <span className="text-[9px] font-bold text-slate-500">CHC</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="flex items-end gap-1">
                  <div className="w-3 bg-blue-300 rounded-t-sm" style={{ height: '35px' }} />
                  <div className="w-3 bg-blue-600 rounded-t-sm" style={{ height: '45px' }} />
                </div>
                <span className="text-[9px] font-bold text-slate-500">Sub-Dist</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="flex items-end gap-1">
                  <div className="w-3 bg-blue-300 rounded-t-sm" style={{ height: '30px' }} />
                  <div className="w-3 bg-blue-600 rounded-t-sm" style={{ height: '40px' }} />
                </div>
                <span className="text-[9px] font-bold text-slate-500">District</span>
              </div>
            </div>
          </div>

          {/* Chart 7: Immunization Coverage Gauge (3 cols) */}
          <div className="lg:col-span-3 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3 text-center">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900">Immunization Coverage</h3>
              <button onClick={() => showToast('Immunization Gauge')} className="text-[11px] font-bold text-blue-600 cursor-pointer hover:underline">
                View Details
              </button>
            </div>

            {/* Semi-Circle SVG Gauge */}
            <div className="relative w-36 h-20 mx-auto pt-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 100 50">
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
                <path d="M 10 50 A 40 40 0 0 1 78 18" fill="none" stroke="#10b981" strokeWidth="12" strokeLinecap="round" />
              </svg>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                <div className="text-xl font-black text-slate-900 leading-none">84%</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">Total Coverage</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold pt-2 border-t border-slate-100">
              <div className="text-left">
                <div className="text-slate-400">Fully Immunized</div>
                <div className="text-sm font-black text-emerald-600">12,658</div>
              </div>
              <div className="text-right">
                <div className="text-slate-400">Due / Partial</div>
                <div className="text-sm font-black text-amber-600">2,432</div>
              </div>
            </div>
          </div>

          {/* Box: Health Alerts Summary (2 cols) */}
          <div className="lg:col-span-2 bg-rose-50/70 p-4 rounded-3xl border border-rose-200 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-rose-200/60 pb-1.5">
                <h3 className="text-xs font-black text-rose-900">Health Alerts</h3>
                <button onClick={() => showToast('Health Alerts Summary')} className="text-[10px] font-bold text-rose-700 cursor-pointer hover:underline">
                  View Details
                </button>
              </div>

              <div className="space-y-1.5 text-xs font-bold">
                <div className="flex justify-between items-center text-rose-900">
                  <span className="text-[11px]">🤰 High Risk Pregnancies</span>
                  <span className="font-black text-rose-700">12</span>
                </div>
                <div className="flex justify-between items-center text-rose-900">
                  <span className="text-[11px]">🚨 Outbreak Alerts</span>
                  <span className="font-black text-rose-700">5</span>
                </div>
                <div className="flex justify-between items-center text-amber-900">
                  <span className="text-[11px]">💊 Stock-out Alerts</span>
                  <span className="font-black text-amber-700">8</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => showToast('Opening All Health Alerts')}
              className="w-full bg-white hover:bg-rose-100 text-rose-700 font-bold py-2 rounded-xl text-xs border border-rose-200 shadow-2xs transition-colors cursor-pointer"
            >
              View All Alerts
            </button>
          </div>
        </div>

        {/* BOTTOM SECTION ROW 4: Top Referrals, Lab Tests Overview, Trend Sparklines */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Top Referrals (From PHCs) (4 cols) */}
          <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900">Top Referrals (From PHCs)</h3>
              <button onClick={() => showToast('Referrals Details')} className="text-[11px] font-bold text-blue-600 cursor-pointer hover:underline">
                View Details
              </button>
            </div>

            <div className="space-y-2.5 text-xs font-bold">
              <div className="flex items-center justify-between">
                <span>1. District Hospital, Wardha</span>
                <span className="text-emerald-600 font-black">236</span>
              </div>
              <div className="flex items-center justify-between">
                <span>2. Sub-District Hospital, Arvi</span>
                <span className="text-emerald-600 font-black">118</span>
              </div>
              <div className="flex items-center justify-between">
                <span>3. District Hospital, Yavatmal</span>
                <span className="text-emerald-600 font-black">97</span>
              </div>
            </div>
          </div>

          {/* Lab Tests Overview (4 cols) */}
          <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900">Lab Tests Overview</h3>
              <button onClick={() => showToast('Lab Overview')} className="text-[11px] font-bold text-blue-600 cursor-pointer hover:underline">
                View Details
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-slate-50 p-2 rounded-2xl">
                <div className="text-[9px] font-bold text-slate-400 uppercase">Total Tests</div>
                <div className="text-sm font-black text-slate-900">18,564</div>
              </div>
              <div className="bg-emerald-50 p-2 rounded-2xl">
                <div className="text-[9px] font-bold text-emerald-700 uppercase">Normal</div>
                <div className="text-sm font-black text-emerald-700">11,345</div>
              </div>
              <div className="bg-amber-50 p-2 rounded-2xl">
                <div className="text-[9px] font-bold text-amber-700 uppercase">Abnormal</div>
                <div className="text-sm font-black text-amber-700">6,219</div>
              </div>
              <div className="bg-rose-50 p-2 rounded-2xl">
                <div className="text-[9px] font-bold text-rose-700 uppercase">Critical</div>
                <div className="text-sm font-black text-rose-700">1,000</div>
              </div>
            </div>
          </div>

          {/* Trend of Key Indicators Sparklines (4 cols) */}
          <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900">Trend of Key Indicators</h3>
              <button onClick={() => showToast('Sparklines Details')} className="text-[11px] font-bold text-blue-600 cursor-pointer hover:underline">
                View Details
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold">
              <div className="space-y-1">
                <div className="text-slate-500">OPD Visits</div>
                <div className="text-emerald-600">↑ 12.4%</div>
              </div>
              <div className="space-y-1">
                <div className="text-slate-500">IPD Admits</div>
                <div className="text-purple-600">↑ 8.6%</div>
              </div>
              <div className="space-y-1">
                <div className="text-slate-500">Deliveries</div>
                <div className="text-amber-600">↑ 14.2%</div>
              </div>
              <div className="space-y-1">
                <div className="text-slate-500">Immunize</div>
                <div className="text-teal-600">↑ 6.5%</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
