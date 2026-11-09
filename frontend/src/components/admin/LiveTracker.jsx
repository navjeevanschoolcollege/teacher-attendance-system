import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Compass,
  Radio,
  MapPin,
  Clock,
  ArrowRight,
  LogOut,
  LogIn,
  AlertTriangle,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  X,
  Users,
  CheckCircle2,
  Phone,
  Mail,
  Calendar,
  Wifi
} from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

export default function LiveTracker() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState('All');
  const [selectedDept, setSelectedDept] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Inside', 'Outside', 'Alerts'
  const [selectedTeacherForTimeline, setSelectedTeacherForTimeline] = useState(null);

  // Fetch live tracker data from API (or Supabase directly if offline)
  const fetchTrackerData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tracker?shift=${selectedShift}&department=${selectedDept}`);
      if (!res.ok) throw new Error('Failed to fetch live tracker');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.warn('API error, falling back to direct Supabase query:', err);
      // Fallback direct Supabase fetch
      await fetchDirectSupabase();
    } finally {
      setLoading(false);
    }
  };

  const fetchDirectSupabase = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: teachers } = await supabase.from('teachers').select('*').eq('status', 'Active');
    const { data: movements } = await supabase.from('movement_log').select('*').eq('date', today).order('event_time', { ascending: true });
    const { data: attendance } = await supabase.from('attendance').select('*').eq('date', today);

    const movesByTeacher = {};
    (movements || []).forEach(m => {
      if (!movesByTeacher[m.teacher_id]) movesByTeacher[m.teacher_id] = [];
      movesByTeacher[m.teacher_id].push(m);
    });

    const attMap = {};
    (attendance || []).forEach(a => {
      attMap[`${a.teacher_id}_${a.shift}`] = a;
    });

    let insideCount = 0;
    let outsideCount = 0;
    let alertCount = 0;

    const list = (teachers || []).map(t => {
      const moves = movesByTeacher[t.teacher_id] || [];
      const lastMove = moves.length > 0 ? moves[moves.length - 1] : null;
      const isInside = lastMove ? lastMove.event_type === 'IN' : false;
      if (isInside) insideCount++;
      else outsideCount++;

      const alerts = [];
      const totalExits = moves.filter(m => m.event_type === 'OUT').length;
      if (totalExits >= 3) {
        alerts.push({ type: 'FREQUENT_EXITS', message: `${totalExits} exits logged today (High campus movement)` });
      }

      let minsCurrent = 0;
      if (lastMove) {
        minsCurrent = Math.max(0, Math.floor((new Date() - new Date(lastMove.event_time)) / 60000));
      }

      if (alerts.length > 0) alertCount++;

      return {
        teacher_id: t.teacher_id,
        full_name: t.full_name,
        department: t.department,
        designation: t.designation,
        phone: t.phone,
        email: t.email,
        shift: t.shift || 'Shift One',
        presence_status: isInside ? 'Inside Campus' : 'Outside Campus',
        last_event_type: lastMove ? lastMove.event_type : 'NONE',
        last_event_time: lastMove ? lastMove.event_time : null,
        minutes_in_current_state: minsCurrent,
        total_entries: moves.filter(m => m.event_type === 'IN').length,
        total_exits: totalExits,
        total_in_campus_hours: attMap[`${t.teacher_id}_${t.shift}`]?.total_in_campus_hours || 0,
        total_out_break_hours: attMap[`${t.teacher_id}_${t.shift}`]?.total_out_break_hours || 0,
        attendance_status: attMap[`${t.teacher_id}_${t.shift}`]?.status || 'Not Checked In',
        movement_timeline: moves,
        alerts
      };
    });

    setData({
      summary: {
        total_teachers: teachers?.length || 0,
        inside_campus: insideCount,
        outside_campus: outsideCount,
        active_alerts: alertCount,
        total_events_today: movements?.length || 0
      },
      teachers: list
    });
  };

  useEffect(() => {
    fetchTrackerData();

    // Setup Supabase Realtime subscription for movement_log & attendance
    const channel = supabase
      .channel('live_tracker_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movement_log' },
        () => {
          fetchTrackerData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => {
          fetchTrackerData();
        }
      )
      .subscribe();

    const interval = setInterval(fetchTrackerData, 30000); // 30s auto-refresh

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [selectedShift, selectedDept]);

  // Filter teachers
  const filteredTeachers = (data?.teachers || []).filter(t => {
    if (selectedShift !== 'All' && t.shift !== selectedShift && t.shift !== 'Both') return false;
    if (selectedDept !== 'All' && t.department !== selectedDept) return false;
    if (statusFilter === 'Inside' && t.presence_status !== 'Inside Campus') return false;
    if (statusFilter === 'Outside' && t.presence_status !== 'Outside Campus') return false;
    if (statusFilter === 'Alerts' && (!t.alerts || t.alerts.length === 0)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = t.full_name?.toLowerCase().includes(q);
      const matchId = t.teacher_id?.toLowerCase().includes(q);
      const matchDept = t.department?.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchDept) return false;
    }

    return true;
  });

  const departments = Array.from(new Set((data?.teachers || []).map(t => t.department).filter(Boolean)));

  const formatMins = (mins) => {
    if (!mins || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatTimeStr = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400 bg-emerald-950/70 px-2.5 py-0.5 rounded-full border border-emerald-800">
              Live Real-Time Radar
            </span>
            <span className="text-xs text-slate-400">| Auto-sync every 30s</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Teacher Campus Movement Tracker</h2>
          <p className="text-sm text-slate-300 mt-1">
            Tracking multi-entry campus movements, inside/outside status, and real-time stay durations across shifts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTrackerData}
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition shadow-md disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 4 Real-time Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Inside Campus */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Inside' ? 'All' : 'Inside')}
          className={`cursor-pointer bg-white p-5 rounded-2xl border transition shadow-sm hover:shadow-md ${
            statusFilter === 'Inside' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
              Currently On Campus
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <LogIn className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{data?.summary?.inside_campus || 0}</span>
            <span className="text-xs text-slate-500">Teachers</span>
          </div>
          <p className="text-xs text-emerald-600 font-medium mt-1">Active inside WiFi / Geofence</p>
        </div>

        {/* Outside Campus */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Outside' ? 'All' : 'Outside')}
          className={`cursor-pointer bg-white p-5 rounded-2xl border transition shadow-sm hover:shadow-md ${
            statusFilter === 'Outside' ? 'ring-2 ring-rose-500 border-rose-500' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg">
              Outside Campus
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
              <LogOut className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{data?.summary?.outside_campus || 0}</span>
            <span className="text-xs text-slate-500">Teachers</span>
          </div>
          <p className="text-xs text-rose-600 font-medium mt-1">Checked out / Off-campus</p>
        </div>

        {/* Active Alerts */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Alerts' ? 'All' : 'Alerts')}
          className={`cursor-pointer bg-white p-5 rounded-2xl border transition shadow-sm hover:shadow-md ${
            statusFilter === 'Alerts' ? 'ring-2 ring-amber-500 border-amber-500' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg">
              Active Alerts
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{data?.summary?.active_alerts || 0}</span>
            <span className="text-xs text-slate-500">Flagged</span>
          </div>
          <p className="text-xs text-amber-600 font-medium mt-1">Left during shift / &gt;30m outside</p>
        </div>

        {/* Total Movements Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
              Total Logged Events
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Compass className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{data?.summary?.total_events_today || 0}</span>
            <span className="text-xs text-slate-500">IN / OUT Logs</span>
          </div>
          <p className="text-xs text-indigo-600 font-medium mt-1">Full audit trail preserved</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Shift Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-medium">
            {['All', 'Shift One', 'Shift Two'].map((s) => (
              <button
                key={s}
                onClick={() => setSelectedShift(s)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  selectedShift === s
                    ? 'bg-white text-indigo-600 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="All">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Quick Status Pill Filter Reset */}
          {statusFilter !== 'All' && (
            <button
              onClick={() => setStatusFilter('All')}
              className="text-xs bg-rose-50 text-rose-600 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-medium transition"
            >
              <span>Filter: {statusFilter}</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search teacher, ID, dept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
          />
        </div>
      </div>

      {/* Teachers Live Presence Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTeachers.map((t) => {
          const isInside = t.presence_status === 'Inside Campus';
          const hasAlerts = t.alerts && t.alerts.length > 0;

          return (
            <div
              key={`${t.teacher_id}_${t.shift}`}
              className={`bg-white rounded-2xl border p-5 transition-all shadow-sm hover:shadow-md relative overflow-hidden flex flex-col justify-between ${
                isInside
                  ? 'border-emerald-200 hover:border-emerald-400'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Presence Indicator Ribbon */}
              <div
                className={`absolute top-0 right-0 left-0 h-1.5 ${
                  isInside ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              />

              <div>
                {/* Header: Teacher Name, ID, Shift */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{t.full_name}</h3>
                    <p className="text-xs text-slate-500">
                      {t.teacher_id} • {t.department}
                    </p>
                  </div>

                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {t.shift}
                  </span>
                </div>

                {/* Status & Live Duration Pill */}
                <div className="mb-4">
                  {isInside ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/60">
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-emerald-800">Inside Campus</div>
                        <div className="text-[11px] text-emerald-600">
                          Inside for {formatMins(t.minutes_in_current_state)} (Since {formatTimeStr(t.last_event_time)})
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-400"></span>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-slate-700">Outside Campus</div>
                        <div className="text-[11px] text-slate-500">
                          {t.last_event_time ? `Outside for ${formatMins(t.minutes_in_current_state)} (Left at ${formatTimeStr(t.last_event_time)})` : 'No entry logged today'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Metrics: Entries, Exits, Total In-Campus Hours */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl text-center mb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Entries</span>
                    <span className="text-sm font-extrabold text-slate-800">{t.total_entries}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Exits</span>
                    <span className="text-sm font-extrabold text-slate-800">{t.total_exits}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Inside Stay</span>
                    <span className="text-sm font-extrabold text-indigo-600">
                      {Math.floor(t.total_in_campus_hours)}h {Math.round((t.total_in_campus_hours % 1) * 60)}m
                    </span>
                  </div>
                </div>

                {/* Alerts if any */}
                {hasAlerts && (
                  <div className="space-y-1.5 mb-3">
                    {t.alerts.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 text-[11px] p-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-medium"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{a.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* View Timeline Button */}
              <button
                onClick={() => setSelectedTeacherForTimeline(t)}
                className="w-full mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-xl border border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 transition"
              >
                <span>View Movement Timeline ({t.movement_timeline?.length || 0})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {filteredTeachers.length === 0 && !loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Compass className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="font-bold text-slate-700">No teachers found</h4>
          <p className="text-xs text-slate-500 mt-1">Try adjusting the shift, department or status filters.</p>
        </div>
      )}

      {/* Movement Timeline Modal */}
      {selectedTeacherForTimeline && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  {selectedTeacherForTimeline.full_name?.charAt(0) || 'T'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {selectedTeacherForTimeline.full_name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedTeacherForTimeline.teacher_id} • {selectedTeacherForTimeline.department} •{' '}
                    <span className="font-semibold text-indigo-600">{selectedTeacherForTimeline.shift}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTeacherForTimeline(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Stats Bar */}
            <div className="grid grid-cols-3 gap-2 p-4 bg-indigo-50/50 border-b border-indigo-100 text-center text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Total In-Campus</span>
                <span className="font-bold text-indigo-700 text-sm">
                  {Math.floor(selectedTeacherForTimeline.total_in_campus_hours)}h{' '}
                  {Math.round((selectedTeacherForTimeline.total_in_campus_hours % 1) * 60)}m
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Out / Break Time</span>
                <span className="font-bold text-amber-700 text-sm">
                  {Math.floor(selectedTeacherForTimeline.total_out_break_hours)}h{' '}
                  {Math.round((selectedTeacherForTimeline.total_out_break_hours % 1) * 60)}m
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Current Status</span>
                <span
                  className={`font-bold text-sm ${
                    selectedTeacherForTimeline.presence_status === 'Inside Campus'
                      ? 'text-emerald-700'
                      : 'text-slate-700'
                  }`}
                >
                  {selectedTeacherForTimeline.presence_status}
                </span>
              </div>
            </div>

            {/* Timeline Events Scroll Area */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Today's Chronological Movement Log
              </h4>

              {(!selectedTeacherForTimeline.movement_timeline ||
                selectedTeacherForTimeline.movement_timeline.length === 0) && (
                <p className="text-xs text-slate-500 italic py-4">No movement events logged for today yet.</p>
              )}

              <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {selectedTeacherForTimeline.movement_timeline?.map((evt, idx) => {
                  const isIN = evt.event_type === 'IN';

                  return (
                    <div key={evt.id || idx} className="relative">
                      {/* Timeline Dot */}
                      <div
                        className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
                          isIN ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                              isIN
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}
                          >
                            {isIN ? `IN (Session #${evt.session_no})` : `OUT (Exit #${evt.event_no / 2 || 1})`}
                          </span>

                          <span className="text-xs font-semibold text-slate-700">
                            {formatTimeStr(evt.event_time)}
                          </span>
                        </div>

                        {/* Stay Duration for OUT events */}
                        {!isIN && evt.stay_duration_minutes > 0 && (
                          <div className="text-xs text-slate-600 font-medium bg-white p-2 rounded-lg border border-slate-100">
                            ⏱️ Total stay in session: <span className="font-bold text-slate-900">{formatMins(evt.stay_duration_minutes)}</span>
                          </div>
                        )}

                        {/* Network and Device details */}
                        <div className="text-[11px] text-slate-500 grid grid-cols-2 gap-1 pt-1 border-t border-slate-200/60">
                          <div>
                            <span className="text-slate-400">Mode:</span> {evt.mode || 'Auto-WiFi'}
                          </div>
                          <div>
                            <span className="text-slate-400">SSID:</span> {evt.ssid || 'Campus WiFi'}
                          </div>
                          {evt.mobile_name && (
                            <div>
                              <span className="text-slate-400">Device:</span> {evt.mobile_name}
                            </div>
                          )}
                          {evt.ip_address && (
                            <div>
                              <span className="text-slate-400">IP:</span> {evt.ip_address}
                            </div>
                          )}
                        </div>

                        {evt.remarks && (
                          <div className="text-[11px] text-slate-600 italic">
                            Remarks: {evt.remarks}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setSelectedTeacherForTimeline(null)}
                className="text-xs font-semibold px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl transition"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

