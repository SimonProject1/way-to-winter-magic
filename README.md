# Way to Winter Magic V4.0.1

Installierbare GitHub-Pages-PWA mit 39 Weihnachtsmärkten, Reiseplanung, Transitous-Verbindungssuche, Winterzauber-Album und lokalem Wintertagebuch.

## Neu in V4.0.1

### Reparierter Sticker-Detaildialog

- Artwork und Text besitzen getrennte, responsive Bereiche und überdecken sich nicht mehr.
- Auf Smartphones wird das Artwork oberhalb des Textes angeordnet; auf Desktop stehen beide Bereiche sauber nebeneinander.
- Der Dialog scrollt intern, während der Schließen-Button jederzeit erreichbar bleibt.
- Gesperrte und freigeschaltete Zustände, Fortschritt und Teilen-Funktion bleiben unverändert erhalten.
- Automatischer Layouttest für alle 16 Sticker in beiden Zuständen und fünf Bildschirmgrößen ergänzt.

### Enthaltenes Raster-Artwork für alle 16 Sticker

- **6 Meilenstein-Medaillen:** hochwertige Sammlermedaillen mit Gold-, Bronze- und Silbermaterialien, Glasemaille, Prägung, Licht und räumlicher Tiefe.
- **10 Themen-Sticker:** eigenständige motivbezogene Artwork-Illustrationen für Schloss, Wald, Licht, Genuss, Cozy, Bahn, Städte, Premiere, Wochenende und Nacht.
- Für jeden Sticker existieren sechs echte WebP-Bilddateien: **gesperrt, neu, klein, groß, Standard und Teilen**.
- Insgesamt sind **96 WebP-Dateien** vollständig in Album, Tagebuch, Detailansichten, Freischaltanimationen und Teilen-Grafiken eingebunden.
- Die 96 früheren Sticker-SVG-Dateien und alle produktiven Referenzen darauf wurden entfernt.

### Zustände und Darstellung

- Gesperrte Sticker besitzen eine gedämpfte Rastervariante mit integriertem Schloss.
- Neue Sticker verwenden eine aufgehellte Artwork-Variante mit Lichtfunken.
- Kleine, große und hochauflösende Teilen-Dateien werden passend zum jeweiligen Einsatz geladen.
- Fortschrittsanzeigen, individuelle Freischalteffekte und „Bewegungen reduzieren“ bleiben erhalten.

## Beibehaltene Funktionen und Daten

- 39 Weihnachtsmärkte und sechsstufiger Planungs-Assistent
- Hin- und Rückfahrten über Transitous
- Album, Fortschritt, Wintertagebuch und Teilen-Grafiken
- lokale Speicherung im vorhandenen Bereich `wtwm:v2:`
- vollständige Sicherung und Wiederherstellung
- ICS-Export
- installierbare Offline-PWA
- relative Pfade für GitHub Pages im Repository-Unterordner
- kompakte mobile und Desktop-Darstellung

## GitHub Pages

1. Den **Inhalt dieses Ordners** in die oberste Ebene des Repositorys laden.
2. **Settings → Pages** öffnen.
3. **Deploy from a branch**, Branch **main**, Ordner **/(root)** wählen.
4. Nach dem Deployment einmal online neu laden, damit der Service Worker V4.0.1 und der neue Artwork-Cache aktiv werden.

## Tests

```bash
node tests/smoke.mjs
python3 tests/e2e_github_pages.py
python3 tests/sticker_dialog_responsive.py
python3 tests/live_transitous.py   # optional, benötigt direkten Internetzugriff
```

Geprüft werden unter anderem: Datenintegrität, 16 Motive, 96 valide WebP-Varianten, Entfernung alter Sticker-SVGs, Bildpfade, Cache-Abdeckung, Sperr-/Neu-Zustände, Freischaltanimationen, Teilen, Album, Tagebuch, Persistenz, Sicherung/Wiederherstellung, ICS, Offline-Start und GitHub-Pages-Unterpfad. Der zusätzliche Dialogtest öffnet alle 16 Sticker gesperrt und freigeschaltet in fünf mobilen und Desktop-Bildschirmgrößen und prüft Trennung, Lesbarkeit, Fortschritt, Teilen-Hinweis, Scrollen und Schließen.
