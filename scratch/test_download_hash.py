import urllib.request

urls = [
    "https://www.thesettlersonline.ru/frontend/GFX_HASHED/8b472fbcff0851e476ae403e62e14fa37965c270.png",
    "https://www.thesettlersonline.com/frontend/GFX_HASHED/8b472fbcff0851e476ae403e62e14fa37965c270.png",
    "https://www.diesiedleronline.de/frontend/GFX_HASHED/8b472fbcff0851e476ae403e62e14fa37965c270.png",
    "https://ubistatic-a.akamaihd.net/0018/live/GFX_HASHED/8b472fbcff0851e476ae403e62e14fa37965c270.png"
]

for u in urls:
    try:
        req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        res = urllib.request.urlopen(req, timeout=5)
        data = res.read()
        print(f"SUCCESS! {u} -> {len(data)} bytes")
        break
    except Exception as e:
        print(f"Failed {u} -> {e}")
