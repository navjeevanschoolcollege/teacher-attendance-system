import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../common/LoadingSpinner';
import { Wifi, Save, ShieldAlert, CheckCircle2, Sliders, Info } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WiFiSettings() {
  const [settings, setSettings] = useState({
    campus_ssid: 'Woxsen_Campus_WiFi',
    allowed_bssid_list: ['AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:02'],
    campus_ip_range: '192.168.1.0/24',
    start_time: '09:00:00',
    grace_minutes: 10,
    end_time: '16:00:00',
    demo_mode: true,
    demo_ssid: 'Test_Campus_WiFi'
  });
  const [bssidText, setBssidText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('wifi_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSettings(data);
        setBssidText((data.allowed_bssid_list || []).join('\n'));
      }
    } catch (err) {
      toast.error('Failed to load settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const bssids = bssidText
        .split('\n')
        .map(b => b.trim())
        .filter(Boolean);

      const payload = {
        ...settings,
        allowed_bssid_list: bssids,
        updated_at: new Date().toISOString()
      };

      let query;
      if (settings.id) {
        query = supabase.from('wifi_settings').update(payload).eq('id', settings.id);
      } else {
        query = supabase.from('wifi_settings').insert([payload]);
      }

      const { error } = await query;
      if (error) throw error;

      toast.success('WiFi & shift settings saved successfully!');
      fetchSettings();
    } catch (err) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Campus WiFi & Timing Rules</h2>
        <p className="text-xs text-slate-500">
          Configure approved campus WiFi SSIDs, BSSIDs, IP subnet ranges, and attendance rules
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-xl">
          <LoadingSpinner size="md" />
          <p className="text-xs text-slate-400 mt-2">Loading settings...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Demo Mode Toggle Card */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-sm text-amber-900">Demo Testing Mode</h3>
                </div>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  When enabled, web manual check-ins are allowed from ANY IP address, and mobile app allows the test SSID{' '}
                  <span className="font-mono font-bold">{settings.demo_ssid}</span> for hassle-free evaluation.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.demo_mode}
                  onChange={(e) => setSettings({ ...settings, demo_mode: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {settings.demo_mode && (
              <div className="mt-4 pt-3 border-t border-amber-200">
                <label className="block text-xs font-semibold text-amber-900 mb-1">Demo WiFi SSID</label>
                <input
                  type="text"
                  value={settings.demo_ssid || 'Test_Campus_WiFi'}
                  onChange={(e) => setSettings({ ...settings, demo_ssid: e.target.value })}
                  className="w-full sm:w-72 px-3 py-1.5 text-xs rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
            )}
          </div>

          {/* Campus WiFi Settings Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-3">
              <Wifi className="w-4 h-4 text-blue-600" />
              <span>Campus Wireless Network Parameters</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Primary Campus WiFi SSID *
                </label>
                <input
                  type="text"
                  required
                  value={settings.campus_ssid}
                  onChange={(e) => setSettings({ ...settings, campus_ssid: e.target.value })}
                  placeholder="e.g. Woxsen_Campus_WiFi"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Exact case-sensitive name of the campus Wi-Fi
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Campus IP Subnet (CIDR) *
                </label>
                <input
                  type="text"
                  required
                  value={settings.campus_ip_range}
                  onChange={(e) => setSettings({ ...settings, campus_ip_range: e.target.value })}
                  placeholder="e.g. 192.168.1.0/24 or 10.0.0.0/16"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Used by serverless function to verify web check-in requests
                </span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Approved Access Point BSSIDs (MACs) — One per line
              </label>
              <textarea
                rows={3}
                value={bssidText}
                onChange={(e) => setBssidText(e.target.value)}
                placeholder="AA:BB:CC:DD:EE:01&#10;AA:BB:CC:DD:EE:02"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-xs"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Leave empty to allow any Access Point broadcasting the campus SSID
              </span>
            </div>
          </div>

          {/* Shift Timing Rules Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-3">
              <Sliders className="w-4 h-4 text-blue-600" />
              <span>Shift Timing & Attendance Thresholds</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Shift Start Time
                </label>
                <input
                  type="time"
                  value={settings.start_time?.slice(0, 5) || '09:00'}
                  onChange={(e) => setSettings({ ...settings, start_time: `${e.target.value}:00` })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Default: 09:00 AM</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Grace Period (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={settings.grace_minutes}
                  onChange={(e) => setSettings({ ...settings, grace_minutes: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Check-in after 09:10 AM marked as Late
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Shift Closing Time
                </label>
                <input
                  type="time"
                  value={settings.end_time?.slice(0, 5) || '16:00'}
                  onChange={(e) => setSettings({ ...settings, end_time: `${e.target.value}:00` })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Default: 04:00 PM</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 text-[11px] space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                Automatic Evaluation Rules:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-blue-700">
                <li>IN Time &gt; 09:10 AM = <strong>Late</strong> (calculates late by minutes)</li>
                <li>OUT Time &lt; 04:00 PM = <strong>Early Out</strong> (calculates early out by minutes)</li>
                <li>Total Working Hours &lt; 4 hours = <strong>Half Day</strong></li>
                <li>No WiFi connection all day = <strong>Absent</strong></li>
                <li>Disconnected for &gt; 15 continuous minutes = marks final <strong>OUT Time</strong></li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
