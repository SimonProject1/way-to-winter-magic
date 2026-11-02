from pathlib import Path
from PIL import Image
import re,json
r=Path(__file__).parents[1];h=(r/'index.html').read_text();j=(r/'app.js').read_text();sw=(r/'sw.js').read_text()
ids=set(re.findall(r'id="([A-Za-z0-9_-]+)"',h));required=set(re.findall(r"\$\('#([A-Za-z0-9_-]+)'\)",j));assert not(required-ids),required-ids
actions=set(re.findall(r'data-action="([a-z-]+)"',h+j));cases=set(re.findall(r"case'([a-z-]+)'",j));assert not(actions-cases),actions-cases
for target in re.findall(r'data-target="([a-z-]+)"',h):assert target in ids,target
assert 'document.body.innerHTML' not in j and 'window.fetch=' not in j
markets=json.loads((r/'data/markets.json').read_text());assert len(markets)==41
stickers=list((r/'assets/stickers').rglob('*.webp'));assert len(stickers)==108,len(stickers)
for p in stickers:
 im=Image.open(p);assert im.mode=='RGBA' and im.getchannel('A').getextrema()[0]==0,p
refs=re.findall(r"['\"]((?:assets|icons|data)/[^'\"]+)['\"]",h+j)
for ref in refs:
 if '${' not in ref: assert (r/ref).exists(),ref
assert 'wtwm-v5.9.0' in sw
print(f'PASS static: {len(ids)} DOM ids, {len(actions)} actions, 108 transparent sticker assets')
