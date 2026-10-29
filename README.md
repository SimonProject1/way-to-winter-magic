# Way to Winter Magic V4.0.2

Installierbare GitHub-Pages-App für 39 Weihnachtsmärkte ab Wuppertal.

## Funktionen

- Weihnachtsmärkte suchen, filtern und vergleichen
- Verfügbarkeiten gemeinsam planen
- Trip-Assistent mit Budget, Hin- und Rückfahrt
- Verbindungssuche über Transitous und DB-Navigator-Links
- 16 sammelbare Sticker mit Fortschritt, Freischaltdatum und zugehörigen Besuchen
- Wintertagebuch, Teilen-Funktion, ICS-Export und Datensicherung
- lokale Speicherung und Offline-Start

## Stickerdateien

- 96 echte WebP-Dateien in `assets/stickers/`
- sechs WebP-Varianten je Sticker
- keine Sticker-SVG-Dateien und keine produktiven Sticker-SVG-Referenzen

## GitHub Pages

1. Den Inhalt dieses Ordners in die oberste Ebene des Repositorys laden.
2. Unter **Settings → Pages** „Deploy from a branch“, Branch **main**, Ordner **/(root)** wählen.
3. Nach dem Deployment einmal online neu laden, damit der Cache der V4.0.2 aktiv wird.

## Tests

```bash
node tests/smoke.mjs
python3 tests/e2e_github_pages.py
python3 tests/sticker_dialog_responsive.py
python3 tests/live_transitous.py   # optional, benötigt Internetzugriff
```
