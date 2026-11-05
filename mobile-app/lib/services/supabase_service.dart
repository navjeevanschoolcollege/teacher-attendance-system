import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/attendance_record.dart';
import '../models/teacher.dart';
import '../config.dart';

class SupabaseService {
  static final SupabaseService _instance = SupabaseService._internal();
  factory SupabaseService() => _instance;
  SupabaseService._internal();

  SupabaseClient get client => Supabase.instance.client;

  /// Sign in with email and password
  Future<AuthResponse> login(String email, String password) async {
    return await client.auth.signInWithPassword(email: email, password: password);
  }

  /// Sign out
  Future<void> logout() async {
    await client.auth.signOut();
  }

  /// Fetch teacher profile by email
  Future<Teacher?> getTeacherProfile(String email) async {
    final response = await client
        .from('teachers')
        .select()
        .eq('email', email)
        .maybeSingle();

    if (response == null) return null;
    return Teacher.fromJson(response);
  }

  /// Register mobile device (1 teacher = 1 device)
  Future<void> registerDevice(Map<String, dynamic> deviceInfo) async {
    await client.from('devices').upsert(deviceInfo, onConflict: 'teacher_id');
  }

  /// Check device registration status
  Future<Map<String, dynamic>?> getDevice(String teacherId) async {
    return await client
        .from('devices')
        .select()
        .eq('teacher_id', teacherId)
        .maybeSingle();
  }

  /// Fetch WiFi settings from Supabase
  Future<Map<String, dynamic>?> getWiFiSettings() async {
    return await client
        .from('wifi_settings')
        .select()
        .limit(1)
        .maybeSingle();
  }

  /// Mark check-in for today
  Future<void> checkInAttendance(AttendanceRecord record) async {
    await client.from('attendance').upsert(
      record.toJson(),
      onConflict: 'teacher_id,date',
    );
  }

  /// Mark check-out for today
  Future<void> checkOutAttendance(String teacherId, DateTime outTime) async {
    final todayStr = AppConfig.nowIST().toIso8601String().substring(0, 10);
    
    // Fetch today's current record to calculate hours
    final existing = await client
        .from('attendance')
        .select()
        .eq('teacher_id', teacherId)
        .eq('date', todayStr)
        .maybeSingle();

    double totalHours = 0;
    if (existing != null && existing['in_time'] != null) {
      final inTime = DateTime.parse(existing['in_time']);
      totalHours = outTime.difference(inTime).inMinutes / 60.0;
    }

    await client.from('attendance').update({
      'out_time': outTime.toIso8601String(),
      'total_hours': double.parse(totalHours.toStringAsFixed(2)),
      'updated_at': DateTime.now().toIso8601String(),
    }).eq('teacher_id', teacherId).eq('date', todayStr);
  }

  /// Fetch attendance for date range
  Future<List<AttendanceRecord>> getMyAttendance(
      String teacherId, DateTime fromDate, DateTime toDate) async {
    final fromStr = fromDate.toIso8601String().substring(0, 10);
    final toStr = toDate.toIso8601String().substring(0, 10);

    final response = await client
        .from('attendance')
        .select()
        .eq('teacher_id', teacherId)
        .gte('date', fromStr)
        .lte('date', toStr)
        .order('date', ascending: false);

    return (response as List)
        .map((r) => AttendanceRecord.fromJson(r as Map<String, dynamic>))
        .toList();
  }

  /// Get today's attendance record
  Future<AttendanceRecord?> getTodayAttendance(String teacherId) async {
    final todayStr = AppConfig.nowIST().toIso8601String().substring(0, 10);
    final res = await client
        .from('attendance')
        .select()
        .eq('teacher_id', teacherId)
        .eq('date', todayStr)
        .maybeSingle();

    if (res == null) return null;
    return AttendanceRecord.fromJson(res);
  }

  /// Apply for leave
  Future<void> applyLeave(String teacherId, String fromDate, String toDate, String reason) async {
    await client.from('leaves').insert({
      'teacher_id': teacherId,
      'from_date': fromDate,
      'to_date': toDate,
      'reason': reason,
      'status': 'Pending',
    });
  }

  /// Fetch teacher's leaves
  Future<List<Map<String, dynamic>>> getMyLeaves(String teacherId) async {
    final res = await client
        .from('leaves')
        .select()
        .eq('teacher_id', teacherId)
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(res);
  }
}

