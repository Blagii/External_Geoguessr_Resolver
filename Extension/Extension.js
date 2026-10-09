// ==UserScript==
// @name         Geoguessr Location Resolver EXTERNAL
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Receive geoguessr location to any device.
// @author       0x978
// @match        https://www.geoguessr.com/*
// @match        https://geoguessr.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=geoguessr.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      georesolver.0x978.com
// @connect      *
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const SERVER_URL = "https://georesolver.0x978.com/coords";

    // ====================================User ID handling====================================
    function generateGuid() {
        return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
            (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
        );
    }

    let userId = null;
    try {
        userId = typeof GM_getValue === "function" ? GM_getValue("sessionId") : localStorage.getItem("georesolver_sessionId");
    } catch (e) {
        userId = localStorage.getItem("georesolver_sessionId");
    }

    if (!userId) {
        userId = generateGuid();
        try {
            if (typeof GM_setValue === "function") GM_setValue("sessionId", userId);
        } catch (e) {}
        try {
            localStorage.setItem("georesolver_sessionId", userId);
        } catch (e) {}
    }

    // ====================================Send To Server====================================
    function sendCoords(lat, lng) {
        const payload = JSON.stringify({
            lat: lat,
            lng: lng,
            sessionId: userId
        });

        if (typeof GM_xmlhttpRequest === "function") {
            GM_xmlhttpRequest({
                method: "POST",
                url: SERVER_URL,
                headers: { "Content-Type": "application/json; charset=UTF-8" },
                data: payload
            });
        } else {
            fetch(SERVER_URL, {
                method: "POST",
                body: payload,
                headers: { "Content-Type": "application/json; charset=UTF-8" }
            }).catch(() => {});
        }
    }

    // ====================================Overwriting XHR====================================
    function hookXHR(win) {
        if (!win || !win.XMLHttpRequest) return;
        const originalOpen = win.XMLHttpRequest.prototype.open;
        if (originalOpen._geoHooked) return;

        win.XMLHttpRequest.prototype.open = function (method, url) {
            if (typeof method === "string" && method.toUpperCase() === "POST" && typeof url === "string" &&
                (url.startsWith("https://maps.googleapis.com/$rpc/google.internal.maps.mapsjs.v1.MapsJsInternalService/GetMetadata") ||
                 url.startsWith("https://maps.googleapis.com/$rpc/google.internal.maps.mapsjs.v1.MapsJsInternalService/SingleImageSearch"))) {

                this.addEventListener("load", function () {
                    try {
                        const pattern = /-?\d+\.\d+,-?\d+\.\d+/g;
                        const match = this.responseText.match(pattern);
                        if (match && match[0]) {
                            const [lat, lng] = match[0].split(",").map(Number);
                            sendCoords(lat, lng);
                        }
                    } catch (e) {}
                });
            }
            return originalOpen.apply(this, arguments);
        };
        win.XMLHttpRequest.prototype.open._geoHooked = true;
    }

    hookXHR(window);
    if (typeof unsafeWindow !== "undefined") {
        hookXHR(unsafeWindow);
    }

    // ====================================UI & F9 Shortcut====================================
    function showUserIdModal() {
        prompt("Tvoj GeoResolver User ID (kopiraj ga u Android aplikaciju):", userId);
    }

    window.addEventListener("keydown", function (e) {
        if (e.key === "F9" || e.code === "F9" || e.keyCode === 120) {
            e.preventDefault();
            e.stopPropagation();
            showUserIdModal();
        }
    }, true);

    function createStatusBadge() {
        if (document.getElementById("georesolver-badge")) return;
        const badge = document.createElement("div");
        badge.id = "georesolver-badge";
        badge.style.cssText = [
            "position:fixed",
            "bottom:12px",
            "left:12px",
            "z-index:999999",
            "background:#111",
            "color:#56FF0A",
            "border:1px solid #56FF0A",
            "border-radius:8px",
            "padding:8px 12px",
            "font-family:monospace",
            "font-size:12px",
            "cursor:pointer",
            "box-shadow:0 2px 10px rgba(0,0,0,0.6)"
        ].join(";");
        badge.title = "Klikni da vidiš i kopiraš svoj User ID (ili pritisni F9)";
        badge.textContent = "GeoResolver ID: " + userId + " (Klikni za kopiranje)";
        badge.addEventListener("click", function () {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(userId).then(function () {
                    badge.textContent = "Kopirano! ID: " + userId;
                    setTimeout(function () {
                        badge.textContent = "GeoResolver ID: " + userId;
                    }, 2000);
                }).catch(showUserIdModal);
            } else {
                showUserIdModal();
            }
        });
        document.body.appendChild(badge);
    }

    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", createStatusBadge);
    } else {
        createStatusBadge();
    }
})();
