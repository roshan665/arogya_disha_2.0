import { useState, useEffect, useCallback } from 'react';
import { AshaWorkflowRepository } from '../repositories/AshaWorkflowRepository';
import { AshaClinicalService } from '../services/AshaClinicalService';

export function useAshaDashboard(ashaId: string) {
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    if (!ashaId) return;
    setLoading(true);
    try {
      const rawData = await AshaWorkflowRepository.getSchedule(ashaId);
      // Transform raw assignment data into a flat schedule list for UI
      const formatted = rawData.map((row: any, i: number) => {
        // Find if they have an active follow-up
        const followUp = row.patients?.follow_ups?.find((f: any) => f.status === 'pending');
        
        return {
          id: row.patient_id,
          time: followUp ? 'Follow-up Due' : 'Routine Check',
          type: followUp ? 'Follow-up' : 'Checkup',
          highRisk: followUp?.reason?.includes('High-risk'),
          patientName: `${row.patients?.first_name || ''} ${row.patients?.last_name || ''}`.trim(),
          details: followUp ? followUp.reason : 'General',
          village: row.patients?.village || 'Unknown',
          avatar: `https://ui-avatars.com/api/?name=${row.patients?.first_name || 'U'}&background=random`,
          phone: '',
          raw: row
        };
      });
      setSchedule(formatted);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ashaId]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const submitCheckup = async (visitData: any) => {
    try {
      await AshaClinicalService.completeCheckup(visitData, true);
      await fetchSchedule(); // Refresh dashboard
      return true;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  return {
    schedule,
    loading,
    error,
    refreshSchedule: fetchSchedule,
    submitCheckup
  };
}
