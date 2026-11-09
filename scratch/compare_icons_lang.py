import re

with open('icon_resource.html', 'r', encoding='utf-8') as f:
    html = f.read()
icons = dict(re.findall(r'src="(data:image/png;base64,[^"]+)"><div class="mt-2 fw-bold">([^<]+)</div>', html))
# reverse mapping: name -> src
icon_map = {name: src for src, name in re.findall(r'src="(data:image/png;base64,[^"]+)"><div class="mt-2 fw-bold">([^<]+)</div>', html)}

with open('lang.txt', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

translations = {}
for s_match in re.finditer(r'<s name="([^"]+)">([\s\S]*?)</s>', text):
    sec = s_match.group(1)
    for t_match in re.finditer(r'<t id="([^"]+)" text="([^"]*)"', s_match.group(2)):
        translations[t_match.group(1)] = (sec, t_match.group(2))

matches = set(icon_map.keys()) & set(translations.keys())
print(f"Total icons in html: {len(icon_map)}")
print(f"Total translated IDs: {len(translations)}")
print(f"Direct name matches between icons and lang.txt: {len(matches)}")

# Let's check some non-matches to see why
non_matches = set(icon_map.keys()) - set(translations.keys())
print(f"Icon names not directly in translations ({len(non_matches)}):", list(non_matches)[:20])
