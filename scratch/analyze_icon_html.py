import re
from collections import Counter

with open('icon_resource.html', 'r', encoding='utf-8') as f:
    html = f.read()

items = re.findall(r'src="(data:image/png;base64,[^"]+)"><div class="mt-2 fw-bold">([^<]+)</div>', html)
print(f"Total: {len(items)}")

names = [name for src, name in items]
print("Sample names from beginning:", names[:30])
print("Sample names from middle:", names[1200:1230])
print("Sample names from end:", names[-30:])

# Check duplicates
counts = Counter(names)
dups = [k for k, v in counts.items() if v > 1]
print(f"Unique names: {len(counts)}, duplicates: {len(dups)}")
