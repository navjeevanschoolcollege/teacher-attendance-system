import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../common/LoadingSpinner';
import { Check, X, CalendarDays, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LeaveManagement() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [processingId, setProcessingId] = useState(null);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leaves')
        .select('*, teachers(full_name, department, email)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLeaves(data || []);
    } catch (err) {
      toast.error('Failed to load leaves: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleUpdateStatus = async (leave, newStatus) => {
    try {
      setProcessingId(leave.id);
      // Update leave status
      const { error: lErr } = await supabase
        .from('leaves')
        .update({ status: newStatus, approved_by: 'Administrator' })
        .eq('id', leave.id);
      if (lErr) throw lErr;

      // If approved, update attendance table for dates in range to 'On Leave'
      if (newStatus === 'Approved') {
        const start = new Date(leave.from_date);
        const end = new Date(leave.to_date);
        const cur = new Date(start);

        while (cur <= end) {
          const dateStr = cur.toISOString().slice(0, 10);
          // Only for weekdays
          if (cur.getDay() !== 0 && cur.getDay() !== 6) {
            await supabase.from('attendance').upsert({
              teacher_id: leave.teacher_id,
              date: dateStr,
              status: 'On Leave',
              mode: 'Admin',
              remarks: `Approved Leave: ${leave.reason || 'Personal'}`
            }, { onConflict: 'teacher_id,date' });
          }
          cur.setDate(cur.getDate() + 1);
        }
      }

      toast.success(`Leave application marked as ${newStatus}`);
      fetchLeaves();
    } catch (err) {
      toast.error('Failed to update leave: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = leaves.filter(l => {
    if (statusFilter === 'All') return true;
    return l.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Faculty Leave Applications</h2>
          <p className="text-xs text-slate-500">Review, approve, or reject leave requests from faculty members</p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-lg text-xs shadow-sm">
          {['All', 'Pending', 'Approved', 'Rejected'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-md font-medium transition ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Leaves Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <LoadingSpinner size="md" />
            <p className="text-xs text-slate-400 mt-2">Loading leave applications...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Faculty Member</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">From Date</th>
                  <th className="py-3 px-4">To Date</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400">
                      No leave requests found
                    </td>
                  </tr>
                ) : (
                  filtered.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{l.teachers?.full_name || '-'}</div>
                        <div className="font-mono text-[10px] text-blue-600">{l.teacher_id}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{l.teachers?.department || '-'}</td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">{l.from_date}</td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">{l.to_date}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs">{l.reason || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            l.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : l.status === 'Rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        {l.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(l, 'Approved')}
                              disabled={processingId === l.id}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition inline-flex items-center gap-1 shadow-sm disabled:opacity-50"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(l, 'Rejected')}
                              disabled={processingId === l.id}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded text-[11px] font-semibold transition inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              <X className="w-3 h-3" />
                              <span>Reject</span>
                            </button>
                          </>
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

