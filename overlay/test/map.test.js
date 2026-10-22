/* ── Leaflet vendoring test ────────────────────────────────────
 * Guards the bug where the overlay's CSP blocked the Leaflet CDN
 * script, leaving an empty grey map box.
 *
 * Run: node test/map.test.js
 * ------------------------------------------------------------- */

const fs = require("node:fs")
const path = require("node:path")
const { JSDOM } = require("jsdom")

const root = path.join(__dirname, "..")

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

const html = fs.readFileSync(path.join(root, "src", "index.html"), "utf8")
const renderer = fs.readFileSync(path.join(root, "src", "renderer.js"), "utf8")

console.log("\n1. No CDN references remain")
check("index.html has no unpkg reference", /unpkg\.com/.test(html), false)
check("renderer.js has no unpkg reference", /unpkg\.com/.test(renderer), false)
check(
  "renderer.js loads vendored leaflet",
  /vendor\/leaflet\/leaflet\.js/.test(renderer),
  true
)

console.log("\n2. CSP permits the vendored script")
const csp = html.match(/content="([^"]+)"/)[1]
console.log(`        policy: ${csp}`)
check("script-src 'self' present", /script-src 'self'/.test(csp), true)
check("img-src allows https tiles", /img-src[^;]*https:/.test(csp), true)
check("connect-src allows wss + https", /connect-src[^;]*wss:[^;]*https:/.test(csp), true)

console.log("\n3. Vendored files exist and are valid")
for (const f of [
  "vendor/leaflet/leaflet.js",
  "vendor/leaflet/leaflet.css",
]) {
  check(`${f} exists`, fs.existsSync(path.join(root, f)), true)
}
const leafletSrc = fs.readFileSync(path.join(root, "vendor/leaflet/leaflet.js"), "utf8")
check("leaflet.js is a real build", /Leaflet 1\.9\.4/.test(leafletSrc), true)
check("leaflet.js exports global L", /window\.L/.test(leafletSrc) || /exports\.L/.test(leafletSrc), true)

console.log("\n4. Leaflet assets referenced by the CSS are present")
const css = fs.readFileSync(path.join(root, "vendor/leaflet/leaflet.css"), "utf8")
for (const m of css.matchAll(/url\((images\/[^)]+)\)/g)) {
  check(`css asset ${m[1]}`, fs.existsSync(path.join(root, "vendor/leaflet", m[1])), true)
}

console.log("\n5. Leaflet actually initializes against a real DOM")
;(async () => {
  const dom = new JSDOM(html.replace(/<script[^>]*src=[^>]*><\/script>/g, ""), {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "file://" + path.join(root, "src", "index.html"),
  })
  const { window } = dom

  // jsdom has no layout engine, so stub what Leaflet needs to measure.
  window.HTMLElement.prototype.getBoundingClientRect = () => ({
    width: 430, height: 250, top: 0, left: 0, right: 430, bottom: 250, x: 0, y: 0,
  })
  Object.defineProperty(window.HTMLElement.prototype, "clientWidth", { value: 430 })
  Object.defineProperty(window.HTMLElement.prototype, "clientHeight", { value: 250 })

  let threw = null
  try {
    // Execute the vendored bundle exactly as the renderer would.
    window.eval(leafletSrc)
  } catch (e) {
    threw = e.message
  }

  check("leaflet bundle evaluates without throwing", threw, null)
  check("window.L is defined", typeof window.L, "object")
  check("window.L.map is a function", typeof window.L?.map, "function")
  check("window.L.tileLayer is a function", typeof window.L?.tileLayer, "function")
  check("window.L.divIcon is a function", typeof window.L?.divIcon, "function")

  // Prove a map + tile layer + marker can actually be built.
  let built = null
  try {
    const m = window.L.map("map", { center: [14.96, -16.49], zoom: 11 })
    const layer = window.L.tileLayer(
      "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"
    ).addTo(m)
    const icon = window.L.divIcon({ html: "<div></div>", iconSize: [10, 10] })
    const marker = window.L.marker([14.96, -16.49], { icon }).addTo(m)
    built = {
      map: !!m,
      layer: !!layer,
      marker: !!marker,
      center: m.getCenter(),
      zoom: m.getZoom(),
      tileUrl: layer._url,
    }
  } catch (e) {
    built = { error: e.message }
  }

  check("map instance created", built?.map, true)
  check("tile layer created", built?.layer, true)
  check("marker created", built?.marker, true)
  check("centred on round coords", built?.zoom, 11)
  check("tile template intact", /cartocdn\.com.*\{z\}/.test(built?.tileUrl || ""), true)
  check("center lat", Number(built?.center?.lat?.toFixed(2)), 14.96)
  check("center lng", Number(built?.center?.lng?.toFixed(2)), -16.49)

  console.log(`\n${passed} passed, ${failed} failed\n`)
  process.exit(failed === 0 ? 0 : 1)
})()