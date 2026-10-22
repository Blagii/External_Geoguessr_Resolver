/* ── GeoGuessr Overlay — Electron main process ───────────────────
 * Creates a small, transparent, always-on-top window that floats above
 * GeoGuessr (Steam Edition or browser) so you can read the round's
 * location without switching tabs or using a second monitor.
 * ------------------------------------------------------------- */

const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require("electron")
const path = require("node:path")
const fs = require("node:fs")

const MARGIN = 16
const DEFAULTS = {
  token: "11111111-1111-4111-8111-111111111111",
  server: "wss://georesolver.0x978.com/ws",
  styleIndex: 0,
  opacity: 0.92,
  scale: 1,
  position: "top-right",
  compact: false,
}

let overlay = null
let trayInstance = null
let clickThrough = false
let store = { ...DEFAULTS }

/* ── Settings persisted next to the app ───────────────────────── */

const storePath = path.join(app.getPath("userData"), "overlay-settings.json")

function loadStore() {
  try {
    if (fs.existsSync(storePath)) {
      store = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(storePath, "utf8")) }
    }
  } catch {
    store = { ...DEFAULTS }
  }
}

function saveStore() {
  try {
    fs.mkdirSync(path.dirname(storePath), { recursive: true })
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8")
  } catch (err) {
    console.error("[overlay] failed to save settings:", err.message)
  }
}

/* ── Geometry ─────────────────────────────────────────────────── */

/** Base window size at scale 1.0 — must match the CSS in styles.css. */
const BASE_W = 430
const BASE_H = 340
const BASE_COMPACT_H = 30

function windowSize() {
  const w = Math.round(BASE_W * store.scale)
  const h = Math.round(
    (store.compact ? BASE_COMPACT_H : BASE_H) * store.scale
  )
  return { width: w, height: h }
}

function anchorPoint() {
  const { width, height } = windowSize()
  const display = screen.getPrimaryDisplay().workArea

  switch (store.position) {
    case "top-left":
      return { x: display.x + MARGIN, y: display.y + MARGIN }
    case "bottom-left":
      return {
        x: display.x + MARGIN,
        y: display.y + display.height - height - MARGIN,
      }
    case "bottom-right":
      return {
        x: display.x + display.width - width - MARGIN,
        y: display.y + display.height - height - MARGIN,
      }
    case "top-right":
    default:
      return {
        x: display.x + display.width - width - MARGIN,
        y: display.y + MARGIN,
      }
  }
}

function applyBounds() {
  if (!overlay || overlay.isDestroyed()) return
  const { width, height } = windowSize()
  const { x, y } = anchorPoint()
  overlay.setBounds({ x, y, width, height }, false)
}

/* ── Click-through ────────────────────────────────────────────── */

function setClickThrough(enabled) {
  clickThrough = enabled
  if (!overlay || overlay.isDestroyed()) return
  // ignoreMouseEvents must be re-applied after every bounds change.
  overlay.setIgnoreMouseEvents(enabled, { forward: true })
  overlay.webContents.send("overlay:clickthrough", enabled)
  sendSettings()
}

/* ── Renderer sync ────────────────────────────────────────────── */

function sendSettings() {
  if (!overlay || overlay.isDestroyed()) return
  overlay.webContents.send("overlay:settings", { ...store, clickThrough })
}

/* ── Window creation ──────────────────────────────────────────── */

function createOverlay() {
  const { width, height } = windowSize()
  const { x, y } = anchorPoint()

  overlay = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    // Keep above fullscreen games as well as normal windows.
    visibleOnAllWorkspaces: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // "screen-saver" keeps us above fullscreen games (Steam Edition goes
  // fullscreen, and a normal always-on-top window drops behind it).
  overlay.setAlwaysOnTop(true, "screen-saver")
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlay.loadFile(path.join(__dirname, "index.html"))

  if (clickThrough) overlay.setIgnoreMouseEvents(true, { forward: true })

  overlay.on("closed", () => {
    overlay = null
  })

  // Never let the overlay steal focus while playing.
  overlay.on("blur", () => {
    /* intentionally ignored */
  })
}

/* ── Tray icon ────────────────────────────────────────────────── */

function createTray() {
  let Tray, Menu, nativeImage
  try {
    ;({ Tray, Menu, nativeImage } = require("electron"))
  } catch {
    return
  }

  // Tray needs a real image (NativeImage or file path) — SVG text in a
  // Buffer is rejected with "Argument must be a file path or a NativeImage".
  const iconPath = path.join(__dirname, "..", "assets", "tray-icon.png")
  let icon
  try {
    if (fs.existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath)
    }
    if (!icon || icon.isEmpty()) {
      // Fall back to an empty image so the tray still works without the asset.
      icon = nativeImage.createEmpty()
    }
  } catch {
    return
  }

  let tray
  try {
    tray = new Tray(icon)
    tray.setToolTip("GeoGuessr Overlay")
  } catch (err) {
    // The tray is a convenience; the overlay itself must still run.
    console.error("[overlay] tray unavailable:", err.message)
    return
  }
  trayInstance = tray

  const toggleClickThrough = () => setClickThrough(!clickThrough)

  const menu = Menu.buildFromTemplate([
    {
      label: "Show / Hide Overlay",
      click: () => toggleVisible(),
    },
    {
      label: "Click-through Mode",
      type: "checkbox",
      checked: clickThrough,
      click: (item) => setClickThrough(item.checked),
    },
    {
      label: "Compact View",
      type: "checkbox",
      checked: store.compact,
      click: (item) => {
        store.compact = item.checked
        saveStore()
        applyBounds()
        overlay?.webContents.send("overlay:compact", store.compact)
        sendSettings()
      },
    },
    { type: "separator" },
    {
      label: "Settings…",
      click: () => {
        toggleVisible(true)
        overlay?.webContents.send("overlay:opensettings")
      },
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ])

  tray.setContextMenu(menu)
  tray.on("click", () => toggleVisible())
}

function toggleVisible(forceShow) {
  if (!overlay || overlay.isDestroyed()) return
  if (overlay.isVisible() && !forceShow) {
    overlay.hide()
  } else {
    overlay.showInactive()
  }
}

/* ── Global hotkeys ───────────────────────────────────────────── */

function registerShortcuts() {
  globalShortcut.unregisterAll()

  globalShortcut.register("CommandOrControl+Alt+O", () => toggleVisible())
  globalShortcut.register("CommandOrControl+Alt+C", () => {
    store.compact = !store.compact
    saveStore()
    applyBounds()
    overlay?.webContents.send("overlay:compact", store.compact)
    sendSettings()
  })
  globalShortcut.register("CommandOrControl+Alt+D", () => {
    setClickThrough(!clickThrough)
  })
  globalShortcut.register("CommandOrControl+Alt+S", () => {
    toggleVisible(true)
    overlay?.webContents.send("overlay:opensettings")
  })
}

/* ── IPC ──────────────────────────────────────────────────────── */

ipcMain.on("overlay:hide", () => {
  if (overlay && overlay.isVisible()) overlay.hide()
})

ipcMain.on("overlay:settings", () => {
  saveStore()
  applyBounds()
  sendSettings()
  overlay?.webContents.send("overlay:reposition")
})

ipcMain.on("overlay:compact", () => {
  applyBounds()
  sendSettings()
})

/* ── Lifecycle ────────────────────────────────────────────────── */

// A single instance keeps one overlay rather than two.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on("second-instance", () => toggleVisible(true))

  app.whenReady().then(() => {
    loadStore()
    createOverlay()
    createTray()
    registerShortcuts()

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createOverlay()
    })
  })
}

app.on("window-all-closed", (event) => {
  // Keep running only when the tray is available — that's what provides
  // "show again" and "quit". Without it, closing the overlay should exit.
  if (trayInstance) {
    event?.preventDefault?.()
  }
})

app.on("before-quit", () => {
  globalShortcut.unregisterAll()
})

// Refuse a second instance from spawning another window.
app.on("will-quit", () => globalShortcut.unregisterAll())

process.on("uncaughtException", (err) => {
  console.error("[overlay] uncaught:", err)
})