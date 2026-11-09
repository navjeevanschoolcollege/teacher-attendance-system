-- ============================================================
-- Migration 005: Teacher Campus Movement Tracker
-- Tracks every Entry (IN) and Exit (OUT) across campus
-- ============================================================

-- 1. Create movement_log table
CREATE TABLE IF NOT EXISTS movement_log (
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

-- Indexes for lightning fast timeline and live tracker queries
CREATE INDEX IF NOT EXISTS idx_movement_teacher_date ON movement_log(teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_movement_date ON movement_log(date);
CREATE INDEX IF NOT EXISTS idx_movement_time ON movement_log(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_movement_shift ON movement_log(shift);
CREATE INDEX IF NOT EXISTS idx_movement_event_type ON movement_log(event_type);

-- 2. Extend attendance table with tracker summary columns
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS total_entries INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_exits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_in_campus_hours NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_out_break_hours NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_presence_status TEXT DEFAULT 'Outside Campus' CHECK (current_presence_status IN ('Inside Campus', 'Outside Campus'));

-- 3. Function to automatically aggregate movement_log into attendance summary
CREATE OR REPLACE FUNCTION sync_attendance_from_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_teacher_id TEXT;
  v_date DATE;
  v_shift TEXT;
  v_first_in TIMESTAMPTZ;
  v_last_out TIMESTAMPTZ;
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

  -- Iterate through all events of this teacher on this day & shift in chronological order
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
      -- If there was a previous OUT, calculate break gap
      IF v_prev_out IS NOT NULL THEN
        v_total_break_mins := v_total_break_mins + GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_rec.event_time - v_prev_out)) / 60));
      END IF;
      v_prev_in := v_rec.event_time;
      v_last_event := 'IN';
    ELSIF v_rec.event_type = 'OUT' THEN
      v_exits := v_exits + 1;
      v_last_out := v_rec.event_time;
      -- Calculate stay duration for this session
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

  -- Determine Shift thresholds
  IF v_shift = 'Shift Two' THEN
    v_cutoff := '12:40:00'::TIME;
    v_shift_end := '17:00:00'::TIME;
    v_half_day_hrs := 2.25;
  ELSE
    v_cutoff := '07:25:00'::TIME;
    v_shift_end := '12:30:00'::TIME;
    v_half_day_hrs := 2.50;
  END IF;

  -- Determine Late By from First IN
  IF v_first_in IS NOT NULL THEN
    IF v_first_in::TIME > v_cutoff THEN
      v_late_mins := ROUND(EXTRACT(EPOCH FROM (v_first_in::TIME - v_cutoff)) / 60);
      v_status := 'Late';
    ELSE
      v_late_mins := 0;
      v_status := 'Present';
    END IF;
  END IF;

  -- Determine Early Out By from Last OUT
  IF v_last_out IS NOT NULL THEN
    IF v_last_out::TIME < v_shift_end THEN
      v_early_mins := ROUND(EXTRACT(EPOCH FROM (v_shift_end - v_last_out::TIME)) / 60);
    ELSE
      v_early_mins := 0;
    END IF;
    -- Half day if total in-campus hours is less than threshold
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

DROP TRIGGER IF EXISTS trg_sync_attendance_movement ON movement_log;
CREATE TRIGGER trg_sync_attendance_movement
  AFTER INSERT OR UPDATE ON movement_log
  FOR EACH ROW
  EXECUTE FUNCTION sync_attendance_from_movement();

-- 4. Enable RLS on movement_log
ALTER TABLE movement_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read movement_log" ON movement_log FOR SELECT USING (true);
CREATE POLICY "Allow insert movement_log" ON movement_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update movement_log" ON movement_log FOR UPDATE USING (is_admin() OR auth.role() = 'service_role');
CREATE POLICY "Allow delete movement_log" ON movement_log FOR DELETE USING (is_admin() OR auth.role() = 'service_role');

-- 5. Enable Realtime on movement_log
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE movement_log;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

