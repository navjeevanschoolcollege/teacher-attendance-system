const { supabase } = require('../lib/supabase');

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
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { teacher_id, ip_address, shift } = req.body || {};
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
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // ── Campus Movement Tracker: Query last event from movement_log ───────────
    let moveQuery = supabase
      .from('movement_log')
      .select('*')
      .eq('teacher_id', teacher_id)
      .eq('date', today);

    if (shift) {
      moveQuery = moveQuery.eq('shift', shift);
    }

    const { data: moveHistory, error: mhErr } = await moveQuery.order('event_time', { ascending: false }).order('event_no', { ascending: false }).limit(1);
    if (mhErr) return res.status(500).json({ error: 'Failed to query movement history', details: mhErr.message });

    const lastEvent = moveHistory && moveHistory.length > 0 ? moveHistory[0] : null;

    if (!lastEvent || lastEvent.event_type !== 'IN') {
      return res.status(400).json({
        error: 'Teacher is already marked Outside Campus or has not checked in today.',
        last_event: lastEvent
      });
    }

    const outTimeISO = new Date().toISOString();
    const inTime = new Date(lastEvent.event_time);
    const stayMinutes = Math.max(0, Math.round((new Date(outTimeISO) - inTime) / 60000));
    const effectiveShift = lastEvent.shift;

    const outPayload = {
      teacher_id,
      date: today,
      shift: effectiveShift,
      event_no: lastEvent.event_no + 1,
      event_type: 'OUT',
      event_time: outTimeISO,
      session_no: lastEvent.session_no,
      stay_duration_minutes: stayMinutes,
      ssid: lastEvent.ssid,
      bssid: lastEvent.bssid,
      ip_address: ip_address || lastEvent.ip_address,
      mobile_name: lastEvent.mobile_name,
      mac_address: lastEvent.mac_address,
      device_id: lastEvent.device_id,
      mode: 'Manual-Web',
      remarks: `Session #${lastEvent.session_no} Completed (${Math.floor(stayMinutes / 60)}h ${stayMinutes % 60}m Inside)`
    };

    const { data: insertedOut, error: outErr } = await supabase
      .from('movement_log')
      .insert(outPayload)
      .select()
      .single();

    if (outErr) {
      console.error('Failed to insert movement_log checkout:', outErr);
      return res.status(500).json({ error: 'Failed to record checkout event', details: outErr.message });
    }

    // Fetch synchronized attendance summary
    const { data: syncedRecord } = await supabase
      .from('attendance')
      .select('*')
      .eq('teacher_id', teacher_id)
      .eq('date', today)
      .eq('shift', effectiveShift)
      .maybeSingle();

    return res.status(200).json({
      success: true,
      message: `Exit (OUT) recorded for ${effectiveShift}. Stay: ${Math.floor(stayMinutes / 60)}h ${stayMinutes % 60}m. Current status: Outside Campus.`,
      shift: effectiveShift,
      event: insertedOut,
      record: syncedRecord
    });

  } catch (err) {
    console.error('checkout error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

