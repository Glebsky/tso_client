import urllib.request, json

with open('mapping/mapping.json', 'r') as f:
    mapping = json.load(f)

# Let's test a few candidate base URLs with known hashes
h_png = mapping.get('adventures/avatars/1001_nights_besieged_city_avatar.png')
print("Hash:", h_png)

candidate_bases = [
    f"https://ubistatic-a.akamaihd.net/0018/live/GFX_HASHED/{h_png}",
    f"https://ubistatic-a.akamaihd.net/0018/live/{h_png}",
    f"https://ubistatic-a.akamaihd.net/0018/live/SWMMO/{h_png}",
    f"https://ubistatic-a.akamaihd.net/0018/live/unity/SWMMO/{h_png}",
    f"https://ubistatic-a.akamaihd.net/0018/live/debug/unity/SWMMO/{h_png}",
    f"https://ubistatic-a.akamaihd.net/0018/live/debug/unity/SWMMO/GFX_HASHED/{h_png}",
    f"https://www.thesettlersonline.com/frontend/GFX_HASHED/{h_png}",
    f"https://www.thesettlersonline.net/frontend/GFX_HASHED/{h_png}",
    f"https://www.diesiedleronline.de/frontend/GFX_HASHED/{h_png}",
    f"https://ubistatic-a.akamaihd.net/0018/live/debug/unity/SWMMO/Build/{h_png}",
]

for url in candidate_bases:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        res = urllib.request.urlopen(req, timeout=3)
        print(f"FOUND! {url} -> {len(res.read())} bytes")
        break
    except Exception as e:
        print(f"Failed {url} -> {e}")
