import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import StatusBadge from '../common/StatusBadge';
import LoadingSpinner from '../common/LoadingSpinner';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  CalendarOff,
  Sun,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Wifi,
  Radio,
  ShieldAlert,
  AlertTriangle,
  FileCheck,
  MapPin,
  QrCode,
  Layers,
  Filter
} from 'lucide-react';
import toast from 'react-hot-toast';

function formatTime(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatHours(hrs) {
  if (!hrs || isNaN(hrs) || hrs <= 0) return '-';
  const min = Math.round(Number(hrs) * 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function AdminDashboard() {
  const [selectedShift, setSelectedShift] = useState('All'); // 'All', 'Shift One', 'Shift Two'
  const { stats, teachersList, holiday, wifiSettings, loading, refresh } = useDashboardStats(null, selectedShift);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [exporting, setExporting] = useState(false);

  const departments = ['All', ...new Set((teachersList || []).map(t => t.department).filter(Boolean))];

  const filteredTeachers = (teachersList || []).filter(t => {
    const matchesSearch =
      (t.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.teacher_id || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'All' || t.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  const handleDownloadExcel = async () => {
    try {
      setExporting(true);
      toast.loading('Generating Excel report...', { id: 'excel' });
      const res = await fetch(`/api/export-excel?shift=${encodeURIComponent(selectedShift)}`);
      if (!res.ok) throw new Error('Failed to generate report');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${selectedShift.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success('Excel report downloaded successfully!', { id: 'excel' });
    } catch (err) {
      toast.error(err.message, { id: 'excel' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pending Corrections Alert Banner */}
      {stats.pending_corrections > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl p-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-white">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">
                {stats.pending_corrections} Attendance Correction Request(s) Awaiting Review
              </p>
              <p className="text-xs text-blue-100">
                Faculty members submitted dispute statements for accidental WiFi disconnects or time adjustments.
              </p>
            </div>
          </div>
          <Link
            to="/admin/corrections"
            className="px-3.5 py-1.5 bg-white text-blue-700 hover:bg-blue-50 rounded-lg text-xs font-bold transition shadow-sm"
          >
            Review Now
          </Link>
        </div>
      )}

      {/* Top Banner / Alert if holiday */}
      {holiday && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800">
          <Sun className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm font-medium">
            Today is declared as a Holiday: <span className="font-bold underline">{holiday}</span>
          </p>
        </div>
      )}

      {/* Campus WiFi & Shift Status Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Campus Network:</span>
              <span className="text-sm font-bold text-slate-800">{wifiSettings?.campus_ssid || 'Woxsen_Campus_WiFi'}</span>
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Radio className="w-3 h-3 animate-ping text-emerald-500" />
                Live Realtime
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-semibold text-blue-700">Shift One:</span> {wifiSettings?.shift_one_start?.slice(0, 5) || '07:15'} - {wifiSettings?.shift_one_end?.slice(0, 5) || '12:30'} (Grace: 10m) • <span className="font-semibold text-indigo-700">Shift Two:</span> {wifiSettings?.shift_two_start?.slice(0, 5) || '12:30'} - {wifiSettings?.shift_two_end?.slice(0, 5) || '17:00'} (Grace: 10m)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link
            to="/admin/staff-room-qr"
            className="p-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 text-xs flex items-center gap-1 font-semibold transition"
            title="Open Staff Room Display Screen"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Staff Room QR Display</span>
          </Link>
          <button
            onClick={refresh}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 text-xs flex items-center gap-1 transition"
            title="Refresh Live Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleDownloadExcel}
            disabled={exporting}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-60"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Download Excel</span>
          </button>
        </div>
      </div>

      {/* Dual Shift Live Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Shift One Summary Card */}
        <div className="bg-gradient-to-br from-blue-50/70 via-white to-blue-50/30 border border-blue-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-blue-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <h3 className="font-bold text-sm text-slate-800">Shift One (07:15 AM - 12:30 PM)</h3>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Grace cutoff: 07:25 AM
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-3 text-center">
            <div className="bg-white border border-blue-100 rounded-xl p-3 shadow-xs">
              <p className="text-[11px] text-slate-500 font-medium">Present Now</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">{stats.shift_one?.present_now || 0}</p>
              <p className="text-[10px] text-slate-400">On Campus</p>
            </div>
            <div className="bg-white border border-blue-100 rounded-xl p-3 shadow-xs">
              <p className="text-[11px] text-slate-500 font-medium">Late Comers</p>
              <p className="text-xl font-bold text-amber-600 mt-0.5">{stats.shift_one?.late_count || 0}</p>
              <p className="text-[10px] text-slate-400">After 07:25 AM</p>
            </div>
            <div className="bg-white border border-blue-100 rounded-xl p-3 shadow-xs">
              <p className="text-[11px] text-slate-500 font-medium">Absent</p>
              <p className="text-xl font-bold text-rose-600 mt-0.5">{stats.shift_one?.absent_count || 0}</p>
              <p className="text-[10px] text-slate-400">No IN recorded</p>
            </div>
          </div>
        </div>

        {/* Shift Two Summary Card */}
        <div className="bg-gradient-to-br from-indigo-50/70 via-white to-indigo-50/30 border border-indigo-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              <h3 className="font-bold text-sm text-slate-800">Shift Two (12:30 PM - 05:00 PM)</h3>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
              Grace cutoff: 12:40 PM
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-3 text-center">
            <div className="bg-white border border-indigo-100 rounded-xl p-3 shadow-xs">
              <p className="text-[11px] text-slate-500 font-medium">Present Now</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">{stats.shift_two?.present_now || 0}</p>
              <p className="text-[10px] text-slate-400">On Campus</p>
            </div>
            <div className="bg-white border border-indigo-100 rounded-xl p-3 shadow-xs">
              <p className="text-[11px] text-slate-500 font-medium">Late Comers</p>
              <p className="text-xl font-bold text-amber-600 mt-0.5">{stats.shift_two?.late_count || 0}</p>
              <p className="text-[10px] text-slate-400">After 12:40 PM</p>
            </div>
            <div className="bg-white border border-indigo-100 rounded-xl p-3 shadow-xs">
              <p className="text-[11px] text-slate-500 font-medium">Absent</p>
              <p className="text-xl font-bold text-rose-600 mt-0.5">{stats.shift_two?.absent_count || 0}</p>
              <p className="text-[10px] text-slate-400">No IN recorded</p>
            </div>
          </div>
        </div>
      </div>

      {/* Shift Filter Tabs & Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mr-2">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            Filter by Shift:
          </span>
          <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
            {['All', 'Shift One', 'Shift Two'].map((s) => (
              <button
                key={s}
                onClick={() => setSelectedShift(s)}
                className={`px-3 py-1.5 rounded-md transition ${
                  selectedShift === s
                    ? 'bg-white text-blue-700 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s === 'All' ? 'All Shifts' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Department Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search faculty or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept === 'All' ? 'All Departments' : dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Live Faculty Attendance Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-800">
              Live Attendance Records ({selectedShift})
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {filteredTeachers.length} record(s)
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Shift One: 07:15 - 12:30 • Shift Two: 12:30 - 17:00
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <LoadingSpinner size="md" />
            <p className="text-xs text-slate-400 mt-2">Loading live attendance...</p>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No faculty attendance found for this filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Faculty</th>
                  <th className="py-3 px-4">Shift</th>
                  <th className="py-3 px-4">Dept / Desig</th>
                  <th className="py-3 px-4">IN Time</th>
                  <th className="py-3 px-4">OUT Time</th>
                  <th className="py-3 px-4">Total Hours</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Late / Early</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.map((t, idx) => (
                  <tr key={`${t.teacher_id}_${t.shift || idx}`} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{t.full_name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{t.teacher_id}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        t.shift === 'Shift One'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}>
                        {t.shift || 'Shift One'}
                      </span>
                      {t.assigned_shift === 'Both' && (
                        <div className="text-[10px] text-slate-400 mt-0.5">Assigned: Both</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{t.department}</div>
                      <div className="text-[11px] text-slate-400">{t.designation || '-'}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">
                      {formatTime(t.in_time)}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">
                      {formatTime(t.out_time)}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {formatHours(t.total_hours)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-3 px-4 text-[11px]">
                      {t.late_by_minutes > 0 && (
                        <span className="text-amber-600 font-medium block">
                          Late: +{t.late_by_minutes}m
                        </span>
                      )}
                      {t.early_out_by_minutes > 0 && (
                        <span className="text-rose-600 font-medium block">
                          Early Out: -{t.early_out_by_minutes}m
                        </span>
                      )}
                      {t.late_by_minutes === 0 && t.early_out_by_minutes === 0 && (
                        <span className="text-slate-400">On Time</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-[11px]">
                      {t.mode || '-'}
                    </td>
                    <td className="py-3 px-4">
                      {t.flagged_suspicious ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200" title={t.suspicious_reason}>
                          <AlertTriangle className="w-3 h-3" />
                          Suspicious
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Verified
                        </span>
                      )}
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
