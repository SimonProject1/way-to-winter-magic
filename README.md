# Way to Winter Magic V3.1.0

Installierbare GitHub-Pages-PWA mit 39 Weihnachtsmärkten, Reiseplanung, Transitous-Verbindungssuche, Winterzauber-Album und lokalem Wintertagebuch.

## Neu in V3.1.0

### Winterzauber-Album

Das Album ist in vier Bereiche gegliedert und zeigt für jeden Sticker einen Fortschrittsring, den aktuellen Fortschrittswert und – nach dem Freischalten – das Freischaltdatum:

1. **Magische Meilensteine**
2. **Zauberwelten**
3. **Reiseabenteuer**
4. **Saisonmomente**

Alle 16 Motive wurden vollständig nach den individuellen Motivvorgaben neu gezeichnet. Jede leicht gewölbte Sammelmedaille verwendet transparente Außenflächen, zwei räumliche Metallrahmen, tiefes Dunkelgrün, Warmgold, Cremeweiß, dezentes Weihnachtsrot, geprägten Schnee, Materialreflexe und ein geschwungenes Namensband.

Pro Sticker liegen sechs eigenständige SVG-Grafikdateien vor: **freigeschaltet, gesperrt, neu, klein, groß und hochauflösend zum Teilen** – insgesamt 96 Dateien. Album, Tagebuch, Detailansichten, Freischaltmomente und PNG-Teilen nutzen automatisch die passende Variante. Gesperrte Medaillen besitzen dunkle Motivsilhouetten, matte Metallrahmen, ein Schloss und einen sichtbar anwachsenden Goldring.

Die 16 Freischaltanimationen sind an das jeweilige Motiv gekoppelt: unter anderem fünf Schneekugeln, zehn Wegpunkte, zwanzig Silbersterne, dreißig Laternenlichter, 39 Meistersterne, ein einfahrender Regionalzug, öffnende Samtvorhänge und Lichtspiegelungen auf nassem Pflaster. Der reduzierte Bewegungsmodus bleibt vollständig unterstützt.

| Sticker | Fortschrittsziel |
|---|---:|
| Der erste Zauber | 1 besuchter Markt |
| Fünf magische Momente | 5 besuchte Märkte |
| Winterwanderer Bronze | 10 unterschiedliche besuchte Märkte |
| Winterwanderer Silber | 20 unterschiedliche besuchte Märkte |
| Winterwanderer Gold | 30 unterschiedliche besuchte Märkte |
| Winter-Magic-Meister | alle 39 unterschiedlichen Märkte |
| Schlosszauber | 1 Schlossmarkt |
| Waldweihnacht | 1 Naturmarkt |
| Lichterjäger | 3 Lichtermärkte |
| Genussreise | 3 Genussmärkte |
| Cozy Collector | 5 besonders gemütliche Märkte |
| Deutschlandticket-Profi | 3 besuchte Trips mit gespeicherter Bahnverbindung |
| Städtesammler | 5 verschiedene Städte |
| Premierenabend | 1 Besuch am Eröffnungstag |
| Winterwochenende | 3 Wochenendbesuche |
| Night Magic | 1 im Tagebuch festgehaltener Abendmoment |

Jede Definition enthält eigenes Motiv, Farben, Material, Band, Rahmen und einen individuellen Freischalteffekt. Die Detailansicht dokumentiert diese Merkmale direkt in der App.

### Abschlussdialog und Wintertagebuch

Sobald ein gespeicherter Trip erstmals als **Besucht** markiert wird, öffnet sich der Abschlussdialog. Er speichert:

- Besuchsdatum und Bewertung
- Wetter
- Lieblingsgenuss
- schönsten Moment
- Souvenir oder Entdeckung
- Night-Magic-Kennzeichnung

Der Eintrag ist mit dem besuchten Trip und dem zugehörigen Markt verbunden. Er kann im Wintertagebuch bearbeitet oder separat gelöscht werden. Das Löschen eines Tagebucheintrags löscht den Trip nicht.

### Freischaltanimationen

Jede Medaille besitzt einen eigenen Effektstil. Die App beachtet automatisch `prefers-reduced-motion`. Zusätzlich kann unter **Mehr → Daten & Hinweise** ein dauerhaft lokal gespeicherter reduzierter Bewegungsmodus aktiviert werden.

### Datenschutz, Offline und Sicherungen

Trips, Personen, Verfügbarkeiten, Favoriten, Tagebuch, Stickerfortschritt, Freischaltdaten und Einstellungen bleiben im lokalen Browser-Speicher. Export und Import enthalten auch die neuen V3-Daten. Der Service Worker hält App, Album, Tagebuch, Marktdaten und Gestaltung offline bereit. Nur aktive Haltestellen- und Verbindungssuchen werden an Transitous übertragen.

## Bestehende Funktionen

- 39 geprüfte Weihnachtsmärkte
- kompakte Markt- und Planeransichten
- Timeline mit Personenverfügbarkeit
- sechsstufiger Trip-Assistent
- Hin- und Rückfahrten über Transitous
- gespeicherte Verbindungen für die Offline-Anzeige
- lokale Trips, Bearbeitung, Status und `.ics`-Export
- vollständige Datensicherung und Wiederherstellung
- installierbare Offline-PWA

## GitHub Pages

1. Den **Inhalt dieses Ordners** in die oberste Ebene des Repositorys laden.
2. **Settings → Pages** öffnen.
3. **Deploy from a branch**, Branch **main**, Ordner **/(root)** wählen.
4. Nach dem Deployment einmal online neu laden, damit der Service Worker V3.1.0 übernimmt.

Alle Pfade sind relativ und funktionieren auch in einem GitHub-Pages-Unterordner.

## Tests

```bash
node tests/smoke.mjs
python3 tests/e2e_github_pages.py
python3 tests/live_transitous.py   # optional; benötigt direkten Internetzugriff
```

Die Tests prüfen Datenbestand, alle 96 Stickerdateien, Fortschrittslogik, motivbezogene Freischalteffekte, Abschlussdialog, Album, Tagebuch, hochauflösendes Teilen, lokale Persistenz, Sicherung/Wiederherstellung, mobile und Desktop-Darstellung, GitHub-Pages-Unterpfad, Offline-Start, Planungsablauf, Bahnoptionen und `.ics`-Export.
