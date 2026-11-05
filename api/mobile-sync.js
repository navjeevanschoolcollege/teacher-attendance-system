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

    // Fetch wifi settings for rules
    const { data: settings } = await supabase
      .from('wifi_settings')
      .select('*')
      .limit(1)
      .single();

    const startTime = settings?.start_time || '09:00:00';
    const graceMinutes = settings?.grace_minutes || 10;
    const endTime = settings?.end_time || '16:00:00';

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const cutoffMinutes = startMinutes + graceMinutes;

    let successCount = 0;
    const errors = [];

    for (const rec of records) {
      try {
        const {
          teacher_id,
          date,
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

        // Calculate hours and status
        let status = 'Present';
        let late_by_minutes = 0;
        let early_out_by_minutes = 0;
        let total_hours = 0;

        if (in_time) {
          const inDate = new Date(in_time);
          const inLocal = inDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
          const [inH, inM] = inLocal.split(':').map(Number);
          const inTotalMin = inH * 60 + inM;

          if (inTotalMin > cutoffMinutes) {
            status = 'Late';
            late_by_minutes = Math.max(0, inTotalMin - startMinutes);
          }
        }

        if (out_time && in_time) {
          const inDate = new Date(in_time);
          const outDate = new Date(out_time);
          total_hours = Math.max(0, Number(((outDate - inDate) / (1000 * 60 * 60)).toFixed(2)));

          const outLocal = outDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
          const [outH, outM] = outLocal.split(':').map(Number);
          const outTotalMin = outH * 60 + outM;

          if (outTotalMin < endMinutes) {
            early_out_by_minutes = Math.max(0, endMinutes - outTotalMin);
          }

          if (total_hours < 4) {
            status = 'Half Day';
          }
        }

        // Upsert into Supabase attendance table
        const { error: upErr } = await supabase
          .from('attendance')
          .upsert(
            {
              teacher_id,
              date,
              in_time: in_time || null,
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
              remarks,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'teacher_id,date' }
          );

        if (upErr) {
          errors.push({ record: rec, error: upErr.message });
        } else {
          successCount++;
        }
      } catch (innerErr) {
        errors.push({ record: rec, error: innerErr.message });
      }
    }

    return res.status(200).json({
      success: true,
      synced_count: successCount,
      total_received: records.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error('Mobile sync error:', err);
    return res.status(500).json({ error: 'Failed to sync attendance', message: err.message });
  }
};
