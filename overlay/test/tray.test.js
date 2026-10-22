/* ── Tray icon test ────────────────────────────────────────────
 * Guards a crash where `new Tray(Buffer.from(<svg>))` was rejected by
 * Electron with "Argument must be a file path or a NativeImage",
 * surfacing as an UnhandledPromiseRejectionWarning in the console.
 *
 * Run: node test/tray.test.js
 * ------------------------------------------------------------- */

const fs = require("node:fs")
const path = require("node:path")
const zlib = require("node:zlib")

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

const main = fs.readFileSync(path.join(root, "src", "main.js"), "utf8")
const iconPath = path.join(root, "assets", "tray-icon.png")

console.log("\n1. The crash is gone from the source")
check("no Buffer.from(<svg...>) tray icon", /Buffer\.from\(\s*`?<svg/.test(main), false)
check("no inline <svg> in main.js", /<svg/.test(main), false)

console.log("\n2. Tray is built from a real image file")
check("uses nativeImage.createFromPath", /nativeImage\.createFromPath\(/.test(main), true)
check("points at assets/tray-icon.png", /assets["',\s\)]+.*tray-icon\.png|tray-icon\.png/.test(main), true)
check("guards new Tray in try/catch", /try\s*\{[\s\S]{0,200}new Tray\(/.test(main), true)
check("logs instead of crashing", /tray unavailable/.test(main), true)

console.log("\n3. fs is imported at module scope")
const topLevel = main.slice(0, main.indexOf("const MARGIN"))
check("fs required at top level", /require\("node:fs"\)/.test(topLevel), true)

console.log("\n4. The icon file is a valid PNG")
check("assets/tray-icon.png exists", fs.existsSync(iconPath), true)

if (fs.existsSync(iconPath)) {
  const b = fs.readFileSync(iconPath)
  check("PNG signature", b.subarray(0, 8).toString("hex"), "89504e470d0a1a0a")

  // Walk the chunk list rather than hardcoding offsets.
  const types = []
  let idat = null
  let off = 8
  while (off < b.length) {
    const len = b.readUInt32BE(off)
    const type = b.subarray(off + 4, off + 8).toString("ascii")
    types.push(type)
    if (type === "IDAT") idat = b.subarray(off + 8, off + 8 + len)
    if (type === "IHDR") {
      check("width", b.readUInt32BE(off + 8), 32)
      check("height", b.readUInt32BE(off + 12), 32)
      check("color type is RGBA", b[off + 8 + 9], 6)
    }
    off += 12 + len
  }
  check("has IHDR/IDAT/IEND", types.join(","), "IHDR,IDAT,IEND")

  // Decode and confirm it actually looks like the target icon.
  const raw = zlib.inflateSync(idat)
  let o = 0
  let green = 0
  let dark = 0
  let clear = 0
  for (let y = 0; y < 32; y += 1) {
    o += 1 // filter byte
    for (let x = 0; x < 32; x += 1) {
      const r = raw[o], g = raw[o + 1], bl = raw[o + 2], a = raw[o + 3]
      o += 4
      if (a < 20) clear += 1
      else if (r > 60 && g > 200 && bl < 60) green += 1
      else if (r < 40 && g < 40 && bl < 40) dark += 1
    }
  }
  check("has neon green ring", green > 50, true)
  check("has dark centre dot", dark > 20, true)
  check("rounded corners transparent", clear > 10, true)
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)