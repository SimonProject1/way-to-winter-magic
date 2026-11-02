(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WTWM_CORE=api;})(globalThis,function(){'use strict';
const iso=d=>typeof d==='string'?d:d.toISOString().slice(0,10);
function isOpen(m,date){const x=iso(date);return(!m.from||x>=m.from)&&(!m.to||x<=m.to)&&!(m.closed||[]).includes(x)}
function score(m){return +(m.light*.35+m.food*.2+m.cozy*.3+m.special*.15).toFixed(1)}
function category(m){const t=m.tags||[];return t.includes('harbor')?'harbor':t.includes('industrial')?'industrial':t.includes('castle')?'castle':t.includes('nature')?'forest':t.includes('oldtown')?'oldtown':t.includes('lights')?'lights':'city'}
function filterMarkets(markets,o={}){let a=markets.filter(m=>(m.name+' '+m.city).toLowerCase().includes((o.query||'').toLowerCase())&&(!o.city||m.city===o.city)&&m.travel<=+(o.maxTravel||999));if(o.filter==='free')a=a.filter(m=>m.entry==='Kostenlos');if(o.filter==='light')a=a.filter(m=>m.light>=5);if(o.filter==='cozy')a=a.filter(m=>m.cozy>=5);if(o.filter==='ticket')a=a.filter(m=>m.entry!=='Kostenlos');if(o.filter==='weekend')a=a.filter(m=>(m.tags||[]).includes('weekend'));return a.sort((x,y)=>o.sort==='travel'?x.travel-y.travel:o.sort==='light'?y.light-x.light:o.sort==='cozy'?y.cozy-x.cozy:score(y)-score(x))}
function openMarkets(markets,date){return date?markets.filter(m=>isOpen(m,date)):[]}
function uniqueVisits(trips){return[...new Map(trips.filter(t=>t.status==='Besucht').map(t=>[t.marketId,t])).values()]}
return{isOpen,score,category,filterMarkets,openMarkets,uniqueVisits};});
