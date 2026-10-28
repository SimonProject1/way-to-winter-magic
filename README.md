# Way to Winter Magic V2.2.0

Installierbare GitHub-Pages-PWA für Weihnachtsmarkt-Trips ab Wuppertal.

## Neu in V2.2.0

- eigener Bereich **Bahn** für DB-Verbindungen
- Start und Ziel frei eingeben oder einen der 39 Märkte übernehmen
- Suche nach Abfahrts- oder Ankunftszeit
- Anzeige von Fahrzeit, Umstiegen, Verkehrsmitteln, Verspätung und Etappen
- Verbindung direkt aus Marktkarte, Marktdetails, Tripmaske oder gespeichertem Trip öffnen
- zuletzt verwendete Suchdaten werden lokal gespeichert
- V2.1-Karten-/Listenansicht und bestehende lokale Daten bleiben erhalten

Die Verbindungssuche nutzt online die öffentlich erreichbare, DB-basierte Fahrplanschnittstelle `v5.db.api.bahn.guru`. Märkte, Favoriten, Timeline, Trips und gespeicherte Daten funktionieren weiterhin offline.

## Weitere Funktionen

- 39 geprüfte Märkte, davon 30 in V2 ergänzte Ziele
- Marktfilter, Sortierung, Favoriten und Karten-/Listenansicht
- gemeinsame Terminplanung für beliebig viele Personen
- Tripplanung mit Budget, Notizen, Zielhaltestelle und `.ics`-Export
- lokale Sicherung und Wiederherstellung
- installierbare Offline-PWA mit relativen GitHub-Pages-Pfaden

## GitHub Pages

1. Den **Inhalt** dieses Ordners in die oberste Ebene des Repositorys hochladen.
2. **Settings → Pages** öffnen.
3. **Deploy from a branch**, Branch **main**, Ordner **/(root)** wählen.
4. Die Seite einmal online öffnen, damit die Offline-Dateien gespeichert werden.

## Lokal starten

```bash
python3 -m http.server 8080
```

Danach `http://localhost:8080` öffnen.

## Tests

```bash
node tests/smoke.mjs
```

Geprüft werden unter anderem Marktdaten, Datumslogik, lokale Speicherung, Listenansicht, DB-Suchoberfläche, Aufbau der Fahrplananfrage, `.ics`-Export, Manifest und Offline-Cache.

## Datenhinweis

Markttermine und Quellen: Prüfstand 28.10.2026. Fahrzeiten sind gerundete Planwerte ab Wuppertal Hbf. Live-Verbindungen können sich ändern und sollten vor der Abfahrt zusätzlich bei DB geprüft werden.
