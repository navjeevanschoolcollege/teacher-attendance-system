-- ============================================================
-- Teacher Attendance System - Initial Database Schema
-- Supabase Migration: 001_initial_schema.sql
-- ============================================================

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
  shift_start TIME DEFAULT '09:00:00',
  shift_end TIME DEFAULT '16:00:00',
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
  mobile_name TEXT,
  mobile_model TEXT,
  os_version TEXT,
  mac_address TEXT UNIQUE,
  ip_address TEXT,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  is_approved BOOLEAN DEFAULT false,
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
  start_time TIME DEFAULT '09:00:00',
  grace_minutes INTEGER DEFAULT 10,
  end_time TIME DEFAULT '16:00:00',
  demo_mode BOOLEAN DEFAULT true,
  demo_ssid TEXT DEFAULT 'Test_Campus_WiFi',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ATTENDANCE table (one record per teacher per date)
-- ============================================================
CREATE TABLE attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id TEXT REFERENCES teachers(teacher_id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  in_time TIMESTAMPTZ,
  out_time TIMESTAMPTZ,
  total_hours NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'Absent' CHECK (status IN ('Present','Late','Absent','Half Day','On Leave','Holiday')),
  late_by_minutes INTEGER DEFAULT 0,
  early_out_by_minutes INTEGER DEFAULT 0,
  mobile_name TEXT,
  mac_address TEXT,
  ip_address TEXT,
  ssid TEXT,
  mode TEXT DEFAULT 'Auto-WiFi' CHECK (mode IN ('Auto-WiFi','Manual-Web','Admin')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, date)
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
-- RLS POLICIES: Teachers
-- ============================================================
-- Teachers: read own, admin reads all
CREATE POLICY "Teachers can view own profile" ON teachers FOR SELECT USING (
  email = auth.jwt()->>'email' OR 
  (auth.jwt()->>'email') IN (SELECT email FROM teachers WHERE role = 'admin')
);
CREATE POLICY "Admin can manage teachers" ON teachers FOR ALL USING (
  (auth.jwt()->>'email') IN (SELECT email FROM teachers WHERE role = 'admin')
);

-- ============================================================
-- RLS POLICIES: Attendance
-- ============================================================
-- Attendance: teachers read/insert own, admin manages all
CREATE POLICY "Teachers can view own attendance" ON attendance FOR SELECT USING (
  teacher_id IN (SELECT teacher_id FROM teachers WHERE email = auth.jwt()->>'email') OR
  (auth.jwt()->>'email') IN (SELECT email FROM teachers WHERE role = 'admin')
);
CREATE POLICY "Teachers can insert own attendance" ON attendance FOR INSERT WITH CHECK (
  teacher_id IN (SELECT teacher_id FROM teachers WHERE email = auth.jwt()->>'email')
);
CREATE POLICY "Admin can manage attendance" ON attendance FOR ALL USING (
  (auth.jwt()->>'email') IN (SELECT email FROM teachers WHERE role = 'admin')
);
CREATE POLICY "Service role full access attendance" ON attendance FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- RLS POLICIES: Devices
-- ============================================================
CREATE POLICY "Teachers can view own device" ON devices FOR SELECT USING (
  teacher_id IN (SELECT teacher_id FROM teachers WHERE email = auth.jwt()->>'email') OR
  (auth.jwt()->>'email') IN (SELECT email FROM teachers WHERE role = 'admin')
);
CREATE POLICY "Teachers can register device" ON devices FOR INSERT WITH CHECK (
  teacher_id IN (SELECT teacher_id FROM teachers WHERE email = auth.jwt()->>'email')
);
CREATE POLICY "Admin manages devices" ON devices FOR ALL USING (
  (auth.jwt()->>'email') IN (SELECT email FROM teachers WHERE role = 'admin')
);

-- ============================================================
-- RLS POLICIES: Leaves
-- ============================================================
CREATE POLICY "Teachers can view own leaves" ON leaves FOR SELECT USING (
  teacher_id IN (SELECT teacher_id FROM teachers WHERE email = auth.jwt()->>'email') OR
  (auth.jwt()->>'email') IN (SELECT email FROM teachers WHERE role = 'admin')
);
CREATE POLICY "Teachers can apply leaves" ON leaves FOR INSERT WITH CHECK (
  teacher_id IN (SELECT teacher_id FROM teachers WHERE email = auth.jwt()->>'email')
);
CREATE POLICY "Admin manages leaves" ON leaves FOR ALL USING (
  (auth.jwt()->>'email') IN (SELECT email FROM teachers WHERE role = 'admin')
);

-- ============================================================
-- RLS POLICIES: Holidays (everyone reads, admin manages)
-- ============================================================
CREATE POLICY "Everyone can view holidays" ON holidays FOR SELECT USING (true);
CREATE POLICY "Admin manages holidays" ON holidays FOR ALL USING (
  (auth.jwt()->>'email') IN (SELECT email FROM teachers WHERE role = 'admin')
);

-- ============================================================
-- RLS POLICIES: WiFi Settings (everyone reads, admin manages)
-- ============================================================
CREATE POLICY "Everyone can view wifi settings" ON wifi_settings FOR SELECT USING (true);
CREATE POLICY "Admin manages wifi settings" ON wifi_settings FOR ALL USING (
  (auth.jwt()->>'email') IN (SELECT email FROM teachers WHERE role = 'admin')
);

-- ============================================================
-- RLS POLICIES: Service role bypass for all tables
-- ============================================================
CREATE POLICY "Service role teachers" ON teachers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role devices" ON devices FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role leaves" ON leaves FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role holidays" ON holidays FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role wifi" ON wifi_settings FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- SEED DATA: WiFi Settings
-- ============================================================
INSERT INTO wifi_settings (campus_ssid, allowed_bssid_list, campus_ip_range, start_time, grace_minutes, end_time, demo_mode, demo_ssid)
VALUES ('Woxsen_Campus_WiFi', ARRAY['AA:BB:CC:DD:EE:01','AA:BB:CC:DD:EE:02'], '192.168.1.0/24', '09:00', 10, '16:00', true, 'Test_Campus_WiFi');

-- ============================================================
-- SEED DATA: 10 Teachers
-- ============================================================
INSERT INTO teachers (teacher_id, full_name, department, designation, subject, phone, email, role) VALUES
('T001', 'Muneeb Siddiqui', 'AI/ML', 'Assistant Professor', 'Python', '9876543210', 'muneeb@school.com', 'admin'),
('T002', 'Shriansh Singh', 'CSE', 'Associate Professor', 'Data Structures', '9876543211', 'shriansh@school.com', 'teacher'),
('T003', 'Abdul Raheem', 'ECE', 'Professor', 'Digital Electronics', '9876543212', 'abdul@school.com', 'teacher'),
('T004', 'Priya Sharma', 'Mathematics', 'Assistant Professor', 'Calculus', '9876543213', 'priya@school.com', 'teacher'),
('T005', 'Rajesh Kumar', 'Physics', 'Associate Professor', 'Quantum Mechanics', '9876543214', 'rajesh@school.com', 'teacher'),
('T006', 'Sneha Patel', 'Chemistry', 'Assistant Professor', 'Organic Chemistry', '9876543215', 'sneha@school.com', 'teacher'),
('T007', 'Vikram Reddy', 'CSE', 'Professor', 'Operating Systems', '9876543216', 'vikram@school.com', 'teacher'),
('T008', 'Fatima Khan', 'AI/ML', 'Associate Professor', 'Machine Learning', '9876543217', 'fatima@school.com', 'teacher'),
('T009', 'Arjun Nair', 'ECE', 'Assistant Professor', 'VLSI Design', '9876543218', 'arjun@school.com', 'teacher'),
('T010', 'Kavitha Iyer', 'Mathematics', 'Professor', 'Linear Algebra', '9876543219', 'kavitha@school.com', 'teacher');

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
-- SEED DATA: Sample attendance for last 7 working days
-- ============================================================
DO $$
DECLARE
  t RECORD;
  d DATE;
  in_t TIMESTAMPTZ;
  out_t TIMESTAMPTZ;
  hrs NUMERIC;
  stat TEXT;
  late INT;
  early INT;
  rand_min INT;
BEGIN
  FOR t IN SELECT teacher_id, full_name FROM teachers LOOP
    FOR i IN 1..7 LOOP
      d := CURRENT_DATE - i;
      -- Skip weekends
      IF EXTRACT(DOW FROM d) IN (0, 6) THEN CONTINUE; END IF;
      
      -- Random IN time between 8:45 and 9:20
      rand_min := floor(random() * 35) - 15; -- -15 to +20
      in_t := (d || ' 09:00:00')::TIMESTAMPTZ + (rand_min || ' minutes')::INTERVAL;
      
      -- Random OUT time between 3:50 and 4:30
      rand_min := floor(random() * 40) - 10;
      out_t := (d || ' 16:00:00')::TIMESTAMPTZ + (rand_min || ' minutes')::INTERVAL;
      
      hrs := EXTRACT(EPOCH FROM (out_t - in_t)) / 3600.0;
      
      -- Determine status
      IF in_t::TIME > '09:10:00' THEN
        stat := 'Late';
        late := EXTRACT(EPOCH FROM (in_t::TIME - '09:00:00'::TIME)) / 60;
      ELSE
        stat := 'Present';
        late := 0;
      END IF;
      
      IF out_t::TIME < '16:00:00' THEN
        early := EXTRACT(EPOCH FROM ('16:00:00'::TIME - out_t::TIME)) / 60;
      ELSE
        early := 0;
      END IF;
      
      IF hrs < 4 THEN stat := 'Half Day'; END IF;
      
      INSERT INTO attendance (teacher_id, date, in_time, out_time, total_hours, status, late_by_minutes, early_out_by_minutes, mobile_name, mac_address, ip_address, ssid, mode)
      SELECT t.teacher_id, d, in_t, out_t, ROUND(hrs, 2), stat, late, early, dev.mobile_name, dev.mac_address, dev.ip_address, 'Woxsen_Campus_WiFi', 'Auto-WiFi'
      FROM devices dev WHERE dev.teacher_id = t.teacher_id
      ON CONFLICT (teacher_id, date) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- TRIGGER: Auto-calculate total hours on attendance insert/update
-- ============================================================
CREATE OR REPLACE FUNCTION update_attendance_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.in_time IS NOT NULL AND NEW.out_time IS NOT NULL THEN
    NEW.total_hours := ROUND(EXTRACT(EPOCH FROM (NEW.out_time - NEW.in_time)) / 3600.0, 2);
    
    -- Update status based on rules
    IF NEW.in_time::TIME > (SELECT (start_time + (grace_minutes || ' minutes')::INTERVAL) FROM wifi_settings LIMIT 1) THEN
      NEW.late_by_minutes := EXTRACT(EPOCH FROM (NEW.in_time::TIME - (SELECT start_time FROM wifi_settings LIMIT 1))) / 60;
      IF NEW.status NOT IN ('On Leave', 'Holiday') THEN
        NEW.status := 'Late';
      END IF;
    END IF;
    
    IF NEW.out_time::TIME < (SELECT end_time FROM wifi_settings LIMIT 1) THEN
      NEW.early_out_by_minutes := EXTRACT(EPOCH FROM ((SELECT end_time FROM wifi_settings LIMIT 1) - NEW.out_time::TIME)) / 60;
    END IF;
    
    IF NEW.total_hours < 4 AND NEW.status NOT IN ('On Leave', 'Holiday') THEN
      NEW.status := 'Half Day';
    END IF;
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_attendance_hours
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_hours();

-- ============================================================
-- Enable Realtime for attendance table
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
