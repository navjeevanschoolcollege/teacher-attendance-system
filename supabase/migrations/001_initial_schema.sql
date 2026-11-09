-- ============================================================
-- Teacher Attendance System - Initial Database Schema
-- Supabase Migration: 001_initial_schema.sql
-- ============================================================

-- Drop existing tables if re-running
DROP TABLE IF EXISTS attendance_audit_logs, attendance_corrections, attendance, devices, leaves, holidays, wifi_settings, teachers CASCADE;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TEACHERS table
-- ============================================================
CREATE TABLE teachers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id TEXT UNIQUE NOT NULL, -- e.g. T001
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
-- DEVICES table (1 device per teacher)
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
-- WIFI_SETTINGS table
-- ============================================================
CREATE TABLE wifi_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  campus_ssid TEXT DEFAULT 'Woxsen_Campus_WiFi',
  allowed_bssid_list TEXT[] DEFAULT '{}',
  campus_ip_range TEXT DEFAULT '192.168.1.0/24',
  campus_lat DOUBLE PRECISION DEFAULT 17.5449,
  campus_lng DOUBLE PRECISION DEFAULT 78.5718,
  geofence_radius_meters INTEGER DEFAULT 200,
  qr_secret TEXT DEFAULT 'CAMPUS_STAFFROOM_QR_KEY_2026',
  shift_one_start TIME DEFAULT '07:15:00',
  shift_one_end TIME DEFAULT '12:30:00',
  shift_two_start TIME DEFAULT '12:30:00',
  shift_two_end TIME DEFAULT '17:00:00',
  grace_minutes INTEGER DEFAULT 10,
  demo_mode BOOLEAN DEFAULT true,
  demo_ssid TEXT DEFAULT 'Test_Campus_WiFi',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ATTENDANCE table (one record per teacher per date per shift)
-- ============================================================
CREATE TABLE attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id TEXT REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift TEXT NOT NULL DEFAULT 'Shift One' CHECK (shift IN ('Shift One', 'Shift Two')),
  in_time TIMESTAMPTZ,
  out_time TIMESTAMPTZ,
  total_hours NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'Absent' CHECK (status IN (
    'Present',
    'Late',
    'Absent',
    'Half Day',
    'On Leave',
    'Holiday',
    'WiFi Off - On Campus (GPS)',
    'Incomplete / Needs Review'
  )),
  late_by_minutes INTEGER DEFAULT 0,
  early_out_by_minutes INTEGER DEFAULT 0,
  mobile_name TEXT,
  mac_address TEXT,
  ip_address TEXT,
  ssid TEXT,
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  device_uuid TEXT,
  is_mock_location BOOLEAN DEFAULT false,
  flagged_suspicious BOOLEAN DEFAULT false,
  suspicious_reason TEXT,
  last_wifi_seen_at TIMESTAMPTZ,
  qr_verified_at TIMESTAMPTZ,
  mode TEXT DEFAULT 'Auto-WiFi' CHECK (mode IN ('Auto-WiFi','Manual-Web','Admin','GPS Backup')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, date, shift)
);

-- ============================================================
-- CORRECTIONS table (Disputes & correction requests)
-- ============================================================
CREATE TABLE attendance_corrections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  attendance_id UUID REFERENCES attendance(id) ON DELETE CASCADE,
  teacher_id TEXT REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  requested_in_time TIMESTAMPTZ,
  requested_out_time TIMESTAMPTZ,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  admin_notes TEXT,
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS table (Immutable change tracking)
-- ============================================================
CREATE TABLE attendance_audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  attendance_id UUID REFERENCES attendance(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL,
  date DATE NOT NULL,
  old_values JSONB,
  new_values JSONB,
  action TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEAVES table
-- ============================================================
CREATE TABLE leaves (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id TEXT REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HOLIDAYS table
-- ============================================================
CREATE TABLE holidays (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_teacher ON attendance(teacher_id);
CREATE INDEX idx_attendance_teacher_date ON attendance(teacher_id, date);
CREATE INDEX idx_leaves_teacher ON leaves(teacher_id);

-- ============================================================
-- ROW LEVEL SECURITY - Enable on all tables
-- ============================================================
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE wifi_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS FOR RLS (Prevents infinite recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.teachers WHERE email = auth.jwt()->>'email' LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.current_teacher_id()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT teacher_id FROM public.teachers WHERE email = auth.jwt()->>'email' LIMIT 1;
$$;

-- ============================================================
-- RLS POLICIES: Teachers
-- ============================================================
CREATE POLICY "Allow select teachers" ON teachers FOR SELECT USING (true);
CREATE POLICY "Allow admin manage teachers" ON teachers FOR ALL USING (is_admin() OR auth.role() = 'service_role');

-- ============================================================
-- RLS POLICIES: Attendance
-- ============================================================
CREATE POLICY "Allow select attendance" ON attendance FOR SELECT USING (true);
CREATE POLICY "Allow insert attendance" ON attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update attendance" ON attendance FOR UPDATE USING (true);
CREATE POLICY "Allow delete attendance" ON attendance FOR DELETE USING (is_admin() OR auth.role() = 'service_role');

-- ============================================================
-- RLS POLICIES: Devices
-- ============================================================
CREATE POLICY "Allow select devices" ON devices FOR SELECT USING (true);
CREATE POLICY "Allow insert devices" ON devices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update devices" ON devices FOR UPDATE USING (true);
CREATE POLICY "Allow delete devices" ON devices FOR DELETE USING (is_admin() OR auth.role() = 'service_role');

-- ============================================================
-- RLS POLICIES: Leaves
-- ============================================================
CREATE POLICY "Allow select leaves" ON leaves FOR SELECT USING (true);
CREATE POLICY "Allow insert leaves" ON leaves FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update leaves" ON leaves FOR UPDATE USING (is_admin() OR auth.role() = 'service_role');
CREATE POLICY "Allow delete leaves" ON leaves FOR DELETE USING (is_admin() OR auth.role() = 'service_role');

-- ============================================================
-- RLS POLICIES: Holidays
-- ============================================================
CREATE POLICY "Allow select holidays" ON holidays FOR SELECT USING (true);
CREATE POLICY "Allow admin manage holidays" ON holidays FOR ALL USING (is_admin() OR auth.role() = 'service_role');

-- ============================================================
-- RLS POLICIES: WiFi Settings
-- ============================================================
CREATE POLICY "Allow select wifi_settings" ON wifi_settings FOR SELECT USING (true);
CREATE POLICY "Allow admin manage wifi_settings" ON wifi_settings FOR ALL USING (is_admin() OR auth.role() = 'service_role');

-- ============================================================
-- RLS POLICIES: Corrections & Audit Logs
-- ============================================================
ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select corrections" ON attendance_corrections FOR SELECT USING (true);
CREATE POLICY "Allow insert corrections" ON attendance_corrections FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update corrections" ON attendance_corrections FOR UPDATE USING (is_admin() OR auth.role() = 'service_role');
CREATE POLICY "Allow delete corrections" ON attendance_corrections FOR DELETE USING (is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Allow select audit_logs" ON attendance_audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow insert audit_logs" ON attendance_audit_logs FOR INSERT WITH CHECK (true);

-- ============================================================
-- SEED DATA: WiFi Settings (Two Shifts: 07:15 - 12:30 and 12:30 - 17:00)
-- ============================================================
INSERT INTO wifi_settings (campus_ssid, allowed_bssid_list, campus_ip_range, shift_one_start, shift_one_end, shift_two_start, shift_two_end, grace_minutes, demo_mode, demo_ssid)
VALUES ('Woxsen_Campus_WiFi', ARRAY['AA:BB:CC:DD:EE:01','AA:BB:CC:DD:EE:02'], '192.168.1.0/24', '07:15:00', '12:30:00', '12:30:00', '17:00:00', 10, true, 'Test_Campus_WiFi');

-- ============================================================
-- SEED DATA: 10 Teachers with assigned shifts
-- ============================================================
INSERT INTO teachers (teacher_id, full_name, department, designation, subject, phone, email, shift, role) VALUES
('T001', 'Muneeb Siddiqui', 'AI/ML', 'Assistant Professor', 'Python', '9876543210', 'muneeb@school.com', 'Shift One', 'admin'),
('T002', 'Shriansh Singh', 'CSE', 'Associate Professor', 'Data Structures', '9876543211', 'shriansh@school.com', 'Shift Two', 'teacher'),
('T003', 'Abdul Raheem', 'ECE', 'Professor', 'Digital Electronics', '9876543212', 'abdul@school.com', 'Both', 'teacher'),
('T004', 'Priya Sharma', 'Mathematics', 'Assistant Professor', 'Calculus', '9876543213', 'priya@school.com', 'Shift One', 'teacher'),
('T005', 'Rajesh Kumar', 'Physics', 'Associate Professor', 'Quantum Mechanics', '9876543214', 'rajesh@school.com', 'Shift Two', 'teacher'),
('T006', 'Sneha Patel', 'Chemistry', 'Assistant Professor', 'Organic Chemistry', '9876543215', 'sneha@school.com', 'Both', 'teacher'),
('T007', 'Vikram Reddy', 'CSE', 'Professor', 'Operating Systems', '9876543216', 'vikram@school.com', 'Shift One', 'teacher'),
('T008', 'Fatima Khan', 'AI/ML', 'Associate Professor', 'Machine Learning', '9876543217', 'fatima@school.com', 'Shift Two', 'teacher'),
('T009', 'Arjun Nair', 'ECE', 'Assistant Professor', 'VLSI Design', '9876543218', 'arjun@school.com', 'Both', 'teacher'),
('T010', 'Kavitha Iyer', 'Mathematics', 'Professor', 'Linear Algebra', '9876543219', 'kavitha@school.com', 'Both', 'teacher');

-- ============================================================
-- SEED DATA: Devices (one per teacher)
-- ============================================================
INSERT INTO devices (teacher_id, mobile_name, mobile_model, os_version, mac_address, ip_address, is_approved) VALUES
('T001', 'Samsung Galaxy A54', 'SM-A546E', 'Android 14', 'AA:BB:CC:11:22:33', '192.168.1.45', true),
('T002', 'Redmi Note 13 Pro', 'M13 Pro', 'Android 14', 'AA:BB:CC:11:22:34', '192.168.1.46', true),
('T003', 'Vivo V29', 'V2250', 'Android 13', 'AA:BB:CC:11:22:35', '192.168.1.47', true),
('T004', 'iPhone 15', 'A3090', 'iOS 17', 'AA:BB:CC:11:22:36', '192.168.1.48', true),
('T005', 'OnePlus 12', 'CPH2583', 'Android 14', 'AA:BB:CC:11:22:37', '192.168.1.49', true),
('T006', 'Oppo Reno 11', 'CPH2599', 'Android 14', 'AA:BB:CC:11:22:38', '192.168.1.50', true),
('T007', 'Realme 12 Pro', 'RMX3840', 'Android 14', 'AA:BB:CC:11:22:39', '192.168.1.51', true),
('T008', 'Samsung Galaxy S24', 'SM-S921B', 'Android 14', 'AA:BB:CC:11:22:40', '192.168.1.52', true),
('T009', 'Redmi Note 12', 'M12', 'Android 13', 'AA:BB:CC:11:22:41', '192.168.1.53', true),
('T010', 'Vivo Y100', 'V2236', 'Android 13', 'AA:BB:CC:11:22:42', '192.168.1.54', true);

-- ============================================================
-- SEED DATA: Sample attendance for last 7 working days (Two Shifts)
-- ============================================================
DO $$
DECLARE
  t RECORD;
  d DATE;
  s TEXT;
  in_t TIMESTAMPTZ;
  out_t TIMESTAMPTZ;
  hrs NUMERIC;
  stat TEXT;
  late INT;
  early INT;
  rand_min INT;
BEGIN
  FOR t IN SELECT teacher_id, full_name, shift FROM teachers LOOP
    FOR i IN 1..7 LOOP
      d := CURRENT_DATE - i;
      IF EXTRACT(DOW FROM d) IN (0, 6) THEN CONTINUE; END IF;

      -- Iterate through shifts assigned to the teacher
      FOR s IN SELECT unnest(CASE 
        WHEN t.shift = 'Both' THEN ARRAY['Shift One', 'Shift Two']
        WHEN t.shift = 'Shift Two' THEN ARRAY['Shift Two']
        ELSE ARRAY['Shift One']
      END) LOOP
        
        IF s = 'Shift One' THEN
          -- Shift One: 07:15 - 12:30. Grace cutoff: 07:25
          rand_min := floor(random() * 25) - 5; -- -5 to +20 mins around 07:15
          in_t := (d || ' 07:15:00')::TIMESTAMPTZ + (rand_min || ' minutes')::INTERVAL;
          rand_min := floor(random() * 20) - 5;
          out_t := (d || ' 12:30:00')::TIMESTAMPTZ + (rand_min || ' minutes')::INTERVAL;
          hrs := EXTRACT(EPOCH FROM (out_t - in_t)) / 3600.0;

          IF in_t::TIME > '07:25:00'::TIME THEN
            stat := 'Late';
            late := EXTRACT(EPOCH FROM (in_t::TIME - '07:25:00'::TIME)) / 60;
          ELSE
            stat := 'Present';
            late := 0;
          END IF;

          IF out_t::TIME < '12:30:00'::TIME THEN
            early := EXTRACT(EPOCH FROM ('12:30:00'::TIME - out_t::TIME)) / 60;
          ELSE
            early := 0;
          END IF;

          IF hrs < 2.5 THEN stat := 'Half Day'; END IF;
        ELSE
          -- Shift Two: 12:30 - 17:00. Grace cutoff: 12:40
          rand_min := floor(random() * 25) - 5;
          in_t := (d || ' 12:30:00')::TIMESTAMPTZ + (rand_min || ' minutes')::INTERVAL;
          rand_min := floor(random() * 20) - 5;
          out_t := (d || ' 17:00:00')::TIMESTAMPTZ + (rand_min || ' minutes')::INTERVAL;
          hrs := EXTRACT(EPOCH FROM (out_t - in_t)) / 3600.0;

          IF in_t::TIME > '12:40:00'::TIME THEN
            stat := 'Late';
            late := EXTRACT(EPOCH FROM (in_t::TIME - '12:40:00'::TIME)) / 60;
          ELSE
            stat := 'Present';
            late := 0;
          END IF;

          IF out_t::TIME < '17:00:00'::TIME THEN
            early := EXTRACT(EPOCH FROM ('17:00:00'::TIME - out_t::TIME)) / 60;
          ELSE
            early := 0;
          END IF;

          IF hrs < 2.25 THEN stat := 'Half Day'; END IF;
        END IF;

        INSERT INTO attendance (teacher_id, date, shift, in_time, out_time, total_hours, status, late_by_minutes, early_out_by_minutes, mobile_name, mac_address, ip_address, ssid, mode)
        SELECT t.teacher_id, d, s, in_t, out_t, ROUND(hrs, 2), stat, late, early, dev.mobile_name, dev.mac_address, dev.ip_address, 'Woxsen_Campus_WiFi', 'Auto-WiFi'
        FROM devices dev WHERE dev.teacher_id = t.teacher_id
        ON CONFLICT (teacher_id, date, shift) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- TRIGGER: Auto-calculate total hours on attendance insert/update (Two Shifts)
-- ============================================================
CREATE OR REPLACE FUNCTION update_attendance_hours()
RETURNS TRIGGER AS $$
DECLARE
  v_shift_start TIME;
  v_shift_end TIME;
  v_grace INTEGER;
  v_cutoff TIME;
  v_half_day_hrs NUMERIC;
BEGIN
  IF NEW.in_time IS NOT NULL AND NEW.out_time IS NOT NULL THEN
    NEW.total_hours := ROUND(EXTRACT(EPOCH FROM (NEW.out_time - NEW.in_time)) / 3600.0, 2);
  END IF;

  SELECT 
    CASE WHEN NEW.shift = 'Shift Two' THEN shift_two_start ELSE shift_one_start END,
    CASE WHEN NEW.shift = 'Shift Two' THEN shift_two_end ELSE shift_one_end END,
    grace_minutes,
    CASE WHEN NEW.shift = 'Shift Two' THEN 2.25 ELSE 2.50 END
  INTO v_shift_start, v_shift_end, v_grace, v_half_day_hrs
  FROM wifi_settings
  LIMIT 1;

  IF v_shift_start IS NULL THEN
    IF NEW.shift = 'Shift Two' THEN
      v_shift_start := '12:30:00'::TIME;
      v_shift_end := '17:00:00'::TIME;
      v_half_day_hrs := 2.25;
    ELSE
      v_shift_start := '07:15:00'::TIME;
      v_shift_end := '12:30:00'::TIME;
      v_half_day_hrs := 2.50;
    END IF;
    v_grace := 10;
  END IF;

  v_cutoff := (v_shift_start + (v_grace || ' minutes')::INTERVAL)::TIME;

  IF NEW.in_time IS NOT NULL THEN
    IF NEW.in_time::TIME > v_cutoff THEN
      NEW.late_by_minutes := ROUND(EXTRACT(EPOCH FROM (NEW.in_time::TIME - v_cutoff)) / 60);
      IF NEW.status NOT IN ('On Leave', 'Holiday', 'WiFi Off - On Campus (GPS)', 'Incomplete / Needs Review') THEN
        NEW.status := 'Late';
      END IF;
    ELSE
      NEW.late_by_minutes := 0;
      IF NEW.status NOT IN ('On Leave', 'Holiday', 'WiFi Off - On Campus (GPS)', 'Incomplete / Needs Review') THEN
        NEW.status := 'Present';
      END IF;
    END IF;
  END IF;

  IF NEW.out_time IS NOT NULL THEN
    IF NEW.out_time::TIME < v_shift_end THEN
      NEW.early_out_by_minutes := ROUND(EXTRACT(EPOCH FROM (v_shift_end - NEW.out_time::TIME)) / 60);
    ELSE
      NEW.early_out_by_minutes := 0;
    END IF;

    IF NEW.total_hours IS NOT NULL AND NEW.total_hours < v_half_day_hrs AND NEW.status NOT IN ('On Leave', 'Holiday') THEN
      NEW.status := 'Half Day';
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_attendance_hours ON attendance;
CREATE TRIGGER trg_update_attendance_hours
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_hours();

-- ============================================================
-- Enable Realtime for attendance table
-- ============================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
