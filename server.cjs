const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Proxy /vaspay/* → wap.zeendcb.com (server-to-server, no CORS)
app.use(
  '/vaspay',
  createProxyMiddleware({
    target: 'https://wap.zeendcb.com',
    changeOrigin: true,
    secure: true,
    on: {
      error: (err, req, res) => {
        console.error('Proxy error:', err.message);
        res.status(502).json({ error: 'Proxy error', message: err.message });
      },
    },
  })
);

// Proxy /postbacks/* → postback.v1mobi.com (hourlyReport)
app.use(
  '/postbacks',
  createProxyMiddleware({
    target: 'https://postback.v1mobi.com',
    changeOrigin: true,
    secure: true,
    on: {
      error: (err, req, res) => {
        console.error('Postbacks proxy error:', err.message);
        res.status(502).json({ error: 'Proxy error', message: err.message });
      },
    },
  })
);

// Proxy /optimize/* → postback.v1mobi.com
app.use(
  '/optimize',
  createProxyMiddleware({
    target: 'https://postback.v1mobi.com',
    changeOrigin: true,
    secure: true,
  })
);

// Serve built React app
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
