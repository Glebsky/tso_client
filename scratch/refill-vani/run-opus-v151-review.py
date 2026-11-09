import sys,json
from pathlib import Path
sys.path.insert(0,r'C:/OSPanel/home/vani-reg/dist/VaniGateway')
from tools.orchestrator import VaniClient
root=Path(r'C:/OSPanel/home/tso_client/scratch/refill-vani');out=root/'opus-v151-review.json';model='anthropic/claude-opus-5.5'
prompt='''Проведи независимый строгий read-only аудит TSO AIR userscript v1.5.1 по приложенному первичному ActionScript. НЕ переписывай файл и не выполняй команды. Отделяй доказанные баги от гипотез/ограничений. Предыдущие модели могли ошибаться, не считай комментарии JS доказательством. Проверить: 1) дорога, RAW work counter и phase21/24/25/26/27/22, overshoot и SpeedUp; 2) multiple counter modifiers, int truncation, multiplier=0/adder/chance/channel; 3) текущие и будущие input/output buffs, expiry boundaries; 4) zoneForecastLimit/repeating-effects — не превращает ли слишком много нормальных случаев в N/A; 5) общие залежи, depletionAt, consumedBy, фильтры производителей; 6) JS/AIR публичные API и отсутствие действий траты ресурсов; 7) ошибки достоверности в zero/unknown/stopped случаях. Для каждого finding: severity, точная функция/строка скрипта или уникальный фрагмент, первичная AS строка, минимальный числовой воспроизводимый пример, безопасное направление исправления. Не выдумывай API. Можно прямо признать неизвестность если AS участка недостаточно. Гарантий живого AIR нет. Scope текущие маршруты при неизменном состоянии; не требуем прогноз будущих действий игрока. Все UI строки должны быть внутриигровые, без собственных словарей; русских комментариев и автопополнения быть не должно. Ответ на русском, максимум 1800 слов. Ищи настоящие ошибки, а не косметику.\n\n'''
try:
 c=VaniClient(autostart=False,timeout=360)
 r=c.req('POST','/v1/chat/completions',payload={'model':model,'messages':[{'role':'user','content':prompt+(root/'opus-v151-context.txt').read_text(encoding='utf-8')}],'stream':False})
 result={'status':'completed','requested_model':model,'response_model':r.get('model'),'finish_reason':r['choices'][0].get('finish_reason'),'answer':r['choices'][0]['message']['content'],'usage':r.get('usage')}
except Exception as e:result={'status':'error','requested_model':model,'error':str(e)}
out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
