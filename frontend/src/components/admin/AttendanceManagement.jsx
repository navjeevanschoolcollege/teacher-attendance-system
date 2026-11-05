import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import StatusBadge from '../common/StatusBadge';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import { Calendar, Search, Edit3, FileSpreadsheet, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

function todayIST() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

export default function AttendanceManagement() {
  const [selectedDate, setSelectedDate] = useState(todayIST());
  const [attendance, setAttendance] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editFormData, setEditFormData] = useState({
    in_time: '',
    out_time: '',
    status: 'Present',
    remarks: ''
  });
  const [saving, setSaving] = useState(false);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      // Fetch all active teachers
      const { data: teacherList, error: tErr } = await supabase
        .from('teachers')
        .select('*, devices(*)')
        .eq('status', 'Active');
      if (tErr) throw tErr;
      setTeachers(teacherList || []);

      // Fetch attendance for selected date
      const { data: attList, error: aErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', selectedDate);
      if (aErr) throw aErr;

      setAttendance(attList || []);
    } catch (err) {
      toast.error('Failed to load attendance: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, [selectedDate]);

  const departments = ['All', ...new Set(teachers.map(t => t.department).filter(Boolean))];

  // Merge teachers with attendance
  const attMap = new Map();
  attendance.forEach(a => attMap.set(a.teacher_id, a));

  const mergedRecords = teachers.map(t => {
    const att = attMap.get(t.teacher_id);
    return {
      teacher_id: t.teacher_id,
      full_name: t.full_name,
      department: t.department,
      designation: t.designation,
      device: t.devices?.[0] || null,
      id: att?.id || null,
      date: selectedDate,
      in_time: att?.in_time || null,
      out_time: att?.out_time || null,
      total_hours: att?.total_hours || 0,
      status: att?.status || 'Absent',
      late_by_minutes: att?.late_by_minutes || 0,
      early_out_by_minutes: att?.early_out_by_minutes || 0,
      mode: att?.mode || (att ? 'Auto-WiFi' : '-'),
      ssid: att?.ssid || null,
      remarks: att?.remarks || null
    };
  });

  const filtered = mergedRecords.filter(r => {
    const matchesSearch =
      r.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.teacher_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'All' || r.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  const openEditModal = (rec) => {
    setSelectedRecord(rec);
    
    // Format ISO string to time input format (HH:mm)
    const inTimeStr = rec.in_time ? new Date(rec.in_time).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    }) : '';

    const outTimeStr = rec.out_time ? new Date(rec.out_time).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    }) : '';

    setEditFormData({
      in_time: inTimeStr,
      out_time: outTimeStr,
      status: rec.status,
      remarks: rec.remarks || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setSaving(true);
    try {
      const inIso = editFormData.in_time
        ? `${selectedDate}T${editFormData.in_time}:00+05:30`
        : null;
      const outIso = editFormData.out_time
        ? `${selectedDate}T${editFormData.out_time}:00+05:30`
        : null;

      let totalHours = 0;
      if (inIso && outIso) {
        totalHours = Number(((new Date(outIso) - new Date(inIso)) / (1000 * 60 * 60)).toFixed(2));
      }

      const { error } = await supabase
        .from('attendance')
        .upsert({
          teacher_id: selectedRecord.teacher_id,
          date: selectedDate,
          in_time: inIso,
          out_time: outIso,
          total_hours: totalHours,
          status: editFormData.status,
          mode: 'Admin',
          remarks: editFormData.remarks,
          updated_at: new Date().toISOString()
        }, { onConflict: 'teacher_id,date' });

      if (error) throw error;
      toast.success('Attendance record updated');
      setIsEditModalOpen(false);
      fetchAttendanceData();
    } catch (err) {
      toast.error('Failed to update: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadExcel = () => {
    window.open(`/api/export-excel?date=${selectedDate}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Attendance Records & Manual Override</h2>
          <p className="text-xs text-slate-500">View and adjust attendance for any date, mark exceptions or corrections</p>
        </div>
        <button
          onClick={handleDownloadExcel}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Export Excel for {selectedDate}</span>
        </button>
      </div>

      {/* Filter / Date Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <button
            onClick={fetchAttendanceData}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 text-xs"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search faculty..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <LoadingSpinner size="md" />
            <p className="text-xs text-slate-400 mt-2">Loading attendance records...</p>
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
                  <th className="py-3 px-4">Remarks</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(r => (
                  <tr key={r.teacher_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">{r.teacher_id}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{r.full_name}</td>
                    <td className="py-3 px-4 text-slate-600">{r.department}</td>
                    <td className="py-3 px-4 text-center font-mono">
                      {formatTime(r.in_time)}
                      {r.late_by_minutes > 0 && (
                        <span className="block text-[10px] text-amber-600 font-sans">
                          +{r.late_by_minutes}m late
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {formatTime(r.out_time)}
                      {r.early_out_by_minutes > 0 && (
                        <span className="block text-[10px] text-rose-500 font-sans">
                          -{r.early_out_by_minutes}m early
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-slate-700">
                      {formatHours(r.total_hours)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                        {r.mode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 italic text-[11px] max-w-[150px] truncate">
                      {r.remarks || '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openEditModal(r)}
                        className="px-2.5 py-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-blue-200 transition text-[11px] font-medium inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Attendance Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Attendance: ${selectedRecord?.full_name} (${selectedRecord?.teacher_id})`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Date</label>
            <input
              type="text"
              disabled
              value={selectedDate}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 text-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">IN Time</label>
              <input
                type="time"
                value={editFormData.in_time}
                onChange={(e) => setEditFormData({ ...editFormData, in_time: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">OUT Time</label>
              <input
                type="time"
                value={editFormData.out_time}
                onChange={(e) => setEditFormData({ ...editFormData, out_time: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Status</label>
            <select
              value={editFormData.status}
              onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Half Day">Half Day</option>
              <option value="Absent">Absent</option>
              <option value="On Leave">On Leave</option>
              <option value="Holiday">Holiday</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Reason / Remarks for Manual Edit *</label>
            <textarea
              required
              rows={3}
              value={editFormData.remarks}
              onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
              placeholder="e.g. WiFi router failure on 2nd floor, confirmed by HOD"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-60 font-semibold"
            >
              {saving ? 'Saving...' : 'Update Record'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

