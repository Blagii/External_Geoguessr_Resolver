/* ── Overlay setup helper ─────────────────────────────────────
 * Guarantees the Electron runtime is present and resolvable.
 *
 * npm >= 12 blocks dependency `postinstall` scripts by default, which
 * silently skips Electron's binary download. This script installs
 * dependencies and then, if Electron still can't resolve its own path,
 * runs Electron's bundled installer directly instead of relying on npm's
 * script policy. Idempotent: safe to run repeatedly.
 * ------------------------------------------------------------- */

const { execFileSync, spawnSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")

const ROOT = __dirname
const ELECTRON_DIR = path.join(ROOT, "node_modules", "electron")
const PATH_TXT = path.join(ELECTRON_DIR, "path.txt")

const log = (msg) => console.log(`  ${msg}`)

function npm(args, opts = {}) {
  return spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts,
  })
}

/** True when Electron's index.js can resolve its binary (i.e. path.txt exists). */
function electronResolves() {
  try {
    execFileSync(process.execPath, ["-e", "require('electron')"], {
      cwd: ROOT,
      stdio: "ignore",
    })
    return true
  } catch {
    return false
  }
}

/** Run Electron's own install.js, which downloads and unpacks the binary. */
function runElectronInstaller() {
  const installer = path.join(ELECTRON_DIR, "install.js")
  if (!fs.existsSync(installer)) return false

  log("running Electron's installer directly (bypassing npm script policy)...")
  const result = spawnSync(process.execPath, [installer], {
    cwd: ELECTRON_DIR,
    stdio: "inherit",
  })
  return result.status === 0
}

/** Last resort: ask npm to approve + rebuild just electron. */
function approveAndRebuild() {
  log("approving electron install script via npm...")
  npm(["install-scripts", "approve", "electron"], { stdio: "ignore" })
  npm(["rebuild", "electron"], { stdio: "ignore" })
}

function main() {
  console.log("")
  console.log("[1/2] Installing dependencies...")
  npm(["install"])
  console.log("")

  console.log("[2/2] Ensuring the Electron runtime is available...")
  if (electronResolves()) {
    console.log("      Electron runtime OK.")
    console.log("")
    console.log("==========================================================")
    console.log("  Setup complete! Run  2_START_OVERLAY.bat  to play")
    console.log("==========================================================")
    console.log("")
    process.exit(0)
  }

  log("Electron runtime not found - repairing...")

  // npm >= 12 may have skipped the postinstall; run it ourselves.
  if (runElectronInstaller() && electronResolves()) {
    console.log("")
    console.log("==========================================================")
    console.log("  Setup complete! Run  2_START_OVERLAY.bat  to play")
    console.log("==========================================================")
    console.log("")
    process.exit(0)
  }

  // Try the npm-native approval path as a fallback.
  approveAndRebuild()
  if (electronResolves()) {
    console.log("")
    console.log("==========================================================")
    console.log("  Setup complete! Run  2_START_OVERLAY.bat  to play")
    console.log("==========================================================")
    console.log("")
    process.exit(0)
  }

  console.log("")
  console.log("  [X] Could not download the Electron runtime (~100 MB).")
  console.log("")
  console.log("      This step downloads from GitHub releases. Please check:")
  console.log("        - your internet connection")
  console.log("        - firewall/proxy: allow github.com and objects.githubusercontent.com")
  console.log("        - then run this file again")
  console.log("")
  process.exit(1)
}

main()