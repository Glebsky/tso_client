import re, json

with open('icon_resource.html', 'r', encoding='utf-8') as f:
    html = f.read()

items = re.findall(r'src="(data:image/png;base64,[^"]+)"><div class="mt-2 fw-bold">([^<]+)</div>', html)
print(f"Total icons found: {len(items)}")
print("First 20 icons:", [name for src, name in items[:20]])
