import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, RefreshCw, ShieldCheck, Clock, Monitor } from 'lucide-react';

export default function StaffRoomQR() {
  const [qrData, setQrData] = useState({
    token: 'LOADING',
    expires_in_seconds: 120,
    valid_for_seconds: 120,
    current_time: '--:--:--'
  });
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [loading, setLoading] = useState(true);

  const fetchToken = async () => {
    try {
      const res = await fetch('/api/rotating-qr');
      if (res.ok) {
        const data = await res.json();
        setQrData(data);
        setSecondsLeft(data.expires_in_seconds || 120);
      }
    } catch (err) {
      console.error('Error fetching rotating QR:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToken();
    // Poll server every 10 seconds to stay tightly synced with epoch window
    const pollInterval = setInterval(fetchToken, 10000);
    return () => clearInterval(pollInterval);
  }, []);

  // Client-side 1-second countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          fetchToken();
          return 120;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const progressPercent = Math.max(0, Math.min(100, (secondsLeft / 120) * 100));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
            <Monitor className="w-4 h-4 text-emerald-400" />
            Staff Room Live Display Mode
          </span>
          <h2 className="text-2xl font-bold mt-1">Rotating Physical Presence QR Code</h2>
          <p className="text-xs text-blue-200/80 mt-1">
            Display this on a screen or tablet in the staff room. The token changes automatically every 2 minutes.
          </p>
        </div>

        <div className="text-right">
          <div className="text-xs text-blue-300">Server Time (IST)</div>
          <div className="text-xl font-mono font-bold">{qrData.current_time}</div>
        </div>
      </div>

      {/* Main QR Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-md text-center max-w-lg mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-6 border border-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Anti-Proxy Physical Presence Security
        </div>

        {/* QR Code Canvas */}
        <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-200/80 inline-block shadow-inner">
          <QRCodeSVG
            value={qrData.token}
            size={240}
            level="H"
            includeMargin={true}
          />
        </div>

        {/* Live Token Text */}
        <div className="mt-6">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Current Token</span>
          <div className="text-3xl font-mono font-extrabold tracking-widest text-slate-800 mt-1">
            {qrData.token}
          </div>
        </div>

        {/* Countdown Progress Bar */}
        <div className="mt-6 max-w-xs mx-auto">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1.5">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              Rotates in:
            </span>
            <span className="font-mono font-bold text-blue-600">{secondsLeft}s</span>
          </div>

          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-blue-600 transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
          <p className="font-semibold text-slate-700">How Teachers Use This:</p>
          Teachers open the mobile app and tap "Scan Staff Room QR". A photo of an old QR code taken earlier will fail validation automatically.
        </div>
      </div>
    </div>
  );
}

