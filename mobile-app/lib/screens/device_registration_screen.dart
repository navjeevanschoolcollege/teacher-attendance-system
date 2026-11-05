import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/teacher.dart';
import '../services/device_info_service.dart';
import '../services/supabase_service.dart';
import '../config.dart';
import 'home_screen.dart';

class DeviceRegistrationScreen extends StatefulWidget {
  final Teacher teacher;

  const DeviceRegistrationScreen({Key? key, required this.teacher}) : super(key: key);

  @override
  State<DeviceRegistrationScreen> createState() => _DeviceRegistrationScreenState();
}

class _DeviceRegistrationScreenState extends State<DeviceRegistrationScreen> {
  Map<String, dynamic>? _deviceInfo;
  bool _isLoading = true;
  bool _isRegistering = false;

  @override
  void initState() {
    super.initState();
    _loadDeviceInfo();
  }

  Future<void> _loadDeviceInfo() async {
    final info = await DeviceInfoService().getDeviceInfo();
    if (mounted) {
      setState(() {
        _deviceInfo = info;
        _isLoading = false;
      });
    }
  }

  Future<void> _registerDevice() async {
    if (_deviceInfo == null) return;

    setState(() => _isRegistering = true);
    try {
      final payload = {
        'teacher_id': widget.teacher.teacherId,
        'mobile_name': _deviceInfo!['mobile_name'],
        'mobile_model': _deviceInfo!['mobile_model'],
        'os_version': _deviceInfo!['os_version'],
        'mac_address': _deviceInfo!['mac_address'],
        'ip_address': _deviceInfo!['ip_address'],
        'is_approved': true, // Auto-approve first device or mark as true
        'registered_at': DateTime.now().toIso8601String(),
      };

      await SupabaseService().registerDevice(payload);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(AppConfig.prefDeviceRegistered, true);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Device registered successfully!'),
          backgroundColor: Color(0xFF22C55E),
        ),
      );

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Registration failed: ${e.toString()}'),
            backgroundColor: Colors.red.shade600,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isRegistering = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Device Verification'),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
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
                      children: [
                        const Icon(Icons.security, color: Color(0xFF2563EB)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            '1 Teacher = 1 Mobile Device rule. This device will be permanently bound to your Teacher ID (${widget.teacher.teacherId}).',
                            style: const TextStyle(fontSize: 12, color: Color(0xFF1E40AF)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  const Text(
                    'Detected Hardware Details',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                  const SizedBox(height: 12),

                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Column(
                      children: [
                        _DetailRow('Faculty Name', widget.teacher.fullName),
                        _DetailRow('Teacher ID', widget.teacher.teacherId),
                        _DetailRow('Mobile Name', _deviceInfo?['mobile_name'] ?? '-'),
                        _DetailRow('Model', _deviceInfo?['mobile_model'] ?? '-'),
                        _DetailRow('OS Version', _deviceInfo?['os_version'] ?? '-'),
                        _DetailRow('Hardware MAC', _deviceInfo?['mac_address'] ?? '-', isMono: true),
                        _DetailRow('Current IP', _deviceInfo?['ip_address'] ?? '-', isMono: true),
                      ],
                    ),
                  ),

                  const Spacer(),

                  ElevatedButton(
                    onPressed: _isRegistering ? null : _registerDevice,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: 0,
                    ),
                    child: _isRegistering
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : const Text(
                            'Confirm & Register This Phone',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                          ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isMono;

  const _DetailRow(this.label, this.value, {this.isMono = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          Text(
            value,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              fontFamily: isMono ? 'monospace' : null,
              color: const Color(0xFF1E293B),
            ),
          ),
        ],
      ),
    );
  }
}

