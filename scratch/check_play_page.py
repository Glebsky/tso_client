import re

with open('prototype/debug_play_page.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

for m in re.finditer(r'var flashvars\s*=\s*\{([\s\S]*?)\};', text):
    print(m.group(0)[:500])

for m in re.finditer(r'["\']s["\']\s*:\s*["\']([^"\']+)["\']', text):
    print("s:", m.group(1))

for m in re.finditer(r'https?://[^\s"\'<>]+', text):
    if 'akamai' in m.group(0) or 'static' in m.group(0):
        print("url:", m.group(0))
