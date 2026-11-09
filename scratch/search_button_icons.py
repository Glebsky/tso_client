import re
with open('client_scripts.txt', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

icons = set(re.findall(r'ButtonIcon[A-Za-z0-9_]*', text))
for ic in sorted(icons):
    print(ic)
