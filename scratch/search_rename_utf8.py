import re
with open('lang.txt', 'r', encoding='utf-8') as f:
    text = f.read()

for m in re.finditer(r'<t id="([^"]+)" text="([^"]*)"', text):
    tid = m.group(1)
    txt = m.group(2)
    if any(k in txt.lower() for k in ['переименов', 'переименовать', 'изменить имя', 'новое имя']):
        print(f'{tid} --> {txt}')
