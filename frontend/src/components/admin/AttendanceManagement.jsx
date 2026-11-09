import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import StatusBadge from '../common/StatusBadge';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import { Calendar, Search, Edit3, FileSpreadsheet, RefreshCw, Filter } from 'lucide-react';
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
  const [selectedShift, setSelectedShift] = useState('All');
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
      const { data: teacherList, error: tErr } = await supabase
        .from('teachers')
        .select('*, devices(*)')
        .eq('status', 'Active');
      if (tErr) throw tErr;
      setTeachers(teacherList || []);

      let attQuery = supabase
        .from('attendance')
        .select('*')
        .eq('date', selectedDate);

      if (selectedShift !== 'All') {
        attQuery = attQuery.eq('shift', selectedShift);
      }

      const { data: attList, error: aErr } = await attQuery;
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
  }, [selectedDate, selectedShift]);

  const departments = ['All', ...new Set(teachers.map(t => t.department).filter(Boolean))];

  // Map of attendance by `${teacher_id}_${shift}`
  const attMap = new Map();
  attendance.forEach(a => attMap.set(`${a.teacher_id}_${a.shift || 'Shift One'}`, a));

  const mergedRecords = [];
  teachers.forEach(t => {
    const assignedShift = t.shift || 'Shift One';
    const shiftsToEvaluate = assignedShift === 'Both' ? ['Shift One', 'Shift Two'] : [assignedShift];

    shiftsToEvaluate.forEach(currentShift => {
      if (selectedShift === 'All' || selectedShift === currentShift) {
        const att = attMap.get(`${t.teacher_id}_${currentShift}`);
        mergedRecords.push({
          teacher_id: t.teacher_id,
          full_name: t.full_name,
          department: t.department,
          designation: t.designation,
          shift: currentShift,
          assigned_shift: assignedShift,
          device: t.devices?.[0] || null,
          id: att?.id || null,
          date: selectedDate,
          in_time: att?.in_time || null,
          out_time: att?.out_time || null,
          total_hours: att?.total_hours || 0,
          status: att ? att.status : 'Absent',
          late_by_minutes: att?.late_by_minutes || 0,
          early_out_by_minutes: att?.early_out_by_minutes || 0,
          mode: att?.mode || (att ? 'Auto-WiFi' : '-'),
          ssid: att?.ssid || null,
          remarks: att?.remarks || null
        });
      }
    });
  });

  const filteredRecords = mergedRecords.filter(r => {
    const matchesSearch =
      r.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.teacher_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'All' || r.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  const openEditModal = (record) => {
    setSelectedRecord(record);
    const inVal = record.in_time ? new Date(record.in_time).toISOString().slice(11, 16) : '';
    const outVal = record.out_time ? new Date(record.out_time).toISOString().slice(11, 16) : '';
    setEditFormData({
      in_time: inVal,
      out_time: outVal,
      status: record.status || 'Present',
      remarks: record.remarks || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const inISO = editFormData.in_time
        ? `${selectedDate}T${editFormData.in_time}:00+05:30`
        : null;
      const outISO = editFormData.out_time
        ? `${selectedDate}T${editFormData.out_time}:00+05:30`
        : null;

      let hrs = 0;
      if (inISO && outISO) {
        hrs = Math.max(0, Number(((new Date(outISO) - new Date(inISO)) / (1000 * 60 * 60)).toFixed(2)));
      }

      const payload = {
        teacher_id: selectedRecord.teacher_id,
        date: selectedDate,
        shift: selectedRecord.shift,
        in_time: inISO,
        out_time: outISO,
        total_hours: hrs,
        status: editFormData.status,
        mode: 'Admin',
        remarks: editFormData.remarks || 'Manual adjustment by admin',
        updated_at: new Date().toISOString()
      };

      if (selectedRecord.id) {
        const { error } = await supabase
          .from('attendance')
          .update(payload)
          .eq('id', selectedRecord.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('attendance')
          .insert([payload]);
        if (error) throw error;
      }

      toast.success('Attendance record updated');
      setIsEditModalOpen(false);
      fetchAttendanceData();
    } catch (err) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Two-Shift Attendance Management</h2>
          <p className="text-xs text-slate-500">
            View, audit, filter by shift, and manually correct daily attendance
          </p>
        </div>

        <button
          onClick={fetchAttendanceData}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 text-xs flex items-center gap-1 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Date Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Date Picker */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent focus:outline-none font-medium text-slate-800"
            />
          </div>

          {/* Shift Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Shift:</span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
              {['All', 'Shift One', 'Shift Two'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedShift(s)}
                  className={`px-3 py-1 rounded-md transition ${
                    selectedShift === s
                      ? 'bg-white text-blue-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search and Dept */}
        <div className="flex items-center gap-3 w-full md:w-auto">
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
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center">
            <LoadingSpinner size="md" />
            <p className="text-xs text-slate-400 mt-2">Loading attendance records...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Faculty</th>
                  <th className="py-3 px-4">Shift</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">IN Time</th>
                  <th className="py-3 px-4">OUT Time</th>
                  <th className="py-3 px-4">Total Hours</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Late / Early</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No records found for the selected date and filters
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r, idx) => (
                    <tr key={`${r.teacher_id}_${r.shift}_${idx}`} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{r.full_name}</div>
                        <div className="text-[11px] font-mono text-slate-400">{r.teacher_id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          r.shift === 'Shift Two'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {r.shift}
                        </span>
                        {r.assigned_shift === 'Both' && (
                          <div className="text-[10px] text-slate-400 mt-0.5">Assigned: Both</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-medium">{r.department}</div>
                        <div className="text-[11px] text-slate-400">{r.designation || '-'}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        {formatTime(r.in_time)}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        {formatTime(r.out_time)}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {formatHours(r.total_hours)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        {r.late_by_minutes > 0 && (
                          <span className="text-amber-600 font-medium block">
                            Late: +{r.late_by_minutes}m
                          </span>
                        )}
                        {r.early_out_by_minutes > 0 && (
                          <span className="text-rose-600 font-medium block">
                            Early: -{r.early_out_by_minutes}m
                          </span>
                        )}
                        {r.late_by_minutes === 0 && r.early_out_by_minutes === 0 && (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        {r.mode}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openEditModal(r)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                          title="Edit Record"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Adjust Attendance: ${selectedRecord?.full_name} (${selectedRecord?.shift})`}
      >
        <form onSubmit={handleEditSave} className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="font-semibold text-slate-800">{selectedRecord?.full_name} ({selectedRecord?.teacher_id})</p>
            <p className="text-[11px] text-slate-500">
              Date: {selectedDate} • Shift: <span className="font-bold text-blue-700">{selectedRecord?.shift}</span>
            </p>
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
            <label className="block font-medium text-slate-700 mb-1">Remarks / Audit Reason</label>
            <textarea
              rows={2}
              value={editFormData.remarks}
              onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
              placeholder="e.g. Approved manual adjustment for network issue"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm transition disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Update Record'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
