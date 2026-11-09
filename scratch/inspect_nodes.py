import re

with open(r'tso_icon_finder/docs/xml/icons.xml', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

for tag in ['Buff', 'Building', 'ResourceIcon', 'Adventure', 'Deposit']:
    m = re.search(rf'(<{tag}\b[^>]+>)', text)
    if m:
        print(f"Sample {tag}:", m.group(1))

# Let's inspect AvailableBuffs
m_buffs = re.findall(r'<Buff\b([^>]+)>', text)
print(f"\nTotal <Buff> nodes: {len(m_buffs)}")
for b in m_buffs[:5]:
    print(" ", b.strip())

# Let's inspect Buildings
m_builds = re.findall(r'<Building\b([^>]+)>', text)
print(f"\nTotal <Building> nodes: {len(m_builds)}")
for b in m_builds[:5]:
    print(" ", b.strip())
