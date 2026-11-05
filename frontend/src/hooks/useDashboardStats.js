import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function todayIST() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useDashboardStats(date) {
  const targetDate = date || todayIST();
  const [stats, setStats] = useState({
    total_teachers: 0,
    present_now: 0,
    present_count: 0,
    late_count: 0,
    absent_count: 0,
    half_day_count: 0,
    on_leave_count: 0
  });
  const [teachersList, setTeachersList] = useState([]);
  const [holiday, setHoliday] = useState(null);
  const [wifiSettings, setWifiSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Call the serverless dashboard endpoint or direct supabase
      const response = await fetch(`/api/dashboard?date=${targetDate}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setTeachersList(data.teachers);
        setHoliday(data.holiday_title);
        setWifiSettings(data.wifi_settings);
      } else {
        // Fallback directly to Supabase client if serverless is local/offline
        const { data: teachers } = await supabase.from('teachers').select('*, devices(*)').eq('status', 'Active');
        const { data: attendance } = await supabase.from('attendance').select('*').eq('date', targetDate);
        const { data: hol } = await supabase.from('holidays').select('*').eq('date', targetDate).maybeSingle();
        const { data: wifi } = await supabase.from('wifi_settings').select('*').limit(1).maybeSingle();

        const total = teachers?.length || 0;
        let pres = 0, late = 0, half = 0, leave = 0;
        const attMap = new Map();
        (attendance || []).forEach(a => attMap.set(a.teacher_id, a));

        const merged = (teachers || []).map(t => {
          const a = attMap.get(t.teacher_id);
          const st = a ? a.status : (hol ? 'Holiday' : 'Absent');
          if (st === 'Present') pres++;
          else if (st === 'Late') late++;
          else if (st === 'Half Day') half++;
          else if (st === 'On Leave') leave++;
          return {
            ...t,
            date: targetDate,
            in_time: a?.in_time || null,
            out_time: a?.out_time || null,
            total_hours: a?.total_hours || 0,
            status: st,
            mode: a?.mode || '-',
            late_by_minutes: a?.late_by_minutes || 0,
            early_out_by_minutes: a?.early_out_by_minutes || 0
          };
        });

        setStats({
          total_teachers: total,
          present_now: pres + late,
          present_count: pres,
          late_count: late,
          absent_count: Math.max(0, total - (pres + late + half + leave)),
          half_day_count: half,
          on_leave_count: leave
        });
        setTeachersList(merged);
        setHoliday(hol?.title || null);
        setWifiSettings(wifi);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to attendance real-time changes
    const channel = supabase
      .channel('dashboard_stats_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetDate]);

  return { stats, teachersList, holiday, wifiSettings, loading, error, refresh: fetchDashboardData };
}

