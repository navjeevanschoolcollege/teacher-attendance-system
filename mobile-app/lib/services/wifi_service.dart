import 'package:network_info_plus/network_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';

class WiFiService {
  static final WiFiService _instance = WiFiService._internal();
  factory WiFiService() => _instance;
  WiFiService._internal();

  final NetworkInfo _networkInfo = NetworkInfo();

  /// Check and request location permission required by Android to read WiFi SSID
  Future<bool> requestPermissions() async {
    final status = await Permission.location.status;
    if (status.isGranted) return true;
    final result = await Permission.location.request();
    return result.isGranted;
  }

  /// Get current connected WiFi SSID
  Future<String?> getCurrentSSID() async {
    try {
      final hasPermission = await requestPermissions();
      if (!hasPermission) return null;
      String? ssid = await _networkInfo.getWifiName();
      if (ssid != null) {
        // Strip quotes if Android wraps SSID in double quotes e.g. "Campus_WiFi"
        if (ssid.startsWith('"') && ssid.endsWith('"') && ssid.length > 1) {
          ssid = ssid.substring(1, ssid.length - 1);
        }
      }
      return ssid;
    } catch (e) {
      return null;
    }
  }

  /// Get current connected WiFi BSSID (Access Point MAC)
  Future<String?> getCurrentBSSID() async {
    try {
      final hasPermission = await requestPermissions();
      if (!hasPermission) return null;
      return await _networkInfo.getWifiBSSID();
    } catch (e) {
      return null;
    }
  }

  /// Get current IP Address
  Future<String?> getIPAddress() async {
    try {
      return await _networkInfo.getWifiIP();
    } catch (e) {
      return null;
    }
  }

  /// Check if device is connected to campus WiFi
  Future<bool> isConnectedToCampusWiFi({
    required String campusSsid,
    List<String> allowedBssids = const [],
    bool demoMode = false,
    String demoSsid = 'Test_Campus_WiFi',
  }) async {
    final currentSsid = await getCurrentSSID();
    if (currentSsid == null || currentSsid.isEmpty) return false;

    // Check Demo SSID match
    if (demoMode && currentSsid.toLowerCase() == demoSsid.toLowerCase()) {
      return true;
    }

    // Check Primary Campus SSID match
    if (currentSsid.toLowerCase() == campusSsid.toLowerCase()) {
      // If allowed BSSIDs specified, verify access point MAC
      if (allowedBssids.isNotEmpty) {
        final currentBssid = await getCurrentBSSID();
        if (currentBssid != null && currentBssid.isNotEmpty) {
          return allowedBssids.any(
            (b) => b.trim().toLowerCase() == currentBssid.toLowerCase(),
          );
        }
      }
      return true;
    }

    return false;
  }
}

