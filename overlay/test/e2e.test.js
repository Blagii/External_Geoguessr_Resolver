/* End-to-end test: overlay WebSocket flow against the real server.py
 * Run: node test/e2e.test.js
 * Requires: server.py listening on ws://localhost:8000/ws
 */

const WebSocket = require("./ws-shim")

const TOKEN = `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
const OTHER_TOKEN = `other-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
const BASE = "ws://localhost:8000/ws"

let passed = 0
let failed = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { passed += 1; console.log(`  PASS  ${name}`) }
  else {
    failed += 1
    console.log(`  FAIL  ${name}`)
    console.log(`        expected: ${JSON.stringify(expected)}`)
    console.log(`        actual:   ${JSON.stringify(actual)}`)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function postCoords(lat, lng, sessionId) {
  const res = await fetch("http://localhost:8000/coords", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, sessionId }),
  })
  return res.json()
}

/** Exactly how renderer.js builds its URL and connects.
 *  Note: the message listener is attached synchronously at construction,
 *  so the server's immediate "latest coords" replay is never missed. */
function connectOverlay() {
  const received = []
  const ws = new WebSocket(`${BASE}/${encodeURIComponent(TOKEN)}`)
  ws.on("message", (data) => received.push(data))
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("connect timeout")), 8000)
    ws.on("open", () => { clearTimeout(timer); resolve({ ws, received, close: () => ws.close() }) })
    ws.on("error", (e) => { clearTimeout(timer); reject(e) })
  })
}

;(async () => {
  console.log("\n1. POST /coords then receive over WebSocket")
  const conn = await connectOverlay()

  // Berlin, Brandenburg Gate
  await postCoords(52.516275, 13.377704, TOKEN)
  await sleep(700)

  check("received exactly one payload", conn.received.length, 1)
  const first = conn.received[0]
  check("payload has lat", typeof first.lat, "number")
  check("lat matches", Number(first.lat.toFixed(6)), 52.516275)
  check("lng matches", Number(first.lng.toFixed(6)), 13.377704)
  check("sessionId echoed", first.sessionId, TOKEN)
  check("timestamp present", typeof first.timestamp, "number")

  console.log("\n2. Late joiner gets the latest coords replayed")
  const late = await connectOverlay()
  await sleep(500)
  check("late joiner received replay", late.received.length, 1)
  check("replay has same lat", Number(late.received[0].lat.toFixed(6)), 52.516275)

  console.log("\n3. New round pushes an update to the existing connection")
  // Sydney, Australia
  await postCoords(-33.868820, 151.209290, TOKEN)
  await sleep(700)
  check("connection received the update", conn.received.length, 2)
  check("new lat arrived", Number(conn.received[1].lat.toFixed(6)), -33.868820)
  check("new lng arrived", Number(conn.received[1].lng.toFixed(6)), 151.209290)

  console.log("\n4. Session isolation (different token gets nothing)")
  const other = new WebSocket(`${BASE}/${OTHER_TOKEN}`)
  const otherMsgs = []
  other.on("message", (d) => otherMsgs.push(d))
  await new Promise((r) => { other.on("open", r) })
  await sleep(500)
  check("other session has no data", otherMsgs.length, 0)

  console.log("\n5. Reverse geocoding resolves overlay coordinates")
  // Use a real, stable address so this assertion is meaningful.
  const { lat, lng } = conn.received[1]
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`
  let country = null
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "GeoResolver", "Accept-Language": "en" },
    })
    if (res.ok) {
      const data = await res.json()
      country = data.address?.country_code || data.address?.country || null
    }
  } catch { /* offline — skip */ }

  if (country) {
    check("Sydney coords resolve to Australia", country, "AU")
  } else {
    console.log("  SKIP  geocoding (no internet access in sandbox)")
  }

  conn.close(); late.close(); other.close()
  console.log(`\n${passed} passed, ${failed} failed\n`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((err) => {
  console.error("\nE2E ERROR:", err.message)
  process.exit(1)
})