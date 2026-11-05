const ExcelJS = require('exceljs');
const { supabase } = require('./lib/supabase');

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

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { date, from_date, to_date, month, upload } = req.query;

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
      .select('*, teachers(full_name, department, designation, subject), devices:teacher_id(mobile_name, mobile_model, mac_address, ip_address)');

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

    const { data: attendanceList, error: aErr } = await attQuery.order('date', { ascending: false });
    if (aErr) throw aErr;

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Campus WiFi Teacher Attendance System';
    workbook.lastModifiedBy = 'Campus WiFi System';
    workbook.created = new Date();

    // ============================================================
    // SHEET 1: Daily Attendance
    // ============================================================
    const sheet1 = workbook.addWorksheet('Daily Attendance', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    });

    const sheet1Columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Day', key: 'day', width: 14 },
      { header: 'Teacher ID', key: 'teacher_id', width: 14 },
      { header: 'Teacher Name', key: 'teacher_name', width: 22 },
      { header: 'Department', key: 'department', width: 16 },
      { header: 'Designation', key: 'designation', width: 20 },
      { header: 'Subject', key: 'subject', width: 18 },
      { header: 'Mobile Name', key: 'mobile_name', width: 22 },
      { header: 'Mobile Model', key: 'mobile_model', width: 18 },
      { header: 'MAC Address', key: 'mac_address', width: 20 },
      { header: 'IP Address', key: 'ip_address', width: 16 },
      { header: 'WiFi SSID', key: 'ssid', width: 22 },
      { header: 'IN Time', key: 'in_time', width: 14 },
      { header: 'OUT Time', key: 'out_time', width: 14 },
      { header: 'Total Working Hours', key: 'total_hours', width: 20 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Late By (mins)', key: 'late_by', width: 16 },
      { header: 'Early Out By (mins)', key: 'early_out', width: 18 },
      { header: 'Mode', key: 'mode', width: 14 },
      { header: 'Remarks', key: 'remarks', width: 20 },
    ];
    sheet1.columns = sheet1Columns;

    // Header styling
    const headerRow1 = sheet1.getRow(1);
    headerRow1.height = 26;
    headerRow1.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' } // Dark blue
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Populate Sheet 1
    (attendanceList || []).forEach((row, idx) => {
      const teacher = row.teachers || {};
      const dev = (teachers.find(t => t.teacher_id === row.teacher_id)?.devices?.[0]) || {};
      
      const addedRow = sheet1.addRow({
        sno: idx + 1,
        date: formatDate(row.date),
        day: getDayName(row.date),
        teacher_id: row.teacher_id || '-',
        teacher_name: teacher.full_name || '-',
        department: teacher.department || '-',
        designation: teacher.designation || '-',
        subject: teacher.subject || '-',
        mobile_name: row.mobile_name || dev.mobile_name || '-',
        mobile_model: dev.mobile_model || '-',
        mac_address: row.mac_address || dev.mac_address || '-',
        ip_address: row.ip_address || dev.ip_address || '-',
        ssid: row.ssid || 'Woxsen_Campus_WiFi',
        in_time: formatTime(row.in_time),
        out_time: formatTime(row.out_time),
        total_hours: formatHours(row.total_hours),
        status: row.status || 'Absent',
        late_by: row.late_by_minutes || 0,
        early_out: row.early_out_by_minutes || 0,
        mode: row.mode || 'Auto-WiFi',
        remarks: row.remarks || '-'
      });

      // Status color coding
      const statusCell = addedRow.getCell('status');
      const status = row.status;
      if (status === 'Present') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }; // Light green
        statusCell.font = { color: { argb: 'FF006100' }, bold: true };
      } else if (status === 'Late') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } }; // Light yellow/orange
        statusCell.font = { color: { argb: 'FF9C6500' }, bold: true };
      } else if (status === 'Absent') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }; // Light red
        statusCell.font = { color: { argb: 'FF9C0006' }, bold: true };
      } else if (status === 'On Leave') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C6E7' } }; // Light blue
        statusCell.font = { color: { argb: 'FF1F497D' }, bold: true };
      }

      addedRow.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      addedRow.getCell('sno').alignment = { vertical: 'middle', horizontal: 'center' };
      addedRow.getCell('date').alignment = { vertical: 'middle', horizontal: 'center' };
      addedRow.getCell('in_time').alignment = { vertical: 'middle', horizontal: 'center' };
      addedRow.getCell('out_time').alignment = { vertical: 'middle', horizontal: 'center' };
      addedRow.getCell('total_hours').alignment = { vertical: 'middle', horizontal: 'center' };
      statusCell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    sheet1.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet1Columns.length }
    };

    // ============================================================
    // SHEET 2: Monthly Summary
    // ============================================================
    const sheet2 = workbook.addWorksheet('Monthly Summary', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    });

    const sheet2Columns = [
      { header: 'Teacher ID', key: 'teacher_id', width: 14 },
      { header: 'Teacher Name', key: 'teacher_name', width: 22 },
      { header: 'Department', key: 'department', width: 16 },
      { header: 'Total Working Days', key: 'total_working_days', width: 18 },
      { header: 'Present', key: 'present', width: 12 },
      { header: 'Late', key: 'late', width: 12 },
      { header: 'Half Day', key: 'half_day', width: 12 },
      { header: 'Absent', key: 'absent', width: 12 },
      { header: 'On Leave', key: 'on_leave', width: 12 },
      { header: 'Total Hours', key: 'total_hours', width: 16 },
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

    // Calculate summary per teacher
    const summaryMap = {};
    (teachers || []).forEach(t => {
      summaryMap[t.teacher_id] = {
        teacher_id: t.teacher_id,
        teacher_name: t.full_name,
        department: t.department,
        total_days: 0,
        present: 0,
        late: 0,
        half_day: 0,
        absent: 0,
        on_leave: 0,
        total_hours: 0
      };
    });

    (attendanceList || []).forEach(r => {
      if (summaryMap[r.teacher_id]) {
        const item = summaryMap[r.teacher_id];
        item.total_days += 1;
        if (r.status === 'Present') item.present += 1;
        else if (r.status === 'Late') item.late += 1;
        else if (r.status === 'Half Day') item.half_day += 1;
        else if (r.status === 'Absent') item.absent += 1;
        else if (r.status === 'On Leave') item.on_leave += 1;
        item.total_hours += Number(r.total_hours || 0);
      }
    });

    Object.values(summaryMap).forEach(s => {
      const workingDays = s.total_days || 1;
      const effectivePresent = s.present + s.late + (s.half_day * 0.5);
      const pct = Math.min(100, Math.round((effectivePresent / workingDays) * 100));

      const added = sheet2.addRow({
        teacher_id: s.teacher_id,
        teacher_name: s.teacher_name,
        department: s.department,
        total_working_days: s.total_days,
        present: s.present,
        late: s.late,
        half_day: s.half_day,
        absent: s.absent,
        on_leave: s.on_leave,
        total_hours: formatHours(s.total_hours),
        attendance_pct: `${pct}%`
      });

      added.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      added.getCell('teacher_name').alignment = { vertical: 'middle', horizontal: 'left' };
      added.getCell('department').alignment = { vertical: 'middle', horizontal: 'left' };
    });

    sheet2.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet2Columns.length }
    };

    // ============================================================
    // SHEET 3: Teacher Master List
    // ============================================================
    const sheet3 = workbook.addWorksheet('Teacher Master List', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    });

    const sheet3Columns = [
      { header: 'Teacher ID', key: 'teacher_id', width: 14 },
      { header: 'Teacher Name', key: 'full_name', width: 22 },
      { header: 'Department', key: 'department', width: 16 },
      { header: 'Designation', key: 'designation', width: 20 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Mobile Name', key: 'mobile_name', width: 22 },
      { header: 'MAC Address', key: 'mac_address', width: 20 },
      { header: 'Status', key: 'status', width: 14 }
    ];
    sheet3.columns = sheet3Columns;

    const headerRow3 = sheet3.getRow(1);
    headerRow3.height = 26;
    headerRow3.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    (teachers || []).forEach(t => {
      const dev = t.devices?.[0] || {};
      const added = sheet3.addRow({
        teacher_id: t.teacher_id,
        full_name: t.full_name,
        department: t.department,
        designation: t.designation || '-',
        phone: t.phone || '-',
        email: t.email,
        mobile_name: dev.mobile_name || 'Not Registered',
        mac_address: dev.mac_address || 'Not Registered',
        status: t.status || 'Active'
      });

      added.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      added.getCell('teacher_id').alignment = { vertical: 'middle', horizontal: 'center' };
      added.getCell('status').alignment = { vertical: 'middle', horizontal: 'center' };
    });

    sheet3.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet3Columns.length }
    };

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `attendance_${targetDate || 'report'}.xlsx`;

    // If upload to Supabase Storage requested (e.g. from GitHub Actions daily run)
    if (upload === 'true' || upload === true) {
      const { data: uploadData, error: upErr } = await supabase.storage
        .from('reports')
        .upload(filename, buffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: true
        });

      if (upErr) {
        return res.status(500).json({ error: 'Failed to upload to storage', details: upErr.message });
      }

      const { data: pubUrl } = supabase.storage.from('reports').getPublicUrl(filename);
      return res.status(200).json({
        success: true,
        filename,
        url: pubUrl?.publicUrl || null,
        message: 'Daily report generated and saved to Supabase Storage'
      });
    }

    // Direct HTTP download response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(Buffer.from(buffer));

  } catch (err) {
    console.error('Excel generation error:', err);
    return res.status(500).json({ error: 'Failed to generate Excel report', message: err.message });
  }
};
