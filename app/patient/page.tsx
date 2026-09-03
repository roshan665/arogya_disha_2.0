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
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login');
      } else {
        setUser(data.user);
      }
      setLoading(false);
    });
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
