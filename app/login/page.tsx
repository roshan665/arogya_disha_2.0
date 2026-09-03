'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setErrorMsg(error.message || 'Invalid login credentials. Please check your email and password.');
        setLoading(false);
        return;
      }

      if (data.session) {
        // Fetch user profile role if available
        const user = data.user;
        const role = user?.user_metadata?.role || 'asha_worker';

        // Redirect based on role or home
        if (role === 'mo_doctor') {
          router.push('/doctor');
        } else if (role === 'admin') {
          router.push('/admin');
        } else if (role === 'patient') {
          router.push('/patient');
        } else {
          router.push('/asha');
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An unexpected error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 relative antialiased">
      {/* Background Accent Gradient */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-2">
            <span className="material-symbols-outlined text-[32px]">health_and_safety</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            ArogyaDisha
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Sign in to access your healthcare portal & clinical triage
          </p>
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 animate-fadeIn">
            <span className="material-symbols-outlined text-red-400 text-[18px] shrink-0 mt-0.5">
              error
            </span>
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. sunita.asha@phc.org"
                className="w-full bg-slate-900/90 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all pl-10"
              />
              <span className="material-symbols-outlined text-slate-500 text-[20px] absolute left-3 top-3.5 pointer-events-none">
                mail
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Password
              </label>
            </div>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/90 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all pl-10"
              />
              <span className="material-symbols-outlined text-slate-500 text-[20px] absolute left-3 top-3.5 pointer-events-none">
                lock
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-98 disabled:opacity-50 text-white font-bold text-sm py-3.5 rounded-xl shadow-lg shadow-indigo-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">
                  sync
                </span>
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">login</span>
                <span>Sign In to ArogyaDisha</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Signup Link */}
        <div className="text-center pt-2 border-t border-slate-700/50">
          <p className="text-xs text-slate-400">
            Don't have an account yet?{' '}
            <Link
              href="/signup"
              className="text-indigo-400 font-bold hover:underline ml-1"
            >
              Register New Account →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
