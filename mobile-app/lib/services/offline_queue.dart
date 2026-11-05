import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'supabase_service.dart';
import '../models/attendance_record.dart';

class OfflineQueue {
  static final OfflineQueue _instance = OfflineQueue._internal();
  factory OfflineQueue() => _instance;
  OfflineQueue._internal();

  Database? _db;

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _initDb();
    return _db!;
  }

  Future<Database> _initDb() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'attendance_offline.db');

    return await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE offline_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id TEXT NOT NULL,
            date TEXT NOT NULL,
            in_time TEXT,
            out_time TEXT,
            total_hours REAL,
            status TEXT,
            late_by_minutes INTEGER,
            early_out_by_minutes INTEGER,
            mobile_name TEXT,
            mac_address TEXT,
            ip_address TEXT,
            ssid TEXT,
            mode TEXT,
            remarks TEXT,
            synced INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
          )
        ''');
      },
    );
  }

  /// Add record to offline queue
  Future<int> addToQueue(AttendanceRecord record) async {
    final db = await database;
    return await db.insert(
      'offline_queue',
      {
        'teacher_id': record.teacherId,
        'date': record.date.toIso8601String().substring(0, 10),
        'in_time': record.inTime?.toIso8601String(),
        'out_time': record.outTime?.toIso8601String(),
        'total_hours': record.totalHours,
        'status': record.status,
        'late_by_minutes': record.lateByMinutes,
        'early_out_by_minutes': record.earlyOutByMinutes,
        'mobile_name': record.mobileName,
        'mac_address': record.macAddress,
        'ip_address': record.ipAddress,
        'ssid': record.ssid,
        'mode': record.mode,
        'remarks': record.remarks,
        'synced': 0,
        'created_at': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Get pending unsynced records
  Future<List<Map<String, dynamic>>> getUnsynced() async {
    final db = await database;
    return await db.query(
      'offline_queue',
      where: 'synced = ?',
      whereArgs: [0],
      orderBy: 'created_at ASC',
    );
  }

  /// Mark queue row as synced
  Future<void> markSynced(int id) async {
    final db = await database;
    await db.update(
      'offline_queue',
      {'synced': 1},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// Sync all unsynced records to Supabase
  Future<int> syncAll(SupabaseService supabaseService) async {
    final unsynced = await getUnsynced();
    int syncedCount = 0;

    for (final row in unsynced) {
      try {
        final record = AttendanceRecord(
          teacherId: row['teacher_id'] as String,
          date: DateTime.parse(row['date'] as String),
          inTime: row['in_time'] != null ? DateTime.parse(row['in_time'] as String) : null,
          outTime: row['out_time'] != null ? DateTime.parse(row['out_time'] as String) : null,
          totalHours: row['total_hours'] != null ? (row['total_hours'] as num).toDouble() : null,
          status: (row['status'] as String?) ?? 'Present',
          lateByMinutes: row['late_by_minutes'] as int?,
          earlyOutByMinutes: row['early_out_by_minutes'] as int?,
          mobileName: row['mobile_name'] as String?,
          macAddress: row['mac_address'] as String?,
          ip_address: row['ip_address'] as String?,
          ssid: row['ssid'] as String?,
          mode: (row['mode'] as String?) ?? 'Auto-WiFi',
          remarks: row['remarks'] as String?,
        );

        await supabaseService.checkInAttendance(record);
        await markSynced(row['id'] as int);
        syncedCount++;
      } catch (e) {
        // Stop on connection error, will retry on next cycle
        break;
      }
    }
    return syncedCount;
  }
}
