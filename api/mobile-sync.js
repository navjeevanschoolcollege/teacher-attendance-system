const { supabase } = require('./lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
    const { records } = req.body || {};
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'records array is required' });
    }

    // Fetch wifi settings for two-shift rules
    const { data: settings } = await supabase
      .from('wifi_settings')
      .select('*')
      .limit(1)
      .single();

    const graceMinutes = settings?.grace_minutes !== undefined ? Number(settings.grace_minutes) : 10;
    const shiftOneStart = settings?.shift_one_start || '07:15:00';
    const shiftOneEnd = settings?.shift_one_end || '12:30:00';
    const shiftTwoStart = settings?.shift_two_start || '12:30:00';
    const shiftTwoEnd = settings?.shift_two_end || '17:00:00';

    let successCount = 0;
    const errors = [];

    for (const rec of records) {
      try {
        const {
          teacher_id,
          date,
          shift,
          in_time,
          out_time,
          mac_address,
          ip_address,
          ssid,
          mobile_name,
          mode = 'Auto-WiFi',
          remarks
        } = rec;

        if (!teacher_id || !date) {
          errors.push({ record: rec, error: 'teacher_id and date are required' });
          continue;
        }

        // Determine shift
        let targetShift = shift || 'Shift One';
        if (!shift) {
          const { data: t } = await supabase.from('teachers').select('shift').eq('teacher_id', teacher_id).maybeSingle();
          if (t && t.shift === 'Shift Two') targetShift = 'Shift Two';
        }

        const isShiftTwo = targetShift === 'Shift Two';
        const startMin = timeToMinutes(isShiftTwo ? shiftTwoStart : shiftOneStart);
        const endMin = timeToMinutes(isShiftTwo ? shiftTwoEnd : shiftOneEnd);
        const cutoffMin = startMin + graceMinutes;
        const halfDayHoursLimit = isShiftTwo ? 2.25 : 2.50;

        let status = 'Present';
        let late_by_minutes = 0;
        let early_out_by_minutes = 0;
        let total_hours = 0;

        if (in_time) {
          const inDate = new Date(in_time);
          const inLocal = inDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
          const [inH, inM] = inLocal.split(':').map(Number);
          const inTotalMin = inH * 60 + inM;

          if (inTotalMin > cutoffMin) {
            status = 'Late';
            late_by_minutes = Math.max(0, inTotalMin - cutoffMin);
          }
        }

        if (out_time && in_time) {
          const inDate = new Date(in_time);
          const outDate = new Date(out_time);
          total_hours = Math.max(0, Number(((outDate - inDate) / (1000 * 60 * 60)).toFixed(2)));

          const outLocal = outDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
          const [outH, outM] = outLocal.split(':').map(Number);
          const outTotalMin = outH * 60 + outM;

          if (outTotalMin < endMin) {
            early_out_by_minutes = Math.max(0, endMin - outTotalMin);
          }

          if (total_hours < halfDayHoursLimit) {
            status = 'Half Day';
          }
        }

        // Upsert into Supabase attendance table on (teacher_id, date, shift)
        const { error: upsertErr } = await supabase
          .from('attendance')
          .upsert({
            teacher_id,
            date,
            shift: targetShift,
            in_time,
            out_time: out_time || null,
            total_hours,
            status,
            late_by_minutes,
            early_out_by_minutes,
            mac_address,
            ip_address,
            ssid,
            mobile_name,
            mode,
            remarks: remarks || `Offline Queue Synced (${targetShift})`,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'teacher_id,date,shift'
          });

        if (upsertErr) {
          errors.push({ record: rec, error: upsertErr.message });
        } else {
          successCount++;
        }
      } catch (itemErr) {
        errors.push({ record: rec, error: itemErr.message });
      }
    }

    return res.status(200).json({
      success: true,
      synced_count: successCount,
      failed_count: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully synced ${successCount} offline record(s) to cloud database.`
    });

  } catch (err) {
    console.error('mobile-sync error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};
