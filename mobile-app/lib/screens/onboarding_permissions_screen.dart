import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';
import 'home_screen.dart';

class OnboardingPermissionsScreen extends StatefulWidget {
  const OnboardingPermissionsScreen({Key? key}) : super(key: key);

  @override
  State<OnboardingPermissionsScreen> createState() => _OnboardingPermissionsScreenState();
}

class _OnboardingPermissionsScreenState extends State<OnboardingPermissionsScreen> {
  bool _locationAlwaysGranted = false;
  bool _batteryOptimizationDisabled = false;
  bool _wifiPermissionGranted = false;

  @override
  void initState() {
    super.initState();
    _checkCurrentPermissions();
  }

  Future<void> _checkCurrentPermissions() async {
    final locationStatus = await Permission.locationAlways.status;
    final batteryStatus = await Permission.ignoreBatteryOptimizations.status;

    setState(() {
      _locationAlwaysGranted = locationStatus.isGranted;
      _batteryOptimizationDisabled = batteryStatus.isGranted;
      _wifiPermissionGranted = true;
    });
  }

  Future<void> _requestLocationAlways() async {
    final status = await Permission.locationAlways.request();
    if (!status.isGranted) {
      await openAppSettings();
    }
    await _checkCurrentPermissions();
  }

  Future<void> _requestDisableBatteryOptimization() async {
    final status = await Permission.ignoreBatteryOptimizations.request();
    if (!status.isGranted) {
      await openAppSettings();
    }
    await _checkCurrentPermissions();
  }

  Future<void> _completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(AppConfig.prefBatteryOptimizationDone, true);

    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Setup Automatic Attendance'),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
        elevation: 0,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: Row(
                  children: const [
                    Icon(Icons.bolt, color: Color(0xFF2563EB), size: 28),
                    SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        'To automatically mark IN and OUT when entering campus, enable these 2 Android background permissions.',
                        style: TextStyle(fontSize: 12, color: Color(0xFF1E40AF), height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Step 1: Battery Optimization
              _PermissionStepCard(
                stepNumber: '1',
                title: 'Turn OFF Battery Optimization',
                description: 'Prevents Android from killing the app in the background when your phone screen is off.',
                isGranted: _batteryOptimizationDisabled,
                buttonText: _batteryOptimizationDisabled ? 'Disabled ✓' : 'Disable Battery Saver',
                onTap: _requestDisableBatteryOptimization,
              ),

              const SizedBox(height: 16),

              // Step 2: Location Always
              _PermissionStepCard(
                stepNumber: '2',
                title: 'Allow Location Permission: "Always"',
                description: 'Required by Android 10+ to read connected campus WiFi SSID in the background without opening the app.',
                isGranted: _locationAlwaysGranted,
                buttonText: _locationAlwaysGranted ? 'Allowed ✓' : 'Allow "All the time"',
                onTap: _requestLocationAlways,
              ),

              const Spacer(),

              ElevatedButton(
                onPressed: _completeOnboarding,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: const Text(
                  'Continue to Dashboard',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PermissionStepCard extends StatelessWidget {
  final String stepNumber;
  final String title;
  final String description;
  final bool isGranted;
  final String buttonText;
  final VoidCallback onTap;

  const _PermissionStepCard({
    required this.stepNumber,
    required this.title,
    required this.description,
    required this.isGranted,
    required this.buttonText,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isGranted ? const Color(0xFFBBF7D0) : Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isGranted ? const Color(0xFF22C55E) : const Color(0xFF2563EB),
                ),
                child: Center(
                  child: Text(
                    stepNumber,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E293B)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            description,
            style: TextStyle(fontSize: 11, color: Colors.grey.shade600, height: 1.4),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton(
              onPressed: onTap,
              style: OutlinedButton.styleFrom(
                foregroundColor: isGranted ? const Color(0xFF16A34A) : const Color(0xFF2563EB),
                side: BorderSide(color: isGranted ? const Color(0xFF22C55E) : const Color(0xFF2563EB)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: Text(buttonText, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }
}

