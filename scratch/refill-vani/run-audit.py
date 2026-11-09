import sys,json
from pathlib import Path
sys.path.insert(0,'C:/OSPanel/home/vani-reg/dist/VaniGateway')
from tools.orchestrator import VaniClient
root=Path('C:/OSPanel/home/tso_client/scratch/refill-vani')
try:
 c=VaniClient(autostart=False,timeout=240)
 model='moonshotai/kimi-k2.7-code'
 prompt='Audit this TSO AIR userscript versus source below. Need real production+travel, input cost buffs and their expiration using GetClientTime, shared deposits. No conditional fallback 10min; unknown must be N/A. ES5. No state mutation/server commands. Return <=1200 words: exact bugs, verified API, algorithm, missing source requirements. No speculative APIs. No edits. Note CalculateWays already includes all travel and GetWorkTime modifiers. '+(root/'context.txt').read_text(encoding='utf8')
 r=c.req('POST','/v1/chat/completions',payload={'model':model,'messages':[{'role':'user','content':prompt}],'stream':False,'reasoning_effort':'low','max_tokens':5000})
 out={'requested_model':model,'response_model':r.get('model'),'answer':r.get('choices',[{}])[0].get('message',{}).get('content','')}
 (root/'kimi-audit.json').write_text(json.dumps(out,ensure_ascii=False),encoding='utf8')
except Exception as e:
 (root/'kimi-audit.json').write_text(json.dumps({'error':str(e)},ensure_ascii=False),encoding='utf8')
