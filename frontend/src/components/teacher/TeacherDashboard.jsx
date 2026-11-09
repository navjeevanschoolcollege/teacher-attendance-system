import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import StatusBadge from '../common/StatusBadge';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../common/Modal';
import {
  Wifi,
  Clock,
  LogIn,
  LogOut,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  MapPin,
  QrCode,
  FileEdit,
  AlertTriangle,
  Layers
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
  const [todayRecords, setTodayRecords] = useState([]);
  const [activeShiftTab, setActiveShiftTab] = useState('Shift One');
  const [recentRecords, setRecentRecords] = useState([]);
  const [wifiSettings, setWifiSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkingGps, setCheckingGps] = useState(false);

  // QR Modal
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrTokenInput, setQrTokenInput] = useState('');
  const [verifyingQr, setVerifyingQr] = useState(false);

  const teacherId = teacherProfile?.teacher_id || 'T001';
  const assignedShift = teacherProfile?.shift || 'Shift One';
  const today = todayIST();

  useEffect(() => {
    if (assignedShift === 'Shift Two') {
      setActiveShiftTab('Shift Two');
    } else {
      setActiveShiftTab('Shift One');
    }
  }, [assignedShift]);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      // 1. Fetch Today's Attendance Records (one or two if "Both")
      const { data: todayData } = await supabase
        .from('attendance')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('date', today);

      setTodayRecords(todayData || []);

      // 2. Fetch Recent Records
      const { data: recents } = await supabase
        .from('attendance')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('date', { ascending: false })
        .limit(10);

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

  const currentShiftRecord = todayRecords.find(r => r.shift === activeShiftTab) || null;

  // Web Fallback Check-In
  const handleCheckIn = async (opts = {}) => {
    try {
      setCheckingIn(true);
      const payload = {
        teacher_id: teacherId,
        ip_address: '192.168.1.45',
        mode: opts.mode || 'Manual-Web',
        requested_shift: activeShiftTab,
        ...opts
      };

      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Check-in failed');
      }

      toast.success(data.message || `Check-In marked successfully for ${activeShiftTab}!`);
      fetchStatus();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCheckingIn(false);
    }
  };

  // GPS Backup Check-In
  const handleGpsCheckIn = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setCheckingGps(true);
    toast.loading('Acquiring high-accuracy GPS coordinates...', { id: 'gps' });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        toast.loading('Verifying campus geofence boundary...', { id: 'gps' });
        try {
          await handleCheckIn({
            gps_lat: latitude,
            gps_lng: longitude,
            force_gps_backup: true,
            mode: 'GPS Backup'
          });
          toast.success('GPS location verified inside campus bounds!', { id: 'gps' });
        } catch (e) {
          toast.error(e.message, { id: 'gps' });
        } finally {
          setCheckingGps(false);
        }
      },
      (error) => {
        setCheckingGps(false);
        toast.error(`GPS Error: ${error.message}. Please allow Location permission.`, { id: 'gps' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Staff Room QR Verification
  const handleVerifyQr = async (e) => {
    e.preventDefault();
    if (!qrTokenInput.trim()) return;

    setVerifyingQr(true);
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: teacherId,
          qr_token: qrTokenInput.trim(),
          mode: 'Manual-Web',
          requested_shift: activeShiftTab
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'QR Verification failed');

      toast.success('Staff room QR code verified successfully! Presence logged.');
      setIsQrModalOpen(false);
      setQrTokenInput('');
      fetchStatus();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setVerifyingQr(false);
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
          ip_address: '192.168.1.45',
          shift: activeShiftTab
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Check-out failed');
      }

      toast.success(`Check-Out marked successfully from ${activeShiftTab}!`);
      fetchStatus();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  // Shift Timing String Display
  const getShiftTimingText = () => {
    if (assignedShift === 'Shift One') return 'Shift One, 07:15 AM - 12:30 PM';
    if (assignedShift === 'Shift Two') return 'Shift Two, 12:30 PM - 05:00 PM';
    return 'Both Shifts (Shift One: 07:15 AM - 12:30 PM & Shift Two: 12:30 PM - 05:00 PM)';
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-cyan-800 rounded-2xl p-6 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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

          {/* Assigned Shift Pill */}
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-xs font-bold border border-white/25">
            <Clock className="w-3.5 h-3.5 text-emerald-200" />
            <span>My Shift: {getShiftTimingText()}</span>
          </div>
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

      {/* Special WiFi / GPS Status Alerts */}
      {currentShiftRecord?.status === 'WiFi Off - On Campus (GPS)' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center gap-3 text-indigo-900 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 flex-shrink-0">
            <MapPin className="w-5 h-5 animate-pulse" />
          </div>
          <div className="text-xs leading-relaxed">
            <p className="font-bold text-sm text-indigo-950">WiFi Off — Verified On Campus via GPS Geofence</p>
            <p className="text-indigo-700">
              Your WiFi was turned off or disconnected, but high-accuracy GPS proves you are still within campus grounds ({wifiSettings?.geofence_radius_meters || 200}m radius). You will <strong>NOT</strong> be marked OUT.
            </p>
          </div>
        </div>
      )}

      {currentShiftRecord?.status === 'Incomplete / Needs Review' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4 text-amber-900 shadow-sm">
          <div className="flex items-center gap-3 text-xs leading-relaxed">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-sm text-amber-950">Attendance Needs Review</p>
              <p className="text-amber-800">
                WiFi was disconnected for the remainder of the day. Please submit a quick correction statement with proof.
              </p>
            </div>
          </div>
          <Link
            to="/teacher/correction"
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm flex-shrink-0"
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Request Correction</span>
          </Link>
        </div>
      )}

      {/* If teacher assigned "Both", show shift selection tabs */}
      {assignedShift === 'Both' && (
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveShiftTab('Shift One')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeShiftTab === 'Shift One'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Shift One (07:15 AM - 12:30 PM)
          </button>
          <button
            onClick={() => setActiveShiftTab('Shift Two')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeShiftTab === 'Shift Two'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Shift Two (12:30 PM - 05:00 PM)
          </button>
        </div>
      )}

      {/* Main Today's Attendance Card for the active shift */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-800">Today's Attendance Status</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                activeShiftTab === 'Shift One' ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'
              }`}>
                {activeShiftTab}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })} • Timings: {activeShiftTab === 'Shift One' ? '07:15 AM - 12:30 PM' : '12:30 PM - 05:00 PM'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <StatusBadge status={currentShiftRecord?.status || 'Absent'} />
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
              {formatTime(currentShiftRecord?.in_time)}
            </div>
            {currentShiftRecord?.late_by_minutes > 0 && (
              <span className="text-[11px] text-amber-600 font-semibold mt-1 inline-block">
                +{currentShiftRecord.late_by_minutes} mins late
              </span>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center text-slate-400 mb-1">
              <LogOut className="w-4 h-4 text-rose-500 mr-1.5" />
              <span className="text-xs font-semibold uppercase text-slate-500">OUT Time</span>
            </div>
            <div className="text-2xl font-mono font-bold text-slate-800 mt-1">
              {formatTime(currentShiftRecord?.out_time)}
            </div>
            {currentShiftRecord?.early_out_by_minutes > 0 && (
              <span className="text-[11px] text-rose-500 font-semibold mt-1 inline-block">
                -{currentShiftRecord.early_out_by_minutes} mins early
              </span>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center text-slate-400 mb-1">
              <Clock className="w-4 h-4 text-blue-600 mr-1.5" />
              <span className="text-xs font-semibold uppercase text-slate-500">Working Duration</span>
            </div>
            <div className="text-2xl font-mono font-bold text-blue-700 mt-1">
              {formatHours(currentShiftRecord?.total_hours)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 inline-block">
              Required: {activeShiftTab === 'Shift One' ? '5h 15m (Half Day < 2h 30m)' : '4h 30m (Half Day < 2h 15m)'}
            </span>
          </div>
        </div>

        {/* Action Buttons: Web Fallback Check-In/OUT & GPS Backup */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {!currentShiftRecord?.in_time ? (
            <button
              onClick={() => handleCheckIn()}
              disabled={checkingIn}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              <span>{checkingIn ? 'Verifying...' : `Check-In for ${activeShiftTab}`}</span>
            </button>
          ) : !currentShiftRecord?.out_time ? (
            <button
              onClick={handleCheckOut}
              disabled={checkingOut}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition disabled:opacity-60"
            >
              <LogOut className="w-4 h-4" />
              <span>{checkingOut ? 'Marking OUT...' : `Check-Out from ${activeShiftTab}`}</span>
            </button>
          ) : (
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 bg-slate-100 px-3.5 py-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Attendance finalized for {activeShiftTab} today</span>
            </div>
          )}

          {/* GPS Backup */}
          {!currentShiftRecord?.in_time && (
            <button
              onClick={handleGpsCheckIn}
              disabled={checkingGps}
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-semibold text-xs flex items-center gap-2 transition disabled:opacity-60"
              title="Use GPS Geofence Check-in if WiFi is not auto-detecting"
            >
              <MapPin className="w-4 h-4" />
              <span>{checkingGps ? 'Locating...' : 'GPS Geofence Check-In'}</span>
            </button>
          )}

          {/* Staff Room QR Code */}
          {!currentShiftRecord?.in_time && (
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center gap-2 transition"
            >
              <QrCode className="w-4 h-4 text-slate-500" />
              <span>Enter Staff Room QR Token</span>
            </button>
          )}
        </div>
      </div>

      {/* Recent Attendance History Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800">Recent Attendance History</h3>
          <Link to="/teacher/attendance" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
            View Full Calendar &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Shift</th>
                <th className="py-3 px-4">IN Time</th>
                <th className="py-3 px-4">OUT Time</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No recent attendance records found
                  </td>
                </tr>
              ) : (
                recentRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-medium text-slate-800">{r.date}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        r.shift === 'Shift Two' ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {r.shift || 'Shift One'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">{formatTime(r.in_time)}</td>
                    <td className="py-3 px-4 font-mono">{formatTime(r.out_time)}</td>
                    <td className="py-3 px-4">{formatHours(r.total_hours)}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-3 px-4 text-slate-500">{r.mode || 'Auto-WiFi'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Code Modal */}
      <Modal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title="Enter Live Staff Room QR Code"
      >
        <form onSubmit={handleVerifyQr} className="space-y-4 text-xs">
          <p className="text-slate-600 leading-relaxed">
            Scan the rotating dynamic QR code displayed on the Staff Room screen or enter the 8-character token below.
          </p>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">8-Character QR Token *</label>
            <input
              type="text"
              required
              maxLength={8}
              value={qrTokenInput}
              onChange={(e) => setQrTokenInput(e.target.value.toUpperCase())}
              placeholder="e.g. 7F2A9B1C"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 font-mono text-center tracking-widest text-lg font-bold uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsQrModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={verifyingQr}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition disabled:opacity-60"
            >
              {verifyingQr ? 'Verifying...' : 'Verify & Mark Attendance'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
