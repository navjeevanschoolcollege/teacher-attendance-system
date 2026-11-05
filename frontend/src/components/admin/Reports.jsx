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

      const { data: attendance, error: aErr } = await attQuery;
      if (aErr) throw aErr;

      // Group by teacher
      const map = {};
      (teachers || []).forEach(t => {
        map[t.teacher_id] = {
          teacher_id: t.teacher_id,
          full_name: t.full_name,
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
      });

      (attendance || []).forEach(a => {
        if (map[a.teacher_id]) {
          const item = map[a.teacher_id];
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
  }, [reportType, date, month, fromDate, toDate]);

  const handleDownload = () => {
    let url = '/api/export-excel?';
    if (reportType === 'daily') {
      url += `date=${date}`;
    } else if (reportType === 'monthly') {
      url += `month=${month}`;
    } else if (reportType === 'range') {
      url += `from_date=${fromDate}&to_date=${toDate}`;
    }
    window.open(url, '_blank');
  };

  const filtered = summaryData.filter(s => {
    if (selectedDept === 'All') return true;
    return s.department === selectedDept;
  });

  const totalWorkingDays = Math.max(1, ...filtered.map(f => f.total_days));
  const avgAttendance = filtered.length > 0
    ? Math.round(
        (filtered.reduce((acc, f) => {
          const eff = f.present + f.late + f.half_day * 0.5;
          const pct = f.total_days > 0 ? (eff / f.total_days) * 100 : 0;
          return acc + pct;
        }, 0) /
          filtered.length)
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Attendance Reports & Analytics</h2>
          <p className="text-xs text-slate-500">
            Generate and download Excel (.xlsx) reports with Daily Attendance, Monthly Summary, and Master sheets
          </p>
        </div>

        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Download Excel (.xlsx)</span>
        </button>
      </div>

      {/* Control / Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setReportType('daily')}
              className={`px-3 py-1.5 rounded-md transition ${
                reportType === 'daily' ? 'bg-white text-blue-600 shadow-sm font-semibold' : 'text-slate-600'
              }`}
            >
              Daily Report
            </button>
            <button
              onClick={() => setReportType('monthly')}
              className={`px-3 py-1.5 rounded-md transition ${
                reportType === 'monthly' ? 'bg-white text-blue-600 shadow-sm font-semibold' : 'text-slate-600'
              }`}
            >
              Monthly Report
            </button>
            <button
              onClick={() => setReportType('range')}
              className={`px-3 py-1.5 rounded-md transition ${
                reportType === 'range' ? 'bg-white text-blue-600 shadow-sm font-semibold' : 'text-slate-600'
              }`}
            >
              Custom Date Range
            </button>
          </div>

          {/* Dynamic selector based on reportType */}
          {reportType === 'daily' && (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          )}

          {reportType === 'monthly' && (
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          )}

          {reportType === 'range' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-500 font-medium">Department:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Analytics Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Faculty Evaluated</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{filtered.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Working Days in Period</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{totalWorkingDays}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Average Attendance %</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{avgAttendance}%</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Excel Format</p>
          <p className="text-xs font-semibold text-slate-700 mt-2">3 Formatted Sheets (Daily, Monthly, Master)</p>
        </div>
      </div>

      {/* Report Summary Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800">Summary Preview (Sheet 2: Monthly Summary)</h3>
          <span className="text-xs text-slate-400">Total faculty: {filtered.length}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <LoadingSpinner size="md" />
            <p className="text-xs text-slate-400 mt-2">Aggregating report data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Teacher ID</th>
                  <th className="py-3 px-4">Teacher Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-center">Working Days</th>
                  <th className="py-3 px-4 text-center">Present</th>
                  <th className="py-3 px-4 text-center">Late</th>
                  <th className="py-3 px-4 text-center">Half Day</th>
                  <th className="py-3 px-4 text-center">Absent</th>
                  <th className="py-3 px-4 text-center">On Leave</th>
                  <th className="py-3 px-4 text-center">Total Working Hours</th>
                  <th className="py-3 px-4 text-center">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(s => {
                  const days = s.total_days || 1;
                  const eff = s.present + s.late + s.half_day * 0.5;
                  const pct = Math.min(100, Math.round((eff / days) * 100));

                  return (
                    <tr key={s.teacher_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{s.teacher_id}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{s.full_name}</td>
                      <td className="py-3 px-4 text-slate-600">{s.department}</td>
                      <td className="py-3 px-4 text-center font-mono">{s.total_days}</td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-600">{s.present}</td>
                      <td className="py-3 px-4 text-center font-bold text-amber-600">{s.late}</td>
                      <td className="py-3 px-4 text-center font-bold text-orange-500">{s.half_day}</td>
                      <td className="py-3 px-4 text-center font-bold text-rose-600">{s.absent}</td>
                      <td className="py-3 px-4 text-center font-bold text-blue-600">{s.on_leave}</td>
                      <td className="py-3 px-4 text-center font-medium text-slate-700">
                        {formatHours(s.total_hours)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-bold text-[11px] ${
                            pct >= 85
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : pct >= 75
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
