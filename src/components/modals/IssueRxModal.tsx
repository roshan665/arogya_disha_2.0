import React, { useState } from 'react';
import { Patient, Medication } from '../../types';

interface IssueRxModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  notes: string;
  medications: Medication[];
}

export const IssueRxModal: React.FC<IssueRxModalProps> = ({
  isOpen,
  onClose,
  patient,
  notes,
  medications,
}) => {
  const [copied, setCopied] = useState(false);
  const [printed, setPrinted] = useState(false);

  if (!isOpen) return null;

  const handleShare = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    setPrinted(true);
    setTimeout(() => setPrinted(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">verified</span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Digital Prescription Issued</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Printable Medical Receipt Sheet */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 font-mono text-xs">
          {/* Header */}
          <div className="text-center pb-3 border-b border-dashed border-slate-300">
            <h3 className="font-bold text-sm text-indigo-700 tracking-tight">PRIMARY HEALTH CARE DISPENSARY</h3>
            <p className="text-[10px] text-slate-500">Ministry of Health & Family Welfare • Rampur Sector</p>
            <p className="text-[10px] text-slate-500">Dr. Priya Nair, MBBS, DCH • Reg. No: MCI-2018-9941</p>
          </div>

          {/* Patient Details */}
          <div className="grid grid-cols-2 gap-2 text-[11px] pb-3 border-b border-dashed border-slate-300 text-slate-800">
            <div>
              <p><strong>Patient:</strong> {patient.name}</p>
              <p><strong>Age/Gender:</strong> {patient.age} Y / {patient.gender}</p>
              <p><strong>ID:</strong> {patient.patientId}</p>
            </div>
            <div className="text-right">
              <p><strong>Date:</strong> {new Date().toLocaleDateString('en-GB')}</p>
              <p><strong>Token:</strong> #{patient.tokenNumber}</p>
              <p><strong>Village:</strong> {patient.village}</p>
            </div>
          </div>

          {/* Diagnosis & Findings */}
          <div>
            <p className="font-bold text-indigo-700">CLINICAL FINDINGS & DIAGNOSIS:</p>
            <p className="text-slate-700 mt-0.5 font-sans text-xs">
              {notes || patient.primaryConcern || 'Routine clinical examination and medication renewal.'}
            </p>
          </div>

          {/* Rx Medications */}
          <div>
            <p className="font-bold text-indigo-700 text-sm">℞ MEDICATIONS (EDL):</p>
            <div className="mt-1 space-y-2 font-sans">
              {medications.length === 0 ? (
                <p className="text-slate-500 italic">No medications prescribed.</p>
              ) : (
                medications.map((m, idx) => (
                  <div key={m.id || idx} className="pl-3 border-l-2 border-indigo-600">
                    <p className="font-bold text-slate-900 text-xs">{idx + 1}. {m.name}</p>
                    <p className="text-slate-500 text-[11px]">Dosage: {m.frequency} — {m.instructions}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer Signature */}
          <div className="pt-4 flex justify-between items-end border-t border-dashed border-slate-300 text-[10px]">
            <div>
              <p className="font-medium text-slate-700">Verified with ABHA QR</p>
              <p className="text-slate-500">ArogyaDisha Telemetry</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-indigo-700">Dr. Priya Nair</p>
              <p className="text-slate-500">Medical Officer In-Charge</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleShare}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors border border-slate-200"
          >
            <span className="material-symbols-outlined text-[16px]">share</span>
            <span>{copied ? 'Copied Link!' : 'Share SMS / WhatsApp'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            <span>{printed ? 'Sent to Printer' : 'Print / Export PDF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
