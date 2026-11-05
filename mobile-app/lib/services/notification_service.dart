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

    await _notificationsPlugin.initialize(initSettings);
  }

  Future<void> showCheckInNotification(String timeStr) async {
    const androidDetails = AndroidNotificationDetails(
      'attendance_channel',
      'Campus Attendance',
      channelDescription: 'Notifications for WiFi auto check-in and check-out',
      importance: Importance.high,
      priority: Priority.high,
    );
    const details = NotificationDetails(android: androidDetails);

    await _notificationsPlugin.show(
      1001,
      'Campus WiFi Check-In ✅',
      'You connected to Campus WiFi. Checked IN at $timeStr',
      details,
    );
  }

  Future<void> showCheckOutNotification(String timeStr) async {
    const androidDetails = AndroidNotificationDetails(
      'attendance_channel',
      'Campus Attendance',
      channelDescription: 'Notifications for WiFi auto check-in and check-out',
      importance: Importance.high,
      priority: Priority.high,
    );
    const details = NotificationDetails(android: androidDetails);

    await _notificationsPlugin.show(
      1002,
      'Campus WiFi Check-Out 🚪',
      'Disconnected from Campus WiFi. Checked OUT at $timeStr',
      details,
    );
  }

  Future<void> showSyncNotification(int count) async {
    const androidDetails = AndroidNotificationDetails(
      'attendance_channel',
      'Campus Attendance',
      channelDescription: 'Notifications for WiFi auto check-in and check-out',
      importance: Importance.defaultImportance,
      priority: Priority.defaultPriority,
    );
    const details = NotificationDetails(android: androidDetails);

    await _notificationsPlugin.show(
      1003,
      'Offline Attendance Synced 🔄',
      'Successfully synced $count attendance record(s) to campus server',
      details,
    );
  }
}

