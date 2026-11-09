import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../common/Modal';
import { Check, X, ShieldAlert, Clock, History, AlertCircle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

function formatTime(isoStr) {
  if (!isoStr) return '--:--';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export default function CorrectionManagement() {
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [processingId, setProcessingId] = useState(null);

  // Reject / Note Modal
  const [selectedCorrection, setSelectedCorrection] = useState(null);
  const [actionType, setActionType] = useState('Approve');
  const [adminNotes, setAdminNotes] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchCorrections = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/corrections?status=${statusFilter}`);
      if (!res.ok) throw new Error('Failed to load corrections');
      const data = await res.json();
      setCorrections(data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrections();
  }, [statusFilter]);

  const openActionModal = (corr, action) => {
    setSelectedCorrection(corr);
    setActionType(action);
    setAdminNotes(action === 'Approve' ? 'Approved based on CCTV/Staff room presence verification' : 'Reason not verified with HOD');
    setIsModalOpen(true);
  };

  const handleConfirmAction = async (e) => {
    e.preventDefault();
    if (!selectedCorrection) return;

    try {
      setProcessingId(selectedCorrection.id);
      const res = await fetch('/api/corrections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedCorrection.id,
          status: actionType === 'Approve' ? 'Approved' : 'Rejected',
          admin_notes: adminNotes,
          approved_by: 'Principal / Admin'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');

      toast.success(`Correction request ${actionType === 'Approve' ? 'Approved' : 'Rejected'}!`);
      setIsModalOpen(false);
      fetchCorrections();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Attendance Correction Requests & Disputes</h2>
          <p className="text-xs text-slate-500">
            Review faculty requests for accidental WiFi disconnects, forgot-to-check-in, or schedule adjustments
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl text-xs font-semibold shadow-sm">
          {['Pending', 'Approved', 'Rejected', 'All'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg transition ${statusFilter === tab
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Cards / Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <LoadingSpinner size="md" />
            <p className="text-xs text-slate-400 mt-2">Loading correction requests...</p>
          </div>
        ) : corrections.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No {statusFilter.toLowerCase()} correction requests found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Faculty Member</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Logged IN / OUT</th>
                  <th className="py-3 px-4">Requested IN / OUT</th>
                  <th className="py-3 px-4">Teacher Reason</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {corrections.map((corr) => {
                  const teacher = corr.teachers || {};
                  const originalAtt = corr.attendance || {};

                  return (
                    <tr key={corr.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{teacher.full_name || corr.teacher_id}</div>
                        <div className="text-[11px] text-slate-500">{teacher.department} • <span className="font-mono text-blue-600">{corr.teacher_id}</span></div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">{corr.date}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        <div>IN: {formatTime(originalAtt.in_time)}</div>
                        <div>OUT: {formatTime(originalAtt.out_time)}</div>
                      </td>
                      <td className="py-3 px-4 text-blue-900 font-mono font-bold">
                        <div>IN: {formatTime(corr.requested_in_time)}</div>
                        <div>OUT: {formatTime(corr.requested_out_time)}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs text-slate-700 leading-relaxed">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                          {corr.reason}
                        </div>
                        {corr.admin_notes && (
                          <div className="text-[10px] text-slate-400 mt-1 italic">
                            Admin Note: {corr.admin_notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${corr.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : corr.status === 'Rejected'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                        >
                          {corr.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {corr.status === 'Pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openActionModal(corr, 'Approve')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition flex items-center gap-1 shadow-sm"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => openActionModal(corr, 'Reject')}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded text-[11px] font-semibold transition flex items-center gap-1"
                            >
                              <X className="w-3 h-3" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            Reviewed by {corr.approved_by || 'Admin'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${actionType === 'Approve' ? 'Approve' : 'Reject'} Attendance Correction`}
      >
        <form onSubmit={handleConfirmAction} className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <p className="font-semibold text-slate-800">
              Faculty: {selectedCorrection?.teachers?.full_name} ({selectedCorrection?.teacher_id})
            </p>
            <p className="text-slate-600">Date: {selectedCorrection?.date}</p>
            <p className="text-slate-600 italic">Teacher's statement: "{selectedCorrection?.reason}"</p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Admin Verification Note (Logged in immutable Audit Trail) *
            </label>
            <textarea
              required
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g. Verified with teacher register, HOD signature, or campus gate logs"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processingId !== null}
              className={`px-4 py-2 text-white rounded-lg font-semibold transition shadow-sm ${actionType === 'Approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
            >
              {processingId ? 'Processing...' : `Confirm ${actionType}`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

