import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/attendance_record.dart';
import '../services/supabase_service.dart';
import '../services/wifi_service.dart';
import '../services/offline_queue.dart';
import '../widgets/status_card.dart';
import '../widgets/wifi_status_indicator.dart';
import '../widgets/attendance_calendar.dart';
import '../config.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  String _teacherId = '';
  String _teacherName = '';
  String _teacherEmail = '';
  String _teacherShift = 'Shift One';

  // WiFi & Attendance State
  String? _currentSsid;
  bool _isCampusWiFi = false;
  String _campusSsid = 'Woxsen_Campus_WiFi';
  AttendanceRecord? _todayRecord;
  int _pendingSyncCount = 0;
  bool _isLoading = true;

  // Attendance Tab State
  DateTime _selectedMonth = DateTime.now();
  List<AttendanceRecord> _monthRecords = [];

  // Leave Tab State
  List<Map<String, dynamic>> _myLeaves = [];
  final _leaveFromController = TextEditingController();
  final _leaveToController = TextEditingController();
  final _leaveReasonController = TextEditingController();
  bool _submittingLeave = false;

  Timer? _wifiPollTimer;

  @override
  void initState() {
    super.initState();
    _loadInitialData();

    // Foreground 2-minute WiFi poll timer
    _wifiPollTimer = Timer.periodic(
      const Duration(minutes: AppConfig.wifiCheckIntervalMinutes),
      (_) => _checkWiFiAndAttendance(),
    );
  }

  @override
  void dispose() {
    _wifiPollTimer?.cancel();
    _leaveFromController.dispose();
    _leaveToController.dispose();
    _leaveReasonController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _teacherId = prefs.getString(AppConfig.prefTeacherId) ?? 'T001';
      _teacherName = prefs.getString(AppConfig.prefTeacherName) ?? 'Faculty Member';
      _teacherEmail = prefs.getString(AppConfig.prefTeacherEmail) ?? '';
      _teacherShift = prefs.getString(AppConfig.prefTeacherShift) ?? 'Shift One';
      _campusSsid = prefs.getString(AppConfig.prefCampusSsid) ?? 'Woxsen_Campus_WiFi';
    });

    await _checkWiFiAndAttendance();
    await _loadMonthAttendance();
    await _loadLeaves();
  }

  Future<void> _checkWiFiAndAttendance() async {
    try {
      final ssid = await WiFiService().getCurrentSSID();
      final isCampus = await WiFiService().isConnectedToCampusWiFi(
        campusSsid: _campusSsid,
        demoMode: true,
      );

      final today = await SupabaseService().getTodayAttendance(_teacherId);
      final unsynced = await OfflineQueue().getUnsynced();

      if (mounted) {
        setState(() {
          _currentSsid = ssid;
          _isCampusWiFi = isCampus;
          _todayRecord = today;
          _pendingSyncCount = unsynced.length;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loadMonthAttendance() async {
    final start = DateTime(_selectedMonth.year, _selectedMonth.month, 1);
    final end = DateTime(_selectedMonth.year, _selectedMonth.month + 1, 0);
    try {
      final records = await SupabaseService().getMyAttendance(_teacherId, start, end);
      if (mounted) setState(() => _monthRecords = records);
    } catch (_) {}
  }

  Future<void> _loadLeaves() async {
    try {
      final leaves = await SupabaseService().getMyLeaves(_teacherId);
      if (mounted) setState(() => _myLeaves = leaves);
    } catch (_) {}
  }

  Future<void> _manualCheckIn() async {
    final now = AppConfig.nowIST();
    final todayStr = now.toIso8601String().substring(0, 10);
    final ip = await WiFiService().getIPAddress();
    final bssid = await WiFiService().getCurrentBSSID();

    final record = AttendanceRecord(
      teacherId: _teacherId,
      date: DateTime.parse(todayStr),
      inTime: now,
      status: (now.hour > 9 || (now.hour == 9 && now.minute > 10)) ? 'Late' : 'Present',
      ssid: _currentSsid ?? _campusSsid,
      macAddress: bssid,
      ipAddress: ip,
      mode: 'Auto-WiFi',
      remarks: 'Manual tap on campus mobile app',
    );

    try {
      await SupabaseService().checkInAttendance(record);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Checked IN successfully!'), backgroundColor: Color(0xFF22C55E)),
      );
    } catch (e) {
      await OfflineQueue().addToQueue(record);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Saved locally in offline queue (No Internet)'), backgroundColor: Colors.orange),
      );
    }
    await _checkWiFiAndAttendance();
  }

  Future<void> _manualCheckOut() async {
    final now = AppConfig.nowIST();
    try {
      await SupabaseService().checkOutAttendance(_teacherId, now);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Checked OUT successfully!'), backgroundColor: Color(0xFF22C55E)),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Check-out error: $e'), backgroundColor: Colors.red),
      );
    }
    await _checkWiFiAndAttendance();
  }

  Future<void> _handleApplyLeave() async {
    final from = _leaveFromController.text.trim();
    final to = _leaveToController.text.trim();
    final reason = _leaveReasonController.text.trim();

    if (from.isEmpty || to.isEmpty || reason.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill all fields')),
      );
      return;
    }

    setState(() => _submittingLeave = true);
    try {
      await SupabaseService().applyLeave(_teacherId, from, to, reason);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Leave applied successfully!'), backgroundColor: Color(0xFF22C55E)),
      );
      _leaveFromController.clear();
      _leaveToController.clear();
      _leaveReasonController.clear();
      await _loadLeaves();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _submittingLeave = false);
    }
  }

  Future<void> _handleLogout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    await SupabaseService().logout();

    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          _currentIndex == 0
              ? 'Campus Attendance'
              : _currentIndex == 1
                  ? 'Attendance Calendar'
                  : _currentIndex == 2
                      ? 'Leave Applications'
                      : 'Faculty Profile',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              _checkWiFiAndAttendance();
              _loadMonthAttendance();
              _loadLeaves();
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : IndexedStack(
              index: _currentIndex,
              children: [
                _buildHomeTab(),
                _buildAttendanceTab(),
                _buildLeaveTab(),
                _buildProfileTab(),
              ],
            ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: const Color(0xFF2563EB),
        unselectedItemColor: Colors.grey.shade500,
        selectedFontSize: 11,
        unselectedFontSize: 11,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), activeIcon: Icon(Icons.dashboard), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.calendar_month_outlined), activeIcon: Icon(Icons.calendar_month), label: 'Calendar'),
          BottomNavigationBarItem(icon: Icon(Icons.event_note_outlined), activeIcon: Icon(Icons.event_note), label: 'Leave'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }

  // ── Tab 1: Home ─────────────────────────────────────────────────────────────
  Widget _buildHomeTab() {
    return RefreshIndicator(
      onRefresh: _checkWiFiAndAttendance,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // My Assigned Shift Card
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1E3A8A), Color(0xFF2563EB)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF2563EB).withOpacity(0.25),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.access_time_filled, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'ASSIGNED SHIFT',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 10,
                            letterSpacing: 1.1,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _teacherShift == 'Shift Two'
                              ? 'My Shift: Shift Two, 12:30 PM - 05:00 PM'
                              : _teacherShift == 'Both'
                                  ? 'My Shift: Both Shifts (07:15 AM - 05:00 PM)'
                                  : 'My Shift: Shift One, 07:15 AM - 12:30 PM',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // WiFi Status Indicator
            WiFiStatusIndicator(
              currentSsid: _currentSsid,
              isCampusWiFi: _isCampusWiFi,
              campusSsid: _campusSsid,
            ),
            const SizedBox(height: 16),

            // Today Status Metric Cards
            Row(
              children: [
                Expanded(
                  child: StatusCard(
                    title: 'IN Time',
                    value: _todayRecord?.inTime != null
                        ? "${_todayRecord!.inTime!.hour.toString().padLeft(2, '0')}:${_todayRecord!.inTime!.minute.toString().padLeft(2, '0')}"
                        : '--:--',
                    icon: Icons.login,
                    color: const Color(0xFF22C55E),
                    subtitle: _todayRecord?.lateByMinutes != null && _todayRecord!.lateByMinutes! > 0
                        ? '+${_todayRecord!.lateByMinutes}m Late'
                        : (_teacherShift == 'Shift Two' ? 'Scheduled: 12:30' : 'Scheduled: 07:15'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: StatusCard(
                    title: 'OUT Time',
                    value: _todayRecord?.outTime != null
                        ? "${_todayRecord!.outTime!.hour.toString().padLeft(2, '0')}:${_todayRecord!.outTime!.minute.toString().padLeft(2, '0')}"
                        : '--:--',
                    icon: Icons.logout,
                    color: const Color(0xFFEF4444),
                    subtitle: _todayRecord?.totalHours != null
                        ? '${_todayRecord!.totalHours} hrs worked'
                        : (_teacherShift == 'Shift Two' ? 'Scheduled: 17:00' : 'Scheduled: 12:30'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Background Service & Queue Info
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: const [
                          Icon(Icons.sync_alt, size: 16, color: Color(0xFF2563EB)),
                          SizedBox(width: 8),
                          Text('Offline Attendance Queue', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        ],
                      ),
                      Text(
                        _pendingSyncCount == 0 ? 'All Synced' : '$_pendingSyncCount Pending',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: _pendingSyncCount == 0 ? const Color(0xFF22C55E) : Colors.orange,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Background service runs every 2 mins to monitor campus WiFi. Even with zero internet, attendance is saved safely on your phone.',
                    style: TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Manual Fallback Buttons
            const Text(
              'Manual WiFi Action (Fallback)',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _manualCheckIn,
                    icon: const Icon(Icons.login),
                    label: const Text('Mark IN'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF22C55E),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _manualCheckOut,
                    icon: const Icon(Icons.logout),
                    label: const Text('Mark OUT'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEF4444),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── Tab 2: Calendar ─────────────────────────────────────────────────────────
  Widget _buildAttendanceTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          AttendanceCalendar(
            month: _selectedMonth,
            records: _monthRecords,
            onSelectRecord: (r) {
              if (r == null) return;
              showDialog(
                context: context,
                builder: (_) => AlertDialog(
                  title: Text('Date: ${r.date.toIso8601String().substring(0, 10)}'),
                  content: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Status: ${r.status}'),
                      const SizedBox(height: 6),
                      Text('IN Time: ${r.inTime ?? "-"}'),
                      const SizedBox(height: 6),
                      Text('OUT Time: ${r.outTime ?? "-"}'),
                      const SizedBox(height: 6),
                      Text('Total Hours: ${r.totalHours ?? 0} hrs'),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  // ── Tab 3: Leave ────────────────────────────────────────────────────────────
  Widget _buildLeaveTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Apply for Leave', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                TextField(
                  controller: _leaveFromController,
                  decoration: const InputDecoration(
                    labelText: 'From Date (YYYY-MM-DD)',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _leaveToController,
                  decoration: const InputDecoration(
                    labelText: 'To Date (YYYY-MM-DD)',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _leaveReasonController,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Reason for Leave',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
                const SizedBox(height: 14),
                ElevatedButton(
                  onPressed: _submittingLeave ? null : _handleApplyLeave,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                  ),
                  child: _submittingLeave ? const Text('Submitting...') : const Text('Submit Application'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text('My Leave History', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          ..._myLeaves.map(
            (l) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${l["from_date"]} to ${l["to_date"]}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                      Text(l['reason'] ?? '', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: l['status'] == 'Approved' ? Colors.green.shade50 : Colors.amber.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      l['status'] ?? 'Pending',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: l['status'] == 'Approved' ? Colors.green : Colors.amber.shade800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Tab 4: Profile ──────────────────────────────────────────────────────────
  Widget _buildProfileTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: const Color(0xFF2563EB).withOpacity(0.1),
                  child: const Icon(Icons.person, size: 40, color: Color(0xFF2563EB)),
                ),
                const SizedBox(height: 12),
                Text(_teacherName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                Text('Teacher ID: $_teacherId', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                Text(_teacherEmail, style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ],
            ),
          ),
          const SizedBox(height: 20),
          ElevatedButton.icon(
            onPressed: _handleLogout,
            icon: const Icon(Icons.logout),
            label: const Text('Sign Out'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 0,
            ),
          ),
        ],
      ),
    );
  }
}

