import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import { Plus, Search, Edit2, Trash2, Smartphone, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TeacherManagement() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedShift, setSelectedShift] = useState('All');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [formData, setFormData] = useState({
    teacher_id: '',
    full_name: '',
    department: '',
    designation: 'Assistant Professor',
    subject: '',
    phone: '',
    email: '',
    shift: 'Shift One',
    status: 'Active',
    role: 'teacher'
  });
  const [saving, setSaving] = useState(false);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('teachers')
        .select('*, devices(*)')
        .order('teacher_id', { ascending: true });
      if (error) throw error;
      setTeachers(data || []);
    } catch (err) {
      toast.error('Failed to load teachers: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const openAddModal = () => {
    setEditingTeacher(null);
    setFormData({
      teacher_id: `T0${teachers.length + 1}`.padStart(4, '0'),
      full_name: '',
      department: 'CSE',
      designation: 'Assistant Professor',
      subject: '',
      phone: '',
      email: '',
      shift: 'Shift One',
      status: 'Active',
      role: 'teacher'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      teacher_id: teacher.teacher_id,
      full_name: teacher.full_name,
      department: teacher.department,
      designation: teacher.designation || '',
      subject: teacher.subject || '',
      phone: teacher.phone || '',
      email: teacher.email,
      shift: teacher.shift || 'Shift One',
      status: teacher.status || 'Active',
      role: teacher.role || 'teacher'
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingTeacher) {
        const { error } = await supabase
          .from('teachers')
          .update(formData)
          .eq('teacher_id', editingTeacher.teacher_id);
        if (error) throw error;
        toast.success('Teacher updated successfully');
      } else {
        const { error } = await supabase
          .from('teachers')
          .insert([formData]);
        if (error) throw error;
        toast.success('Teacher registered successfully');
      }
      setIsModalOpen(false);
      fetchTeachers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (teacherId) => {
    if (!window.confirm(`Are you sure you want to delete teacher ${teacherId}? This will remove all their records.`)) {
      return;
    }
    try {
      const { error } = await supabase.from('teachers').delete().eq('teacher_id', teacherId);
      if (error) throw error;
      toast.success(`Teacher ${teacherId} removed`);
      fetchTeachers();
    } catch (err) {
      toast.error('Delete failed: ' + err.message);
    }
  };

  const departments = ['All', ...new Set(teachers.map(t => t.department).filter(Boolean))];

  const filteredTeachers = teachers.filter(t => {
    const matchesSearch =
      t.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.teacher_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'All' || t.department === selectedDept;
    const matchesShift = selectedShift === 'All' || t.shift === selectedShift;
    return matchesSearch && matchesDept && matchesShift;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Faculty Management</h2>
          <p className="text-xs text-slate-500">
            Add, update, assign shifts, and manage faculty credentials & mobile devices
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Faculty Member</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, ID, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Shift Filter */}
          <select
            value={selectedShift}
            onChange={(e) => setSelectedShift(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="All">All Shifts</option>
            <option value="Shift One">Shift One (07:15 - 12:30)</option>
            <option value="Shift Two">Shift Two (12:30 - 17:00)</option>
            <option value="Both">Both Shifts</option>
          </select>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept === 'All' ? 'All Departments' : dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Teachers Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center">
            <LoadingSpinner size="md" />
            <p className="text-xs text-slate-400 mt-2">Loading faculty list...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Faculty Name</th>
                  <th className="py-3 px-4">Assigned Shift</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Registered Mobile</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No faculty members found
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((t) => {
                    const dev = t.devices && t.devices.length > 0 ? t.devices[0] : null;
                    return (
                      <tr key={t.teacher_id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {t.teacher_id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{t.full_name}</div>
                          <div className="text-[11px] text-slate-400">{t.designation || 'Faculty'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            t.shift === 'Shift Two'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : t.shift === 'Both'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {t.shift || 'Shift One'}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {t.shift === 'Shift Two'
                              ? '12:30 - 17:00'
                              : t.shift === 'Both'
                              ? 'Both Shifts'
                              : '07:15 - 12:30'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800 font-medium">{t.department}</div>
                          <div className="text-[11px] text-slate-400">{t.subject || '-'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800">{t.email}</div>
                          <div className="text-[11px] text-slate-400">{t.phone || '-'}</div>
                        </td>
                        <td className="py-3 px-4">
                          {dev ? (
                            <div className="flex items-center gap-1.5">
                              <Smartphone className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                              <div>
                                <span className="font-medium text-slate-800 block">{dev.mobile_name || 'Mobile Phone'}</span>
                                <span className="text-[10px] font-mono text-slate-400 block">{dev.mac_address || dev.mobile_model || '-'}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No device bound</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              t.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {t.status === 'Active' ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <XCircle className="w-3 h-3 text-slate-400" />
                            )}
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            onClick={() => openEditModal(t)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                            title="Edit Teacher"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(t.teacher_id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Delete Teacher"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTeacher ? 'Edit Teacher Details' : 'Add New Faculty Member'}
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Teacher ID *</label>
              <input
                type="text"
                required
                disabled={!!editingTeacher}
                value={formData.teacher_id}
                onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="e.g. Dr. Rajesh Kumar"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Department *</label>
              <input
                type="text"
                required
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g. AI/ML, CSE, ECE"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Designation</label>
              <input
                type="text"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="e.g. Assistant Professor"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="e.g. Machine Learning"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. 9876543210"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Email *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g. teacher@school.com"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Assigned Shift Selection */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">Assigned Shift *</label>
            <select
              value={formData.shift}
              onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-blue-300 bg-blue-50/50 font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="Shift One">Shift One (07:15 AM to 12:30 PM — 5h 15m)</option>
              <option value="Shift Two">Shift Two (12:30 PM to 05:00 PM — 4h 30m)</option>
              <option value="Both">Both Shifts (Shift One + Shift Two — 2 records/day)</option>
            </select>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Teachers assigned "Both" will have separate daily attendance records for each shift.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="teacher">Teacher</option>
                <option value="admin">Admin / HOD</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm transition disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingTeacher ? 'Update Teacher' : 'Register Teacher'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
