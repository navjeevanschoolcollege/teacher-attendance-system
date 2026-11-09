-- ============================================================
-- TEACHER ATTENDANCE & CAMPUS MOVEMENT TRACKER
-- Complete Database Schema & Seed Data (All-in-One Migration)
-- Safe to paste & run directly in Supabase SQL Editor
-- ============================================================

-- Step 1: Clean drop of existing tables (CASCADE automatically drops triggers and constraints)
DROP TABLE IF EXISTS movement_log CASCADE;
DROP TABLE IF EXISTS attendance_audit_logs CASCADE;
DROP TABLE IF EXISTS attendance_corrections CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS leaves CASCADE;
DROP TABLE IF EXISTS holidays CASCADE;
DROP TABLE IF EXISTS wifi_settings CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;

DROP FUNCTION IF EXISTS sync_attendance_from_movement() CASCADE;
DROP FUNCTION IF EXISTS update_attendance_hours() CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;

-- Step 2: Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TEACHERS table (Supports Shift One / Shift Two / Both)
-- ============================================================
CREATE TABLE teachers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  department TEXT NOT NULL,
  designation TEXT,
  subject TEXT,
  phone TEXT,
  email TEXT UNIQUE NOT NULL,
  shift TEXT DEFAULT 'Shift One' CHECK (shift IN ('Shift One', 'Shift Two', 'Both')),
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  role TEXT DEFAULT 'teacher' CHECK (role IN ('teacher','admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. DEVICES table (1 device binding per teacher)
-- ============================================================
CREATE TABLE devices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id TEXT REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  device_uuid TEXT,
  mobile_name TEXT,
  mobile_model TEXT,
  os_version TEXT,
  mac_address TEXT,
  ip_address TEXT,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  is_approved BOOLEAN DEFAULT false,
  is_mock_detected BOOLEAN DEFAULT false,
  UNIQUE(teacher_id)
);

-- ============================================================
-- 3. WIFI_SETTINGS table (Shift timings & Geofence)
-- ============================================================
CREATE TABLE wifi_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  campus_ssid TEXT NOT NULL DEFAULT 'Campus-Staff-WiFi',
  allowed_bssids TEXT[] NOT NULL DEFAULT ARRAY['00:11:22:33:44:55'],
  allowed_ip_ranges TEXT[] NOT NULL DEFAULT ARRAY['192.168.1.0/24', '10.0.0.0/16', '127.0.0.1/32'],
  campus_lat DOUBLE PRECISION NOT NULL DEFAULT 19.0760,
  campus_lng DOUBLE PRECISION NOT NULL DEFAULT 72.8777,
  geofence_radius_meters INTEGER NOT NULL DEFAULT 200,
  shift_one_start TIME NOT NULL DEFAULT '07:15:00',
  shift_one_end TIME NOT NULL DEFAULT '12:30:00',
  shift_two_start TIME NOT NULL DEFAULT '12:30:00',
  shift_two_end TIME NOT NULL DEFAULT '17:00:00',
  grace_minutes INTEGER NOT NULL DEFAULT 10,
  half_day_hours_shift_one NUMERIC(4,2) NOT NULL DEFAULT 2.50,
  half_day_hours_shift_two NUMERIC(4,2) NOT NULL DEFAULT 2.25,
  qr_secret TEXT DEFAULT 'CAMPUS_STAFFROOM_QR_KEY_2026',
  qr_refresh_seconds INTEGER DEFAULT 120,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. ATTENDANCE table (Daily summary per teacher per shift)
-- ============================================================
CREATE TABLE attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id TEXT REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift TEXT NOT NULL DEFAULT 'Shift One' CHECK (shift IN ('Shift One', 'Shift Two', 'Both')),
  in_time TIMESTAMPTZ,
  out_time TIMESTAMPTZ,
  total_hours NUMERIC(5,2) DEFAULT 0,
  total_in_campus_hours NUMERIC(5,2) DEFAULT 0,
  total_out_break_hours NUMERIC(5,2) DEFAULT 0,
  total_entries INTEGER DEFAULT 0,
  total_exits INTEGER DEFAULT 0,
  current_presence_status TEXT DEFAULT 'Outside Campus' CHECK (current_presence_status IN ('Inside Campus', 'Outside Campus')),
  status TEXT DEFAULT 'Absent' CHECK (status IN ('Present','Late','Half Day','Absent','On Leave','WiFi Off - On Campus (GPS)','Incomplete / Needs Review')),
  late_by_minutes INTEGER DEFAULT 0,
  early_out_by_minutes INTEGER DEFAULT 0,
  ip_address TEXT,
  ssid TEXT,
  mac_address TEXT,
  mobile_name TEXT,
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  device_uuid TEXT,
  is_mock_location BOOLEAN DEFAULT false,
  flagged_suspicious BOOLEAN DEFAULT false,
  suspicious_reason TEXT,
  last_wifi_seen_at TIMESTAMPTZ,
  wifi_disconnect_start TIMESTAMPTZ,
  qr_verified_at TIMESTAMPTZ,
  mode TEXT DEFAULT 'Auto-WiFi' CHECK (mode IN ('Auto-WiFi', 'GPS Backup', 'Manual-Web', 'Admin')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, date, shift)
);

-- ============================================================
-- 5. MOVEMENT_LOG table (Tracks every entry and exit)
-- ============================================================
CREATE TABLE movement_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id TEXT REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift TEXT NOT NULL CHECK (shift IN ('Shift One', 'Shift Two', 'Both')),
  event_no INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('IN', 'OUT')),
  event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_no INTEGER NOT NULL,
  stay_duration_minutes INTEGER DEFAULT 0,
  ssid TEXT,
  bssid TEXT,
  ip_address TEXT,
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  mobile_name TEXT,
  mac_address TEXT,
  device_id TEXT,
  mode TEXT DEFAULT 'Auto-WiFi' CHECK (mode IN ('Auto-WiFi', 'GPS Backup', 'Manual-Web', 'Admin')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_movement_teacher_date ON movement_log(teacher_id, date);
CREATE INDEX idx_movement_date ON movement_log(date);
CREATE INDEX idx_movement_time ON movement_log(event_time DESC);
CREATE INDEX idx_movement_shift ON movement_log(shift);
CREATE INDEX idx_movement_event_type ON movement_log(event_type);

-- ============================================================
-- 6. LEAVES table
-- ============================================================
CREATE TABLE leaves (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id TEXT REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('Casual','Medical','Duty','Earned','Other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by TEXT REFERENCES teachers(teacher_id),
  reviewed_at TIMESTAMPTZ,
  admin_remarks TEXT
);

-- ============================================================
-- 7. HOLIDAYS table
-- ============================================================
CREATE TABLE holidays (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL UNIQUE,
  type TEXT DEFAULT 'National' CHECK (type IN ('National','Regional','School','Sunday')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. ATTENDANCE_CORRECTIONS table
-- ============================================================
CREATE TABLE attendance_corrections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  attendance_id UUID REFERENCES attendance(id) ON DELETE CASCADE,
  teacher_id TEXT REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  shift TEXT DEFAULT 'Shift One',
  requested_in TIMESTAMPTZ,
  requested_out TIMESTAMPTZ,
  requested_status TEXT CHECK (requested_status IN ('Present','Late','Half Day','Absent')),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by TEXT REFERENCES teachers(teacher_id),
  reviewed_at TIMESTAMPTZ,
  admin_remarks TEXT
);

-- ============================================================
-- 9. ATTENDANCE_AUDIT_LOGS table
-- ============================================================
CREATE TABLE attendance_audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  attendance_id UUID REFERENCES attendance(id) ON DELETE CASCADE,
  changed_by TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('CREATE','UPDATE','DELETE','CORRECTION','ADMIN_OVERRIDE')),
  old_data JSONB,
  new_data JSONB,
  reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. HELPER FUNCTION: is_admin()
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM teachers
    WHERE (email = auth.jwt() ->> 'email' OR phone = auth.jwt() ->> 'phone')
      AND role = 'admin'
      AND status = 'Active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 11. TRIGGER: Auto-calculate and sync attendance from movement_log
-- ============================================================
CREATE OR REPLACE FUNCTION sync_attendance_from_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_teacher_id TEXT;
  v_date DATE;
  v_shift TEXT;
  v_first_in TIMESTAMPTZ := NULL;
  v_last_out TIMESTAMPTZ := NULL;
  v_entries INTEGER := 0;
  v_exits INTEGER := 0;
  v_total_stay_mins INTEGER := 0;
  v_total_break_mins INTEGER := 0;
  v_last_event TEXT := 'OUT';
  v_last_seen TIMESTAMPTZ;
  v_rec RECORD;
  v_prev_in TIMESTAMPTZ := NULL;
  v_prev_out TIMESTAMPTZ := NULL;
  v_shift_end TIME;
  v_cutoff TIME;
  v_half_day_hrs NUMERIC;
  v_status TEXT := 'Present';
  v_late_mins INTEGER := 0;
  v_early_mins INTEGER := 0;
  v_in_campus_hrs NUMERIC;
  v_out_break_hrs NUMERIC;
BEGIN
  v_teacher_id := NEW.teacher_id;
  v_date := NEW.date;
  v_shift := NEW.shift;

  -- Iterate through events chronologically
  FOR v_rec IN 
    SELECT * FROM movement_log 
    WHERE teacher_id = v_teacher_id AND date = v_date AND shift = v_shift 
    ORDER BY event_time ASC, event_no ASC
  LOOP
    IF v_rec.event_type = 'IN' THEN
      v_entries := v_entries + 1;
      IF v_first_in IS NULL THEN
        v_first_in := v_rec.event_time;
      END IF;
      IF v_prev_out IS NOT NULL THEN
        v_total_break_mins := v_total_break_mins + GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_rec.event_time - v_prev_out)) / 60));
      END IF;
      v_prev_in := v_rec.event_time;
      v_last_event := 'IN';
    ELSIF v_rec.event_type = 'OUT' THEN
      v_exits := v_exits + 1;
      v_last_out := v_rec.event_time;
      IF v_prev_in IS NOT NULL THEN
        v_total_stay_mins := v_total_stay_mins + GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_rec.event_time - v_prev_in)) / 60));
      END IF;
      v_prev_out := v_rec.event_time;
      v_last_event := 'OUT';
    END IF;

    v_last_seen := v_rec.event_time;
  END LOOP;

  v_in_campus_hrs := ROUND((v_total_stay_mins / 60.0)::NUMERIC, 2);
  v_out_break_hrs := ROUND((v_total_break_mins / 60.0)::NUMERIC, 2);

  -- Determine Shift cutoffs
  IF v_shift = 'Shift Two' THEN
    v_cutoff := '12:40:00'::TIME;
    v_shift_end := '17:00:00'::TIME;
    v_half_day_hrs := 2.25;
  ELSE
    v_cutoff := '07:25:00'::TIME;
    v_shift_end := '12:30:00'::TIME;
    v_half_day_hrs := 2.50;
  END IF;

  -- Late by
  IF v_first_in IS NOT NULL THEN
    IF (v_first_in AT TIME ZONE 'Asia/Kolkata')::TIME > v_cutoff THEN
      v_late_mins := GREATEST(0, ROUND(EXTRACT(EPOCH FROM ((v_first_in AT TIME ZONE 'Asia/Kolkata')::TIME - v_cutoff)) / 60));
      v_status := 'Late';
    ELSE
      v_late_mins := 0;
      v_status := 'Present';
    END IF;
  END IF;

  -- Early out
  IF v_last_out IS NOT NULL THEN
    IF (v_last_out AT TIME ZONE 'Asia/Kolkata')::TIME < v_shift_end THEN
      v_early_mins := GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_shift_end - (v_last_out AT TIME ZONE 'Asia/Kolkata')::TIME)) / 60));
    ELSE
      v_early_mins := 0;
    END IF;

    IF v_in_campus_hrs < v_half_day_hrs THEN
      v_status := 'Half Day';
    END IF;
  END IF;

  -- Upsert into attendance summary table
  INSERT INTO attendance (
    teacher_id, date, shift, in_time, out_time, total_hours, 
    total_in_campus_hours, total_out_break_hours, total_entries, total_exits,
    current_presence_status, status, late_by_minutes, early_out_by_minutes,
    last_wifi_seen_at, mode, remarks, updated_at
  ) VALUES (
    v_teacher_id, v_date, v_shift, v_first_in, 
    CASE WHEN v_last_event = 'OUT' THEN v_last_out ELSE NULL END,
    v_in_campus_hrs, v_in_campus_hrs, v_out_break_hrs, v_entries, v_exits,
    CASE WHEN v_last_event = 'IN' THEN 'Inside Campus' ELSE 'Outside Campus' END,
    v_status, v_late_mins, v_early_mins, v_last_seen, NEW.mode,
    'Auto-tracked from movement log', NOW()
  )
  ON CONFLICT (teacher_id, date, shift) DO UPDATE SET
    in_time = v_first_in,
    out_time = CASE WHEN v_last_event = 'OUT' THEN v_last_out ELSE attendance.out_time END,
    total_hours = v_in_campus_hrs,
    total_in_campus_hours = v_in_campus_hrs,
    total_out_break_hours = v_out_break_hrs,
    total_entries = v_entries,
    total_exits = v_exits,
    current_presence_status = CASE WHEN v_last_event = 'IN' THEN 'Inside Campus' ELSE 'Outside Campus' END,
    status = v_status,
    late_by_minutes = v_late_mins,
    early_out_by_minutes = v_early_mins,
    last_wifi_seen_at = v_last_seen,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_attendance_movement
  AFTER INSERT OR UPDATE ON movement_log
  FOR EACH ROW
  EXECUTE FUNCTION sync_attendance_from_movement();

-- ============================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE wifi_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read teachers" ON teachers FOR SELECT USING (true);
CREATE POLICY "Allow insert teachers" ON teachers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update teachers" ON teachers FOR UPDATE USING (true);
CREATE POLICY "Allow delete teachers" ON teachers FOR DELETE USING (true);

CREATE POLICY "Allow read devices" ON devices FOR SELECT USING (true);
CREATE POLICY "Allow insert devices" ON devices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update devices" ON devices FOR UPDATE USING (true);

CREATE POLICY "Allow read wifi_settings" ON wifi_settings FOR SELECT USING (true);
CREATE POLICY "Allow modify wifi_settings" ON wifi_settings FOR ALL USING (true);

CREATE POLICY "Allow read attendance" ON attendance FOR SELECT USING (true);
CREATE POLICY "Allow modify attendance" ON attendance FOR ALL USING (true);

CREATE POLICY "Allow read movement_log" ON movement_log FOR SELECT USING (true);
CREATE POLICY "Allow insert movement_log" ON movement_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update movement_log" ON movement_log FOR UPDATE USING (true);
CREATE POLICY "Allow delete movement_log" ON movement_log FOR DELETE USING (true);

CREATE POLICY "Allow read leaves" ON leaves FOR SELECT USING (true);
CREATE POLICY "Allow modify leaves" ON leaves FOR ALL USING (true);

CREATE POLICY "Allow read holidays" ON holidays FOR SELECT USING (true);
CREATE POLICY "Allow modify holidays" ON holidays FOR ALL USING (true);

CREATE POLICY "Allow read corrections" ON attendance_corrections FOR SELECT USING (true);
CREATE POLICY "Allow modify corrections" ON attendance_corrections FOR ALL USING (true);

CREATE POLICY "Allow read audit_logs" ON attendance_audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow insert audit_logs" ON attendance_audit_logs FOR INSERT WITH CHECK (true);

-- ============================================================
-- 13. ENABLE REALTIME SAFELY
-- ============================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE movement_log;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 14. SEED DATA (Ready-to-test Demo Data)
-- ============================================================
INSERT INTO wifi_settings (
  campus_ssid, allowed_bssids, allowed_ip_ranges, campus_lat, campus_lng, 
  geofence_radius_meters, shift_one_start, shift_one_end, shift_two_start, shift_two_end, grace_minutes
) VALUES (
  'Campus-Staff-WiFi', 
  ARRAY['00:11:22:33:44:55', 'AA:BB:CC:DD:EE:FF', 'B4:EE:27:D1:6C:5A'], 
  ARRAY['192.168.1.0/24', '10.0.0.0/16', '127.0.0.1/32'], 
  19.0760, 72.8777, 200, 
  '07:15:00', '12:30:00', '12:30:00', '17:00:00', 10
);

-- Seed Teachers
INSERT INTO teachers (teacher_id, full_name, department, designation, phone, email, shift, role, status)
VALUES
  ('ADMIN01', 'Admin Principal', 'Administration', 'Principal', '+91 98765 00000', 'admin@school.com', 'Both', 'admin', 'Active'),
  ('T001', 'Muneeb Teacher', 'Computer Science', 'Senior Lecturer', '+91 98765 43210', 'muneeb@school.com', 'Shift One', 'teacher', 'Active'),
  ('T002', 'Sarah Sharma', 'Mathematics', 'Assistant Professor', '+91 98765 43211', 'sarah@school.com', 'Shift Two', 'teacher', 'Active'),
  ('T003', 'Priya Patel', 'Physics', 'HOD', '+91 98765 43212', 'priya@school.com', 'Both', 'teacher', 'Active'),
  ('T004', 'Rahul Verma', 'Chemistry', 'Lecturer', '+91 98765 43213', 'rahul@school.com', 'Shift One', 'teacher', 'Active'),
  ('T005', 'Anita Desai', 'English', 'Lecturer', '+91 98765 43214', 'anita@school.com', 'Shift Two', 'teacher', 'Active');

-- Seed Sample Movement Logs (which automatically calculate into attendance summary via trigger!)
-- Teacher T001 (Shift One): IN at 07:18 AM, OUT at 10:30 AM (stay 192m), IN at 10:50 AM (break 20m) -> Currently Inside!
INSERT INTO movement_log (teacher_id, date, shift, event_no, event_type, event_time, session_no, stay_duration_minutes, ssid, bssid, ip_address, gps_lat, gps_lng, mobile_name, mode, remarks)
VALUES
  ('T001', CURRENT_DATE, 'Shift One', 1, 'IN', (CURRENT_DATE + TIME '07:18:00') AT TIME ZONE 'Asia/Kolkata', 1, 0, 'Campus-Staff-WiFi', '00:11:22:33:44:55', '192.168.1.45', 19.0760, 72.8777, 'Samsung Galaxy S23', 'Auto-WiFi', 'Morning Arrival'),
  ('T001', CURRENT_DATE, 'Shift One', 2, 'OUT', (CURRENT_DATE + TIME '10:30:00') AT TIME ZONE 'Asia/Kolkata', 1, 192, 'Campus-Staff-WiFi', '00:11:22:33:44:55', '192.168.1.45', 19.0760, 72.8777, 'Samsung Galaxy S23', 'Auto-WiFi', 'Tea Break / Bank Work'),
  ('T001', CURRENT_DATE, 'Shift One', 3, 'IN', (CURRENT_DATE + TIME '10:50:00') AT TIME ZONE 'Asia/Kolkata', 2, 0, 'Campus-Staff-WiFi', '00:11:22:33:44:55', '192.168.1.45', 19.0760, 72.8777, 'Samsung Galaxy S23', 'Auto-WiFi', 'Re-entered Campus');

-- Teacher T002 (Shift Two): IN at 12:35 PM -> Currently Inside!
INSERT INTO movement_log (teacher_id, date, shift, event_no, event_type, event_time, session_no, stay_duration_minutes, ssid, bssid, ip_address, gps_lat, gps_lng, mobile_name, mode, remarks)
VALUES
  ('T002', CURRENT_DATE, 'Shift Two', 1, 'IN', (CURRENT_DATE + TIME '12:35:00') AT TIME ZONE 'Asia/Kolkata', 1, 0, 'Campus-Staff-WiFi', '00:11:22:33:44:55', '192.168.1.48', 19.0760, 72.8777, 'iPhone 14 Pro', 'Auto-WiFi', 'Afternoon Arrival');

-- Teacher T004 (Shift One): IN at 07:35 AM (Late by 10m), OUT at 11:30 AM (stay 235m) -> Currently Outside!
INSERT INTO movement_log (teacher_id, date, shift, event_no, event_type, event_time, session_no, stay_duration_minutes, ssid, bssid, ip_address, gps_lat, gps_lng, mobile_name, mode, remarks)
VALUES
  ('T004', CURRENT_DATE, 'Shift One', 1, 'IN', (CURRENT_DATE + TIME '07:35:00') AT TIME ZONE 'Asia/Kolkata', 1, 0, 'Campus-Staff-WiFi', '00:11:22:33:44:55', '192.168.1.52', 19.0760, 72.8777, 'OnePlus 11', 'Auto-WiFi', 'Morning Arrival (Late)'),
  ('T004', CURRENT_DATE, 'Shift One', 2, 'OUT', (CURRENT_DATE + TIME '11:30:00') AT TIME ZONE 'Asia/Kolkata', 1, 235, 'Campus-Staff-WiFi', '00:11:22:33:44:55', '192.168.1.52', 19.0760, 72.8777, 'OnePlus 11', 'Auto-WiFi', 'Left campus for seminar');
