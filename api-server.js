const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const routeName = pathname.replace(/^\/api\/?/, '').split('/')[0] || 'dashboard';
  const handlerFile = path.join(__dirname, 'api', `${routeName}.js`);

  if (!fs.existsSync(handlerFile)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: `API route not found: ${pathname}` }));
  }

  let body = {};
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const raw = Buffer.concat(buffers).toString();
    try {
      body = JSON.parse(raw);
    } catch (_) {
      body = {};
    }
  }

  req.query = parsedUrl.query || {};
  req.body = body;

  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function(data) {
    this.setHeader('Content-Type', 'application/json');
    this.end(JSON.stringify(data));
  };
  res.send = function(data) {
    this.end(data);
  };

  try {
    delete require.cache[require.resolve(handlerFile)];
    const handler = require(handlerFile);
    await handler(req, res);
  } catch (err) {
    console.error(`Error in ${routeName}:`, err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message }));
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`API Server running at http://localhost:${PORT}`);
});

