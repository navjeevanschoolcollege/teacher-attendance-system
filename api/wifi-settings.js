const { supabase } = require('./lib/supabase');

// ── CORS headers ──────────────────────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    switch (req.method) {
      // ── GET: return current wifi settings ───────────────────────────────────
      case 'GET': {
        const { data, error } = await supabase
          .from('wifi_settings')
          .select('*')
          .limit(1)
          .single();

        if (error) return res.status(500).json({ error: 'Failed to fetch wifi settings', details: error.message });

        return res.status(200).json({ success: true, settings: data });
      }

      // ── PUT: update wifi settings ───────────────────────────────────────────
      case 'PUT': {
        const {
          campus_ssid,
          allowed_bssid_list,
          campus_ip_range,
          start_time,
          grace_minutes,
          end_time,
          demo_mode,
          demo_ssid,
        } = req.body || {};

        // Build update payload — only include provided fields
        const updates = {};
        if (campus_ssid !== undefined) updates.campus_ssid = campus_ssid;
        if (allowed_bssid_list !== undefined) updates.allowed_bssid_list = allowed_bssid_list;
        if (campus_ip_range !== undefined) updates.campus_ip_range = campus_ip_range;
        if (start_time !== undefined) updates.start_time = start_time;
        if (grace_minutes !== undefined) updates.grace_minutes = grace_minutes;
        if (end_time !== undefined) updates.end_time = end_time;
        if (demo_mode !== undefined) updates.demo_mode = demo_mode;
        if (demo_ssid !== undefined) updates.demo_ssid = demo_ssid;

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ error: 'No fields to update' });
        }

        // Get the current row ID first
        const { data: current, error: gErr } = await supabase
          .from('wifi_settings')
          .select('id')
          .limit(1)
          .single();

        if (gErr) return res.status(500).json({ error: 'Failed to load current settings', details: gErr.message });

        const { data, error } = await supabase
          .from('wifi_settings')
          .update(updates)
          .eq('id', current.id)
          .select()
          .single();

        if (error) return res.status(500).json({ error: 'Failed to update wifi settings', details: error.message });

        return res.status(200).json({ success: true, settings: data });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('wifi-settings error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};
