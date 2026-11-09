import json, urllib.request, os
from concurrent.futures import ThreadPoolExecutor

with open('mapping/mapping.json', 'r') as f:
    mapping = json.load(f)

# File lookup
file_lookup = {}
for path, h in mapping.items():
    fname = os.path.basename(path).lower()
    if fname not in file_lookup:
        file_lookup[fname] = []
    file_lookup[fname].append((path, h))

test_files = [
    'icon_forester.png',
    'empty.png',
    'set_bg.png',
    'icon_statue_riding_01.png',
    'grimoirepage10.png',
    'b_bakery.png',
    'b_blacksmith.png',
    'icon_tree.png',
    'icon_bandit_boss1.png',
    'slot_icon_tank.png'
]

def download_one(fn):
    fn_clean = fn.lower()
    if fn_clean not in file_lookup:
        return fn, False, "Not in mapping.json"
    orig_path, h = file_lookup[fn_clean][0]
    subdir = orig_path.rsplit('/', 1)[0]
    url = f"https://www.thesettlersonline.ru/frontend/GFX_HASHED/{subdir}/{h}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        res = urllib.request.urlopen(req, timeout=5)
        data = res.read()
        return fn, True, len(data)
    except Exception as e:
        return fn, False, str(e)

with ThreadPoolExecutor(max_workers=5) as pool:
    results = list(pool.map(download_one, test_files))

for fn, success, info in results:
    print(f"{fn}: {'OK' if success else 'FAIL'} ({info})")
