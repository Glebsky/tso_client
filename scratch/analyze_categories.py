import re
from collections import defaultdict

with open('icon_resource.html', 'r', encoding='utf-8') as f:
    html = f.read()

items = re.findall(r'src="(data:image/png;base64,[^"]+)"><div class="mt-2 fw-bold">([^<]+)</div>', html)

with open('lang.txt', 'r', encoding='utf-8', errors='ignore') as f:
    lang_text = f.read()

trans = {}
for s_match in re.finditer(r'<s name="([^"]+)">([\s\S]*?)</s>', lang_text):
    sec = s_match.group(1)
    for t_match in re.finditer(r'<t id="([^"]+)" text="([^"]*)"', s_match.group(2)):
        trans[t_match.group(1)] = (sec, t_match.group(2))

categories = defaultdict(int)
for src, name in items:
    if name in trans:
        sec, ru = trans[name]
        categories[sec] += 1
    else:
        # Check prefix
        if name.startswith('Deposit'):
            categories['Deposit'] += 1
        elif name.startswith('Expedition') or name.startswith('Bandit') or name.startswith('Defender'):
            categories['Military'] += 1
        elif name.startswith('BuffAdventures'):
            categories['Adventure'] += 1
        elif name.startswith('EffectBuff') or name.startswith('Buff'):
            categories['Buff'] += 1
        else:
            categories['Other'] += 1

print("Categories distribution:")
for k, v in sorted(categories.items(), key=lambda x: x[1], reverse=True):
    print(f"  {k}: {v}")
