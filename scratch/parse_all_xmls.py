import os, re, json

docs_xml_dir = r'tso_icon_finder/docs/xml'

# Collect all icon names and filenames from xml
found_items = []

for root, dirs, files in os.walk(docs_xml_dir):
    for f in files:
        if not f.endswith('.xml'):
            continue
        filepath = os.path.join(root, f)
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as xml_file:
                content = xml_file.read()
        except Exception:
            continue
        
        # Look for tags with name/id and icon/filename
        # 1. <GuiIcon name="..." filename="..." />
        for m in re.finditer(r'<GuiIcon\s+name="([^"]+)"\s+filename="([^"]+)"', content):
            found_items.append({'type': 'GuiIcon', 'name': m.group(1), 'icon': m.group(2), 'file': f})
            
        # 2. <Buff name="..." iconfilename="..." />
        for m in re.finditer(r'<Buff\s+name="([^"]+)"\s+iconfilename="([^"]+)"', content):
            found_items.append({'type': 'Buff', 'name': m.group(1), 'icon': m.group(2), 'file': f})
            
        # 3. <Building ... name="..." ... iconfilename="..." ...>
        for m in re.finditer(r'<Building\b[^>]*\bname="([^"]+)"[^>]*\biconfilename="([^"]+)"', content):
            found_items.append({'type': 'Building', 'name': m.group(1), 'icon': m.group(2), 'file': f})
            
        # 4. <ResourceIcon name="..." filename="..." />
        for m in re.finditer(r'<ResourceIcon\s+name="([^"]+)"\s+filename="([^"]+)"', content):
            found_items.append({'type': 'ResourceIcon', 'name': m.group(1), 'icon': m.group(2), 'file': f})
            
        # 5. <Adventure name="..." buffIcon="..." (or teaserImage, avatarImage)
        for m in re.finditer(r'<Adventure\b[^>]*\bname="([^"]+)"[^>]*\b(buffIcon|teaserImage|avatarImage)="([^"]+)"', content):
            found_items.append({'type': 'Adventure', 'name': m.group(1), 'icon': m.group(3), 'file': f})

        # 6. Shop items <Item ... name="..." icon="..." (or shopItem)
        for m in re.finditer(r'<ShopItem\b[^>]*\bname="([^"]+)"[^>]*\b(?:icon|iconfilename|customiconfilename)="([^"]+)"', content):
            found_items.append({'type': 'ShopItem', 'name': m.group(1), 'icon': m.group(2), 'file': f})

        # 7. Collectibles
        for m in re.finditer(r'<Collectible\b[^>]*\bname="([^"]+)"[^>]*\bicon="([^"]+)"', content):
            found_items.append({'type': 'Collectible', 'name': m.group(1), 'icon': m.group(2), 'file': f})

print(f"Total icon definitions parsed from XMLs: {len(found_items)}")
names_set = set(x['name'] for x in found_items)
print(f"Unique names: {len(names_set)}")

# Compare with our current icons in tso_icon_finder/icons/
with open('icons_data.js', 'r', encoding='utf-8') as f:
    js_text = f.read()
existing_names = set(re.findall(r'"name":\s*"([^"]+)"', js_text))
print(f"Already existing in icon_finder: {len(existing_names)}")

missing_names = names_set - existing_names
print(f"Missing names found in XMLs: {len(missing_names)}")
print("Sample missing names:", list(missing_names)[:25])
