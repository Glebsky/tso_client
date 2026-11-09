import re

with open('lang.txt', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

for m in re.finditer(r'<t id="([^"]*Coking[^"]*)" text="([^"]*)"', text):
    print("Coking match:", m.group(1), "->", m.group(2))
for m in re.finditer(r'<t id="([^"]*Damascene[^"]*)" text="([^"]*)"', text):
    print("Damascene match:", m.group(1), "->", m.group(2))

# Also search for Coal
for m in re.finditer(r'<t id="([^"]*Coal[^"]*)" text="([^"]*)"', text):
    print("Coal match:", m.group(1), "->", m.group(2))
