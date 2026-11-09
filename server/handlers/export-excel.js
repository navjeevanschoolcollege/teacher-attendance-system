const ExcelJS = require('exceljs');
const { supabase } = require('../lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function getDayName(dateStr) {
  if (!dateStr) return '-';
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const d = new Date(dateStr);
  return days[d.getDay()];
}

function formatTime(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatHours(hoursNum) {
  if (!hoursNum || isNaN(hoursNum) || hoursNum <= 0) return '0h 00m';
  const totalMinutes = Math.round(Number(hoursNum) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatMinutes(mins) {
  if (!mins || isNaN(mins) || mins <= 0) return '-';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { date, from_date, to_date, month, shift, upload } = req.query;

    let targetDate = date;
    if (!targetDate && !from_date && !month) {
      const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      targetDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    // 1. Fetch Teachers and Devices
    const { data: teachers, error: tErr } = await supabase
      .from('teachers')
      .select('*, devices(*)');
    if (tErr) throw tErr;

    // 2. Fetch Attendance
    let attQuery = supabase
      .from('attendance')
      .select('*, teachers(full_name, department, designation, subject, shift), devices:teacher_id(mobile_name, mobile_model, mac_address, ip_address)');

    if (month) {
      const [y, m] = month.split('-');
      const startOfMonth = `${y}-${m}-01`;
      const lastDay = new Date(Number(y), Number(m), 0).getDate();
      const endOfMonth = `${y}-${m}-${lastDay}`;
      attQuery = attQuery.gte('date', startOfMonth).lte('date', endOfMonth);
    } else if (from_date && to_date) {
      attQuery = attQuery.gte('date', from_date).lte('date', to_date);
    } else if (targetDate) {
      attQuery = attQuery.eq('date', targetDate);
    }

    if (shift && shift !== 'All') {
      attQuery = attQuery.eq('shift', shift);
    }

    const { data: attendanceList, error: aErr } = await attQuery.order('date', { ascending: false }).order('in_time', { ascending: true });
    if (aErr) throw aErr;

    // 3. Fetch Movement Logs for Sheet 4
    let moveQuery = supabase
      .from('movement_log')
      .select('*, teachers(full_name, department)');

    if (month) {
      const [y, m] = month.split('-');
      const startOfMonth = `${y}-${m}-01`;
      const lastDay = new Date(Number(y), Number(m), 0).getDate();
      const endOfMonth = `${y}-${m}-${lastDay}`;
      moveQuery = moveQuery.gte('date', startOfMonth).lte('date', endOfMonth);
    } else if (from_date && to_date) {
      moveQuery = moveQuery.gte('date', from_date).lte('date', to_date);
    } else if (targetDate) {
      moveQuery = moveQuery.eq('date', targetDate);
    }

    if (shift && shift !== 'All') {
      moveQuery = moveQuery.eq('shift', shift);
    }

    const { data: movementLogs, error: mErr } = await moveQuery.order('date', { ascending: false }).order('event_time', { ascending: true }).order('event_no', { ascending: true });
    if (mErr) throw mErr;

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Campus WiFi Teacher Attendance & Movement Tracker';
    workbook.lastModifiedBy = 'Campus WiFi Tracker';
    workbook.created = new Date();

    // ============================================================
    // SHEET 1: Daily Attendance (with Tracker Metrics)
    // ============================================================
    const sheet1 = workbook.addWorksheet('Daily Attendance', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    });

    const sheet1Columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Day', key: 'day', width: 14 },
      { header: 'Shift', key: 'shift', width: 14 },
      { header: 'Teacher ID', key: 'teacher_id', width: 14 },
      { header: 'Teacher Name', key: 'teacher_name', width: 22 },
      { header: 'Department', key: 'department', width: 16 },
      { header: 'Designation', key: 'designation', width: 20 },
      { header: 'Subject', key: 'subject', width: 18 },
      { header: 'Mobile Name', key: 'mobile_name', width: 22 },
      { header: 'MAC Address', key: 'mac_address', width: 20 },
      { header: 'IP Address', key: 'ip_address', width: 16 },
      { header: 'WiFi SSID', key: 'ssid', width: 22 },
      { header: 'First IN', key: 'first_in', width: 14 },
      { header: 'Last OUT', key: 'last_out', width: 14 },
      { header: 'Total Entries', key: 'total_entries', width: 14 },
      { header: 'Total Exits', key: 'total_exits', width: 14 },
      { header: 'Total In-Campus Hours', key: 'total_in_campus_hours', width: 22 },
      { header: 'Total Out / Break Time', key: 'total_out_break_hours', width: 22 },
      { header: 'Total Working Hours', key: 'total_hours', width: 20 },
      { header: 'Current Presence', key: 'current_presence', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Late By (mins)', key: 'late_by', width: 16 },
      { header: 'Early Out By (mins)', key: 'early_out', width: 18 },
      { header: 'Mode', key: 'mode', width: 14 },
      { header: 'Remarks', key: 'remarks', width: 26 },
    ];
    sheet1.columns = sheet1Columns;

    const headerRow1 = sheet1.getRow(1);
    headerRow1.height = 28;
    headerRow1.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' } // Navy blue
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    (attendanceList || []).forEach((row, idx) => {
      const teacher = row.teachers || {};
      const dev = (row.devices && row.devices.length > 0) ? row.devices[0] : (row.devices || {});

      const status = row.status || 'Absent';
      const addedRow = sheet1.addRow({
        sno: idx + 1,
        date: formatDate(row.date),
        day: getDayName(row.date),
        shift: row.shift || teacher.shift || 'Shift One',
        teacher_id: row.teacher_id,
        teacher_name: teacher.full_name || '-',
        department: teacher.department || '-',
        designation: teacher.designation || '-',
        subject: teacher.subject || '-',
        mobile_name: row.mobile_name || dev.mobile_name || '-',
        mac_address: row.mac_address || dev.mac_address || '-',
        ip_address: row.ip_address || dev.ip_address || '-',
        ssid: row.ssid || 'Campus-Staff-WiFi',
        first_in: formatTime(row.in_time),
        last_out: formatTime(row.out_time),
        total_entries: row.total_entries || (row.in_time ? 1 : 0),
        total_exits: row.total_exits || (row.out_time ? 1 : 0),
        total_in_campus_hours: formatHours(row.total_in_campus_hours || row.total_hours),
        total_out_break_hours: formatHours(row.total_out_break_hours || 0),
        total_hours: formatHours(row.total_hours),
        current_presence: row.current_presence_status || (row.out_time ? 'Outside Campus' : (row.in_time ? 'Inside Campus' : 'Outside Campus')),
        status,
        late_by: row.late_by_minutes || 0,
        early_out: row.early_out_by_minutes || 0,
        mode: row.mode || 'Auto-WiFi',
        remarks: row.remarks || '-'
      });

      // Status pill coloring
      const statusCell = addedRow.getCell('status');
      if (status === 'Present') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        statusCell.font = { color: { argb: 'FF065F46' }, bold: true };
      } else if (status === 'Late') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        statusCell.font = { color: { argb: 'FF92400E' }, bold: true };
      } else if (status === 'Half Day') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        statusCell.font = { color: { argb: 'FF991B1B' }, bold: true };
      } else if (status === 'Absent') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        statusCell.font = { color: { argb: 'FF991B1B' }, bold: true };
      }

      addedRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      });
      addedRow.getCell('sno').alignment = { vertical: 'middle', horizontal: 'center' };
      addedRow.getCell('date').alignment = { vertical: 'middle', horizontal: 'center' };
      addedRow.getCell('shift').alignment = { vertical: 'middle', horizontal: 'center' };
      addedRow.getCell('first_in').alignment = { vertical: 'middle', horizontal: 'center' };
      addedRow.getCell('last_out').alignment = { vertical: 'middle', horizontal: 'center' };
      addedRow.getCell('total_entries').alignment = { vertical: 'middle', horizontal: 'center' };
      addedRow.getCell('total_exits').alignment = { vertical: 'middle', horizontal: 'center' };
      addedRow.getCell('total_in_campus_hours').alignment = { vertical: 'middle', horizontal: 'center' };
      addedRow.getCell('total_out_break_hours').alignment = { vertical: 'middle', horizontal: 'center' };
      addedRow.getCell('current_presence').alignment = { vertical: 'middle', horizontal: 'center' };
      statusCell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    sheet1.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet1Columns.length }
    };

    // ============================================================
    // SHEET 2: Monthly Summary Grouped by Shift (with Movement Averages)
    // ============================================================
    const sheet2 = workbook.addWorksheet('Monthly Summary', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    });

    const sheet2Columns = [
      { header: 'Teacher ID', key: 'teacher_id', width: 14 },
      { header: 'Teacher Name', key: 'teacher_name', width: 22 },
      { header: 'Shift', key: 'shift', width: 14 },
      { header: 'Department', key: 'department', width: 16 },
      { header: 'Total Working Days', key: 'total_working_days', width: 18 },
      { header: 'Present', key: 'present', width: 12 },
      { header: 'Late', key: 'late', width: 12 },
      { header: 'Half Day', key: 'half_day', width: 12 },
      { header: 'Absent', key: 'absent', width: 12 },
      { header: 'On Leave', key: 'on_leave', width: 12 },
      { header: 'Avg Entries / Day', key: 'avg_entries', width: 18 },
      { header: 'Avg In-Campus Hrs / Day', key: 'avg_in_campus_hours', width: 24 },
      { header: 'Total In-Campus Hours', key: 'total_hours', width: 22 },
      { header: 'Attendance %', key: 'attendance_pct', width: 16 }
    ];
    sheet2.columns = sheet2Columns;

    const headerRow2 = sheet2.getRow(1);
    headerRow2.height = 26;
    headerRow2.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const summaryMap = {};
    (teachers || []).forEach(t => {
      const assigned = t.shift || 'Shift One';
      const shifts = assigned === 'Both' ? ['Shift One', 'Shift Two'] : [assigned];
      shifts.forEach(s => {
        const key = `${t.teacher_id}_${s}`;
        summaryMap[key] = {
          teacher_id: t.teacher_id,
          teacher_name: t.full_name,
          shift: s,
          department: t.department,
          total_days: 0,
          present: 0,
          late: 0,
          half_day: 0,
          absent: 0,
          on_leave: 0,
          total_entries: 0,
          total_hours: 0
        };
      });
    });

    (attendanceList || []).forEach(att => {
      const s = att.shift || 'Shift One';
      const key = `${att.teacher_id}_${s}`;
      if (!summaryMap[key]) {
        summaryMap[key] = {
          teacher_id: att.teacher_id,
          teacher_name: att.teachers?.full_name || '-',
          shift: s,
          department: att.teachers?.department || '-',
          total_days: 0,
          present: 0,
          late: 0,
          half_day: 0,
          absent: 0,
          on_leave: 0,
          total_entries: 0,
          total_hours: 0
        };
      }
      const item = summaryMap[key];
      item.total_days += 1;
      if (att.status === 'Present') item.present += 1;
      else if (att.status === 'Late') item.late += 1;
      else if (att.status === 'Half Day') item.half_day += 1;
      else if (att.status === 'Absent') item.absent += 1;
      else if (att.status === 'On Leave') item.on_leave += 1;

      item.total_entries += Number(att.total_entries || (att.in_time ? 1 : 0));
      item.total_hours += Number(att.total_in_campus_hours || att.total_hours || 0);
    });

    Object.values(summaryMap).forEach(s => {
      const workedDays = s.present + s.late + (s.half_day * 0.5);
      const totalDays = Math.max(s.total_days, 1);
      const pct = Math.round((workedDays / totalDays) * 100);
      const avgEntries = (s.total_entries / totalDays).toFixed(1);
      const avgHours = formatHours(s.total_hours / totalDays);

      const r = sheet2.addRow({
        teacher_id: s.teacher_id,
        teacher_name: s.teacher_name,
        shift: s.shift,
        department: s.department,
        total_working_days: s.total_days,
        present: s.present,
        late: s.late,
        half_day: s.half_day,
        absent: s.absent,
        on_leave: s.on_leave,
        avg_entries: avgEntries,
        avg_in_campus_hours: avgHours,
        total_hours: formatHours(s.total_hours),
        attendance_pct: `${pct}%`
      });

      r.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      });
      r.getCell('shift').alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell('total_working_days').alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell('present').alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell('late').alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell('half_day').alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell('absent').alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell('on_leave').alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell('avg_entries').alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell('avg_in_campus_hours').alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell('total_hours').alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell('attendance_pct').alignment = { vertical: 'middle', horizontal: 'center' };
    });

    sheet2.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet2Columns.length }
    };

    // ============================================================
    // SHEET 4: Movement Log (Exact 18 Columns)
    // S.No | Date | Day | Shift | Teacher ID | Teacher Name | Department | Event No | Session No | Event | Event Time | Total Stay in Session | Mobile Name | MAC Address | IP Address | WiFi SSID | Mode | Remarks
    // ============================================================
    const sheet4 = workbook.addWorksheet('Movement Log', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    });

    const sheet4Columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Day', key: 'day', width: 14 },
      { header: 'Shift', key: 'shift', width: 14 },
      { header: 'Teacher ID', key: 'teacher_id', width: 14 },
      { header: 'Teacher Name', key: 'teacher_name', width: 22 },
      { header: 'Department', key: 'department', width: 16 },
      { header: 'Event No', key: 'event_no', width: 12 },
      { header: 'Session No', key: 'session_no', width: 14 },
      { header: 'Event', key: 'event', width: 12 },
      { header: 'Event Time', key: 'event_time', width: 16 },
      { header: 'Total Stay in Session', key: 'total_stay', width: 22 },
      { header: 'Mobile Name', key: 'mobile_name', width: 22 },
      { header: 'MAC Address', key: 'mac_address', width: 20 },
      { header: 'IP Address', key: 'ip_address', width: 16 },
      { header: 'WiFi SSID', key: 'ssid', width: 22 },
      { header: 'Mode', key: 'mode', width: 14 },
      { header: 'Remarks', key: 'remarks', width: 28 }
    ];
    sheet4.columns = sheet4Columns;

    const headerRow4 = sheet4.getRow(1);
    headerRow4.height = 28;
    headerRow4.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F766E' } // Deep teal
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    (movementLogs || []).forEach((m, idx) => {
      const teacher = m.teachers || {};
      const stayStr = m.event_type === 'OUT' ? formatMinutes(m.stay_duration_minutes) : '-';

      const row = sheet4.addRow({
        sno: idx + 1,
        date: formatDate(m.date),
        day: getDayName(m.date),
        shift: m.shift,
        teacher_id: m.teacher_id,
        teacher_name: teacher.full_name || '-',
        department: teacher.department || '-',
        event_no: m.event_no,
        session_no: m.session_no,
        event: m.event_type,
        event_time: formatTime(m.event_time),
        total_stay: stayStr,
        mobile_name: m.mobile_name || '-',
        mac_address: m.mac_address || '-',
        ip_address: m.ip_address || '-',
        ssid: m.ssid || 'Campus-Staff-WiFi',
        mode: m.mode || 'Auto-WiFi',
        remarks: m.remarks || '-'
      });

      const eventCell = row.getCell('event');
      if (m.event_type === 'IN') {
        eventCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        eventCell.font = { color: { argb: 'FF065F46' }, bold: true };
      } else {
        eventCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        eventCell.font = { color: { argb: 'FF991B1B' }, bold: true };
      }

      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      });
      row.getCell('sno').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('date').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('shift').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('event_no').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('session_no').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('event_time').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('total_stay').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('mode').alignment = { vertical: 'middle', horizontal: 'center' };
      eventCell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    sheet4.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet4Columns.length }
    };

    // Build filename
    const filename = `Campus_Attendance_Movement_Report_${targetDate || month || 'Latest'}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();

    if (upload === 'true') {
      const { data: uploadData, error: upErr } = await supabase.storage
        .from('reports')
        .upload(`daily/${filename}`, buffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: true
        });

      if (upErr) {
        console.warn('Storage upload error (ignoring if bucket not set):', upErr.message);
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(Buffer.from(buffer));

  } catch (err) {
    console.error('Excel export error:', err);
    return res.status(500).json({ error: 'Failed to generate Excel', details: err.message });
  }
};

