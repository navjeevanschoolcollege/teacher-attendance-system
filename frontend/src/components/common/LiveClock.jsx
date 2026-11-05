import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';

function LiveClock({ showDate = true, showIcon = true, className = '' }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });

  const dateStr = format(now, 'EEEE, dd MMMM yyyy');

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showIcon && <Clock className="w-4 h-4 text-gray-400" />}
      <div className="text-sm">
        <span className="font-semibold text-gray-700">{timeStr}</span>
        {showDate && (
          <span className="text-gray-400 ml-2 hidden sm:inline">| {dateStr}</span>
        )}
      </div>
    </div>
  );
}

export default LiveClock;
