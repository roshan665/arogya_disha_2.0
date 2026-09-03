import React, { useState } from 'react';

interface HouseVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordVisit: (summary: string) => void;
}

export const HouseVisitModal: React.FC<HouseVisitModalProps> = ({
  isOpen,
  onClose,
  onRecordVisit,
}) => {
  const [household, setHousehold] = useState('Household #24 - Verma Family (Rampur)');
  const [maternalCheck, setMaternalCheck] = useState(true);
  const [childVaccineCheck, setChildVaccineCheck] = useState(true);
  const [elderlyNcdCheck, setElderlyNcdCheck] = useState(false);
  const [waterChlorinationCheck, setWaterChlorinationCheck] = useState(true);
  const [visitNotes, setVisitNotes] = useState('Reviewed pregnancy progress for Smt. Geeta (28 wks). Advised iron tablets.');
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    onRecordVisit(`${household}: ${visitNotes}`);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-slate-200">
        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <span className="material-symbols-outlined text-[20px]">home</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">ASHA / ANM House Visit</h2>
              <p className="text-xs text-slate-500">Domiciliary Community Health Field Assessment</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {isSaved ? (
          <div className="py-8 text-center space-y-2">
            <span className="material-symbols-outlined text-4xl text-emerald-600">
              check_circle
            </span>
            <p className="font-bold text-base text-emerald-700">Visit Logged to Offline Ledger</p>
            <p className="text-xs text-slate-500">Record timestamped and queued for automatic sync.</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Select Household / Target Family</label>
              <select
                value={household}
                onChange={(e) => setHousehold(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none mt-1"
              >
                <option value="Household #24 - Verma Family (Rampur)">Household #24 - Verma Family (Rampur)</option>
                <option value="Household #12 - Sharma Niwas (Kalyanpur)">Household #12 - Sharma Niwas (Kalyanpur)</option>
                <option value="Household #38 - Devi & Sons (Chandrapur)">Household #38 - Devi & Sons (Chandrapur)</option>
                <option value="Household #09 - Yadav Compound (Shantipura)">Household #09 - Yadav Compound (Shantipura)</option>
              </select>
            </div>

            {/* Checklist */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                Field Health Checklist
              </label>

              <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer text-xs text-slate-800 hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={maternalCheck}
                  onChange={(e) => setMaternalCheck(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Maternal Health & Antenatal IFA Compliance</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer text-xs text-slate-800 hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={childVaccineCheck}
                  onChange={(e) => setChildVaccineCheck(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Infant Immunization Tracking (MCP Card updated)</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer text-xs text-slate-800 hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={elderlyNcdCheck}
                  onChange={(e) => setElderlyNcdCheck(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Elderly NCD Screening (Hypertension / Diabetes)</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer text-xs text-slate-800 hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={waterChlorinationCheck}
                  onChange={(e) => setWaterChlorinationCheck(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Water Chlorination & Vector Breeding Check</span>
              </label>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Observations & Field Notes</label>
              <textarea
                rows={3}
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none resize-none mt-1"
              ></textarea>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                Complete & Log Visit
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
