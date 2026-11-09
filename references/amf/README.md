# AMF-дампы живого трафика TSO — референс

> **Расположение:** `docs/references/amf/`
> Это постоянный референс для **любых**
> будущих задач по протоколу, а не только для очереди производства бафов.

Зачем: до этих дампов все выводы о формате снапшота зоны и о форме VO
делались по декомпилированному клиенту (`client_scripts.txt`) и были
гипотезами. Две такие гипотезы оказались неверными. Живой трафик —
единственный авторитетный источник по формату ответов.

## Источник

```
POST https://r02-gs003.thesettlersonline.ru/GameServer/amf
content-type: application/x-amf
referrer:     https://www.thesettlersonline.ru/
дата:        2026-08-28
zoneID:       1601416 (тестовый аккаунт оператора)
```

Снято из DevTools: запросы через «Copy as fetch», ответы через base64 data-URL.

## Содержимое

| Файл | Что это |
| --- | --- |
| `req.txt` | исходник от оператора как есть, 8 пар запрос/ответ |
| `example-requests.md` | примеры запросов в формате fetch и ответов в base64 |
| `callNN_request.body.bin` | тело запроса, восстановленное из JS-строки (С ПОТЕРЯМИ, см. ниже) |
| `callNN_request.strings.txt` | ASCII-строки из запроса — классы, traits, handler, operation |
| `callNN_response.bin` | ответ сервера, байт-в-байт (годится как тестовая фикстура) |
| `callNN_response.b64` | то же в base64 |
| `callNN_response.decoded.json` | декодированный ответ |
| `call03_response.decoded.json.gz` | снапшот зоны в JSON (сжат, развёрнутый ~10 МБ) |
| `call03_response.schema.json` | структурная схема `dZoneVO`: пути, имена классов, типы, длины коллекций |
| `start_timed_production_91_response.b64` | ОТДЕЛЬНЫЙ дамп: ответ на команду 91 (START_TIMED_PRODUCTION) |
| `amf3.py` | переносимый декодер AMF3 на Python без зависимостей |
| `decode.py` | готовый CLI: декодировать любой `.bin` / `.b64` |

## Таблица восьми пар

`errorCode = 0` и `zoneID = 1601416` во всех ответах.

| № | target | Handler | Ответ `type` | Payload ответа | Размер |
| --- | --- | --- | --- | --- | --- |
| 01 | `/1/onResult` | — (пинг/сессия) | — | `null`, выдаёт `DSId` | 332 б |
| 02 | `/2/onResult` | `PlayerHandler` | 1014 | `dPlayerListVO` — список друзей | 1 371 б |
| **03** | `/3/onResult` | `EventHandler` | **1002** | **`dZoneVO` — полный снапшот зоны** | **595 147 б** |
| 04 | `/4/onResult` | `EventHandler` | 1062 | `dGameTickCommandVO` | 578 б |
| 05 | `/5/onResult` | `TradeWindowHandler` | 1063 | `ArrayCollection<dTradeObjectVO>` | 869 б |
| 06 | `/6/onResult` | `GuildHandler` | 4014 | `null` (пустой ack) | 444 б |
| 07 | `/7/onResult` | `EventHandler` | 1005 | `null` (запрос нёс `dClientInitDataVO`) | 444 б |
| 08 | `/8/onResult` | `EventHandler` | 15000 | `dBlackMarketAuctionStateVO` | 638 б |

Запросы 02–08 все имеют одну и ту же оболочку:

```
flex.messaging.messages.RemotingMessage
  destination = com.bluebyte.game.servlet.{Event|Player|Guild|TradeWindow}Handler
  operation   = ExecuteServerCall
  parameters[0] = defaultGame.Communication.VO.dServerCall {
      type, zoneID, data, dsoAuthUser, dsoAuthToken, dsoAuthRandomClientID }
  headers = { DSEndpoint: "SMC-Endpoint", DSId: "<uuid>" }
```

Ответы все имеют одну и ту же оболочку:

```
AcknowledgeMessage
  body = dServerResponse { type, zoneID, data }
    data = dServerActionResult { clientTime, errorCode, data }
      data = <полезная нагрузка>
```

Пути для парсера: `body.data.errorCode`, `body.type`, `body.data.data`.

## Как декодировать

```bash
# Из папки docs/references/amf:
python decode.py call03_response.bin | less
python decode.py call03_response.b64 --schema

# Или из корня проекта:
python docs/references/amf/decode.py docs/references/amf/call03_response.bin
```

Или из кода:

```python
import amf3
pkt = amf3.decode_packet(open('call03_response.bin', 'rb').read())
zone = pkt['bodies'][0]['value']['body']['data']['data']
queues = zone['timedProductions_vector']
```

## Грабли, о которые мы уже споткнулись

1. **`flex.messaging.io.ArrayCollection` — externalizable.** После traits идёт одно
   вложенное AMF-значение (сам массив), которое ОБЯЗАТЕЛЬНО читать. Если
   его пропустить, парсер не падает, а тихо сдвигает все последующие поля —
   самая коварная ошибка из встретившихся. Проверьте это в
   `ZoneParserService.php` и `storage/app/parse_zone.py`.
2. **`declared_len` тела бывает `0xFFFFFFFF`** (неизвестная длина). Не верить
   этому полю, читать до конца буфера.
3. **`type` в ответе ≠ номер отправленной команды.** Запрос зоны — 1001,
   ответ пришёл с 1002. У команды 91 ответ был 91. Совпадение проверять
   покомандно, а не утверждать в общем валидаторе.
4. **`double` в AMF (маркер `0x05`) встречается там, где ждёшь int.** Например
   `collectedTime`, `modifiedProductionMultiplier`,
   `modifiedInstantFinishCostMultiplier`. В PHP это обязаны быть `float`
   (`0.0`, `1.0`), иначе сервер может не принять пакет.
5. **Запросы в `req.txt` битые.** Chrome «copy as fetch» отдаёт тело как
   JS-строку, и все байты, не сложившиеся в валидный UTF-8, заменены на
   U+FFFD (5–13 байт на запрос). Именно числа пострадали: номера команд и
   `zoneID` не восстанавливаются. Поэтому `*_request.body.bin` годится только
   для чтения строк, а НЕ как тестовая фикстура.

## Как снимать дампы правильно (для будущих задач)

Нужны байты, а не текст. В DevTools → Console, до выполнения действия в
игре:

```js
(() => {
  const orig = window.fetch;
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  window.fetch = async (url, opt) => {
    if (String(url).includes('/GameServer/amf')) {
      const body = opt && opt.body;
      const reqBuf = typeof body === 'string'
        ? Uint8Array.from(body, (c) => c.charCodeAt(0) & 0xff).buffer
        : body;
      console.log('REQ', b64(reqBuf));
      const res = await orig(url, opt);
      const clone = await res.clone().arrayBuffer();
      console.log('RES', b64(clone));
      return res;
    }
    return orig(url, opt);
  };
})();
```

Важно: если клиент шлёт тело как `ArrayBuffer`/`Blob` (а он так и делает),
то ветка с `charCodeAt` не нужна и байты берутся без потерь. Собранный
`REQ` для команды 91 закроет открытый вопрос OQ-4 в спеке
`buff-production-queue`.

## Связанные документы

- `docs/spec/buff-production-queue/protocol-evidence.md` — разбор команды 91
- `docs/spec/buff-production-queue/zone-snapshot-evidence.md` — разбор `dZoneVO`
  и очередей производства
- `docs/references/client_scripts.txt` — декомпилированный клиент (поведение)
- `app/Services/Amf/` — текущая реализация транспорта и VO
