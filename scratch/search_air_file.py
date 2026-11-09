import glob, re
for path in glob.glob('userscripts/*.js'):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        t = f.read()
    m = re.findall(r'air\.File[A-Za-z0-9_.]*', t)
    if m:
        print(path, set(m))
