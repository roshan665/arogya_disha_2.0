import { useState } from 'react';
import { PatientRepository, Patient } from '../repositories/PatientRepository';
import { RegistrationService } from '../services/RegistrationService';

export function usePatientManagement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerPatient = async (patientData: Patient, identifiers: {type: string, value: string}[], ashaId?: string, isOffline: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const patient = await RegistrationService.registerPatient(patientData, identifiers, ashaId, isOffline);
      return patient;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const searchPatients = async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      return await PatientRepository.searchPatients(query);
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const deactivatePatient = async (patientId: string) => {
    setLoading(true);
    setError(null);
    try {
      return await PatientRepository.deactivatePatient(patientId);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    registerPatient,
    searchPatients,
    deactivatePatient,
    loading,
    error
  };
}
