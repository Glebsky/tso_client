import json

with open('icons_data.js', 'r', encoding='utf-8') as f:
    js = f.read()

raw = js[len('window.TSO_ICONS_DATA = '):].rstrip(';\n ')
data = json.loads(raw)
by_name = {d['name'].lower(): d for d in data}

test_names = ['beer', 'bread', 'ironsmelter', 'general', 'blacksmith', 'farm', 'goldmine', 'coin']
for t in test_names:
    if t in by_name:
        item = by_name[t]
        print(f"{item['name']}: {item['ru']} [{item['secTitle']}] ({item['w']}x{item['h']})")
    else:
        print(f"{t}: NOT FOUND")
