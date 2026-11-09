-- ============================================================
-- Migration 003: WiFi Problems Handling, Anti-Cheat & Corrections
-- ============================================================

-- 1. Extend wifi_settings with GPS Geofence & QR Secret
ALTER TABLE wifi_settings 
  ADD COLUMN IF NOT EXISTS campus_lat DOUBLE PRECISION DEFAULT 17.5449,
  ADD COLUMN IF NOT EXISTS campus_lng DOUBLE PRECISION DEFAULT 78.5718,
  ADD COLUMN IF NOT EXISTS geofence_radius_meters INTEGER DEFAULT 200,
  ADD COLUMN IF NOT EXISTS qr_secret TEXT DEFAULT 'CAMPUS_STAFFROOM_QR_KEY_2026';

-- 2. Update attendance table status CHECK constraint to allow new WiFi & GPS statuses
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check 
  CHECK (status IN (
    'Present',
    'Late',
    'Absent',
    'Half Day',
    'On Leave',
    'Holiday',
    'WiFi Off - On Campus (GPS)',
    'Incomplete / Needs Review'
  ));

-- Add GPS, Device UUID, Mock Location, and Anti-Cheat flags to attendance
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS gps_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS gps_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS device_uuid TEXT,
  ADD COLUMN IF NOT EXISTS is_mock_location BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS flagged_suspicious BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspicious_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_wifi_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qr_verified_at TIMESTAMPTZ;

-- 3. Extend devices table for Device ID & Anti-Proxy rules
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS device_uuid TEXT,
  ADD COLUMN IF NOT EXISTS is_mock_detected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Create attendance_corrections table (Teacher dispute / correction workflow)
CREATE TABLE IF NOT EXISTS attendance_corrections (
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

-- 5. Create attendance_audit_logs table (Immutable audit trail)
CREATE TABLE IF NOT EXISTS attendance_audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  attendance_id UUID REFERENCES attendance(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL,
  date DATE NOT NULL,
  old_values JSONB,
  new_values JSONB,
  action TEXT NOT NULL, -- e.g. 'Correction Approved', 'Manual Override', 'Admin Edit'
  changed_by TEXT NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_corrections_teacher ON attendance_corrections(teacher_id);
CREATE INDEX IF NOT EXISTS idx_corrections_status ON attendance_corrections(status);
CREATE INDEX IF NOT EXISTS idx_audit_attendance ON attendance_audit_logs(attendance_id);
CREATE INDEX IF NOT EXISTS idx_audit_teacher ON attendance_audit_logs(teacher_id);

-- Enable RLS on new tables
ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_audit_logs ENABLE ROW LEVEL SECURITY;

-- Non-recursive RLS policies for attendance_corrections
CREATE POLICY "Allow read corrections" ON attendance_corrections FOR SELECT USING (true);
CREATE POLICY "Allow insert corrections" ON attendance_corrections FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update corrections" ON attendance_corrections FOR UPDATE USING (is_admin() OR auth.role() = 'service_role');
CREATE POLICY "Allow delete corrections" ON attendance_corrections FOR DELETE USING (is_admin() OR auth.role() = 'service_role');

-- Non-recursive RLS policies for attendance_audit_logs
CREATE POLICY "Allow read audit_logs" ON attendance_audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow insert audit_logs" ON attendance_audit_logs FOR INSERT WITH CHECK (true);

