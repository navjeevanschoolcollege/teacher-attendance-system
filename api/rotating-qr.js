const crypto = require('crypto');
const { supabase } = require('./lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { data: settings } = await supabase
      .from('wifi_settings')
      .select('qr_secret, campus_ssid')
      .limit(1)
      .single();

    const secret = settings?.qr_secret || 'CAMPUS_STAFFROOM_QR_KEY_2026';
    const nowMs = Date.now();
    const windowIntervalMs = 120000; // 2 minutes

    const currentWindow = Math.floor(nowMs / windowIntervalMs);
    const msIntoCurrentWindow = nowMs % windowIntervalMs;
    const expiresInSeconds = Math.max(1, Math.ceil((windowIntervalMs - msIntoCurrentWindow) / 1000));

    const token = crypto
      .createHmac('sha256', secret)
      .update(String(currentWindow))
      .digest('hex')
      .substring(0, 8)
      .toUpperCase();

    const timeStr = new Date(nowMs).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    return res.status(200).json({
      success: true,
      token,
      expires_in_seconds: expiresInSeconds,
      valid_for_seconds: 120,
      current_time: timeStr,
      instructions: 'Scan this rotating QR code in the Staff Room to verify physical campus presence.'
    });

  } catch (err) {
    console.error('rotating-qr error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

