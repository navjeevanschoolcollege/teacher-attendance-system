const { supabase } = require('../lib/supabase');

// ── CORS headers ──────────────────────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    switch (req.method) {
      // ── GET: list devices with teacher info ─────────────────────────────────
      case 'GET': {
        const { teacher_id } = req.query || {};

        let query = supabase
          .from('devices')
          .select('*, teachers(full_name, department, designation)')
          .order('created_at', { ascending: false });

        if (teacher_id) query = query.eq('teacher_id', teacher_id);

        const { data, error } = await query;
        if (error) return res.status(500).json({ error: 'Failed to fetch devices', details: error.message });

        const devices = (data || []).map(d => ({
          ...d,
          teacher_name: d.teachers?.full_name || '',
          department: d.teachers?.department || '',
          designation: d.teachers?.designation || '',
          teachers: undefined,
        }));

        return res.status(200).json({ success: true, count: devices.length, devices });
      }

      // ── POST: register new device ──────────────────────────────────────────
      case 'POST': {
        const { teacher_id, mobile_name, mobile_model, os_version, mac_address, ip_address } = req.body || {};

        if (!teacher_id) return res.status(400).json({ error: 'teacher_id is required' });

        const { data, error } = await supabase
          .from('devices')
          .insert({
            teacher_id,
            mobile_name: mobile_name || null,
            mobile_model: mobile_model || null,
            os_version: os_version || null,
            mac_address: mac_address || null,
            ip_address: ip_address || null,
            is_approved: false,
          })
          .select()
          .single();

        if (error) return res.status(500).json({ error: 'Failed to register device', details: error.message });

        return res.status(201).json({ success: true, device: data });
      }

      // ── PUT: approve / block device ─────────────────────────────────────────
      case 'PUT': {
        const { id, is_approved } = req.body || {};

        if (!id || is_approved === undefined) {
          return res.status(400).json({ error: 'id and is_approved are required' });
        }

        const { data, error } = await supabase
          .from('devices')
          .update({ is_approved })
          .eq('id', id)
          .select()
          .single();

        if (error) return res.status(500).json({ error: 'Failed to update device', details: error.message });

        return res.status(200).json({ success: true, device: data });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('devices error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

