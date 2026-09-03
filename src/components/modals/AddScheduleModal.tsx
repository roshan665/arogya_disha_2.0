import React, { useState } from 'react';
import { ScheduleItem } from '../../types';

interface AddScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSchedule: (item: ScheduleItem) => void;
}

export const AddScheduleModal: React.FC<AddScheduleModalProps> = ({
  isOpen,
  onClose,
  onAddSchedule,
}) => {
  const [patientName, setPatientName] = useState('');
  const [time, setTime] = useState('04:30');
  const [period, setPeriod] = useState<'AM' | 'PM'>('PM');
  const [category, setCategory] = useState('Antenatal Care Follow-up');
  const [village, setVillage] = useState('Rampur Sub-Center');
  const [icon, setIcon] = useState('pregnant_woman');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) return;

    const newItem: ScheduleItem = {
      id: 's-' + Date.now(),
      time,
      period,
      patientName: patientName.trim(),
      category,
      icon,
      completed: false,
      colorType: 'primary',
      village,
    };

    onAddSchedule(newItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">calendar_add_on</span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Schedule New Visit</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Patient Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Smt. Meera Bai"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Time (HH:MM)</label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">AM / PM</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none mt-1"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Visit Purpose / Category</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (e.target.value.includes('Prenatal') || e.target.value.includes('Antenatal')) setIcon('pregnant_woman');
                else if (e.target.value.includes('TB') || e.target.value.includes('Cough')) setIcon('pulmonology');
                else if (e.target.value.includes('Immunization')) setIcon('vaccines');
                else setIcon('vital_signs');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none mt-1"
            >
              <option value="Prenatal checkup">Prenatal checkup</option>
              <option value="TB Follow-up">TB Follow-up</option>
              <option value="Immunization">Immunization</option>
              <option value="Hypertension & Sugar Screening">Hypertension & Sugar Screening</option>
              <option value="Postnatal Home Visit">Postnatal Home Visit</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Village Sector</label>
            <input
              type="text"
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none mt-1"
            />
          </div>

          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg text-xs font-semibold border border-slate-200 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            >
              Add to Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
