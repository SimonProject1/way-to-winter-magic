import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const requiredFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'sw.js',
  'data/markets.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];
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
for (const id of ['marketSearch', 'cityFilter', 'travelFilter', 'distanceFilter', 'featureFilter', 'dateFilter', 'timelineBody', 'tripMarket', 'peopleList', 'stopResults', 'marketList', 'cardViewBtn', 'listViewBtn']) {
  assert.ok(html.includes(`id="${id}"`), `UI-Element fehlt: ${id}`);
}
assert.ok(html.includes('<title>Way to Winter Magic</title>'), 'Browser-Titel fehlt');
assert.ok(html.includes('V2.1.0'), 'Versionshinweis fehlt');
assert.ok(html.includes('icons/apple-touch-icon.png'), 'Apple-Touch-Icon fehlt');
assert.ok(html.includes('class="panel compact-section"'), 'Aufklappbare kompakte Bereiche fehlen');

const manifest = JSON.parse(fs.readFileSync(new URL('manifest.webmanifest', root), 'utf8'));
assert.equal(manifest.name, 'Way to Winter Magic');
assert.equal(manifest.short_name, 'WtWM');
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'), 'Maskable-Icon fehlt');

function pngSize(relativePath) {
  const buffer = fs.readFileSync(new URL(relativePath, root));
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG', `${relativePath} ist keine PNG-Datei`);
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}
assert.deepEqual(pngSize('icons/icon-192.png'), [192, 192]);
assert.deepEqual(pngSize('icons/icon-512.png'), [512, 512]);
assert.deepEqual(pngSize('icons/icon-maskable-512.png'), [512, 512]);
assert.deepEqual(pngSize('icons/apple-touch-icon.png'), [180, 180]);

const sw = fs.readFileSync(new URL('sw.js', root), 'utf8');
for (const file of requiredFiles) {
  if (file === 'sw.js') continue;
  assert.ok(sw.includes(file), `Offline-Cache enthält ${file} nicht`);
}
assert.ok(sw.includes("url.hostname.endsWith('transport.rest')"), 'DB-API muss vom Cache ausgeschlossen sein');
assert.ok(sw.includes("event.request.mode === 'navigate'"), 'Offline-Navigation-Fallback fehlt');
assert.ok(sw.includes("wtwm-v2.1.0"), 'WtWM-Cachekennung fehlt');

const brandedFiles = ['index.html', 'manifest.webmanifest', 'README.md', 'app.js', 'sw.js'];
const retiredBrandTerms = ['Cozy Weihnachtsmarkt-Tripplaner', 'Cozy Christmas Trips', 'Cozy Trips', 'cozy-trips'];
for (const file of brandedFiles) {
  const content = fs.readFileSync(new URL(file, root), 'utf8');
  for (const term of retiredBrandTerms) assert.equal(content.includes(term), false, `Alte Markenreferenz in ${file}: ${term}`);
}

const store = new Map();
store.set('people', JSON.stringify(['Alex', 'Alex']));
globalThis.localStorage = {
  getItem: key => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, value),
  removeItem: key => store.delete(key)
};
const require = createRequire(import.meta.url);
const logic = require(fileURLToPath(new URL('../app.js', import.meta.url)));
assert.ok(store.has('wtwm:people'), 'Altdaten wurden nicht in den WtWM-Speicher übernommen');
assert.ok(['people', 'availability', 'favorites', 'trips', 'stop', 'marketFilters'].every(key => store.has(`wtwm:${key}`)), 'WtWM-Speicherbereich ist unvollständig');

for (const iso of ['2026-03-29', '2026-10-25', '2026-12-24']) {
  assert.equal(logic.isoLocal(logic.parseDate(iso)), iso, `Lokales Datum verschoben: ${iso}`);
}
for (const invalid of ['2026-02-30', '2026-13-01', '2026-00-10', 'kein-datum']) {
  assert.equal(logic.parseDate(invalid), null, `Ungültiges Datum akzeptiert: ${invalid}`);
}
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
const importedDuplicateIds = logic.migratePeople([{ id: 'gleich', name: 'A' }, { id: 'gleich', name: 'B' }]);
assert.notEqual(importedDuplicateIds[0].id, importedDuplicateIds[1].id, 'Importierte doppelte IDs wurden nicht repariert');
const availability = logic.migrateAvailability({ '2026-12-01|Alex': 'Ja' }, migrated, ['Alex', 'Alex']);
assert.equal(availability[`2026-12-01|${migrated[0].id}`], 'Ja');

const ics = logic.makeIcs({
  date: '2026-12-05',
  start: '14:00',
  end: '20:00',
  market: 'Test, Markt',
  location: 'Ort; Platz',
  activity: 'Museum',
  budget: 45,
  stop: 'Hbf',
  notes: 'Zeile 1\nZeile 2 – Glühwein 🎄 '.repeat(8)
});
assert.ok(ics.includes('PRODID:-//Way to Winter Magic V2.1.0//DE'));
assert.ok(ics.includes('DTSTART;TZID=Europe/Berlin:20261205T140000'));
assert.ok(ics.includes('SUMMARY:Weihnachtsmarkt: Test\\, Markt'));
assert.ok(ics.includes('LOCATION:Ort\\; Platz'));
assert.ok(ics.includes('Zeile 1\\nZeile 2'));
assert.ok(ics.split('\r\n').every(line => Buffer.byteLength(line, 'utf8') <= 75), 'ICS-Zeilen überschreiten 75 UTF-8-Bytes');
assert.ok(ics.split('\r\n').some(line => line.startsWith(' ')), 'Lange ICS-Zeilen wurden nicht gefaltet');

console.log(`Smoke-/Logiktests bestanden: ${markets.length} Märkte, ${markets.filter(market => market.new).length} neu, Branding WtWM.`);
