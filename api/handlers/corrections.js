const { supabase } = require('../lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── GET: Fetch corrections (all or filtered by teacher_id/status) ─────────
    if (req.method === 'GET') {
      const { teacher_id, status } = req.query;
      let query = supabase
        .from('attendance_corrections')
        .select('*, teachers(full_name, department, email), attendance(in_time, out_time, total_hours, status, remarks)')
        .order('created_at', { ascending: false });

      if (teacher_id) query = query.eq('teacher_id', teacher_id);
      if (status && status !== 'All') query = query.eq('status', status);

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    // ── POST: Teacher submits new correction request ──────────────────────────
    if (req.method === 'POST') {
      const { teacher_id, date, requested_in_time, requested_out_time, reason } = req.body || {};
      if (!teacher_id || !date || !reason) {
        return res.status(400).json({ error: 'teacher_id, date, and reason are required' });
      }

      // Check existing attendance record for that date
      const { data: attendance } = await supabase
        .from('attendance')
        .select('id')
        .eq('teacher_id', teacher_id)
        .eq('date', date)
        .maybeSingle();

      const { data, error } = await supabase
        .from('attendance_corrections')
        .insert({
          teacher_id,
          attendance_id: attendance?.id || null,
          date,
          requested_in_time: requested_in_time || null,
          requested_out_time: requested_out_time || null,
          reason,
          status: 'Pending'
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ success: true, message: 'Correction request submitted for Admin review', correction: data });
    }

    // ── PUT: Admin approves or rejects correction ─────────────────────────────
    if (req.method === 'PUT') {
      const { id, status, admin_notes, approved_by = 'Administrator' } = req.body || {};
      if (!id || !['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ error: 'id and status (Approved/Rejected) are required' });
      }

      // Fetch correction record
      const { data: corr, error: cErr } = await supabase
        .from('attendance_corrections')
        .select('*')
        .eq('id', id)
        .single();

      if (cErr || !corr) return res.status(404).json({ error: 'Correction request not found' });

      // Update correction status
      const { error: upErr } = await supabase
        .from('attendance_corrections')
        .update({
          status,
          admin_notes,
          approved_by,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (upErr) throw upErr;

      // If Approved, update the attendance table and write to attendance_audit_logs!
      if (status === 'Approved') {
        const { data: currentAtt } = await supabase
          .from('attendance')
          .select('*')
          .eq('teacher_id', corr.teacher_id)
          .eq('date', corr.date)
          .maybeSingle();

        const newIn = corr.requested_in_time || currentAtt?.in_time;
        const newOut = corr.requested_out_time || currentAtt?.out_time;

        let totalHours = 0;
        if (newIn && newOut) {
          totalHours = Number(((new Date(newOut) - new Date(newIn)) / (1000 * 60 * 60)).toFixed(2));
        }

        const newStatus = totalHours >= 4 ? 'Present' : (totalHours > 0 ? 'Half Day' : 'Present');

        const updatedAttendance = {
          teacher_id: corr.teacher_id,
          date: corr.date,
          in_time: newIn,
          out_time: newOut,
          total_hours: totalHours,
          status: newStatus,
          mode: 'Admin',
          remarks: `Correction Approved: ${corr.reason}`,
          updated_at: new Date().toISOString()
        };

        const { data: savedAtt, error: attErr } = await supabase
          .from('attendance')
          .upsert(updatedAttendance, { onConflict: 'teacher_id,date' })
          .select()
          .single();

        if (attErr) throw attErr;

        // Insert into immutable attendance_audit_logs
        await supabase.from('attendance_audit_logs').insert({
          attendance_id: savedAtt.id,
          teacher_id: corr.teacher_id,
          date: corr.date,
          old_values: currentAtt || {},
          new_values: updatedAttendance,
          action: 'Correction Approved',
          changed_by: approved_by,
          remarks: admin_notes || corr.reason
        });
      }

      return res.status(200).json({ success: true, message: `Correction request ${status}` });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('corrections error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};


