import json
from collections import defaultdict

with open('mapping/mapping.json', 'r') as f:
    mapping = json.load(f)

dirs = defaultdict(int)
for k in mapping:
    if k.endswith('.png'):
        top = k.split('/')[0]
        dirs[top] += 1

print("PNG count by directory in mapping.json:")
for d, count in sorted(dirs.items(), key=lambda x: x[1], reverse=True):
    print(f"  {d}: {count}")
