/// Data model for a teacher profile.
class Teacher {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final String? department;
  final String? designation;
  final String? subject;
  final String? employeeId;
  final String shift; // Shift One, Shift Two, Both
  final String status; // active, inactive
  final DateTime? createdAt;

  Teacher({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.department,
    this.designation,
    this.subject,
    this.employeeId,
    this.shift = 'Shift One',
    this.status = 'active',
    this.createdAt,
  });

  factory Teacher.fromJson(Map<String, dynamic> json) {
    return Teacher(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      phone: json['phone'] as String?,
      department: json['department'] as String?,
      designation: json['designation'] as String?,
      subject: json['subject'] as String?,
      employeeId: json['employee_id'] as String?,
      shift: (json['shift'] as String?) ?? 'Shift One',
      status: (json['status'] as String?) ?? 'active',
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'phone': phone,
      'department': department,
      'designation': designation,
      'subject': subject,
      'employee_id': employeeId,
      'shift': shift,
      'status': status,
    };
  }

  Teacher copyWith({
    String? id,
    String? name,
    String? email,
    String? phone,
    String? department,
    String? designation,
    String? subject,
    String? employeeId,
    String? shift,
    String? status,
    DateTime? createdAt,
  }) {
    return Teacher(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      department: department ?? this.department,
      designation: designation ?? this.designation,
      subject: subject ?? this.subject,
      employeeId: employeeId ?? this.employeeId,
      shift: shift ?? this.shift,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

/// Data model for a registered device.
class DeviceInfo {
  final String? id;
  final String teacherId;
  final String mobileName;
  final String? mobileModel;
  final String? osVersion;
  final String? macAddress;
  final String? ipAddress;
  final String approvalStatus; // pending, approved, rejected
  final DateTime? registeredAt;

  DeviceInfo({
    this.id,
    required this.teacherId,
    required this.mobileName,
    this.mobileModel,
    this.osVersion,
    this.macAddress,
    this.ipAddress,
    this.approvalStatus = 'pending',
    this.registeredAt,
  });

  factory DeviceInfo.fromJson(Map<String, dynamic> json) {
    return DeviceInfo(
      id: json['id']?.toString(),
      teacherId: json['teacher_id'] as String,
      mobileName: json['mobile_name'] as String,
      mobileModel: json['mobile_model'] as String?,
      osVersion: json['os_version'] as String?,
      macAddress: json['mac_address'] as String?,
      ipAddress: json['ip_address'] as String?,
      approvalStatus: (json['approval_status'] as String?) ?? 'pending',
      registeredAt: json['registered_at'] != null
          ? DateTime.parse(json['registered_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'teacher_id': teacherId,
      'mobile_name': mobileName,
      'mobile_model': mobileModel,
      'os_version': osVersion,
      'mac_address': macAddress,
      'ip_address': ipAddress,
      'approval_status': approvalStatus,
    };
  }
}

/// Data model for a leave request.
class LeaveRequest {
  final String? id;
  final String teacherId;
  final DateTime fromDate;
  final DateTime toDate;
  final String reason;
  final String status; // pending, approved, rejected
  final DateTime? createdAt;

  LeaveRequest({
    this.id,
    required this.teacherId,
    required this.fromDate,
    required this.toDate,
    required this.reason,
    this.status = 'pending',
    this.createdAt,
  });

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    return LeaveRequest(
      id: json['id']?.toString(),
      teacherId: json['teacher_id'] as String,
      fromDate: DateTime.parse(json['from_date'] as String),
      toDate: DateTime.parse(json['to_date'] as String),
      reason: json['reason'] as String,
      status: (json['status'] as String?) ?? 'pending',
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'teacher_id': teacherId,
      'from_date': fromDate.toIso8601String().substring(0, 10),
      'to_date': toDate.toIso8601String().substring(0, 10),
      'reason': reason,
      'status': status,
    };
  }

  int get totalDays => toDate.difference(fromDate).inDays + 1;
}
