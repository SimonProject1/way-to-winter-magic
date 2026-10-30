# Way to Winter Magic V5.0.0

Installierbare GitHub-Pages-PWA für 39 Weihnachtsmärkte ab Wuppertal.

## Neu in V5.0.0

- Hauptnavigation auf **Start, Märkte, Trip planen, Zauber und Mehr** reduziert
- **Trip planen** auf Smartphones mittig und hervorgehoben
- Timeline und Bahn vollständig als optionale Werkzeuge unter **Mehr** erhalten
- neuer responsiver Winterweg-Hero für Desktop, Tablet und Smartphone
- fünf Artwork-Navigationssymbole und zentrale Artwork-Aktion „Trip planen“
- sechs Artwork-Kopfbilder im Planungs-Assistenten
- sieben wiederverwendbare Markt-Artwork-Kategorien
- visuelle Startseite mit nächstem Trip, Empfehlung und Winterfortschritt
- 41 optimierte responsive WebP-Artwork-Dateien unter `assets/artwork/`
- vollständiger Offline-Cache für alle 137 Dateien unter `assets/`

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
3. Nach dem Deployment einmal online neu laden, damit der Cache `way-to-winter-magic-v5.0.0` aktiviert wird.

## Tests

```bash
node tests/smoke.mjs
python3 tests/e2e_github_pages.py
python3 tests/sticker_dialog_responsive.py
python3 tests/live_transitous.py   # optional, benötigt direkten Internetzugriff
```

Die E2E-Prüfung deckt Smartphone, Desktop, Offline-Start, lokale Persistenz, GitHub-Pages-Unterpfad, Planungsablauf, Transitous-Antwortverarbeitung, Tagebuch, Sticker, Sicherung und ICS ab.
