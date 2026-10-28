#!/usr/bin/env python3
"""Optionaler Live-Test der von GitHub Pages verwendeten Transitous-Endpunkte."""

import datetime as dt
import json
import urllib.parse
import urllib.request

API = "https://api.transitous.org/api"
HEADERS = {
    "Accept": "application/json",
    "Origin": "https://example.github.io",
    "User-Agent": "Way-to-Winter-Magic/2.4.0 (GitHub-Pages-PWA; repository contact)",
}


def get(path, params):
    url = API + path + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=15) as response:
        cors = response.headers.get("Access-Control-Allow-Origin")
        if cors not in ("*", HEADERS["Origin"]):
            raise AssertionError(f"CORS fehlt oder ist unerwartet: {cors!r}")
        return json.load(response)


def place(name):
    payload = get("/v1/geocode", {"text": name, "language": "de", "limit": 8})
    items = payload if isinstance(payload, list) else payload.get("features", payload.get("locations", []))
    if not items:
        raise AssertionError(f"Keine Haltestelle für {name}")
    item = items[0]
    props = item.get("properties", item)
    stop_id = props.get("stopId") or props.get("id") or item.get("stopId") or item.get("id")
    if stop_id:
        return str(stop_id)
    coordinates = item.get("geometry", {}).get("coordinates", [])
    lat = props.get("lat", props.get("latitude", coordinates[1] if len(coordinates) > 1 else None))
    lon = props.get("lon", props.get("longitude", coordinates[0] if coordinates else None))
    if lat is None or lon is None:
        raise AssertionError(f"Haltestelle ohne ID/Koordinaten: {name}")
    return f"{lat},{lon}"


def main():
    origin = place("Wuppertal Hbf")
    destination = place("Essen Hbf")
    day = dt.date.today() + dt.timedelta(days=1)
    payload = get("/v6/plan", {
        "fromPlace": origin,
        "toPlace": destination,
        "time": f"{day.isoformat()}T14:00:00+01:00",
        "arriveBy": "false",
        "numItineraries": 3,
    })
    journeys = payload if isinstance(payload, list) else payload.get("itineraries", payload.get("journeys", []))
    if not isinstance(journeys, list):
        raise AssertionError("Transitous-Planantwort hat kein Itinerary-Array")
    print(f"Transitous live erreichbar: 2 Haltestellen aufgelöst, {len(journeys)} Verbindung(en), CORS geprüft.")


if __name__ == "__main__":
    main()
