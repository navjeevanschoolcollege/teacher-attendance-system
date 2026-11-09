import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config.dart';
import '../models/attendance_record.dart';
import 'notification_service.dart';
import 'wifi_service.dart';
import 'offline_queue.dart';
import 'supabase_service.dart';

@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((taskName, inputData) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final teacherId = prefs.getString(AppConfig.prefTeacherId);
      final teacherShift = prefs.getString(AppConfig.prefTeacherShift) ?? 'Shift One';
      final campusSsid = prefs.getString(AppConfig.prefCampusSsid) ?? 'Woxsen_Campus_WiFi';
      final deviceUuid = prefs.getString(AppConfig.prefDeviceUuid);

      if (teacherId == null || teacherId.isEmpty) {
        return true;
      }

      final wifiService = WiFiService();
      final isCampusWiFi = await wifiService.isConnectedToCampusWiFi(
        campusSsid: campusSsid,
        demoMode: true,
      );
      final currentSsid = await wifiService.getCurrentSSID();
      final currentBssid = await wifiService.getCurrentBSSID();
      final currentIp = await wifiService.getCurrentIP();

      final now = AppConfig.nowIST();
      final todayStr = now.toIso8601String().substring(0, 10);
      final currentMinutes = now.hour * 60 + now.minute;

      final shiftOneCheckedInKey = AppConfig.checkedInKey(now, 'Shift One');
      final shiftOneCheckedOutKey = AppConfig.checkedOutKey(now, 'Shift One');
      final shiftTwoCheckedInKey = AppConfig.checkedInKey(now, 'Shift Two');
      final shiftTwoCheckedOutKey = AppConfig.checkedOutKey(now, 'Shift Two');

      try {
        if (!Supabase.instance.client.auth.currentSession?.isExpired ?? false) {
          await Supabase.initialize(
            url: AppConfig.supabaseUrl,
            anonKey: AppConfig.supabaseAnonKey,
          );
        }
      } catch (_) {}

      final notificationService = NotificationService();
      await notificationService.init();

      // ── Shift One 07:00 AM Reminder (if not checked in) ────────────────────
      if (teacherShift == 'Shift One' || teacherShift == 'Both') {
        final isShiftOneIn = prefs.getBool(shiftOneCheckedInKey) ?? false;
        final lastShiftOneReminder = prefs.getString(AppConfig.prefShiftOneReminderDate);
        if (!isShiftOneIn && now.hour == 7 && now.minute >= 0 && now.minute < 30 && lastShiftOneReminder != todayStr) {
          await notificationService.showShiftOneReminderNotification();
          await prefs.setString(AppConfig.prefShiftOneReminderDate, todayStr);
        }
      }

      // ── Shift Two 12:15 PM Reminder (if not checked in) ────────────────────
      if (teacherShift == 'Shift Two' || teacherShift == 'Both') {
        final isShiftTwoIn = prefs.getBool(shiftTwoCheckedInKey) ?? false;
        final lastShiftTwoReminder = prefs.getString(AppConfig.prefShiftTwoReminderDate);
        if (!isShiftTwoIn && now.hour == 12 && now.minute >= 15 && now.minute < 45 && lastShiftTwoReminder != todayStr) {
          await notificationService.showShiftTwoReminderNotification();
          await prefs.setString(AppConfig.prefShiftTwoReminderDate, todayStr);
        }
      }

      // ── CASE 1: Connected to Campus WiFi ───────────────────────────────────
      if (isCampusWiFi) {
        await prefs.setString(AppConfig.prefLastConnectedTime, now.toIso8601String());
        await prefs.remove(AppConfig.prefLastDisconnectWarningTime);
        await notificationService.cancelDisconnectWarning();

        // 1A. Auto-transition for teachers assigned 'Both' shifts at 12:30 PM
        if (teacherShift == 'Both') {
          final isShiftOneIn = prefs.getBool(shiftOneCheckedInKey) ?? false;
          final isShiftOneOut = prefs.getBool(shiftOneCheckedOutKey) ?? false;
          final isShiftTwoIn = prefs.getBool(shiftTwoCheckedInKey) ?? false;

          if (currentMinutes >= 750 && isShiftOneIn && !isShiftOneOut) {
            // Close Shift One at 12:30 PM
            await prefs.setBool(shiftOneCheckedOutKey, true);
            // Mark Shift Two as IN at 12:30 PM
            await prefs.setBool(shiftTwoCheckedInKey, true);

            final transitionRecord = AttendanceRecord(
              teacherId: teacherId,
              date: DateTime.parse(todayStr),
              shift: 'Shift Two',
              inTime: now,
              status: 'Present',
              lateByMinutes: 0,
              ssid: currentSsid,
              macAddress: currentBssid,
              ipAddress: currentIp,
              mode: 'Auto-WiFi',
              remarks: 'Auto-transition from Shift One (Both shifts)',
            );

            try {
              await SupabaseService().checkInAttendance(transitionRecord);
            } catch (_) {
              await OfflineQueue().addToQueue(transitionRecord);
            }

            await notificationService.showCheckInNotification('12:30 PM (Shift Two)');
          }
        }

        // 1B. Determine active target shift for check-in
        String? targetShift;
        if (teacherShift == 'Shift One' && currentMinutes >= 405 && currentMinutes <= 750) {
          targetShift = 'Shift One'; // 06:45 AM to 12:30 PM
        } else if (teacherShift == 'Shift Two' && currentMinutes >= 720 && currentMinutes <= 1020) {
          targetShift = 'Shift Two'; // 12:00 PM to 05:00 PM
        } else if (teacherShift == 'Both') {
          if (currentMinutes < 750) {
            targetShift = 'Shift One';
          } else {
            targetShift = 'Shift Two';
          }
        }

        if (targetShift != null) {
          final checkedInKey = AppConfig.checkedInKey(now, targetShift);
          final isAlreadyIn = prefs.getBool(checkedInKey) ?? false;

          if (!isAlreadyIn) {
            final timeStr = "${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}";
            int lateBy = 0;
            String status = 'Present';

            if (targetShift == 'Shift One') {
              // Shift One cutoff 07:25 AM = 445 mins
              if (currentMinutes > 445) {
                status = 'Late';
                lateBy = currentMinutes - 445;
              }
            } else {
              // Shift Two cutoff 12:40 PM = 760 mins
              if (currentMinutes > 760) {
                status = 'Late';
                lateBy = currentMinutes - 760;
              }
            }

            final record = AttendanceRecord(
              teacherId: teacherId,
              date: DateTime.parse(todayStr),
              shift: targetShift,
              inTime: now,
              status: status,
              lateByMinutes: lateBy,
              ssid: currentSsid,
              macAddress: currentBssid,
              ipAddress: currentIp,
              mode: 'Auto-WiFi',
              remarks: 'Auto check-in via campus WiFi ($targetShift)',
            );

            try {
              await SupabaseService().checkInAttendance(record);
            } catch (_) {
              await OfflineQueue().addToQueue(record);
            }

            await prefs.setBool(checkedInKey, true);
            await notificationService.showCheckInNotification("$timeStr ($targetShift)");
          } else {
            // Heartbeat update
            try {
              await SupabaseService().client
                  .from('attendance')
                  .update({
                    'last_wifi_seen_at': now.toIso8601String(),
                    'updated_at': now.toIso8601String()
                  })
                  .eq('teacher_id', teacherId)
                  .eq('date', todayStr)
                  .eq('shift', targetShift);
            } catch (_) {}
          }
        }
      }

      // ── CASE 2: WiFi is DISCONNECTED during the shift ──────────────────────
      else {
        final lastConnectedStr = prefs.getString(AppConfig.prefLastConnectedTime);
        if (lastConnectedStr != null) {
          final lastConnected = DateTime.parse(lastConnectedStr);
          final elapsedMinutes = now.difference(lastConnected).inMinutes;

          if (elapsedMinutes < AppConfig.briefDisconnectIgnoreMinutes) {
            return true;
          }

          if (elapsedMinutes < AppConfig.disconnectThresholdMinutes) {
            final lastWarningStr = prefs.getString(AppConfig.prefLastDisconnectWarningTime);
            bool shouldWarn = true;
            if (lastWarningStr != null) {
              final lastWarning = DateTime.parse(lastWarningStr);
              if (now.difference(lastWarning).inMinutes < AppConfig.disconnectWarningIntervalMinutes) {
                shouldWarn = false;
              }
            }

            if (shouldWarn) {
              final minutesLeft = AppConfig.disconnectThresholdMinutes - elapsedMinutes;
              final outTargetTime = lastConnected.add(
                const Duration(minutes: AppConfig.disconnectThresholdMinutes),
              );
              final willMarkOutAt =
                  "${outTargetTime.hour.toString().padLeft(2, '0')}:${outTargetTime.minute.toString().padLeft(2, '0')}";

              await notificationService.showDisconnectWarningNotification(
                minutesLeft: minutesLeft,
                willMarkOutAt: willMarkOutAt,
              );
              await prefs.setString(AppConfig.prefLastDisconnectWarningTime, now.toIso8601String());
            }
          } else if (elapsedMinutes >= AppConfig.disconnectThresholdMinutes) {
            // Disconnect >= 15 continuous minutes: call backend heartbeat to check GPS geofence
            try {
              await SupabaseService().client.functions.invoke(
                'wifi-heartbeat',
                body: {
                  'teacher_id': teacherId,
                  'is_wifi_connected': false,
                  'device_uuid': deviceUuid,
                },
              );
            } catch (_) {}
          }
        }
      }

      // Sync offline queue
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
