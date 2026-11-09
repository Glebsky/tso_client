import re
with open('client_scripts.txt', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

m = re.findall(r'function SaveLoadTemplate[A-Za-z0-9_]*[\s\S]*?\{[\s\S]*?\}', text)
for x in m[:5]:
    print(x[:300])
