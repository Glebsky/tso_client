import re
with open('lang.txt', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'<s name="LAB">([\s\S]*?)</s>', text)
if m:
    for t in re.finditer(r'<t id="([^"]+)" text="([^"]*)"', m.group(1)):
        tid = t.group(1)
        val = t.group(2)
        if any(w in tid.lower() for w in ['edit', 'rename', 'name', 'change']):
            print(f'LAB.{tid} --> {val}')
