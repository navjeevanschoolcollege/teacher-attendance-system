import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeAttendance(selectedDate) {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('attendance')
        .select('*, teachers(full_name, department, designation, subject, phone, email)');

      if (selectedDate) {
        query = query.eq('date', selectedDate);
      }

      const { data, error: err } = await query.order('created_at', { ascending: false });
      if (err) throw err;
      setAttendance(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();

    // Subscribe to changes on attendance table in real-time
    const channel = supabase
      .channel('attendance_realtime_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        (_payload) => {
          // Re-fetch to get complete joined teacher information
          fetchAttendance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  return { attendance, loading, error, refresh: fetchAttendance };
}

