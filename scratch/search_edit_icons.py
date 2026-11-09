import re
with open('client_scripts.txt', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

icons = set(re.findall(r'[A-Za-z0-9_]*Icon[A-Za-z0-9_]*', text))
for ic in sorted(icons):
    low = ic.lower()
    if any(k in low for k in ['edit', 'rename', 'pen', 'write', 'modify', 'pencil']):
        print(ic)
