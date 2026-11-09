import re, json, os, base64
from PIL import Image
import io

os.makedirs('icons', exist_ok=True)

with open('icon_resource.html', 'r', encoding='utf-8') as f:
    html = f.read()

items = re.findall(r'src="(data:image/png;base64,([^"]+))"><div class="mt-2 fw-bold">([^<]+)</div>', html)
print(f"Extracted {len(items)} items from icon_resource.html")

# Read lang.txt with utf-8
with open('lang.txt', 'r', encoding='utf-8', errors='replace') as f:
    lang_text = f.read()

trans = {}
for s_match in re.finditer(r'<s name="([^"]+)">([\s\S]*?)</s>', lang_text):
    sec = s_match.group(1)
    for t_match in re.finditer(r'<t id="([^"]+)" text="([^"]*)"', s_match.group(2)):
        tid = t_match.group(1)
        ttext = t_match.group(2)
        if tid not in trans:
            trans[tid] = (sec, ttext)

print(f"Loaded {len(trans)} translations from lang.txt (UTF-8)")
print("Sample translation: Beer ->", trans.get('Beer'))

sec_names = {
    'RES': 'Ресурсы',
    'BUI': 'Здания',
    'SPE': 'Специалисты',
    'SHI': 'Магазин',
    'COL': 'Коллекции',
    'ACL': 'Достижения',
    'LAB': 'Интерфейс',
    'ADN': 'Приключения',
    'ADL': 'Приключения',
    'ADW': 'Приключения',
    'ADT': 'Приключения',
    'DES': 'Описание / Предметы',
    'SIT': 'Товары',
    'TOT': 'Обучение',
    'MEL': 'Войска',
    'Deposit': 'Залежи',
    'Military': 'Войска',
    'Adventure': 'Приключения',
    'Buff': 'Усилители',
    'Other': 'Прочее'
}

icons_list = []
saved_count = 0

for data_url, b64_str, name in items:
    img_bytes = base64.b64decode(b64_str)
    safe_name = "".join(c for c in name if c.isalnum() or c in ('_', '-'))
    if not safe_name:
        safe_name = f"icon_{saved_count}"
    
    img_path = os.path.join('icons', f"{safe_name}.png")
    if not os.path.exists(img_path):
        with open(img_path, 'wb') as img_file:
            img_file.write(img_bytes)
    saved_count += 1
    
    try:
        with Image.open(io.BytesIO(img_bytes)) as im:
            w, h = im.size
    except Exception:
        w, h = 0, 0
    
    sec = 'Other'
    ru = ''
    if name in trans:
        sec, ru = trans[name]
    else:
        if name.startswith('Deposit'):
            sec = 'Deposit'
            base_res = name.replace('Deposit', '')
            if base_res in trans:
                ru = f"Залежи: {trans[base_res][1]}"
        elif any(name.startswith(p) for p in ['Expedition', 'Bandit', 'Defender', 'HiredMilitary']):
            sec = 'Military'
        elif any(name.startswith(p) for p in ['BuffAdventures', 'adv_']):
            sec = 'Adventure'
        elif any(name.startswith(p) for p in ['EffectBuff', 'Buff', 'ProductivityBuff']):
            sec = 'Buff'

    sec_title = sec_names.get(sec, 'Разное')

    icons_list.append({
        'name': name,
        'safeName': safe_name,
        'ru': ru,
        'sec': sec,
        'secTitle': sec_title,
        'w': w,
        'h': h,
        'size': len(img_bytes),
        'src': data_url
    })

# Write icons_data.js in UTF-8
js_content = "window.TSO_ICONS_DATA = " + json.dumps(icons_list, ensure_ascii=False) + ";\n"
with open('icons_data.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f"Wrote icons_data.js ({len(js_content.encode('utf-8')) / (1024*1024):.2f} MB)")
