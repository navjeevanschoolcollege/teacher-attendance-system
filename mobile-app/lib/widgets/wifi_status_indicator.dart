import 'package:flutter/material.dart';

class WiFiStatusIndicator extends StatelessWidget {
  final String? currentSsid;
  final bool isCampusWiFi;
  final String campusSsid;

  const WiFiStatusIndicator({
    Key? key,
    required this.currentSsid,
    required this.isCampusWiFi,
    required this.campusSsid,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isCampusWiFi ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isCampusWiFi ? const Color(0xFFBBF7D0) : const Color(0xFFFECACA),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: isCampusWiFi ? const Color(0xFF22C55E) : const Color(0xFFEF4444),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.wifi,
              color: Colors.white,
              size: 20,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      isCampusWiFi ? 'Connected to Campus WiFi' : 'Not Connected to Campus WiFi',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: isCampusWiFi ? const Color(0xFF15803D) : const Color(0xFFB91C1C),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isCampusWiFi ? const Color(0xFF22C55E) : const Color(0xFFEF4444),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  currentSsid != null && currentSsid!.isNotEmpty
                    ? 'Current Network: $currentSsid'
                    : 'No WiFi connected (using Mobile Data or Offline)',
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

