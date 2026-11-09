import json, urllib.request

m = json.load(open('mapping/mapping.json'))
for k, v in m.items():
    if 'icon_forester' in k:
        print(k, '->', v)
        subdir = k.rsplit('/', 1)[0]
        url = f'https://www.thesettlersonline.ru/frontend/GFX_HASHED/{subdir}/{v}'
        print('Testing URL:', url)
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            res = urllib.request.urlopen(req, timeout=5)
            print('SUCCESS!', len(res.read()), 'bytes')
        except Exception as e:
            print('Failed:', e)
