const { supabase } = require('../lib/supabase');

// ── CORS headers ──────────────────────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    switch (req.method) {
      // ── GET: list teachers with device info ─────────────────────────────────
      case 'GET': {
        const { data, error } = await supabase
          .from('teachers')
          .select('*, devices(*)')
          .order('full_name', { ascending: true });

        if (error) return res.status(500).json({ error: 'Failed to fetch teachers', details: error.message });

        const teachers = (data || []).map(t => ({
          ...t,
          device: t.devices && t.devices.length > 0 ? t.devices[0] : null,
          devices: undefined,
        }));

        return res.status(200).json({ success: true, count: teachers.length, teachers });
      }

      // ── POST: create new teacher ────────────────────────────────────────────
      case 'POST': {
        const { teacher_id, full_name, department, designation, subject, phone, email, shift = 'Shift One', role = 'teacher' } = req.body || {};

        if (!teacher_id || !full_name) {
          return res.status(400).json({ error: 'teacher_id and full_name are required' });
        }

        const { data, error } = await supabase
          .from('teachers')
          .insert({
            teacher_id,
            full_name,
            department: department || null,
            designation: designation || null,
            subject: subject || null,
            phone: phone || null,
            email: email || null,
            shift: ['Shift One', 'Shift Two', 'Both'].includes(shift) ? shift : 'Shift One',
            role: role || 'teacher'
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') return res.status(409).json({ error: 'Teacher ID or Email already exists' });
          return res.status(500).json({ error: 'Failed to create teacher', details: error.message });
        }

        return res.status(201).json({ success: true, teacher: data });
      }

      // ── PUT: update teacher ─────────────────────────────────────────────────
      case 'PUT': {
        const { teacher_id, ...updates } = req.body || {};

        if (!teacher_id) return res.status(400).json({ error: 'teacher_id is required' });

        const cleanUpdates = {};
        for (const [k, v] of Object.entries(updates)) {
          if (v !== undefined) cleanUpdates[k] = v;
        }

        const { data, error } = await supabase
          .from('teachers')
          .update(cleanUpdates)
          .eq('teacher_id', teacher_id)
          .select()
          .single();

        if (error) return res.status(500).json({ error: 'Failed to update teacher', details: error.message });

        return res.status(200).json({ success: true, teacher: data });
      }

      // ── DELETE: remove teacher & cascaded records ───────────────────────────
      case 'DELETE': {
        const { teacher_id } = req.body || req.query || {};

        if (!teacher_id) return res.status(400).json({ error: 'teacher_id is required' });

        await supabase.from('devices').delete().eq('teacher_id', teacher_id);
        await supabase.from('attendance').delete().eq('teacher_id', teacher_id);
        await supabase.from('leaves').delete().eq('teacher_id', teacher_id);

        const { error } = await supabase.from('teachers').delete().eq('teacher_id', teacher_id);
        if (error) return res.status(500).json({ error: 'Failed to delete teacher', details: error.message });

        return res.status(200).json({ success: true, message: `Teacher ${teacher_id} removed` });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('teachers error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

