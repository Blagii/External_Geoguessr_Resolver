# 🖥️ GeoGuessr Overlay — Always-On-Top Location HUD

A small **transparent, always-on-top window** that floats above GeoGuessr and shows you the exact
country / city / road and a live map of the current round — **without switching tabs and without a
second monitor**.

It works for both **GeoGuessr Steam Edition** and **GeoGuessr in a browser**, because it connects to
the same GeoResolver server as the Android app and the web dashboard.

> The overlay is **for your own screen**. It is not an OBS source and it does not appear in a stream.

---

## ✨ What You Get

| Feature | Description |
| :--- | :--- |
| **Country banner** | Flag emoji + country name in large neon text, with `City • State • Road` underneath. |
| **Live map** | Leaflet map centred on the round, with the same bullseye pin as the dashboard. |
| **4 map layers** | Clean HD, Streets (OSM), Satellite, Dark. |
| **Quick zoom** | One-tap presets: Country (`z6`), Region (`z11`), Street (`z16`), Max detail (`z19`). |
| **Detail strip** | City, State, Road and live coordinates at the bottom. |
| **Round badge** | Shows the current round number (`R4`) so you know a new round loaded. |
| **Copy coordinates** | One click copies the exact lat/lng to your clipboard. |
| **Compact mode** | Collapses to a tiny `🇷🇸 SERBIA │ Belgrade` chip — barely covers the game. |
| **Click-through mode** | The window becomes fully transparent to mouse clicks, so it never interferes with the game. |
| **Always on top** | Stays above the game even when GeoGuessr is fullscreen. |
| **Auto-reconnect** | Reconnects automatically if the server or network drops. |

The map engine (**Leaflet 1.9.4**) is bundled in [`vendor/leaflet/`](vendor/leaflet/) rather than
loaded from a CDN, so the map keeps working offline and cannot break if a CDN is unreachable. Only
the map **tiles** require an internet connection.

---

## 📦 Installation (Windows)

### Step 1 — First-time setup (run once)
1. Install **Node.js 18+** from [nodejs.org](https://nodejs.org/) if you don't have it.
2. Double-click **`1_INSTALL_FIRST_TIME.bat`**.
   It installs the Electron runtime (one-time download, ~100 MB).

### Step 2 — Start the overlay
Double-click **`2_START_OVERLAY.bat`**.

A small panel appears in the top-right corner of your screen, floating above everything.

> The launcher runs `npm start` (i.e. `electron .`), so Node resolves Electron's own install
> location for you. If you ever need to start it manually:
> ```bash
> cd overlay
> npm start
> ```

### Step 3 — Make sure rounds are being sent
The overlay displays whatever the GeoResolver server receives, so you also need **one** of:

* **Steam Edition** → run [`Steam_Resolver/2_START_STEAM_RESOLVER.bat`](../Steam_Resolver/2_START_STEAM_RESOLVER.bat), or
* **Browser** → install the [Tampermonkey userscript](../Extension/Extension.js).

Both use the default User ID `11111111-1111-4111-8111-111111111111`, which is already pre-filled in the overlay.

---

## ⌨️ Hotkeys

| Hotkey | Action |
| :--- | :--- |
| `Ctrl` + `Alt` + `O` | Show / hide the overlay |
| `Ctrl` + `Alt` + `C` | Toggle compact view |
| `Ctrl` + `Alt` + `D` | Toggle click-through mode |
| `Ctrl` + `Alt` + `S` | Open settings |

> If a hotkey does not respond, another app is probably using it — pick a different combo in your
> `Electron → src/main.js` (`registerShortcuts`) if needed.

You can also **drag the overlay** by its header to any position, and the position is remembered.

---

## ⚙️ Settings

Click the **⚙** button (or `Ctrl`+`Alt`+`S`). You can change:

* **User ID Token** — must match your resolver's ID.
* **Server** — the public server by default, or your local one (e.g. `192.168.1.15:8000`).
* **Position** — top/bottom × left/right corner.
* **Opacity** — 40–100%, so you can dial it back if it covers too much.
* **Size** — 60–160% of the base panel.
* **Map layer** — Clean HD / Streets / Satellite / Dark.

There is also a **tray icon** (green dot in the system tray) with quick toggles and **Quit**.

---

## 🐍 Running the tests

```bash
npm install                  # deps (Electron + Leaflet)

# Unit tests — URL parsing, flag emoji, round detection, DOM wiring
node test/renderer.test.js

# Tray icon tests — validates assets/tray-icon.png is a real PNG
node test/tray.test.js

# Map tests — Leaflet loads locally and builds a real map (needs jsdom)
npm install --no-save jsdom && node test/map.test.js

# End-to-end tests — needs Server/server.py listening on :8000
cd ../Server && python server.py     # in one terminal
node test/e2e.test.js                # in another
```

---

## 💡 Tips

* **Don't want it in the way?** Use **compact mode** (`Ctrl`+`Alt`+`C`) or **click-through mode**
  (`Ctrl`+`Alt`+`D`) — the overlay becomes invisible to clicks.
* **Fullscreen GeoGuessr?** The overlay stays on top automatically.
* **Behind a proxy / school network?** Use your local server (see the main
  [README](../README.md#part-4--optional--running-the-web-dashboard-frontend--or-local-server-server)).

---

## 🛠️ Troubleshooting

| Issue | Solution |
| :--- | :--- |
| Overlay shows "Connecting…" forever | The resolver isn't sending rounds yet. Start the Steam Resolver or the browser userscript. |
| Overlay shows "Disconnected" | Wrong server address, or no internet. Check the server in Settings. |
| Overlay is behind the game | Press `Ctrl`+`Alt`+`O` to re-show it; the window is set to stay on top of fullscreen games. |
| Map is blank / grey tiles | The map engine is bundled locally, so a blank grey box means it failed to load — re-run `1_INSTALL_FIRST_TIME.bat`. Map **tiles** come from the internet, so if the engine works but tiles are missing, your network/DNS is blocking the tile hosts; the text (country/city/road) still works. |
| Hotkeys do nothing | Another app may have claimed the combo. Close the overlay (tray → Quit) and start it again to re-register. |
| `1_INSTALL_FIRST_TIME.bat` cannot download Electron | That step pulls ~100 MB from GitHub releases. Check your connection, and if you are behind a firewall/proxy allow `github.com` and `objects.githubusercontent.com`, then run the `.bat` again — it repairs and retries automatically. |
| `npm warn install-scripts ... electron (postinstall)` | npm 12+ blocks dependency install scripts by default, which skips Electron's binary download. The project already lists `"allowScripts": { "electron": true }` in `package.json`, and `setup.js` runs Electron's installer directly as a fallback — handled automatically. If you still see it, re-run `1_INSTALL_FIRST_TIME.bat`. |