import re
with open('lang.txt', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

for m in re.finditer(r'<t id="([^"]+)" text="([^"]*Переименов[^"]*)"', text):
    print(m.group(1), '-->', m.group(2))

for m in re.finditer(r'<t id="([^"]+)" text="([^"]*Изменить[^"]*)"', text):
    if len(m.group(2)) < 30:
        print(m.group(1), '-->', m.group(2))
