import React, { useState } from 'react';
import { Patient } from '../../types';

interface ReferPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  onConfirmReferral: (details: {
    hospital: string;
    department: string;
    urgency: string;
    ambulanceRequired: boolean;
    reason: string;
  }) => void;
}

export const ReferPatientModal: React.FC<ReferPatientModalProps> = ({
  isOpen,
  onClose,
  patient,
  onConfirmReferral,
}) => {
  const [hospital, setHospital] = useState('District Hospital, Bilaspur (CHC)');
  const [department, setDepartment] = useState('Pulmonology / Critical Care');
  const [urgency, setUrgency] = useState('Immediate Emergency (< 1 hour)');
  const [ambulanceRequired, setAmbulanceRequired] = useState(true);
  const [reason, setReason] = useState(
    `Patient ${patient.name} (${patient.age}${patient.gender}, ID: ${patient.patientId}) presenting with ${patient.primaryConcern}. Requires advanced diagnostic imaging and specialist intervention.`
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      onConfirmReferral({
        hospital,
        department,
        urgency,
        ambulanceRequired,
        reason,
      });
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1500);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 border-t-4 border-rose-600 border-x border-b border-slate-200">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200">
              <span className="material-symbols-outlined text-[24px]">transfer_within_a_station</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Higher Center Referral Order</h2>
              <p className="text-xs text-slate-500">
                Patient: {patient.name} ({patient.age} Y / {patient.gender} • {patient.patientId})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <h3 className="text-base font-bold text-emerald-700">
              Referral Authorized & Broadcasted
            </h3>
            <p className="text-xs text-slate-500">
              Referral slip generated with QR telemetry token. Receiving district hospital notified.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Target Healthcare Facility</label>
              <select
                value={hospital}
                onChange={(e) => setHospital(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none mt-1"
              >
                <option value="District Hospital, Bilaspur (CHC)">District Hospital, Bilaspur (CHC)</option>
                <option value="AIIMS Regional Super Specialty Center">AIIMS Regional Super Specialty Center</option>
                <option value="Civil Hospital Maternity & Child Hub">Civil Hospital Maternity & Child Hub</option>
                <option value="District Tuberculosis & Chest Disease Center">District TB & Chest Disease Center</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Specialty Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none mt-1"
                >
                  <option value="Pulmonology / Critical Care">Pulmonology / Critical Care</option>
                  <option value="Obstetrics & High-Risk Pregnancy">Obstetrics & High-Risk</option>
                  <option value="General Surgery / Trauma">General Surgery / Trauma</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Pediatrics & Neonatology">Pediatrics & Neonatology</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Triage Priority</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-rose-700 font-bold focus:outline-none mt-1"
                >
                  <option value="Immediate Emergency (< 1 hour)">Immediate Emergency (&lt; 1 hr)</option>
                  <option value="Urgent Transfer (< 6 hours)">Urgent Transfer (&lt; 6 hrs)</option>
                  <option value="Elective Higher Evaluation">Elective Evaluation</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Clinical Justification & Summary</label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none resize-none mt-1"
              ></textarea>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 text-[20px]">ambulance</span>
                <span className="text-xs font-semibold text-slate-900">Auto-request 108 Emergency Transport</span>
              </div>
              <input
                type="checkbox"
                checked={ambulanceRequired}
                onChange={(e) => setAmbulanceRequired(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-[16px]">send</span>
                )}
                <span>{isSubmitting ? 'Transmitting...' : 'Issue Referral'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
