import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../common/LoadingSpinner';
import {
  User,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Mail,
  Phone,
  BookOpen,
  Briefcase
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function MyProfile() {
  const { teacherProfile, user } = useAuth();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [updatingPass, setUpdatingPass] = useState(false);

  const teacherId = teacherProfile?.teacher_id || 'T001';

  useEffect(() => {
    async function fetchDevice() {
      if (!teacherId) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('devices')
          .select('*')
          .eq('teacher_id', teacherId)
          .maybeSingle();

        if (error) throw error;
        setDevice(data || null);
      } catch (err) {
        console.error('Error fetching device:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDevice();
  }, [teacherId]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setUpdatingPass(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully!');
      setNewPassword('');
    } catch (err) {
      toast.error('Failed to update password: ' + err.message);
    } finally {
      setUpdatingPass(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Faculty Profile & Device</h2>
        <p className="text-xs text-slate-500">
          View your academic profile, verified mobile hardware, and account credentials
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Info Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 text-xs">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-base">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">{teacherProfile?.full_name || 'Faculty Member'}</h3>
              <p className="text-xs text-slate-500">Teacher ID: <span className="font-mono font-bold text-emerald-600">{teacherId}</span></p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-3 text-slate-600">
              <Briefcase className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Department & Designation</span>
                <span className="font-medium text-slate-800">
                  {teacherProfile?.department} • {teacherProfile?.designation || '-'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-600">
              <BookOpen className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Subject Expertise</span>
                <span className="font-medium text-slate-800">{teacherProfile?.subject || '-'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-600">
              <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Email Address</span>
                <span className="font-medium text-slate-800">{teacherProfile?.email || user?.email}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-600">
              <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Phone Number</span>
                <span className="font-medium text-slate-800">{teacherProfile?.phone || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Registered Mobile Device Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-base text-slate-900">Registered Mobile Device</h3>
            </div>
            {device && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  device.is_approved
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {device.is_approved ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                {device.is_approved ? 'Approved' : 'Pending Approval'}
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-8 text-center">
              <LoadingSpinner size="sm" />
            </div>
          ) : !device ? (
            <div className="py-8 text-center text-slate-400">
              <p>No device registered yet.</p>
              <p className="text-[11px] mt-1 text-slate-500">
                Log into the Android Mobile App to link your phone automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Mobile Device</span>
                <span className="font-medium text-slate-800 text-sm">{device.mobile_name}</span>
                <span className="text-[11px] text-slate-500 block">
                  Model: {device.mobile_model} ({device.os_version})
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Hardware MAC Address</span>
                <span className="font-mono font-bold text-slate-800 text-xs bg-slate-100 px-2 py-0.5 rounded inline-block">
                  {device.mac_address}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Registered IP Address</span>
                <span className="font-mono text-slate-700 text-xs">{device.ip_address || '-'}</span>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                Registered on: {new Date(device.registered_at).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Security: Update Password Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-md text-xs">
        <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold text-sm">
          <KeyRound className="w-4 h-4 text-blue-600" />
          <span>Change Account Password</span>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">New Password *</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={updatingPass}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition disabled:opacity-60 shadow-sm"
          >
            {updatingPass ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
