import os, re, json

with open('tso_icon_finder/icons_data.js', 'r', encoding='utf-8') as f:
    js_text = f.read()
existing_names = set(re.findall(r'"name":\s*"([^"]+)"', js_text))
print(f"Already existing in icon_finder: {len(existing_names)}")

# Re-run collection
docs_xml_dir = r'tso_icon_finder/docs/xml'
found_items = {}

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
        
        # GuiIcon
        for m in re.finditer(r'<GuiIcon\s+name="([^"]+)"\s+filename="([^"]+)"', content):
            found_items[m.group(1)] = (m.group(2), 'GuiIcon', f)
            
        # Buff
        for m in re.finditer(r'<Buff\b[^>]*\bname="([^"]+)"[^>]*\biconfilename="([^"]+)"', content):
            found_items[m.group(1)] = (m.group(2), 'Buff', f)
            
        # Building
        for m in re.finditer(r'<Building\b[^>]*\bname="([^"]+)"[^>]*\biconfilename="([^"]+)"', content):
            found_items[m.group(1)] = (m.group(2), 'Building', f)
            
        # ResourceIcon
        for m in re.finditer(r'<ResourceIcon\s+name="([^"]+)"\s+filename="([^"]+)"', content):
            found_items[m.group(1)] = (m.group(2), 'ResourceIcon', f)
            
        # Adventure
        for m in re.finditer(r'<Adventure\b[^>]*\bname="([^"]+)"[^>]*\b(buffIcon|teaserImage|avatarImage)="([^"]+)"', content):
            found_items[m.group(1)] = (m.group(3), 'Adventure', f)

        # ShopItem
        for m in re.finditer(r'<ShopItem\b[^>]*\bname="([^"]+)"[^>]*\b(?:icon|iconfilename|customiconfilename)="([^"]+)"', content):
            found_items[m.group(1)] = (m.group(2), 'ShopItem', f)

print(f"Unique icon names in XMLs: {len(found_items)}")
missing = set(found_items.keys()) - existing_names
print(f"Missing from current database: {len(missing)}")

# Sample missing
print("Sample missing items with filenames:")
for name in list(missing)[:20]:
    fn, kind, src_file = found_items[name]
    print(f"  {name} -> {fn} ({kind} in {src_file})")
