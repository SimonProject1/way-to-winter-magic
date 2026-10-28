# Way to Winter Magic V3.4.0

Installierbare GitHub-Pages-PWA für Weihnachtsmarkt-Trips ab Wuppertal.

## Funktionen

- 39 geprüfte Weihnachtsmarkt-Ziele mit Filtern und Detailansicht
- Schrittweiser Tripplaner für Personen, Datum, Markt, Budget und Bahn
- Hin- und Rückfahrten über Transitous
- Lokale Favoriten, Verfügbarkeiten, Trips und gespeicherte Verbindungen
- Winterzauber-Album mit 16 Stickern und verständlichem Fortschritt
- Sticker-Details mit Bedeutung, Freischaltbedingung, Freischaltdatum und zugehörigen Besuchen
- Wintertagebuch mit Bewertung, Erinnerungen und Teilen-Funktion
- Datensicherung als JSON und Kalenderexport als ICS
- Offline-Start nach dem ersten vollständigen Online-Aufruf

## GitHub Pages veröffentlichen

1. Den **Inhalt** dieser ZIP in die oberste Ebene eines GitHub-Repositorys kopieren.
2. In GitHub **Settings → Pages** öffnen.
3. **Deploy from a branch**, Branch **main**, Ordner **/(root)** auswählen.
4. Die veröffentlichte Seite einmal vollständig online öffnen. Danach steht die App auch offline zur Verfügung.

`start_url`, `scope`, Service Worker und alle Dateipfade sind relativ und funktionieren deshalb auch unter einem GitHub-Pages-Unterpfad.

## Lokale Prüfung

```bash
node tests/smoke.mjs
python3 tests/e2e_github_pages.py
python3 tests/live_transitous.py   # optional, benötigt direkten Internetzugriff
```

Die automatisierten Prüfungen decken Datenintegrität, Tripplanung, Sticker, Tagebuch, Teilen, Sicherung/Wiederherstellung, mobile und Desktop-Darstellung, Offline-Start sowie den Betrieb unter einem GitHub-Pages-Unterpfad ab.
