import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import StatusBadge from '../common/StatusBadge';
import LoadingSpinner from '../common/LoadingSpinner';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';

function formatHours(hrs) {
  if (!hrs || isNaN(hrs) || hrs <= 0) return '0h 00m';
  const min = Math.round(Number(hrs) * 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
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

export default function MyAttendance() {
  const { teacherProfile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [records, setRecords] = useState([]);
  const [selectedDayRecord, setSelectedDayRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  const teacherId = teacherProfile?.teacher_id || 'T001';
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchMonthAttendance = async () => {
    try {
      setLoading(true);
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const end = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('teacher_id', teacherId)
        .gte('date', start)
        .lte('date', end);

      if (error) throw error;
      setRecords(data || []);
      setSelectedDayRecord(null);
    } catch (err) {
      console.error('Error fetching calendar attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthAttendance();
  }, [currentDate, teacherId]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Calendar calculations
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday

  const attMap = new Map();
  records.forEach(r => attMap.set(r.date, r));

  const stats = {
    present: records.filter(r => r.status === 'Present').length,
    late: records.filter(r => r.status === 'Late').length,
    halfDay: records.filter(r => r.status === 'Half Day').length,
    absent: records.filter(r => r.status === 'Absent').length,
    leave: records.filter(r => r.status === 'On Leave').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">My Attendance Calendar</h2>
          <p className="text-xs text-slate-500">View daily punch logs, timings, and working hours</p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm text-xs font-semibold text-slate-700">
          <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="w-32 text-center">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Month Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
          <span className="text-[11px] text-slate-500 font-medium">Present</span>
          <div className="text-lg font-bold text-emerald-600 mt-0.5">{stats.present}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
          <span className="text-[11px] text-slate-500 font-medium">Late</span>
          <div className="text-lg font-bold text-amber-500 mt-0.5">{stats.late}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
          <span className="text-[11px] text-slate-500 font-medium">Half Day</span>
          <div className="text-lg font-bold text-orange-500 mt-0.5">{stats.halfDay}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
          <span className="text-[11px] text-slate-500 font-medium">Absent</span>
          <div className="text-lg font-bold text-rose-600 mt-0.5">{stats.absent}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm col-span-2 sm:col-span-1">
          <span className="text-[11px] text-slate-500 font-medium">On Leave</span>
          <div className="text-lg font-bold text-blue-600 mt-0.5">{stats.leave}</div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        {loading ? (
          <div className="p-16 text-center">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <div>
            {/* Days Header */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-400 mb-2">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {/* Empty cells before first day */}
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="h-16 sm:h-20 bg-slate-50/50 rounded-xl"></div>
              ))}

              {/* Month Days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dayDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const rec = attMap.get(dayDateStr);
                const isWeekend = (firstDayIndex + i) % 7 === 0 || (firstDayIndex + i) % 7 === 6;

                let badgeColor = 'bg-slate-50 text-slate-600';
                if (rec) {
                  if (rec.status === 'Present') badgeColor = 'bg-emerald-500 text-white';
                  else if (rec.status === 'Late') badgeColor = 'bg-amber-500 text-white';
                  else if (rec.status === 'Half Day') badgeColor = 'bg-orange-500 text-white';
                  else if (rec.status === 'Absent') badgeColor = 'bg-rose-500 text-white';
                  else if (rec.status === 'On Leave') badgeColor = 'bg-blue-500 text-white';
                  else if (rec.status === 'Holiday') badgeColor = 'bg-purple-500 text-white';
                }

                return (
                  <div
                    key={dayNum}
                    onClick={() => rec && setSelectedDayRecord(rec)}
                    className={`h-16 sm:h-20 p-2 rounded-xl border border-slate-100 flex flex-col justify-between cursor-pointer transition hover:border-blue-400 hover:shadow-sm ${
                      isWeekend ? 'bg-slate-50/60' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">{dayNum}</span>
                      {rec && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${badgeColor}`}>
                          {rec.status.slice(0, 4)}
                        </span>
                      )}
                    </div>

                    {rec ? (
                      <div className="text-[10px] text-slate-500 truncate font-mono">
                        {formatTime(rec.in_time)}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-300">
                        {isWeekend ? 'Off' : '-'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected Day Details Card */}
      {selectedDayRecord && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-sm text-xs">
          <div className="flex items-center justify-between border-b border-blue-200/60 pb-3 mb-3">
            <div className="font-bold text-sm text-blue-900">
              Details for {selectedDayRecord.date}
            </div>
            <StatusBadge status={selectedDayRecord.status} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-blue-950">
            <div>
              <span className="text-blue-700/70 block">IN Time</span>
              <span className="font-mono font-bold text-sm">{formatTime(selectedDayRecord.in_time)}</span>
            </div>
            <div>
              <span className="text-blue-700/70 block">OUT Time</span>
              <span className="font-mono font-bold text-sm">{formatTime(selectedDayRecord.out_time)}</span>
            </div>
            <div>
              <span className="text-blue-700/70 block">Total Working Hours</span>
              <span className="font-bold text-sm">{formatHours(selectedDayRecord.total_hours)}</span>
            </div>
            <div>
              <span className="text-blue-700/70 block">Mode</span>
              <span className="font-semibold">{selectedDayRecord.mode}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

