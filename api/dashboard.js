const { supabase } = require('./lib/supabase');

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

    // 1. Total active teachers
    const { data: teachers, error: tErr } = await supabase
      .from('teachers')
      .select('teacher_id, full_name, department, designation, email, phone, status, devices(mobile_name, mac_address, is_approved)')
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

    const totalTeachers = teachers ? teachers.length : 0;
    const attMap = new Map();
    (attendance || []).forEach(a => attMap.set(a.teacher_id, a));

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let halfDayCount = 0;
    let onLeaveCount = 0;

    // Merge teachers with today's status
    const liveList = (teachers || []).map(t => {
      const att = attMap.get(t.teacher_id);
      let status = att ? att.status : (holiday ? 'Holiday' : 'Absent');

      if (status === 'Present') presentCount++;
      else if (status === 'Late') lateCount++;
      else if (status === 'Half Day') halfDayCount++;
      else if (status === 'On Leave') onLeaveCount++;
      else absentCount++;

      return {
        teacher_id: t.teacher_id,
        full_name: t.full_name,
        department: t.department,
        designation: t.designation,
        email: t.email,
        phone: t.phone,
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
        remarks: att?.remarks || null
      };
    });

    return res.status(200).json({
      date: today,
      is_holiday: !!holiday,
      holiday_title: holiday?.title || null,
      wifi_settings: wifiSettings || null,
      stats: {
        total_teachers: totalTeachers,
        present_now: presentCount + lateCount, // Currently on campus
        present_count: presentCount,
        late_count: lateCount,
        absent_count: absentCount,
        half_day_count: halfDayCount,
        on_leave_count: onLeaveCount
      },
      teachers: liveList
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard data', message: err.message });
  }
};

