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
    shift_start: '09:00:00',
    shift_end: '16:00:00',
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
      shift_start: '09:00:00',
      shift_end: '16:00:00',
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
      shift_start: teacher.shift_start || '09:00:00',
      shift_end: teacher.shift_end || '16:00:00',
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
        // Update
        const { error } = await supabase
          .from('teachers')
          .update(formData)
          .eq('teacher_id', editingTeacher.teacher_id);
        if (error) throw error;
        toast.success('Teacher updated successfully');
      } else {
        // Insert
        const { error } = await supabase
          .from('teachers')
          .insert([formData]);
        if (error) throw error;
        toast.success('Teacher added successfully');
      }
      setIsModalOpen(false);
      fetchTeachers();
    } catch (err) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (teacher_id) => {
    if (!window.confirm(`Are you sure you want to delete teacher ${teacher_id}? This will remove attendance history and device records.`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from('teachers')
        .delete()
        .eq('teacher_id', teacher_id);
      if (error) throw error;
      toast.success('Teacher deleted successfully');
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
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Faculty & Teacher Management</h2>
          <p className="text-xs text-slate-500">Add, edit, or configure teachers, designations, and shifts</p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Teacher</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, ID, or email..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs text-slate-500 font-medium">Department:</label>
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

      {/* Teachers Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <LoadingSpinner size="md" />
            <p className="text-xs text-slate-400 mt-2">Loading teachers list...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Teacher Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Registered Device</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-slate-400">
                      No teachers found
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((t) => {
                    const dev = t.devices?.[0];
                    return (
                      <tr key={t.id || t.teacher_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-600">{t.teacher_id}</td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {t.full_name}
                          {t.role === 'admin' && (
                            <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 font-semibold px-1.5 py-0.5 rounded">
                              Admin
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">{t.department}</td>
                        <td className="py-3 px-4 text-slate-500">{t.designation || '-'}</td>
                        <td className="py-3 px-4 text-slate-500">{t.subject || '-'}</td>
                        <td className="py-3 px-4 text-slate-500">
                          <div>{t.email}</div>
                          <div className="text-[10px] text-slate-400">{t.phone || '-'}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {dev ? (
                            <div className="flex items-center gap-1.5">
                              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                              <div>
                                <span className="font-medium text-slate-700">{dev.mobile_name}</span>
                                <span className="block font-mono text-[10px] text-slate-400">{dev.mac_address}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No device registered</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              t.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {t.status === 'Active' ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Shift Start Time</label>
              <input
                type="time"
                value={formData.shift_start}
                onChange={(e) => setFormData({ ...formData, shift_start: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Shift End Time</label>
              <input
                type="time"
                value={formData.shift_end}
                onChange={(e) => setFormData({ ...formData, shift_end: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
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
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-60 font-semibold"
            >
              {saving ? 'Saving...' : 'Save Teacher'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
