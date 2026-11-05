const { supabase } = require('./lib/supabase');

// ── CORS headers ──────────────────────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── IP-in-CIDR check ──────────────────────────────────────────────────────────
function ipToLong(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isIpInCidr(ip, cidr) {
  if (!cidr || !ip) return false;
  // Support comma-separated CIDRs
  const cidrs = cidr.split(',').map(c => c.trim()).filter(Boolean);
  for (const c of cidrs) {
    const [range, bits] = c.split('/');
    const mask = bits ? (~0 << (32 - parseInt(bits, 10))) >>> 0 : 0xFFFFFFFF;
    if ((ipToLong(ip) & mask) === (ipToLong(range) & mask)) return true;
  }
  return false;
}

// ── IST helpers ───────────────────────────────────────────────────────────────
function nowIST() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

function todayIST() {
  const d = nowIST();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeToMinutes(timeStr) {
  // timeStr = "HH:MM" (24-h)
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { teacher_id, ip_address } = req.body || {};
    if (!teacher_id) return res.status(400).json({ error: 'teacher_id is required' });

    // ── Fetch wifi settings ───────────────────────────────────────────────────
    const { data: settings, error: sErr } = await supabase
      .from('wifi_settings')
      .select('*')
      .limit(1)
      .single();
    if (sErr) return res.status(500).json({ error: 'Failed to load wifi settings', details: sErr.message });

    // ── IP validation ─────────────────────────────────────────────────────────
    if (!settings.demo_mode) {
      if (!ip_address) return res.status(400).json({ error: 'ip_address is required' });
      if (!isIpInCidr(ip_address, settings.campus_ip_range)) {
        return res.status(403).json({ error: 'You are not connected to the campus network. Check-in denied.' });
      }
    }

    const today = todayIST();
    const now = nowIST();

    // ── Check existing attendance ─────────────────────────────────────────────
    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('teacher_id', teacher_id)
      .eq('date', today)
      .maybeSingle();

    if (existing && existing.in_time) {
      return res.status(409).json({ error: 'Already checked in for today', record: existing });
    }

    // ── Calculate status ──────────────────────────────────────────────────────
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = settings.start_time ? timeToMinutes(settings.start_time) : 9 * 60; // default 09:00
    const graceMinutes = settings.grace_minutes || 15;
    const onTimeLimit = startMinutes + graceMinutes;
    const halfDayLimit = startMinutes + 120; // 2 hours late = half day

    let status = 'Present';
    let late_by_minutes = 0;

    if (currentMinutes > halfDayLimit) {
      status = 'Half Day';
      late_by_minutes = currentMinutes - startMinutes;
    } else if (currentMinutes > onTimeLimit) {
      status = 'Late';
      late_by_minutes = currentMinutes - startMinutes;
    }

    const inTimeISO = new Date().toISOString();

    const record = {
      teacher_id,
      date: today,
      in_time: inTimeISO,
      status,
      late_by_minutes,
      ip_address: ip_address || null,
      mode: 'Manual-Web',
    };

    let result;
    if (existing) {
      // Update the row that had no in_time (e.g. pre-created for leave/holiday)
      const { data, error } = await supabase
        .from('attendance')
        .update(record)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: 'Failed to update attendance', details: error.message });
      result = data;
    } else {
      const { data, error } = await supabase
        .from('attendance')
        .insert(record)
        .select()
        .single();
      if (error) return res.status(500).json({ error: 'Failed to create attendance', details: error.message });
      result = data;
    }

    return res.status(200).json({ success: true, message: `Checked in successfully. Status: ${status}`, record: result });
  } catch (err) {
    console.error('checkin error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};
