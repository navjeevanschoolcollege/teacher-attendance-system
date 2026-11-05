import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../common/LoadingSpinner';
import { Sun, Plus, Trash2, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export default function HolidayManagement() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('date', { ascending: true });
      if (error) throw error;
      setHolidays(data || []);
    } catch (err) {
      toast.error('Failed to load holidays: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!date || !title) {
      toast.error('Please enter both date and title');
      return;
    }
    setSaving(true);
    try {
      // Insert holiday
      const { error: hErr } = await supabase
        .from('holidays')
        .insert([{ date, title }]);
      if (hErr) throw hErr;

      // Update attendance for all active teachers on that date
      const { data: teachers } = await supabase.from('teachers').select('teacher_id').eq('status', 'Active');
      if (teachers && teachers.length > 0) {
        const records = teachers.map(t => ({
          teacher_id: t.teacher_id,
          date,
          status: 'Holiday',
          mode: 'Admin',
          remarks: title
        }));
        await supabase.from('attendance').upsert(records, { onConflict: 'teacher_id,date' });
      }

      toast.success('Holiday added and applied to attendance!');
      setDate('');
      setTitle('');
      fetchHolidays();
    } catch (err) {
      toast.error('Failed to add holiday: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, holidayDate) => {
    if (!window.confirm(`Delete holiday on ${holidayDate}?`)) return;
    try {
      const { error } = await supabase.from('holidays').delete().eq('id', id);
      if (error) throw error;
      toast.success('Holiday removed');
      fetchHolidays();
    } catch (err) {
      toast.error('Delete failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Academic Calendar & Holidays</h2>
        <p className="text-xs text-slate-500">Declare school/college holidays to automatically mark attendance as Holiday</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Holiday Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold text-sm">
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Add Campus Holiday</span>
          </div>

          <form onSubmit={handleAddHoliday} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Holiday Title / Occasion *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Independence Day, Diwali, Founder's Day"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Add Holiday'}</span>
            </button>
          </form>
        </div>

        {/* Holidays List */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <h3 className="font-bold text-sm text-slate-800">Declared Holidays List</h3>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <LoadingSpinner size="md" />
              <p className="text-xs text-slate-400 mt-2">Loading holidays...</p>
            </div>
          ) : holidays.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No holidays declared yet
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {holidays.map(h => (
                <div key={h.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">{h.title}</h4>
                      <p className="text-xs font-mono text-slate-500">
                        {new Date(h.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(h.id, h.date)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Delete Holiday"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

