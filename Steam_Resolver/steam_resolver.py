import json
import re
import time
import urllib.request
from mitmproxy import http

USER_ID = "11111111-1111-4111-8111-111111111111"
SERVER_URL = "https://georesolver.0x978.com/coords"

# Regex patterns for Google Street View & GeoGuessr responses
PROTO_COORD_RE = re.compile(r"\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]")
PAIR_COORD_RE = re.compile(r"(-?\d{1,2}\.\d{4,}),(-?\d{1,3}\.\d{4,})")
JSON_LAT_LNG_RE = re.compile(
    r'"lat"\s*:\s*(-?\d+\.\d+)\s*,\s*"lng"\s*:\s*(-?\d+\.\d+)'
)

_last_sent = (None, None)
_last_sent_time = 0.0


def _is_valid_coord(lat: float, lng: float) -> bool:
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
        return False
    if abs(lat) < 0.0001 and abs(lng) < 0.0001:
        return False
    return True


def _send_coords(lat: float, lng: float, source: str) -> None:
    global _last_sent, _last_sent_time
    now = time.time()
    # Avoid sending duplicate coordinates within 2 seconds
    if (
        _last_sent[0] is not None
        and abs(lat - _last_sent[0]) < 1e-5
        and abs(lng - _last_sent[1]) < 1e-5
        and (now - _last_sent_time) < 2.0
    ):
        return

    _last_sent = (lat, lng)
    _last_sent_time = now

    print(f"[+] Lokacija pronadjena ({source}): {lat:.6f}, {lng:.6f} -> Slanje na telefon...")

    payload = json.dumps(
        {
            "lat": lat,
            "lng": lng,
            "sessionId": USER_ID,
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        SERVER_URL,
        data=payload,
        headers={
            "Content-Type": "application/json; charset=UTF-8",
            "User-Agent": "GeoResolverSteam/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as _:
            print("[OK] Poslato na Android aplikaciju!")
    except Exception as e:
        print(f"[!] Greska pri slanju na server: {e}")


def response(flow: http.HTTPFlow) -> None:
    url = flow.request.pretty_url

    # Do not intercept our own outbound requests to georesolver
    if "georesolver.0x978.com" in url:
        return

    # 1. Google Street View internal RPC / Metadata endpoints (used by Steam & Web)
    if (
        "MapsJsInternalService/GetMetadata" in url
        or "MapsJsInternalService/SingleImageSearch" in url
        or "GeoPhotoService.GetMetadata" in url
        or "maps/api/streetview/metadata" in url
    ):
        text = flow.response.get_text(strict=False)
        if not text:
            return

        # Try [null,null,lat,lng] first (most accurate for Google Maps RPC)
        m = PROTO_COORD_RE.search(text)
        if m:
            lat, lng = float(m.group(1)), float(m.group(2))
            if _is_valid_coord(lat, lng):
                _send_coords(lat, lng, "StreetView RPC")
                return

        # Fallback to general lat,lng pair
        m2 = PAIR_COORD_RE.search(text)
        if m2:
            lat, lng = float(m2.group(1)), float(m2.group(2))
            if _is_valid_coord(lat, lng):
                _send_coords(lat, lng, "StreetView Metadata")
                return

    # 2. GeoGuessr Game Server / API endpoints (used by Steam Edition & Duels/Solo)
    if "geoguessr.com" in url and (
        "/games/" in url
        or "/duels/" in url
        or "/battle-royale/" in url
        or "/challenge" in url
        or "game-server.geoguessr.com" in url
    ):
        text = flow.response.get_text(strict=False)
        if not text:
            return

        # Try structured JSON parsing for "rounds" array (latest round is last item)
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                rounds = data.get("rounds")
                if not rounds and isinstance(data.get("game"), dict):
                    rounds = data["game"].get("rounds")
                if isinstance(rounds, list) and len(rounds) > 0:
                    last_round = rounds[-1]
                    if isinstance(last_round, dict):
                        lat = last_round.get("lat")
                        lng = last_round.get("lng")
                        if isinstance(lat, (int, float)) and isinstance(
                            lng, (int, float)
                        ):
                            if _is_valid_coord(float(lat), float(lng)):
                                _send_coords(
                                    float(lat), float(lng), "GeoGuessr Game API"
                                )
                                return
        except Exception:
            pass

        # Regex fallback for "lat": ..., "lng": ... in GeoGuessr API response
        matches = JSON_LAT_LNG_RE.findall(text)
        if matches:
            lat_str, lng_str = matches[-1]
            lat, lng = float(lat_str), float(lng_str)
            if _is_valid_coord(lat, lng):
                _send_coords(lat, lng, "GeoGuessr API")
