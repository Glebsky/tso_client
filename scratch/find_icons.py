import glob, re
for f in glob.glob('userscripts/*.js'):
    with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
        t = fp.read()
    m = re.findall(r'["\']([A-Za-z0-9_]*(?:Write|Edit|Rename|Pen|Mail)[A-Za-z0-9_]*)["\']', t)
    if m:
        for x in set(m):
            if len(x) < 30 and 'Icon' in x:
                print(f, x)
