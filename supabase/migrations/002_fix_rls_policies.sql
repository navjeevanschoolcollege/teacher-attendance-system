-- ============================================================
-- Fix RLS Infinite Recursion & Optimize Policies
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create SECURITY DEFINER helper functions to prevent recursion
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

-- 2. Drop existing problematic recursive policies
DROP POLICY IF EXISTS "Teachers can view own profile" ON teachers;
DROP POLICY IF EXISTS "Admin can manage teachers" ON teachers;
DROP POLICY IF EXISTS "Service role teachers" ON teachers;

DROP POLICY IF EXISTS "Teachers can view own attendance" ON attendance;
DROP POLICY IF EXISTS "Teachers can insert own attendance" ON attendance;
DROP POLICY IF EXISTS "Admin can manage attendance" ON attendance;
DROP POLICY IF EXISTS "Service role full access attendance" ON attendance;

DROP POLICY IF EXISTS "Teachers can view own device" ON devices;
DROP POLICY IF EXISTS "Teachers can register device" ON devices;
DROP POLICY IF EXISTS "Admin manages devices" ON devices;
DROP POLICY IF EXISTS "Service role devices" ON devices;

DROP POLICY IF EXISTS "Teachers can view own leaves" ON leaves;
DROP POLICY IF EXISTS "Teachers can apply leaves" ON leaves;
DROP POLICY IF EXISTS "Admin manages leaves" ON leaves;
DROP POLICY IF EXISTS "Service role leaves" ON leaves;

DROP POLICY IF EXISTS "Everyone can view holidays" ON holidays;
DROP POLICY IF EXISTS "Admin manages holidays" ON holidays;
DROP POLICY IF EXISTS "Service role holidays" ON holidays;

DROP POLICY IF EXISTS "Everyone can view wifi settings" ON wifi_settings;
DROP POLICY IF EXISTS "Admin manages wifi settings" ON wifi_settings;
DROP POLICY IF EXISTS "Service role wifi" ON wifi_settings;

-- 3. Re-create clean, non-recursive policies

-- TEACHERS
CREATE POLICY "Allow select teachers" ON teachers FOR SELECT USING (true);
CREATE POLICY "Allow admin manage teachers" ON teachers FOR ALL USING (is_admin() OR auth.role() = 'service_role');

-- ATTENDANCE
CREATE POLICY "Allow select attendance" ON attendance FOR SELECT USING (true);
CREATE POLICY "Allow insert attendance" ON attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update attendance" ON attendance FOR UPDATE USING (true);
CREATE POLICY "Allow delete attendance" ON attendance FOR DELETE USING (is_admin() OR auth.role() = 'service_role');

-- DEVICES
CREATE POLICY "Allow select devices" ON devices FOR SELECT USING (true);
CREATE POLICY "Allow insert devices" ON devices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update devices" ON devices FOR UPDATE USING (true);
CREATE POLICY "Allow delete devices" ON devices FOR DELETE USING (is_admin() OR auth.role() = 'service_role');

-- LEAVES
CREATE POLICY "Allow select leaves" ON leaves FOR SELECT USING (true);
CREATE POLICY "Allow insert leaves" ON leaves FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update leaves" ON leaves FOR UPDATE USING (is_admin() OR auth.role() = 'service_role');
CREATE POLICY "Allow delete leaves" ON leaves FOR DELETE USING (is_admin() OR auth.role() = 'service_role');

-- HOLIDAYS
CREATE POLICY "Allow select holidays" ON holidays FOR SELECT USING (true);
CREATE POLICY "Allow admin manage holidays" ON holidays FOR ALL USING (is_admin() OR auth.role() = 'service_role');

-- WIFI SETTINGS
CREATE POLICY "Allow select wifi_settings" ON wifi_settings FOR SELECT USING (true);
CREATE POLICY "Allow admin manage wifi_settings" ON wifi_settings FOR ALL USING (is_admin() OR auth.role() = 'service_role');
