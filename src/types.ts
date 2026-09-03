export type PriorityLevel = 'normal' | 'high' | 'critical';
export type PatientStatus = 'waiting' | 'in-consultation' | 'completed' | 'referred';
export type TabType = 'home' | 'patients' | 'consults' | 'alerts';

export interface TimelineEntry {
  id: string;
  date: string;
  title: string;
  note: string;
  medication?: string;
  critical?: boolean;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  instructions: string;
}

export interface Patient {
  id: string;
  patientId: string;
  name: string;
  initials: string;
  age: number;
  gender: 'M' | 'F' | 'Other';
  bloodGroup: string;
  primaryConcern: string;
  concernIcon: string;
  tokenNumber: number;
  waitTime: string;
  priority: PriorityLevel;
  status: PatientStatus;
  phone: string;
  village: string;
  vitals: {
    bp: string;
    pulse: string;
    temp: string;
    spo2: string;
    weight: string;
    hba1c?: string;
  };
  medicalHistory: TimelineEntry[];
  currentMedications: Medication[];
  clinicalNotes: string;
}

export interface ScheduleItem {
  id: string;
  time: string;
  period: 'AM' | 'PM';
  patientName: string;
  patientId?: string;
  category: string;
  icon: string;
  completed: boolean;
  colorType: 'primary' | 'secondary' | 'neutral';
  village?: string;
}

export interface QuickActionItem {
  id: string;
  title: string;
  icon: string;
  bgColor: string;
  textColor: string;
}

export interface AlertNotification {
  id: string;
  type: 'critical' | 'emergency' | 'sync' | 'vaccine' | 'followup';
  title: string;
  patientName?: string;
  timestamp: string;
  message: string;
  resolved: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface SyncItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  status: 'synced' | 'pending' | 'syncing';
}
