import Dexie, { type Table } from 'dexie';

export type RiskScore = 'GREEN' | 'YELLOW' | 'RED';
export type SyncStatus = 'synced' | 'pending' | 'failed';

export interface VitalsData {
  bp_systolic?: number;
  bp_diastolic?: number;
  heart_rate?: number;
  spo2?: number;
  temperature?: number;
  respiratory_rate?: number;
  blood_sugar_random?: number;
  hemoglobin?: number;
  [key: string]: any;
}

export interface PatientRecord {
  id?: number; // Auto-incremented primary key for local Dexie store
  remote_id?: string; // Supabase UUID
  name: string;
  age?: number;
  gender?: 'M' | 'F' | 'Other';
  abha_id?: string;
  phone?: string;
  village?: string;
  symptoms?: string[];
  vitals?: VitalsData;
  risk_score?: RiskScore | null;
  sync_status: SyncStatus;
  created_at: string;
  updated_at?: string;
}

export interface VisitRecord {
  id?: number; // Auto-incremented primary key for local Dexie store
  remote_id?: string; // Supabase UUID
  patient_id?: string; // Supabase Patient UUID or local reference
  name: string; // Patient name for quick offline access & search
  symptoms: string[];
  vitals: VitalsData;
  risk_score: RiskScore;
  ai_summary?: string;
  recommended_action?: string;
  marathi_translation?: string;
  sync_status: SyncStatus;
  created_at: string;
  updated_at?: string;
}

/**
 * ArogyaDisha Dexie Database Class
 * Provides offline-first client storage for frontline health workers (ASHA/ANM).
 */
export class ArogyaDishaDatabase extends Dexie {
  patients!: Table<PatientRecord, number>;
  visits!: Table<VisitRecord, number>;

  constructor() {
    super('ArogyaDishaLocalDB');

    // Schema indexing
    this.version(1).stores({
      patients: '++id, remote_id, name, abha_id, risk_score, sync_status, created_at',
      visits: '++id, remote_id, patient_id, name, risk_score, sync_status, created_at',
    });
  }
}

export const db = new ArogyaDishaDatabase();

/**
 * Offline Helper: Saves or stages a clinical visit locally with 'pending' sync status.
 *
 * @param data Visit data containing patient name, symptoms, vitals, risk score, and clinical summaries.
 * @returns The auto-incremented local database ID.
 */
export async function saveVisitOffline(
  data: Omit<VisitRecord, 'id' | 'sync_status' | 'created_at'> & {
    id?: number;
    sync_status?: SyncStatus;
    created_at?: string;
  }
): Promise<number> {
  const timestamp = data.created_at || new Date().toISOString();

  const visitToStore: VisitRecord = {
    ...data,
    sync_status: data.sync_status || 'pending',
    created_at: timestamp,
    updated_at: new Date().toISOString(),
  };

  if (visitToStore.id) {
    await db.visits.put(visitToStore);
    return visitToStore.id;
  }

  const generatedId = await db.visits.add(visitToStore);
  return generatedId;
}

/**
 * Helper to fetch all records queued for synchronization with Supabase.
 */
export async function getPendingSyncVisits(): Promise<VisitRecord[]> {
  return await db.visits.where('sync_status').equals('pending').toArray();
}
