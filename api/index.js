const url = require('url');

const handlers = {
  'attendance': require('./handlers/attendance'),
  'checkin': require('./handlers/checkin'),
  'checkout': require('./handlers/checkout'),
  'corrections': require('./handlers/corrections'),
  'dashboard': require('./handlers/dashboard'),
  'devices': require('./handlers/devices'),
  'export-excel': require('./handlers/export-excel'),
  'holidays': require('./handlers/holidays'),
  'leaves': require('./handlers/leaves'),
  'mobile-sync': require('./handlers/mobile-sync'),
  'rotating-qr': require('./handlers/rotating-qr'),
  'teachers': require('./handlers/teachers'),
  'tracker': require('./handlers/tracker'),
  'wifi-heartbeat': require('./handlers/wifi-heartbeat'),
  'wifi-settings': require('./handlers/wifi-settings')
};

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  // Parse URL & route
  const parsedUrl = url.parse(req.url, true);
  const routeName = parsedUrl.pathname.replace(/^\/api\/?/, '').split('/')[0] || 'dashboard';

  // Ensure query params are populated on req.query
  req.query = { ...parsedUrl.query, ...(req.query || {}) };

  // Parse body if not already parsed (for Vercel serverless / raw node)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && (!req.body || Object.keys(req.body).length === 0)) {
    try {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      if (buffers.length > 0) {
        const raw = Buffer.concat(buffers).toString();
        if (raw.trim()) {
          req.body = JSON.parse(raw);
        }
      }
    } catch (_) {
      // Body may already be read or not JSON
    }
  }

  const targetHandler = handlers[routeName];

  if (!targetHandler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: `API route /api/${routeName} not found` }));
  }

  try {
    return await targetHandler(req, res);
  } catch (err) {
    console.error(`Error in /api/${routeName}:`, err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
    }
  }
};

