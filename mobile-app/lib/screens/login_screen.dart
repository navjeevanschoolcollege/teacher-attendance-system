import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/supabase_service.dart';
import '../services/wifi_service.dart';
import '../config.dart';
import 'device_registration_screen.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    _checkSavedSession();
  }

  Future<void> _checkSavedSession() async {
    final prefs = await SharedPreferences.getInstance();
    final isLoggedIn = prefs.getBool(AppConfig.prefLoggedIn) ?? false;
    final teacherId = prefs.getString(AppConfig.prefTeacherId);

    if (isLoggedIn && teacherId != null && mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    }
  }

  Future<void> _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter both email and password')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      // 1. Request location permission for WiFi detection
      await WiFiService().requestPermissions();

      // 2. Supabase Login
      final authResponse = await SupabaseService().login(email, password);
      if (authResponse.user == null) {
        throw Exception('Login failed. Please check credentials.');
      }

      // 3. Fetch teacher profile
      final teacher = await SupabaseService().getTeacherProfile(email);
      if (teacher == null) {
        throw Exception('No teacher profile associated with this account.');
      }

      // 4. Save preferences
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConfig.prefTeacherId, teacher.teacherId);
      await prefs.setString(AppConfig.prefTeacherEmail, teacher.email);
      await prefs.setString(AppConfig.prefTeacherName, teacher.fullName);
      await prefs.setBool(AppConfig.prefLoggedIn, true);

      // 5. Fetch campus WiFi settings & cache locally
      final wifiSettings = await SupabaseService().getWiFiSettings();
      if (wifiSettings != null) {
        await prefs.setString(AppConfig.prefCampusSsid, wifiSettings['campus_ssid'] ?? 'Woxsen_Campus_WiFi');
        await prefs.setBool(AppConfig.prefDemoMode, wifiSettings['demo_mode'] ?? true);
        await prefs.setString(AppConfig.prefDemoSsid, wifiSettings['demo_ssid'] ?? 'Test_Campus_WiFi');
        if (wifiSettings['allowed_bssid_list'] != null) {
          final list = List<String>.from(wifiSettings['allowed_bssid_list']);
          await prefs.setStringList(AppConfig.prefAllowedBssids, list);
        }
      }

      // 6. Check if mobile device is registered
      final device = await SupabaseService().getDevice(teacher.teacherId);

      if (!mounted) return;

      if (device == null) {
        // Navigate to device registration
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => DeviceRegistrationScreen(teacher: teacher),
          ),
        );
      } else {
        // Device already registered -> Go to home
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const HomeScreen()),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: Colors.red.shade600,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _fillDemo(String email, String pass) {
    _emailController.text = email;
    _passwordController.text = pass;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo Icon
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: const Color(0xFF2563EB).withOpacity(0.2),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFF3B82F6).withOpacity(0.3)),
                  ),
                  child: const Icon(
                    Icons.wifi_tethering,
                    size: 38,
                    color: Color(0xFF60A5FA),
                  ),
                ),
                const SizedBox(height: 20),

                // Title
                const Text(
                  'Campus WiFi Attendance',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Faculty Mobile Auto-Presence App',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.grey.shade400,
                  ),
                ),
                const SizedBox(height: 32),

                // Form Card
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.2),
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'Teacher Sign In',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1E293B),
                        ),
                      ),
                      const SizedBox(height: 18),

                      // Email Field
                      TextField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: InputDecoration(
                          labelText: 'Email Address / Teacher ID',
                          prefixIcon: const Icon(Icons.email_outlined),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Password Field
                      TextField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        decoration: InputDecoration(
                          labelText: 'Password',
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword ? Icons.visibility_off : Icons.visibility,
                            ),
                            onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Login Button
                      ElevatedButton(
                        onPressed: _isLoading ? null : _handleLogin,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectanglePlatform.isAndroid
                              ? RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))
                              : RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              )
                            : const Text(
                                'Sign In to Campus App',
                                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                              ),
                      ),

                      const SizedBox(height: 20),
                      const Divider(),
                      const SizedBox(height: 12),

                      // Demo Credentials
                      Text(
                        'DEMO LOGIN (1-CLICK)',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey.shade500,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 8),

                      OutlinedButton(
                        onPressed: () => _fillDemo('muneeb@school.com', 'teacher123'),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('Fill Demo: Teacher T001'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

