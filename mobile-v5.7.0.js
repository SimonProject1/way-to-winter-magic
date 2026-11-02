(()=>{'use strict';
const mobile=()=>matchMedia('(max-width:720px)').matches;
function ensureViewport(){let v=document.querySelector('meta[name="viewport"]');if(v)v.content='width=device-width,initial-scale=1,viewport-fit=cover';}
function addFilterToggle(){if(!mobile())return;const f=document.querySelector('.filters,.filter-panel');if(!f||document.querySelector('.mobile-filter-toggle'))return;const b=document.createElement('button');b.type='button';b.className='mobile-filter-toggle';b.innerHTML='<span>Filter</span><span aria-hidden="true">▾</span>';f.parentNode.insertBefore(b,f);f.classList.add('mobile-collapsed');b.addEventListener('click',()=>{let closed=f.classList.toggle('mobile-collapsed');b.lastElementChild.textContent=closed?'▾':'▴';});}
function findLabel(id){const e=document.getElementById(id);return e?.closest('label')||e;}
function wizard(){if(!mobile()||document.querySelector('.mobile-wizard-head'))return;const card=document.querySelector('#planner .planner-card,#planner>.panel,#planner article.panel');const grid=card?.querySelector('.form-grid');if(!card||!grid)return;
 const groups=[
  {title:'Personen und Datum',ids:['people','personInput','peopleChips','date']},
  {title:'Weihnachtsmarkt auswählen',ids:['market','pm','openMarketHint','selectedMarketSummary','marketSummary']},
  {title:'Zeiten und Budget',ids:['arrive','return','budget','budgetOptions']},
  {title:'Aktivität und Tickets',ids:['activity','meeting','meetingPoint','ticket','ticketStatus','notes']},
  {title:'Verbindungen',ids:['connections','connectionResults','plannerResults']},
  {title:'Prüfen und speichern',ids:['saveTrip','save','calendar','ics']}
 ];
 const head=document.createElement('div');head.className='mobile-wizard-head';head.innerHTML='<b></b><div class="mobile-wizard-track"><span></span></div><h3></h3>';grid.before(head);
 const wrapper=document.createElement('div');wrapper.className='mobile-wizard';grid.before(wrapper);
 let moved=new Set();groups.forEach((g,i)=>{let s=document.createElement('section');s.className='mobile-wizard-step';s.dataset.step=i;s.dataset.title=g.title;g.ids.forEach(id=>{let node=findLabel(id);if(node&&!moved.has(node)){moved.add(node);s.appendChild(node)}});wrapper.appendChild(s)});
 [...grid.children].forEach(n=>{if(!moved.has(n)){groups[3]&&wrapper.children[3].appendChild(n)}});grid.hidden=true;
 const nav=document.createElement('div');nav.className='mobile-wizard-actions';nav.innerHTML='<button type="button" class="outline" data-wback>Zurück</button><button type="button" data-wnext>Weiter</button>';wrapper.after(nav);
 let step=0;const show=()=>{let all=[...wrapper.children];all.forEach((s,i)=>s.classList.toggle('active',i===step));head.querySelector('b').textContent=`Schritt ${step+1} von ${all.length}`;head.querySelector('h3').textContent=all[step].dataset.title;head.querySelector('span').style.width=`${(step+1)/all.length*100}%`;nav.querySelector('[data-wback]').disabled=step===0;nav.querySelector('[data-wnext]').textContent=step===all.length-1?'Fertig':'Weiter';const actions=card.querySelector('.form-actions,.actions');if(actions)actions.classList.toggle('mobile-final-actions',step===all.length-1);};
 nav.querySelector('[data-wback]').onclick=()=>{if(step>0){step--;show();card.scrollIntoView({block:'start'})}};nav.querySelector('[data-wnext]').onclick=()=>{if(step<groups.length-1){step++;show();card.scrollIntoView({block:'start'})}else{nav.querySelector('[data-wnext]').textContent='Fertig'}};show();
}
function safeScroll(){
  document.querySelectorAll('nav [data-view],#nav [data-view],[data-go]').forEach(b=>{
    b.addEventListener('click',()=>{
      setTimeout(()=>{
        if(!mobile())return;
        const target=document.querySelector('.view.active .page-head,.view.active');
        if(target)target.scrollIntoView({block:'start'});
        window.scrollBy(0,-12);
      },40);
    });
  });
}
function install(){ensureViewport();addFilterToggle();wizard();safeScroll();document.documentElement.classList.add('mobile-v570');}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();addEventListener('resize',()=>{addFilterToggle();wizard();});
})();
