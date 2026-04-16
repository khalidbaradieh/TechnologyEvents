// api/anthropic.js
// Vercel Serverless Function — proxies requests to Anthropic API
// Solves CORS: browser cannot call api.anthropic.com directly

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get API key from the request header (sent by admin.html)
  const apiKey = req.headers['x-api-key'] || '';
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return res.status(401).json({ error: 'Valid Anthropic API key required' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': req.headers['anthropic-version'] || '2023-06-01',
        'anthropic-beta':    req.headers['anthropic-beta']    || '',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    // Forward the exact same status and body back to the browser
    res.status(response.status).json(data);

  } catch (err) {
    console.error('Anthropic proxy error:', err);
    res.status(500).json({ error: 'Proxy error: ' + err.message });
  }
}
