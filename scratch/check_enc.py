with open('lang.txt', 'rb') as f:
    sample = f.read(50000)

for enc in ['utf-8', 'windows-1251', 'cp1251', 'iso-8859-5']:
    try:
        decoded = sample.decode(enc)
        if 'рус' in decoded.lower() or 'текст' in decoded.lower() or 'игра' in decoded.lower() or 'окно' in decoded.lower():
            print(f'Valid encoding: {enc}')
            break
    except Exception as e:
        pass
