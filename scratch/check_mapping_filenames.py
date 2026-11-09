import json

with open('mapping/mapping.json', 'r') as f:
    mapping = json.load(f)

print("Searching for buff_sushi_plate.png in mapping.json:")
for k, v in mapping.items():
    if 'buff_sushi_plate' in k:
        print(" ", k, "->", v)

print("Searching for icon_bakery in mapping.json:")
for k, v in mapping.items():
    if 'icon_bakery' in k:
        print(" ", k, "->", v)

print("Searching for empty.png in mapping.json:")
for k, v in mapping.items():
    if 'empty.png' in k:
        print(" ", k, "->", v)
