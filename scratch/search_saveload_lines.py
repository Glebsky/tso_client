import re
with open('client_scripts.txt', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'SaveLoadTemplate' in l:
        print(f'{i}: {l.strip()[:100]}')
