# Way to Winter Magic V5.1.0

Installierbare GitHub-Pages-PWA für 39 Weihnachtsmärkte ab Wuppertal.

## Neu in V5.1.0

- kompakter Winterweg-Hero: 300–360 px auf Desktop und 250–290 px auf Smartphones
- App-Name, kurzer Untertitel und direkte Aktion **Trip planen** im Hero
- einheitliche Rundung, feine Goldkontur und dezenter Schatten für Hero und Artworks
- fünf gleichmäßig verteilte Navigationsziele ohne Desktop-Scrollleiste
- Navigations-Artworks mit 62 px auf Desktop und 40–42 px auf Smartphones
- mittig hervorgehobenes **Trip planen** in der mobilen unteren Navigation
- kleinere, auf Smartphones horizontal aufgebaute Startseiten-Aktion
- responsive Zuschnitts- und Überlaufprüfungen für 320 bis 1440 px Breite

## Unverändert enthalten

- 39 Märkte
- Planungs-Assistent mit Verfügbarkeiten, Budget, Hin- und Rückfahrt
- Transitous-Verbindungssuche und DB-Navigator-Links
- lokale Speicherung, Sicherung und Wiederherstellung
- ICS-Export
- Wintertagebuch
- Stickeralbum mit 16 Stickern und 96 vorhandenen WebP-Dateien
- Offline-PWA und GitHub-Pages-Unterpfade

## GitHub Pages

1. Den **Inhalt dieses Ordners** in die oberste Ebene des Repositorys laden.
2. Unter **Settings → Pages** „Deploy from a branch“, Branch **main**, Ordner **/(root)** wählen.
3. Nach dem Deployment einmal online neu laden, damit der Cache `way-to-winter-magic-v5.1.0` aktiviert wird.

## Tests

```bash
node tests/smoke.mjs
python3 tests/e2e_github_pages.py
python3 tests/artwork_layout_responsive.py
python3 tests/sticker_dialog_responsive.py
python3 tests/live_transitous.py   # optional, benötigt direkten Internetzugriff
```

Die E2E-Prüfung deckt Smartphone, Desktop, Offline-Start, lokale Persistenz, GitHub-Pages-Unterpfad, Planungsablauf, Transitous-Antwortverarbeitung, Tagebuch, Sticker, Sicherung und ICS ab.
