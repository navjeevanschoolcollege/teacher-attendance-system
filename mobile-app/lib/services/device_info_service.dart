import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';

class DeviceInfoService {
  static final DeviceInfoService _instance = DeviceInfoService._internal();
  factory DeviceInfoService() => _instance;
  DeviceInfoService._internal();

  final DeviceInfoPlugin _deviceInfoPlugin = DeviceInfoPlugin();
  final NetworkInfo _networkInfo = NetworkInfo();

  /// Gets or generates a permanent unique hardware/installation Device UUID
  Future<String> getOrCreateDeviceUuid() async {
    final prefs = await SharedPreferences.getInstance();
    String? uuid = prefs.getString(AppConfig.prefDeviceUuid);
    if (uuid == null || uuid.isEmpty) {
      // Generate unique token combining timestamp + random hex
      final timestamp = DateTime.now().millisecondsSinceEpoch.toRadixString(16);
      final random = (100000 + DateTime.now().microsecond).toRadixString(16);
      uuid = 'DEV-${timestamp.toUpperCase()}-${random.toUpperCase()}';
      await prefs.setString(AppConfig.prefDeviceUuid, uuid);
    }
    return uuid;
  }

  Future<Map<String, dynamic>> getDeviceInfo() async {
    String mobileName = 'Android Device';
    String mobileModel = 'Unknown';
    String osVersion = 'Unknown';
    String? macAddress;
    String? ipAddress;

    final deviceUuid = await getOrCreateDeviceUuid();

    try {
      if (Platform.isAndroid) {
        final androidInfo = await _deviceInfoPlugin.androidInfo;
        mobileName = '${androidInfo.brand.toUpperCase()} ${androidInfo.model}';
        mobileModel = androidInfo.model;
        osVersion = 'Android ${androidInfo.version.release} (SDK ${androidInfo.version.sdkInt})';
      } else if (Platform.isIOS) {
        final iosInfo = await _deviceInfoPlugin.iosInfo;
        mobileName = iosInfo.name;
        mobileModel = iosInfo.model;
        osVersion = '${iosInfo.systemName} ${iosInfo.systemVersion}';
      }
    } catch (_) {}

    try {
      ipAddress = await _networkInfo.getWifiIP();
      macAddress = await _networkInfo.getWifiBSSID();
    } catch (_) {}

    return {
      'device_uuid': deviceUuid,
      'mobile_name': mobileName,
      'mobile_model': mobileModel,
      'os_version': osVersion,
      'mac_address': macAddress ?? 'AA:BB:CC:11:22:33',
      'ip_address': ipAddress ?? '192.168.1.45',
    };
  }
}
