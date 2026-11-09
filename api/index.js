const url = require('url');

const handlers = {
  'attendance': require('../server/handlers/attendance'),
  'checkin': require('../server/handlers/checkin'),
  'checkout': require('../server/handlers/checkout'),
  'corrections': require('../server/handlers/corrections'),
  'dashboard': require('../server/handlers/dashboard'),
  'devices': require('../server/handlers/devices'),
  'export-excel': require('../server/handlers/export-excel'),
  'holidays': require('../server/handlers/holidays'),
  'leaves': require('../server/handlers/leaves'),
  'mobile-sync': require('../server/handlers/mobile-sync'),
  'rotating-qr': require('../server/handlers/rotating-qr'),
  'teachers': require('../server/handlers/teachers'),
  'tracker': require('../server/handlers/tracker'),
  'wifi-heartbeat': require('../server/handlers/wifi-heartbeat'),
  'wifi-settings': require('../server/handlers/wifi-settings')
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

  // Parse body if not already parsed
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
