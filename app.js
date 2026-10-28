const VERSION = '2.5.0';
const API = 'https://api.transitous.org/api';
const STORAGE_PREFIX = 'wtwm:v2:';
const APP_KEYS = ['people', 'availability', 'favorites', 'trips', 'tripDraft', 'stop', 'marketFilters', 'plannerMarketFilters', 'marketView', 'connectionPrefs', 'savedConnections'];
const REQUEST_TIMEOUT_MS = 12000;
const MAX_SAVED_CONNECTIONS = 8;
const DEFAULT_PEOPLE = [
  { id: 'p1', name: 'Person 1' },
  { id: 'p2', name: 'Person 2' }
];

const S = {
  get(key, fallback) {
    try {
      const scopedKey = STORAGE_PREFIX + key;
      let raw = localStorage.getItem(scopedKey);
      if (raw === null) {
        raw = localStorage.getItem(key);
        if (raw !== null) localStorage.setItem(scopedKey, raw);
      }
      const value = JSON.parse(raw);
      return value ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); } catch { /* private mode/quota */ }
  },
  remove(key) {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
      localStorage.removeItem(key);
    } catch { /* private mode */ }
  }
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const pad = value => String(value).padStart(2, '0');
const makeId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const uid = () => makeId('p');

let markets = [];
let installPrompt = null;
let stopController = null;
let connectionController = null;
let plannerController = null;
let plannerStep = 1;
let editingTripId = '';

const TRIP_STATUSES = ['Idee', 'In Planung', 'Geplant', 'Besucht', 'Abgesagt'];
const BUDGET_INDEX = { saving: 0, normal: 1, activity: 2 };
const DEFAULT_DRAFT = {
  date: '', marketId: '', arrival: '15:00', returnEnabled: false, returnTime: '20:00',
  budgetLevel: 'normal', activityType: 'Städtetrip', activity: '', notes: '',
  ticketStatus: 'Noch nicht geprüft', meetingPoint: 'Wuppertal Hbf', status: 'Idee',
  outboundOptions: [], returnOptions: [], selectedOutbound: '', selectedReturn: '',
  resolvedStops: null, connectionsCheckedAt: ''
};
const DEFAULT_PLANNER_FILTERS = { query: '', city: 'all', travel: '999', feature: 'all', sort: 'score' };

function parseDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return null;
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
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
  const used = new Set();
  return raw.map((person, index) => {
    const name = typeof person === 'string' ? person.trim() : String(person?.name || '').trim();
    const requested = typeof person === 'string' ? `p${index + 1}` : String(person?.id || `p${index + 1}`);
    let id = requested;
    let suffix = 2;
    while (used.has(id)) id = `${requested}-${suffix++}`;
    used.add(id);
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
  trips: Array.isArray(S.get('trips', [])) ? S.get('trips', []).map((trip, index) => ({
    ...trip,
    id: String(trip?.id || `legacy-trip-${index}-${Date.now().toString(36)}`),
    status: TRIP_STATUSES.includes(trip?.status) ? trip.status : 'Idee'
  })) : [],
  tripDraft: { ...DEFAULT_DRAFT, ...(S.get('tripDraft', {}) || {}) },
  stop: S.get('stop', null),
  filters: S.get('marketFilters', {}) || {},
  plannerFilters: { ...DEFAULT_PLANNER_FILTERS, ...(S.get('plannerMarketFilters', {}) || {}) },
  viewMode: S.get('marketView', 'cards') === 'list' ? 'list' : 'cards',
  connectionPrefs: S.get('connectionPrefs', {}) || {},
  savedConnections: Array.isArray(S.get('savedConnections', [])) ? S.get('savedConnections', []).slice(0, MAX_SAVED_CONNECTIONS) : []
};

function saveAll() {
  S.set('people', state.people);
  S.set('availability', state.availability);
  S.set('favorites', state.favorites);
  S.set('trips', state.trips);
  S.set('tripDraft', state.tripDraft);
  S.set('stop', state.stop);
  S.set('marketFilters', state.filters);
  S.set('plannerMarketFilters', state.plannerFilters);
  S.set('marketView', state.viewMode);
  S.set('connectionPrefs', state.connectionPrefs);
  S.set('savedConnections', state.savedConnections);
}

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
  return `<article class="card">
    <button class="fav ${favorite ? 'on' : ''}" data-fav="${esc(market.id)}" aria-label="${favorite ? 'Favorit entfernen' : 'Als Favorit speichern'}">♥</button>
    ${market.new ? '<span class="badge new">Neu</span>' : ''}
    <h3>${esc(market.name)}</h3>
    <p>${esc(market.city)} · ${esc(market.location)}</p>
    <span class="badge">🚆 ca. ${market.travel} Min.</span>
    <span class="badge">↗ ca. ${market.distanceKm} km</span>
    <span class="badge gold">${esc(market.entry)}</span>
    <p class="muted">${esc(formatMarketDates(market))}</p>
    <p>Cozy ${stars(market.cozy)}<br>Licht ${stars(market.light)} · Essen ${stars(market.food)}</p>
    <div class="card-actions"><button data-detail="${esc(market.id)}">Details</button><button class="ghost" data-plan="${esc(market.id)}">Planen</button><button class="ghost" data-connection="${esc(market.id)}">Bahn</button></div>
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
  $$('[data-plan]').forEach(button => button.onclick = () => startPlannerForMarket(button.dataset.plan));
  $$('[data-connection]').forEach(button => button.onclick = () => prepareConnection(button.dataset.connection));
}

function showDetail(id) {
  const market = markets.find(item => item.id === id);
  if (!market) return;
  const source = market.sourceUrl?.startsWith('https://')
    ? `<a class="source" href="${esc(market.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(market.sourceLabel || 'Marktquelle öffnen')} ↗</a>`
    : `<span>${esc(market.sourceLabel || 'Quelle im Bestand')}</span>`;
  $('#marketDetail').innerHTML = `
    <p class="eyebrow dark">${market.new ? 'Neu in V2' : 'Geprüfter Bestand'}</p>
    <h2>${esc(market.name)}</h2>
    <p><strong>${esc(market.location)}</strong></p>
    <div class="detail-grid">
      <div class="detail-box"><strong>ÖPNV ab Wuppertal Hbf</strong>ca. ${market.travel} Minuten</div>
      <div class="detail-box"><strong>Luftlinie</strong>ca. ${market.distanceKm} km</div>
      <div class="detail-box"><strong>Termine 2026/27</strong>${esc(formatMarketDates(market))}</div>
      <div class="detail-box"><strong>Gesamtwertung</strong>${score(market).toFixed(1)} / 5</div>
    </div>
    <p>Licht ${stars(market.light)} · Essen ${stars(market.food)} · Cozy ${stars(market.cozy)}</p>
    <h3>Passt gut, weil …</h3><p>${esc(market.positive)}</p>
    <h3>Beachten</h3><p>${esc(market.negative)}</p>
    <h3>Trip-Tipp</h3><p>${esc(market.tip)}</p>
    <p><strong>Budget pro Person:</strong> sparsam ${market.budget[0]} € · normal ${market.budget[1]} € · mit Aktivität ${market.budget[2]} €</p>
    <p><strong>Quelle:</strong> ${source}<br><span class="muted">geprüft am ${formatDate(market.verifiedAt)}</span></p>
    <div class="actions"><button data-detail-plan="${esc(market.id)}">Trip planen</button><button class="secondary" data-detail-connection="${esc(market.id)}">DB-Verbindung</button><button class="ghost" data-detail-stop="${esc(market.id)}">Zielhaltestelle speichern</button></div>`;
  $('[data-detail-plan]').onclick = () => {
    $('#marketDialog').close();
    startPlannerForMarket(market.id);
  };
  $('[data-detail-stop]').onclick = () => {
    $('#marketDialog').close();
    setView('settings');
    $('#stopQuery').value = market.stationQuery || market.location;
    $('#stopQuery').focus();
  };
  $('[data-detail-connection]').onclick = () => {
    $('#marketDialog').close();
    prepareConnection(market.id);
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
}

function readFilters() {
  state.filters = {
    query: $('#marketSearch').value.trim(),
    city: $('#cityFilter').value,
    date: $('#dateFilter').value,
    travel: $('#travelFilter').value,
    distance: $('#distanceFilter').value,
    feature: $('#featureFilter').value,
    sort: $('#sortFilter').value
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

function sortMarketList(list, sort = 'score') {
  return [...list].sort((a, b) => {
    if (sort === 'travel') return a.travel - b.travel || score(b) - score(a);
    if (sort === 'distance') return a.distanceKm - b.distanceKm || a.travel - b.travel;
    if (sort === 'city') return a.city.localeCompare(b.city, 'de') || a.name.localeCompare(b.name, 'de');
    if (sort === 'start') return firstDate(a).localeCompare(firstDate(b));
    return score(b) - score(a) || a.travel - b.travel;
  });
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
  return sortMarketList(list, filters.sort);
}

function applyMarketView() {
  const list = $('#marketList');
  if (!list) return;
  list.classList.toggle('list-view', state.viewMode === 'list');
  list.classList.toggle('cards', state.viewMode !== 'list');
  $('#cardView')?.classList.toggle('active', state.viewMode === 'cards');
  $('#listView')?.classList.toggle('active', state.viewMode === 'list');
  $('#cardView')?.setAttribute('aria-pressed', String(state.viewMode === 'cards'));
  $('#listView')?.setAttribute('aria-pressed', String(state.viewMode === 'list'));
}

function setMarketView(mode) {
  state.viewMode = mode === 'list' ? 'list' : 'cards';
  saveAll();
  applyMarketView();
}

function renderMarkets() {
  const list = filteredMarkets();
  $('#filterSummary').textContent = `${list.length} von ${markets.length} Märkten passen zu deiner Auswahl.`;
  $('#marketList').innerHTML = list.length ? list.map(marketCard).join('') : '<div class="empty"><strong>Keine Treffer.</strong><br>Entferne einen Filter oder wähle einen anderen Tag.</div>';
  applyMarketView();
  bindCards();
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
  const results = $('#stopResults');
  if (query.length < 3) {
    results.innerHTML = '<p class="muted">Bitte mindestens 3 Zeichen eingeben.</p>';
    return;
  }
  if (!navigator.onLine) {
    results.innerHTML = '<p class="error-banner">Du bist offline. Gespeicherte Verbindungen bleiben im Bereich „Bahn“ verfügbar.</p>';
    return;
  }
  stopController?.abort();
  stopController = new AbortController();
  const controller = stopController;
  results.innerHTML = '<p>Suche über Transitous …</p>';
  try {
    const data = await fetchJson(buildGeocodeUrl(query), { signal: controller.signal });
    if (controller !== stopController) return;
    const places = normalizePlaces(data);
    if (!places.length) {
      results.innerHTML = '<p class="muted">Keine passende Haltestelle oder Adresse gefunden. Prüfe die Schreibweise oder ergänze den Ort.</p>';
      return;
    }
    results.innerHTML = places.map((item, index) => `<button class="result" data-stop="${index}" role="option"><strong>${esc(item.name)}</strong>${item.detail ? `<small>${esc(item.detail)}</small>` : ''}</button>`).join('');
    $$('[data-stop]').forEach(button => button.onclick = () => {
      const item = places[Number(button.dataset.stop)];
      state.stop = { id: item.id, name: item.name, latitude: item.latitude, longitude: item.longitude };
      saveAll();
      renderSettings();
      results.innerHTML = '<p class="status">Zielhaltestelle gespeichert.</p>';
    });
  } catch (error) {
    if (controller !== stopController || error.code === 'CANCELLED') return;
    results.innerHTML = `<div class="error-banner">${esc(friendlyError(error, 'Haltestellensuche'))}<div><button id="retryStopSearch" class="retry-button">Erneut versuchen</button></div></div>`;
    $('#retryStopSearch').onclick = searchStops;
  }
}

function buildGeocodeUrl(query) {
  const params = new URLSearchParams({ text: String(query || ''), language: 'de', limit: '8' });
  return `${API}/v1/geocode?${params.toString()}`;
}

function normalizePlaces(payload) {
  const items = Array.isArray(payload) ? payload : Array.isArray(payload?.features) ? payload.features : Array.isArray(payload?.locations) ? payload.locations : [];
  return items.map(item => {
    const properties = item?.properties || item || {};
    const coordinates = item?.geometry?.coordinates || [];
    const latitude = Number(properties.lat ?? properties.latitude ?? item?.lat ?? coordinates[1]);
    const longitude = Number(properties.lon ?? properties.longitude ?? item?.lon ?? coordinates[0]);
    const id = properties.stopId ?? properties.id ?? item?.stopId ?? item?.id ?? null;
    const name = properties.name ?? item?.name ?? properties.label ?? item?.label ?? properties.address ?? '';
    const detail = [properties.locality, properties.region, properties.country].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(' · ');
    const routingId = id ? String(id) : Number.isFinite(latitude) && Number.isFinite(longitude) ? `${latitude},${longitude}` : '';
    return { id: routingId, name: String(name || 'Unbekannter Ort'), detail, latitude: Number.isFinite(latitude) ? latitude : null, longitude: Number.isFinite(longitude) ? longitude : null };
  }).filter(item => item.id && item.name);
}

function buildJourneyUrl(fromId, toId, date, time, mode = 'departure') {
  if (!fromId || !toId || !parseDate(date) || !/^\d{2}:\d{2}$/.test(String(time))) return '';
  const params = new URLSearchParams({
    fromPlace: String(fromId),
    toPlace: String(toId),
    time: `${date}T${time}:00+01:00`,
    arriveBy: String(mode === 'arrival'),
    numItineraries: '8'
  });
  return `${API}/v6/plan?${params.toString()}`;
}

function requestError(code, message, status = 0) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(requestError('CANCELLED', 'Anfrage abgebrochen')); }, { once: true });
  });
}

async function fetchJson(url, options = {}) {
  const { signal, timeoutMs = REQUEST_TIMEOUT_MS, retries = 1 } = options;
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (signal?.aborted) throw requestError('CANCELLED', 'Anfrage abgebrochen');
    const controller = new AbortController();
    let timedOut = false;
    const abortFromParent = () => controller.abort();
    signal?.addEventListener('abort', abortFromParent, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) {
        const error = requestError('HTTP', `HTTP ${response.status}`, response.status);
        if (response.status >= 500 && attempt < retries) { lastError = error; await wait(650 * (attempt + 1), signal); continue; }
        throw error;
      }
      try { return await response.json(); }
      catch { throw requestError('INVALID_RESPONSE', 'Ungültige Antwort'); }
    } catch (error) {
      if (signal?.aborted) throw requestError('CANCELLED', 'Anfrage abgebrochen');
      const normalized = timedOut ? requestError('TIMEOUT', 'Zeitüberschreitung')
        : error?.code ? error
          : requestError('NETWORK', 'Netzwerkfehler');
      lastError = normalized;
      const retryable = normalized.code === 'TIMEOUT' || normalized.code === 'NETWORK' || normalized.status >= 500;
      if (!retryable || attempt >= retries) throw normalized;
      await wait(650 * (attempt + 1), signal);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abortFromParent);
    }
  }
  throw lastError || requestError('NETWORK', 'Fahrplanschnittstelle nicht erreichbar');
}

function friendlyError(error, context = 'Verbindungssuche') {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return `Du bist offline. ${context} braucht eine Internetverbindung.`;
  if (error?.code === 'TIMEOUT') return `${context}: Transitous hat innerhalb von 12 Sekunden nicht geantwortet. Bitte versuche es erneut.`;
  if (error?.status === 429) return 'Transitous ist gerade stark ausgelastet. Warte bitte kurz und versuche es dann erneut.';
  if (error?.status >= 500) return 'Transitous hat gerade ein Serverproblem. Bitte versuche es in einem Moment erneut.';
  if (error?.code === 'INVALID_RESPONSE') return 'Transitous hat eine unerwartete Antwort gesendet. Bitte versuche es erneut.';
  if (error?.code === 'NOT_FOUND') return error.message;
  return `${context} konnte keine Verbindung zu Transitous aufbauen. Prüfe Internetzugang oder Browser-Schutz und versuche es erneut.`;
}

async function resolveStop(query, signal) {
  const data = await fetchJson(buildGeocodeUrl(query), { signal });
  const places = normalizePlaces(data);
  const place = places.find(item => item.id) || null;
  if (!place) throw requestError('NOT_FOUND', `Keine Haltestelle für „${query}“ gefunden. Ergänze bitte den Ort.`);
  return place;
}

function connectionTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '–' : date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
}

function durationMinutes(from, to) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.round((end - start) / 60000) : 0;
}

function durationLabel(minutes) {
  if (!minutes) return 'Dauer unbekannt';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} Std. ${rest ? `${rest} Min.` : ''}`.trim() : `${rest} Min.`;
}

function delayMinutes(actual, planned) {
  if (!actual || !planned) return 0;
  return Math.max(0, Math.round((new Date(actual).getTime() - new Date(planned).getTime()) / 60000) || 0);
}

function legName(leg) {
  if (leg.walking || /^(WALK|FOOT)$/i.test(leg.mode || '')) return 'Fußweg';
  return leg.line || leg.line?.name || leg.routeShortName || leg.displayName || leg.product?.name || String(leg.mode || 'ÖPNV').replaceAll('_', ' ');
}

function normalizeJourney(journey) {
  const sourceLegs = Array.isArray(journey?.legs) ? journey.legs : [];
  const legs = sourceLegs.map(leg => {
    const origin = leg.origin || leg.from || {};
    const destination = leg.destination || leg.to || {};
    const departure = leg.departure || leg.startTime || origin.departure || origin.arrival;
    const plannedDeparture = leg.plannedDeparture || leg.scheduledStartTime || origin.scheduledDeparture || origin.scheduledArrival || departure;
    const arrival = leg.arrival || leg.endTime || destination.arrival || destination.departure;
    const plannedArrival = leg.plannedArrival || leg.scheduledEndTime || destination.scheduledArrival || destination.scheduledDeparture || arrival;
    const mode = String(leg.mode || (leg.walking ? 'WALK' : 'TRANSIT'));
    const line = leg.line?.name || leg.line?.fahrtNr || leg.routeShortName || leg.displayName || leg.routeLongName || leg.product?.name || '';
    return {
      origin: String(origin.name || 'Start'), destination: String(destination.name || 'Ziel'),
      departure, plannedDeparture, arrival, plannedArrival, mode, line: String(line),
      headsign: String(leg.headsign || ''), platform: String(leg.departurePlatform || leg.plannedDeparturePlatform || origin.track || origin.scheduledTrack || ''),
      walking: Boolean(leg.walking) || /^(WALK|FOOT)$/i.test(mode), cancelled: Boolean(leg.cancelled || origin.cancelled || destination.cancelled)
    };
  }).filter(leg => leg.departure && leg.arrival);
  if (!legs.length) return null;
  const departure = journey.startTime || legs[0].departure;
  const arrival = journey.endTime || legs.at(-1).arrival;
  const publicLegs = legs.filter(leg => !leg.walking);
  const calculatedTransfers = Math.max(0, publicLegs.length - 1);
  const suppliedTransfers = Number(journey.transfers);
  return {
    departure, arrival, duration: durationMinutes(departure, arrival) || Math.round(Number(journey.duration || 0) / 60),
    transfers: Number.isFinite(suppliedTransfers) ? suppliedTransfers : calculatedTransfers,
    cancelled: Boolean(journey.cancelled || legs.some(leg => leg.cancelled)), legs
  };
}

function buildDbNavigatorUrl(query = {}) {
  const params = new URLSearchParams({
    sts: 'true', so: String(query.from || ''), zo: String(query.to || ''),
    hd: `${query.date || ''}T${query.time || '14:00'}:00`, hza: query.mode === 'arrival' ? 'A' : 'D',
    ar: String(query.mode === 'arrival'), kl: '2'
  });
  return `https://int.bahn.de/buchung/fahrplan/suche#${params.toString()}`;
}

function journeyCard(journey, index, query = {}) {
  const normalized = journey?.departure && Array.isArray(journey?.legs) && typeof journey.legs[0]?.origin === 'string' ? journey : normalizeJourney(journey);
  if (!normalized?.legs?.length) return '';
  const first = normalized.legs[0];
  const last = normalized.legs.at(-1);
  const publicLegs = normalized.legs.filter(leg => !leg.walking);
  const products = [...new Set(publicLegs.map(legName))].join(' · ') || 'Fußweg';
  const delay = Math.max(delayMinutes(first.departure, first.plannedDeparture), delayMinutes(last.arrival, last.plannedArrival));
  const details = normalized.legs.map(leg => `<li><span class="leg-time">${connectionTime(leg.departure)}–${connectionTime(leg.arrival)}</span><strong>${esc(legName(leg))}</strong><span>${esc(leg.origin)} → ${esc(leg.destination)}${leg.platform ? ` · Gleis ${esc(leg.platform)}` : ''}${leg.headsign ? ` · Richtung ${esc(leg.headsign)}` : ''}</span></li>`).join('');
  return `<article class="panel connection-card ${normalized.cancelled ? 'cancelled' : ''}">
    <div class="connection-head"><div><span class="connection-time">${connectionTime(normalized.departure)} → ${connectionTime(normalized.arrival)}</span><p>${esc(first.origin)} → ${esc(last.destination)}</p></div><strong>${durationLabel(normalized.duration)}</strong></div>
    <div class="connection-meta"><span class="badge">${normalized.transfers ? `${normalized.transfers}× umsteigen` : 'Direkt'}</span><span class="badge">${esc(products)}</span>${delay ? `<span class="badge delay">+${delay} Min.</span>` : '<span class="badge on-time">Planmäßig</span>'}${normalized.cancelled ? '<span class="badge cancelled-label">Fällt aus</span>' : ''}</div>
    <details><summary>Etappen anzeigen</summary><ol class="legs">${details}</ol></details>
    <a class="db-link" href="${esc(buildDbNavigatorUrl(query))}" target="_blank" rel="noopener noreferrer">Im DB Navigator öffnen ↗</a>
  </article>`;
}

function renderConnectionMarkets(preferredId = '') {
  const select = $('#connectionMarket');
  if (!select) return;
  const current = preferredId || select.value;
  select.innerHTML = '<option value="">Markt auswählen …</option>' + [...markets]
    .sort((a, b) => a.city.localeCompare(b.city, 'de') || a.name.localeCompare(b.name, 'de'))
    .map(market => `<option value="${esc(market.id)}">${esc(market.city)} · ${esc(market.name)}</option>`).join('');
  if (markets.some(market => market.id === current)) select.value = current;
}

function prepareConnection(marketId, date = '', time = '') {
  const market = markets.find(item => item.id === marketId);
  if (!market) return;
  setView('connections');
  renderConnectionMarkets(market.id);
  $('#connectionTo').value = market.stationQuery || market.location;
  $('#connectionDate').value = parseDate(date) ? date : firstDate(market);
  $('#connectionTime').value = /^\d{2}:\d{2}$/.test(time) ? time : '14:00';
  $('#connectionResults').innerHTML = '';
  $('#connectionMessage').textContent = `${market.name} wurde als Ziel übernommen.`;
}

function connectionQueryFromForm() {
  return {
    from: $('#connectionFrom').value.trim(), to: $('#connectionTo').value.trim(),
    date: $('#connectionDate').value, time: $('#connectionTime').value,
    mode: $('#connectionMode').value === 'arrival' ? 'arrival' : 'departure', marketId: $('#connectionMarket').value
  };
}

function connectionKey(query) {
  return [query.from, query.to, query.date, query.time, query.mode].map(value => String(value || '').trim().toLocaleLowerCase('de')).join('|');
}

function saveConnectionSnapshot(query, resolved, journeys) {
  const normalized = journeys.map(journey => journey?.departure && Array.isArray(journey?.legs) && typeof journey.legs[0]?.origin === 'string' ? journey : normalizeJourney(journey)).filter(Boolean).slice(0, 6);
  if (!normalized.length) return;
  const record = { id: `c-${Date.now().toString(36)}`, savedAt: new Date().toISOString(), query, resolved, journeys: normalized };
  const key = connectionKey(query);
  state.savedConnections = [record, ...state.savedConnections.filter(item => connectionKey(item.query || {}) !== key)].slice(0, MAX_SAVED_CONNECTIONS);
  saveAll();
  renderSavedConnections();
}

function showSavedConnection(id) {
  const record = state.savedConnections.find(item => item.id === id);
  if (!record) return;
  const query = record.query || {};
  $('#connectionFrom').value = query.from || '';
  $('#connectionTo').value = query.to || '';
  $('#connectionDate').value = query.date || '';
  $('#connectionTime').value = query.time || '14:00';
  $('#connectionMode').value = query.mode === 'arrival' ? 'arrival' : 'departure';
  $('#connectionMessage').textContent = `Offline gespeichert am ${new Date(record.savedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}.`;
  $('#connectionResults').innerHTML = record.journeys.map((journey, index) => journeyCard(journey, index, query)).join('');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderSavedConnections() {
  const target = $('#savedConnections');
  if (!target) return;
  const sorted = [...state.savedConnections].filter(item => item?.query && Array.isArray(item.journeys)).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  target.innerHTML = sorted.length ? sorted.map(item => `<article class="saved-connection">
    <div><strong>${esc(item.query.from)} → ${esc(item.query.to)}</strong><p>${esc(formatDate(item.query.date))} · ${esc(item.query.time)} Uhr · ${item.query.mode === 'arrival' ? 'Ankunft' : 'Abfahrt'} · ${item.journeys.length} Verbindung${item.journeys.length === 1 ? '' : 'en'}</p></div>
    <div class="saved-actions"><button data-open-saved="${esc(item.id)}">Offline ansehen</button><a class="button-link ghost" href="${esc(buildDbNavigatorUrl(item.query))}" target="_blank" rel="noopener noreferrer">DB Navigator ↗</a><button class="danger compact-button" data-delete-saved="${esc(item.id)}" aria-label="Gespeicherte Verbindung löschen">×</button></div>
  </article>`).join('') : '<p class="muted">Noch keine Verbindung gespeichert. Erfolgreiche Suchen werden automatisch für die Offline-Anzeige gesichert.</p>';
  $$('[data-open-saved]').forEach(button => button.onclick = () => showSavedConnection(button.dataset.openSaved));
  $$('[data-delete-saved]').forEach(button => button.onclick = () => {
    state.savedConnections = state.savedConnections.filter(item => item.id !== button.dataset.deleteSaved);
    saveAll(); renderSavedConnections();
  });
  $('#clearSavedConnections').hidden = !sorted.length;
}

function renderCachedMatch(query) {
  const match = state.savedConnections.find(item => connectionKey(item.query || {}) === connectionKey(query));
  if (!match) return false;
  $('#connectionMessage').textContent = 'Offline: passende gespeicherte Verbindung wird angezeigt.';
  $('#connectionResults').innerHTML = match.journeys.map((journey, index) => journeyCard(journey, index, query)).join('');
  return true;
}

async function searchConnections() {
  const query = connectionQueryFromForm();
  const message = $('#connectionMessage');
  const results = $('#connectionResults');
  if (query.from.length < 3 || query.to.length < 3) {
    message.textContent = 'Bitte Start und Ziel mit mindestens 3 Zeichen eingeben.';
    results.innerHTML = '';
    return;
  }
  if (!parseDate(query.date) || !/^\d{2}:\d{2}$/.test(query.time)) {
    message.textContent = 'Bitte ein gültiges Datum und eine Uhrzeit wählen.';
    results.innerHTML = '';
    return;
  }
  state.connectionPrefs = query;
  saveAll();
  if (!navigator.onLine) {
    if (!renderCachedMatch(query)) {
      message.textContent = '';
      results.innerHTML = '<div class="error-banner">Du bist offline. Für diese Suche ist noch keine Verbindung gespeichert. Unten kannst du andere gespeicherte Verbindungen öffnen.</div>';
    }
    return;
  }

  connectionController?.abort();
  connectionController = new AbortController();
  const controller = connectionController;
  message.textContent = 'Haltestellen werden über Transitous gesucht …';
  results.innerHTML = '<article class="panel loading-card">Verbindungen werden geladen …</article>';
  try {
    const [from, to] = await Promise.all([resolveStop(query.from, controller.signal), resolveStop(query.to, controller.signal)]);
    if (controller !== connectionController) return;
    message.textContent = `${from.name} → ${to.name}`;
    const url = buildJourneyUrl(from.id, to.id, query.date, query.time, query.mode);
    const data = await fetchJson(url, { signal: controller.signal });
    if (controller !== connectionController) return;
    const journeys = Array.isArray(data) ? data : Array.isArray(data?.itineraries) ? data.itineraries : Array.isArray(data?.journeys) ? data.journeys : [];
    const normalized = journeys.map(normalizeJourney).filter(Boolean);
    results.innerHTML = normalized.length ? normalized.map((journey, index) => journeyCard(journey, index, query)).join('') : '<article class="panel empty"><strong>Keine Verbindung gefunden.</strong><br>Ändere Uhrzeit, Datum oder Haltestelle. Noch nicht veröffentlichte Fahrpläne können ebenfalls leer sein.</article>';
    if (normalized.length) saveConnectionSnapshot(query, { from: from.name, to: to.name }, normalized);
  } catch (error) {
    if (controller !== connectionController || error.code === 'CANCELLED') return;
    message.textContent = '';
    const cached = renderCachedMatch(query);
    if (!cached) results.innerHTML = `<div class="error-banner">${esc(friendlyError(error))}<div class="error-actions"><button id="retryConnections" class="retry-button">Erneut versuchen</button><a class="button-link ghost" href="${esc(buildDbNavigatorUrl(query))}" target="_blank" rel="noopener noreferrer">Direkt im DB Navigator öffnen ↗</a></div></div>`;
    $('#retryConnections')?.addEventListener('click', searchConnections);
  }
}
function renderSettings() {
  renderPeople();
  $('#savedStop').textContent = state.stop?.name || 'keine';
}

function hydrateConnections() {
  const prefs = state.connectionPrefs || {};
  renderConnectionMarkets(prefs.marketId || '');
  $('#connectionFrom').value = typeof prefs.from === 'string' && prefs.from.trim() ? prefs.from : 'Wuppertal Hbf';
  $('#connectionTo').value = typeof prefs.to === 'string' ? prefs.to : '';
  $('#connectionMode').value = prefs.mode === 'arrival' ? 'arrival' : 'departure';
  const bounds = marketBounds();
  $('#connectionDate').value = parseDate(prefs.date) ? prefs.date : bounds.from;
  $('#connectionTime').value = /^\d{2}:\d{2}$/.test(prefs.time) ? prefs.time : '14:00';
}

function marketOpeningHours(market, dateIso = '') {
  const value = market?.openingHours;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const date = parseDate(dateIso);
    const weekday = date ? String(date.getDay()) : '';
    return String(value[dateIso] || value[weekday] || value.default || '').trim() || 'Noch nicht veröffentlicht – Marktlink prüfen';
  }
  return 'Noch nicht veröffentlicht – Marktlink prüfen';
}

function ticketRequirement(market) {
  if (market?.ticketRequired === true) return 'Ticket erforderlich';
  if (market?.ticketRequired === false) return 'Keine Ticketpflicht';
  const entry = String(market?.entry || '').toLocaleLowerCase('de');
  if (entry.includes('kein eintritt veröffentlicht') || entry.includes('preis offen')) return 'Vorab prüfen';
  if (entry.includes('ticket') || ((!entry.includes('kostenlos')) && (/\d/.test(entry) || entry.includes('euro') || entry.includes('€')))) return 'Ticket erforderlich';
  return 'Keine Ticketpflicht';
}

function marketLink(market) {
  if (market?.sourceUrl?.startsWith('https://')) return market.sourceUrl;
  const query = encodeURIComponent(`${market?.name || 'Weihnachtsmarkt'} ${market?.city || ''}`.trim());
  return `https://www.google.com/search?q=${query}`;
}

function clearPlannerConnections() {
  state.tripDraft.outboundOptions = [];
  state.tripDraft.returnOptions = [];
  state.tripDraft.selectedOutbound = '';
  state.tripDraft.selectedReturn = '';
  state.tripDraft.resolvedStops = null;
  state.tripDraft.connectionsCheckedAt = '';
}

function ensurePlannerDate() {
  if (!parseDate(state.tripDraft.date)) state.tripDraft.date = marketBounds().from;
}

function plannerParticipants() {
  const date = parseDate(state.tripDraft.date);
  if (!date) return [];
  return state.people.map(person => ({
    id: person.id,
    name: person.name,
    status: state.availability[availabilityKey(date, person.id)] || ''
  }));
}

function budgetForDraft(draft = state.tripDraft) {
  const market = markets.find(item => item.id === draft.marketId);
  const index = BUDGET_INDEX[draft.budgetLevel] ?? 1;
  return Number(market?.budget?.[index] || 0);
}

function selectedPlannerOption(direction, draft = state.tripDraft) {
  const list = direction === 'return' ? draft.returnOptions : draft.outboundOptions;
  const selected = direction === 'return' ? draft.selectedReturn : draft.selectedOutbound;
  return Array.isArray(list) ? list.find(option => option.id === selected) || null : null;
}

function renderPlannerPeople() {
  $('#plannerPersonCount').value = state.people.length;
  $('#plannerPeople').innerHTML = state.people.map((person, index) => `<div class="person-row"><input data-planner-person="${esc(person.id)}" value="${esc(person.name)}" aria-label="Name Person ${index + 1}"><button data-planner-remove="${esc(person.id)}" class="danger" ${state.people.length === 1 ? 'disabled' : ''}>Entfernen</button></div>`).join('');
  $$('[data-planner-person]').forEach(input => input.onchange = () => {
    const person = state.people.find(item => item.id === input.dataset.plannerPerson);
    if (!person) return;
    person.name = input.value.trim() || `Person ${state.people.indexOf(person) + 1}`;
    saveAll();
    renderPeople();
    renderPlannerAvailability();
  });
  $$('[data-planner-remove]').forEach(button => button.onclick = () => removePlannerPerson(button.dataset.plannerRemove));
}

function syncPlannerPersonCount() {
  const requested = Math.min(20, Math.max(1, Number($('#plannerPersonCount').value) || 1));
  while (state.people.length < requested) state.people.push({ id: uid(), name: `Person ${state.people.length + 1}` });
  while (state.people.length > requested && state.people.length > 1) {
    const removed = state.people.pop();
    for (const key of Object.keys(state.availability)) if (key.endsWith(`|${removed.id}`)) delete state.availability[key];
  }
  saveAll();
  renderPlannerPeople();
  renderPeople();
}

function removePlannerPerson(id) {
  if (state.people.length <= 1) return;
  state.people = state.people.filter(person => person.id !== id);
  for (const key of Object.keys(state.availability)) if (key.endsWith(`|${id}`)) delete state.availability[key];
  saveAll();
  renderPlannerPeople();
  renderPlannerAvailability();
  renderPeople();
}

function renderPlannerAvailability() {
  ensurePlannerDate();
  $('#plannerDate').value = state.tripDraft.date;
  const date = parseDate(state.tripDraft.date);
  if (!date) return;
  $('#plannerAvailability').innerHTML = state.people.map(person => {
    const key = availabilityKey(date, person.id);
    const current = state.availability[key] || '';
    return `<div class="availability-row"><strong>${esc(person.name)}</strong><div class="segmented" role="group" aria-label="Verfügbarkeit ${esc(person.name)}">${['Ja', 'Vielleicht', 'Nein'].map(value => `<button class="${current === value ? 'active' : ''}" data-planner-avail="${esc(key)}" data-value="${value}" aria-pressed="${current === value}">${value}</button>`).join('')}</div></div>`;
  }).join('');
  $$('[data-planner-avail]').forEach(button => button.onclick = () => {
    state.availability[button.dataset.plannerAvail] = button.dataset.value;
    saveAll();
    renderPlannerAvailability();
    renderTimeline();
    renderHome();
  });
  const openCount = markets.filter(market => openOn(market, date)).length;
  $('#plannerDateHint').textContent = `${openCount} Weihnachtsmärkte sind an diesem Datum geöffnet.`;
}

function hydratePlannerFilters(openMarkets = markets) {
  const citySelect = $('#plannerCityFilter');
  if (!citySelect) return;
  const filters = state.plannerFilters;
  const cities = [...new Set(openMarkets.map(market => market.city))].sort((a, b) => a.localeCompare(b, 'de'));
  citySelect.innerHTML = '<option value="all">Alle Städte</option>' + cities.map(city => `<option value="${esc(city)}">${esc(city)}</option>`).join('');
  if (!cities.includes(filters.city)) filters.city = 'all';
  $('#plannerMarketSearch').value = filters.query || '';
  citySelect.value = filters.city || 'all';
  $('#plannerTravelFilter').value = filters.travel || '999';
  $('#plannerFeatureFilter').value = filters.feature || 'all';
  $('#plannerSortFilter').value = filters.sort || 'score';
  if (!$('#plannerTravelFilter').value) $('#plannerTravelFilter').value = filters.travel = '999';
  if (!$('#plannerFeatureFilter').value) $('#plannerFeatureFilter').value = filters.feature = 'all';
  if (!$('#plannerSortFilter').value) $('#plannerSortFilter').value = filters.sort = 'score';
}

function readPlannerFilters() {
  state.plannerFilters = {
    query: $('#plannerMarketSearch').value.trim(),
    city: $('#plannerCityFilter').value,
    travel: $('#plannerTravelFilter').value,
    feature: $('#plannerFeatureFilter').value,
    sort: $('#plannerSortFilter').value
  };
  saveAll();
  return state.plannerFilters;
}

function filteredPlannerMarkets(date, filters = state.plannerFilters) {
  if (!date) return [];
  const query = String(filters.query || '').toLocaleLowerCase('de');
  const travel = Number(filters.travel || 999);
  const list = markets.filter(market => {
    const haystack = [market.name, market.city, market.location, market.tip, ...(market.tags || [])].join(' ').toLocaleLowerCase('de');
    return openOn(market, date)
      && (!query || haystack.includes(query))
      && (filters.city === 'all' || !filters.city || market.city === filters.city)
      && market.travel <= travel
      && matchesFeature(market, filters.feature || 'all');
  });
  return sortMarketList(list, filters.sort);
}

function plannerMarketCard(market) {
  const selected = state.tripDraft.marketId === market.id;
  const hours = marketOpeningHours(market, state.tripDraft.date);
  return `<article class="card planner-market ${selected ? 'selected' : ''}">
    ${selected ? '<span class="badge gold selected-badge">✓ Verbindlich ausgewählt</span>' : ''}
    <h3>${esc(market.name)}</h3>
    <p>${esc(market.city)} · ${esc(market.location)}</p>
    <div class="market-facts"><span class="badge">🕒 ${esc(hours)}</span><span class="badge">🚆 ca. ${market.travel} Min.</span><span class="badge gold">${esc(market.entry)}</span><span class="badge">🎟 ${esc(ticketRequirement(market))}</span></div>
    <p class="planner-ratings">Cozy ${stars(market.cozy)} · Licht ${stars(market.light)} · Essen ${stars(market.food)}</p>
    <div class="card-actions"><button class="${selected ? 'ghost market-deselect' : ''}" data-planner-market="${esc(market.id)}" aria-pressed="${selected}">${selected ? 'Auswahl aufheben' : 'Verbindlich auswählen'}</button><button class="ghost" data-detail="${esc(market.id)}">Details</button></div>
  </article>`;
}

function togglePlannerMarket(marketId) {
  const selected = state.tripDraft.marketId === marketId;
  clearPlannerConnections();
  state.tripDraft.marketId = selected ? '' : marketId;
  saveAll();
  renderPlannerMarkets();
  renderPlannerBudget();
  $('#plannerMessage').textContent = selected ? 'Marktauswahl aufgehoben.' : 'Markt verbindlich für diesen Tag ausgewählt.';
}

function renderPlannerMarkets() {
  const date = parseDate(state.tripDraft.date);
  const target = $('#plannerMarkets');
  const summary = $('#plannerFilterSummary');
  const selection = $('#plannerSelectedMarket');
  if (!date) {
    target.innerHTML = '<div class="empty">Bitte zuerst ein gültiges Datum wählen.</div>';
    summary.textContent = '';
    selection.hidden = true;
    return;
  }
  const openMarkets = markets.filter(market => openOn(market, date));
  hydratePlannerFilters(openMarkets);
  const available = filteredPlannerMarkets(date);
  if (!openMarkets.some(market => market.id === state.tripDraft.marketId)) {
    state.tripDraft.marketId = '';
    clearPlannerConnections();
    saveAll();
  }
  const chosen = openMarkets.find(market => market.id === state.tripDraft.marketId);
  selection.hidden = !chosen;
  selection.innerHTML = chosen ? `<div><span>Aktuelle Auswahl</span><strong>${esc(chosen.name)}</strong></div><button type="button" class="ghost compact-button" data-clear-planner-market="${esc(chosen.id)}">Auswahl aufheben</button>` : '';
  summary.textContent = `${available.length} von ${openMarkets.length} geöffneten Märkten passen zum Filter.`;
  target.innerHTML = available.length ? available.map(plannerMarketCard).join('') : '<div class="empty"><strong>Keine Treffer.</strong><br>Filter zurücksetzen oder einen anderen Begriff wählen.</div>';
  $$('[data-planner-market]').forEach(button => button.onclick = () => togglePlannerMarket(button.dataset.plannerMarket));
  $('[data-clear-planner-market]')?.addEventListener('click', event => togglePlannerMarket(event.currentTarget.dataset.clearPlannerMarket));
  $$('#plannerMarkets [data-detail]').forEach(button => button.onclick = () => showDetail(button.dataset.detail));
}

function syncPlannerConfigFromInputs() {
  const draft = state.tripDraft;
  draft.arrival = $('#plannerArrival').value || '15:00';
  draft.returnEnabled = $('#plannerReturnEnabled').checked;
  draft.returnTime = $('#plannerReturnTime').value || '20:00';
  draft.budgetLevel = ['saving', 'normal', 'activity'].includes($('#plannerBudgetLevel').value) ? $('#plannerBudgetLevel').value : 'normal';
  draft.activityType = $('#plannerActivityType').value;
  draft.activity = $('#plannerActivity').value.trim();
  draft.ticketStatus = $('#plannerTicketStatus').value;
  draft.meetingPoint = $('#plannerMeetingPoint').value.trim();
  draft.status = TRIP_STATUSES.includes($('#plannerStatus').value) ? $('#plannerStatus').value : 'Idee';
  draft.notes = $('#plannerNotes').value.trim();
  saveAll();
}

function hydratePlannerConfig() {
  const draft = state.tripDraft;
  $('#plannerArrival').value = draft.arrival || '15:00';
  $('#plannerReturnEnabled').checked = Boolean(draft.returnEnabled);
  $('#plannerReturnTime').value = draft.returnTime || '20:00';
  $('#plannerReturnWrap').hidden = !draft.returnEnabled;
  $('#plannerReturnSection').hidden = !draft.returnEnabled;
  $('#plannerBudgetLevel').value = ['saving', 'normal', 'activity'].includes(draft.budgetLevel) ? draft.budgetLevel : 'normal';
  $('#plannerActivityType').value = draft.activityType || 'Städtetrip';
  $('#plannerActivity').value = draft.activity || '';
  $('#plannerTicketStatus').value = draft.ticketStatus || 'Noch nicht geprüft';
  $('#plannerMeetingPoint').value = draft.meetingPoint || 'Wuppertal Hbf';
  $('#plannerStatus').value = TRIP_STATUSES.includes(draft.status) ? draft.status : 'Idee';
  $('#plannerNotes').value = draft.notes || '';
  renderPlannerBudget();
}

function renderPlannerBudget() {
  const market = markets.find(item => item.id === state.tripDraft.marketId);
  const perPerson = budgetForDraft();
  const participants = plannerParticipants().filter(person => person.status !== 'Nein');
  const count = participants.length || state.people.length;
  $('#plannerBudgetInfo').innerHTML = market ? `<strong>${esc(market.name)}</strong><br>${esc(state.tripDraft.budgetLevel === 'saving' ? 'Sparsam' : state.tripDraft.budgetLevel === 'activity' ? 'Mit Aktivität' : 'Normal')}: <strong>${perPerson} € pro Person</strong> · ${count} Person${count === 1 ? '' : 'en'} · <strong>${perPerson * count} € gesamt</strong>` : 'Bitte zuerst einen Markt auswählen.';
}

function plannerOptionId(journey) {
  return `j-${String(journey.departure).replace(/\W/g, '')}-${String(journey.arrival).replace(/\W/g, '')}-${journey.transfers}`;
}

function transferWarnings(journey) {
  const publicLegs = (journey?.legs || []).filter(leg => !leg.walking);
  const warnings = [];
  for (let index = 1; index < publicLegs.length; index += 1) {
    const minutes = durationMinutes(publicLegs[index - 1].arrival, publicLegs[index].departure);
    if (minutes > 0 && minutes < 9) warnings.push(`Knapp: nur ${minutes} Min. Umstieg in ${publicLegs[index - 1].destination}`);
  }
  return warnings;
}

function selectPlannerJourneys(journeys, direction, targetIso) {
  const normalized = journeys.map(journey => journey?.departure && Array.isArray(journey?.legs) && typeof journey.legs[0]?.origin === 'string' ? journey : normalizeJourney(journey)).filter(Boolean);
  const unique = [...new Map(normalized.map(journey => [plannerOptionId(journey), journey])).values()];
  const target = new Date(targetIso).getTime();
  const timing = journey => {
    const point = new Date(direction === 'outbound' ? journey.arrival : journey.departure).getTime();
    const minutes = Math.abs(point - target) / 60000;
    const wrongSide = direction === 'outbound' ? point > target : point < target;
    return minutes + (wrongSide ? 240 : 0);
  };
  const recommended = [...unique].sort((a, b) => (a.duration + a.transfers * 28 + timing(a) * .35) - (b.duration + b.transfers * 28 + timing(b) * .35))[0];
  const fewTransfers = [...unique].sort((a, b) => a.transfers - b.transfers || timing(a) - timing(b) || a.duration - b.duration)[0];
  const fastest = [...unique].sort((a, b) => a.duration - b.duration || timing(a) - timing(b) || a.transfers - b.transfers)[0];
  const sensible = unique.filter(journey => timing(journey) < 241);
  const safety = [...(sensible.length ? sensible : unique)].sort((a, b) => direction === 'outbound'
    ? new Date(a.arrival) - new Date(b.arrival)
    : new Date(b.departure) - new Date(a.departure))[0];
  const chosen = [];
  for (const journey of [recommended, fewTransfers, fastest]) if (journey && !chosen.includes(journey)) chosen.push(journey);
  if (safety && !chosen.includes(safety)) {
    if (chosen.length >= 3) {
      const redundantFew = chosen.findIndex(journey => journey === fewTransfers && journey !== recommended && journey.transfers === recommended?.transfers);
      chosen[redundantFew >= 0 ? redundantFew : 2] = safety;
    } else chosen.push(safety);
  }
  for (const journey of [...unique].sort((a, b) => timing(a) - timing(b))) if (chosen.length < 3 && !chosen.includes(journey)) chosen.push(journey);
  const minimumTransfers = unique.length ? Math.min(...unique.map(journey => journey.transfers)) : 0;
  return chosen.slice(0, 3).map(journey => {
    const roles = [];
    if (journey === recommended) roles.push('Empfohlen');
    if (journey === fewTransfers || journey.transfers === minimumTransfers) roles.push('Wenig Umstiege');
    if (journey === fastest) roles.push('Schnellste Verbindung');
    if (journey === safety) roles.push('Sicherheitsverbindung');
    if (direction === 'return' && journey === safety) roles.push('Letzte sinnvolle Rückfahrt');
    return { id: plannerOptionId(journey), journey, roles, warnings: transferWarnings(journey) };
  });
}

function plannerConnectionCard(option, direction) {
  const journey = option.journey;
  const selected = (direction === 'return' ? state.tripDraft.selectedReturn : state.tripDraft.selectedOutbound) === option.id;
  const first = journey.legs[0];
  const last = journey.legs.at(-1);
  const products = [...new Set(journey.legs.filter(leg => !leg.walking).map(legName))].join(' · ') || 'Fußweg';
  const warnings = option.warnings || transferWarnings(journey);
  const query = option.query || {};
  return `<article class="panel connection-card selectable ${selected ? 'selected' : ''}">
    <div class="option-labels">${(option.roles || []).map(role => `<span class="badge ${role === 'Sicherheitsverbindung' || role === 'Letzte sinnvolle Rückfahrt' ? 'gold' : ''}">${esc(role)}</span>`).join('')}</div>
    <div class="connection-head"><div><span class="connection-time">${connectionTime(journey.departure)} → ${connectionTime(journey.arrival)}</span><p>${esc(first.origin)} → ${esc(last.destination)}</p></div><strong>${durationLabel(journey.duration)}</strong></div>
    <div class="connection-meta"><span class="badge">${journey.transfers ? `${journey.transfers}× umsteigen` : 'Direkt'}</span><span class="badge">${esc(products)}</span>${warnings.map(warning => `<span class="badge warning">⚠ ${esc(warning)}</span>`).join('')}</div>
    <details><summary>Etappen anzeigen</summary><ol class="legs">${journey.legs.map(leg => `<li><span class="leg-time">${connectionTime(leg.departure)}–${connectionTime(leg.arrival)}</span><strong>${esc(legName(leg))}</strong><span>${esc(leg.origin)} → ${esc(leg.destination)}${leg.platform ? ` · Gleis ${esc(leg.platform)}` : ''}</span></li>`).join('')}</ol></details>
    <div class="card-actions"><button data-select-planner-connection="${esc(direction)}|${esc(option.id)}">${selected ? 'Gewählt ✓' : 'Diese Verbindung wählen'}</button><a class="button-link ghost" href="${esc(buildDbNavigatorUrl(query))}" target="_blank" rel="noopener noreferrer">DB Navigator ↗</a></div>
  </article>`;
}

function renderPlannerConnections() {
  const draft = state.tripDraft;
  const market = markets.find(item => item.id === draft.marketId);
  $('#plannerRoute').textContent = market ? `Standard: Wuppertal Hbf → ${market.stationQuery || market.location}${draft.returnEnabled ? ' → Wuppertal Hbf' : ''}` : 'Bitte zuerst einen Markt auswählen.';
  $('#plannerReturnSection').hidden = !draft.returnEnabled;
  $('#plannerOutbound').innerHTML = draft.outboundOptions?.length ? draft.outboundOptions.map(option => plannerConnectionCard(option, 'outbound')).join('') : '<p class="muted">Noch keine Hinfahrt geladen.</p>';
  $('#plannerReturn').innerHTML = draft.returnEnabled ? (draft.returnOptions?.length ? draft.returnOptions.map(option => plannerConnectionCard(option, 'return')).join('') : '<p class="muted">Noch keine Rückfahrt geladen.</p>') : '';
  $$('[data-select-planner-connection]').forEach(button => button.onclick = () => {
    const [direction, id] = button.dataset.selectPlannerConnection.split('|');
    if (direction === 'return') state.tripDraft.selectedReturn = id;
    else state.tripDraft.selectedOutbound = id;
    saveAll();
    renderPlannerConnections();
  });
}

async function fetchPlannerJourneys(from, to, date, time, mode, signal) {
  const data = await fetchJson(buildJourneyUrl(from.id, to.id, date, time, mode), { signal });
  return Array.isArray(data) ? data : Array.isArray(data?.itineraries) ? data.itineraries : Array.isArray(data?.journeys) ? data.journeys : [];
}

async function loadPlannerConnections() {
  syncPlannerConfigFromInputs();
  const draft = state.tripDraft;
  const market = markets.find(item => item.id === draft.marketId);
  const message = $('#plannerConnectionMessage');
  if (!market || !parseDate(draft.date)) { message.textContent = 'Bitte zuerst Datum und Markt auswählen.'; return; }
  if (!navigator.onLine) { message.textContent = 'Du bist offline. Zum Prüfen der Verbindungen wird Internet benötigt.'; return; }
  plannerController?.abort();
  plannerController = new AbortController();
  const controller = plannerController;
  message.textContent = 'Haltestellen und Verbindungen werden über Transitous geladen …';
  $('#plannerOutbound').innerHTML = '<article class="panel loading-card">Hinfahrt wird gesucht …</article>';
  if (draft.returnEnabled) $('#plannerReturn').innerHTML = '<article class="panel loading-card">Rückfahrt wird gesucht …</article>';
  try {
    const [home, destination] = await Promise.all([
      resolveStop('Wuppertal Hbf', controller.signal),
      resolveStop(market.stationQuery || market.location, controller.signal)
    ]);
    const outboundQuery = { from: 'Wuppertal Hbf', to: market.stationQuery || market.location, date: draft.date, time: draft.arrival, mode: 'arrival', marketId: market.id };
    const returnQuery = { from: market.stationQuery || market.location, to: 'Wuppertal Hbf', date: draft.date, time: draft.returnTime, mode: 'departure', marketId: market.id };
    const requests = [fetchPlannerJourneys(home, destination, draft.date, draft.arrival, 'arrival', controller.signal)];
    if (draft.returnEnabled) requests.push(fetchPlannerJourneys(destination, home, draft.date, draft.returnTime, 'departure', controller.signal));
    const [outboundRaw, returnRaw = []] = await Promise.all(requests);
    if (controller !== plannerController) return;
    const outbound = selectPlannerJourneys(outboundRaw, 'outbound', `${draft.date}T${draft.arrival}:00+01:00`).map(option => ({ ...option, query: outboundQuery }));
    const returns = draft.returnEnabled ? selectPlannerJourneys(returnRaw, 'return', `${draft.date}T${draft.returnTime}:00+01:00`).map(option => ({ ...option, query: returnQuery })) : [];
    draft.outboundOptions = outbound;
    draft.returnOptions = returns;
    draft.selectedOutbound = outbound[0]?.id || '';
    draft.selectedReturn = returns[0]?.id || '';
    draft.resolvedStops = { home, destination };
    draft.connectionsCheckedAt = new Date().toISOString();
    saveAll();
    message.textContent = outbound.length ? `Geprüft: ${outbound.length} Hinfahrt${draft.returnEnabled ? ` und ${returns.length} Rückfahrt` : ''}. Bitte je eine Verbindung auswählen.` : 'Keine passende Hinfahrt gefunden. Ändere Uhrzeit oder prüfe direkt im DB Navigator.';
    renderPlannerConnections();
  } catch (error) {
    if (controller !== plannerController || error.code === 'CANCELLED') return;
    message.textContent = friendlyError(error, 'Trip-Verbindungssuche');
    renderPlannerConnections();
  }
}

function connectionSummary(option) {
  if (!option?.journey) return 'Nicht gewählt';
  const journey = option.journey;
  const products = [...new Set(journey.legs.filter(leg => !leg.walking).map(legName))].join(', ');
  return `${connectionTime(journey.departure)}–${connectionTime(journey.arrival)} · ${durationLabel(journey.duration)} · ${journey.transfers ? `${journey.transfers}× umsteigen` : 'direkt'}${products ? ` · ${products}` : ''}`;
}

function tripFromDraft() {
  syncPlannerConfigFromInputs();
  const draft = state.tripDraft;
  const market = markets.find(item => item.id === draft.marketId);
  if (!market) return null;
  const people = plannerParticipants();
  const budget = budgetForDraft(draft);
  const countedPeople = people.filter(person => person.status !== 'Nein');
  const outbound = selectedPlannerOption('outbound', draft);
  const returnOption = draft.returnEnabled ? selectedPlannerOption('return', draft) : null;
  return {
    id: editingTripId || makeId('trip'),
    date: draft.date,
    people,
    marketId: market.id,
    market: market.name,
    city: market.city,
    location: market.location,
    station: market.stationQuery || market.location,
    openingHours: marketOpeningHours(market, draft.date),
    marketUrl: marketLink(market),
    entry: market.entry,
    ticketRequirement: ticketRequirement(market),
    arrival: draft.arrival,
    returnEnabled: Boolean(draft.returnEnabled),
    returnTime: draft.returnTime,
    budgetLevel: draft.budgetLevel,
    budget,
    totalBudget: budget * countedPeople.length,
    activityType: draft.activityType,
    activity: draft.activity,
    notes: draft.notes,
    ticketStatus: draft.ticketStatus,
    meetingPoint: draft.meetingPoint,
    status: draft.status,
    outbound,
    returnJourney: returnOption,
    outboundOptions: draft.outboundOptions,
    returnOptions: draft.returnOptions,
    updatedAt: new Date().toISOString()
  };
}

function renderPlannerSummary() {
  const trip = tripFromDraft();
  if (!trip) { $('#plannerSummary').innerHTML = '<div class="error-banner">Markt fehlt.</div>'; return; }
  const going = trip.people.filter(person => person.status !== 'Nein');
  const no = trip.people.filter(person => person.status === 'Nein');
  $('#plannerSummary').innerHTML = `<div class="summary-grid">
    <div><span>Datum</span><strong>${esc(formatDate(trip.date))}</strong></div>
    <div><span>Status</span><strong>${esc(trip.status)}</strong></div>
    <div class="wide"><span>Personen</span><strong>${esc(going.map(person => `${person.name} (${person.status})`).join(', ') || 'Keine Zusage')}</strong>${no.length ? `<small>Nein: ${esc(no.map(person => person.name).join(', '))}</small>` : ''}</div>
    <div class="wide"><span>Weihnachtsmarkt</span><strong>${esc(trip.market)}</strong><small>${esc(trip.location)} · ${esc(trip.openingHours)}</small></div>
    <div><span>Aktivität</span><strong>${esc(trip.activityType)}</strong><small>${esc(trip.activity || 'Keine Zusatzaktivität')}</small></div>
    <div><span>Budget</span><strong>${trip.budget} € p. P.</strong><small>${trip.totalBudget} € gesamt (${going.length} Personen)</small></div>
    <div class="wide"><span>Hinfahrt</span><strong>${esc(connectionSummary(trip.outbound))}</strong></div>
    <div class="wide"><span>Rückfahrt</span><strong>${esc(trip.returnEnabled ? connectionSummary(trip.returnJourney) : 'Nicht geplant')}</strong></div>
    <div><span>Eintritt</span><strong>${esc(trip.entry)}</strong></div>
    <div><span>Ticket</span><strong>${esc(trip.ticketRequirement)}</strong><small>Status: ${esc(trip.ticketStatus)}</small></div>
    <div class="wide"><span>Treffpunkt</span><strong>${esc(trip.meetingPoint || 'Nicht festgelegt')}</strong></div>
    ${trip.notes ? `<div class="wide"><span>Notizen</span><strong>${esc(trip.notes)}</strong></div>` : ''}
    <div class="wide important-note"><span>Wichtige Hinweise</span><strong>${trip.outbound?.warnings?.length || trip.returnJourney?.warnings?.length ? esc([...(trip.outbound?.warnings || []), ...(trip.returnJourney?.warnings || [])].join(' · ')) : 'Verbindungen und Marktinformationen kurz vor Abfahrt erneut prüfen.'}</strong></div>
  </div>`;
}

function validatePlannerStep(step = plannerStep) {
  ensurePlannerDate();
  if (step === 1) {
    if (!state.people.length || state.people.some(person => !person.name.trim())) return 'Bitte für jede Person einen Namen eingeben.';
  }
  if (step === 2) {
    const date = parseDate(state.tripDraft.date);
    if (!date) return 'Bitte ein gültiges Datum wählen.';
    const missing = state.people.filter(person => !state.availability[availabilityKey(date, person.id)]);
    if (missing.length) return `Bitte Verfügbarkeit eintragen: ${missing.map(person => person.name).join(', ')}.`;
    if (state.people.every(person => state.availability[availabilityKey(date, person.id)] === 'Nein')) return 'Mindestens eine Person muss Ja oder Vielleicht wählen.';
  }
  if (step === 3) {
    const market = markets.find(item => item.id === state.tripDraft.marketId);
    const date = parseDate(state.tripDraft.date);
    if (!market || !date || !openOn(market, date)) return 'Bitte einen an diesem Tag geöffneten Markt verbindlich auswählen.';
  }
  if (step === 4) {
    syncPlannerConfigFromInputs();
    if (!/^\d{2}:\d{2}$/.test(state.tripDraft.arrival)) return 'Bitte eine gewünschte Ankunft eintragen.';
    if (state.tripDraft.returnEnabled && !/^\d{2}:\d{2}$/.test(state.tripDraft.returnTime)) return 'Bitte eine Rückfahrtzeit eintragen.';
    if (!state.tripDraft.meetingPoint) return 'Bitte einen Treffpunkt eintragen.';
  }
  if (step === 5) {
    if (!selectedPlannerOption('outbound')) return 'Bitte Hinfahrt laden und eine Option wählen.';
    if (state.tripDraft.returnEnabled && !selectedPlannerOption('return')) return 'Bitte Rückfahrt laden und eine Option wählen.';
  }
  return '';
}

function setPlannerStep(step, force = false) {
  if (!force && step > plannerStep) {
    const error = validatePlannerStep(plannerStep);
    if (error) { $('#plannerMessage').textContent = error; return false; }
  }
  plannerStep = Math.min(6, Math.max(1, step));
  $('.planner-step[data-step="1"]');
  $$('.planner-step').forEach(section => { section.hidden = Number(section.dataset.step) !== plannerStep; });
  $$('[data-progress]').forEach(item => {
    const value = Number(item.dataset.progress);
    item.classList.toggle('active', value === plannerStep);
    item.classList.toggle('done', value < plannerStep);
  });
  $('#plannerBack').hidden = plannerStep === 1;
  $('#plannerNext').hidden = plannerStep === 6;
  $('#plannerStepLabel').textContent = `Schritt ${plannerStep} von 6`;
  $('#plannerMessage').textContent = '';
  if (plannerStep === 1) renderPlannerPeople();
  if (plannerStep === 2) renderPlannerAvailability();
  if (plannerStep === 3) renderPlannerMarkets();
  if (plannerStep === 4) hydratePlannerConfig();
  if (plannerStep === 5) renderPlannerConnections();
  if (plannerStep === 6) renderPlannerSummary();
  return true;
}

function newPlanner() {
  plannerController?.abort();
  editingTripId = '';
  state.tripDraft = { ...DEFAULT_DRAFT, date: marketBounds().from };
  saveAll();
  setPlannerStep(1, true);
  $('#plannerSaveMessage').textContent = '';
}

function startPlannerForMarket(marketId) {
  const market = markets.find(item => item.id === marketId);
  if (!market) return;
  editingTripId = '';
  state.tripDraft = { ...DEFAULT_DRAFT, date: firstDate(market), marketId: market.id };
  saveAll();
  setView('trip');
  setPlannerStep(4, true);
  $('#plannerMessage').textContent = `${market.name} wurde verbindlich übernommen.`;
}

function savePlannedTrip() {
  const error = validatePlannerStep(5);
  if (error) { $('#plannerSaveMessage').textContent = error; return null; }
  const trip = tripFromDraft();
  if (!trip) return null;
  const existing = state.trips.findIndex(item => item.id === trip.id);
  if (existing >= 0) trip.createdAt = state.trips[existing].createdAt || trip.updatedAt;
  else trip.createdAt = trip.updatedAt;
  if (existing >= 0) state.trips[existing] = trip;
  else state.trips.push(trip);
  editingTripId = trip.id;
  saveAll();
  renderSavedTrips();
  $('#plannerSaveMessage').textContent = existing >= 0 ? 'Änderungen lokal gespeichert.' : 'Trip lokal gespeichert.';
  return trip;
}

function editSavedTrip(id, targetStep = 4) {
  const trip = state.trips.find(item => item.id === id);
  if (!trip) return;
  editingTripId = trip.id;
  state.tripDraft = {
    ...DEFAULT_DRAFT,
    date: trip.date,
    marketId: trip.marketId,
    arrival: trip.arrival || trip.start || '15:00',
    returnEnabled: Boolean(trip.returnEnabled),
    returnTime: trip.returnTime || trip.end || '20:00',
    budgetLevel: trip.budgetLevel || 'normal',
    activityType: trip.activityType || 'Städtetrip',
    activity: trip.activity || '', notes: trip.notes || '', ticketStatus: trip.ticketStatus || 'Noch nicht geprüft',
    meetingPoint: trip.meetingPoint || 'Wuppertal Hbf', status: trip.status || 'Idee',
    outboundOptions: Array.isArray(trip.outboundOptions) ? trip.outboundOptions : trip.outbound ? [trip.outbound] : [],
    returnOptions: Array.isArray(trip.returnOptions) ? trip.returnOptions : trip.returnJourney ? [trip.returnJourney] : [],
    selectedOutbound: trip.outbound?.id || '', selectedReturn: trip.returnJourney?.id || '',
    connectionsCheckedAt: trip.updatedAt || ''
  };
  saveAll();
  setView('trip');
  setPlannerStep(targetStep, true);
}

function deleteSavedTrip(id) {
  if (!confirm('Diesen Trip wirklich löschen?')) return;
  state.trips = state.trips.filter(trip => trip.id !== id);
  if (editingTripId === id) newPlanner();
  saveAll();
  renderSavedTrips();
}

function statusClass(status) {
  return `status-${String(status || 'Idee').toLocaleLowerCase('de').replaceAll(' ', '-')}`;
}

function renderSavedTrips() {
  const sorted = [...state.trips].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.market).localeCompare(String(b.market), 'de'));
  $('#savedTrips').innerHTML = sorted.length ? sorted.map(trip => `<article class="card saved-trip">
    <span class="badge trip-status ${statusClass(trip.status)}">${esc(trip.status || 'Idee')}</span>
    <h3>${esc(formatDate(trip.date))} · ${esc(trip.market || 'Weihnachtsmarkt')}</h3>
    <p>${esc(trip.activity || trip.activityType || 'Nur Weihnachtsmarkt')} · ${Number(trip.budget) || 0} € p. P.</p>
    <p class="muted">${esc((trip.people || []).filter(person => person.status !== 'Nein').map(person => person.name).join(', ') || trip.stop || 'Personen nicht hinterlegt')}</p>
    <div class="card-actions"><button data-edit-trip="${esc(trip.id)}">Bearbeiten</button><button class="secondary" data-ics-trip="${esc(trip.id)}">.ics</button><button class="ghost" data-check-trip="${esc(trip.id)}">Bahn prüfen</button><button data-delete-trip="${esc(trip.id)}" class="danger">Löschen</button></div>
  </article>`).join('') : '<p>Noch keine Trips gespeichert.</p>';
  $$('[data-edit-trip]').forEach(button => button.onclick = () => editSavedTrip(button.dataset.editTrip));
  $$('[data-check-trip]').forEach(button => button.onclick = () => editSavedTrip(button.dataset.checkTrip, 5));
  $$('[data-delete-trip]').forEach(button => button.onclick = () => deleteSavedTrip(button.dataset.deleteTrip));
  $$('[data-ics-trip]').forEach(button => button.onclick = () => {
    const trip = state.trips.find(item => item.id === button.dataset.icsTrip);
    if (trip) shareTripIcs(trip);
  });
}

function renderTrip() {
  ensurePlannerDate();
  renderPlannerPeople();
  renderPlannerAvailability();
  renderPlannerMarkets();
  hydratePlannerConfig();
  renderPlannerConnections();
  renderSavedTrips();
  setPlannerStep(plannerStep, true);
}

function icsEscape(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function foldIcs(text) {
  return text.split('\r\n').flatMap(line => {
    const encoder = new TextEncoder();
    const parts = [];
    let current = '';
    for (const char of line) {
      if (current && encoder.encode(current + char).length > 75) {
        parts.push(current);
        current = ` ${char}`;
      } else current += char;
    }
    parts.push(current);
    return parts;
  }).join('\r\n');
}

function icsDateTime(value, fallbackDate, fallbackTime) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (match) return `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}00`;
  return `${String(fallbackDate || '').replaceAll('-', '')}T${String(fallbackTime || '14:00').replace(':', '')}00`;
}

function makeIcs(trip) {
  const outbound = trip.outbound?.journey || null;
  const inbound = trip.returnJourney?.journey || null;
  const start = icsDateTime(outbound?.departure, trip.date, trip.start || trip.arrival || '14:00');
  let end = icsDateTime(inbound?.arrival, trip.date, trip.end || trip.returnTime || '20:00');
  if (end <= start) {
    const base = parseDate(trip.date);
    if (base) base.setDate(base.getDate() + 1);
    end = `${(base ? isoLocal(base) : trip.date).replaceAll('-', '')}T${String(trip.end || trip.returnTime || '20:00').replace(':', '')}00`;
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const people = Array.isArray(trip.people) ? trip.people.map(person => `${person.name} (${person.status || 'ohne Status'})`).join(', ') : '';
  const outboundText = trip.outbound ? connectionSummary(trip.outbound) : 'nicht gewählt';
  const returnText = trip.returnEnabled ? connectionSummary(trip.returnJourney) : 'nicht geplant';
  const marketUrl = trip.marketUrl || '';
  const outboundDb = trip.outbound?.query ? buildDbNavigatorUrl(trip.outbound.query) : '';
  const returnDb = trip.returnJourney?.query ? buildDbNavigatorUrl(trip.returnJourney.query) : '';
  const description = [
    people ? `Namen: ${people}` : '',
    `Öffnungszeiten: ${trip.openingHours || 'nicht hinterlegt'}`,
    `Aktivität: ${trip.activityType ? `${trip.activityType}${trip.activity ? ` – ${trip.activity}` : ''}` : trip.activity || 'keine'}`,
    `Hinfahrt: ${outboundText}`,
    `Rückfahrt: ${returnText}`,
    `Treffpunkt: ${trip.meetingPoint || trip.stop || 'nicht festgelegt'}`,
    `Budget: ${Number(trip.budget) || 0} € pro Person${Number.isFinite(trip.totalBudget) ? `, ${trip.totalBudget} € gesamt` : ''}`,
    `Eintritt: ${trip.entry || 'nicht hinterlegt'}`,
    `Ticketpflicht: ${trip.ticketRequirement || 'nicht hinterlegt'}`,
    `Ticketstatus: ${trip.ticketStatus || 'nicht geprüft'}`,
    trip.notes ? `Notizen: ${trip.notes}` : '',
    marketUrl ? `Marktlink: ${marketUrl}` : '',
    outboundDb ? `DB Navigator Hinfahrt: ${outboundDb}` : '',
    returnDb ? `DB Navigator Rückfahrt: ${returnDb}` : ''
  ].filter(Boolean).join('\n');
  return foldIcs(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nCALSCALE:GREGORIAN\r\nPRODID:-//Way to Winter Magic V${VERSION}//DE\r\nBEGIN:VEVENT\r\nUID:${Date.now()}-${Math.random().toString(36).slice(2)}@way-to-winter-magic\r\nDTSTAMP:${stamp}\r\nDTSTART;TZID=Europe/Berlin:${start}\r\nDTEND;TZID=Europe/Berlin:${end}\r\nSUMMARY:${icsEscape('Weihnachtsmarkt: ' + trip.market)}\r\nLOCATION:${icsEscape(trip.location)}\r\nDESCRIPTION:${icsEscape(description)}\r\n${marketUrl ? `URL:${icsEscape(marketUrl)}\r\n` : ''}END:VEVENT\r\nEND:VCALENDAR\r\n`);
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

async function shareTripIcs(trip) {
  const file = new File([makeIcs(trip)], `Winter-Magic-${trip.date}-${String(trip.market || 'Trip').replace(/[^a-z0-9äöüß-]+/gi, '-')}.ics`, { type: 'text/calendar;charset=utf-8' });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: trip.market });
    else download(URL.createObjectURL(file), file.name);
  } catch (error) {
    if (error.name !== 'AbortError') download(URL.createObjectURL(file), file.name);
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
  renderSavedConnections();
}

function sanitizeImported(payload) {
  const source = payload?.state && typeof payload.state === 'object' ? payload.state : payload;
  if (!source || typeof source !== 'object') throw new Error('Ungültiges Format');
  const importedPeople = migratePeople(source.people);
  const imported = {
    people: importedPeople,
    availability: migrateAvailability(source.availability || {}, importedPeople, source.people),
    favorites: Array.isArray(source.favorites) ? [...new Set(source.favorites.map(String))].filter(id => markets.some(market => market.id === id)) : [],
    trips: Array.isArray(source.trips) ? source.trips.filter(trip => trip && parseDate(trip.date) && typeof trip.market === 'string').slice(0, 500).map((trip, index) => ({ ...trip, id: String(trip.id || `imported-trip-${index}-${Date.now().toString(36)}`), status: TRIP_STATUSES.includes(trip.status) ? trip.status : 'Idee' })) : [],
    tripDraft: source.tripDraft && typeof source.tripDraft === 'object' ? { ...DEFAULT_DRAFT, ...source.tripDraft } : { ...DEFAULT_DRAFT },
    stop: source.stop && typeof source.stop.name === 'string' ? source.stop : null,
    filters: source.filters && typeof source.filters === 'object' ? source.filters : {},
    plannerFilters: source.plannerFilters && typeof source.plannerFilters === 'object' ? { ...DEFAULT_PLANNER_FILTERS, ...source.plannerFilters } : { ...DEFAULT_PLANNER_FILTERS },
    viewMode: source.viewMode === 'list' ? 'list' : 'cards',
    connectionPrefs: source.connectionPrefs && typeof source.connectionPrefs === 'object' ? source.connectionPrefs : {},
    savedConnections: Array.isArray(source.savedConnections) ? source.savedConnections.filter(item => item && item.query && Array.isArray(item.journeys)).slice(0, MAX_SAVED_CONNECTIONS) : []
  };
  return imported;
}

function bind() {
  $$('.tabs button').forEach(button => button.onclick = () => setView(button.dataset.view));
  $$('[data-jump]').forEach(button => button.onclick = () => setView(button.dataset.jump));
  $('#cardView').onclick = () => setMarketView('cards');
  $('#listView').onclick = () => setMarketView('list');
  ['marketSearch', 'cityFilter', 'dateFilter', 'travelFilter', 'distanceFilter', 'featureFilter', 'sortFilter'].forEach(id => {
    $(`#${id}`).addEventListener(id === 'marketSearch' ? 'input' : 'change', renderMarkets);
  });
  $('#resetFilters').onclick = () => {
    state.filters = {};
    hydrateFilters();
    renderMarkets();
  };
  ['plannerMarketSearch', 'plannerCityFilter', 'plannerTravelFilter', 'plannerFeatureFilter', 'plannerSortFilter'].forEach(id => {
    $(`#${id}`).addEventListener(id === 'plannerMarketSearch' ? 'input' : 'change', () => {
      readPlannerFilters();
      renderPlannerMarkets();
    });
  });
  $('#resetPlannerFilters').onclick = () => {
    state.plannerFilters = { ...DEFAULT_PLANNER_FILTERS };
    saveAll();
    renderPlannerMarkets();
  };
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
  $('#connectionMarket').onchange = () => {
    const market = markets.find(item => item.id === $('#connectionMarket').value);
    if (market) {
      $('#connectionTo').value = market.stationQuery || market.location;
      if (!$('#connectionDate').value) $('#connectionDate').value = firstDate(market);
    }
  };
  $('#searchConnections').onclick = searchConnections;
  $('#clearSavedConnections').onclick = () => {
    if (!confirm('Alle offline gespeicherten Verbindungen löschen?')) return;
    state.savedConnections = []; saveAll(); renderSavedConnections(); $('#connectionResults').innerHTML = '';
  };
  ['connectionFrom', 'connectionTo'].forEach(id => $(`#${id}`).onkeydown = event => { if (event.key === 'Enter') searchConnections(); });
  $('#useSavedStop').onclick = () => {
    if (!state.stop?.name) {
      $('#connectionMessage').textContent = 'Unter „Mehr“ ist noch keine Zielhaltestelle gespeichert.';
      return;
    }
    $('#connectionTo').value = state.stop.name;
    $('#connectionMarket').value = '';
    $('#connectionMessage').textContent = `${state.stop.name} wurde übernommen.`;
  };
  $('#swapConnection').onclick = () => {
    const from = $('#connectionFrom').value;
    $('#connectionFrom').value = $('#connectionTo').value;
    $('#connectionTo').value = from;
    $('#connectionMarket').value = '';
  };
  $('#plannerPersonCount').onchange = syncPlannerPersonCount;
  $('#plannerAddPerson').onclick = () => {
    if (state.people.length >= 20) return;
    state.people.push({ id: uid(), name: `Person ${state.people.length + 1}` });
    saveAll(); renderPlannerPeople(); renderPeople();
  };
  $('#plannerDate').onchange = () => {
    const nextDate = $('#plannerDate').value;
    if (state.tripDraft.date !== nextDate) {
      state.tripDraft.date = nextDate;
      const chosen = markets.find(item => item.id === state.tripDraft.marketId);
      if (!chosen || !parseDate(nextDate) || !openOn(chosen, parseDate(nextDate))) state.tripDraft.marketId = '';
      clearPlannerConnections(); saveAll();
    }
    renderPlannerAvailability(); renderPlannerMarkets();
  };
  ['plannerArrival', 'plannerReturnTime'].forEach(id => $(`#${id}`).onchange = () => { syncPlannerConfigFromInputs(); clearPlannerConnections(); saveAll(); renderPlannerConnections(); });
  $('#plannerReturnEnabled').onchange = () => {
    syncPlannerConfigFromInputs(); clearPlannerConnections(); saveAll();
    $('#plannerReturnWrap').hidden = !state.tripDraft.returnEnabled;
    $('#plannerReturnSection').hidden = !state.tripDraft.returnEnabled;
    renderPlannerConnections();
  };
  ['plannerBudgetLevel', 'plannerActivityType', 'plannerActivity', 'plannerTicketStatus', 'plannerMeetingPoint', 'plannerStatus', 'plannerNotes'].forEach(id => {
    $(`#${id}`).addEventListener(id === 'plannerActivity' || id === 'plannerMeetingPoint' || id === 'plannerNotes' ? 'input' : 'change', () => { syncPlannerConfigFromInputs(); renderPlannerBudget(); });
  });
  $('#plannerBack').onclick = () => setPlannerStep(plannerStep - 1, true);
  $('#plannerNext').onclick = () => setPlannerStep(plannerStep + 1);
  $('#newTrip').onclick = newPlanner;
  $('#loadPlannerConnections').onclick = loadPlannerConnections;
  $('#recheckPlannerConnections').onclick = loadPlannerConnections;
  $('#savePlannedTrip').onclick = savePlannedTrip;
  $('#previewIcs').onclick = () => {
    const error = validatePlannerStep(5);
    if (error) { $('#plannerSaveMessage').textContent = error; return; }
    const trip = tripFromDraft();
    if (trip) shareTripIcs(trip);
  };
  $('#exportData').onclick = () => {
    const backup = { app: 'Way to Winter Magic', version: VERSION, exportedAt: new Date().toISOString(), state };
    download(URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })), 'way-to-winter-magic-sicherung.json');
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
    APP_KEYS.forEach(key => S.remove(key));
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
  module.exports = { parseDate, isoLocal, dateRange, migratePeople, migrateAvailability, openOn, score, icsEscape, foldIcs, makeIcs, sanitizeImported, buildGeocodeUrl, normalizePlaces, buildJourneyUrl, durationMinutes, durationLabel, delayMinutes, normalizeJourney, buildDbNavigatorUrl, journeyCard, friendlyError, marketOpeningHours, ticketRequirement, transferWarnings, selectPlannerJourneys, connectionSummary };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  (async () => {
    try {
      await loadMarkets();
      const bounds = marketBounds();
      $('#timelineFrom').value = bounds.from;
      $('#timelineTo').value = bounds.to;
      hydrateFilters();
      hydrateConnections();
      bind();
      renderAll();
    } catch (error) {
      document.querySelector('main').innerHTML = `<p class="error-banner">Die Marktdaten konnten nicht geladen werden. Bitte die App einmal online neu öffnen. (${esc(error.message)})</p>`;
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
  })();
}
