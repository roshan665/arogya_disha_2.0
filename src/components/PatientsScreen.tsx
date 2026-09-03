import React, { useState } from 'react';
import { Patient } from '../types';

interface PatientsScreenProps {
  patients: Patient[];
  onSelectPatientForConsult: (patient: Patient) => void;
  onOpenAddPatient: () => void;
  onOpenReferral: (patient: Patient) => void;
}

export const PatientsScreen: React.FC<PatientsScreenProps> = ({
  patients,
  onSelectPatientForConsult,
  onOpenAddPatient,
  onOpenReferral,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [selectedVillage, setSelectedVillage] = useState<string>('all');

  const villages = Array.from(new Set(patients.map((p) => p.village)));

  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.primaryConcern.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.includes(searchQuery);

    const matchesPriority =
      filterPriority === 'all'
        ? true
        : filterPriority === 'critical'
        ? p.priority === 'critical' || p.priority === 'high'
        : p.priority === filterPriority;

    const matchesVillage = selectedVillage === 'all' || p.village === selectedVillage;

    return matchesSearch && matchesPriority && matchesVillage;
  });

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-2 md:py-6 gap-6">
      {/* Header with Search and Registration CTA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
            <span className="material-symbols-outlined text-indigo-600">groups</span>
            <span>Patient Registry & Health Records</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Total {patients.length} registered patients across {villages.length} rural catchment sectors
          </p>
        </div>

        <button
          onClick={onOpenAddPatient}
          id="register-new-patient-cta"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-xs md:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          <span>Register New Patient</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[20px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ABHA ID, phone, or clinical symptoms..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-xs md:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
          >
            <option value="all">All Triage Levels</option>
            <option value="critical">High & Critical</option>
            <option value="normal">Routine / Stable</option>
          </select>

          <select
            value={selectedVillage}
            onChange={(e) => setSelectedVillage(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
          >
            <option value="all">All Sectors</option>
            {villages.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Patient Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPatients.map((patient) => {
          const isHighPriority = patient.priority === 'high' || patient.priority === 'critical';

          return (
            <div
              key={patient.id}
              className={`bg-white rounded-xl p-5 shadow-xs border transition-all hover:border-slate-300 flex flex-col justify-between ${
                isHighPriority
                  ? 'border-rose-200 bg-rose-50/20'
                  : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm border border-slate-200 shadow-xs">
                      {patient.initials}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900 flex items-center gap-1.5">
                        <span>{patient.name}</span>
                        {isHighPriority && (
                          <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" title="High Priority"></span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {patient.age} Y / {patient.gender} • <span className="font-mono text-slate-600 font-medium">ID: {patient.patientId}</span> • Blood {patient.bloodGroup}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${
                      patient.priority === 'critical'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : patient.priority === 'high'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}
                  >
                    {patient.priority}
                  </span>
                </div>

                {/* Primary Concern */}
                <div className="mt-3.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Primary Concern</p>
                  <p className="text-xs font-semibold text-rose-700 flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-[16px]">
                      {patient.concernIcon || 'medical_services'}
                    </span>
                    <span>{patient.primaryConcern}</span>
                  </p>
                </div>

                {/* Vitals Summary */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-700">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[9px] uppercase font-semibold">BP</span>
                    <span className="font-bold text-slate-900">{patient.vitals.bp}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[9px] uppercase font-semibold">Pulse</span>
                    <span className="font-bold text-slate-900">{patient.vitals.pulse}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[9px] uppercase font-semibold">SpO2</span>
                    <span className="font-bold text-emerald-600">{patient.vitals.spo2}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                    <span>{patient.village}</span>
                  </span>
                  <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">Token #{patient.tokenNumber}</span>
                </div>
              </div>

              {/* Card Actions */}
              <div className="mt-4 pt-3 border-t border-slate-200 flex gap-2">
                <button
                  onClick={() => onSelectPatientForConsult(patient)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                >
                  <span className="material-symbols-outlined text-[15px]">medical_services</span>
                  <span>Start Consult</span>
                </button>

                <button
                  onClick={() => onOpenReferral(patient)}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 p-2 rounded-lg text-xs font-semibold flex items-center justify-center cursor-pointer transition-colors shadow-xs"
                  title="Emergency Referral"
                >
                  <span className="material-symbols-outlined text-[18px]">emergency</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

