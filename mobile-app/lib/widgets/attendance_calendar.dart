import 'package:flutter/material.dart';
import '../models/attendance_record.dart';

class AttendanceCalendar extends StatelessWidget {
  final DateTime month;
  final List<AttendanceRecord> records;
  final Function(AttendanceRecord?) onSelectRecord;

  const AttendanceCalendar({
    Key? key,
    required this.month,
    required this.records,
    required this.onSelectRecord,
  }) : super(key: key);

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'present':
        return const Color(0xFF22C55E); // Green
      case 'late':
        return const Color(0xFFF59E0B); // Amber
      case 'half day':
        return const Color(0xFFF97316); // Orange
      case 'absent':
        return const Color(0xFFEF4444); // Red
      case 'on leave':
        return const Color(0xFF3B82F6); // Blue
      case 'holiday':
        return const Color(0xFF8B5CF6); // Purple
      default:
        return Colors.grey.shade400;
    }
  }

  @override
  Widget build(BuildContext context) {
    final year = month.year;
    final m = month.month;
    final daysInMonth = DateTime(year, m + 1, 0).day;
    final firstDayWeekday = DateTime(year, m, 1).weekday % 7; // Sunday=0

    final recordMap = <String, AttendanceRecord>{};
    for (var r in records) {
      final key = r.date.toIso8601String().substring(0, 10);
      recordMap[key] = r;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          // Weekday headers
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: const [
              _WeekdayLabel('Sun'),
              _WeekdayLabel('Mon'),
              _WeekdayLabel('Tue'),
              _WeekdayLabel('Wed'),
              _WeekdayLabel('Thu'),
              _WeekdayLabel('Fri'),
              _WeekdayLabel('Sat'),
            ],
          ),
          const SizedBox(height: 12),

          // Days Grid
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: firstDayWeekday + daysInMonth,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              crossAxisSpacing: 6,
              mainAxisSpacing: 6,
            ),
            itemBuilder: (context, index) {
              if (index < firstDayWeekday) {
                return const SizedBox.shrink();
              }

              final dayNum = index - firstDayWeekday + 1;
              final dateStr = '$year-${m.toString().padLeft(2, '0')}-${dayNum.toString().padLeft(2, '0')}';
              final rec = recordMap[dateStr];
              final isWeekend = (index % 7 == 0) || (index % 7 == 6);

              return GestureDetector(
                onTap: () {
                  if (rec != null) onSelectRecord(rec);
                },
                child: Container(
                  decoration: BoxDecoration(
                    color: rec != null
                        ? _getStatusColor(rec.status).withOpacity(0.15)
                        : (isWeekend ? Colors.grey.shade50 : Colors.white),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: rec != null
                          ? _getStatusColor(rec.status).withOpacity(0.4)
                          : Colors.grey.shade200,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '$dayNum',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: isWeekend ? Colors.grey.shade400 : const Color(0xFF1E293B),
                        ),
                      ),
                      if (rec != null) ...[
                        const SizedBox(height: 2),
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: _getStatusColor(rec.status),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _WeekdayLabel extends StatelessWidget {
  final String text;
  const _WeekdayLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 32,
      child: Center(
        child: Text(
          text,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: Colors.grey.shade500,
          ),
        ),
      ),
    );
  }
}
