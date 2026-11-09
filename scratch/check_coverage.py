import re

with open('icon_resource.html', 'r', encoding='utf-8') as f:
    html = f.read()

names = re.findall(r'<div class="mt-2 fw-bold">([^<]+)</div>', html)
print(f"Total names: {len(names)}")

# Check some known buildings
buildings = ['IronSmelter', 'Blacksmith', 'Brewery', 'BronzeSmelter', 'CokingPlant', 'Farm', 'Forester', 'Woodcutter']
print("Buildings in html:", [b for b in buildings if b in names])

# Check some known buffs
buffs = ['FishFood', 'SolidSand', 'DeerMusk', 'RabbitFoot', 'RedFlyingSettler', 'ChocolateRabbit']
print("Buffs in html:", [b for b in buffs if b in names])

# Check some specialists
specs = ['General', 'Explorer', 'Geologist', 'GeneralVargus', 'GeneralNusala', 'GeneralAnslem', 'GhostGeneral']
print("Specs in html:", [s for s in specs if s in names])

# Check some adventures
advs = ['BuffAdventures_DragonsRoost', 'IslandOfThePirates', 'TheBlackKnights', 'WitchOfTheSwamp']
print("Advs in html:", [a for a in advs if a in names])
