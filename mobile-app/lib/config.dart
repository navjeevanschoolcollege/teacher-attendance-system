/// Application configuration constants.
class AppConfig {
  // ── Supabase credentials ─────────────────────────────────────────────
  static const String supabaseUrl = 'https://qfiyjeapsfzrabplihbj.supabase.co';
  static const String supabaseAnonKey = 'sb_publishable_pm2xD8KUeQtQCBUgVaeENg_phW-cJ0L';

  // ── WiFi check intervals ────────────────────────────────────────────
  /// Foreground timer polls WiFi every 2 minutes
  static const int wifiCheckIntervalMinutes = 2;

  /// Ignore brief disconnects under 3 minutes (weak signal / changing rooms)
  static const int briefDisconnectIgnoreMinutes = 3;

  /// Disconnect grace period threshold before auto check-out (15 minutes)
  static const int disconnectThresholdMinutes = 15;

  /// Notification interval during disconnect warning (every 5 minutes)
  static const int disconnectWarningIntervalMinutes = 5;

  // ── Campus Geofence Coordinates (Default campus center) ───────────────
  static const double defaultCampusLat = 17.5449;
  static const double defaultCampusLng = 78.5718;
  static const int defaultGeofenceRadiusMeters = 200;

  // ── WorkManager ──────────────────────────────────────────────────────
  static const String backgroundTaskName = 'campusWifiCheck';
  static const String backgroundTaskTag = 'campus_attendance_wifi';

  // ── IST offset ───────────────────────────────────────────────────────
  static const Duration istOffset = Duration(hours: 5, minutes: 30);

  /// Returns current time in IST regardless of phone clock tampering
  static DateTime nowIST() {
    return DateTime.now().toUtc().add(istOffset);
  }

  // ── SharedPreferences keys ───────────────────────────────────────────
  static const String prefTeacherId = 'teacher_id';
  static const String prefTeacherEmail = 'teacher_email';
  static const String prefTeacherName = 'teacher_name';
  static const String prefTeacherShift = 'teacher_shift'; // 'Shift One', 'Shift Two', 'Both'
  static const String prefDeviceUuid = 'device_uuid';
  static const String prefCampusSsid = 'campus_ssid';
  static const String prefAllowedBssids = 'allowed_bssids';
  static const String prefCampusLat = 'campus_lat';
  static const String prefCampusLng = 'campus_lng';
  static const String prefGeofenceRadius = 'geofence_radius';
  static const String prefDemoMode = 'demo_mode';
  static const String prefDemoSsid = 'demo_ssid';
  static const String prefLastConnectedTime = 'last_connected_time';
  static const String prefLastDisconnectWarningTime = 'last_disconnect_warning_time';
  static const String prefLoggedIn = 'logged_in';
  static const String prefRememberMe = 'remember_me';
  static const String prefDeviceRegistered = 'device_registered';
  static const String prefBatteryOptimizationDone = 'battery_optimization_done';
  static const String prefShiftOneReminderDate = 'shift_one_reminder_date';
  static const String prefShiftTwoReminderDate = 'shift_two_reminder_date';

  static String checkedInKey(DateTime date, [String shift = 'Shift One']) =>
      'checked_in_${shift.replaceAll(' ', '_')}_${date.toIso8601String().substring(0, 10)}';

  static String checkedOutKey(DateTime date, [String shift = 'Shift One']) =>
      'checked_out_${shift.replaceAll(' ', '_')}_${date.toIso8601String().substring(0, 10)}';

  // ── TWO SHIFTS EXACT TIMINGS ─────────────────────────────────────────
  // Shift One: 07:15 AM to 12:30 PM (5h 15m)
  static const int shiftOneStartHour = 7;
  static const int shiftOneStartMinute = 15;
  static const int shiftOneEndHour = 12;
  static const int shiftOneEndMinute = 30;
  static const int shiftOneInWindowStartHour = 6;
  static const int shiftOneInWindowStartMinute = 45;
  static const int shiftOneReminderHour = 7;
  static const int shiftOneReminderMinute = 0;
  static const double shiftOneHalfDayHours = 2.50; // < 2h 30m = Half Day

  // Shift Two: 12:30 PM to 05:00 PM (4h 30m)
  static const int shiftTwoStartHour = 12;
  static const int shiftTwoStartMinute = 30;
  static const int shiftTwoEndHour = 17;
  static const int shiftTwoEndMinute = 0;
  static const int shiftTwoInWindowStartHour = 12;
  static const int shiftTwoInWindowStartMinute = 0;
  static const int shiftTwoReminderHour = 12;
  static const int shiftTwoReminderMinute = 15;
  static const double shiftTwoHalfDayHours = 2.25; // < 2h 15m = Half Day

  // Grace Period: 10 minutes for both shifts
  static const int graceMinutes = 10;
}
