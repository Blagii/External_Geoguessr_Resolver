/* Minimal WebSocket shim over Node 22's built-in client (ws:).
 * Gives the e2e test the same on("open"/"message"/"error"/"close")
 * interface the overlay renderer uses in the browser. */

const WS = globalThis.WebSocket

class Shim {
  constructor(url) {
    this.socket = new WS(url)
    this.handlers = { open: [], message: [], error: [], close: [] }

    this.socket.addEventListener("open", () => this._emit("open"))
    this.socket.addEventListener("error", () => this._emit("error"))
    this.socket.addEventListener("close", (e) => this._emit("close", e))
    this.socket.addEventListener("message", (e) => {
      let parsed
      try {
        parsed = JSON.parse(e.data)
      } catch {
        return
      }
      this._emit("message", parsed)
    })
  }

  _emit(event, payload) {
    for (const cb of this.handlers[event] || []) cb(payload)
  }

  on(event, cb) {
    if (!this.handlers[event]) this.handlers[event] = []
    this.handlers[event].push(cb)
    return this
  }

  close() {
    try {
      this.socket.close()
    } catch {
      /* already closed */
    }
  }
}

module.exports = Shim