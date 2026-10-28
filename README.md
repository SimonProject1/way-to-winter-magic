# Way to Winter Magic V2.5.0

Installierbare GitHub-Pages-PWA mit 39 Weihnachtsmärkten und einem zentralen Planungs-Assistenten.

## Neu in V2.5.0

Der Bereich **Trip planen** führt durch sechs Schritte:

1. Personenanzahl und Namen lokal speichern
2. Datum sowie Ja / Vielleicht / Nein pro Person festlegen
3. nur die an diesem Tag geöffneten Märkte filtern, kompakt vergleichen sowie eine Marktwahl auswählen oder wieder aufheben
4. Ankunft, optionale Rückfahrt, Budgetstufe, Aktivität, Treffpunkt, Ticketstatus, Notizen und Tripstatus festlegen
5. über Transitous je drei sinnvolle Hin- und Rückfahrten anzeigen und auswählen
6. Zusammenfassung prüfen, Trip lokal speichern und `.ics` teilen

Die Marktfilter im Assistenten umfassen Suche, Stadt, maximale ÖPNV-Fahrzeit, Wunschfilter und Sortierung. Die kompakteren Marktkarten zeigen die wichtigsten Angaben; alle längeren Informationen bleiben über **Details** erreichbar.

Die Verbindungsauswahl kennzeichnet Empfehlung, wenige Umstiege, schnellste Verbindung, Sicherheitsverbindung, die letzte sinnvolle Rückfahrt innerhalb der Suche und knappe Umstiege. Ein Button prüft die Verbindung erneut.

Gespeicherte Trips lassen sich bearbeiten, erneut prüfen, löschen und als vollständige `.ics`-Datei exportieren. Die Kalenderdatei enthält Markt, Namen, Adresse, Aktivität, gewählte Verbindungen, Treffpunkt, Budget, Eintritt, Ticketinformationen, Notizen, Marktlink und DB-Navigator-Links.

Die bisherigen Bereiche **Märkte**, **Timeline**, **Bahn** und **Mehr** bleiben erhalten. Erfolgreiche Suchen in der eigenständigen Bahn-Recherche werden weiterhin lokal für die Offline-Anzeige gespeichert.

## GitHub Pages

1. Den **Inhalt** dieses Ordners in die oberste Ebene des Repositorys hochladen.
2. **Settings → Pages** öffnen.
3. **Deploy from a branch**, Branch **main**, Ordner **/(root)** wählen.
4. Die Seite nach dem Deployment einmal online neu laden, damit der Service Worker V2.5.0 übernimmt.

Alle App-Pfade sind relativ und funktionieren auch in einem GitHub-Pages-Unterordner.

## Tests

```bash
node tests/smoke.mjs
python3 tests/e2e_github_pages.py
python3 tests/live_transitous.py   # optional, benötigt direkten Internetzugriff
```

Der E2E-Test verwendet einen GitHub-Pages-typischen Unterpfad und ein Smartphone-Viewport. Er prüft den kompletten Sechs-Schritt-Ablauf, Marktfilter, Marktabwahl, drei Hin- und Rückfahrtoptionen, Sicherheits- und Rückfahrtkennzeichnung, Umstiegswarnung, Zusammenfassung, lokale Speicherung, Bearbeitung, `.ics`, Persistenz und die bestehenden Recherchebereiche. Zusätzlich wird das Desktop-Layout geprüft.

## Datenschutz und Datenhinweise

Personen, Verfügbarkeiten, Trips und gespeicherte Verbindungen bleiben im lokalen Browser-Speicher. Nur Haltestellen- und Verbindungssuchen werden an Transitous übertragen. Fahrplandaten: [Transitous-Quellen](https://transitous.org/sources/). Ortsdaten: [© OpenStreetMap-Mitwirkende](https://www.openstreetmap.org/copyright).

Bei Märkten ohne veröffentlichte Uhrzeit zeigt der Assistent ausdrücklich **„Noch nicht veröffentlicht – Marktlink prüfen“**. Markt- und Fahrplandaten bitte kurz vor der Abfahrt erneut prüfen.
