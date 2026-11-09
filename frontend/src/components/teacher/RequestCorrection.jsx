import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import LoadingSpinner from '../common/LoadingSpinner';
import { FileEdit, Send, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

function todayIST() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function RequestCorrection() {
  const { teacherProfile } = useAuth();
  const teacherId = teacherProfile?.teacher_id || 'T001';

  const [date, setDate] = useState(todayIST());
  const [requestedIn, setRequestedIn] = useState('09:00');
  const [requestedOut, setRequestedOut] = useState('16:00');
  const [reason, setReason] = useState('');
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const quickReasons = [
    'I turned off WiFi by mistake, I was in school till 04:00 PM.',
    'WiFi network was down on 2nd floor; signed physical register with HOD.',
    'Moving between laboratories caused WiFi disconnect.',
    'Battery drained on campus; phone recharged at 02:00 PM.'
  ];

  const fetchMyCorrections = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/corrections?teacher_id=${teacherId}`);
      if (!res.ok) throw new Error('Failed to load correction history');
      const data = await res.json();
      setCorrections(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (teacherId) fetchMyCorrections();
  }, [teacherId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !reason.trim()) {
      toast.error('Please specify the date and reason for correction');
      return;
    }

    setSubmitting(true);
    try {
      const inIso = requestedIn ? `${date}T${requestedIn}:00+05:30` : null;
      const outIso = requestedOut ? `${date}T${requestedOut}:00+05:30` : null;

      const res = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: teacherId,
          date,
          requested_in_time: inIso,
          requested_out_time: outIso,
          reason
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request');

      toast.success('Correction request submitted! Admin will review and update attendance.');
      setReason('');
      fetchMyCorrections();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Attendance Disputes & Corrections</h2>
        <p className="text-xs text-slate-500">
          Turned off WiFi by mistake or had signal issues? Submit a correction request with proof for Admin approval.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold text-sm">
            <FileEdit className="w-4 h-4 text-blue-600" />
            <span>Submit Correction Request</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Date of Attendance *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Actual IN Time</label>
                <input
                  type="time"
                  value={requestedIn}
                  onChange={(e) => setRequestedIn(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Actual OUT Time</label>
                <input
                  type="time"
                  value={requestedOut}
                  onChange={(e) => setRequestedOut(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reason for Dispute / Correction *</label>
              <textarea
                required
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain what happened: e.g. WiFi turned off by mistake, was in staff room until 04:00 PM."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Quick Reason Pills */}
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase block mb-1.5">
                Quick Preset Statements:
              </span>
              <div className="space-y-1">
                {quickReasons.map((qr, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setReason(qr)}
                    className="text-left w-full text-[11px] p-1.5 rounded bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-100 transition line-clamp-1"
                  >
                    "{qr}"
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Submitting...' : 'Send to Principal / Admin'}</span>
            </button>
          </form>
        </div>

        {/* Requests History List */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <h3 className="font-bold text-sm text-slate-800">Your Submitted Correction Requests</h3>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <LoadingSpinner size="md" />
            </div>
          ) : corrections.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No correction requests submitted yet
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {corrections.map((c) => (
                <div key={c.id} className="p-4 space-y-2 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 font-mono">{c.date}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${c.status === 'Approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : c.status === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    "{c.reason}"
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>
                      Requested: IN {c.requested_in_time ? new Date(c.requested_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'} •
                      OUT {c.requested_out_time ? new Date(c.requested_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </span>
                    {c.admin_notes && (
                      <span className="text-blue-600 font-medium italic">
                        Note: {c.admin_notes}
                      </span>
                    )}
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

