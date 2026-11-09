import re

with open('icon_resource.html', 'r', encoding='utf-8') as f:
    text = f.read()

names = set(re.findall(r'<div class="mt-2 fw-bold">([^<]+)</div>', text))

def search(q):
    q = q.lower()
    return [n for n in names if q in n.lower()]

print("Cok:", search("cok"))
print("Coal:", search("coal"))
print("Sword:", search("sword"))
print("Smelter:", search("smelter"))
print("Buff:", search("buff")[:10])
