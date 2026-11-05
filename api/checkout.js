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
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function diffHoursMinutes(start, end) {
  const diffMs = end.getTime() - start.getTime();
  const totalMins = Math.floor(diffMs / 60000);
  return { hours: Math.floor(totalMins / 60), minutes: totalMins % 60, totalMinutes: totalMins };
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
        return res.status(403).json({ error: 'You are not connected to the campus network. Check-out denied.' });
      }
    }

    const today = todayIST();
    const now = nowIST();

    // ── Find today's attendance ───────────────────────────────────────────────
    const { data: existing, error: aErr } = await supabase
      .from('attendance')
      .select('*')
      .eq('teacher_id', teacher_id)
      .eq('date', today)
      .maybeSingle();

    if (aErr) return res.status(500).json({ error: 'Failed to query attendance', details: aErr.message });
    if (!existing || !existing.in_time) {
      return res.status(400).json({ error: 'No check-in record found for today. Please check in first.' });
    }
    if (existing.out_time) {
      return res.status(409).json({ error: 'Already checked out for today', record: existing });
    }

    // ── Calculate hours & early-out ───────────────────────────────────────────
    const outTimeISO = new Date().toISOString();
    const inTime = new Date(existing.in_time);
    const outTime = new Date(outTimeISO);
    const { hours, minutes, totalMinutes } = diffHoursMinutes(inTime, outTime);
    const totalHoursStr = `${hours}h ${String(minutes).padStart(2, '0')}m`;

    // Early out calculation
    const endMinutes = settings.end_time ? timeToMinutes(settings.end_time) : 17 * 60; // default 17:00
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let early_out_by_minutes = 0;
    if (currentMinutes < endMinutes) {
      early_out_by_minutes = endMinutes - currentMinutes;
    }

    // Update status if half-day based on total hours
    let status = existing.status;
    if (totalMinutes < 240 && status === 'Present') {
      // Less than 4 hours worked → half day
      status = 'Half Day';
    }

    const { data: updated, error: uErr } = await supabase
      .from('attendance')
      .update({
        out_time: outTimeISO,
        total_hours: totalHoursStr,
        early_out_by_minutes,
        status,
        ip_address: ip_address || existing.ip_address,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (uErr) return res.status(500).json({ error: 'Failed to update attendance', details: uErr.message });

    return res.status(200).json({
      success: true,
      message: `Checked out successfully. Total hours: ${totalHoursStr}`,
      record: updated,
    });
  } catch (err) {
    console.error('checkout error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};
