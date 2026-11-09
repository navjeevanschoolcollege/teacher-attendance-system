const { supabase } = require('../lib/supabase');
const crypto = require('crypto');

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

// ── Haversine GPS Distance in Meters ───────────────────────────────────────────
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── Rotating QR Verification (2-minute window) ────────────────────────────────
function verifyRotatingQR(token, secret) {
  if (!token || !secret) return false;
  const currentWindow = Math.floor(Date.now() / 120000);
  for (let w of [currentWindow, currentWindow - 1]) {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(String(w))
      .digest('hex')
      .substring(0, 8)
      .toUpperCase();
    if (token.trim().toUpperCase() === expected) return true;
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
    const {
      teacher_id,
      ip_address,
      ssid,
      bssid,
      gps_lat,
      gps_lng,
      device_uuid,
      mobile_name,
      mac_address,
      is_mock_location = false,
      qr_token,
      mode = 'Auto-WiFi',
      force_gps_backup = false,
      requested_shift // optional override e.g. for manual testing
    } = req.body || {};

    if (!teacher_id) return res.status(400).json({ error: 'teacher_id is required' });

    // ── Fetch teacher profile to get assigned shift ───────────────────────────
    const { data: teacher, error: tErr } = await supabase
      .from('teachers')
      .select('teacher_id, full_name, department, designation, subject, shift, status')
      .eq('teacher_id', teacher_id)
      .maybeSingle();

    if (tErr) return res.status(500).json({ error: 'Failed to load teacher profile', details: tErr.message });
    if (!teacher) return res.status(404).json({ error: `Teacher ${teacher_id} not found` });

    const teacherShift = teacher.shift || 'Shift One';

    // ── Fetch wifi & security settings ─────────────────────────────────────────
    const { data: settings, error: sErr } = await supabase
      .from('wifi_settings')
      .select('*')
      .limit(1)
      .single();
    if (sErr) return res.status(500).json({ error: 'Failed to load wifi settings', details: sErr.message });

    const isDemo = settings.demo_mode === true;
    let flagged_suspicious = false;
    let suspicious_reasons = [];

    // ── 1. Mock GPS Detection Check ───────────────────────────────────────────
    if (is_mock_location) {
      flagged_suspicious = true;
      suspicious_reasons.push('Fake/Mock GPS Location Provider detected');
    }

    // ── 2. Device Identity & Anti-Proxy Verification ──────────────────────────
    if (device_uuid && !isDemo) {
      const { data: otherDevice } = await supabase
        .from('devices')
        .select('teacher_id, is_approved')
        .eq('device_uuid', device_uuid)
        .neq('teacher_id', teacher_id)
        .maybeSingle();

      if (otherDevice) {
        return res.status(403).json({
          error: `Anti-Proxy Violation: This device is already linked to another teacher (${otherDevice.teacher_id}). Proxy check-in rejected.`
        });
      }

      const { data: teacherDevice } = await supabase
        .from('devices')
        .select('*')
        .eq('teacher_id', teacher_id)
        .maybeSingle();

      if (teacherDevice && teacherDevice.device_uuid && teacherDevice.device_uuid !== device_uuid && !teacherDevice.is_approved) {
        return res.status(403).json({
          error: 'Unapproved Device: You are attempting check-in from a secondary device. Admin approval is required.'
        });
      }
    }

    // ── 3. Four-Point Anti-Cheat Verification ─────────────────────────────────
    const expectedSsid = settings.campus_ssid || 'Woxsen_Campus_WiFi';
    const demoSsid = settings.demo_ssid || 'Test_Campus_WiFi';

    let isSsidValid = false;
    if (ssid) {
      const cleanSsid = ssid.replace(/"/g, '').trim().toLowerCase();
      if (cleanSsid === expectedSsid.toLowerCase() || (isDemo && cleanSsid === demoSsid.toLowerCase())) {
        isSsidValid = true;
      }
    }

    let isBssidValid = true;
    if (settings.allowed_bssid_list && settings.allowed_bssid_list.length > 0 && bssid && !isDemo) {
      const allowed = settings.allowed_bssid_list.map(b => b.trim().toLowerCase());
      if (!allowed.includes(bssid.trim().toLowerCase())) {
        isBssidValid = false;
        flagged_suspicious = true;
        suspicious_reasons.push(`Unapproved BSSID (${bssid}). Potential rogue mobile hotspot mimicking campus SSID.`);
      }
    }

    let isIpValid = true;
    if (!isDemo && ip_address) {
      if (!isIpInCidr(ip_address, settings.campus_ip_range)) {
        isIpValid = false;
      }
    }

    const campusLat = settings.campus_lat || 17.5449;
    const campusLng = settings.campus_lng || 78.5718;
    const maxRadius = settings.geofence_radius_meters || 200;

    let isGpsInside = false;
    let gpsDistance = 0;
    if (gps_lat && gps_lng) {
      gpsDistance = calculateDistanceMeters(Number(gps_lat), Number(gps_lng), campusLat, campusLng);
      if (gpsDistance <= maxRadius) {
        isGpsInside = true;
      } else {
        flagged_suspicious = true;
        suspicious_reasons.push(`GPS outside campus geofence (${Math.round(gpsDistance)}m away, limit ${maxRadius}m)`);
      }
    }

    // Verify Rotating Staff Room QR
    let qrVerifiedAt = null;
    if (qr_token) {
      if (verifyRotatingQR(qr_token, settings.qr_secret || 'CAMPUS_STAFFROOM_QR_KEY_2026')) {
        qrVerifiedAt = new Date().toISOString();
      } else {
        return res.status(400).json({ error: 'Expired or invalid Staff Room QR Code. Please scan the current live QR on display.' });
      }
    }

    let effectiveMode = mode;
    let remarks = null;

    if (force_gps_backup || (!isSsidValid && isGpsInside)) {
      effectiveMode = 'GPS Backup';
      remarks = `GPS Backup Check-In (Distance: ${Math.round(gpsDistance)}m from campus center)`;
    } else if (!isDemo) {
      if (!isSsidValid) {
        return res.status(403).json({ error: `Not connected to Campus WiFi (${expectedSsid}). Check-in denied.` });
      }
      if (!isBssidValid) {
        return res.status(403).json({ error: 'Rogue or unapproved WiFi router detected. Connect to official campus access points.' });
      }
      if (!isIpValid && ip_address) {
        return res.status(403).json({ error: 'Device IP is outside campus IP subnet range.' });
      }
    }

    // ── 4. Two Shifts Logic ───────────────────────────────────────────────────
    const today = todayIST();
    const now = nowIST();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Determine target shift based on teacher's assigned shift FIRST
    let effectiveShift = 'Shift One';
    if (requested_shift && ['Shift One', 'Shift Two'].includes(requested_shift)) {
      effectiveShift = requested_shift;
    } else if (teacherShift === 'Shift One') {
      // Always Shift One, even if connecting at 12:20 PM
      effectiveShift = 'Shift One';
    } else if (teacherShift === 'Shift Two') {
      // Always Shift Two
      effectiveShift = 'Shift Two';
    } else if (teacherShift === 'Both') {
      // Teacher works Both shifts:
      // Fetch any existing records for today
      const { data: todayRecords } = await supabase
        .from('attendance')
        .select('shift, in_time, out_time')
        .eq('teacher_id', teacher_id)
        .eq('date', today);

      const hasShiftOne = todayRecords?.some(r => r.shift === 'Shift One' && r.in_time);
      const hasShiftTwo = todayRecords?.some(r => r.shift === 'Shift Two' && r.in_time);

      const shiftOneEndMin = timeToMinutes(settings.shift_one_end || '12:30:00'); // 12:30 PM = 750

      if (!hasShiftOne && currentMinutes < shiftOneEndMin) {
        effectiveShift = 'Shift One';
      } else if (hasShiftOne && !hasShiftTwo) {
        // Shift One already marked. If >= 12:00 PM, enter Shift Two
        effectiveShift = 'Shift Two';
      } else if (currentMinutes >= shiftOneEndMin) {
        effectiveShift = 'Shift Two';
      } else {
        effectiveShift = 'Shift One';
      }
    }

    // ── 5. Campus Movement Tracker: Log Entry into movement_log ──────────────
    const serverNowISO = new Date().toISOString();

    // Query last event from movement_log for this teacher, date & shift
    const { data: lastEvent } = await supabase
      .from('movement_log')
      .select('*')
      .eq('teacher_id', teacher_id)
      .eq('date', today)
      .eq('shift', effectiveShift)
      .order('event_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastEvent && lastEvent.event_type === 'IN') {
      // Already marked IN (Inside Campus). Update heartbeat last_wifi_seen_at
      await supabase
        .from('attendance')
        .update({
          last_wifi_seen_at: serverNowISO,
          updated_at: serverNowISO
        })
        .eq('teacher_id', teacher_id)
        .eq('date', today)
        .eq('shift', effectiveShift);

      const { data: currentAtt } = await supabase
        .from('attendance')
        .select('*')
        .eq('teacher_id', teacher_id)
        .eq('date', today)
        .eq('shift', effectiveShift)
        .maybeSingle();

      return res.status(200).json({
        success: true,
        message: `Already marked Inside Campus for ${effectiveShift}. Heartbeat updated.`,
        shift: effectiveShift,
        record: currentAtt,
        last_event: lastEvent
      });
    }

    // New Entry (IN): Next event_no, next session_no
    const nextEventNo = (lastEvent?.event_no || 0) + 1;
    const nextSessionNo = (lastEvent?.session_no || 0) + 1;

    const movePayload = {
      teacher_id,
      date: today,
      shift: effectiveShift,
      event_no: nextEventNo,
      event_type: 'IN',
      event_time: serverNowISO,
      session_no: nextSessionNo,
      stay_duration_minutes: 0,
      ssid: ssid || expectedSsid,
      bssid: bssid || null,
      ip_address: ip_address || null,
      gps_lat: gps_lat ? Number(gps_lat) : null,
      gps_lng: gps_lng ? Number(gps_lng) : null,
      mobile_name: mobile_name || null,
      mac_address: mac_address || bssid || null,
      device_id: device_uuid || null,
      mode: effectiveMode,
      remarks: remarks || (nextEventNo > 1 ? `Re-entered Campus (Session #${nextSessionNo})` : `Morning Arrival (${effectiveShift})`)
    };

    const { data: insertedEvent, error: mErr } = await supabase
      .from('movement_log')
      .insert(movePayload)
      .select()
      .single();

    if (mErr) {
      console.error('Failed to insert movement_log event:', mErr);
      return res.status(500).json({ error: 'Failed to record movement event', details: mErr.message });
    }

    // Fetch synchronized attendance summary record (updated by trigger)
    const { data: syncedRecord } = await supabase
      .from('attendance')
      .select('*')
      .eq('teacher_id', teacher_id)
      .eq('date', today)
      .eq('shift', effectiveShift)
      .maybeSingle();

    return res.status(200).json({
      success: true,
      message: `Entry (IN) recorded for ${effectiveShift}. Current status: Inside Campus.`,
      shift: effectiveShift,
      event: insertedEvent,
      record: syncedRecord,
      flagged_suspicious
    });

  } catch (err) {
    console.error('checkin error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

