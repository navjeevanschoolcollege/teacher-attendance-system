/// Application configuration constants.
/// Update [supabaseUrl] and [supabaseAnonKey] before building the APK.
class AppConfig {
  // ── Supabase credentials ─────────────────────────────────────────────
  static const String supabaseUrl = 'https://qfiyjeapsfzrabplihbj.supabase.co';
  static const String supabaseAnonKey = 'sb_publishable_pm2xD8KUeQtQCBUgVaeENg_phW-cJ0L';

  // ── WiFi check intervals ────────────────────────────────────────────
  /// How often the foreground timer polls WiFi (in minutes).
  static const int wifiCheckIntervalMinutes = 2;

  /// Minutes of WiFi disconnection before auto check-out.
  static const int disconnectThresholdMinutes = 15;

  // ── WorkManager ──────────────────────────────────────────────────────
  /// Unique name used by WorkManager for the periodic task.
  static const String backgroundTaskName = 'campusWifiCheck';

  /// Unique tag used to identify our periodic task.
  static const String backgroundTaskTag = 'campus_attendance_wifi';

  // ── IST offset ───────────────────────────────────────────────────────
  /// Indian Standard Time offset from UTC.
  static const Duration istOffset = Duration(hours: 5, minutes: 30);

  /// Returns the current time in IST regardless of device timezone.
  static DateTime nowIST() {
    return DateTime.now().toUtc().add(istOffset);
  }

  // ── SharedPreferences keys ───────────────────────────────────────────
  static const String prefTeacherId = 'teacher_id';
  static const String prefTeacherEmail = 'teacher_email';
  static const String prefTeacherName = 'teacher_name';
  static const String prefCampusSsid = 'campus_ssid';
  static const String prefAllowedBssids = 'allowed_bssids';
  static const String prefDemoMode = 'demo_mode';
  static const String prefDemoSsid = 'demo_ssid';
  static const String prefLastConnectedTime = 'last_connected_time';
  static const String prefLoggedIn = 'logged_in';
  static const String prefRememberMe = 'remember_me';
  static const String prefDeviceRegistered = 'device_registered';

  /// Key pattern: `checked_in_2024-01-15`
  static String checkedInKey(DateTime date) =>
      'checked_in_${date.toIso8601String().substring(0, 10)}';

  /// Key pattern: `checked_out_2024-01-15`
  static String checkedOutKey(DateTime date) =>
      'checked_out_${date.toIso8601String().substring(0, 10)}';

  // ── Defaults ─────────────────────────────────────────────────────────
  /// Default expected in-time (09:00 IST) – used for late calculation.
  static const int expectedInHour = 9;
  static const int expectedInMinute = 0;

  /// Default expected out-time (17:00 IST) – used for early-out calc.
  static const int expectedOutHour = 17;
  static const int expectedOutMinute = 0;
}
