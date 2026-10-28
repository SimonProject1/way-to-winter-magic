# Way to Winter Magic V2.0.0

**WtWM** ist eine statische, installierbare GitHub-Pages-PWA für Weihnachtsmarkt-Trips ab Wuppertal.

## Enthalten

- 39 Weihnachtsmärkte insgesamt, davon 30 in V2 ergänzte Ziele
- Marktquellen und Prüfdatum direkt in den Details
- Filter nach Stadt, ungefährer ÖPNV-Fahrzeit, Luftlinie, Öffnungstag und Wunschmerkmal
- Sortierung nach Empfehlung, Fahrzeit, Distanz, Stadt oder Startdatum
- Favoriten, lokale Speicherung, Datensicherung und Import
- Timeline mit beliebig vielen Personen und gemeinsamen freien Tagen
- Tripplanung mit Budget, Aktivität, Notizen und gespeicherter Zielhaltestelle
- DB-basierte Haltestellensuche über `v6.db.transport.rest`
- `.ics`-Export mit Zeitzone Europe/Berlin
- installierbare Offline-PWA mit relativem GitHub-Pages-Pfad
- eigenes WtWM-Branding mit Standard-, Apple-Touch- und Maskable-App-Icons
- mobile Oberfläche mit unterer Navigation auf Smartphones

## GitHub Pages

1. Den **Inhalt** dieses Ordners in die oberste Ebene eines neuen GitHub-Repositorys hochladen.
2. In GitHub **Settings → Pages** öffnen.
3. **Deploy from a branch**, Branch **main**, Ordner **/(root)** wählen.
4. Die veröffentlichte Seite einmal online öffnen. Danach stehen App und Marktdaten offline bereit.

## Lokal starten

```bash
python3 -m http.server 8080
```

Danach `http://localhost:8080` öffnen. Ein Webserver ist nötig; ein Doppelklick auf `index.html` reicht für PWA und Offline-Cache nicht aus.

## Tests

```bash
node tests/smoke.mjs
```

Die Tests prüfen unter anderem:

- 39 eindeutige Märkte und genau 30 in V2 ergänzte Ziele
- Pflichtfelder, Termine, Quellen, Budget, Fahrzeit und Distanz
- Datumslogik, Sonder-Schließtage und einzelne Wochenendmärkte
- Timeline-/Personenmigration ohne Namens- oder ID-Kollision
- `.ics`-Escaping, Zeitzone und UTF-8-konforme Zeilenfaltung
- WtWM-Branding, Manifest, Icons und Offline-Dateien
- Ausschluss der DB-API aus dem Offline-Cache

## Daten und Migration

Markttermine und offizielle Quellen wurden am 28.10.2026 geprüft. Fahrzeiten sind gerundete Planwerte ab Wuppertal Hbf; Distanzen sind ungefähre Luftlinien. Verbindung, Sonderfahrplan und Marktseite bitte kurz vor der Abfahrt erneut prüfen.

Beim ersten Start übernimmt WtWM vorhandene lokale Eingaben der bisherigen V2.0.0 automatisch in einen eigenen, kollisionssicheren Speicherbereich. Sicherungsdateien der bisherigen Version können weiterhin importiert werden.
