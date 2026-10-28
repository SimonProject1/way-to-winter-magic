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
    { id:'first-magic', kind:'milestone', ...art('first-magic'), area:'magic', name:'Der erste Zauber', target:1, unit:'besuchter Markt', motif:'Leuchtender Weihnachtsbaum mit goldenem Stern, historischer Laterne und erstem Fußabdruck im Schnee', colors:['#0b3026','#f3ca78','#fff7e5'], material:'Tiefgrünes Glasemaille, poliertes Warmgold und fein geprägter Schnee', ribbon:'Cremeweißes Doppelband mit goldener Mittellinie', frame:'Doppelter räumlicher Goldrahmen mit Lichtkante', effect:'spark', effectLabel:'Baumlichter zünden, Stern strahlt, Laterne glimmt und Fußspuren erscheinen', description:'Besuche deinen ersten Weihnachtsmarkt.' },
    { id:'five-moments', kind:'milestone', ...art('five-moments'), area:'magic', name:'Fünf magische Momente', target:5, unit:'unterschiedliche Märkte', motif:'Fünf unterschiedliche Schneekugeln mit eigenen Miniaturmotiven und verbindender Goldfunkenroute', colors:['#113a30','#e3ba61','#9f2f3b'], material:'Tiefgrünes Glasemaille mit klaren Schneekugel-Linsen und Goldintarsien', ribbon:'Weihnachtsrot mit feinen goldenen Kanten', frame:'Satiniertes Gold im räumlichen Doppelrahmen', effect:'snowglobes', effectLabel:'Fünf Schneekugeln leuchten nacheinander auf und werden von Goldfunken verbunden', description:'Sammle fünf unterschiedliche besuchte Weihnachtsmärkte.' },
    { id:'winter-bronze', kind:'milestone', ...art('winter-bronze'), area:'magic', name:'Winterwanderer Bronze', target:10, unit:'unterschiedliche Märkte', motif:'Bronzener Wanderstiefel, zehn nummerierte Wegpunkte und seitliche Tannenzweige', colors:['#35261f','#c47b45','#f6ead6'], material:'Gebürstete Bronze mit dunkelbraunem Emaillekern und Patina', ribbon:'Walnussbraun und Cremeweiß', frame:'Gealterter Bronze-Gold-Doppelrahmen', effect:'trail', effectLabel:'Der Stiefel prägt eine bronzene Spur; zehn Wegpunkte leuchten bis zum Ziel', description:'Besuche zehn unterschiedliche Weihnachtsmärkte.' },
    { id:'winter-silver', kind:'milestone', ...art('winter-silver'), area:'magic', name:'Winterwanderer Silber', target:20, unit:'unterschiedliche Märkte', motif:'Silberner Wegweiser vor Halbmond und exakt zwanzig funkelnden Sternen', colors:['#24443d','#e7f0ef','#ffffff'], material:'Versilbertes Relief, perlmuttweißes Emaille und frostige Lichtkante', ribbon:'Silbergrau mit dunkelgrüner Kante', frame:'Heller Wintersilber-Doppelrahmen', effect:'silverpath', effectLabel:'Der Mond steigt auf, der Wegweiser dreht sich ein und zwanzig Sterne funkeln', description:'Besuche zwanzig unterschiedliche Weihnachtsmärkte.' },
    { id:'winter-gold', kind:'milestone', ...art('winter-gold'), area:'magic', name:'Winterwanderer Gold', target:30, unit:'unterschiedliche Märkte', motif:'Goldene Laterne, exakt dreißig Lichtpunkte und symmetrischer Tannenlorbeer', colors:['#0a3429','#f0c56c','#fff4d6'], material:'Poliertes Warmgold auf transparentem Waldgrün mit Honigglas', ribbon:'Warmgold und tiefes Dunkelgrün', frame:'Erhabener doppelter Goldrahmen', effect:'goldlantern', effectLabel:'Die Laterne zündet, dreißig Lichtpunkte steigen auf und Tannenlorbeer wächst', description:'Besuche dreißig unterschiedliche Weihnachtsmärkte.' },
    { id:'winter-master', kind:'milestone', ...art('winter-master'), area:'magic', name:'Winter-Magic-Meister', target:39, unit:'unterschiedliche Märkte', motif:'Prächtig geöffnetes Wintertor mit Krone, WtWM-Stern und exakt 39 Sternen', colors:['#071f19','#f6ca69','#9f2f3b'], material:'Mehrschichtiges Cloisonné-Emaille mit Goldintarsien und Meisterglanz', ribbon:'Breites dunkelrotes Meisterband mit Cremeakzent', frame:'Massiver doppelter Goldrahmen mit dritter Lichtkante', effect:'master', effectLabel:'Das Wintertor öffnet sich, die Krone senkt sich und 39 Sterne bilden den Meisterkranz', description:'Besuche alle 39 unterschiedlichen Weihnachtsmärkte.' },

    { id:'castle-magic', kind:'theme', ...art('castle-magic'), area:'worlds', name:'Schlosszauber', target:1, unit:'Schlossmarkt', motif:'Beleuchtetes Schloss mit Türmen, glimmenden Fackeln und golden geöffnetem Tor', colors:['#173c32','#e4b85e','#f8efe0'], material:'Cremefarbenes Porzellanemaille mit Goldrelief und warmen Fenstern', ribbon:'Schriftfreies Artwork; Titel und Status werden separat in der Oberfläche angezeigt', frame:'Freie warmgoldene Konturlinie ohne Medaillenumrandung', effect:'castle', effectLabel:'Türme und Fenster erstrahlen, Fackeln zünden und das goldene Tor öffnet sich', description:'Besuche einen Weihnachtsmarkt an einem Schloss.' },
    { id:'forest-christmas', kind:'theme', ...art('forest-christmas'), area:'worlds', name:'Waldweihnacht', target:1, unit:'Naturmarkt', motif:'Verschneite Tannen, Holzhütte, Lichterketten, Feuerkorb und dezente Waldtiersilhouetten', colors:['#123327','#d6b66d','#efe3c6'], material:'Mattes Waldemaille, Holzrelief und fein geprägte Schneestruktur', ribbon:'Schriftfreies Artwork; Titel und Status werden separat in der Oberfläche angezeigt', frame:'Freie warmgoldene Konturlinie ohne Medaillenumrandung', effect:'forest', effectLabel:'Tannen wachsen, die Hüttenkette leuchtet, der Feuerkorb flackert und Waldtiere ziehen vorbei', description:'Besuche einen naturnahen Weihnachtsmarkt.' },
    { id:'light-hunter', kind:'theme', ...art('light-hunter'), area:'worlds', name:'Lichterjäger', target:3, unit:'Lichtermärkte', motif:'Große goldene Laterne mit radialen Lichtstrahlen und fünf ausgeprägten Lichtsternen', colors:['#102f29','#ffd98a','#9f2f3b'], material:'Transparentes Honigglas über Goldfolie mit poliertem Metall', ribbon:'Schriftfreies Artwork; Titel und Status werden separat in der Oberfläche angezeigt', frame:'Freie warmgoldene Konturlinie ohne Medaillenumrandung', effect:'lantern', effectLabel:'Die große Laterne flammt auf, Lichtstrahlen öffnen sich und fünf Lichtsterne explodieren', description:'Besuche drei Märkte mit besonderer Beleuchtung.' },
    { id:'taste-journey', kind:'theme', ...art('taste-journey'), area:'worlds', name:'Genussreise', target:3, unit:'Genussmärkte', motif:'Dunkler Holztisch mit Maserung, cremefarbenem Stoffläufer, rotem Samtband, Glühwein, Orangenscheibe, Zimt, Sternanis, Lebkuchen, Zimtstern, Mandeln, Kerze, Goldbesteck und Tannengrün', colors:['#5a2528','#e7b85f','#fff0d2'], material:'Dunkles gemasertes Holz, gewebter Cremestoff, roter Samt, glasierte Keramik, reflektierendes Goldmetall und lichtdurchlässiges Kerzenwachs', ribbon:'Schriftfreies Artwork; Titel und Status werden separat in der Oberfläche angezeigt', frame:'Schmale organische Goldkontur ohne Medaillenumrandung', effect:'steam', effectLabel:'Sternförmiger Dampf steigt auf, Kerzen- und Lichterglanz baut sich auf und läuft als feiner Reflex über Keramik, Besteck und Tisch', description:'Besuche drei Märkte mit besonderem Genussangebot.' },
    { id:'cozy-collector', kind:'theme', ...art('cozy-collector'), area:'worlds', name:'Cozy Collector', target:5, unit:'cozy Märkte', motif:'Gemütlicher Sessel mit karierter Decke, Tasse, Laterne und verschneitem Fenster', colors:['#173d34','#e6bb64','#8f3038'], material:'Samtmattes Emaille mit Stoffprägung, Glasfenster und warmem Laternenlicht', ribbon:'Schriftfreies Artwork; Titel und Status werden separat in der Oberfläche angezeigt', frame:'Freie warmgoldene Konturlinie ohne Medaillenumrandung', effect:'cozy', effectLabel:'Die Decke legt sich über den Sessel, die Tasse dampft, die Laterne glimmt und Schnee fällt', description:'Besuche fünf besonders gemütliche Märkte.' },

    { id:'de-ticket-pro', kind:'theme', ...art('de-ticket-pro'), area:'journeys', name:'Deutschlandticket-Profi', target:3, unit:'Bahntrips', motif:'Eigenständiger grüner Regionalzug ohne offizielles DB-Logo auf gebogener verschneiter Schienenspur', colors:['#123d32','#e4bd68','#f8f2e4'], material:'Gebürstetes Goldmetall mit grünem Hartemaille und kühlem Fensterglas', ribbon:'Schriftfreies Artwork; Titel und Status werden separat in der Oberfläche angezeigt', frame:'Freie warmgoldene Konturlinie ohne Medaillenumrandung', effect:'train', effectLabel:'Der Regionalzug fährt ein, die Bahnhofsuhr tickt und eine goldene Spur läuft über die Schneegleise', description:'Schließe drei besuchte Trips mit gespeicherter Bahnverbindung ab.' },
    { id:'city-collector', kind:'theme', ...art('city-collector'), area:'journeys', name:'Städtesammler', target:5, unit:'verschiedene Städte', motif:'Panorama-Skyline auf gefalteter Winterkarte mit roter Reiseroute und fünf goldenen Standortpunkten', colors:['#0d352b','#d9ac55','#f5ead5'], material:'Geprägtes Messing auf dunkelgrünem Emaille mit Kartenlack', ribbon:'Schriftfreies Artwork; Titel und Status werden separat in der Oberfläche angezeigt', frame:'Freie warmgoldene Konturlinie ohne Medaillenumrandung', effect:'city', effectLabel:'Fünf Stadtsilhouetten bauen sich auf, Wegweiser schwenken ein und die Kartenroute verbindet alle Sterne', description:'Besuche Weihnachtsmärkte in fünf verschiedenen Städten.' },

    { id:'premiere-night', kind:'theme', ...art('premiere-night'), area:'season', name:'Premierenabend', target:1, unit:'Eröffnungstag', motif:'Goldenes Eintrittsticket mit Abrisskante, rotem Samtband und festlichem Theaterportal', colors:['#5b2029','#e7bb62','#fff2dc'], material:'Rubinrotes Glanzemaille, Goldpapierprägung und Samtstruktur', ribbon:'Schriftfreies Artwork; Titel und Status werden separat in der Oberfläche angezeigt', frame:'Freie warmgoldene Konturlinie ohne Medaillenumrandung', effect:'curtain', effectLabel:'Das Samtband zieht auf, die Ticketkante löst sich und das Theaterportal erstrahlt', description:'Besuche einen Markt an seinem ersten Öffnungstag.' },
    { id:'winter-weekend', kind:'theme', ...art('winter-weekend'), area:'season', name:'Winterwochenende', target:3, unit:'Wochenendbesuche', motif:'Zwei verschiedenfarbige Marktbuden, Samstag-Sonntag-Kalender, Schneeflocke und verbindender Weg', colors:['#173e34','#e8c474','#9f2f3b'], material:'Cremefarbenes Emaille mit grün-rotem Budenrelief und Schneestruktur', ribbon:'Schriftfreies Artwork; Titel und Status werden separat in der Oberfläche angezeigt', frame:'Freie warmgoldene Konturlinie ohne Medaillenumrandung', effect:'weekend', effectLabel:'Samstag und Sonntag blättern auf, beide Buden leuchten und der Schneeflockenweg verbindet sie', description:'Sammle drei Marktbesuche an Samstagen oder Sonntagen.' },
    { id:'night-magic', kind:'theme', ...art('night-magic'), area:'season', name:'Night Magic', target:1, unit:'Abendmoment', motif:'Halbmond vor dunkelblauem Himmel, vollständig beleuchteter Markt, Sterne, Schneeflocken und Lichtspiegelung auf nassem Pflaster', colors:['#10263b','#d5b363','#9f2f3b'], material:'Nachtblaues Glasemaille mit Goldflittern und spiegelndem Pflasterlack', ribbon:'Schriftfreies Artwork; Titel und Status werden separat in der Oberfläche angezeigt', frame:'Freie warmgoldene Konturlinie ohne Medaillenumrandung', effect:'moon', effectLabel:'Der Halbmond steigt auf, der Markt leuchtet vollständig und seine Lichter spiegeln sich im nassen Pflaster', description:'Halte einen Marktbesuch bei Nacht im Wintertagebuch fest.' }
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
