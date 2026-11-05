import React, { useState } from 'react';
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
  Radio
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
  const { stats, teachersList, holiday, wifiSettings, loading, refresh } = useDashboardStats();
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
      const res = await fetch('/api/export-excel');
      if (!res.ok) throw new Error('Failed to generate report');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
      {/* Top Banner / Alert if holiday */}
      {holiday && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800">
          <Sun className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm font-medium">
            Today is declared as a Holiday: <span className="font-bold underline">{holiday}</span>
          </p>
        </div>
      )}

      {/* Campus WiFi Status Bar */}
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
                Live Supabase Realtime
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Shift: {wifiSettings?.start_time?.slice(0, 5) || '09:00'} - {wifiSettings?.end_time?.slice(0, 5) || '16:00'} • Grace: {wifiSettings?.grace_minutes || 10}m
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
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
            <span>Download Today's Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Teachers */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Faculty</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{stats.total_teachers}</div>
          <p className="text-[11px] text-slate-400 mt-1">Registered teachers</p>
        </div>

        {/* Present Now */}
        <div className="bg-white border border-emerald-100 rounded-xl p-4 shadow-sm bg-gradient-to-br from-emerald-50/40 to-white">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-semibold">On Campus Now</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{stats.present_now}</div>
          <p className="text-[11px] text-emerald-600/80 mt-1">IN recorded today</p>
        </div>

        {/* Present On-Time */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">On-Time</span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{stats.present_count}</div>
          <p className="text-[11px] text-slate-400 mt-1">Before grace cutoff</p>
        </div>

        {/* Late */}
        <div className="bg-white border border-amber-100 rounded-xl p-4 shadow-sm bg-gradient-to-br from-amber-50/40 to-white">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-semibold">Late Comers</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{stats.late_count}</div>
          <p className="text-[11px] text-amber-600/80 mt-1">After 09:10 AM</p>
        </div>

        {/* Absent */}
        <div className="bg-white border border-rose-100 rounded-xl p-4 shadow-sm bg-gradient-to-br from-rose-50/40 to-white">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-semibold">Absent</span>
            <UserX className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-700">{stats.absent_count}</div>
          <p className="text-[11px] text-rose-600/80 mt-1">No check-in</p>
        </div>

        {/* On Leave */}
        <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm bg-gradient-to-br from-blue-50/40 to-white">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-semibold">On Leave</span>
            <CalendarOff className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-700">{stats.on_leave_count}</div>
          <p className="text-[11px] text-blue-600/80 mt-1">Approved leaves</p>
        </div>
      </div>

      {/* Today's Live Attendance Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="font-bold text-base text-slate-800">Today's Faculty Attendance</h2>
            <p className="text-xs text-slate-500">Auto-detected via WiFi with fallback to web check-in</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search teacher or ID..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Department Filter */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <LoadingSpinner size="md" />
            <p className="text-xs text-slate-400 mt-2">Loading live attendance...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Teacher ID</th>
                  <th className="py-3 px-4">Teacher Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-center">IN Time</th>
                  <th className="py-3 px-4 text-center">OUT Time</th>
                  <th className="py-3 px-4 text-center">Total Working Hours</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Mode</th>
                  <th className="py-3 px-4">Device / Mobile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-slate-400">
                      No teachers found matching criteria
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((t) => (
                    <tr key={t.teacher_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">{t.teacher_id}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div>{t.full_name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{t.designation || '-'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{t.department}</td>
                      <td className="py-3 px-4 text-center font-mono">
                        {formatTime(t.in_time)}
                        {t.late_by_minutes > 0 && (
                          <span className="block text-[10px] text-amber-600 font-sans">
                            +{t.late_by_minutes}m late
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        {formatTime(t.out_time)}
                        {t.early_out_by_minutes > 0 && (
                          <span className="block text-[10px] text-rose-500 font-sans">
                            -{t.early_out_by_minutes}m early
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-slate-700">
                        {formatHours(t.total_hours)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          {t.mode || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        <div>{t.device?.mobile_name || 'Not Registered'}</div>
                        {t.device?.mac_address && (
                          <div className="font-mono text-[10px] text-slate-400">{t.device.mac_address}</div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
