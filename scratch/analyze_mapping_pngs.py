import json

with open('mapping/mapping.json', 'r') as f:
    mapping = json.load(f)

png_items = {k: v for k, v in mapping.items() if k.endswith('.png')}
print(f"Total png items in mapping.json: {len(png_items)}")

sample_dirs = set(k.split('/')[0] if '/' in k else '' for k in png_items)
print("PNG root directories:", sample_dirs)

# Sample PNGs
print("\nSample PNG paths:")
for p in list(png_items.keys())[:30]:
    print(" ", p)
