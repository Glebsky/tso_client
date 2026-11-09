import re

with open('client/Main.xaml.cs', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

urls = set(re.findall(r'https?://[^\s"\'\<\>]+', text))
for u in sorted(urls):
    print(u)
