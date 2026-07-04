const UPSTREAM = 'https://postback.v1mobi.com/optimize';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, cut } = req.query;
  if (!id || cut === undefined || cut === '') {
    return res.status(400).json({ error: 'Missing id or cut query param' });
  }

  const target = `${UPSTREAM}?id=${encodeURIComponent(String(id))}&cut=${encodeURIComponent(String(cut))}`;

  try {
    const upstream = await fetch(target, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'text/plain;charset=UTF-8';
    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    return res.send(text);
  } catch (err) {
    return res.status(502).json({ error: 'Proxy error', message: err.message });
  }
}
