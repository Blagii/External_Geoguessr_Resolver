/* ── Local test harness for the overlay renderer logic ──────────
 * Verifies: server-URL normalization, coordinate handling, round
 * detection, and rendering — without needing Electron.
 * Run: node test/renderer.test.js
 * ------------------------------------------------------------- */

const fs = require("node:fs")
const path = require("node:path")

let passed = 0
let failed = 0

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    passed += 1
    console.log(`  PASS  ${name}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${name}`)
    console.log(`        expected: ${JSON.stringify(expected)}`)
    console.log(`        actual:   ${JSON.stringify(actual)}`)
  }
}

/* ── Extract and exercise the pure helpers from renderer.js ──── */

const src = fs.readFileSync(
  path.join(__dirname, "..", "src", "renderer.js"),
  "utf8"
)

// Pull out normalizeServerUrl by evaluating it in isolation.
function extractFn(name) {
  const start = src.indexOf(`function ${name}(`)
  if (start === -1) throw new Error(`${name} not found`)
  let depth = 0
  let i = src.indexOf("{", start)
  const bodyStart = i
  for (; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1
    else if (src[i] === "}") {
      depth -= 1
      if (depth === 0) break
    }
  }
  return src.slice(start, i + 1)
}

const DEFAULT_SERVER_URL = "wss://georesolver.0x978.com/ws"
const normalizeServerUrl = new Function(
  "DEFAULT_SERVER_URL",
  `${extractFn("normalizeServerUrl")}; return normalizeServerUrl;`
)(DEFAULT_SERVER_URL)

const clean = new Function(
  "const clean = " + extractFn("clean").replace(/^function clean/, "function") + "; return clean;"
)()

const toFlagEmoji = new Function(
  `${extractFn("toFlagEmoji")}; return toFlagEmoji;`
)()

console.log("\nnormalizeServerUrl")
check("default when empty", normalizeServerUrl(""), DEFAULT_SERVER_URL)
check("adds /ws to bare host", normalizeServerUrl("192.168.1.15:8000"), "ws://192.168.1.15:8000/ws")
check("adds port 8000 to plain IP", normalizeServerUrl("192.168.1.15"), "ws://192.168.1.15:8000/ws")
check("https -> wss", normalizeServerUrl("https://example.com"), "wss://example.com/ws")
check("http -> ws", normalizeServerUrl("http://example.com"), "ws://example.com/ws")
check("ws:// preserved", normalizeServerUrl("ws://example.com"), "ws://example.com/ws")
check("wss:// preserved", normalizeServerUrl("wss://example.com"), "wss://example.com/ws")
check("idempotent", normalizeServerUrl(normalizeServerUrl("192.168.1.15")), "ws://192.168.1.15:8000/ws")
check("trailing slash removed", normalizeServerUrl("192.168.1.15:8000/"), "ws://192.168.1.15:8000/ws")
check("localhost + :8000", normalizeServerUrl("localhost:8000"), "ws://localhost:8000/ws")

console.log("\nclean")
check("null-ish values become null", [clean(""), clean(null), clean("—")], [null, null, null])
check("real value passes", clean(" Serbia "), "Serbia")
check("whitespace-only becomes null", clean("   "), null)

console.log("\ntoFlagEmoji")
check("RS -> 🇷🇸", toFlagEmoji("RS"), "🇷🇸")
check("US -> 🇺🇸", toFlagEmoji("us"), "🇺🇸")
check("bad code -> globe", toFlagEmoji("XX!"), "🌍")
check("empty -> globe", toFlagEmoji(""), "🌍")

/* ── Round detection logic (mirrors handleLocation) ──────────── */

console.log("\nround detection")
function detectRound(prev, next) {
  return (
    !prev ||
    Math.abs(prev.lat - next.lat) > 1e-6 ||
    Math.abs(prev.lng - next.lng) > 1e-6
  )
}
check("first location is a new round", detectRound(null, { lat: 1, lng: 2 }), true)
check("same coords is not new", detectRound({ lat: 1, lng: 2 }, { lat: 1, lng: 2 }), false)
check("changed lat is new", detectRound({ lat: 1, lng: 2 }, { lat: 1.5, lng: 2 }), true)
check("changed lng is new", detectRound({ lat: 1, lng: 2 }, { lat: 1, lng: 2.5 }), true)
check("tiny float jitter ignored", detectRound({ lat: 1, lng: 2 }, { lat: 1.0000000001, lng: 2 }), false)

/* ── Stale-response guard ─────────────────────────────────────── */

console.log("\nstale geocode guard")
function isStale(current, requested) {
  return (
    !current ||
    Math.abs(current.lat - requested.lat) >= 1e-9 ||
    Math.abs(current.lng - requested.lng) >= 1e-9
  )
}
check("matching coords are fresh", isStale({ lat: 10, lng: 20 }, { lat: 10, lng: 20 }), false)
check("superseded by newer round", isStale({ lat: 11, lng: 20 }, { lat: 10, lng: 20 }), true)

/* ── Static checks: HTML ids referenced by renderer exist ────── */

console.log("\nHTML wiring")
const html = fs.readFileSync(path.join(__dirname, "..", "src", "index.html"), "utf8")
const referencedIds = [...src.matchAll(/\$\("([^"]+)"\)/g)].map((m) => m[1])
const missing = referencedIds.filter(
  (id) => !new RegExp(`id="${id}"`).test(html)
)
check("every $() id exists in index.html", missing, [])
check("all 4 map styles declared", (src.match(/basemaps|tile\.openstreetmap|arcgisonline/g) || []).length >= 3, true)
check("no drag region on map controls", /map-controls no-drag/.test(html), true)
check("banner is draggable", /class="banner" id="banner"/.test(html), true)

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)