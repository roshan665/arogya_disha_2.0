import React, { useState } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { ConsultScreen } from './components/ConsultScreen';
import { PatientsScreen } from './components/PatientsScreen';
import { AlertsScreen } from './components/AlertsScreen';
import { EmergencyModal } from './components/modals/EmergencyModal';
import { ReferPatientModal } from './components/modals/ReferPatientModal';
import { AddPatientModal } from './components/modals/AddPatientModal';
import { HouseVisitModal } from './components/modals/HouseVisitModal';
import { TeleconsultModal } from './components/modals/TeleconsultModal';
import { IssueRxModal } from './components/modals/IssueRxModal';
import { AddScheduleModal } from './components/modals/AddScheduleModal';
import { HealthWorkerProfileModal } from './components/modals/HealthWorkerProfileModal';
import {
  INITIAL_PATIENTS,
  INITIAL_SCHEDULE,
  INITIAL_ALERTS,
  INITIAL_SYNC_ITEMS,
} from './data/mockData';
import { Patient, TabType, ScheduleItem, AlertNotification, SyncItem, Medication } from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedText, setLastSyncedText] = useState('Last synced: 2m ago');

  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [activePatient, setActivePatient] = useState<Patient>(INITIAL_PATIENTS[0]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(INITIAL_SCHEDULE);
  const [alerts, setAlerts] = useState<AlertNotification[]>(INITIAL_ALERTS);
  const [syncItems, setSyncItems] = useState<SyncItem[]>(INITIAL_SYNC_ITEMS);

  // Modals state
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [referralTargetPatient, setReferralTargetPatient] = useState<Patient>(INITIAL_PATIENTS[0]);
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  const [isHouseVisitModalOpen, setIsHouseVisitModalOpen] = useState(false);
  const [isTeleconsultModalOpen, setIsTeleconsultModalOpen] = useState(false);
  const [isIssueRxModalOpen, setIsIssueRxModalOpen] = useState(false);
  const [issuedRxDetails, setIssuedRxDetails] = useState<{
    patient: Patient;
    notes: string;
    medications: Medication[];
  }>({
    patient: INITIAL_PATIENTS[0],
    notes: '',
    medications: [],
  });
  const [isAddScheduleModalOpen, setIsAddScheduleModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Toast Notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleToggleOffline = () => {
    setIsOffline((prev) => {
      const next = !prev;
      showToast(next ? 'Switched to Offline Mode (Local Storage)' : 'Connected to Online Network');
      return next;
    });
  };

  const handleManualSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setLastSyncedText('Last synced: Just now');
      setSyncItems((prev) =>
        prev.map((item) => ({ ...item, status: 'synced' }))
      );
      showToast('✓ All offline records synced successfully with PHC server');
    }, 1400);
  };

  const handleToggleScheduleItem = (id: string) => {
    setSchedule((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = !item.completed;
          showToast(updated ? `Marked "${item.patientName}" visit as completed` : `Visit marked pending`);
          return { ...item, completed: updated };
        }
        return item;
      })
    );
  };

  const handleQuickAction = (actionId: 'house-visit' | 'add-patient' | 'teleconsult' | 'health-triage') => {
    switch (actionId) {
      case 'house-visit':
        setIsHouseVisitModalOpen(true);
        break;
      case 'add-patient':
        setIsAddPatientModalOpen(true);
        break;
      case 'teleconsult':
        setIsTeleconsultModalOpen(true);
        break;
      case 'health-triage':
        setCurrentTab('alerts');
        break;
    }
  };

  const handleSelectPatientByName = (name: string) => {
    const found = patients.find((p) => p.name.toLowerCase().includes(name.toLowerCase()));
    if (found) {
      setActivePatient(found);
      setCurrentTab('consults');
    }
  };

  const handleSelectPatientForConsult = (patient: Patient) => {
    setActivePatient(patient);
    setCurrentTab('consults');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenReferral = (patient: Patient) => {
    setReferralTargetPatient(patient);
    setIsReferralModalOpen(true);
  };

  const handleSaveDraft = (patient: Patient, notes: string, meds: Medication[]) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patient.id ? { ...p, clinicalNotes: notes, currentMedications: meds } : p
      )
    );
    showToast(`Prescription draft saved for ${patient.name}`);
  };

  const handleIssueRx = (patient: Patient, notes: string, meds: Medication[]) => {
    setIssuedRxDetails({
      patient,
      notes,
      medications: meds,
    });
    setIsIssueRxModalOpen(true);
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patient.id
          ? {
              ...p,
              clinicalNotes: notes,
              currentMedications: meds,
              status: 'completed',
            }
          : p
      )
    );
    showToast(`Digital Prescription Issued for ${patient.name}`);
  };

  const handleAddNewPatient = (newPatient: Patient) => {
    setPatients([newPatient, ...patients]);
    setActivePatient(newPatient);
    showToast(`Registered ${newPatient.name} (Token #${newPatient.tokenNumber})`);
    setCurrentTab('consults');
  };

  const handleAddSchedule = (newItem: ScheduleItem) => {
    setSchedule([...schedule, newItem]);
    showToast(`Added visit for ${newItem.patientName} to schedule`);
  };

  const handleConfirmReferral = (details: { hospital: string; urgency: string }) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === referralTargetPatient.id ? { ...p, status: 'referred' } : p))
    );
    setAlerts([
      {
        id: 'a-' + Date.now(),
        type: 'critical',
        title: `Emergency Referral: ${referralTargetPatient.name}`,
        patientName: referralTargetPatient.name,
        timestamp: 'Just now',
        message: `Referred to ${details.hospital}. Urgency: ${details.urgency}`,
        resolved: false,
        priority: 'critical',
      },
      ...alerts,
    ]);
    showToast(`Referral transmitted to ${details.hospital}`);
  };

  const handleRecordHouseVisit = (summary: string) => {
    setSyncItems([
      {
        id: 'sy-' + Date.now(),
        type: 'House Visit Log',
        description: summary,
        timestamp: 'Just now',
        status: isOffline ? 'pending' : 'synced',
      },
      ...syncItems,
    ]);
    showToast('House visit completed and recorded.');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col relative antialiased">
      {/* Header with sync status & floating online/emergency bar */}
      <Header
        isOffline={isOffline}
        onToggleOffline={handleToggleOffline}
        lastSyncedText={lastSyncedText}
        onSync={handleManualSync}
        isSyncing={isSyncing}
        onOpenEmergency={() => setIsEmergencyModalOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full pt-44 pb-28 bg-slate-50 min-h-screen transition-all">
        {currentTab === 'home' && (
          <HomeScreen
            isOffline={isOffline}
            onSync={handleManualSync}
            isSyncing={isSyncing}
            schedule={schedule}
            onToggleScheduleItem={handleToggleScheduleItem}
            onQuickAction={handleQuickAction}
            onSelectPatientByName={handleSelectPatientByName}
            onOpenAddSchedule={() => setIsAddScheduleModalOpen(true)}
            onOpenCriticalAlerts={() => setCurrentTab('alerts')}
          />
        )}

        {currentTab === 'consults' && (
          <ConsultScreen
            activePatient={activePatient}
            patientsQueue={patients}
            onSelectPatient={(p) => setActivePatient(p)}
            onIssueRx={handleIssueRx}
            onSaveDraft={handleSaveDraft}
            onOpenReferral={handleOpenReferral}
            onViewAllPatients={() => setCurrentTab('patients')}
          />
        )}

        {currentTab === 'patients' && (
          <PatientsScreen
            patients={patients}
            onSelectPatientForConsult={handleSelectPatientForConsult}
            onOpenAddPatient={() => setIsAddPatientModalOpen(true)}
            onOpenReferral={handleOpenReferral}
          />
        )}

        {currentTab === 'alerts' && (
          <AlertsScreen
            alerts={alerts}
            syncItems={syncItems}
            isOffline={isOffline}
            onSync={handleManualSync}
            isSyncing={isSyncing}
            onOpenEmergency={() => setIsEmergencyModalOpen(true)}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        unreadAlertsCount={alerts.filter((a) => !a.resolved).length}
        waitingQueueCount={patients.filter((p) => p.status === 'waiting').length}
      />

      {/* Modals */}
      <EmergencyModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
      />

      <ReferPatientModal
        isOpen={isReferralModalOpen}
        onClose={() => setIsReferralModalOpen(false)}
        patient={referralTargetPatient}
        onConfirmReferral={handleConfirmReferral}
      />

      <AddPatientModal
        isOpen={isAddPatientModalOpen}
        onClose={() => setIsAddPatientModalOpen(false)}
        onAddPatient={handleAddNewPatient}
      />

      <HouseVisitModal
        isOpen={isHouseVisitModalOpen}
        onClose={() => setIsHouseVisitModalOpen(false)}
        onRecordVisit={handleRecordHouseVisit}
      />

      <TeleconsultModal
        isOpen={isTeleconsultModalOpen}
        onClose={() => setIsTeleconsultModalOpen(false)}
        patient={activePatient}
      />

      <IssueRxModal
        isOpen={isIssueRxModalOpen}
        onClose={() => setIsIssueRxModalOpen(false)}
        patient={issuedRxDetails.patient}
        notes={issuedRxDetails.notes}
        medications={issuedRxDetails.medications}
      />

      <AddScheduleModal
        isOpen={isAddScheduleModalOpen}
        onClose={() => setIsAddScheduleModalOpen(false)}
        onAddSchedule={handleAddSchedule}
      />

      <HealthWorkerProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        isOffline={isOffline}
        onToggleOffline={handleToggleOffline}
        onSync={handleManualSync}
        isSyncing={isSyncing}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[90] bg-slate-900 text-white text-xs md:text-sm font-medium px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 border border-slate-700 animate-fadeIn">
          <span className="material-symbols-outlined text-indigo-400 text-[18px]">
            info
          </span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
