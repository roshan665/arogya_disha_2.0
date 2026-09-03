import React, { useState } from 'react';
import { Patient, PriorityLevel } from '../../types';

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPatient: (patient: Patient) => void;
}

export const AddPatientModal: React.FC<AddPatientModalProps> = ({
  isOpen,
  onClose,
  onAddPatient,
}) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | 'Other'>('M');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [phone, setPhone] = useState('+91 ');
  const [village, setVillage] = useState('Rampur Sub-Center');
  const [primaryConcern, setPrimaryConcern] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('normal');
  const [bp, setBp] = useState('120/80');
  const [pulse, setPulse] = useState('76 bpm');
  const [temp, setTemp] = useState('98.6 °F');
  const [spo2, setSpo2] = useState('99%');
  const [weight, setWeight] = useState('60 kg');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !age) return;

    const initials = name
      .trim()
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const randomId = Math.floor(1000 + Math.random() * 9000) + '-A';
    const randomToken = Math.floor(48 + Math.random() * 20);

    const newPatient: Patient = {
      id: 'p-' + Date.now(),
      patientId: randomId,
      name: name.trim(),
      initials: initials || 'PT',
      age: parseInt(age, 10) || 30,
      gender,
      bloodGroup,
      primaryConcern: primaryConcern.trim() || 'General health consultation',
      concernIcon: priority === 'critical' ? 'monitor_heart' : 'medical_services',
      tokenNumber: randomToken,
      waitTime: 'Waiting',
      priority,
      status: 'waiting',
      phone: phone.trim(),
      village,
      vitals: {
        bp,
        pulse,
        temp,
        spo2,
        weight,
      },
      medicalHistory: [
        {
          id: 'h-' + Date.now(),
          date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          title: 'Initial Intake Registration',
          note: `Patient registered at PHC ${village}. Chief complaint: ${primaryConcern || 'Routine Checkup'}`,
          critical: priority === 'critical',
        },
      ],
      currentMedications: [],
      clinicalNotes: '',
    };

    onAddPatient(newPatient);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">person_add</span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">New Patient Registration</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Chandra"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Age (Years) *</label>
              <input
                type="number"
                required
                min="0"
                max="120"
                placeholder="45"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none mt-1"
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Blood Group</label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none mt-1"
              >
                <option value="O+">O+</option>
                <option value="A+">A+</option>
                <option value="B+">B+</option>
                <option value="AB+">AB+</option>
                <option value="O-">O-</option>
                <option value="A-">A-</option>
                <option value="B-">B-</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Triage Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-900 focus:outline-none mt-1"
              >
                <option value="normal">Routine / Normal</option>
                <option value="high">High Priority</option>
                <option value="critical">Critical / Emergency</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Phone / ABHA ID</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Village / Sector</label>
              <input
                type="text"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Primary Concern / Chief Symptoms</label>
            <input
              type="text"
              placeholder="e.g. High fever, persistent cough, joint swelling"
              value={primaryConcern}
              onChange={(e) => setPrimaryConcern(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white mt-1"
            />
          </div>

          {/* Initial Vitals Strip */}
          <div className="pt-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Field Vitals Intake
            </label>
            <div className="grid grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="BP (120/80)"
                value={bp}
                onChange={(e) => setBp(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Pulse"
                value={pulse}
                onChange={(e) => setPulse(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none"
              />
              <input
                type="text"
                placeholder="SpO2"
                value={spo2}
                onChange={(e) => setSpo2(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Temp"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-all active:scale-95"
            >
              Save & Add to OPD Queue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
