'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export type HealthcareRole = 'asha_worker' | 'mo_doctor' | 'admin' | 'patient';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<HealthcareRole>('asha_worker');
  const [facilityName, setFacilityName] = useState('Primary Health Centre (PHC) Karjat');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      // 1. Trigger Supabase Auth signup with metadata for automatic Postgres trigger
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            full_name: fullName.trim(),
            role: role,
            facility_name: facilityName.trim(),
          },
        },
      });

      if (error) {
        setErrorMsg(error.message || 'Failed to create account.');
        setLoading(false);
        return;
      }

      const user = data.user;
      if (user) {
        // 2. Direct fallback insert/upsert into public.profiles
        try {
          await supabase.from('profiles').upsert({
            id: user.id,
            full_name: fullName.trim(),
            role: role,
            facility_name: facilityName.trim(),
            district: 'Raigad / Karjat Sub-District',
          });
        } catch (pfErr) {
          console.warn('Profile table upsert info:', pfErr);
        }
      }

      setSuccessMsg(
        'Account created successfully! Redirecting to login...'
      );
      setTimeout(() => {
        router.push('/login');
      }, 1800);
    } catch (err: any) {
      setErrorMsg(err?.message || 'An unexpected error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 relative antialiased py-12">
      {/* Background Accent Gradient */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-1">
            <span className="material-symbols-outlined text-[32px]">person_add</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Register for ArogyaDisha
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Join the rural healthcare network for frontline triage & teleconsultations
          </p>
        </div>

        {/* Error / Success Feedback Banners */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 animate-fadeIn">
            <span className="material-symbols-outlined text-red-400 text-[18px] shrink-0 mt-0.5">
              error
            </span>
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 animate-fadeIn">
            <span className="material-symbols-outlined text-emerald-400 text-[18px] shrink-0 mt-0.5">
              check_circle
            </span>
            <div className="flex-1">{successMsg}</div>
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSignup} className="space-y-4">
          {/* Role Selector Grid */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Select Your Role *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setRole('asha_worker')}
                className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  role === 'asha_worker'
                    ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-lg ring-1 ring-indigo-500'
                    : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] text-indigo-400">
                  stethoscope
                </span>
                <span className="text-[11px] font-bold leading-tight">ASHA</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('mo_doctor')}
                className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  role === 'mo_doctor'
                    ? 'bg-red-600/30 border-red-500 text-white shadow-lg ring-1 ring-red-500'
                    : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] text-red-400">
                  medical_services
                </span>
                <span className="text-[11px] font-bold leading-tight">Doctor</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  role === 'admin'
                    ? 'bg-slate-700 border-slate-500 text-white shadow-lg ring-1 ring-slate-400'
                    : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] text-slate-300">
                  monitoring
                </span>
                <span className="text-[11px] font-bold leading-tight">Admin</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('patient')}
                className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  role === 'patient'
                    ? 'bg-emerald-600/30 border-emerald-500 text-white shadow-lg ring-1 ring-emerald-500'
                    : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] text-emerald-400">
                  badge
                </span>
                <span className="text-[11px] font-bold leading-tight">Patient</span>
              </button>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rajesh Shivaji Patil"
              className="w-full bg-slate-900/90 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. rajesh.patil@gmail.com"
              className="w-full bg-slate-900/90 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Password (min 6 chars) *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900/90 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all"
            />
          </div>

          {/* Facility / Sub-center Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Health Facility / Sub-Center Name
            </label>
            <input
              type="text"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              placeholder="e.g. Sub-Center Wadgaon Phata / PHC Karjat"
              className="w-full bg-slate-900/90 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-98 disabled:opacity-50 text-white font-bold text-sm py-3.5 rounded-xl shadow-lg shadow-indigo-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer mt-3"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">
                  sync
                </span>
                <span>Creating Account & Profile...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                <span>Complete Registration</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Login Link */}
        <div className="text-center pt-2 border-t border-slate-700/50">
          <p className="text-xs text-slate-400">
            Already registered?{' '}
            <Link
              href="/login"
              className="text-indigo-400 font-bold hover:underline ml-1"
            >
              Sign In Instead →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
