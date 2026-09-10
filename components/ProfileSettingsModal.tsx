'use client';

import React, { useState, useEffect } from 'react';
import {
  OnboardingProfileService,
} from '../lib/services/OnboardingProfileService';
import { RealtimeRole } from '../lib/services/RealtimeCommunicationService';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  role: RealtimeRole;
  language?: 'en' | 'mr' | 'hi';
  onProfileUpdated?: (updatedProfile: any) => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  userId,
  role,
  language = 'en',
  onProfileUpdated,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<any>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !userId) return;

    const load = async () => {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      try {
        const data = await OnboardingProfileService.getRoleProfile(userId, role);
        setProfileData(data || {});
      } catch (e: any) {
        setErrorMsg('Failed to load profile data.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isOpen, userId, role]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSaving(true);

    try {
      await OnboardingProfileService.updateRoleProfile(userId, role, profileData);
      setSuccessMsg(
        language === 'mr'
          ? 'प्रोफाइल यशस्वीरित्या अद्यतनित झाली!'
          : language === 'hi'
          ? 'प्रोफाइल सफलतापूर्वक अपडेट हो गई!'
          : 'Profile updated successfully!'
      );
      if (onProfileUpdated) onProfileUpdated(profileData);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl space-y-6 relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">manage_accounts</span>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                {language === 'mr'
                  ? 'प्रोफाइल व खाते सेटिंग्ज'
                  : language === 'hi'
                  ? 'प्रोफाइल एवं खाता सेटिंग्स'
                  : 'Profile & Account Settings'}
              </h2>
              <span className="text-xs text-slate-400">Role: {role}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Feedback alerts */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-red-400 text-sm">error</span>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
            {successMsg}
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
            Loading profile information...
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {/* Common Name / Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  {role === 'PHC'
                    ? 'PHC Facility Name'
                    : role === 'DISTRICT_HOSPITAL'
                    ? 'Hospital Name'
                    : 'Full Name'}
                </label>
                <input
                  type="text"
                  required
                  value={
                    profileData.full_name ||
                    profileData.phc_name ||
                    profileData.hospital_name ||
                    ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (role === 'PHC') setProfileData({ ...profileData, phc_name: val });
                    else if (role === 'DISTRICT_HOSPITAL')
                      setProfileData({ ...profileData, hospital_name: val });
                    else setProfileData({ ...profileData, full_name: val });
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  required
                  value={profileData.phone || ''}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Address / Location */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Village / City</label>
                <input
                  type="text"
                  value={profileData.village || profileData.city || ''}
                  onChange={(e) =>
                    setProfileData({
                      ...profileData,
                      village: e.target.value,
                      city: e.target.value,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">District</label>
                <input
                  type="text"
                  value={profileData.district || ''}
                  onChange={(e) => setProfileData({ ...profileData, district: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">State</label>
                <input
                  type="text"
                  value={profileData.state || ''}
                  onChange={(e) => setProfileData({ ...profileData, state: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Address Details</label>
              <input
                type="text"
                value={profileData.address || ''}
                onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
            </div>

            {/* Role Specific Locked / Read-Only Fields */}
            {role === 'ASHA' && (
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-300">ASHA Worker ID:</span>{' '}
                  <span className="text-emerald-400 font-mono">{profileData.asha_worker_id}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-300">Primary PHC:</span>{' '}
                  <span className="text-slate-300">{profileData.primary_phc_name}</span>
                </div>
                <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-400">
                  Admin Managed
                </span>
              </div>
            )}

            {/* Patient Emergency Contact Edit */}
            {role === 'PATIENT' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    value={profileData.emergency_contact_name || ''}
                    onChange={(e) =>
                      setProfileData({ ...profileData, emergency_contact_name: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Emergency Phone
                  </label>
                  <input
                    type="tel"
                    value={profileData.emergency_contact_phone || ''}
                    onChange={(e) =>
                      setProfileData({ ...profileData, emergency_contact_phone: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
