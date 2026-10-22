/* ── GeoGuessr Overlay — renderer ───────────────────────────────
 * Connects to the same GeoResolver WebSocket as the Android app and
 * the web dashboard, then shows country / city / road / map in a
 * small always-on-top window that floats above the game.
 * ------------------------------------------------------------- */

const DEFAULT_USER_ID = "11111111-1111-4111-8111-111111111111"
const DEFAULT_SERVER_URL = "wss://georesolver.0x978.com/ws"
const DEFAULT_CENTER = [20, 0]
const DEFAULT_ZOOM = 3

/** Live state */
const state = {
  token: DEFAULT_USER_ID,
  server: DEFAULT_SERVER_URL,
  styleIndex: 0,
  opacity: 0.92,
  scale: 1,
  position: "top-right",
  compact: false,
  connected: false,
  location: null,
  details: {},
  round: 0,
  lastCoordsSent: null,
}

let ws = null
let reconnectTimer = null
let reconnectAttempts = 0
let map = null
let marker = null
let tileLayer = null
let leafletReady = false

/* ── DOM refs ─────────────────────────────────────────────────── */

const $ = (id) => document.getElementById(id)
const el = {
  overlay: document.querySelector(".overlay"),
  flag: $("flag"),
  country: $("country"),
  subline: $("subline"),
  roundBadge: $("roundBadge"),
  details: $("details"),
  dCity: $("dCity"),
  dState: $("dState"),
  dRoad: $("dRoad"),
  dCoords: $("dCoords"),
  cCountry: $("cCountry"),
  cCity: $("cCity"),
  settings: $("settings"),
  connStatus: $("connStatus"),
  inpToken: $("inpToken"),
  inpServer: $("inpServer"),
  selPosition: $("selPosition"),
  inpOpacity: $("inpOpacity"),
  inpSize: $("inpSize"),
  selStyle: $("selStyle"),
  opacityVal: $("opacityVal"),
  sizeVal: $("sizeVal"),
}

/* ── Small helpers ────────────────────────────────────────────── */

function clean(value) {
  if (!value || value === "—") return null
  const str = String(value).trim()
  return str && str !== "—" ? str : null
}

/** countryCode → regional-indicator flag emoji. */
function toFlagEmoji(code) {
  if (!code || code.length !== 2) return "🌍"
  const base = 0x1f1e6
  const upper = code.toUpperCase()
  const a = upper.charCodeAt(0) - 65
  const b = upper.charCodeAt(1) - 65
  if (a < 0 || a > 25 || b < 0 || b > 25) return "🌍"
  return String.fromCodePoint(base + a, base + b)
}

function setStatus(text, cls) {
  el.connStatus.textContent = text
  el.connStatus.className = `status ${cls || ""}`
}

/* ── URL normalization (mirrors frontend/lib/websocket.tsx) ────── */

function normalizeServerUrl(raw) {
  let trimmed = (raw || "").trim()
  if (!trimmed) return DEFAULT_SERVER_URL
  while (trimmed.endsWith("/")) trimmed = trimmed.slice(0, -1)

  if (!trimmed.startsWith("ws://") && !trimmed.startsWith("wss://")) {
    if (trimmed.startsWith("https://")) {
      trimmed = `wss://${trimmed.slice(8)}`
    } else if (trimmed.startsWith("http://")) {
      trimmed = `ws://${trimmed.slice(7)}`
    } else if (!trimmed.includes(":") && !trimmed.includes(".com")) {
      trimmed = `ws://${trimmed}:8000`
    } else {
      trimmed = `ws://${trimmed}`
    }
  }
  if (!trimmed.endsWith("/ws")) trimmed = `${trimmed}/ws`
  return trimmed
}

/* ── Persistence ──────────────────────────────────────────────── */

const STORE_KEY = "overlaySettings"

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return
    const saved = JSON.parse(raw)
    for (const key of ["token", "server", "styleIndex", "opacity", "scale", "position", "compact"]) {
      if (saved[key] !== undefined && saved[key] !== null) state[key] = saved[key]
    }
  } catch {
    /* corrupt settings — fall back to defaults */
  }
}

function saveSettings() {
  const { token, server, styleIndex, opacity, scale, position, compact } = state
  localStorage.setItem(
    STORE_KEY,
    JSON.stringify({ token, server, styleIndex, opacity, scale, position, compact })
  )
}

/* ── UI rendering ─────────────────────────────────────────────── */

function applyLook() {
  el.overlay.style.setProperty("--scale", state.scale)
  el.overlay.style.setProperty("--opacity", state.opacity)
  el.opacityVal.textContent = `${Math.round(state.opacity * 100)}%`
  el.sizeVal.textContent = `${Math.round(state.scale * 100)}%`
  el.selPosition.value = state.position
  el.inpOpacity.value = String(Math.round(state.opacity * 100))
  el.inpSize.value = String(Math.round(state.scale * 100))
  el.inpToken.value = state.token
  el.inpServer.value = state.server
  el.selStyle.value = String(state.styleIndex)
  el.overlay.classList.toggle("compact-mode", state.compact)
}

function renderLocation() {
  const loc = state.location
  const d = state.details

  if (!loc) {
    el.country.textContent = state.connected ? "Waiting for round…" : "Connecting…"
    el.subline.textContent = ""
    el.flag.textContent = "🌍"
    el.dCity.textContent = "—"
    el.dState.textContent = "—"
    el.dRoad.textContent = "—"
    el.dCoords.textContent = "—"
    el.cCountry.textContent = "—"
    el.cCity.textContent = "—"
    el.roundBadge.textContent = "—"
    return
  }

  const country = clean(d.country) || "Locating…"
  const city =
    clean(d.city) || clean(d.town) || clean(d.village) || clean(d.county) || null
  const stateName = clean(d.state)
  const road = clean(d.road)

  el.country.textContent = country
  el.flag.textContent = toFlagEmoji(d.countryCode)

  const subParts = []
  if (city) subParts.push(city)
  if (stateName) subParts.push(stateName)
  if (road) subParts.push(road)
  el.subline.textContent = subParts.join(" • ")

  const coordText = `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`
  el.dCoords.textContent = coordText
  el.dCity.textContent = city || "—"
  el.dState.textContent = stateName || "—"
  el.dRoad.textContent = road || "—"

  el.cCountry.textContent = country
  el.cCity.textContent = city || stateName || "—"

  el.roundBadge.textContent = state.round > 0 ? `R${state.round}` : "NEW"
}

function render() {
  renderLocation()
  updateMapPin()
}

/* ── Reverse geocoding (same source as the dashboard) ─────────── */

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`
    const res = await fetch(url, {
      headers: { "User-Agent": "GeoResolver", "Accept-Language": "en" },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const a = data.address || {}

    let locationName = "—"
    if (a.house_number && a.road) locationName = `${a.house_number} ${a.road}`
    else if (a.neighbourhood) locationName = a.neighbourhood
    else if (a.suburb) locationName = a.suburb
    else if (a.city) locationName = a.city

    return {
      country: a.country || "—",
      countryCode: a.country_code || "",
      state: a.state || "—",
      county: a.county || "—",
      city: a.city || "—",
      town: a.town || "—",
      village: a.village || "—",
      road: a.road || "—",
      postcode: a.postcode || "—",
      neighborhood: a.neighbourhood || a.suburb || a.residential || "—",
      sublocality: a.hamlet || a.suburb || "—",
      premise: a.house_number || "—",
      locationName,
    }
  } catch {
    return {}
  }
}

/* ── Map (Leaflet from CDN) ───────────────────────────────────── */

const MAP_STYLES = [
  "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
]

function loadLeaflet() {
  if (window.L) {
    leafletReady = true
    initMap()
    return
  }

  if (!document.getElementById("leaflet-css")) {
    const link = document.createElement("link")
    link.id = "leaflet-css"
    link.rel = "stylesheet"
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    document.head.appendChild(link)
  }

  const script = document.createElement("script")
  script.id = "leaflet-js"
  script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  script.onload = () => {
    leafletReady = true
    initMap()
  }
  script.onerror = () => {
    // Map unavailable — the text overlay still works.
    document.getElementById("mapWrap").style.display = "none"
  }
  document.head.appendChild(script)
}

function bullseyeIcon(labelText) {
  const safe = String(labelText || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

  const label = safe
    ? `<div class="gp-pin-label">${safe}</div>`
    : ""

  return window.L.divIcon({
    className: "",
    iconSize: [140, 60],
    iconAnchor: [70, 58],
    html: `<div class="gp-pin">${label}<div class="gp-ring"><div class="gp-dot"></div></div></div>`,
  })
}

function pinLabel() {
  const d = state.details
  const city = clean(d.city) || clean(d.town) || clean(d.village)
  const country = clean(d.country)
  return [city, country].filter(Boolean).join(", ")
}

function initMap() {
  const L = window.L
  if (!L || map) return

  const center = state.location
    ? [state.location.lat, state.location.lng]
    : DEFAULT_CENTER

  map = L.map("map", {
    center,
    zoom: state.location ? 11 : DEFAULT_ZOOM,
    zoomControl: false,
    attributionControl: false,
    dragging: false,   /* overlay must never steal clicks from the game */
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    touchZoom: false,
  })

  tileLayer = L.tileLayer(MAP_STYLES[state.styleIndex], { maxZoom: 19 }).addTo(map)

  marker = L.marker(center, {
    icon: bullseyeIcon(pinLabel()),
    interactive: false,
    keyboard: false,
  }).addTo(map)

  updateMapPin()
}

function updateMapPin() {
  if (!leafletReady || !map || !marker) return
  if (!state.location) return

  const { lat, lng } = state.location
  marker.setLatLng([lat, lng])
  marker.setIcon(bullseyeIcon(pinLabel()))
  map.setView([lat, lng], map.getZoom(), { animate: true })
}

/* ── Map controls ─────────────────────────────────────────────── */

function zoomBy(delta) {
  if (!map) return
  const center = map.getCenter()
  const next = Math.min(19, Math.max(2, Math.round(map.getZoom() + delta)))
  map.setView([center.lat, center.lng], next, { animate: true })
}

function setZoom(target) {
  if (!map) return
  const center = state.location
    ? [state.location.lat, state.location.lng]
    : [map.getCenter().lat, map.getCenter().lng]
  map.setView(center, target, { animate: true })
}

function recenter() {
  if (!map || !state.location) return
  map.setView([state.location.lat, state.location.lng], 16, { animate: true })
}

/* ── WebSocket ────────────────────────────────────────────────── */

const MAX_RECONNECT = 50

function clearReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function scheduleReconnect() {
  clearReconnect()
  if (reconnectAttempts >= MAX_RECONNECT) {
    setStatus("Reconnect limit", "err")
    return
  }
  reconnectAttempts += 1
  const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempts, 5), 15000)
  reconnectTimer = setTimeout(connect, delay)
}

function connect() {
  clearReconnect()
  if (ws) {
    try {
      ws.onclose = null
      ws.close()
    } catch {
      /* already closing */
    }
    ws = null
  }

  const base = normalizeServerUrl(state.server)
  const url = `${base}/${encodeURIComponent(state.token)}`
  setStatus("Connecting…")

  let socket
  try {
    socket = new WebSocket(url)
  } catch {
    setStatus("Failed", "err")
    scheduleReconnect()
    return
  }
  ws = socket

  socket.onopen = () => {
    state.connected = true
    reconnectAttempts = 0
    setStatus("Connected", "ok")
  }

  socket.onmessage = (event) => {
    let data
    try {
      data = JSON.parse(event.data)
    } catch {
      return
    }
    if (typeof data.lat !== "number" || typeof data.lng !== "number") return
    handleLocation(data)
  }

  socket.onclose = (event) => {
    state.connected = false
    ws = null
    setStatus("Disconnected", "err")
    if (event.code !== 1000) scheduleReconnect()
  }

  socket.onerror = () => {
    setStatus("Error", "err")
  }
}

/**
 * Handle a new round. The server only sends lat/lng/timestamp, so we detect
 * "new round" from the coordinates changing, and re-geocode asynchronously.
 */
async function handleLocation(data) {
  const prev = state.location
  const isNewRound =
    !prev ||
    Math.abs(prev.lat - data.lat) > 1e-6 ||
    Math.abs(prev.lng - data.lng) > 1e-6

  state.location = { lat: data.lat, lng: data.lng, timestamp: data.timestamp }

  if (isNewRound) {
    state.round += 1
    state.details = {}
    // Reset to a mid zoom so the country is visible immediately,
    // then the map zooms in once geocoding resolves.
    if (map) map.setView([data.lat, data.lng], 6, { animate: true })
  }

  updateMapPin()
  renderLocation()

  const details = await reverseGeocode(data.lat, data.lng)
  // Ignore stale responses if a newer round landed while we were fetching.
  if (
    state.location &&
    Math.abs(state.location.lat - data.lat) < 1e-9 &&
    Math.abs(state.location.lng - data.lng) < 1e-9
  ) {
    state.details = details
    updateMapPin()
    renderLocation()
  }
}

/* ── IPC with main ────────────────────────────────────────────── */

function notifyMain(channel) {
  if (window.overlayAPI && typeof window.overlayAPI.send === "function") {
    window.overlayAPI.send(channel)
  }
}

window.overlayAPI?.onSettings?.((next) => {
  Object.assign(state, next)
  applyLook()
  render()
})

window.overlayAPI?.onCompact?.((compact) => {
  state.compact = compact
  applyLook()
  render()
})

window.overlayAPI?.onReposition?.(() => {
  if (map) setTimeout(() => map.invalidateSize(), 120)
})

window.overlayAPI?.onReconnect?.(() => {
  connect()
})

/* Tray → "Settings…" opens the drawer in the renderer. */
window.overlayAPI?.onOpenSettings?.(() => {
  openSettings(true)
})

/* ── UI wiring ────────────────────────────────────────────────── */

function toggleCompact() {
  state.compact = !state.compact
  applyLook()
  saveSettings()
  notifyMain("overlay:compact")
  if (map) setTimeout(() => map.invalidateSize(), 120)
  render()
}

function openSettings(open) {
  el.settings.hidden = !open
  if (open) {
    el.inpToken.value = state.token
    el.inpServer.value = state.server
    el.selStyle.value = String(state.styleIndex)
  }
}

function saveAndReconnect() {
  const token = el.inpToken.value.trim()
  if (token) state.token = token

  const server = el.inpServer.value.trim()
  if (server) state.server = normalizeServerUrl(server)

  state.position = el.selPosition.value
  state.opacity = Number(el.inpOpacity.value) / 100
  state.scale = Number(el.inpSize.value) / 100
  state.styleIndex = Number(el.selStyle.value)

  applyLook()
  saveSettings()
  notifyMain("overlay:settings")

  if (tileLayer) tileLayer.setUrl(MAP_STYLES[state.styleIndex])

  openSettings(false)
  connect()
}

async function copyCoords() {
  if (!state.location) return
  const text = `${state.location.lat.toFixed(6)}, ${state.location.lng.toFixed(6)}`
  try {
    await navigator.clipboard.writeText(text)
    el.roundBadge.textContent = "✓"
    setTimeout(renderLocation, 900)
  } catch {
    el.roundBadge.textContent = "!"
    setTimeout(renderLocation, 900)
  }
}

function init() {
  loadSettings()
  applyLook()
  loadLeaflet()
  render()
  connect()

  // Leaflet caches its canvas size; whenever the panel is resized
  // (size slider, compact toggle, reposition) it must recalculate or
  // tiles and controls render at the wrong dimensions.
  const mapWrap = document.getElementById("mapWrap")
  if (mapWrap && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => {
      if (map) map.invalidateSize()
    }).observe(mapWrap)
  }

  $("btnCopy").addEventListener("click", copyCoords)
  $("btnCompact").addEventListener("click", toggleCompact)
  $("btnSettings").addEventListener("click", () => openSettings(el.settings.hidden))
  $("btnSettingsClose").addEventListener("click", () => openSettings(false))
  $("btnClose").addEventListener("click", () => notifyMain("overlay:hide"))
  $("btnSave").addEventListener("click", saveAndReconnect)

  $("btnCenter").addEventListener("click", recenter)
  $("btnZoomIn").addEventListener("click", () => zoomBy(2))
  $("btnZoomOut").addEventListener("click", () => zoomBy(-2))

  document.querySelectorAll("#zoomPresets button").forEach((btn) => {
    btn.addEventListener("click", () => setZoom(Number(btn.dataset.zoom)))
  })

  el.inpOpacity.addEventListener("input", () => {
    state.opacity = Number(el.inpOpacity.value) / 100
    applyLook()
  })
  el.inpSize.addEventListener("input", () => {
    state.scale = Number(el.inpSize.value) / 100
    applyLook()
  })
}

document.addEventListener("DOMContentLoaded", init)