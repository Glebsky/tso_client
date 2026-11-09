import re

with open('lang.txt', 'rb') as f:
    text = f.read()

m = re.search(b'<t id="Beer" text="([^"]+)"', text)
if m:
    val = m.group(1)
    print("Beer raw bytes:", val)
    try:
        print("utf-8 decode:", val.decode('utf-8'))
    except Exception as e:
        print("utf-8 failed:", e)
    try:
        print("cp1251 decode:", val.decode('cp1251'))
    except Exception as e:
        print("cp1251 failed:", e)

    # Double decode?
    try:
        s1 = val.decode('utf-8')
        s2 = s1.encode('latin1').decode('cp1251')
        print("utf8->latin1->cp1251:", s2)
    except Exception as e:
        pass
    try:
        s1 = val.decode('cp1251')
        s2 = s1.encode('latin1').decode('utf-8')
        print("cp1251->latin1->utf8:", s2)
    except Exception as e:
        pass
