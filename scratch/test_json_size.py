import re, json, os

with open('icon_resource.html', 'r', encoding='utf-8') as f:
    html = f.read()

items = re.findall(r'src="(data:image/png;base64,[^"]+)"><div class="mt-2 fw-bold">([^<]+)</div>', html)
print(f"Total icons extracted: {len(items)}")

with open('lang.txt', 'r', encoding='utf-8', errors='ignore') as f:
    lang_text = f.read()

# Map id -> list of (section, text)
trans_map = {}
for s_match in re.finditer(r'<s name="([^"]+)">([\s\S]*?)</s>', lang_text):
    sec = s_match.group(1)
    for t_match in re.finditer(r'<t id="([^"]+)" text="([^"]*)"', s_match.group(2)):
        tid = t_match.group(1)
        ttext = t_match.group(2)
        if tid not in trans_map:
            trans_map[tid] = []
        trans_map[tid].append({'sec': sec, 'ru': ttext})

data = {}
for src, name in items:
    info = {
        'name': name,
        'src': src,
    }
    if name in trans_map:
        info['ru'] = trans_map[name][0]['ru']
        info['sec'] = trans_map[name][0]['sec']
    data[name.lower()] = info

json_str = json.dumps(data, ensure_ascii=False)
print(f"JSON size in MB: {len(json_str.encode('utf-8')) / (1024*1024):.2f} MB")
