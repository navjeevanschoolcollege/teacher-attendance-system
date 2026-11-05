import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import StatusBadge from '../common/StatusBadge';
import LoadingSpinner from '../common/LoadingSpinner';
import {
  Wifi,
  Clock,
  LogIn,
  LogOut,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

function todayIST() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(isoStr) {
  if (!isoStr) return '--:--';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatHours(hrs) {
  if (!hrs || isNaN(hrs) || hrs <= 0) return '0h 00m';
  const min = Math.round(Number(hrs) * 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function TeacherDashboard() {
  const { teacherProfile } = useAuth();
  const [todayRecord, setTodayRecord] = useState(null);
  const [recentRecords, setRecentRecords] = useState([]);
  const [wifiSettings, setWifiSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const teacherId = teacherProfile?.teacher_id || 'T001';
  const today = todayIST();

  const fetchStatus = async () => {
    try {
      setLoading(true);
      // 1. Fetch Today's Attendance
      const { data: todayData } = await supabase
        .from('attendance')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('date', today)
        .maybeSingle();

      setTodayRecord(todayData || null);

      // 2. Fetch Recent Records (Last 7 working records)
      const { data: recents } = await supabase
        .from('attendance')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('date', { ascending: false })
        .limit(7);

      setRecentRecords(recents || []);

      // 3. Fetch WiFi Settings
      const { data: wifi } = await supabase
        .from('wifi_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      setWifiSettings(wifi || null);
    } catch (err) {
      console.error('Error fetching teacher dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (teacherId) {
      fetchStatus();
    }
  }, [teacherId]);

  // Web Fallback Check-In
  const handleCheckIn = async () => {
    try {
      setCheckingIn(true);
      // In web browser, we pass teacher_id and optional demo IP
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: teacherId,
          ip_address: '192.168.1.45' // Handled with CIDR check in checkin.js
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Check-in failed');
      }

      toast.success('Check-In marked successfully!');
      fetchStatus();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCheckingIn(false);
    }
  };

  // Web Fallback Check-Out
  const handleCheckOut = async () => {
    try {
      setCheckingOut(true);
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: teacherId,
          ip_address: '192.168.1.45'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Check-out failed');
      }

      toast.success('Check-Out marked successfully!');
      fetchStatus();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
            Faculty Attendance Portal
          </span>
          <h2 className="text-xl sm:text-2xl font-bold mt-1">
            Welcome, {teacherProfile?.full_name || 'Faculty Member'}
          </h2>
          <p className="text-xs text-emerald-100 mt-1">
            Teacher ID: <span className="font-mono font-bold">{teacherId}</span> • Department: {teacherProfile?.department || '-'}
          </p>
        </div>

        {/* Campus WiFi Status Pill */}
        <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-xl px-4 py-2.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
            <Wifi className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] text-emerald-200 font-medium">Campus WiFi</div>
            <div className="text-xs font-bold">{wifiSettings?.campus_ssid || 'Woxsen_Campus_WiFi'}</div>
          </div>
        </div>
      </div>

      {/* Main Today's Attendance Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div>
            <h3 className="font-bold text-base text-slate-800">Today's Attendance Status</h3>
            <p className="text-xs text-slate-500">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Current Status:</span>
            <StatusBadge status={todayRecord?.status || 'Absent'} />
          </div>
        </div>

        {/* 3 Metric Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center text-slate-400 mb-1">
              <LogIn className="w-4 h-4 text-emerald-600 mr-1.5" />
              <span className="text-xs font-semibold uppercase text-slate-500">IN Time</span>
            </div>
            <div className="text-2xl font-mono font-bold text-slate-800 mt-1">
              {formatTime(todayRecord?.in_time)}
            </div>
            {todayRecord?.late_by_minutes > 0 && (
              <span className="text-[11px] text-amber-600 font-semibold mt-1 inline-block">
                +{todayRecord.late_by_minutes} mins late
              </span>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center text-slate-400 mb-1">
              <LogOut className="w-4 h-4 text-rose-500 mr-1.5" />
              <span className="text-xs font-semibold uppercase text-slate-500">OUT Time</span>
            </div>
            <div className="text-2xl font-mono font-bold text-slate-800 mt-1">
              {formatTime(todayRecord?.out_time)}
            </div>
            {todayRecord?.early_out_by_minutes > 0 && (
              <span className="text-[11px] text-rose-500 font-semibold mt-1 inline-block">
                -{todayRecord.early_out_by_minutes} mins early
              </span>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center text-slate-400 mb-1">
              <Clock className="w-4 h-4 text-blue-600 mr-1.5" />
              <span className="text-xs font-semibold uppercase text-slate-500">Working Duration</span>
            </div>
            <div className="text-2xl font-mono font-bold text-blue-700 mt-1">
              {formatHours(todayRecord?.total_hours)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 inline-block">
              Required: 7h 00m
            </span>
          </div>
        </div>

        {/* Manual Web Check-In / Check-Out Actions */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-800 block">Web Check-In Fallback</span>
            If you do not have your mobile phone, click below to mark attendance via Campus Network.
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleCheckIn}
              disabled={checkingIn || !!todayRecord?.in_time}
              className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn className="w-4 h-4" />
              <span>{checkingIn ? 'Checking In...' : todayRecord?.in_time ? 'Checked In' : 'Check In Now'}</span>
            </button>

            <button
              onClick={handleCheckOut}
              disabled={checkingOut || !todayRecord?.in_time || !!todayRecord?.out_time}
              className="flex-1 sm:flex-none px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut className="w-4 h-4" />
              <span>{checkingOut ? 'Checking Out...' : todayRecord?.out_time ? 'Checked Out' : 'Check Out Now'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Attendance History Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-slate-800">Recent Attendance History</h4>
            <p className="text-xs text-slate-500">Your attendance logs for recent days</p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <LoadingSpinner size="md" />
          </div>
        ) : recentRecords.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No attendance history found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">IN Time</th>
                  <th className="py-3 px-4 text-center">OUT Time</th>
                  <th className="py-3 px-4 text-center">Working Hours</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Mode</th>
                  <th className="py-3 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentRecords.map(r => (
                  <tr key={r.id || r.date} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">
                      {new Date(r.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">{formatTime(r.in_time)}</td>
                    <td className="py-3 px-4 text-center font-mono">{formatTime(r.out_time)}</td>
                    <td className="py-3 px-4 text-center font-medium text-slate-700">
                      {formatHours(r.total_hours)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                        {r.mode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px] italic">
                      {r.remarks || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

