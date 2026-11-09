const { supabase } = require('./lib/supabase');

// ── CORS headers ──────────────────────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { date, from_date, to_date, teacher_id, department, shift } = req.query || {};

    let query = supabase
      .from('attendance')
      .select('*, teachers(full_name, department, designation, subject, phone, email, shift)')
      .order('date', { ascending: false })
      .order('in_time', { ascending: true });

    // ── Filters ───────────────────────────────────────────────────────────────
    if (date) {
      query = query.eq('date', date);
    } else if (from_date && to_date) {
      query = query.gte('date', from_date).lte('date', to_date);
    }

    if (teacher_id) {
      query = query.eq('teacher_id', teacher_id);
    }

    if (shift && shift !== 'All') {
      query = query.eq('shift', shift);
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: 'Failed to fetch attendance', details: error.message });

    // Flatten teacher info into each record for convenience
    let records = (data || []).map(row => {
      const teacher = row.teachers || {};
      return {
        ...row,
        teacher_name: teacher.full_name || '',
        department: teacher.department || '',
        designation: teacher.designation || '',
        subject: teacher.subject || '',
        phone: teacher.phone || '',
        email: teacher.email || '',
        teacher_assigned_shift: teacher.shift || 'Shift One',
        teachers: undefined,
      };
    });

    if (department && department !== 'All') {
      records = records.filter(r => r.department === department);
    }

    return res.status(200).json({ success: true, count: records.length, records });
  } catch (err) {
    console.error('attendance error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};
