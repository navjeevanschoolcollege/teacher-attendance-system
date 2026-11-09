const { supabase } = require('./lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function nowIST() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

function todayIST() {
  const d = nowIST();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { date, shift, department } = req.query;
    const targetDate = date || todayIST();

    // 1. Fetch WiFi settings for shift timings
    const { data: settings } = await supabase
      .from('wifi_settings')
      .select('*')
      .limit(1)
      .single();

    const shiftOneStart = settings?.shift_one_start || '07:15:00';
    const shiftOneEnd = settings?.shift_one_end || '12:30:00';
    const shiftTwoStart = settings?.shift_two_start || '12:30:00';
    const shiftTwoEnd = settings?.shift_two_end || '17:00:00';

    const now = nowIST();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    // 2. Fetch all active teachers
    let teacherQuery = supabase
      .from('teachers')
      .select('teacher_id, full_name, department, designation, phone, email, shift')
      .eq('status', 'Active');

    if (department && department !== 'All') {
      teacherQuery = teacherQuery.eq('department', department);
    }
    const { data: teachers, error: tErr } = await teacherQuery;
    if (tErr) throw tErr;

    // 3. Fetch all attendance summaries for targetDate
    let attQuery = supabase
      .from('attendance')
      .select('*')
      .eq('date', targetDate);

    if (shift && shift !== 'All') {
      attQuery = attQuery.eq('shift', shift);
    }
    const { data: attendanceList, error: aErr } = await attQuery;
    if (aErr) throw aErr;

    // 4. Fetch all movement logs for targetDate
    let moveQuery = supabase
      .from('movement_log')
      .select('*')
      .eq('date', targetDate)
      .order('event_time', { ascending: true });

    if (shift && shift !== 'All') {
      moveQuery = moveQuery.eq('shift', shift);
    }
    const { data: movementLogs, error: mErr } = await moveQuery;
    if (mErr) throw mErr;

    // 5. Aggregate teacher tracking status
    const attendanceMap = {};
    (attendanceList || []).forEach(a => {
      const key = `${a.teacher_id}_${a.shift}`;
      attendanceMap[key] = a;
    });

    const movementsByTeacher = {};
    (movementLogs || []).forEach(m => {
      if (!movementsByTeacher[m.teacher_id]) {
        movementsByTeacher[m.teacher_id] = [];
      }
      movementsByTeacher[m.teacher_id].push(m);
    });

    const results = [];
    let insideCount = 0;
    let outsideCount = 0;
    let alertCount = 0;

    teachers.forEach(t => {
      // Teachers can have Shift One, Shift Two, or Both
      const assigned = t.shift || 'Shift One';
      const shiftsToEval = (shift && shift !== 'All') 
        ? [shift] 
        : (assigned === 'Both' ? ['Shift One', 'Shift Two'] : [assigned]);

      shiftsToEval.forEach(s => {
        // If filtering by shift, skip if teacher is not assigned to it (unless Both)
        if (assigned !== 'Both' && assigned !== s) return;

        const att = attendanceMap[`${t.teacher_id}_${s}`];
        const teacherMoves = (movementsByTeacher[t.teacher_id] || []).filter(m => m.shift === s);
        const lastMove = teacherMoves.length > 0 ? teacherMoves[teacherMoves.length - 1] : null;

        const isInside = lastMove ? lastMove.event_type === 'IN' : false;
        if (isInside) insideCount++;
        else outsideCount++;

        // Calculate minutes in current state
        let minutesInCurrentState = 0;
        if (lastMove) {
          const moveTime = new Date(lastMove.event_time);
          minutesInCurrentState = Math.max(0, Math.floor((now - moveTime) / 60000));
        }

        // Active Alerts evaluation
        const alerts = [];
        const shiftStartMins = timeToMinutes(s === 'Shift Two' ? shiftTwoStart : shiftOneStart);
        const shiftEndMins = timeToMinutes(s === 'Shift Two' ? shiftTwoEnd : shiftOneEnd);
        const isDuringShift = currentMins >= shiftStartMins && currentMins <= shiftEndMins;

        // Alert 1: Left during shift hours
        if (!isInside && teacherMoves.length > 0 && isDuringShift) {
          alerts.push({
            type: 'LEFT_DURING_SHIFT',
            severity: 'warning',
            message: `Left campus during ${s} hours at ${new Date(lastMove.event_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`
          });
        }

        // Alert 2: Outside > 30 minutes during shift
        if (!isInside && teacherMoves.length > 0 && isDuringShift && minutesInCurrentState > 30) {
          alerts.push({
            type: 'OUTSIDE_OVER_30_MINS',
            severity: 'danger',
            message: `Outside campus for ${minutesInCurrentState} mins during shift (Exceeded 30 min threshold)`
          });
        }

        // Alert 3: 3+ exits today
        const totalExits = teacherMoves.filter(m => m.event_type === 'OUT').length;
        if (totalExits >= 3) {
          alerts.push({
            type: 'FREQUENT_EXITS',
            severity: 'info',
            message: `${totalExits} exits logged today (High campus movement)`
          });
        }

        if (alerts.length > 0) alertCount++;

        results.push({
          teacher_id: t.teacher_id,
          full_name: t.full_name,
          department: t.department,
          designation: t.designation,
          phone: t.phone,
          email: t.email,
          shift: s,
          presence_status: isInside ? 'Inside Campus' : 'Outside Campus',
          last_event_type: lastMove ? lastMove.event_type : 'NONE',
          last_event_time: lastMove ? lastMove.event_time : null,
          minutes_in_current_state: minutesInCurrentState,
          total_entries: teacherMoves.filter(m => m.event_type === 'IN').length,
          total_exits: totalExits,
          total_in_campus_hours: att?.total_in_campus_hours || 0,
          total_out_break_hours: att?.total_out_break_hours || 0,
          attendance_status: att?.status || 'Not Checked In',
          late_by_minutes: att?.late_by_minutes || 0,
          early_out_by_minutes: att?.early_out_by_minutes || 0,
          movement_timeline: teacherMoves,
          alerts
        });
      });
    });

    return res.status(200).json({
      success: true,
      date: targetDate,
      summary: {
        total_teachers: teachers.length,
        inside_campus: insideCount,
        outside_campus: outsideCount,
        active_alerts: alertCount,
        total_events_today: movementLogs?.length || 0
      },
      timings: {
        shift_one: `${shiftOneStart} - ${shiftOneEnd}`,
        shift_two: `${shiftTwoStart} - ${shiftTwoEnd}`
      },
      teachers: results
    });

  } catch (err) {
    console.error('Tracker API error:', err);
    return res.status(500).json({ error: 'Failed to fetch live tracker data', details: err.message });
  }
};

