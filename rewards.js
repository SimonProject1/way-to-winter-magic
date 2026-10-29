(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WTWM_REWARDS = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const AREAS = [
    { id: 'magic', name: 'Magische Meilensteine', subtitle: 'Deine großen Winter-Magic-Momente' },
    { id: 'worlds', name: 'Zauberwelten', subtitle: 'Besondere Kulissen und Lieblingsgefühle' },
    { id: 'journeys', name: 'Reiseabenteuer', subtitle: 'Unterwegs mit Bahn und Entdeckergeist' },
    { id: 'season', name: 'Saisonmomente', subtitle: 'Einmalige Augenblicke im Winterlicht' }
  ];

  const art = id => ({
    image:`./assets/stickers/${id}-unlocked.webp`, imageLocked:`./assets/stickers/${id}-locked.webp`,
    imageNew:`./assets/stickers/${id}-new.webp`, imageSmall:`./assets/stickers/${id}-small.webp`,
    imageLarge:`./assets/stickers/${id}-large.webp`, imageShare:`./assets/stickers/${id}-share.webp`
  });

  const STICKERS = [
    { id:'first-magic', kind:'milestone', ...art('first-magic'), area:'magic', name:'Der erste Zauber', target:1, unit:'besuchter Markt', effect:'spark', meaning:'Dein erster gesammelter Wintermoment.', condition:'Besuche deinen ersten Weihnachtsmarkt.' },
    { id:'five-moments', kind:'milestone', ...art('five-moments'), area:'magic', name:'Fünf magische Momente', target:5, unit:'unterschiedliche Märkte', effect:'snowglobes', meaning:'Fünf verschiedene Weihnachtsmärkte gehören jetzt zu deinen Erinnerungen.', condition:'Besuche fünf unterschiedliche Weihnachtsmärkte.' },
    { id:'winter-bronze', kind:'milestone', ...art('winter-bronze'), area:'magic', name:'Winterwanderer Bronze', target:10, unit:'unterschiedliche Märkte', effect:'trail', meaning:'Du hast den ersten großen Meilenstein deiner Winterreise erreicht.', condition:'Besuche zehn unterschiedliche Weihnachtsmärkte.' },
    { id:'winter-silver', kind:'milestone', ...art('winter-silver'), area:'magic', name:'Winterwanderer Silber', target:20, unit:'unterschiedliche Märkte', effect:'silverpath', meaning:'Deine Wintersaison führt bereits durch viele besondere Orte.', condition:'Besuche zwanzig unterschiedliche Weihnachtsmärkte.' },
    { id:'winter-gold', kind:'milestone', ...art('winter-gold'), area:'magic', name:'Winterwanderer Gold', target:30, unit:'unterschiedliche Märkte', effect:'goldlantern', meaning:'Du bist ein erfahrener Winterwanderer mit einer großen Sammlung.', condition:'Besuche dreißig unterschiedliche Weihnachtsmärkte.' },
    { id:'winter-master', kind:'milestone', ...art('winter-master'), area:'magic', name:'Winter-Magic-Meister', target:39, unit:'unterschiedliche Märkte', effect:'master', meaning:'Du hast alle Weihnachtsmärkte dieser Sammlung besucht.', condition:'Besuche alle 39 unterschiedlichen Weihnachtsmärkte.' },

    { id:'castle-magic', kind:'theme', ...art('castle-magic'), area:'worlds', name:'Schlosszauber', target:1, unit:'Schlossmarkt', effect:'castle', meaning:'Eine festliche Schlosskulisse gehört zu deinen Wintermomenten.', condition:'Besuche einen Weihnachtsmarkt an einem Schloss.' },
    { id:'forest-christmas', kind:'theme', ...art('forest-christmas'), area:'worlds', name:'Waldweihnacht', target:1, unit:'Naturmarkt', effect:'forest', meaning:'Du hast Weihnachtsstimmung mitten in der Natur erlebt.', condition:'Besuche einen naturnahen Weihnachtsmarkt.' },
    { id:'light-hunter', kind:'theme', ...art('light-hunter'), area:'worlds', name:'Lichterjäger', target:3, unit:'Lichtermärkte', effect:'lantern', meaning:'Besondere Beleuchtung prägt deine gesammelten Wintermomente.', condition:'Besuche drei Märkte mit besonderer Beleuchtung.' },
    { id:'taste-journey', kind:'theme', ...art('taste-journey'), area:'worlds', name:'Genussreise', target:3, unit:'Genussmärkte', effect:'steam', meaning:'Deine Winterreise ist auch eine kulinarische Entdeckungstour.', condition:'Besuche drei Märkte mit besonderem Genussangebot.' },
    { id:'cozy-collector', kind:'theme', ...art('cozy-collector'), area:'worlds', name:'Cozy Collector', target:5, unit:'cozy Märkte', effect:'cozy', meaning:'Du hast fünf besonders gemütliche Winterorte gesammelt.', condition:'Besuche fünf besonders gemütliche Märkte.' },

    { id:'de-ticket-pro', kind:'theme', ...art('de-ticket-pro'), area:'journeys', name:'Deutschlandticket-Profi', target:3, unit:'Bahntrips', effect:'train', meaning:'Du verbindest Winterausflüge und Bahnreisen miteinander.', condition:'Schließe drei besuchte Trips mit gespeicherter Bahnverbindung ab.' },
    { id:'city-collector', kind:'theme', ...art('city-collector'), area:'journeys', name:'Städtesammler', target:5, unit:'verschiedene Städte', effect:'city', meaning:'Deine Winterreise führt durch mehrere Städte.', condition:'Besuche Weihnachtsmärkte in fünf verschiedenen Städten.' },

    { id:'premiere-night', kind:'theme', ...art('premiere-night'), area:'season', name:'Premierenabend', target:1, unit:'Eröffnungstag', effect:'curtain', meaning:'Du warst gleich zum Saisonauftakt dabei.', condition:'Besuche einen Markt an seinem ersten Öffnungstag.' },
    { id:'winter-weekend', kind:'theme', ...art('winter-weekend'), area:'season', name:'Winterwochenende', target:3, unit:'Wochenendbesuche', effect:'weekend', meaning:'Mehrere Wochenenden wurden zu besonderen Wintermomenten.', condition:'Sammle drei Marktbesuche an Samstagen oder Sonntagen.' },
    { id:'night-magic', kind:'theme', ...art('night-magic'), area:'season', name:'Night Magic', target:1, unit:'Abendmoment', effect:'moon', meaning:'Du hast einen Weihnachtsmarkt im Abendlicht erlebt.', condition:'Halte einen Marktbesuch bei Nacht im Wintertagebuch fest.' }
  ];

  function localDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null;
    const [y,m,d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
  }

  function uniqueBy(list, key) {
    const seen = new Set();
    return list.filter(item => { const value = key(item); if (!value || seen.has(value)) return false; seen.add(value); return true; });
  }

  function collectStats(trips, journal, markets) {
    const marketMap = new Map((markets || []).map(m => [String(m.id), m]));
    const visited = uniqueBy((trips || []).filter(t => t && t.status === 'Besucht'), t => String(t.id || `${t.marketId}|${t.date}`));
    const visitedMarkets = uniqueBy(visited, t => String(t.marketId || t.market));
    const withMarket = visitedMarkets.map(t => ({ trip:t, market:marketMap.get(String(t.marketId)) || {} }));
    const tags = item => Array.isArray(item.market.tags) ? item.market.tags : [];
    const isWeekend = iso => { const d = localDate(iso); return d ? [0,6].includes(d.getDay()) : false; };
    const entriesByTrip = new Map((journal || []).filter(Boolean).map(e => [String(e.tripId), e]));
    return {
      visits: visitedMarkets.length,
      castles: withMarket.filter(item => tags(item).includes('schloss')).length,
      forests: withMarket.filter(item => tags(item).some(tag => ['natur','wald'].includes(tag))).length,
      lights: withMarket.filter(item => tags(item).includes('licht') || Number(item.market.light) >= 5).length,
      food: withMarket.filter(item => tags(item).includes('essen') || Number(item.market.food) >= 5).length,
      cozy: withMarket.filter(item => tags(item).includes('cozy') || Number(item.market.cozy) >= 4).length,
      rail: visitedMarkets.filter(t => t.outbound && t.outbound.journey).length,
      cities: new Set(visitedMarkets.map(t => t.city).filter(Boolean)).size,
      premieres: withMarket.filter(item => { const first = item.market.dates?.[0] || item.market.from; return first && item.trip.date === first; }).length,
      weekends: visitedMarkets.filter(t => isWeekend(t.date)).length,
      nights: visitedMarkets.filter(t => { const entry = entriesByTrip.get(String(t.id)); return Boolean(entry?.night) || String(t.returnTime || t.end || '') >= '20:00'; }).length
    };
  }

  function progressFor(sticker, stats) {
    const map = {
      'first-magic':stats.visits, 'five-moments':stats.visits, 'winter-bronze':stats.visits,
      'winter-silver':stats.visits, 'winter-gold':stats.visits, 'winter-master':stats.visits,
      'castle-magic':stats.castles, 'forest-christmas':stats.forests, 'light-hunter':stats.lights,
      'taste-journey':stats.food, 'cozy-collector':stats.cozy, 'de-ticket-pro':stats.rail,
      'city-collector':stats.cities, 'premiere-night':stats.premieres, 'winter-weekend':stats.weekends, 'night-magic':stats.nights
    };
    return Math.max(0, Number(map[sticker.id] || 0));
  }

  function evaluateRewards(trips, journal, markets, rewardMeta) {
    const stats = collectStats(trips, journal, markets);
    const meta = rewardMeta && typeof rewardMeta === 'object' ? rewardMeta : {};
    return STICKERS.map(sticker => {
      const value = progressFor(sticker, stats);
      const unlockedAt = meta[sticker.id]?.unlockedAt || '';
      return { ...sticker, value, unlocked:Boolean(unlockedAt) || value >= sticker.target, unlockedAt, seen:Boolean(meta[sticker.id]?.seen) };
    });
  }

  return { AREAS, STICKERS, collectStats, progressFor, evaluateRewards };
}));
