import { supabase } from '../supabaseClient';

export interface SyncPayload {
  transactionId: string;
  entityType: 'patient' | 'consultation';
  entityId: string;
  clientVersion: number;
  data: any;
  actorId: string;
}

export class SyncEngine {
  /**
   * Processes an offline-sync payload securely.
   * 1. Idempotency Check
   * 2. Version Conflict Detection (No Last-Write-Wins for Clinical Data)
   */
  static async processSyncPayload(payload: SyncPayload) {
    // 1. Idempotency: Have we processed this offline transaction already?
    const { data: existingSync } = await supabase
      .from('sync_queue_logs')
      .select('transaction_id')
      .eq('transaction_id', payload.transactionId)
      .single();

    if (existingSync) {
      return { status: 'ALREADY_PROCESSED' };
    }

    // 2. Fetch current server state
    const table = payload.entityType === 'patient' ? 'patients' : 'consultations';
    const { data: serverRecord, error: fetchErr } = await supabase
      .from(table)
      .select('version, *')
      .eq('id', payload.entityId)
      .single();

    if (fetchErr) throw new Error(`Sync Fetch Error: ${fetchErr.message}`);

    // 3. Conflict Detection
    if (payload.clientVersion < serverRecord.version) {
      // The client is trying to update an old record.
      // For clinical fields, we REJECT this completely and force a manual merge.
      
      // (If this was a non-clinical field like a phone number, we might auto-merge, 
      // but for Arogyadisha safety, we enforce strict review).
      
      return { 
        status: '409_CONFLICT', 
        serverState: serverRecord,
        message: 'Client version is outdated. Manual resolution required to prevent data loss.'
      };
    }

    // 4. Proceed with Update (Increment Version)
    const nextVersion = serverRecord.version + 1;
    const { error: updateErr } = await supabase
      .from(table)
      .update({ ...payload.data, version: nextVersion, updated_at: new Date().toISOString() })
      .eq('id', payload.entityId);

    if (updateErr) throw new Error(updateErr.message);

    // 5. Log Idempotency Record
    await supabase.from('sync_queue_logs').insert({
      transaction_id: payload.transactionId,
      actor_id: payload.actorId,
      entity_type: payload.entityType,
      entity_id: payload.entityId
    });

    return { status: 'SUCCESS', newVersion: nextVersion };
  }
}
