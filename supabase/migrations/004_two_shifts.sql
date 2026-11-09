-- ============================================================
-- Migration 004: Two Shifts System Implementation
-- Shift One: 07:15 AM to 12:30 PM (5h 15m)
-- Shift Two: 12:30 PM to 05:00 PM (4h 30m)
-- Grace Period: 10 minutes (configurable)
-- ============================================================

-- 1. Extend teachers table with shift column
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS shift TEXT DEFAULT 'Shift One' CHECK (shift IN ('Shift One', 'Shift Two', 'Both'));

-- Update existing teachers with diverse shifts
UPDATE teachers SET shift = 'Shift One' WHERE teacher_id IN ('T001', 'T004', 'T007');
UPDATE teachers SET shift = 'Shift Two' WHERE teacher_id IN ('T002', 'T005', 'T008');
UPDATE teachers SET shift = 'Both' WHERE teacher_id IN ('T003', 'T006', 'T009', 'T010');

-- 2. Extend attendance table with shift column & update unique constraint
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS shift TEXT NOT NULL DEFAULT 'Shift One' CHECK (shift IN ('Shift One', 'Shift Two'));

-- Replace UNIQUE(teacher_id, date) with UNIQUE(teacher_id, date, shift)
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_teacher_id_date_key;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_teacher_id_date_shift_key;
ALTER TABLE attendance ADD CONSTRAINT attendance_teacher_id_date_shift_key UNIQUE(teacher_id, date, shift);

-- 3. Extend wifi_settings with Shift One and Shift Two timings
ALTER TABLE wifi_settings
  ADD COLUMN IF NOT EXISTS shift_one_start TIME DEFAULT '07:15:00',
  ADD COLUMN IF NOT EXISTS shift_one_end TIME DEFAULT '12:30:00',
  ADD COLUMN IF NOT EXISTS shift_two_start TIME DEFAULT '12:30:00',
  ADD COLUMN IF NOT EXISTS shift_two_end TIME DEFAULT '17:00:00',
  ADD COLUMN IF NOT EXISTS grace_minutes INTEGER DEFAULT 10;

-- Set current settings row to use the new shift timings
UPDATE wifi_settings
SET 
  shift_one_start = '07:15:00',
  shift_one_end = '12:30:00',
  shift_two_start = '12:30:00',
  shift_two_end = '17:00:00',
  grace_minutes = 10
WHERE id IS NOT NULL;

-- 4. Create or replace trigger function for Two-Shift attendance calculation
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

  -- Load settings
  SELECT 
    CASE WHEN NEW.shift = 'Shift Two' THEN shift_two_start ELSE shift_one_start END,
    CASE WHEN NEW.shift = 'Shift Two' THEN shift_two_end ELSE shift_one_end END,
    grace_minutes,
    CASE WHEN NEW.shift = 'Shift Two' THEN 2.25 ELSE 2.50 END
  INTO v_shift_start, v_shift_end, v_grace, v_half_day_hrs
  FROM wifi_settings
  LIMIT 1;

  -- Fallbacks if null
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

  -- Check Late By
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

  -- Check Early Out By & Half Day
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

