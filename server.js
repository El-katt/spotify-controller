const express = require('express');
const http    = require('http');
const axios   = require('axios');
const path    = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const CLIENT_ID     = process.env.SPOTIFY_CLIENT_ID     || 'YOUR_CLIENT_ID';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const REDIRECT_URI  = process.env.REDIRECT_URI          || 'http://127.0.0.1:8888/callback';
const PORT          = process.env.PORT                  || 8888;

// ─── TOKEN STORE (in-memory, single host auth) ───────────────────────────────
let tokenStore = {
  access_token:  null,
  refresh_token: null,
  expires_at:    0,
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function spotifyAuthHeader() {
  return 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
}

async function ensureFreshToken() {
  if (!tokenStore.refresh_token) throw new Error('NOT_AUTHED');
  if (Date.now() < tokenStore.expires_at - 30_000) return tokenStore.access_token;

  const res = await axios.post('https://accounts.spotify.com/api/token',
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokenStore.refresh_token }),
    { headers: { Authorization: spotifyAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  tokenStore.access_token = res.data.access_token;
  tokenStore.expires_at   = Date.now() + res.data.expires_in * 1000;
  if (res.data.refresh_token) tokenStore.refresh_token = res.data.refresh_token;
  return tokenStore.access_token;
}

async function spotify(method, endpoint, data = null, params = null) {
  const token = await ensureFreshToken();
  const cfg = {
    method,
    url: `https://api.spotify.com/v1${endpoint}`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (data)   cfg.data   = data;
  if (params) cfg.params = params;
  return axios(cfg);
}

// ─── AUTH ROUTES ─────────────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'playlist-read-private',
    'user-library-read',
    'user-top-read',
  ].join(' ');

  const url = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    scope:         scopes,
    redirect_uri:  REDIRECT_URI,
  });
  res.redirect(url);
});

app.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect('/?error=access_denied');

  try {
    const r = await axios.post('https://accounts.spotify.com/api/token',
      new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }),
      { headers: { Authorization: spotifyAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    tokenStore.access_token  = r.data.access_token;
    tokenStore.refresh_token = r.data.refresh_token;
    tokenStore.expires_at    = Date.now() + r.data.expires_in * 1000;
    res.redirect('/');
  } catch (e) {
    console.error('OAuth error', e.response?.data || e.message);
    res.redirect('/?error=token_failed');
  }
});

app.get('/auth/status', (req, res) => {
  res.json({ authed: !!tokenStore.access_token });
});

// ─── PLAYBACK ROUTES ─────────────────────────────────────────────────────────
app.get('/api/current', async (req, res) => {
  try {
    const r = await spotify('get', '/me/player');
    if (r.status === 204) return res.json({ playing: false });
    res.json(r.data);
  } catch (e) {
    if (e.message === 'NOT_AUTHED') return res.status(401).json({ error: 'not_authed' });
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.put('/api/play', async (req, res) => {
  try {
    const body = req.body || {};
    await spotify('put', '/me/player/play', Object.keys(body).length ? body : undefined);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.put('/api/pause', async (req, res) => {
  try {
    await spotify('put', '/me/player/pause');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.post('/api/next', async (req, res) => {
  try {
    await spotify('post', '/me/player/next');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.post('/api/previous', async (req, res) => {
  try {
    await spotify('post', '/me/player/previous');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.put('/api/volume', async (req, res) => {
  try {
    await spotify('put', '/me/player/volume', null, { volume_percent: req.body.volume });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.put('/api/seek', async (req, res) => {
  try {
    await spotify('put', '/me/player/seek', null, { position_ms: req.body.position_ms });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.put('/api/shuffle', async (req, res) => {
  try {
    await spotify('put', '/me/player/shuffle', null, { state: req.body.state });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.put('/api/repeat', async (req, res) => {
  try {
    await spotify('put', '/me/player/repeat', null, { state: req.body.state });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

// ─── QUEUE ───────────────────────────────────────────────────────────────────
app.get('/api/queue', async (req, res) => {
  try {
    const r = await spotify('get', '/me/player/queue');
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.post('/api/queue', async (req, res) => {
  try {
    await spotify('post', '/me/player/queue', null, { uri: req.body.uri });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

// ─── SEARCH ──────────────────────────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  try {
    const r = await spotify('get', '/search', null, {
      q: req.query.q,
      type: 'track,artist,album',
      limit: 10,
    });
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

// ─── LYRICS (via lyrics.ovh — free, no key needed) ──────────────────────────
app.get('/api/lyrics', async (req, res) => {
  try {
    const { artist, title } = req.query;
    const r = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
    res.json({ lyrics: r.data.lyrics });
  } catch (e) {
    res.json({ lyrics: null });
  }
});

// ─── DEVICES ─────────────────────────────────────────────────────────────────
app.get('/api/devices', async (req, res) => {
  try {
    const r = await spotify('get', '/me/player/devices');
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.put('/api/devices/transfer', async (req, res) => {
  try {
    await spotify('put', '/me/player', { device_ids: [req.body.device_id], play: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

// ─── START ───────────────────────────────────────────────────────────────────
http.createServer(app).listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  let localIP = 'localhost';
  for (const iface of Object.values(ifaces)) {
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) { localIP = alias.address; break; }
    }
  }
  console.log(`\n🎵  Spotify Controller running!`);
  console.log(`   Auth:    http://127.0.0.1:${PORT}/login  ← open this FIRST to connect Spotify`);
  console.log(`   Network: http://${localIP}:${PORT}  ← share this with others\n`);
});
