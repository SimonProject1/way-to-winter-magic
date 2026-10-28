# Way to Winter Magic V2.3.0

Installierbare GitHub-Pages-PWA für Weihnachtsmarkt-Trips ab Wuppertal.

## Neu in V2.3.0

- DB-Verbindungssuche von der fehlerhaften bisherigen Schnittstelle auf **Transitous / MOTIS 2** umgestellt
- Haltestellen- und Adresssuche über Transitous
- Hin- und Rückfahrt über Start/Ziel-Tausch sowie Suche nach Abfahrt oder Ankunft
- 12-Sekunden-Timeout pro Versuch und ein automatischer Wiederholungsversuch
- verständliche Hinweise bei Offlinebetrieb, Timeout, Überlastung, Server- und Netzwerkfehlern
- sichtbarer Button **Erneut versuchen**
- bis zu 8 erfolgreiche Suchen lokal für die Offline-Anzeige gespeichert
- Button **Im DB Navigator öffnen** mit Start, Ziel, Datum, Uhrzeit und Zeitbezug
- Quellenhinweise für Transitous und OpenStreetMap
- bestehende 39 Märkte, Filter, Favoriten, Timeline, Personen, Trips, Sicherung und `.ics`-Export bleiben erhalten

Die App nutzt im Browser die öffentliche Transitous-API unter `https://api.transitous.org/api/`. Es gibt keinen API-Schlüssel und keinen eigenen Server. Transitous ist ein Community-Dienst auf Best-Effort-Basis. Das Projekt ist deshalb bewusst für leichte, nichtkommerzielle Nutzung ausgelegt.

## GitHub Pages

1. Den **Inhalt** dieses Ordners in die oberste Ebene des Repositorys hochladen.
2. **Settings → Pages** öffnen.
3. **Deploy from a branch**, Branch **main**, Ordner **/(root)** wählen.
4. Die Seite nach dem Deployment einmal online öffnen. Bei einem Update gegebenenfalls einmal neu laden, damit der neue Service Worker aktiv wird.

Alle App-Pfade sind relativ und funktionieren auch in einem GitHub-Pages-Unterordner.

## Tests

```bash
node tests/smoke.mjs
python3 tests/e2e_github_pages.py
```

Der E2E-Test startet die App unter einem GitHub-Pages-typischen Unterpfad, simuliert Transitous-Antworten und prüft Haltestellensuche, Abfahrt, Ankunft/Rückfahrt, automatischen Retry, Timeoutanzeige, Offline-Speicher und DB-Navigator-Link. Der Live-Endpunkt kann zusätzlich mit `python3 tests/live_transitous.py` geprüft werden, sofern der Rechner direkten Zugriff auf `api.transitous.org` hat.

## Datenschutz und Quellen

Suchanfragen werden für die Fahrplanauskunft an Transitous übertragen. Erfolgreiche Verbindungsergebnisse werden ausschließlich lokal im Browser gespeichert. Fahrplandaten: [Transitous-Quellen](https://transitous.org/sources/). Ortsdaten: [© OpenStreetMap-Mitwirkende](https://www.openstreetmap.org/copyright).

Markttermine und Quellen: Prüfstand 28.10.2026. Live-Verbindungen können sich ändern und sollten vor der Abfahrt zusätzlich im DB Navigator geprüft werden.
