# Way to Winter Magic V2.1.0

**WtWM** ist eine statische, installierbare GitHub-Pages-PWA für Weihnachtsmarkt-Trips ab Wuppertal.

## Neu in V2.1.0

- kompakter Header, Navigation, Formulare, Timeline und Detaildialog
- kompakte Marktkarten mit Kurzbewertung `G · L · E`, Gesamtwert und gekürztem Fazit
- gleich hohe Marktkarten und kleinere Aktionsbuttons
- umschaltbare, lokal gespeicherte Karten- und Listenansicht
- aufklappbare Bereiche auf Start-, Timeline-, Trip-, Mehr- und Detailseiten
- alle 39 Märkte und alle vorhandenen Funktionen unverändert enthalten

## Funktionen

- 39 Weihnachtsmärkte, davon 30 in V2 ergänzte Ziele
- Filter nach Stadt, ÖPNV-Fahrzeit, Luftlinie, Öffnungstag und Wunschmerkmal
- Sortierung, Favoriten und Marktquellen
- Timeline mit mehreren Personen und gemeinsamen freien Tagen
- Tripplanung mit Budget, Aktivität, Notizen und `.ics`-Export
- Online-Haltestellensuche über `v6.db.transport.rest`
- lokale Datensicherung, Import und Offline-PWA
- mobile untere Navigation und responsives Desktop-Layout

## GitHub Pages

1. Den **Inhalt** dieses Ordners in die oberste Ebene eines GitHub-Repositorys hochladen.
2. In GitHub **Settings → Pages** öffnen.
3. **Deploy from a branch**, Branch **main**, Ordner **/(root)** wählen.
4. Die veröffentlichte Seite einmal online öffnen. Danach stehen App und Marktdaten offline bereit.

## Lokal starten

```bash
python3 -m http.server 8080
```

Danach `http://localhost:8080` öffnen. Ein Webserver ist für PWA und Offline-Cache nötig.

## Tests

```bash
node tests/smoke.mjs
```

Optionaler Browser-Kompletttest, wenn Python Playwright und Chromium installiert sind:

```bash
python3 tests/e2e.py
```

Geprüft werden unter anderem:

- 39 eindeutige Märkte und genau 30 in V2 ergänzte Ziele
- Marktdaten, Termine, Quellen, Budgets, Fahrzeiten und Distanzen
- Karten-/Listenansicht, gleiche Kartenhöhen und responsive Darstellung
- Filter, Sortierung, Favoriten, aufklappbare Details und Navigation
- Timeline, Personen, Trip speichern/löschen, `.ics` und Datensicherung
- Haltestellensuche, Import, lokale Speicherung und Offline-Neuladen
- Manifest, App-Icons, Cache-Dateien und GitHub-Pages-Pfade

## Daten

Markttermine und Quellen wurden am 28.10.2026 geprüft. Fahrzeiten sind gerundete Planwerte ab Wuppertal Hbf; Distanzen sind ungefähre Luftlinien. Verbindung, Sonderfahrplan und Marktseite bitte kurz vor Abfahrt erneut prüfen.

Vorhandene lokale Daten der V2.0.0 werden weiterhin übernommen. Sicherungsdateien der bisherigen Version bleiben importierbar.
