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

  const STICKERS = [
    { id:'first-magic', area:'magic', name:'Der erste Zauber', target:1, unit:'besuchter Markt', icon:'✦', motif:'Sternenfunke über einer kleinen Markt-Silhouette', colors:['#0d3b30','#f3ca78','#fff7e5'], material:'Dunkelgrünes Emaille mit warmgoldenem Funkelstaub', ribbon:'Cremeweißes Band mit goldener Mittellinie', frame:'Doppelrahmen aus poliertem Warmgold', effect:'spark', effectLabel:'Sanfter Sternenfunken-Regen', description:'Besuche deinen ersten Weihnachtsmarkt.' },
    { id:'five-moments', area:'magic', name:'Fünf magische Momente', target:5, unit:'besuchte Märkte', icon:'✧', motif:'Fünf kreisende Sterne über Tannenspitzen', colors:['#163f34','#d7b15b','#a83232'], material:'Tiefgrünes Glasemaille mit fünf eingelegten Goldsternen', ribbon:'Dunkelgrün mit feinen roten Kanten', frame:'Doppelrahmen aus satiniertem Gold', effect:'stars', effectLabel:'Fünf aufleuchtende Goldsterne', description:'Sammle fünf besuchte Weihnachtsmärkte.' },
    { id:'winter-bronze', area:'magic', name:'Winterwanderer Bronze', target:3, unit:'besuchte Märkte', icon:'❖', motif:'Winterstiefel auf einem verschneiten Weg', colors:['#6f3f27','#c47b45','#f6ead6'], material:'Gebürstete Bronze mit dunkelgrünem Emaillekern', ribbon:'Walnussbraun und Cremeweiß', frame:'Doppelrahmen aus gealterter Bronze', effect:'trail', effectLabel:'Bronzene Lichtspur', description:'Besuche drei Weihnachtsmärkte.' },
    { id:'winter-silver', area:'magic', name:'Winterwanderer Silber', target:7, unit:'besuchte Märkte', icon:'❉', motif:'Silberne Schneeflocke über einer Wegspur', colors:['#264a42','#d8e1df','#ffffff'], material:'Versilbertes Relief mit perlmuttweißem Emaille', ribbon:'Silbergrau mit dunkelgrüner Kante', frame:'Doppelrahmen aus hellem Wintersilber', effect:'snow', effectLabel:'Leiser Schneeflockenwirbel', description:'Besuche sieben Weihnachtsmärkte.' },
    { id:'winter-gold', area:'magic', name:'Winterwanderer Gold', target:12, unit:'besuchte Märkte', icon:'★', motif:'Goldener Wegweiser im Sternenkranz', colors:['#0b3026','#e2b65e','#fff4d6'], material:'Poliertes Warmgold mit transparentem Waldgrün', ribbon:'Warmgold und tiefes Dunkelgrün', frame:'Erhabener doppelter Goldrahmen', effect:'aurora', effectLabel:'Goldene Nordlicht-Welle', description:'Besuche zwölf Weihnachtsmärkte.' },
    { id:'winter-master', area:'magic', name:'Winter-Magic-Meister', target:20, unit:'besuchte Märkte', icon:'♛', motif:'Krone, Stern und verschneite Tannen im Wappen', colors:['#08291f','#f0c56c','#9f2f3b'], material:'Mehrschichtiges Cloisonné-Emaille mit Goldintarsien', ribbon:'Breites dunkelgrünes Meisterband mit Weihnachtsrot', frame:'Dreifacher Eindruck im goldenen Doppelrahmen', effect:'master', effectLabel:'Meisterkranz aus Goldlicht und Konfetti', description:'Besuche zwanzig Weihnachtsmärkte.' },

    { id:'castle-magic', area:'worlds', name:'Schlosszauber', target:1, unit:'Schlossmarkt', icon:'♜', motif:'Beleuchtetes Schloss mit drei goldenen Türmen', colors:['#173c32','#d9ad58','#f8efe0'], material:'Cremefarbenes Porzellanemaille mit Goldrelief', ribbon:'Bordeauxrot mit goldenen Säumen', frame:'Ornamentierter doppelter Goldrahmen', effect:'castle', effectLabel:'Aufsteigende Schlosslichter', description:'Besuche einen Weihnachtsmarkt an einem Schloss.' },
    { id:'forest-christmas', area:'worlds', name:'Waldweihnacht', target:1, unit:'Naturmarkt', icon:'♠', motif:'Tanne, Mond und verschneiter Waldweg', colors:['#0b3026','#3d6c53','#efe3c6'], material:'Mattes Waldemaille mit fein geprägtem Schnee', ribbon:'Tannengrün und Cremeweiß', frame:'Doppelrahmen aus antikem Gold', effect:'forest', effectLabel:'Ruhig wachsende Tannenlichter', description:'Besuche einen naturnahen Weihnachtsmarkt.' },
    { id:'light-hunter', area:'worlds', name:'Lichterjäger', target:3, unit:'Lichtermärkte', icon:'☼', motif:'Historische Laterne mit strahlendem Lichtkranz', colors:['#12382f','#ffd98a','#9f2f3b'], material:'Transparentes Honigglas über Goldfolie', ribbon:'Weihnachtsrot mit warmgoldener Mitte', frame:'Glänzender doppelter Goldrahmen', effect:'lantern', effectLabel:'Laternen-Zündung im Lichtkreis', description:'Besuche drei Märkte mit besonderer Beleuchtung.' },
    { id:'taste-journey', area:'worlds', name:'Genussreise', target:3, unit:'Genussmärkte', icon:'♨', motif:'Dampfender Becher mit Sternanis und Zimt', colors:['#742f2f','#e5b65d','#fff0d2'], material:'Weihnachtsrotes Emaille mit kupfergoldenem Relief', ribbon:'Cremeweiß mit rotem Rand', frame:'Doppelrahmen aus warmem Messinggold', effect:'steam', effectLabel:'Goldener Gewürz- und Dampfwirbel', description:'Besuche drei Märkte mit besonderem Genussangebot.' },
    { id:'cozy-collector', area:'worlds', name:'Cozy Collector', target:5, unit:'cozy Märkte', icon:'♥', motif:'Leuchtendes Herz vor einem kleinen Marktstand', colors:['#18483a','#e6bb64','#a83232'], material:'Samtmattes Emaille mit rotem Glaskern', ribbon:'Dunkelgrün, Creme und feines Rot', frame:'Weich gerundeter doppelter Goldrahmen', effect:'cozy', effectLabel:'Warmer Herzschlag-Glow', description:'Besuche fünf besonders gemütliche Märkte.' },

    { id:'de-ticket-pro', area:'journeys', name:'Deutschlandticket-Profi', target:3, unit:'Bahntrips', icon:'▰', motif:'Regionalzug unter einem goldenen Sternbogen', colors:['#123d32','#e4bd68','#f8f2e4'], material:'Gebürstetes Goldmetall mit grünem Hartemaille', ribbon:'Dunkelgrün mit cremeweißer Schiene', frame:'Technisch klarer doppelter Metallrahmen', effect:'train', effectLabel:'Vorbeiziehende goldene Lichtschienen', description:'Schließe drei besuchte Trips mit gespeicherter Bahnverbindung ab.' },
    { id:'city-collector', area:'journeys', name:'Städtesammler', target:5, unit:'verschiedene Städte', icon:'▥', motif:'Stadtsilhouette aus fünf goldenen Giebeln', colors:['#0d352b','#d9ac55','#f5ead5'], material:'Geprägtes Messing auf dunkelgrünem Emaille', ribbon:'Cremeweiß mit dunkelgrünen Stadtkanten', frame:'Architektonischer doppelter Goldrahmen', effect:'city', effectLabel:'Aufbauende Lichter-Skyline', description:'Besuche Weihnachtsmärkte in fünf verschiedenen Städten.' },

    { id:'premiere-night', area:'season', name:'Premierenabend', target:1, unit:'Eröffnungstag', icon:'✺', motif:'Sich öffnender Vorhang mit erstem Stern', colors:['#8d2e38','#e7bb62','#fff2dc'], material:'Rubinrotes Glanzemaille mit goldener Vorhangprägung', ribbon:'Weihnachtsrot mit cremeweißer Mitte', frame:'Festlicher doppelter Goldrahmen', effect:'curtain', effectLabel:'Goldener Vorhang und Premierenfunken', description:'Besuche einen Markt an seinem ersten Öffnungstag.' },
    { id:'winter-weekend', area:'season', name:'Winterwochenende', target:3, unit:'Wochenendbesuche', icon:'❄', motif:'Kalenderblatt mit Schneeflocke und zwei Sternen', colors:['#173e34','#e8c474','#f8f5ea'], material:'Cremefarbenes Emaille mit grünem Kalenderrelief', ribbon:'Dunkelgrün mit zwei goldenen Querlinien', frame:'Doppelrahmen aus satiniertem Gold', effect:'weekend', effectLabel:'Drei sanfte Wochenend-Schneeflocken', description:'Sammle drei Marktbesuche an Samstagen oder Sonntagen.' },
    { id:'night-magic', area:'season', name:'Night Magic', target:1, unit:'Abendmoment', icon:'☾', motif:'Goldener Mond über einem funkelnden Markt', colors:['#092a25','#cfaa61','#a83232'], material:'Nachtblau-grünes Glasemaille mit Goldflittern', ribbon:'Tiefes Dunkelgrün mit rotem Nachtrand', frame:'Polierter doppelter Mondgold-Rahmen', effect:'moon', effectLabel:'Mondaufgang mit ruhigem Sternenstaub', description:'Halte einen Marktbesuch bei Nacht im Wintertagebuch fest.' }
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
      premieres: withMarket.filter(item => {
        const first = item.market.dates?.[0] || item.market.from;
        return first && item.trip.date === first;
      }).length,
      weekends: visitedMarkets.filter(t => isWeekend(t.date)).length,
      nights: visitedMarkets.filter(t => {
        const entry = entriesByTrip.get(String(t.id));
        return Boolean(entry?.night) || String(t.returnTime || t.end || '') >= '20:00';
      }).length
    };
  }

  function progressFor(sticker, stats) {
    const map = {
      'first-magic':stats.visits, 'five-moments':stats.visits, 'winter-bronze':stats.visits,
      'winter-silver':stats.visits, 'winter-gold':stats.visits, 'winter-master':stats.visits,
      'castle-magic':stats.castles, 'forest-christmas':stats.forests, 'light-hunter':stats.lights,
      'taste-journey':stats.food, 'cozy-collector':stats.cozy, 'de-ticket-pro':stats.rail,
      'city-collector':stats.cities, 'premiere-night':stats.premieres,
      'winter-weekend':stats.weekends, 'night-magic':stats.nights
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
