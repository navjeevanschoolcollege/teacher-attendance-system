import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../common/LoadingSpinner';
import { CalendarDays, Send, Clock, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ApplyLeave() {
  const { teacherProfile } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const teacherId = teacherProfile?.teacher_id || 'T001';

  const fetchMyLeaves = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leaves')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeaves(data || []);
    } catch (err) {
      console.error('Error fetching my leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (teacherId) {
      fetchMyLeaves();
    }
  }, [teacherId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fromDate || !toDate || !reason) {
      toast.error('Please fill all required fields');
      return;
    }
    if (new Date(fromDate) > new Date(toDate)) {
      toast.error('From Date cannot be later than To Date');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('leaves').insert([
        {
          teacher_id: teacherId,
          from_date: fromDate,
          to_date: toDate,
          reason,
          status: 'Pending'
        }
      ]);

      if (error) throw error;
      toast.success('Leave application submitted successfully!');
      setFromDate('');
      setToDate('');
      setReason('');
      fetchMyLeaves();
    } catch (err) {
      toast.error('Failed to submit leave: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Leave Applications</h2>
        <p className="text-xs text-slate-500">Apply for casual, medical, or academic leave and track status</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leave Form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold text-sm">
            <CalendarDays className="w-4 h-4 text-emerald-600" />
            <span>Apply for Leave</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">From Date *</label>
              <input
                type="date"
                required
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">To Date *</label>
              <input
                type="date"
                required
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reason for Leave *</label>
              <textarea
                required
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Attending International Conference on AI / Personal Medical appointment"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Submitting...' : 'Submit Application'}</span>
            </button>
          </form>
        </div>

        {/* My Leaves History */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <h3 className="font-bold text-sm text-slate-800">My Leave Applications</h3>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <LoadingSpinner size="md" />
            </div>
          ) : leaves.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No leave applications submitted yet
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {leaves.map((l) => (
                <div key={l.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800">
                        {l.from_date} to {l.to_date}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          l.status === 'Approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : l.status === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {l.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{l.reason}</p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Applied on: {new Date(l.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

