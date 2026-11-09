const { supabase } = require('../lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      teacher_id,
      is_wifi_connected,
      ssid,
      bssid,
      ip_address,
      gps_lat,
      gps_lng,
      is_mock_location
    } = req.body || {};

    if (!teacher_id) return res.status(400).json({ error: 'teacher_id is required' });

    const today = todayIST();
    const now = nowIST();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 1. Fetch Teacher info (to get assigned shift)
    const { data: teacher } = await supabase
      .from('teachers')
      .select('teacher_id, shift')
      .eq('teacher_id', teacher_id)
      .maybeSingle();

    const teacherShift = teacher?.shift || 'Shift One';

    // 2. Fetch WiFi Settings
    const { data: settings } = await supabase
      .from('wifi_settings')
      .select('*')
      .limit(1)
      .single();

    const campusLat = settings?.campus_lat || 17.5449;
    const campusLng = settings?.campus_lng || 78.5718;
    const maxRadius = settings?.geofence_radius_meters || 200;
    const shiftOneEndMin = timeToMinutes(settings?.shift_one_end || '12:30:00'); // 750

    // 3. Fetch Today's Attendance Records for this teacher
    const { data: todayRecords, error: aErr } = await supabase
      .from('attendance')
      .select('*')
      .eq('teacher_id', teacher_id)
      .eq('date', today)
      .order('in_time', { ascending: true });

    if (aErr) throw aErr;

    // ── Auto-transition for 'Both' shifts when connected at or past 12:30 PM ──
    if (is_wifi_connected && teacherShift === 'Both') {
      const shiftOneRecord = todayRecords?.find(r => r.shift === 'Shift One' && r.in_time);
      const shiftTwoRecord = todayRecords?.find(r => r.shift === 'Shift Two');

      if (currentMinutes >= shiftOneEndMin && shiftOneRecord && !shiftOneRecord.out_time) {
        // Automatically close Shift One at 12:30 PM
        const transitionTimeISO = new Date().toISOString();
        const inDate = new Date(shiftOneRecord.in_time);
        const shiftOneHours = Math.max(0, Number(((new Date(transitionTimeISO) - inDate) / (1000 * 60 * 60)).toFixed(2)));
        let shiftOneStatus = shiftOneRecord.status;
        if (shiftOneHours < 2.50 && shiftOneStatus !== 'On Leave') shiftOneStatus = 'Half Day';

        await supabase
          .from('attendance')
          .update({
            out_time: transitionTimeISO,
            total_hours: shiftOneHours,
            early_out_by_minutes: 0,
            status: shiftOneStatus,
            last_wifi_seen_at: transitionTimeISO,
            updated_at: transitionTimeISO
          })
          .eq('id', shiftOneRecord.id);

        // Automatically start Shift Two if not already started
        if (!shiftTwoRecord || !shiftTwoRecord.in_time) {
          const shiftTwoData = {
            teacher_id,
            date: today,
            shift: 'Shift Two',
            in_time: transitionTimeISO,
            status: 'Present',
            late_by_minutes: 0,
            ssid: ssid || settings?.campus_ssid || 'Woxsen_Campus_WiFi',
            mode: 'Auto-WiFi',
            last_wifi_seen_at: transitionTimeISO,
            remarks: 'Auto-transition from Shift One (Both shifts)'
          };

          if (shiftTwoRecord) {
            await supabase.from('attendance').update(shiftTwoData).eq('id', shiftTwoRecord.id);
          } else {
            await supabase.from('attendance').insert(shiftTwoData);
          }
        }

        return res.status(200).json({
          status: 'Present',
          shift: 'Shift Two',
          wifi_connected: true,
          message: 'Auto-transitioned from Shift One to Shift Two at 12:30 PM.'
        });
      }
    }

    // Determine which attendance record is currently active
    // If Shift Two is active (or teacher is Shift Two), use Shift Two record; otherwise Shift One
    let attendance = null;
    if (todayRecords && todayRecords.length > 0) {
      // Find open record without out_time
      attendance = todayRecords.find(r => !r.out_time) || todayRecords[todayRecords.length - 1];
    }

    if (!attendance || !attendance.in_time) {
      return res.status(200).json({
        has_checked_in: false,
        message: 'No active check-in record for today'
      });
    }

    const currentShift = attendance.shift || 'Shift One';
    const halfDayLimit = currentShift === 'Shift Two' ? 2.25 : 2.50; // Shift One < 2.5h, Shift Two < 2.25h

    // ── CASE A: WiFi is currently CONNECTED ──────────────────────────────────
    if (is_wifi_connected) {
      const updates = {
        last_wifi_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (attendance.status === 'WiFi Off - On Campus (GPS)') {
        updates.status = attendance.late_by_minutes > 0 ? 'Late' : 'Present';
        updates.remarks = `Reconnected to Campus WiFi (${currentShift})`;
      }

      await supabase
        .from('attendance')
        .update(updates)
        .eq('id', attendance.id);

      return res.status(200).json({
        status: updates.status || attendance.status,
        shift: currentShift,
        wifi_connected: true,
        message: `WiFi heartbeat active for ${currentShift}. Maintained IN status.`
      });
    }

    // ── CASE B: WiFi is DISCONNECTED ─────────────────────────────────────────
    const lastSeen = attendance.last_wifi_seen_at
      ? new Date(attendance.last_wifi_seen_at)
      : new Date(attendance.in_time);

    const elapsedMinutes = Math.floor((new Date().getTime() - lastSeen.getTime()) / (1000 * 60));

    // Rule 1: Brief disconnect (< 3 mins) -> Ignore completely
    if (elapsedMinutes < 3) {
      return res.status(200).json({
        status: attendance.status,
        shift: currentShift,
        warning: false,
        elapsed_minutes: elapsedMinutes,
        message: 'Brief disconnect under 3 minutes ignored'
      });
    }

    // Rule 2: 3 to 15 minutes -> Warning & Grace Period
    if (elapsedMinutes < 15) {
      const minutesRemaining = 15 - elapsedMinutes;
      const willMarkOutAt = new Date(lastSeen.getTime() + 15 * 60000).toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      return res.status(200).json({
        status: attendance.status,
        shift: currentShift,
        warning: true,
        minutes_left: minutesRemaining,
        will_mark_out_at: willMarkOutAt,
        message: `WiFi disconnected for ${elapsedMinutes}m. Turn WiFi back ON, otherwise you will be marked OUT at ${willMarkOutAt}`
      });
    }

    // Rule 3: Continuous disconnect >= 15 minutes -> Check GPS geofence
    let isInsideCampusGps = false;
    let distance = 999999;
    if (gps_lat && gps_lng && !is_mock_location) {
      distance = calculateDistanceMeters(Number(gps_lat), Number(gps_lng), campusLat, campusLng);
      if (distance <= maxRadius) {
        isInsideCampusGps = true;
      }
    }

    // Sub-rule 3a: WiFi is OFF, BUT GPS verifies teacher is still inside campus!
    if (isInsideCampusGps) {
      await supabase
        .from('attendance')
        .update({
          status: 'WiFi Off - On Campus (GPS)',
          gps_lat: Number(gps_lat),
          gps_lng: Number(gps_lng),
          remarks: `WiFi Off - On Campus (${currentShift}, GPS verified: ${Math.round(distance)}m)`,
          updated_at: new Date().toISOString()
        })
        .eq('id', attendance.id);

      return res.status(200).json({
        status: 'WiFi Off - On Campus (GPS)',
        shift: currentShift,
        warning: false,
        is_on_campus: true,
        message: 'WiFi is OFF, but GPS confirms you are still on campus. You will NOT be marked OUT.'
      });
    }

    // Sub-rule 3b: Disconnected >= 15 min and outside campus -> Mark OUT
    if (!attendance.out_time) {
      const outTimeISO = lastSeen.toISOString();
      const inDate = new Date(attendance.in_time);
      const totalHours = Math.max(0, Number(((lastSeen - inDate) / (1000 * 60 * 60)).toFixed(2)));

      let finalStatus = attendance.status;
      if (totalHours < halfDayLimit && finalStatus !== 'On Leave' && finalStatus !== 'Holiday') {
        finalStatus = 'Half Day';
      }

      await supabase
        .from('attendance')
        .update({
          out_time: outTimeISO,
          total_hours: totalHours,
          status: finalStatus,
          remarks: `Auto OUT after 15 min disconnect (${currentShift})`,
          updated_at: new Date().toISOString()
        })
        .eq('id', attendance.id);

      return res.status(200).json({
        status: finalStatus,
        shift: currentShift,
        marked_out: true,
        out_time: outTimeISO,
        message: `Marked OUT automatically from ${currentShift} after 15 minutes continuous disconnection.`
      });
    }

    return res.status(200).json({
      status: attendance.status,
      shift: currentShift,
      out_time: attendance.out_time
    });

  } catch (err) {
    console.error('wifi-heartbeat error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

