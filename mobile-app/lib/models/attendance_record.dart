import 'package:campus_attendance/config.dart';

/// Data model for a single day's attendance record.
class AttendanceRecord {
  final String? id;
  final String teacherId;
  final DateTime date;
  final DateTime? inTime;
  final DateTime? outTime;
  final double? totalHours;
  final String status; // present, late, absent, on leave, half day
  final int? lateByMinutes;
  final int? earlyOutByMinutes;
  final String? mobileName;
  final String? macAddress;
  final String? ipAddress;
  final String? ssid;
  final String mode; // auto, manual
  final String? remarks;

  AttendanceRecord({
    this.id,
    required this.teacherId,
    required this.date,
    this.inTime,
    this.outTime,
    this.totalHours,
    this.status = 'present',
    this.lateByMinutes,
    this.earlyOutByMinutes,
    this.mobileName,
    this.macAddress,
    this.ipAddress,
    this.ssid,
    this.mode = 'auto',
    this.remarks,
  });

  /// Build from a Supabase / JSON map.
  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      id: json['id']?.toString(),
      teacherId: json['teacher_id'] as String,
      date: DateTime.parse(json['date'] as String),
      inTime: json['in_time'] != null ? DateTime.parse(json['in_time'] as String) : null,
      outTime: json['out_time'] != null ? DateTime.parse(json['out_time'] as String) : null,
      totalHours: json['total_hours'] != null
          ? (json['total_hours'] as num).toDouble()
          : null,
      status: (json['status'] as String?) ?? 'present',
      lateByMinutes: json['late_by_minutes'] as int?,
      earlyOutByMinutes: json['early_out_by_minutes'] as int?,
      mobileName: json['mobile_name'] as String?,
      macAddress: json['mac_address'] as String?,
      ipAddress: json['ip_address'] as String?,
      ssid: json['ssid'] as String?,
      mode: (json['mode'] as String?) ?? 'auto',
      remarks: json['remarks'] as String?,
    );
  }

  /// Serialise to a JSON map for Supabase insert / update.
  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      'teacher_id': teacherId,
      'date': date.toIso8601String().substring(0, 10),
      'in_time': inTime?.toIso8601String(),
      'out_time': outTime?.toIso8601String(),
      'total_hours': totalHours,
      'status': status,
      'late_by_minutes': lateByMinutes,
      'early_out_by_minutes': earlyOutByMinutes,
      'mobile_name': mobileName,
      'mac_address': macAddress,
      'ip_address': ipAddress,
      'ssid': ssid,
      'mode': mode,
      'remarks': remarks,
    };
  }

  /// Create a copy with some fields overridden.
  AttendanceRecord copyWith({
    String? id,
    String? teacherId,
    DateTime? date,
    DateTime? inTime,
    DateTime? outTime,
    double? totalHours,
    String? status,
    int? lateByMinutes,
    int? earlyOutByMinutes,
    String? mobileName,
    String? macAddress,
    String? ipAddress,
    String? ssid,
    String? mode,
    String? remarks,
  }) {
    return AttendanceRecord(
      id: id ?? this.id,
      teacherId: teacherId ?? this.teacherId,
      date: date ?? this.date,
      inTime: inTime ?? this.inTime,
      outTime: outTime ?? this.outTime,
      totalHours: totalHours ?? this.totalHours,
      status: status ?? this.status,
      lateByMinutes: lateByMinutes ?? this.lateByMinutes,
      earlyOutByMinutes: earlyOutByMinutes ?? this.earlyOutByMinutes,
      mobileName: mobileName ?? this.mobileName,
      macAddress: macAddress ?? this.macAddress,
      ipAddress: ipAddress ?? this.ipAddress,
      ssid: ssid ?? this.ssid,
      mode: mode ?? this.mode,
      remarks: remarks ?? this.remarks,
    );
  }

  /// Compute total hours between [inTime] and a given out time.
  static double computeHours(DateTime inTime, DateTime outTime) {
    final diff = outTime.difference(inTime);
    return double.parse((diff.inMinutes / 60.0).toStringAsFixed(2));
  }

  /// Determine status based on in-time vs expected schedule.
  static String determineStatus(DateTime inTime) {
    final expected = DateTime(
      inTime.year,
      inTime.month,
      inTime.day,
      AppConfig.expectedInHour,
      AppConfig.expectedInMinute,
    );
    if (inTime.isAfter(expected.add(const Duration(minutes: 15)))) {
      return 'late';
    }
    return 'present';
  }

  /// Calculate how many minutes late (0 if on time).
  static int computeLateMinutes(DateTime inTime) {
    final expected = DateTime(
      inTime.year,
      inTime.month,
      inTime.day,
      AppConfig.expectedInHour,
      AppConfig.expectedInMinute,
    );
    if (inTime.isAfter(expected)) {
      return inTime.difference(expected).inMinutes;
    }
    return 0;
  }

  /// Calculate early-out minutes (0 if left on or after expected out).
  static int computeEarlyOutMinutes(DateTime outTime) {
    final expected = DateTime(
      outTime.year,
      outTime.month,
      outTime.day,
      AppConfig.expectedOutHour,
      AppConfig.expectedOutMinute,
    );
    if (outTime.isBefore(expected)) {
      return expected.difference(outTime).inMinutes;
    }
    return 0;
  }
}
