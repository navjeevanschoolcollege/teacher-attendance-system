const { supabase } = require('./lib/supabase');

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
      // ── GET: list leaves ────────────────────────────────────────────────────
      case 'GET': {
        const { teacher_id, status } = req.query || {};

        let query = supabase
          .from('leaves')
          .select('*, teachers(full_name, department, designation)')
          .order('created_at', { ascending: false });

        if (teacher_id) query = query.eq('teacher_id', teacher_id);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) return res.status(500).json({ error: 'Failed to fetch leaves', details: error.message });

        const leaves = (data || []).map(l => ({
          ...l,
          teacher_name: l.teachers?.full_name || '',
          department: l.teachers?.department || '',
          designation: l.teachers?.designation || '',
          teachers: undefined,
        }));

        return res.status(200).json({ success: true, count: leaves.length, leaves });
      }

      // ── POST: apply for leave ──────────────────────────────────────────────
      case 'POST': {
        const { teacher_id, from_date, to_date, reason } = req.body || {};

        if (!teacher_id || !from_date || !to_date) {
          return res.status(400).json({ error: 'teacher_id, from_date and to_date are required' });
        }

        const { data, error } = await supabase
          .from('leaves')
          .insert({
            teacher_id,
            from_date,
            to_date,
            reason: reason || null,
            status: 'Pending',
          })
          .select()
          .single();

        if (error) return res.status(500).json({ error: 'Failed to apply leave', details: error.message });

        return res.status(201).json({ success: true, leave: data });
      }

      // ── PUT: approve / reject leave ─────────────────────────────────────────
      case 'PUT': {
        const { id, status, approved_by } = req.body || {};

        if (!id || !status) return res.status(400).json({ error: 'id and status are required' });
        if (!['Approved', 'Rejected'].includes(status)) {
          return res.status(400).json({ error: 'status must be Approved or Rejected' });
        }

        const { data: leave, error: lErr } = await supabase
          .from('leaves')
          .update({ status, approved_by: approved_by || null })
          .eq('id', id)
          .select()
          .single();

        if (lErr) return res.status(500).json({ error: 'Failed to update leave', details: lErr.message });

        // ── If approved, mark attendance as 'On Leave' for those dates ────────
        if (status === 'Approved') {
          const fromDate = new Date(leave.from_date);
          const toDate = new Date(leave.to_date);

          const dates = [];
          for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            dates.push(`${yyyy}-${mm}-${dd}`);
          }

          for (const date of dates) {
            // Check if record exists
            const { data: existing } = await supabase
              .from('attendance')
              .select('id')
              .eq('teacher_id', leave.teacher_id)
              .eq('date', date)
              .maybeSingle();

            if (existing) {
              await supabase
                .from('attendance')
                .update({ status: 'On Leave', remarks: `Leave approved by ${approved_by || 'admin'}` })
                .eq('id', existing.id);
            } else {
              await supabase
                .from('attendance')
                .insert({
                  teacher_id: leave.teacher_id,
                  date,
                  status: 'On Leave',
                  mode: 'System',
                  remarks: `Leave approved by ${approved_by || 'admin'}`,
                });
            }
          }
        }

        return res.status(200).json({ success: true, leave });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('leaves error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};
