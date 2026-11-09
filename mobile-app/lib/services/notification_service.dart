import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();

  Future<void> init() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _notificationsPlugin.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (response) {
        // Handle notification click if needed
      },
    );
  }

  /// Persistent Foreground Notification
  Future<void> showForegroundServiceNotification() async {
    const androidDetails = AndroidNotificationDetails(
      'campus_foreground_channel',
      'Campus Attendance Service',
      channelDescription: 'Keeps WiFi presence detection running reliably',
      importance: Importance.low,
      priority: Priority.low,
      ongoing: true,
      autoCancel: false,
    );
    const details = NotificationDetails(android: androidDetails);

    await _notificationsPlugin.show(
      999,
      'Campus Attendance ON 🟢',
      'Actively monitoring campus WiFi connection',
      details,
    );
  }

  /// Check-In Notification
  Future<void> showCheckInNotification(String timeStr) async {
    const androidDetails = AndroidNotificationDetails(
      'attendance_channel',
      'Campus Attendance Alerts',
      channelDescription: 'Notifications for WiFi auto check-in and check-out',
      importance: Importance.high,
      priority: Priority.high,
    );
    const details = NotificationDetails(android: androidDetails);

    await _notificationsPlugin.show(
      1001,
      'Campus WiFi Check-In ✅',
      'Connected to Campus WiFi. Marked IN at $timeStr',
      details,
    );
  }

  /// 5-Minute Warning: WiFi disconnected before OUT time
  Future<void> showDisconnectWarningNotification({
    required int minutesLeft,
    required String willMarkOutAt,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      'attendance_warning_channel',
      'WiFi Disconnect Alerts',
      channelDescription: 'Urgent warnings when campus WiFi disconnects during working hours',
      importance: Importance.max,
      priority: Priority.high,
      playSound: true,
      enableVibration: true,
    );
    const details = NotificationDetails(android: androidDetails);

    await _notificationsPlugin.show(
      1002,
      '⚠️ Campus WiFi Disconnected!',
      'Turn WiFi back ON. You will be automatically marked OUT in $minutesLeft mins (at $willMarkOutAt).',
      details,
    );
  }

  /// Cancel Disconnect Warning on Reconnection
  Future<void> cancelDisconnectWarning() async {
    await _notificationsPlugin.cancel(1002);
  }

  /// Reconnected notification
  Future<void> showReconnectedNotification() async {
    const androidDetails = AndroidNotificationDetails(
      'attendance_channel',
      'Campus Attendance Alerts',
      importance: Importance.defaultImportance,
      priority: Priority.defaultPriority,
    );
    const details = NotificationDetails(android: androidDetails);

    await _notificationsPlugin.show(
      1003,
      'WiFi Reconnected 🔄',
      'Back on Campus WiFi. Your continuous IN attendance is maintained.',
      details,
    );
  }

  /// Check-Out Notification
  Future<void> showCheckOutNotification(String timeStr) async {
    const androidDetails = AndroidNotificationDetails(
      'attendance_channel',
      'Campus Attendance Alerts',
      importance: Importance.high,
      priority: Priority.high,
    );
    const details = NotificationDetails(android: androidDetails);

    await _notificationsPlugin.show(
      1004,
      'Campus WiFi Check-Out 🚪',
      'Disconnected from Campus WiFi for 15+ minutes. Marked OUT at $timeStr.',
      details,
    );
  }

  /// Shift One 07:00 AM Reminder (If not checked in)
  Future<void> showShiftOneReminderNotification() async {
    const androidDetails = AndroidNotificationDetails(
      'attendance_reminder_channel',
      'Shift Attendance Reminders',
      importance: Importance.high,
      priority: Priority.high,
    );
    const details = NotificationDetails(android: androidDetails);

    await _notificationsPlugin.show(
      1005,
      'Shift One Starting Soon (07:00 AM) ⏰',
      'You are not marked present yet for Shift One. Turn ON Campus WiFi to auto check-in before 07:25 AM.',
      details,
    );
  }

  /// Shift Two 12:15 PM Reminder (If not checked in)
  Future<void> showShiftTwoReminderNotification() async {
    const androidDetails = AndroidNotificationDetails(
      'attendance_reminder_channel',
      'Shift Attendance Reminders',
      importance: Importance.high,
      priority: Priority.high,
    );
    const details = NotificationDetails(android: androidDetails);

    await _notificationsPlugin.show(
      1006,
      'Shift Two Starting Soon (12:15 PM) ⏰',
      'You are not marked present yet for Shift Two. Turn ON Campus WiFi to auto check-in before 12:40 PM.',
      details,
    );
  }

  /// Offline Sync Notification
  Future<void> showSyncNotification(int count) async {
    const androidDetails = AndroidNotificationDetails(
      'attendance_channel',
      'Campus Attendance Alerts',
      importance: Importance.defaultImportance,
      priority: Priority.defaultPriority,
    );
    const details = NotificationDetails(android: androidDetails);

    await _notificationsPlugin.show(
      1006,
      'Offline Attendance Synced 🔄',
      'Successfully uploaded $count cached punch record(s) to campus server.',
      details,
    );
  }
}
