import json, os, re

with open('mapping/mapping.json', 'r') as f:
    mapping = json.load(f)

# Build a lookup by filename (e.g. icon_forester.png -> full path & hash)
file_lookup = {}
for path, h in mapping.items():
    fname = os.path.basename(path).lower()
    if fname not in file_lookup:
        file_lookup[fname] = []
    file_lookup[fname].append((path, h))

# Also without .png extension
for path, h in mapping.items():
    fname_no_ext = os.path.splitext(os.path.basename(path))[0].lower()
    if fname_no_ext not in file_lookup:
        file_lookup[fname_no_ext] = []
    file_lookup[fname_no_ext].append((path, h))

# Read missing items
from check_missing_xml import found_items, existing_names

matched = 0
not_matched = 0
samples = []

for name, (icon_fn, kind, src_file) in found_items.items():
    if name in existing_names:
        continue
    
    # Try direct filename
    clean_fn = icon_fn.lower().strip()
    clean_fn_png = clean_fn if clean_fn.endswith('.png') else clean_fn + '.png'
    
    if clean_fn in file_lookup or clean_fn_png in file_lookup:
        matched += 1
        entry = file_lookup.get(clean_fn) or file_lookup.get(clean_fn_png)
        if len(samples) < 15:
            samples.append((name, icon_fn, entry[0]))
    else:
        not_matched += 1

print(f"Of {len(found_items) - len(set(found_items.keys()) & existing_names)} missing items:")
print(f"  Matched in mapping.json: {matched}")
print(f"  Not matched: {not_matched}")
print("\nSample matches:")
for name, ifn, (orig_path, h) in samples:
    print(f"  {name} -> {ifn} -> {orig_path} ({h})")
