const { supabase } = require('../lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function todayIST() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const today = req.query.date || todayIST();
    const filterShift = req.query.shift || 'All'; // 'All', 'Shift One', 'Shift Two'

    // 1. Total active teachers with assigned shifts
    const { data: teachers, error: tErr } = await supabase
      .from('teachers')
      .select('teacher_id, full_name, department, designation, email, phone, shift, status, devices(mobile_name, mac_address, device_uuid, is_approved, is_mock_detected)')
      .eq('status', 'Active');

    if (tErr) throw tErr;

    // 2. Today's attendance records
    const { data: attendance, error: aErr } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', today);

    if (aErr) throw aErr;

    // 3. Today's holidays
    const { data: holiday } = await supabase
      .from('holidays')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    // 4. WiFi Settings
    const { data: wifiSettings } = await supabase
      .from('wifi_settings')
      .select('*')
      .limit(1)
      .single();

    // 5. Pending Corrections count
    const { count: pendingCorrections } = await supabase
      .from('attendance_corrections')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Pending');

    // Create lookup map by `${teacher_id}_${shift}`
    const attMap = new Map();
    (attendance || []).forEach(a => {
      const shiftKey = a.shift || 'Shift One';
      attMap.set(`${a.teacher_id}_${shiftKey}`, a);
    });

    // Compute stats separately for Shift One and Shift Two
    const shiftOneStats = { total: 0, present_now: 0, present_count: 0, late_count: 0, absent_count: 0, half_day_count: 0 };
    const shiftTwoStats = { total: 0, present_now: 0, present_count: 0, late_count: 0, absent_count: 0, half_day_count: 0 };

    let overallPresentNow = 0;
    let overallPresent = 0;
    let overallLate = 0;
    let overallAbsent = 0;
    let overallHalfDay = 0;
    let overallOnLeave = 0;
    let overallWifiOffGps = 0;
    let overallSuspicious = 0;

    const liveList = [];

    (teachers || []).forEach(t => {
      const assignedShift = t.shift || 'Shift One';
      const shiftsToEvaluate = assignedShift === 'Both' ? ['Shift One', 'Shift Two'] : [assignedShift];

      shiftsToEvaluate.forEach(currentShift => {
        const att = attMap.get(`${t.teacher_id}_${currentShift}`);
        let status = att ? att.status : (holiday ? 'Holiday' : 'Absent');

        const isShiftOne = currentShift === 'Shift One';
        const targetStat = isShiftOne ? shiftOneStats : shiftTwoStats;
        targetStat.total++;

        if (status === 'Present') {
          targetStat.present_count++;
          targetStat.present_now++;
          overallPresent++;
          overallPresentNow++;
        } else if (status === 'Late') {
          targetStat.late_count++;
          targetStat.present_now++;
          overallLate++;
          overallPresentNow++;
        } else if (status === 'Half Day') {
          targetStat.half_day_count++;
          overallHalfDay++;
        } else if (status === 'On Leave') {
          overallOnLeave++;
        } else if (status === 'WiFi Off - On Campus (GPS)') {
          targetStat.present_now++;
          overallWifiOffGps++;
          overallPresentNow++;
        } else {
          targetStat.absent_count++;
          overallAbsent++;
        }

        if (att?.flagged_suspicious || att?.is_mock_location) {
          overallSuspicious++;
        }

        // Apply shift filter for table list if specified
        if (filterShift === 'All' || filterShift === currentShift) {
          liveList.push({
            teacher_id: t.teacher_id,
            full_name: t.full_name,
            department: t.department,
            designation: t.designation,
            email: t.email,
            phone: t.phone,
            assigned_shift: assignedShift,
            shift: currentShift,
            device: t.devices?.[0] || null,
            date: today,
            in_time: att?.in_time || null,
            out_time: att?.out_time || null,
            total_hours: att?.total_hours || 0,
            status,
            late_by_minutes: att?.late_by_minutes || 0,
            early_out_by_minutes: att?.early_out_by_minutes || 0,
            mode: att?.mode || (att ? 'Auto-WiFi' : '-'),
            ssid: att?.ssid || null,
            gps_lat: att?.gps_lat || null,
            gps_lng: att?.gps_lng || null,
            flagged_suspicious: att?.flagged_suspicious || false,
            suspicious_reason: att?.suspicious_reason || null,
            is_mock_location: att?.is_mock_location || false,
            last_wifi_seen_at: att?.last_wifi_seen_at || null,
            qr_verified_at: att?.qr_verified_at || null,
            remarks: att?.remarks || null
          });
        }
      });
    });

    return res.status(200).json({
      date: today,
      is_holiday: !!holiday,
      holiday_title: holiday?.title || null,
      wifi_settings: wifiSettings || null,
      stats: {
        total_teachers: (teachers || []).length,
        present_now: overallPresentNow,
        present_count: overallPresent,
        late_count: overallLate,
        absent_count: overallAbsent,
        half_day_count: overallHalfDay,
        on_leave_count: overallOnLeave,
        wifi_off_gps_count: overallWifiOffGps,
        suspicious_count: overallSuspicious,
        pending_corrections: pendingCorrections || 0,
        shift_one: shiftOneStats,
        shift_two: shiftTwoStats
      },
      teachers: liveList
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard data', message: err.message });
  }
};

