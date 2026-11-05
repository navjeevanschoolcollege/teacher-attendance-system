import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../common/LoadingSpinner';
import { Smartphone, CheckCircle, XCircle, Search, ShieldCheck, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DeviceManagement() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('devices')
        .select('*, teachers(full_name, department, email)')
        .order('registered_at', { ascending: false });
      if (error) throw error;
      setDevices(data || []);
    } catch (err) {
      toast.error('Failed to load devices: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleToggleApproval = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('devices')
        .update({ is_approved: !currentStatus })
        .eq('id', id);
      if (error) throw error;
      toast.success(`Device ${!currentStatus ? 'Approved' : 'Blocked'}`);
      fetchDevices();
    } catch (err) {
      toast.error('Update failed: ' + err.message);
    }
  };

  const filteredDevices = devices.filter(d => {
    const t = d.teachers || {};
    return (
      (t.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.teacher_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.mobile_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.mac_address || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Faculty Device Management</h2>
          <p className="text-xs text-slate-500">Manage approved Android/iOS devices for 1 Teacher = 1 Mobile security</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search teacher, device model, or MAC address..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Devices Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <LoadingSpinner size="md" />
            <p className="text-xs text-slate-400 mt-2">Loading devices...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Teacher</th>
                  <th className="py-3 px-4">Mobile Name</th>
                  <th className="py-3 px-4">Model & OS</th>
                  <th className="py-3 px-4">MAC Address</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Registered Date</th>
                  <th className="py-3 px-4 text-center">Approval Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-400">
                      No registered devices found
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{d.teachers?.full_name || '-'}</div>
                        <div className="font-mono text-[10px] text-blue-600">{d.teacher_id}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700 flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-slate-400" />
                        <span>{d.mobile_name || '-'}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>{d.mobile_model || '-'}</div>
                        <div className="text-[10px] text-slate-400">{d.os_version || '-'}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">{d.mac_address || '-'}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{d.ip_address || '-'}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {d.registered_at ? new Date(d.registered_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            d.is_approved
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {d.is_approved ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                          {d.is_approved ? 'Approved' : 'Blocked'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleToggleApproval(d.id, d.is_approved)}
                          className={`px-3 py-1 rounded text-xs font-semibold transition ${
                            d.is_approved
                              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {d.is_approved ? 'Block' : 'Approve'}
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
    </div>
  );
}
