import re

with open(r'tso_icon_finder/docs/xml/icons.xml', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

print("File size:", len(text))

# Find top level nodes under Root / GameObjects
tags = set(re.findall(r'<([a-zA-Z0-9_]+)\b', text))
print("All XML tag names in icons.xml:", tags)

# Count GuiIcon
gui_icons = re.findall(r'<GuiIcon\s+name="([^"]+)"\s+filename="([^"]+)"', text)
print(f"Total GuiIcon tags: {len(gui_icons)}")
print("Sample GuiIcons:", gui_icons[:10])

# Are there other icon definitions like Buff, Building, etc.?
for tag in ['Buff', 'Building', 'Specialist', 'ShopItem', 'Resource', 'Item']:
    matches = re.findall(rf'<{tag}\b[^>]*name="([^"]+)"', text)
    if not matches:
        matches = re.findall(rf'<{tag}\b[^>]*id="([^"]+)"', text)
    print(f"Tag <{tag}> count: {len(matches)}, sample: {matches[:5]}")
