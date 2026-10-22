/* ── Preload: secure bridge between renderer and main ─────────── */

const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("overlayAPI", {
  send: (channel) => {
    // Only allow the channels the overlay actually uses.
    const allowed = ["overlay:hide", "overlay:settings", "overlay:compact"]
    if (allowed.includes(channel)) ipcRenderer.send(channel)
  },

  onSettings: (callback) => {
    ipcRenderer.on("overlay:settings", (_event, settings) => callback(settings))
  },

  onCompact: (callback) => {
    ipcRenderer.on("overlay:compact", (_event, compact) => callback(compact))
  },

  onReposition: (callback) => {
    ipcRenderer.on("overlay:reposition", () => callback())
  },

  onReconnect: (callback) => {
    ipcRenderer.on("overlay:reconnect", () => callback())
  },

  onOpenSettings: (callback) => {
    ipcRenderer.on("overlay:opensettings", () => callback())
  },
})