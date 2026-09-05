'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import { PatientView } from '../../components/PatientView';

export default function PatientPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (data?.user) {
          setUser(data.user);
        } else {
          // Default to registered patient profile Roshan Sahani
          setUser({
            id: 'p-patient-101',
            user_metadata: { full_name: 'Roshan Sahani', role: 'patient' },
            email: 'roshan.sahani@patient.org',
          });
        }
      })
      .catch((err) => {
        console.warn('Patient auth fetch:', err);
        if (isMounted) {
          setUser({
            id: 'p-patient-101',
            user_metadata: { full_name: 'Roshan Sahani', role: 'patient' },
            email: 'roshan.sahani@patient.org',
          });
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined animate-spin text-emerald-400">sync</span>
          <span className="text-sm font-semibold">Loading Patient Portal...</span>
        </div>
      </div>
    );
  }

  return <PatientView user={user} />;
}
