import re
with open('lang.txt', 'r', encoding='utf-8') as f:
    text = f.read()

with open('scratch/out.txt', 'w', encoding='utf-8') as f_out:
    for tid in ['GuildEdit', 'GuildEditDetails', 'Name', 'UserName', 'Save', 'Rename', 'Edit']:
        m = re.search(r'<t id="' + tid + r'" text="([^"]*)"', text)
        if m:
            f_out.write(f'{tid}: {m.group(1)}\n')
