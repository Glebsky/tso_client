import re
with open('lang.txt', 'r', encoding='utf-8') as f:
    text = f.read()

for m in re.finditer(r'<s name="([^"]+)">([\s\S]*?)</s>', text):
    sec = m.group(1)
    for t in re.finditer(r'<t id="([^"]+)" text="([^"]*)"', m.group(2)):
        tid = t.group(1)
        val = t.group(2)
        if any(w in tid.lower() for w in ['rename', 'edit', 'name', 'change']):
            try:
                print(f'{sec}.{tid} --> {val.encode("utf-8")}')
            except:
                pass
