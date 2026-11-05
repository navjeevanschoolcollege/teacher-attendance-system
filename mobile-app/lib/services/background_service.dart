import 'package:workmanager/workmanager.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'notification_service.dart';
import 'offline_queue.dart';
import 'supabase_service.dart';
import '../models/attendance_record.dart';
import '../config.dart';

@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final teacherId = prefs.getString(AppConfig.prefTeacherId);
      if (teacherId == null || teacherId.isEmpty) return true;

      final campusSsid = prefs.getString(AppConfig.prefCampusSsid) ?? 'Woxsen_Campus_WiFi';
      final demoMode = prefs.getBool(AppConfig.prefDemoMode) ?? true;
      final demoSsid = prefs.getString(AppConfig.prefDemoSsid) ?? 'Test_Campus_WiFi';
      final allowedBssids = prefs.getStringList(AppConfig.prefAllowedBssids) ?? [];

      // Check current WiFi
      final networkInfo = NetworkInfo();
      String? currentSsid = await networkInfo.getWifiName();
      if (currentSsid != null) {
        if (currentSsid.startsWith('"') && currentSsid.endsWith('"') && currentSsid.length > 1) {
          currentSsid = currentSsid.substring(1, currentSsid.length - 1);
        }
      }
      final currentBssid = await networkInfo.getWifiBSSID();
      final currentIp = await networkInfo.getWifiIP();

      final now = AppConfig.nowIST();
      final todayStr = now.toIso8601String().substring(0, 10);
      final checkedInKey = AppConfig.checkedInKey(now);
      final checkedOutKey = AppConfig.checkedOutKey(now);

      bool isCampusWiFi = false;
      if (currentSsid != null) {
        if (demoMode && currentSsid.toLowerCase() == demoSsid.toLowerCase()) {
          isCampusWiFi = true;
        } else if (currentSsid.toLowerCase() == campusSsid.toLowerCase()) {
          if (allowedBssids.isEmpty || allowedBssids.contains(currentBssid)) {
            isCampusWiFi = true;
          }
        }
      }

      // Initialize Supabase if needed
      try {
        if (!Supabase.instance.isInitialized) {
          await Supabase.initialize(
            url: AppConfig.supabaseUrl,
            anonKey: AppConfig.supabaseAnonKey,
          );
        }
      } catch (_) {}

      final notificationService = NotificationService();
      await notificationService.init();

      if (isCampusWiFi) {
        // Connected to campus WiFi
        prefs.setString(AppConfig.prefLastConnectedTime, now.toIso8601String());

        final isCheckedIn = prefs.getBool(checkedInKey) ?? false;
        if (!isCheckedIn) {
          // First connection of the day -> Check IN
          final timeStr = "${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}";
          
          int lateBy = 0;
          String status = 'Present';
          if (now.hour > 9 || (now.hour == 9 && now.minute > 10)) {
            status = 'Late';
            lateBy = (now.hour - 9) * 60 + now.minute;
          }

          final record = AttendanceRecord(
            teacherId: teacherId,
            date: DateTime.parse(todayStr),
            inTime: now,
            status: status,
            lateByMinutes: lateBy,
            ssid: currentSsid,
            bssid: currentBssid,
            ipAddress: currentIp,
            mode: 'Auto-WiFi',
            remarks: 'Auto check-in via campus WiFi'
          );

          try {
            await SupabaseService().checkInAttendance(record);
          } catch (e) {
            // Save to offline queue if Supabase unavailable
            await OfflineQueue().addToQueue(record);
          }

          await prefs.setBool(checkedInKey, true);
          await notificationService.showCheckInNotification(timeStr);
        }
      } else {
        // Not connected to campus WiFi
        final lastConnectedStr = prefs.getString(AppConfig.prefLastConnectedTime);
        final isCheckedIn = prefs.getBool(checkedInKey) ?? false;
        final isCheckedOut = prefs.getBool(checkedOutKey) ?? false;

        if (isCheckedIn && !isCheckedOut && lastConnectedStr != null) {
          final lastConnected = DateTime.parse(lastConnectedStr);
          final diffMinutes = now.difference(lastConnected).inMinutes;

          if (diffMinutes >= AppConfig.disconnectThresholdMinutes) {
            // Disconnected for more than 15 continuous minutes -> Mark OUT TIME
            final timeStr = "${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}";
            
            try {
              await SupabaseService().checkOutAttendance(teacherId, now);
            } catch (e) {
              final outRecord = AttendanceRecord(
                teacherId: teacherId,
                date: DateTime.parse(todayStr),
                outTime: now,
                mode: 'Auto-WiFi',
                remarks: 'Auto check-out after 15m disconnect'
              );
              await OfflineQueue().addToQueue(outRecord);
            }

            await prefs.setBool(checkedOutKey, true);
            await notificationService.showCheckOutNotification(timeStr);
          }
        }
      }

      // Try syncing offline queue
      try {
        final synced = await OfflineQueue().syncAll(SupabaseService());
        if (synced > 0) {
          await notificationService.showSyncNotification(synced);
        }
      } catch (_) {}

      return true;
    } catch (err) {
      return false;
    }
  });
}

