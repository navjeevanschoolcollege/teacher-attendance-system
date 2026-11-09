import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function todayIST() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useDashboardStats(date, shift = 'All') {
  const targetDate = date || todayIST();
  const [stats, setStats] = useState({
    total_teachers: 0,
    present_now: 0,
    present_count: 0,
    late_count: 0,
    absent_count: 0,
    half_day_count: 0,
    on_leave_count: 0,
    wifi_off_gps_count: 0,
    suspicious_count: 0,
    pending_corrections: 0,
    shift_one: { total: 0, present_now: 0, present_count: 0, late_count: 0, absent_count: 0, half_day_count: 0 },
    shift_two: { total: 0, present_now: 0, present_count: 0, late_count: 0, absent_count: 0, half_day_count: 0 }
  });
  const [teachersList, setTeachersList] = useState([]);
  const [holiday, setHoliday] = useState(null);
  const [wifiSettings, setWifiSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard?date=${targetDate}&shift=${encodeURIComponent(shift)}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setTeachersList(data.teachers);
        setHoliday(data.holiday_title);
        setWifiSettings(data.wifi_settings);
      } else {
        // Fallback directly to Supabase client
        const { data: teachers } = await supabase.from('teachers').select('*, devices(*)').eq('status', 'Active');
        const { data: attendance } = await supabase.from('attendance').select('*').eq('date', targetDate);
        const { data: hol } = await supabase.from('holidays').select('*').eq('date', targetDate).maybeSingle();
        const { data: wifi } = await supabase.from('wifi_settings').select('*').limit(1).maybeSingle();

        const attMap = new Map();
        (attendance || []).forEach(a => attMap.set(`${a.teacher_id}_${a.shift || 'Shift One'}`, a));

        const shiftOneStats = { total: 0, present_now: 0, present_count: 0, late_count: 0, absent_count: 0, half_day_count: 0 };
        const shiftTwoStats = { total: 0, present_now: 0, present_count: 0, late_count: 0, absent_count: 0, half_day_count: 0 };

        let pres = 0, late = 0, half = 0, leave = 0, wifiGps = 0, suspicious = 0;
        const merged = [];

        (teachers || []).forEach(t => {
          const assignedShift = t.shift || 'Shift One';
          const shiftsToEval = assignedShift === 'Both' ? ['Shift One', 'Shift Two'] : [assignedShift];

          shiftsToEval.forEach(currShift => {
            const a = attMap.get(`${t.teacher_id}_${currShift}`);
            const st = a ? a.status : (hol ? 'Holiday' : 'Absent');

            const targetStat = currShift === 'Shift One' ? shiftOneStats : shiftTwoStats;
            targetStat.total++;

            if (st === 'Present') { targetStat.present_count++; targetStat.present_now++; pres++; }
            else if (st === 'Late') { targetStat.late_count++; targetStat.present_now++; late++; }
            else if (st === 'Half Day') { targetStat.half_day_count++; half++; }
            else if (st === 'On Leave') { leave++; }
            else if (st === 'WiFi Off - On Campus (GPS)') { targetStat.present_now++; wifiGps++; }
            else { targetStat.absent_count++; }

            if (a?.flagged_suspicious || a?.is_mock_location) suspicious++;

            if (shift === 'All' || shift === currShift) {
              merged.push({
                ...t,
                assigned_shift: assignedShift,
                shift: currShift,
                date: targetDate,
                in_time: a?.in_time || null,
                out_time: a?.out_time || null,
                total_hours: a?.total_hours || 0,
                status: st,
                mode: a?.mode || '-',
                late_by_minutes: a?.late_by_minutes || 0,
                early_out_by_minutes: a?.early_out_by_minutes || 0
              });
            }
          });
        });

        setStats({
          total_teachers: teachers?.length || 0,
          present_now: pres + late + wifiGps,
          present_count: pres,
          late_count: late,
          absent_count: Math.max(0, (teachers?.length || 0) - (pres + late + half + leave + wifiGps)),
          half_day_count: half,
          on_leave_count: leave,
          wifi_off_gps_count: wifiGps,
          suspicious_count: suspicious,
          pending_corrections: 0,
          shift_one: shiftOneStats,
          shift_two: shiftTwoStats
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
  }, [targetDate, shift]);

  return {
    stats,
    teachersList,
    holiday,
    wifiSettings,
    loading,
    error,
    refresh: fetchDashboardData
  };
}
