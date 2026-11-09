import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/supabase_service.dart';
import '../config.dart';

class CorrectionRequestScreen extends StatefulWidget {
  const CorrectionRequestScreen({Key? key}) : super(key: key);

  @override
  State<CorrectionRequestScreen> createState() => _CorrectionRequestScreenState();
}

class _CorrectionRequestScreenState extends State<CorrectionRequestScreen> {
  final _dateController = TextEditingController();
  final _inTimeController = TextEditingController(text: '09:00');
  final _outTimeController = TextEditingController(text: '16:00');
  final _reasonController = TextEditingController();

  bool _isSubmitting = false;
  String _teacherId = '';

  final List<String> _quickReasons = [
    'I turned off WiFi by mistake, I was in school till 04:00 PM.',
    'Campus WiFi was down on 2nd floor; signed paper register with HOD.',
    'Moving between lecture halls caused WiFi disconnect.',
    'Phone battery died; recharged in staff room at 02:00 PM.',
  ];

  @override
  void initState() {
    super.initState();
    _loadTeacherId();
    final today = AppConfig.nowIST().toIso8601String().substring(0, 10);
    _dateController.text = today;
  }

  Future<void> _loadTeacherId() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _teacherId = prefs.getString(AppConfig.prefTeacherId) ?? 'T001';
    });
  }

  @override
  void dispose() {
    _dateController.dispose();
    _inTimeController.dispose();
    _outTimeController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submitCorrection() async {
    final date = _dateController.text.trim();
    final reason = _reasonController.text.trim();

    if (date.isEmpty || reason.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter date and reason')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final inIso = _inTimeController.text.isNotEmpty
          ? '${date}T${_inTimeController.text}:00+05:30'
          : null;
      final outIso = _outTimeController.text.isNotEmpty
          ? '${date}T${_outTimeController.text}:00+05:30'
          : null;

      await SupabaseService().client.from('attendance_corrections').insert({
        'teacher_id': _teacherId,
        'date': date,
        'requested_in_time': inIso,
        'requested_out_time': outIso,
        'reason': reason,
        'status': 'Pending',
      });

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Correction request submitted for Admin approval!'),
          backgroundColor: Color(0xFF22C55E),
        ),
      );
      Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Submission failed: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Request Correction'),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFBFDBFE)),
              ),
              child: const Text(
                'Accidental WiFi disconnect? Submit a dispute with your actual timings. Once the Principal / Admin approves, your Excel record and hours will be updated with audit remarks.',
                style: TextStyle(fontSize: 12, color: Color(0xFF1E40AF), height: 1.4),
              ),
            ),
            const SizedBox(height: 20),

            // Form
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: _dateController,
                    decoration: const InputDecoration(
                      labelText: 'Date (YYYY-MM-DD)',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.calendar_today, size: 18),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 14),

                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _inTimeController,
                          decoration: const InputDecoration(
                            labelText: 'Actual IN (HH:MM)',
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: _outTimeController,
                          decoration: const InputDecoration(
                            labelText: 'Actual OUT (HH:MM)',
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  TextField(
                    controller: _reasonController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Reason / Explanation for Correction *',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.all(12),
                    ),
                  ),
                  const SizedBox(height: 14),

                  const Text(
                    'Quick Presets (Tap to fill):',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey),
                  ),
                  const SizedBox(height: 6),

                  ..._quickReasons.map(
                    (r) => Padding(
                      padding: const EdgeInsets.only(bottom: 6.0),
                      child: InkWell(
                        onTap: () => setState(() => _reasonController.text = r),
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade50,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: Text(r, style: TextStyle(fontSize: 11, color: Colors.grey.shade700)),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  ElevatedButton(
                    onPressed: _isSubmitting ? null : _submitCorrection,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _isSubmitting
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Submit Correction Request', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

