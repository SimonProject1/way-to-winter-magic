import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const requiredFiles = ['index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'sw.js', 'data/markets.json', 'icons/icon-192.png', 'icons/icon-512.png'];
for (const file of requiredFiles) assert.ok(fs.existsSync(new URL(file, root)), `Fehlende Datei: ${file}`);

const markets = JSON.parse(fs.readFileSync(new URL('data/markets.json', root), 'utf8'));
assert.equal(markets.length, 39, 'V2 muss 39 Märkte enthalten');
assert.equal(markets.filter(market => market.new).length, 30, 'V2 muss genau 30 neue Märkte enthalten');
assert.equal(new Set(markets.map(market => market.id)).size, markets.length, 'Markt-IDs müssen eindeutig sein');

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
for (const market of markets) {
  assert.ok(market.id && market.name && market.city && market.location, `Pflichtfelder fehlen: ${market.id}`);
  assert.ok(Number.isFinite(market.travel) && market.travel > 0, `Fahrzeit ungültig: ${market.id}`);
  assert.ok(Number.isFinite(market.distanceKm) && market.distanceKm >= 0, `Distanz ungültig: ${market.id}`);
  assert.ok(Array.isArray(market.budget) && market.budget.length === 3 && market.budget.every(Number.isFinite), `Budget ungültig: ${market.id}`);
  assert.ok(Array.isArray(market.tags), `Tags fehlen: ${market.id}`);
  assert.match(market.verifiedAt, datePattern, `Prüfdatum ungültig: ${market.id}`);
  if (market.dates) {
    assert.ok(market.dates.length > 0, `Leere Terminliste: ${market.id}`);
    assert.deepEqual([...market.dates].sort(), market.dates, `Termine nicht sortiert: ${market.id}`);
    assert.equal(new Set(market.dates).size, market.dates.length, `Doppelte Termine: ${market.id}`);
    market.dates.forEach(date => assert.match(date, datePattern, `Termin ungültig: ${market.id}`));
  } else {
    assert.match(market.from, datePattern, `Start fehlt: ${market.id}`);
    assert.match(market.to, datePattern, `Ende fehlt: ${market.id}`);
    assert.ok(market.from <= market.to, `Zeitraum vertauscht: ${market.id}`);
  }
  if (market.new) {
    assert.ok(market.travel <= 180, `Neues Ziel über 3 Stunden: ${market.id}`);
    assert.ok(market.sourceUrl?.startsWith('https://'), `Quelle fehlt: ${market.id}`);
    assert.equal(market.verifiedAt, '2026-10-28', `Neues Ziel nicht aktuell geprüft: ${market.id}`);
  }
}

const html = fs.readFileSync(new URL('index.html', root), 'utf8');
for (const id of ['marketSearch', 'cityFilter', 'travelFilter', 'distanceFilter', 'featureFilter', 'dateFilter', 'timelineBody', 'peopleList', 'stopResults', 'cardView', 'listView', 'connectionFrom', 'connectionTo', 'connectionMarket', 'connectionDate', 'connectionTime', 'connectionMode', 'searchConnections', 'connectionResults', 'savedConnections', 'clearSavedConnections', 'plannerPersonCount', 'plannerDate', 'plannerAvailability', 'plannerMarkets', 'plannerMarketSearch', 'plannerCityFilter', 'plannerTravelFilter', 'plannerFeatureFilter', 'plannerSortFilter', 'resetPlannerFilters', 'plannerSelectedMarket', 'plannerFilterSummary', 'plannerArrival', 'plannerReturnEnabled', 'plannerBudgetLevel', 'plannerOutbound', 'plannerReturn', 'plannerSummary', 'savePlannedTrip']) {
  assert.ok(html.includes(`id="${id}"`), `UI-Element fehlt: ${id}`);
}
assert.ok(html.includes('V2.6.0'), 'Versionshinweis fehlt');
assert.ok(html.includes('Transitous'), 'Transitous-Hinweis fehlt');
assert.ok(html.includes('Way to Winter Magic'), 'App-Name fehlt');

const manifest = JSON.parse(fs.readFileSync(new URL('manifest.webmanifest', root), 'utf8'));
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.icons.length, 2);

const sw = fs.readFileSync(new URL('sw.js', root), 'utf8');
for (const file of requiredFiles.filter(file => !file.startsWith('tests/'))) {
  if (file === 'sw.js') continue;
  assert.ok(sw.includes(file), `Offline-Cache enthält ${file} nicht`);
}
assert.ok(sw.includes("url.hostname === 'api.transitous.org'"), 'Transitous-API muss vom Cache ausgeschlossen sein');
assert.ok(!sw.includes('bahn.guru') && !sw.includes('transport.rest'), 'Alte Bahn-API ist noch im Service Worker enthalten');
assert.ok(sw.includes("event.request.mode === 'navigate'"), 'Offline-Navigation-Fallback fehlt');

const appSource = fs.readFileSync(new URL('app.js', root), 'utf8');
assert.ok(appSource.includes("const STORAGE_PREFIX = 'wtwm:v2:'"), 'Eigener Speicherbereich fehlt');
assert.ok(appSource.includes("const VERSION = '2.6.0'"), 'JS-Version ist nicht aktuell');
assert.ok(appSource.includes("state.tripDraft.marketId = selected ? '' : marketId"), 'Marktauswahl kann nicht wieder aufgehoben werden');
assert.ok(appSource.includes("S.set('plannerMarketFilters', state.plannerFilters)"), 'Planerfilter werden nicht lokal gespeichert');
assert.ok(appSource.includes("const API = 'https://api.transitous.org/api'"), 'Transitous-Endpunkt fehlt');
assert.ok(!appSource.includes('bahn.guru') && !appSource.includes('transport.rest'), 'Alte Bahn-API ist noch enthalten');
const plannerCardSource = appSource.slice(appSource.indexOf('function plannerMarketCard'), appSource.indexOf('function togglePlannerMarket'));
for (const label of ['Deine Bewertung', 'Fahrzeit', 'Ticket für den Weihnachtsmarkt', 'data-detail']) assert.ok(plannerCardSource.includes(label), `Kompaktkarte fehlt: ${label}`);
for (const removed of ['market.city', 'market.location', 'marketOpeningHours', 'market.entry', 'planner-ratings']) assert.ok(!plannerCardSource.includes(removed), `Kompaktkarte enthält noch Detail: ${removed}`);
for (const detail of ['Öffnungszeiten', 'Eintritt', 'Ticket für den Weihnachtsmarkt']) assert.ok(appSource.includes(detail), `Detaildialog fehlt: ${detail}`);

const store = new Map();
globalThis.localStorage = {
  getItem: key => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, value),
  removeItem: key => store.delete(key)
};
const require = createRequire(import.meta.url);
const logic = require(fileURLToPath(new URL('../app.js', import.meta.url)));

for (const iso of ['2026-03-29', '2026-10-25', '2026-12-24']) {
  assert.equal(logic.isoLocal(logic.parseDate(iso)), iso, `Lokales Datum verschoben: ${iso}`);
}
assert.equal(logic.parseDate('2026-02-30'), null, 'Unmögliches Datum wurde akzeptiert');
assert.equal(logic.dateRange('2026-12-01', '2026-12-03').length, 3);
assert.equal(logic.dateRange('2026-12-03', '2026-12-01').length, 0);

const muelheim = markets.find(market => market.id === 'muelheim-altstadt');
assert.equal(logic.openOn(muelheim, logic.parseDate('2026-11-30')), false, 'Mülheim darf montags nicht offen sein');
assert.equal(logic.openOn(muelheim, logic.parseDate('2026-12-01')), true, 'Mülheim muss dienstags offen sein');
const remscheid = markets.find(market => market.id === 'remscheid');
assert.equal(logic.openOn(remscheid, logic.parseDate('2026-11-22')), false, 'Geschlossener Sondertag wird ignoriert');
const ohligs = markets.find(market => market.id === 'ohligs');
assert.equal(logic.openOn(ohligs, logic.parseDate('2026-12-04')), true);
assert.equal(logic.openOn(ohligs, logic.parseDate('2026-12-07')), false);

const migrated = logic.migratePeople(['Alex', 'Alex']);
assert.equal(migrated.length, 2);
assert.notEqual(migrated[0].id, migrated[1].id, 'Personen-IDs müssen eindeutig sein');
const availability = logic.migrateAvailability({ '2026-12-01|Alex': 'Ja' }, migrated, ['Alex', 'Alex']);
assert.equal(availability[`2026-12-01|${migrated[0].id}`], 'Ja');
const repaired = logic.migratePeople([{ id: 'gleich', name: 'A' }, { id: 'gleich', name: 'B' }]);
assert.notEqual(repaired[0].id, repaired[1].id, 'Doppelte importierte Personen-IDs wurden nicht repariert');

const ics = logic.makeIcs({ date: '2026-12-05', start: '14:00', end: '20:00', market: 'Test, Markt', location: 'Ort; Platz', activity: 'Museum', budget: 45, stop: 'Hbf', notes: 'Zeile 1\nZeile 2', people: [{ name: 'Alex', status: 'Ja' }], openingHours: '12:00–21:00', entry: 'Kostenlos', ticketRequirement: 'Keine Ticketpflicht', ticketStatus: 'Nicht nötig' });
assert.ok(ics.includes('DTSTART;TZID=Europe/Berlin:20261205T140000'));
assert.ok(ics.includes('SUMMARY:Weihnachtsmarkt: Test\\, Markt'));
assert.ok(ics.includes('LOCATION:Ort\\; Platz'));
assert.ok(ics.includes('Zeile 1\\nZeile 2'));
const encoder = new TextEncoder();
assert.ok(ics.split('\r\n').every(line => encoder.encode(line).length <= 75), 'ICS-Zeilen wurden nicht UTF-8-konform gefaltet');
const umlautIcs = logic.foldIcs(`DESCRIPTION:${'🎄 Grüße aus Wuppertal · '.repeat(8)}`);
assert.ok(umlautIcs.split('\r\n').every(line => encoder.encode(line).length <= 75), 'ICS-Faltung überschreitet 75 UTF-8-Bytes');

const geocodeUrl = new URL(logic.buildGeocodeUrl('Wuppertal Hbf'));
assert.equal(geocodeUrl.hostname, 'api.transitous.org');
assert.equal(geocodeUrl.pathname, '/api/v1/geocode');
assert.equal(geocodeUrl.searchParams.get('text'), 'Wuppertal Hbf');
const places = logic.normalizePlaces([{ name: 'Wuppertal Hbf', stopId: 'de:05124:01133', lat: 51.254, lon: 7.15 }]);
assert.deepEqual(places[0], { id: 'de:05124:01133', name: 'Wuppertal Hbf', detail: '', latitude: 51.254, longitude: 7.15 });

const journeyUrl = new URL(logic.buildJourneyUrl('de:05124:01133', 'de:05113:8000080', '2026-12-05', '14:30', 'departure'));
assert.equal(journeyUrl.hostname, 'api.transitous.org');
assert.equal(journeyUrl.pathname, '/api/v6/plan');
assert.equal(journeyUrl.searchParams.get('fromPlace'), 'de:05124:01133');
assert.equal(journeyUrl.searchParams.get('toPlace'), 'de:05113:8000080');
assert.equal(journeyUrl.searchParams.get('time'), '2026-12-05T14:30:00+01:00');
assert.equal(journeyUrl.searchParams.get('arriveBy'), 'false');
const arrivalUrl = new URL(logic.buildJourneyUrl('a', 'b', '2026-12-05', '19:30', 'arrival'));
assert.equal(arrivalUrl.searchParams.get('arriveBy'), 'true');
assert.equal(logic.buildJourneyUrl('', 'de:05113:8000080', '2026-12-05', '14:30'), '', 'Ungültige Verbindungssuche wurde nicht abgelehnt');
const dbUrl = logic.buildDbNavigatorUrl({ from: 'Wuppertal Hbf', to: 'Essen Hbf', date: '2026-12-05', time: '14:30', mode: 'departure' });
assert.ok(dbUrl.startsWith('https://int.bahn.de/buchung/fahrplan/suche#'));
assert.ok(dbUrl.includes('so=Wuppertal+Hbf') && dbUrl.includes('zo=Essen+Hbf'), 'DB-Navigator-Link enthält Start/Ziel nicht');
assert.equal(logic.durationMinutes('2026-12-05T14:00:00+01:00', '2026-12-05T15:35:00+01:00'), 95);
assert.equal(logic.durationLabel(95), '1 Std. 35 Min.');
assert.equal(logic.delayMinutes('2026-12-05T14:08:00+01:00', '2026-12-05T14:00:00+01:00'), 8);

const rawTransitousJourney = { transfers: 0, startTime: '2026-12-05T14:05:00+01:00', endTime: '2026-12-05T14:45:00+01:00', legs: [
  {
    from: { name: 'Wuppertal Hbf', track: '1' }, to: { name: 'Essen Hbf' }, mode: 'RAIL', routeShortName: 'RE 49',
    scheduledStartTime: '2026-12-05T14:00:00+01:00', startTime: '2026-12-05T14:05:00+01:00',
    scheduledEndTime: '2026-12-05T14:40:00+01:00', endTime: '2026-12-05T14:45:00+01:00'
  }
] };
const normalizedJourney = logic.normalizeJourney(rawTransitousJourney);
assert.equal(normalizedJourney.transfers, 0);
assert.equal(normalizedJourney.legs[0].line, 'RE 49');
const renderedJourney = logic.journeyCard(rawTransitousJourney, 0, { from: 'Wuppertal Hbf', to: 'Essen Hbf', date: '2026-12-05', time: '14:30', mode: 'departure' });
assert.ok(renderedJourney.includes('14:05 → 14:45'), 'Verbindungszeiten werden nicht dargestellt');
assert.ok(renderedJourney.includes('Direkt'), 'Direktverbindung wird nicht erkannt');
assert.ok(renderedJourney.includes('+5 Min.'), 'Verspätung wird nicht dargestellt');
assert.ok(renderedJourney.includes('RE 49'), 'Linie wird nicht dargestellt');
assert.ok(renderedJourney.includes('Im DB Navigator öffnen'), 'DB-Navigator-Button fehlt');

const plannerJourneys = [
  { ...rawTransitousJourney, startTime: '2026-12-05T13:00:00+01:00', endTime: '2026-12-05T13:40:00+01:00' },
  { ...rawTransitousJourney, transfers: 1, startTime: '2026-12-05T13:30:00+01:00', endTime: '2026-12-05T14:20:00+01:00' },
  { ...rawTransitousJourney, transfers: 0, startTime: '2026-12-05T13:55:00+01:00', endTime: '2026-12-05T14:35:00+01:00' },
  { ...rawTransitousJourney, transfers: 2, startTime: '2026-12-05T14:00:00+01:00', endTime: '2026-12-05T14:30:00+01:00' }
].map((journey, index) => ({ ...journey, legs: [{ ...journey.legs[0], startTime: journey.startTime, endTime: journey.endTime, scheduledStartTime: journey.startTime, scheduledEndTime: journey.endTime, routeShortName: `RE ${index + 1}` }] }));
const plannerOptions = logic.selectPlannerJourneys(plannerJourneys, 'outbound', '2026-12-05T15:00:00+01:00');
assert.equal(plannerOptions.length, 3, 'Planer muss drei Verbindungsoptionen auswählen');
assert.ok(plannerOptions.some(option => option.roles.includes('Empfohlen')), 'Empfohlene Verbindung fehlt');
assert.ok(plannerOptions.some(option => option.roles.includes('Sicherheitsverbindung')), 'Sicherheitsverbindung fehlt');
assert.equal(logic.ticketRequirement({ entry: '10 Euro' }), 'Ticket erforderlich');
assert.equal(logic.ticketRequirement({ entry: 'Kostenlos' }), 'Keine Ticketpflicht');
assert.equal(logic.score(markets.find(market => market.id === 'steele')).toFixed(1), '3.8', 'Planerbewertung für Steele ist falsch');
assert.equal(logic.marketOpeningHours({}, '2026-12-05'), 'Noch nicht veröffentlicht – Marktlink prüfen');
assert.ok(ics.includes('Namen: Alex (Ja)') && ics.includes('Ticketstatus: Nicht nötig'), 'Erweiterte ICS-Angaben fehlen');

console.log(`V2.6.0 Smoke-/Logiktests bestanden: ${markets.length} Märkte, ${markets.filter(market => market.new).length} neu, Planerfilter und DB-Verbindungssuche geprüft.`);
