import re

def clean_xml_input(text):
    if not text:
        return ''
    clean = text.strip()
    attr_match = re.search(r'(?:name|id|icon|iconfilename|type)\s*=\s*["\']([^"\']+)["\']', clean, re.IGNORECASE)
    if attr_match:
        clean = attr_match.group(1)
    else:
        tag_match = re.search(r'<([a-zA-Z0-9_\-]+)>([^<]+)</\1>', clean)
        if tag_match:
            clean = tag_match.group(2).strip()
        else:
            clean = re.sub(r'^[<"\'\s]+|[>"\'\s/]+$', '', clean)
    clean = re.sub(r'\.png$', '', clean, flags=re.IGNORECASE)
    return clean

tests = [
    'Beer',
    'Beer.png',
    '<t id="Beer" text="Квас" />',
    '<Building name="IronSmelter">',
    'name="DepositWood"',
    '<icon>General</icon>',
    '"Goldmine"',
    'iconfilename="Woodcutter.png"'
]

for t in tests:
    print(f"'{t}' -> '{clean_xml_input(t)}'")
