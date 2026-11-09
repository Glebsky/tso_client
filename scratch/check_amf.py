import json

with open('mapping/mapping.json', 'r') as f:
    m = json.load(f)

amf_packs = {k: v for k, v in m.items() if 'amfpacker' in k}
print("AMF packs:", amf_packs)
