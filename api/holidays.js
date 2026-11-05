const { supabase } = require('./lib/supabase');

// ── CORS headers ──────────────────────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    switch (req.method) {
      // ── GET: list holidays ──────────────────────────────────────────────────
      case 'GET': {
        const { data, error } = await supabase
          .from('holidays')
          .select('*')
          .order('date', { ascending: true });

        if (error) return res.status(500).json({ error: 'Failed to fetch holidays', details: error.message });

        return res.status(200).json({ success: true, count: (data || []).length, holidays: data || [] });
      }

      // ── POST: add holiday ──────────────────────────────────────────────────
      case 'POST': {
        const { date, title } = req.body || {};

        if (!date || !title) return res.status(400).json({ error: 'date and title are required' });

        const { data: holiday, error: hErr } = await supabase
          .from('holidays')
          .insert({ date, title })
          .select()
          .single();

        if (hErr) return res.status(500).json({ error: 'Failed to add holiday', details: hErr.message });

        // ── Mark all teachers' attendance as 'Holiday' for this date ──────────
        const { data: teachers } = await supabase.from('teachers').select('teacher_id');

        if (teachers && teachers.length > 0) {
          for (const t of teachers) {
            const { data: existing } = await supabase
              .from('attendance')
              .select('id')
              .eq('teacher_id', t.teacher_id)
              .eq('date', date)
              .maybeSingle();

            if (existing) {
              await supabase
                .from('attendance')
                .update({ status: 'Holiday', remarks: title })
                .eq('id', existing.id);
            } else {
              await supabase
                .from('attendance')
                .insert({
                  teacher_id: t.teacher_id,
                  date,
                  status: 'Holiday',
                  mode: 'System',
                  remarks: title,
                });
            }
          }
        }

        return res.status(201).json({ success: true, holiday });
      }

      // ── DELETE: remove holiday ──────────────────────────────────────────────
      case 'DELETE': {
        const { id } = req.body || req.query || {};

        if (!id) return res.status(400).json({ error: 'id is required' });

        const { error } = await supabase.from('holidays').delete().eq('id', id);
        if (error) return res.status(500).json({ error: 'Failed to delete holiday', details: error.message });

        return res.status(200).json({ success: true, message: 'Holiday deleted' });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('holidays error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};
