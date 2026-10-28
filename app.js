const VERSION = '2.1.0';
const APP_NAME = 'Way to Winter Magic';
const API = 'https://v6.db.transport.rest';
const APP_KEYS = ['people', 'availability', 'favorites', 'trips', 'stop', 'marketFilters'];
const STORAGE_PREFIX = 'wtwm:';
const DEFAULT_PEOPLE = [
  { id: 'p1', name: 'Person 1' },
  { id: 'p2', name: 'Person 2' }
];

const S = {
  get(key, fallback) {
    try {
      const current = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      const raw = current === null ? localStorage.getItem(key) : current;
      const value = JSON.parse(raw);
      return value ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value)); } catch { /* private mode/quota */ }
  }
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const pad = value => String(value).padStart(2, '0');
const uid = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const shorten = (value, max = 96) => {
  const text = String(value ?? '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
};

let markets = [];
let installPrompt = null;
let stopController = null;

function parseDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return null;
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function isoLocal(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateRange(fromIso, toIso) {
  const from = parseDate(fromIso);
  const to = parseDate(toIso);
  if (!from || !to || from > to) return [];
  const out = [];
  for (const date = new Date(from); date <= to; date.setDate(date.getDate() + 1)) out.push(new Date(date));
  return out;
}

function marketBounds() {
  const all = markets.flatMap(market => market.dates?.length ? market.dates : [market.from, market.to]).filter(Boolean).sort();
  return { from: all[0] || '2026-10-30', to: all.at(-1) || '2027-01-10' };
}

function migratePeople(raw) {
  if (!Array.isArray(raw) || !raw.length) return structuredClone(DEFAULT_PEOPLE);
  const usedIds = new Set();
  return raw.map((person, index) => {
    const name = typeof person === 'string' ? person.trim() : String(person?.name || '').trim();
    const baseId = typeof person === 'string' ? `p${index + 1}` : String(person?.id || `p${index + 1}`);
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);
    return { id, name: name || `Person ${index + 1}` };
  });
}

function migrateAvailability(raw, people, legacyPeople) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!['Ja', 'Vielleicht', 'Nein', ''].includes(value)) continue;
    const splitAt = key.indexOf('|');
    if (splitAt < 0) continue;
    const date = key.slice(0, splitAt);
    const oldPerson = key.slice(splitAt + 1);
    const direct = people.find(person => person.id === oldPerson);
    const legacyIndex = Array.isArray(legacyPeople) ? legacyPeople.findIndex(person => String(person) === oldPerson) : -1;
    const person = direct || people[legacyIndex];
    if (person && parseDate(date)) out[`${date}|${person.id}`] = value;
  }
  return out;
}

const legacyPeople = S.get('people', DEFAULT_PEOPLE);
const people = migratePeople(legacyPeople);
const state = {
  people,
  availability: migrateAvailability(S.get('availability', {}), people, legacyPeople),
  favorites: Array.isArray(S.get('favorites', [])) ? S.get('favorites', []).map(String) : [],
  trips: Array.isArray(S.get('trips', [])) ? S.get('trips', []) : [],
  stop: S.get('stop', null),
  filters: S.get('marketFilters', {}) || {}
};

function saveAll() {
  S.set('people', state.people);
  S.set('availability', state.availability);
  S.set('favorites', state.favorites);
  S.set('trips', state.trips);
  S.set('stop', state.stop);
  S.set('marketFilters', state.filters);
}

// Übernimmt beim ersten Start vorhandene Daten der bisherigen V2.0.0
// automatisch in den eigenen WtWM-Speicherbereich.
saveAll();

function openOn(market, date) {
  const iso = isoLocal(date);
  if (market.dates) return market.dates.includes(iso);
  if (!market.from || !market.to || iso < market.from || iso > market.to) return false;
  if (market.closed?.includes(iso)) return false;
  return !market.weekdays || market.weekdays.includes(date.getDay());
}

function firstDate(market) {
  return market.dates?.[0] || market.from || '9999-12-31';
}

function lastDate(market) {
  return market.dates?.at(-1) || market.to || firstDate(market);
}

function formatDate(iso, options = { day: '2-digit', month: '2-digit', year: 'numeric' }) {
  const date = parseDate(iso);
  return date ? date.toLocaleDateString('de-DE', options) : '–';
}

function formatMarketDates(market) {
  if (market.dates) {
    if (market.dates.length <= 4) return market.dates.map(date => formatDate(date, { day: '2-digit', month: '2-digit' })).join(', ');
    return `${formatDate(market.dates[0], { day: '2-digit', month: '2-digit' })}–${formatDate(market.dates.at(-1), { day: '2-digit', month: '2-digit' })} · ${market.dates.length} Tage`;
  }
  return `${formatDate(market.from, { day: '2-digit', month: '2-digit' })}–${formatDate(market.to, { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

function stars(value) {
  const full = '★'.repeat(Math.min(value, 5));
  const extra = value > 5 ? '✦' : '';
  const empty = '☆'.repeat(Math.max(0, 5 - value));
  return `<span class="stars" aria-label="${value} von 5">${full}${extra}${empty}</span>`;
}

function score(market) {
  return market.light * 0.35 + market.food * 0.2 + market.cozy * 0.3 + market.special * 0.15;
}

function marketCard(market) {
  const favorite = state.favorites.includes(market.id);
  return `<article class="card market-card">
    <button class="fav ${favorite ? 'on' : ''}" data-fav="${esc(market.id)}" aria-label="${favorite ? 'Favorit entfernen' : 'Als Favorit speichern'}">♥</button>
    <div class="market-card-main">
      <div class="card-head">${market.new ? '<span class="badge new">Neu</span>' : ''}<span class="badge gold">${esc(market.entry)}</span></div>
      <h3>${esc(market.name)}</h3>
      <p class="market-place" title="${esc(`${market.city} · ${market.location}`)}">${esc(market.city)} · ${esc(market.location)}</p>
    </div>
    <div class="market-card-info">
      <div class="market-meta"><span class="badge">🚆 ${market.travel} Min.</span><span class="badge">↗ ${market.distanceKm} km</span></div>
      <p class="market-date">${esc(formatMarketDates(market))}</p>
      <div class="market-rating"><span class="rating-score" aria-label="Gesamtwertung ${score(market).toFixed(1)} von 5">★ ${score(market).toFixed(1)}</span><span class="rating-parts" title="Gemütlichkeit ${market.cozy}, Licht ${market.light}, Essen ${market.food}" aria-label="Gemütlichkeit ${market.cozy}, Licht ${market.light}, Essen ${market.food}">G ${market.cozy} · L ${market.light} · E ${market.food}</span></div>
      <p class="market-review" title="${esc(market.positive)}">${esc(shorten(market.positive))}</p>
    </div>
    <div class="card-actions"><button data-detail="${esc(market.id)}">Details</button><button class="ghost" data-plan="${esc(market.id)}">Planen</button></div>
  </article>`;
}

function bindCards() {
  $$('[data-fav]').forEach(button => button.onclick = () => {
    const id = button.dataset.fav;
    state.favorites = state.favorites.includes(id) ? state.favorites.filter(value => value !== id) : [...state.favorites, id];
    saveAll();
    renderHome();
    renderMarkets();
  });
  $$('[data-detail]').forEach(button => button.onclick = () => showDetail(button.dataset.detail));
  $$('[data-plan]').forEach(button => button.onclick = () => {
    setView('trip');
    const market = markets.find(item => item.id === button.dataset.plan);
    if (!market) return;
    $('#tripDate').value = firstDate(market);
    renderTripMarketOptions(market.id);
    $('#tripBudget').value = market.budget[1];
    $('#tripMessage').textContent = `${market.name} wurde übernommen.`;
  });
}

function showDetail(id) {
  const market = markets.find(item => item.id === id);
  if (!market) return;
  const source = market.sourceUrl?.startsWith('https://')
    ? `<a class="source" href="${esc(market.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(market.sourceLabel || 'Marktquelle öffnen')} ↗</a>`
    : `<span>${esc(market.sourceLabel || 'Quelle im Bestand')}</span>`;
  $('#marketDetail').innerHTML = `
    <div class="detail-header"><p class="eyebrow dark">${market.new ? 'Neu in V2' : 'Geprüfter Bestand'}</p>
    <h2>${esc(market.name)}</h2>
    <p><strong>${esc(market.location)}</strong></p></div>
    <div class="detail-grid">
      <div class="detail-box"><strong>ÖPNV ab Wuppertal Hbf</strong>ca. ${market.travel} Minuten</div>
      <div class="detail-box"><strong>Luftlinie</strong>ca. ${market.distanceKm} km</div>
      <div class="detail-box"><strong>Termine 2026/27</strong>${esc(formatMarketDates(market))}</div>
      <div class="detail-box"><strong>Gesamtwertung</strong>${score(market).toFixed(1)} / 5</div>
    </div>
    <div class="detail-rating" aria-label="Bewertungen"><span class="badge">Gemütlichkeit ${market.cozy}</span><span class="badge">Licht ${market.light}</span><span class="badge">Essen ${market.food}</span></div>
    <div class="detail-sections">
      <details class="detail-section" open><summary>Kurzbewertung</summary><p><strong>Passt gut:</strong> ${esc(market.positive)}<br><strong>Beachten:</strong> ${esc(market.negative)}</p></details>
      <details class="detail-section"><summary>Trip-Tipp & Budget</summary><p>${esc(market.tip)}<br><strong>Budget pro Person:</strong> sparsam ${market.budget[0]} € · normal ${market.budget[1]} € · mit Aktivität ${market.budget[2]} €</p></details>
      <details class="detail-section"><summary>Quelle & Prüfstand</summary><p><strong>Quelle:</strong> ${source}<br><span class="muted">geprüft am ${formatDate(market.verifiedAt)}</span></p></details>
    </div>
    <div class="actions"><button class="small-btn" data-detail-plan="${esc(market.id)}">Trip planen</button><button class="secondary small-btn" data-detail-stop="${esc(market.id)}">Zielhaltestelle suchen</button></div>`;
  $('[data-detail-plan]').onclick = () => {
    $('#marketDialog').close();
    setView('trip');
    $('#tripDate').value = firstDate(market);
    renderTripMarketOptions(market.id);
    $('#tripBudget').value = market.budget[1];
    $('#tripMessage').textContent = `${market.name} wurde übernommen.`;
  };
  $('[data-detail-stop]').onclick = () => {
    $('#marketDialog').close();
    setView('settings');
    $('#stopQuery').value = market.stationQuery || market.location;
    $('#stopQuery').focus();
  };
  $('#marketDialog').showModal();
}

function hydrateFilters() {
  const citySelect = $('#cityFilter');
  const selectedCity = state.filters.city || 'all';
  const cities = [...new Set(markets.map(market => market.city))].sort((a, b) => a.localeCompare(b, 'de'));
  citySelect.innerHTML = '<option value="all">Alle Städte</option>' + cities.map(city => `<option value="${esc(city)}">${esc(city)}</option>`).join('');
  $('#marketSearch').value = state.filters.query || '';
  citySelect.value = cities.includes(selectedCity) ? selectedCity : 'all';
  $('#dateFilter').value = state.filters.date || '';
  $('#travelFilter').value = state.filters.travel || '999';
  $('#distanceFilter').value = state.filters.distance || '999';
  $('#featureFilter').value = state.filters.feature || 'all';
  $('#sortFilter').value = state.filters.sort || 'score';
  if (!$('#travelFilter').value) $('#travelFilter').value = '999';
  if (!$('#distanceFilter').value) $('#distanceFilter').value = '999';
  if (!$('#featureFilter').value) $('#featureFilter').value = 'all';
  if (!$('#sortFilter').value) $('#sortFilter').value = 'score';
  setMarketLayout(state.filters.view === 'list' ? 'list' : 'card', false);
}

function readFilters() {
  state.filters = {
    query: $('#marketSearch').value.trim(),
    city: $('#cityFilter').value,
    date: $('#dateFilter').value,
    travel: $('#travelFilter').value,
    distance: $('#distanceFilter').value,
    feature: $('#featureFilter').value,
    sort: $('#sortFilter').value,
    view: state.filters.view === 'list' ? 'list' : 'card'
  };
  saveAll();
  return state.filters;
}

function matchesFeature(market, feature) {
  const tags = market.tags || [];
  return feature === 'all'
    || feature === 'free' && market.entry === 'Kostenlos'
    || feature === 'cozy' && market.cozy >= 5
    || feature === 'light' && market.light >= 5
    || feature === 'food' && market.food >= 5
    || feature === 'small' && (tags.includes('klein') || tags.includes('cozy')) && !tags.includes('groß')
    || feature === 'historic' && (tags.includes('historisch') || tags.includes('altstadt') || tags.includes('schloss'))
    || feature === 'craft' && tags.includes('kunsthandwerk')
    || feature === 'family' && tags.includes('familie')
    || feature === 'long' && tags.includes('lange-saison')
    || feature === 'new' && market.new
    || feature === 'favorites' && state.favorites.includes(market.id);
}

function filteredMarkets() {
  const filters = readFilters();
  const query = filters.query.toLocaleLowerCase('de');
  const selectedDate = parseDate(filters.date);
  const travel = Number(filters.travel);
  const distance = Number(filters.distance);
  const list = markets.filter(market => {
    const haystack = [market.name, market.city, market.location, market.tip, ...(market.tags || [])].join(' ').toLocaleLowerCase('de');
    return (!query || haystack.includes(query))
      && (filters.city === 'all' || market.city === filters.city)
      && (!selectedDate || openOn(market, selectedDate))
      && market.travel <= travel
      && market.distanceKm <= distance
      && matchesFeature(market, filters.feature);
  });
  return list.sort((a, b) => {
    if (filters.sort === 'travel') return a.travel - b.travel || score(b) - score(a);
    if (filters.sort === 'distance') return a.distanceKm - b.distanceKm || a.travel - b.travel;
    if (filters.sort === 'city') return a.city.localeCompare(b.city, 'de') || a.name.localeCompare(b.name, 'de');
    if (filters.sort === 'start') return firstDate(a).localeCompare(firstDate(b));
    return score(b) - score(a) || a.travel - b.travel;
  });
}

function renderMarkets() {
  const list = filteredMarkets();
  $('#filterSummary').textContent = `${list.length} von ${markets.length} Märkten passen zu deiner Auswahl.`;
  $('#marketList').innerHTML = list.length ? list.map(marketCard).join('') : '<div class="empty"><strong>Keine Treffer.</strong><br>Entferne einen Filter oder wähle einen anderen Tag.</div>';
  setMarketLayout(state.filters.view === 'list' ? 'list' : 'card', false);
  bindCards();
}

function setMarketLayout(mode, persist = true) {
  const layout = mode === 'list' ? 'list' : 'card';
  const list = $('#marketList');
  if (list) {
    list.classList.toggle('list-view', layout === 'list');
    list.classList.toggle('card-view', layout === 'card');
    list.classList.toggle('cards', layout === 'card');
  }
  $('#cardViewBtn')?.setAttribute('aria-pressed', String(layout === 'card'));
  $('#listViewBtn')?.setAttribute('aria-pressed', String(layout === 'list'));
  if (persist) {
    state.filters.view = layout;
    saveAll();
  }
}

function availabilityKey(date, personId) {
  return `${isoLocal(date)}|${personId}`;
}

function common(date) {
  return state.people.length > 0 && state.people.every(person => state.availability[availabilityKey(date, person.id)] === 'Ja');
}

function renderTimeline() {
  const bounds = marketBounds();
  const from = $('#timelineFrom').value || bounds.from;
  const to = $('#timelineTo').value || bounds.to;
  const dates = dateRange(from, to).filter(date => !$('#onlyCommon').checked || common(date));
  $('#timelineHead').innerHTML = '<tr><th>Datum</th>' + state.people.map(person => `<th>${esc(person.name)}</th>`).join('') + '<th>Gemeinsam</th><th>Geöffnete Märkte</th></tr>';
  if (!dates.length) {
    $('#timelineBody').innerHTML = `<tr><td colspan="${state.people.length + 3}">Keine Tage in diesem Bereich.</td></tr>`;
    return;
  }
  $('#timelineBody').innerHTML = dates.map(date => {
    const openMarkets = markets.filter(market => openOn(market, date));
    const preview = openMarkets.slice(0, 3).map(market => market.name).join(', ');
    const rest = openMarkets.length > 3 ? ` +${openMarkets.length - 3} weitere` : '';
    return `<tr class="${common(date) ? 'common' : ''}">
      <td>${date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</td>
      ${state.people.map(person => {
        const key = availabilityKey(date, person.id);
        return `<td><select data-avail="${esc(key)}" aria-label="Verfügbarkeit ${esc(person.name)} am ${isoLocal(date)}"><option></option>${['Ja', 'Vielleicht', 'Nein'].map(value => `<option ${state.availability[key] === value ? 'selected' : ''}>${value}</option>`).join('')}</select></td>`;
      }).join('')}
      <td>${common(date) ? '✅ Ja' : '–'}</td>
      <td class="market-mini" title="${esc(openMarkets.map(market => market.name).join(', '))}">${openMarkets.length ? `<strong>${openMarkets.length}</strong> · ${esc(preview)}${esc(rest)}` : '–'}</td>
    </tr>`;
  }).join('');
  $$('[data-avail]').forEach(select => select.onchange = () => {
    state.availability[select.dataset.avail] = select.value;
    saveAll();
    renderTimeline();
    renderHome();
  });
}

function renderPeople() {
  $('#peopleList').innerHTML = state.people.map((person, index) => `<div class="person-row"><input data-person="${esc(person.id)}" value="${esc(person.name)}" aria-label="Name Person ${index + 1}"><button data-remove="${esc(person.id)}" class="danger" ${state.people.length === 1 ? 'disabled' : ''}>Entfernen</button></div>`).join('');
  $$('[data-person]').forEach(input => input.onchange = () => {
    const person = state.people.find(item => item.id === input.dataset.person);
    if (!person) return;
    person.name = input.value.trim() || `Person ${state.people.indexOf(person) + 1}`;
    saveAll();
    renderAll();
  });
  $$('[data-remove]').forEach(button => button.onclick = () => {
    if (state.people.length <= 1) return;
    const id = button.dataset.remove;
    state.people = state.people.filter(person => person.id !== id);
    for (const key of Object.keys(state.availability)) if (key.endsWith(`|${id}`)) delete state.availability[key];
    saveAll();
    renderAll();
  });
}

async function searchStops() {
  const query = $('#stopQuery').value.trim();
  if (query.length < 3) {
    $('#stopResults').innerHTML = '<p class="muted">Bitte mindestens 3 Zeichen eingeben.</p>';
    return;
  }
  if (!navigator.onLine) {
    $('#stopResults').innerHTML = '<p class="error-banner">Offline: Die Haltestellensuche braucht kurz eine Internetverbindung.</p>';
    return;
  }
  stopController?.abort();
  stopController = new AbortController();
  const timeout = setTimeout(() => stopController.abort(), 12000);
  $('#stopResults').innerHTML = '<p>Suche …</p>';
  try {
    const url = `${API}/locations?query=${encodeURIComponent(query)}&results=8&stops=true&addresses=true&poi=false&language=de`;
    const response = await fetch(url, { signal: stopController.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data) || !data.length) {
      $('#stopResults').innerHTML = '<p class="muted">Keine passende Haltestelle oder Adresse gefunden.</p>';
      return;
    }
    $('#stopResults').innerHTML = data.map((item, index) => `<button class="result" data-stop="${index}" role="option">${esc(item.name || item.address || 'Unbekannt')}</button>`).join('');
    $$('[data-stop]').forEach(button => button.onclick = () => {
      const item = data[Number(button.dataset.stop)];
      state.stop = {
        id: item.id || null,
        name: item.name || item.address || 'Unbekannt',
        latitude: item.location?.latitude ?? null,
        longitude: item.location?.longitude ?? null
      };
      saveAll();
      renderSettings();
      $('#stopResults').innerHTML = '<p class="status">Zielhaltestelle gespeichert.</p>';
    });
  } catch (error) {
    if (error.name !== 'AbortError') $('#stopResults').innerHTML = '<p class="error-banner">Suche derzeit nicht erreichbar. Bitte später erneut versuchen.</p>';
    else $('#stopResults').innerHTML = '<p class="error-banner">Die Suche hat zu lange gedauert. Bitte erneut versuchen.</p>';
  } finally {
    clearTimeout(timeout);
  }
}

function renderSettings() {
  renderPeople();
  $('#savedStop').textContent = state.stop?.name || 'keine';
}

function renderTripMarketOptions(preferredId) {
  const date = parseDate($('#tripDate').value);
  const current = preferredId || $('#tripMarket').value;
  const available = date ? markets.filter(market => openOn(market, date)) : [...markets];
  $('#tripMarket').innerHTML = available.length
    ? available.sort((a, b) => a.city.localeCompare(b.city, 'de') || a.name.localeCompare(b.name, 'de')).map(market => `<option value="${esc(market.id)}">${esc(market.city)} · ${esc(market.name)}</option>`).join('')
    : '<option value="">Kein Markt an diesem Tag geöffnet</option>';
  if (available.some(market => market.id === current)) $('#tripMarket').value = current;
}

function renderTrip() {
  renderTripMarketOptions();
  const sortedTrips = state.trips.map((trip, index) => ({ trip, index })).sort((a, b) => String(a.trip.date).localeCompare(String(b.trip.date)));
  $('#savedTrips').innerHTML = sortedTrips.length ? sortedTrips.map(({ trip, index }) => `<article class="card"><strong>${esc(formatDate(trip.date))} · ${esc(trip.market || 'Weihnachtsmarkt')}</strong><p>${esc(trip.activity || 'Ohne Zusatzaktivität')} · ${Number(trip.budget) || 0} € p. P.</p><p class="muted">${esc(trip.stop || 'Keine Zielhaltestelle')}</p><button data-deltrip="${index}" class="danger small-btn">Löschen</button></article>`).join('') : '<p>Noch keine Trips gespeichert.</p>';
  $$('[data-deltrip]').forEach(button => button.onclick = () => {
    state.trips.splice(Number(button.dataset.deltrip), 1);
    saveAll();
    renderTrip();
  });
}

function tripData() {
  const market = markets.find(item => item.id === $('#tripMarket').value);
  if (!market) return null;
  return {
    marketId: market.id,
    date: $('#tripDate').value,
    market: market.name,
    location: market.location,
    start: $('#tripStart').value,
    end: $('#tripEnd').value,
    activity: $('#tripActivity').value.trim(),
    budget: Math.max(0, Number($('#tripBudget').value) || 0),
    notes: $('#tripNotes').value.trim(),
    stop: state.stop?.name || '',
    createdAt: new Date().toISOString()
  };
}

function validateTrip(trip) {
  if (!trip?.date) return 'Bitte zuerst ein Datum wählen.';
  const market = markets.find(item => item.id === trip.marketId);
  const date = parseDate(trip.date);
  if (!market || !date || !openOn(market, date)) return 'Der gewählte Markt ist an diesem Datum nicht geöffnet.';
  if (!trip.start || !trip.end || trip.end <= trip.start) return 'Die Endzeit muss nach der Startzeit liegen.';
  return '';
}

function icsEscape(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function foldIcs(text) {
  return text.split('\r\n').flatMap(line => {
    const parts = [];
    const encoder = new TextEncoder();
    let part = '';
    let bytes = 0;
    for (const char of line) {
      const charBytes = encoder.encode(char).length;
      if (part && bytes + charBytes > 75) {
        parts.push(part);
        part = ` ${char}`;
        bytes = 1 + charBytes;
      } else {
        part += char;
        bytes += charBytes;
      }
    }
    parts.push(part);
    return parts;
  }).join('\r\n');
}

function makeIcs(trip) {
  const date = trip.date.replaceAll('-', '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const description = `Aktivität: ${trip.activity || 'keine'}\nBudget pro Person: ${trip.budget} €\nZielhaltestelle: ${trip.stop || 'nicht gewählt'}\n${trip.notes || ''}`;
  return foldIcs(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nCALSCALE:GREGORIAN\r\nPRODID:-//Way to Winter Magic V${VERSION}//DE\r\nBEGIN:VEVENT\r\nUID:${Date.now()}-${Math.random().toString(36).slice(2)}@wtwm\r\nDTSTAMP:${stamp}\r\nDTSTART;TZID=Europe/Berlin:${date}T${trip.start.replace(':', '')}00\r\nDTEND;TZID=Europe/Berlin:${date}T${trip.end.replace(':', '')}00\r\nSUMMARY:${icsEscape('Weihnachtsmarkt: ' + trip.market)}\r\nLOCATION:${icsEscape(trip.location)}\r\nDESCRIPTION:${icsEscape(description)}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`);
}

function download(url, name) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  if (url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(url), 3000);
}

async function shareIcs() {
  const trip = tripData();
  const error = validateTrip(trip);
  if (error) { $('#tripMessage').textContent = error; return; }
  const file = new File([makeIcs(trip)], `Weihnachtsmarkt-${trip.date}.ics`, { type: 'text/calendar;charset=utf-8' });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: trip.market });
    else download(URL.createObjectURL(file), file.name);
  } catch (shareError) {
    if (shareError.name !== 'AbortError') download(URL.createObjectURL(file), file.name);
  }
}

function allSeasonDates() {
  const bounds = marketBounds();
  return dateRange(bounds.from, bounds.to);
}

function renderHome() {
  const commonDates = allSeasonDates().filter(common);
  $('#marketCount').textContent = markets.length;
  $('#favCount').textContent = state.favorites.length;
  $('#commonCount').textContent = commonDates.length;
  $('#nextDates').innerHTML = commonDates.slice(0, 4).map(date => {
    const open = markets.filter(market => openOn(market, date));
    return `<article class="card"><strong>${date.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</strong><p>${open.length} Märkte geöffnet</p><p class="muted">${esc(open.slice(0, 3).map(market => market.name).join(', '))}${open.length > 3 ? ` +${open.length - 3}` : ''}</p></article>`;
  }).join('') || '<p>Tragt in der Timeline eure Verfügbarkeit ein.</p>';
  $('#topMarkets').innerHTML = [...markets].sort((a, b) => score(b) - score(a) || a.travel - b.travel).slice(0, 3).map(marketCard).join('');
  bindCards();
}

function setView(id) {
  $$('.tabs button,.view').forEach(element => element.classList.remove('active'));
  $(`.tabs button[data-view="${CSS.escape(id)}"]`)?.classList.add('active');
  $(`#${CSS.escape(id)}`)?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderAll() {
  renderHome();
  renderMarkets();
  renderTimeline();
  renderSettings();
  renderTrip();
}

function sanitizeImported(payload) {
  const source = payload?.state && typeof payload.state === 'object' ? payload.state : payload;
  if (!source || typeof source !== 'object') throw new Error('Ungültiges Format');
  const importedPeople = migratePeople(source.people);
  const imported = {
    people: importedPeople,
    availability: migrateAvailability(source.availability || {}, importedPeople, source.people),
    favorites: Array.isArray(source.favorites) ? [...new Set(source.favorites.map(String))].filter(id => markets.some(market => market.id === id)) : [],
    trips: Array.isArray(source.trips) ? source.trips.filter(trip => trip && parseDate(trip.date) && typeof trip.market === 'string').slice(0, 500) : [],
    stop: source.stop && typeof source.stop.name === 'string' ? source.stop : null,
    filters: source.filters && typeof source.filters === 'object' ? source.filters : {}
  };
  return imported;
}

function bind() {
  $$('.tabs button').forEach(button => button.onclick = () => setView(button.dataset.view));
  $$('[data-jump]').forEach(button => button.onclick = () => setView(button.dataset.jump));
  ['marketSearch', 'cityFilter', 'dateFilter', 'travelFilter', 'distanceFilter', 'featureFilter', 'sortFilter'].forEach(id => {
    $(`#${id}`).addEventListener(id === 'marketSearch' ? 'input' : 'change', renderMarkets);
  });
  $('#resetFilters').onclick = () => {
    const view = state.filters.view;
    state.filters = { view };
    hydrateFilters();
    renderMarkets();
  };
  $('#cardViewBtn').onclick = () => setMarketLayout('card');
  $('#listViewBtn').onclick = () => setMarketLayout('list');
  $('#timelineFrom').onchange = renderTimeline;
  $('#timelineTo').onchange = renderTimeline;
  $('#onlyCommon').onchange = renderTimeline;
  $('#addPerson').onclick = () => {
    state.people.push({ id: uid(), name: `Person ${state.people.length + 1}` });
    saveAll();
    renderAll();
  };
  $('#searchStop').onclick = searchStops;
  $('#stopQuery').onkeydown = event => { if (event.key === 'Enter') searchStops(); };
  $('#tripDate').onchange = () => { renderTripMarketOptions(); $('#tripMessage').textContent = ''; };
  $('#tripMarket').onchange = () => {
    const market = markets.find(item => item.id === $('#tripMarket').value);
    if (market) $('#tripBudget').value = market.budget[1];
  };
  $('#saveTrip').onclick = () => {
    const trip = tripData();
    const error = validateTrip(trip);
    if (error) { $('#tripMessage').textContent = error; return; }
    state.trips.push(trip);
    saveAll();
    renderTrip();
    $('#tripMessage').textContent = 'Trip gespeichert.';
  };
  $('#exportIcs').onclick = shareIcs;
  $('#exportData').onclick = () => {
    const backup = { app: APP_NAME, version: VERSION, exportedAt: new Date().toISOString(), state };
    download(URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })), 'wtwm-sicherung.json');
  };
  $('#importData').onchange = async event => {
    try {
      const file = event.target.files?.[0];
      if (!file || file.size > 2_000_000) throw new Error('Datei fehlt oder ist zu groß');
      const imported = sanitizeImported(JSON.parse(await file.text()));
      Object.assign(state, imported);
      saveAll();
      hydrateFilters();
      renderAll();
      alert('Sicherung erfolgreich importiert.');
    } catch {
      alert('Die Sicherungsdatei ist ungültig oder zu groß.');
    } finally {
      event.target.value = '';
    }
  };
  $('#resetData').onclick = () => {
    if (!confirm('Alle lokalen Eingaben dieser App wirklich löschen?')) return;
    APP_KEYS.forEach(key => {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      localStorage.removeItem(key);
    });
    location.reload();
  };
  $('#marketDialog .close').onclick = () => $('#marketDialog').close();
  $('#marketDialog').addEventListener('click', event => { if (event.target === $('#marketDialog')) $('#marketDialog').close(); });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    $('#installBtn').hidden = false;
  });
  $('#installBtn').onclick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    $('#installBtn').hidden = true;
  };
}

async function loadMarkets() {
  const response = await fetch('./data/markets.json');
  if (!response.ok) throw new Error(`Marktdaten HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data) || data.length < 39) throw new Error('Marktdaten unvollständig');
  markets = data;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseDate, isoLocal, dateRange, migratePeople, migrateAvailability, openOn, score, icsEscape, foldIcs, makeIcs, sanitizeImported };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  (async () => {
    try {
      await loadMarkets();
      const bounds = marketBounds();
      $('#timelineFrom').value = bounds.from;
      $('#timelineTo').value = bounds.to;
      hydrateFilters();
      bind();
      renderAll();
    } catch (error) {
      document.querySelector('main').innerHTML = `<p class="error-banner">Die Marktdaten konnten nicht geladen werden. Bitte die App einmal online neu öffnen. (${esc(error.message)})</p>`;
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
  })();
}
