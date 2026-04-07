# 🎵 Groove — Local Network Spotify Controller

Control Spotify from any device on your Wi-Fi network.

---

## Setup (5 minutes)

### 1. Create a Spotify Developer App

1. Go to https://developer.spotify.com/dashboard
2. Log in → **Create app**
3. Fill in:
   - App name: `Groove Controller` (anything works)
   - App description: anything
   - Redirect URI: `http://localhost:8888/callback`  ← exact match required
4. Click **Save**
5. Copy your **Client ID** and **Client Secret**

---

### 2. Generate a Self-Signed SSL Certificate

Spotify requires `https://` for the redirect. Run this once inside the project folder:

```bash
cd spotify-controller
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"
```

This creates `key.pem` and `cert.pem` — the server won't start without them.

> **Browser warning:** Since it's self-signed, your browser will show a security warning. Click **Advanced → Proceed to localhost** (or similar). This is normal and safe for local use.

---

### 3. Install Dependencies

Make sure you have [Node.js](https://nodejs.org) installed (v16+), then:

```bash
cd spotify-controller
npm install
```

---

### 4. Run the Server

**Option A — Environment variables (recommended):**
```bash
SPOTIFY_CLIENT_ID=your_client_id \
SPOTIFY_CLIENT_SECRET=your_client_secret \
node server.js
```

**Option B — Edit server.js directly:**
Open `server.js` and replace these lines near the top:
```js
const CLIENT_ID     = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
```

---

### 5. Connect Spotify (once)

1. Open **https://localhost:8888** in your browser
2. Click through the self-signed cert warning (Advanced → Proceed)
3. Click **Connect Spotify** and log in
4. You'll be redirected back — you're now authenticated!

---

### 6. Share with Others

When the server starts, it prints your local IP:

```
🎵  Spotify Controller running!
   Local:   https://localhost:8888
   Network: https://192.168.1.42:8888  ← share this
```

Anyone on the same Wi-Fi visits that URL. They'll also need to click through the cert warning once.

---

## Features

| Feature | Details |
|---|---|
| ▶ Play / Pause / Skip | Full transport controls |
| 🔀 Shuffle & Repeat | Toggle all modes |
| 🔊 Volume | Smooth slider |
| ⏩ Seek | Click anywhere on the progress bar |
| 🔍 Search | Search tracks, artists, albums |
| ➕ Queue | Add tracks & view upcoming |
| 🎤 Lyrics | Auto-fetches lyrics for playing track |
| 📱 Devices | Switch playback between Spotify devices |

---

## Requirements

- **Spotify Premium** — required by Spotify's playback API
- **Node.js v16+**
- All devices must be on the **same Wi-Fi network**

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "No active device" | Open Spotify on your Mac and start playing something first |
| Auth error | Make sure the redirect URI in your Spotify app matches exactly: `http://localhost:8888/callback` |
| Others can't connect | Check macOS Firewall: System Preferences → Security → Firewall → allow incoming connections for Node |
| Lyrics not found | Some tracks don't have lyrics in the free database — this is normal |
