import sys,json
from pathlib import Path
sys.path.insert(0,'C:/OSPanel/home/vani-reg/dist/VaniGateway')
from tools.orchestrator import VaniClient
root=Path('C:/OSPanel/home/tso_client/scratch/refill-vani')
try:
 client=VaniClient(autostart=False,timeout=180)
 model='deepseek/deepseek-v4.1-flash'
 text=(root/'new-core.txt').read_text(encoding='utf8')
 prompt='Audit only substantive correctness issues in this ES5 TSO AIR deposit forecast core. Do not edit files. Verified AS contracts: CalculateWays returns 2*warehouseOneWay+2*depositOneWay+production including current work modifiers, ms divided by mGlobalTimeScale; getters return matching pieces. BuffAppliance times use GetClientTime, getDuration returns ms. GetResourceInputFactor is int(basePct/100), then for each TIMED=0 or ZONE=1 buff sequential int(factor*pct/100); resource removal = amountRemoved*inputFactor at END of deposit work. Source cBuilding modes: 21 warehouse outbound;24 instant workyard wait to seek deposit;25 outbound to deposit;27 deposit work;26 return from deposit (pathPos goes L..2L);22 warehouse return (pathPos goes L..2L). path progress unit speed5; mStartWorkCounter ms. All forecasts conditional on unchanged paths/modifiers except input-only buff expiration. Nonempty/unreadable effect lists cause N/A at expiry, no invented post-speed rates. Actual source has effect lists .list.length. Missing data -> N/A. Already 1056 event-reference boundary cases pass including event at expiry. Look especially for null/coercion bugs, invalid unknown->zero, clock consistency, aggregation. Max 600 words, no fabricated APIs. '+text
 r=client.req('POST','/v1/chat/completions',payload={'model':model,'messages':[{'role':'user','content':prompt}],'stream':False,'reasoning_effort':'low','max_tokens':2300})
 (root/'deepseek-review.json').write_text(json.dumps({'requested_model':model,'response_model':r.get('model'),'answer':r.get('choices',[{}])[0].get('message',{}).get('content','')},ensure_ascii=False),encoding='utf8')
except Exception as e:
 (root/'deepseek-review.json').write_text(json.dumps({'error':str(e)},ensure_ascii=False),encoding='utf8')
