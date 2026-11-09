import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../common/LoadingSpinner';
import { FileSpreadsheet, Download, Calendar, Filter, BarChart3, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

function todayIST() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatHours(hrs) {
  if (!hrs || isNaN(hrs) || hrs <= 0) return '0h 00m';
  const min = Math.round(Number(hrs) * 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function Reports() {
  const [reportType, setReportType] = useState('monthly'); // 'daily', 'monthly', 'range'
  const [date, setDate] = useState(todayIST());
  const [month, setMonth] = useState(todayIST().slice(0, 7)); // YYYY-MM
  const [fromDate, setFromDate] = useState(todayIST());
  const [toDate, setToDate] = useState(todayIST());
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedShift, setSelectedShift] = useState('All');

  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState([]);
  const [departments, setDepartments] = useState(['All']);
  const [exporting, setExporting] = useState(false);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const { data: teachers } = await supabase.from('teachers').select('*').eq('status', 'Active');
      const depts = ['All', ...new Set((teachers || []).map(t => t.department).filter(Boolean))];
      setDepartments(depts);

      let attQuery = supabase.from('attendance').select('*');

      if (reportType === 'daily') {
        attQuery = attQuery.eq('date', date);
      } else if (reportType === 'monthly') {
        const [y, m] = month.split('-');
        const start = `${y}-${m}-01`;
        const lastDay = new Date(Number(y), Number(m), 0).getDate();
        const end = `${y}-${m}-${lastDay}`;
        attQuery = attQuery.gte('date', start).lte('date', end);
      } else if (reportType === 'range') {
        attQuery = attQuery.gte('date', fromDate).lte('date', toDate);
      }

      if (selectedShift !== 'All') {
        attQuery = attQuery.eq('shift', selectedShift);
      }

      const { data: attendance, error: aErr } = await attQuery;
      if (aErr) throw aErr;

      // Group by (Teacher ID + Shift)
      const map = {};
      (teachers || []).forEach(t => {
        const assigned = t.shift || 'Shift One';
        const shifts = assigned === 'Both' ? ['Shift One', 'Shift Two'] : [assigned];
        shifts.forEach(s => {
          if (selectedShift === 'All' || selectedShift === s) {
            const key = `${t.teacher_id}_${s}`;
            map[key] = {
              teacher_id: t.teacher_id,
              full_name: t.full_name,
              shift: s,
              department: t.department,
              designation: t.designation,
              total_days: 0,
              present: 0,
              late: 0,
              half_day: 0,
              absent: 0,
              on_leave: 0,
              total_hours: 0
            };
          }
        });
      });

      (attendance || []).forEach(a => {
        const s = a.shift || 'Shift One';
        const key = `${a.teacher_id}_${s}`;
        if (map[key]) {
          const item = map[key];
          item.total_days += 1;
          if (a.status === 'Present') item.present += 1;
          else if (a.status === 'Late') item.late += 1;
          else if (a.status === 'Half Day') item.half_day += 1;
          else if (a.status === 'Absent') item.absent += 1;
          else if (a.status === 'On Leave') item.on_leave += 1;
          item.total_hours += Number(a.total_hours || 0);
        }
      });

      setSummaryData(Object.values(map));
    } catch (err) {
      toast.error('Failed to load report: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [reportType, date, month, fromDate, toDate, selectedShift]);

  const handleDownload = () => {
    let url = '/api/export-excel?';
    if (reportType === 'daily') url += `date=${date}`;
    else if (reportType === 'monthly') url += `month=${month}`;
    else if (reportType === 'range') url += `from_date=${fromDate}&to_date=${toDate}`;

    if (selectedShift !== 'All') {
      url += `&shift=${encodeURIComponent(selectedShift)}`;
    }

    window.open(url, '_blank');
  };

  const filteredData = summaryData.filter(d => {
    return selectedDept === 'All' || d.department === selectedDept;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Two-Shift Attendance Reports & Analytics</h2>
          <p className="text-xs text-slate-500">
            Generate and export Shift One & Shift Two attendance records and monthly summaries
          </p>
        </div>

        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Download Excel Workbook</span>
        </button>
      </div>

      {/* Filter Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4">
          <span className="font-bold text-slate-700">Report Scope:</span>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
            <button
              onClick={() => setReportType('daily')}
              className={`px-3 py-1.5 rounded-md font-semibold transition ${reportType === 'daily' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
            >
              Daily Report
            </button>
            <button
              onClick={() => setReportType('monthly')}
              className={`px-3 py-1.5 rounded-md font-semibold transition ${reportType === 'monthly' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
            >
              Monthly Summary
            </button>
            <button
              onClick={() => setReportType('range')}
              className={`px-3 py-1.5 rounded-md font-semibold transition ${reportType === 'range' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
            >
              Custom Date Range
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {reportType === 'daily' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {reportType === 'monthly' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Month</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {reportType === 'range' && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Shift</label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="All">All Shifts</option>
              <option value="Shift One">Shift One (07:15 - 12:30)</option>
              <option value="Shift Two">Shift Two (12:30 - 17:00)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800">
            Summary by Teacher & Shift ({filteredData.length} entries)
          </h3>
          <span className="text-xs text-slate-400">Sheet 2 Preview</span>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <LoadingSpinner size="md" />
            <p className="text-xs text-slate-400 mt-2">Aggregating report data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Teacher ID</th>
                  <th className="py-3 px-4">Faculty Name</th>
                  <th className="py-3 px-4">Shift</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-center">Days</th>
                  <th className="py-3 px-4 text-center">Present</th>
                  <th className="py-3 px-4 text-center">Late</th>
                  <th className="py-3 px-4 text-center">Half Day</th>
                  <th className="py-3 px-4 text-center">Absent</th>
                  <th className="py-3 px-4 text-center">Total Hours</th>
                  <th className="py-3 px-4 text-center">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      No report records for the selected criteria
                    </td>
                  </tr>
                ) : (
                  filteredData.map(d => {
                    const totalDays = Math.max(d.total_days, 1);
                    const worked = d.present + d.late + (d.half_day * 0.5);
                    const pct = Math.round((worked / totalDays) * 100);

                    return (
                      <tr key={`${d.teacher_id}_${d.shift}`} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{d.teacher_id}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{d.full_name}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            d.shift === 'Shift Two'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {d.shift}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{d.department}</td>
                        <td className="py-3 px-4 text-center font-medium text-slate-800">{d.total_days}</td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-600">{d.present}</td>
                        <td className="py-3 px-4 text-center font-bold text-amber-600">{d.late}</td>
                        <td className="py-3 px-4 text-center font-bold text-orange-600">{d.half_day}</td>
                        <td className="py-3 px-4 text-center font-bold text-rose-600">{d.absent}</td>
                        <td className="py-3 px-4 text-center font-medium text-slate-800">{formatHours(d.total_hours)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            pct >= 85 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            pct >= 75 ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
