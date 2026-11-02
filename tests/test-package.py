from pathlib import Path
from PIL import Image
import json,re
r=Path(__file__).parents[1]
# balanced braces coarse validation for CSS
css=(r/'styles.css').read_text();assert css.count('{')==css.count('}'),(css.count('{'),css.count('}'))
# expected project files
for f in ['index.html','styles.css','app-core.js','rewards.js','app.js','sw.js','manifest.webmanifest','data/markets.json']:
 assert (r/f).is_file(),f
# icon dimensions
for s in [192,512]:
 im=Image.open(r/'icons'/f'icon-{s}.png');assert im.size==(s,s) and im.mode=='RGB'
# Every market category image exists in both sizes
for c in ['castle','city','forest','harbor','industrial','lights','oldtown']:
 for s in [480,960]:assert (r/'assets/artwork/markets'/f'market-{c}-{s}.webp').is_file()
# Service worker core files resolve
sw=(r/'sw.js').read_text();core=json.loads(re.search(r"const CORE=(\[.*?\]);self",sw).group(1).replace("'",'"'))
for p in core:
 if p!='./':assert (r/p).exists(),p
# no dangerous body replacement/fetch monkeypatch anywhere
for p in r.glob('*.js'):
 t=p.read_text();assert 'document.body.innerHTML' not in t,p;assert 'window.fetch=' not in t,p
# documented click routes
expected={'go','detail','plan','favorite','filter','reset-filters','wizard-prev','wizard-next','connections','save-trip','calendar','sticker','visit','delete-trip','export','close-dialog'}
app=(r/'app.js').read_text();cases=set(re.findall(r"case'([a-z-]+)'",app));assert expected==cases,(expected-cases,cases-expected)
print('PASS package: CSS, icons, 14 market artworks, service-worker core, safe DOM rules, all 16 action routes')
