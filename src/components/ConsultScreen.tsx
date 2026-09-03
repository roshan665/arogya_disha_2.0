import React, { useState } from 'react';
import { Patient, TimelineEntry, Medication } from '../types';
import { COMMON_MEDICATIONS } from '../data/mockData';

interface ConsultScreenProps {
  activePatient: Patient;
  patientsQueue: Patient[];
  onSelectPatient: (patient: Patient) => void;
  onIssueRx: (patient: Patient, notes: string, meds: Medication[]) => void;
  onSaveDraft: (patient: Patient, notes: string, meds: Medication[]) => void;
  onOpenReferral: (patient: Patient) => void;
  onViewAllPatients: () => void;
}

export const ConsultScreen: React.FC<ConsultScreenProps> = ({
  activePatient,
  patientsQueue,
  onSelectPatient,
  onIssueRx,
  onSaveDraft,
  onOpenReferral,
  onViewAllPatients,
}) => {
  const [clinicalNotes, setClinicalNotes] = useState(activePatient.clinicalNotes || '');
  const [medications, setMedications] = useState<Medication[]>(activePatient.currentMedications || []);
  const [newMedName, setNewMedName] = useState('');
  const [showFormulary, setShowFormulary] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'critical' | 'recent'>('all');
  const [showAddHistoryModal, setShowAddHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState<TimelineEntry[]>(activePatient.medicalHistory || []);
  const [newHistoryDate, setNewHistoryDate] = useState('');
  const [newHistoryTitle, setNewHistoryTitle] = useState('');
  const [newHistoryNote, setNewHistoryNote] = useState('');
  const [newHistoryMed, setNewHistoryMed] = useState('');
  const [newHistoryCritical, setNewHistoryCritical] = useState(false);
  const [activeTimelineIndex, setActiveTimelineIndex] = useState<number | null>(null);

  // Sync state when active patient changes
  React.useEffect(() => {
    setClinicalNotes(activePatient.clinicalNotes || '');
    setMedications(activePatient.currentMedications || []);
    setHistoryList(activePatient.medicalHistory || []);
  }, [activePatient.id]);

  const handleAddMedication = (med: { name: string; dosage: string; frequency: string; instructions: string }) => {
    const newItem: Medication = {
      id: 'm-' + Date.now(),
      name: med.name,
      dosage: med.dosage,
      frequency: med.frequency,
      instructions: med.instructions,
    };
    setMedications([...medications, newItem]);
    setNewMedName('');
    setShowFormulary(false);
  };

  const handleAddCustomMed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim()) return;
    const newItem: Medication = {
      id: 'm-' + Date.now(),
      name: newMedName.trim(),
      dosage: 'Standard dose',
      frequency: '1 tab daily',
      instructions: 'As advised by doctor',
    };
    setMedications([...medications, newItem]);
    setNewMedName('');
    setShowFormulary(false);
  };

  const handleRemoveMedication = (id: string) => {
    setMedications(medications.filter((m) => m.id !== id));
  };

  const handleAddHistorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHistoryTitle.trim()) return;
    const newEntry: TimelineEntry = {
      id: 'h-' + Date.now(),
      date: newHistoryDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      title: newHistoryTitle.trim(),
      note: newHistoryNote.trim() || 'Recorded during clinical consultation.',
      medication: newHistoryMed.trim() || undefined,
      critical: newHistoryCritical,
    };
    setHistoryList([newEntry, ...historyList]);
    setShowAddHistoryModal(false);
    setNewHistoryTitle('');
    setNewHistoryNote('');
    setNewHistoryMed('');
    setNewHistoryCritical(false);
  };

  const filteredHistory = historyList.filter((item) => {
    if (selectedFilter === 'critical') return item.critical;
    if (selectedFilter === 'recent') return true;
    return true;
  });

  return (
    <div className="flex flex-col w-full h-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-2 md:py-6 gap-6 relative">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {/* Main Content Area (8 on lg, 9 on xl) */}
        <div className="col-span-1 lg:col-span-8 xl:col-span-9 flex flex-col gap-5">
          {/* Patient Header */}
          <section
            id="patient-consult-header"
            className="bg-white rounded-xl p-5 md:p-6 shadow-xs border border-slate-200 relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
          >
            <div className="flex items-center gap-4 z-10">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 shadow-xs">
                <span className="font-bold text-lg md:text-xl text-slate-800">
                  {activePatient.initials}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                    {activePatient.name}
                  </h1>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Active Patient
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                    {activePatient.age} Y / {activePatient.gender}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    ABHA ID: <strong className="text-slate-700 font-mono">{activePatient.patientId}</strong>
                  </span>
                  <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">bloodtype</span>
                    <span>Blood {activePatient.bloodGroup}</span>
                  </span>
                  <span className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md hidden md:inline-block">
                    {activePatient.village}
                  </span>
                </div>
              </div>
            </div>

            {/* Primary Concern Badge */}
            <div className="flex flex-col sm:items-end w-full sm:w-auto mt-1 sm:mt-0 z-10 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-lg border sm:border-0 border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Primary Clinical Concern
              </span>
              <span className="text-sm md:text-base text-rose-700 font-bold flex items-center gap-1.5 mt-0.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md">
                <span className="material-symbols-outlined text-[18px]">
                  {activePatient.concernIcon || 'pulmonology'}
                </span>
                <span>{activePatient.primaryConcern}</span>
              </span>
            </div>
          </section>

          {/* Vitals Quick Summary Strip */}
          <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-center text-xs">
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
              <p className="text-slate-500 text-[10px] uppercase font-semibold">Blood Pressure</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">{activePatient.vitals.bp}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
              <p className="text-slate-500 text-[10px] uppercase font-semibold">Pulse Rate</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">{activePatient.vitals.pulse} <span className="text-xs font-normal text-slate-500">bpm</span></p>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
              <p className="text-slate-500 text-[10px] uppercase font-semibold">Temperature</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">{activePatient.vitals.temp}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
              <p className="text-slate-500 text-[10px] uppercase font-semibold">SpO2 Oxygen</p>
              <p className="text-base font-bold text-emerald-600 mt-0.5">{activePatient.vitals.spo2}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
              <p className="text-slate-500 text-[10px] uppercase font-semibold">Weight</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">{activePatient.vitals.weight}</p>
            </div>
            {activePatient.vitals.hba1c ? (
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                <p className="text-slate-500 text-[10px] uppercase font-semibold">HbA1c</p>
                <p className="text-base font-bold text-amber-600 mt-0.5">{activePatient.vitals.hba1c}</p>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                <p className="text-slate-500 text-[10px] uppercase font-semibold">Status</p>
                <p className="text-base font-bold text-indigo-600 mt-0.5 capitalize">{activePatient.status}</p>
              </div>
            )}
          </div>

          {/* Split Layout: History & Prescription */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 h-full">
            {/* Medical History Timeline */}
            <section
              id="medical-history-panel"
              className="bg-white rounded-xl p-5 md:p-6 shadow-xs border border-slate-200 flex flex-col h-full min-h-[420px]"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600">history</span>
                  <span>Clinical History</span>
                </h2>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowAddHistoryModal(true)}
                    id="add-history-btn"
                    className="text-indigo-600 hover:bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Add History Note"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    <span>Add Note</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedFilter(
                        selectedFilter === 'all'
                          ? 'critical'
                          : selectedFilter === 'critical'
                          ? 'recent'
                          : 'all'
                      );
                    }}
                    aria-label="Filter history"
                    className="text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                    title={`Filter: ${selectedFilter}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">filter_list</span>
                  </button>
                </div>
              </div>

              {selectedFilter !== 'all' && (
                <div className="mb-3 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-700 flex justify-between items-center">
                  <span>Filtered by: <strong>{selectedFilter}</strong></span>
                  <button onClick={() => setSelectedFilter('all')} className="underline font-semibold cursor-pointer">Clear</button>
                </div>
              )}

              {/* Timeline Items */}
              <div className="relative pl-4 flex-1 overflow-y-auto pr-2 space-y-4" id="history-timeline">
                {/* Vertical Line */}
                <div className="absolute left-4 top-2 bottom-0 w-px bg-slate-200 -translate-x-1/2"></div>

                {filteredHistory.map((item, index) => {
                  const isCritical = item.critical;
                  const isSelected = activeTimelineIndex === index;

                  return (
                    <div
                      key={item.id || index}
                      onClick={() => setActiveTimelineIndex(isSelected ? null : index)}
                      className="relative pl-6 cursor-pointer group"
                    >
                      {/* Timeline Dot Indicator */}
                      <div
                        className={`absolute left-0 top-1.5 w-3 h-3 rounded-full ring-4 ring-white -translate-x-[6px] transition-all ${
                          isCritical
                            ? 'bg-rose-600 ring-rose-100 animate-pulse'
                            : index === 0
                            ? 'bg-indigo-600'
                            : 'bg-slate-400'
                        }`}
                      ></div>

                      <div
                        className={`text-xs font-semibold mb-1 ${
                          isCritical ? 'text-rose-700' : 'text-slate-500'
                        }`}
                      >
                        {item.date}
                      </div>

                      <div
                        className={`p-3.5 rounded-xl border transition-all ${
                          isCritical
                            ? 'bg-rose-50/50 border-rose-200 hover:border-rose-400'
                            : index === 0
                            ? 'bg-indigo-50/30 border-indigo-200 hover:border-indigo-400'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        } ${isSelected ? 'ring-2 ring-indigo-600' : ''}`}
                      >
                        <p className="text-sm font-bold text-slate-900 leading-snug">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {item.note}
                        </p>

                        {item.medication && (
                          <div className="flex gap-2 mt-2">
                            <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px] text-slate-500">prescriptions</span>
                              <span>{item.medication}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Prescription Composer */}
            <section
              id="prescription-panel"
              className="bg-white rounded-xl p-5 md:p-6 shadow-xs border border-slate-200 flex flex-col h-full"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600">edit_note</span>
                  <span>Prescription Order</span>
                </h2>
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">
                  Rx Draft
                </span>
              </div>

              <div className="flex flex-col gap-4 flex-1">
                {/* Clinical Notes Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Clinical Notes & Findings
                  </label>
                  <textarea
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    id="clinical-notes-textarea"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs md:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white resize-none h-24 transition-all"
                    placeholder="Enter clinical findings, symptoms, diagnosis, treatment advice..."
                  ></textarea>
                </div>

                {/* Medications List */}
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Prescribed Medications ({medications.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowFormulary(!showFormulary)}
                      id="add-med-btn"
                      className="text-indigo-600 text-xs font-semibold flex items-center gap-1 hover:bg-indigo-50 px-2 py-1 rounded transition-colors cursor-pointer border border-indigo-200"
                    >
                      <span className="material-symbols-outlined text-[15px]">add</span>
                      <span>EDL Formulary</span>
                    </button>
                  </div>

                  {/* Formulary Suggestions Drawer */}
                  {showFormulary && (
                    <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-200 space-y-2 animate-fadeIn text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-indigo-900">Essential Drug List (EDL)</span>
                        <button onClick={() => setShowFormulary(false)} className="text-slate-400 hover:text-slate-700">
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                        {COMMON_MEDICATIONS.map((med, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleAddMedication(med)}
                            className="text-left p-2 bg-white hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          >
                            <div className="font-semibold text-slate-900">{med.name}</div>
                            <div className="text-[10px] text-slate-500">{med.frequency}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active Medication List */}
                  <div className="flex flex-col gap-2 overflow-y-auto max-h-44">
                    {medications.length === 0 ? (
                      <div className="text-center py-4 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg">
                        No medications added. Select from EDL formulary or type below.
                      </div>
                    ) : (
                      medications.map((med) => (
                        <div
                          key={med.id}
                          className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200 transition-all hover:border-slate-300"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs md:text-sm font-bold text-slate-900">
                              {med.name}
                            </span>
                            <span className="text-[11px] text-slate-600">
                              {med.frequency} {med.instructions ? `• ${med.instructions}` : ''}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveMedication(med.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-white transition-colors cursor-pointer"
                            title="Remove medication"
                          >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        </div>
                      ))
                    )}

                    {/* Inline Custom Add Med Input */}
                    <form onSubmit={handleAddCustomMed} className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        value={newMedName}
                        onChange={(e) => setNewMedName(e.target.value)}
                        placeholder="Type custom medication..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs md:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white"
                      />
                      <button
                        type="submit"
                        disabled={!newMedName.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Add
                      </button>
                    </form>
                  </div>
                </div>

                {/* Bottom Rx Action Buttons */}
                <div className="mt-auto pt-3 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => onSaveDraft(activePatient, clinicalNotes, medications)}
                    id="save-draft-btn"
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-colors cursor-pointer active:scale-98"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => onIssueRx(activePatient, clinicalNotes, medications)}
                    id="issue-rx-btn"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                  >
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    <span>Issue Rx</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* OPD Sidebar & Referral Action (4 on lg, 3 on xl) */}
        <div className="col-span-1 lg:col-span-4 xl:col-span-3 flex flex-col gap-5">
          {/* Emergency Referral Button */}
          <button
            onClick={() => onOpenReferral(activePatient)}
            id="refer-patient-emergency-btn"
            className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl p-4 shadow-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 overflow-hidden relative group cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:animate-shimmer"></div>
            <span className="material-symbols-outlined text-[22px] animate-pulse">
              emergency
            </span>
            <span className="font-bold text-sm tracking-wide">Emergency Patient Referral</span>
          </button>

          {/* OPD Queue Card */}
          <section
            id="opd-queue-card"
            className="bg-white rounded-xl shadow-xs border border-slate-200 flex flex-col flex-1 overflow-hidden"
          >
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-slate-900">OPD Patient Queue</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {patientsQueue.length} registered today
                </p>
              </div>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                Live
              </span>
            </div>

            {/* Queue Patient List */}
            <div className="flex flex-col overflow-y-auto max-h-[460px] divide-y divide-slate-100">
              {patientsQueue.map((patient) => {
                const isActive = patient.id === activePatient.id;
                const isHighPriority = patient.priority === 'high' || patient.priority === 'critical';

                if (isActive) {
                  return (
                    <div
                      key={patient.id}
                      className="p-3.5 border-l-4 border-indigo-600 bg-indigo-50/50 flex items-start gap-3"
                    >
                      <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {patient.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className="text-xs md:text-sm font-bold text-slate-900 truncate">
                            {patient.name}
                          </p>
                          <span className="text-xs font-bold text-indigo-600 animate-pulse">
                            Now
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          Token #{patient.tokenNumber} • {patient.village}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={patient.id}
                    onClick={() => onSelectPatient(patient)}
                    className="p-3.5 border-l-4 border-transparent hover:bg-slate-50 transition-colors flex items-start gap-3 text-left w-full cursor-pointer group"
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border border-slate-200 ${
                        patient.initials === 'KM'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {patient.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <p className="text-xs md:text-sm font-bold text-slate-900 group-hover:text-indigo-600 truncate">
                          {patient.name}
                        </p>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {patient.waitTime}
                        </span>
                      </div>
                      {isHighPriority ? (
                        <p className="text-[11px] text-rose-700 truncate font-semibold flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping"></span>
                          <span>High Priority</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          Token #{patient.tokenNumber} • {patient.village}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
              <button
                onClick={onViewAllPatients}
                id="view-all-patients-btn"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
              >
                View Full Patient Directory →
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Add History Modal */}
      {showAddHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="font-bold text-base text-slate-900">Add Clinical History Note</h3>
              <button onClick={() => setShowAddHistoryModal(false)} className="text-slate-400 hover:text-slate-700">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddHistorySubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Date / Encounter</label>
                <input
                  type="text"
                  placeholder="e.g. 15 Jan 2024"
                  value={newHistoryDate}
                  onChange={(e) => setNewHistoryDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Diagnosis / Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Type 2 Diabetes Follow-up"
                  value={newHistoryTitle}
                  onChange={(e) => setNewHistoryTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Clinical Note / Lab Result</label>
                <textarea
                  rows={2}
                  placeholder="Details of symptoms, findings, intervention..."
                  value={newHistoryNote}
                  onChange={(e) => setNewHistoryNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                ></textarea>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Medication Given</label>
                <input
                  type="text"
                  placeholder="e.g. Metformin 500mg"
                  value={newHistoryMed}
                  onChange={(e) => setNewHistoryMed(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="critical-history-checkbox"
                  checked={newHistoryCritical}
                  onChange={(e) => setNewHistoryCritical(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="critical-history-checkbox" className="text-xs font-semibold text-rose-700">
                  Mark as Critical / Emergency Event
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddHistoryModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-xs font-semibold"
                >
                  Add Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

