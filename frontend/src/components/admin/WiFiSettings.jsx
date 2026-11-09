import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../common/LoadingSpinner';
import { Wifi, Save, ShieldAlert, CheckCircle2, Sliders, Info, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WiFiSettings() {
  const [settings, setSettings] = useState({
    campus_ssid: 'Woxsen_Campus_WiFi',
    allowed_bssid_list: ['AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:02'],
    campus_ip_range: '192.168.1.0/24',
    campus_lat: 17.5449,
    campus_lng: 78.5718,
    geofence_radius_meters: 200,
    shift_one_start: '07:15:00',
    shift_one_end: '12:30:00',
    shift_two_start: '12:30:00',
    shift_two_end: '17:00:00',
    grace_minutes: 10,
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
        setSettings({
          ...data,
          shift_one_start: data.shift_one_start || '07:15:00',
          shift_one_end: data.shift_one_end || '12:30:00',
          shift_two_start: data.shift_two_start || '12:30:00',
          shift_two_end: data.shift_two_end || '17:00:00',
          grace_minutes: data.grace_minutes !== undefined ? data.grace_minutes : 10
        });
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

      toast.success('Campus WiFi & Two-Shift timing rules saved successfully!');
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
        <h2 className="text-xl font-bold text-slate-800">Campus WiFi & Shift Timing Rules</h2>
        <p className="text-xs text-slate-500">
          Configure Two-Shift schedules, grace periods, campus WiFi SSIDs, BSSIDs, and geofence
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
              <div className="mt-4 pt-4 border-t border-amber-200/60 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <label className="text-xs font-semibold text-amber-900">Demo Test WiFi SSID:</label>
                <input
                  type="text"
                  value={settings.demo_ssid}
                  onChange={(e) => setSettings({ ...settings, demo_ssid: e.target.value })}
                  placeholder="e.g. Test_Campus_WiFi"
                  className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-mono font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 w-full sm:w-64"
                />
              </div>
            )}
          </div>

          {/* Two Shift Timings Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Two-Shift Timings & Grace Period Rules</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                Active Two Shifts
              </span>
            </div>

            {/* Shift One Config */}
            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900 text-xs">Shift One (Morning)</span>
                <span className="text-[11px] text-blue-700 font-medium">Duration: 5h 15m</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={settings.shift_one_start?.slice(0, 5) || '07:15'}
                    onChange={(e) => setSettings({ ...settings, shift_one_start: `${e.target.value}:00` })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">Scheduled: 07:15 AM</span>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={settings.shift_one_end?.slice(0, 5) || '12:30'}
                    onChange={(e) => setSettings({ ...settings, shift_one_end: `${e.target.value}:00` })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">Scheduled: 12:30 PM</span>
                </div>
              </div>
            </div>

            {/* Shift Two Config */}
            <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-900 text-xs">Shift Two (Afternoon)</span>
                <span className="text-[11px] text-indigo-700 font-medium">Duration: 4h 30m</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={settings.shift_two_start?.slice(0, 5) || '12:30'}
                    onChange={(e) => setSettings({ ...settings, shift_two_start: `${e.target.value}:00` })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">Scheduled: 12:30 PM</span>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={settings.shift_two_end?.slice(0, 5) || '17:00'}
                    onChange={(e) => setSettings({ ...settings, shift_two_end: `${e.target.value}:00` })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">Scheduled: 05:00 PM (17:00)</span>
                </div>
              </div>
            </div>

            {/* Grace Period */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Grace Period (Minutes) — Applies to Both Shifts
              </label>
              <input
                type="number"
                min="0"
                max="60"
                value={settings.grace_minutes}
                onChange={(e) => setSettings({ ...settings, grace_minutes: parseInt(e.target.value, 10) || 0 })}
                className="w-full sm:w-48 px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Shift One Late cutoff: 07:25 AM • Shift Two Late cutoff: 12:40 PM
              </span>
            </div>

            {/* Rules Summary Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-[11px] text-slate-700">
              <p className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                <Info className="w-4 h-4 text-blue-600" />
                Automated Shift Attendance Rules:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li><strong>Shift One:</strong> IN after 07:25 AM = Late (minutes after 07:25 AM). OUT before 12:30 PM = Early Out. Total hours &lt; 2h 30m = Half Day.</li>
                <li><strong>Shift Two:</strong> IN after 12:40 PM = Late (minutes after 12:40 PM). OUT before 05:00 PM = Early Out. Total hours &lt; 2h 15m = Half Day.</li>
                <li><strong>Both Shifts:</strong> Auto OUT at 12:30 PM for Shift One and Auto IN at 12:30 PM for Shift Two. Never merged.</li>
                <li><strong>WiFi Disconnect:</strong> 15-minute grace period before marking OUT. Warning sent every 5 minutes. GPS on-campus avoids OUT.</li>
              </ul>
            </div>
          </div>

          {/* Network Security Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-3">
              <Wifi className="w-4 h-4 text-blue-600" />
              <span>Campus Network & Access Point Whitelist</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Campus WiFi SSID *
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

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs flex items-center gap-2 shadow-sm transition disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save All Settings'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
