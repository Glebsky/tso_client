import re

with open('lang.txt', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

sections = re.findall(r'<s name="([^"]+)">', text)
print(f"Total sections: {len(sections)}")
print("Sections:", sections)

# Count tags
tags = re.findall(r'<t id="([^"]+)" text="([^"]*)"', text)
print(f"Total translated tags: {len(tags)}")
print("Sample tags:", tags[:20])
