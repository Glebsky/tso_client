import re

with open('lang.txt', 'r', encoding='utf-8', errors='replace') as f:
    text = f.read()

m = re.search(r'<t id="Beer" text="([^"]+)"', text)
if m:
    val = m.group(1)
    print("Beer str:", val)
    print("Beer code points:", [hex(ord(c)) for c in val])
