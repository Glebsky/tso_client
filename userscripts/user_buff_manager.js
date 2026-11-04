/**
 * Buff Manager 2.3.1
 *
 * Buff template manager for The Settlers Online client, built on the stock buff module (6-buffs.js).
 *  - Window styled to match classic client windows (window_*, btn_* textures),
 *    isolated from Bootstrap styles (custom classes, scoped to #buffManagerModal);
 *  - Texts from the in-game localization (loca) and the client translations, images from game assets;
 *  - Template recording like the stock module: every own buff applied to a building of the recorded
 *    island is captured (any buff type, already recorded buildings are kept), record more, discard;
 *  - Templates compatible with SaveLoadTemplate('buff') files; saving remembers the chosen file;
 *    recent template cards with rename, delete and quick start; every card shows the owner of its
 *    island, the templates of the viewed island come first, the others offer to visit their island;
 *  - A template is used only on its island (like the stock module): on another island its rows are
 *    marked, Apply and quick start are not offered, "Visit island" opens it. Right before every
 *    command the building must belong to the owner of that island (no buffs on buildings of another
 *    player, also while the client still shows the previous island after a visit);
 *  - Apply engine: a single paced sender (one command per batch, 1 s like the client TimedQueue or
 *    faster), a FIFO queue of templates (start one template and immediately the next one), star menu
 *    stacks reserved per command, cBuff.IsApplyable pre-check right before every command, server
 *    confirmation through the 'buffApplied' notification or the building itself (missed or foreign
 *    notifications), re-check with retries on timeout,
 *    pause while another island is open, cancellation per template or of the whole queue.
 *    The selection is sent as it was chosen: right before a command only what makes it impossible
 *    (buff placed, no stock, building missing, depleted deposit) skips it, temporary states are
 *    checked again a bit later. Short production waits of a working building (resources, warehouse,
 *    settler, tools) are buffed like in the stock module, the options only concern stopped buildings
 *    and mines;
 *  - Results: "Complete" is shown while the buff is active, then the row can be buffed again;
 *    failed rows can be sent again;
 *  - Live window: every confirmed command, every buff placed on a listed building (star menu,
 *    friends, other scripts) and every restore of the minimized window update the rows at once;
 *    the game state is analysed again periodically and only changed parts are redrawn.
 *
 * Author: MadFx
 */
(function () {
    'use strict';

    var VERSION = '2.3.1';
    var MODAL_ID = 'buffManagerModal';
    var SEL = '#' + MODAL_ID;
    var SETTINGS_KEY = 'BUFF_MANAGER_SETTINGS';
    var TRACKER_NAME = 'buffManagerV2';
    var TEMPLATE_MODULE = 'buff';
    var CMD_APPLY_BUFF = 61;
    var SPEEDS = [1000, 700, 500];      // pause between two commands, ms (1000 = client TimedQueue)
    var CONFIRM_TIMEOUT = 12000;        // no 'buffApplied' within this time: the building is checked
    var EARLY_CHECK = 1500;             // a sent command is also confirmed when the building already shows the buff
    var MAX_SENDS = 3;                  // a command is sent at most three times (two automatic retries)
    var BLOCKED_RETRY = 1500;           // building temporarily blocked / not applicable: try again a bit later
    var BLOCKED_MAX = 8;
    var DONE_HOLD = 30000;              // a confirmed row stays 'done' at least this long, then while its buff is active
    var ZONE_SETTLE = 1500;             // after another island was opened, commands wait until it is loaded
    var ZONE_STALE_MAX = 20000;         // longest wait for the zone of a just opened island to replace the previous one
    var OWNER_SAMPLE = 6;               // buildings sampled for the owner of the shown island
    var MISSING_GRACE = 10000;          // a building not found so soon after an island change is checked again
    var PUMP_TICK = 250;
    var MAX_CHECKS = 60;                // rows checked per engine step (keeps every step short)
    var KEEP_DONE = 5;                  // finished templates kept for the summary
    var AUTO_REFRESH = 10000;           // full analysis of the open window (only changed parts are redrawn)
    var SETTLE_REFRESH = 2000;          // one more full analysis after the queue is finished
    var UI_TICK = 1000;
    var WATCH_TICK = 1000;              // the shown island is watched all the time (visits are seen step by step)
    var REFRESH_DELAY = 120;
    var SEARCH_DELAY = 200;
    // cBuff.IsApplyable() results (CURSOR_VALID codes) handled by the manager.
    var AP_NO_DEPOSIT = 13, AP_MAX_BUFFS = 25, AP_BLOCKED = 28;
    var DEFAULTS = { buffStopped: false, safeMines: true, delay: SPEEDS[0], autoMin: true };
    var TOKEN = { version: VERSION };

    // A previous instance (script reload) must release its timers, observers and DOM first.
    try {
        if (window.__BUFF_MANAGER__ && typeof window.__BUFF_MANAGER__.dispose === 'function') {
            window.__BUFF_MANAGER__.dispose();
        }
    } catch (ePrev) { }

    /* ------------------------------------------------------------------ */
    /* Utilities                                                           */
    /* ------------------------------------------------------------------ */

    function safe(fn, def) {
        try {
            var v = fn();
            return (v === undefined || v === null) ? def : v;
        } catch (e) {
            return def;
        }
    }

    function log(e) {
        try { if (typeof debug === 'function') debug(e); } catch (x) { }
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function now() { return new Date().getTime(); }
    function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function isArr(a) { return Object.prototype.toString.call(a) === '[object Array]'; }
    function trim(s) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }

    /* ------------------------------------------------------------------ */
    /* Localisation: every visible text comes from the game loca            */
    /* ------------------------------------------------------------------ */

    var LOCA = {
        menu: [['LAB', 'UseProduction'], ['LAB', 'Buffs']],
        title: [['LAB', 'UseProduction'], ['LAB', 'Buffs']],
        apply: [['LAB', 'UseProduction'], ['LAB', 'Send']],
        buff: [['LAB', 'Buff']],
        buildings: [['LAB', 'Buildings']],
        status: [['LAB', 'Status'], ['LAB', 'ProductionStatus']],
        time: [['LAB', 'Time'], ['LAB', 'TimeRemaining']],
        duration: [['LAB', 'Duration']],
        deposit: [['LAB', 'DetailsDeposit']],
        depleted: [['MEL', 'DepositDepleted']],
        mines: [['HIL', 'Help_window_mines_0']],
        ready: [['LAB', 'Available']],
        requires: [['LAB', 'Requires']],
        buffed: [['MEL', 'PlacedBuff']],
        done: [['LAB', 'Complete']],
        pending: [['LAB', 'SpecialistTaskWaitForConfirmation']],
        failed: [['ALT', 'ZoneTimedBuffCannotPlace'], ['MEL', 'ServerCallFailed']],
        unavailable: [['LAB', 'Unavailable']],
        nostock: [['LAB', 'Missing_Resources']],
        stopped: [['LAB', 'StatusStopped']],
        upgrade: [['LAB', 'Upgrade']],
        noTools: [['MEL', 'NoTools']],
        whFull: [['MEL', 'UsedResourceBuffLimitReached']],
        prodStopped: [['LAB', 'OutputResourceBuffedNegative']],
        all: [['LAB', 'All']],
        search: [['LAB', 'Search'], ['LAB', 'Filter']],
        selectAll: [['TOT', 'SelectAllTip']],
        select: [['LAB', 'Select']],
        save: [['LAB', 'Save']],
        load: [['LAB', 'Select']],
        reset: [['LAB', 'Reset']],
        discard: [['LAB', 'Discard'], ['LAB', 'Cancel']],
        update: [['LAB', 'Update']],
        del: [['LAB', 'Delete']],
        close: [['LAB', 'Close']],
        visit: [['LAB', 'VisitIsland'], ['LAB', 'Visit']],
        goto: [['LAB', 'Visit']],
        player: [['LAB', 'User']],
        settings: [['LAB', 'ToggleOptionsPanel']],
        amount: [['LAB', 'amount']],
        speed: [['LAB', 'DuplicatedBuildingsBonus']],
        cancel: [['LAB', 'Cancel']],
        cancelled: [['LAB', 'Cancled']],
        clearQueue: [['LAB', 'ProductionCancelAllWaiting']],
        record: [['HIL', 'Help_window_use_buff_0']],
        ok: [['LAB', 'OK']],
        current: [['LAB', 'AvatarCurrentSelection']],
        history: [['LAB', 'History'], ['LAB', 'LatestChanges']],
        rename: [['LAB', 'GuildEdit'], ['LAB', 'Name']],
        connection: [['LAB', 'PacketLossReconnect']],
        connLost: [['ALT', 'ConnectionLost']],
        loading: [['LAB', 'LoadingZone']],
        loadError: [['ALT', 'IOError']]
    };
    // Labels whose loca text ends with ':' or '.' that must be shown bare.
    var STRIP = { time: 1, ready: 1, speed: 1, reset: 1, prodStopped: 1, player: 1, buildings: 1, amount: 1, deposit: 1, duration: 1, status: 1, requires: 1, history: 1, rename: 1 };

    function tr(group, key, args) {
        try {
            if (typeof loca === 'undefined' || !loca || !loca.GetText) return '';
            if (loca.hasText && !loca.hasText(group, key)) return '';
            var t = args ? loca.GetText(group, key, args) : loca.GetText(group, key);
            t = (t === undefined || t === null) ? '' : String(t);
            if (!t || t === 'undefined' || t.charAt(0) === '[' || t.indexOf('_NOT_FOUND') !== -1) return '';
            return t;
        } catch (e) {
            return '';
        }
    }

    // Client translations (0-lang-*.js, the texts of the stock buff module).
    var CTEXT = {
        loadTpl: 'load_template', recStart: 'buff_start_record', recStop: 'buff_stop_record',
        recProgress: 'buff_rec_progress', recMore: 'buff_record_more', recStarted: 'buff_rec_start',
        recStopped: 'buff_rec_stop', sent: 'command_sent', badTpl: 'bad_template'
    };

    // Own texts for the queue features (no loca / client text exists for them).
    var OWN = {
        'en-uk': {
            queued: 'Queued', enqueue: 'Add to queue', quick: 'Use now (the template is added to the queue)',
            templates: 'Templates', inQueue: 'Queue', autoMin: 'Minimize the window on start',
            waitZone: 'Waiting for the island', loadTpl: 'Load template', recStart: 'Start recording',
            recStop: 'Stop recording', recProgress: 'Recording in progress!', recMore: 'Record more',
            recStarted: 'Recording started', recStopped: 'Recording stopped', sent: 'Command sent',
            badTpl: 'Bad template file', otherIsland: 'Other island', otherIslands: 'Other islands',
            notFound: 'Building not found', foreign: 'Building of another player',
            needVisit: 'Template for the island of {0}: visit the island first',
            noSettler: 'Waiting for a settler'
        },
        'ru-ru': {
            queued: 'В очереди', enqueue: 'В очередь', quick: 'Использовать сразу (шаблон встанет в очередь)',
            templates: 'Шаблоны', inQueue: 'Очередь', autoMin: 'Сворачивать окно при запуске',
            waitZone: 'Ожидание острова', otherIsland: 'Другой остров', otherIslands: 'Другие острова',
            notFound: 'Здание не найдено', foreign: 'Здание другого игрока',
            needVisit: 'Шаблон для острова игрока {0}: сначала посетите остров',
            noSettler: 'Ожидание поселенца'
        },
        'de-de': {
            queued: 'In Warteschlange', enqueue: 'Zur Warteschlange', quick: 'Sofort anwenden (Vorlage kommt in die Warteschlange)',
            templates: 'Vorlagen', inQueue: 'Warteschlange', autoMin: 'Fenster beim Start minimieren',
            waitZone: 'Warten auf die Insel', otherIsland: 'Andere Insel', otherIslands: 'Andere Inseln',
            notFound: 'Gebäude nicht gefunden', foreign: 'Gebäude eines anderen Spielers',
            needVisit: 'Vorlage für die Insel von {0}: zuerst die Insel besuchen',
            noSettler: 'Warten auf einen Siedler'
        }
    };

    function clientText(id) {
        var s = String(safe(function () { return getText(id); }, '') || '');
        return (!s || s.indexOf('RES not found') === 0) ? '' : s;
    }

    function ownText(id, args) {
        var lang = String(safe(function () { return gameLang; }, '') || '');
        var s = (OWN[lang] && OWN[lang][id]) || OWN['en-uk'][id] || '';
        if (s && args) s = s.replace(/\{(\d+)\}/g, function (m, n) { return args[n] !== undefined ? String(args[n]) : m; });
        return s;
    }

    var _txt = {};
    function txt(id, args) {
        if (!args && own(_txt, id)) return _txt[id];
        var chain = LOCA[id] || [], s = '';
        for (var i = 0; i < chain.length && !s; i++) s = tr(chain[i][0], chain[i][1], args);
        if (!s && CTEXT[id]) s = clientText(CTEXT[id]);
        if (!s) s = ownText(id, args);
        if (s && STRIP[id]) s = s.replace(/[\s:\uFF1A.\u3002!]+$/, '');
        if (!args) _txt[id] = s;
        return s;
    }

    var _names = {};
    function locName(group, id) {
        var k = group + '.' + id;
        if (own(_names, k)) return _names[k];
        var s = id ? tr(group, id) : '';
        _names[k] = s || String(id || '');
        return _names[k];
    }
    function buiTitle(name) { return locName('BUI', name); }
    function buffTitle(name) { return locName('RES', name); }

    var _units = {};
    function unit(key, n) {
        if (!own(_units, key)) _units[key] = tr('FOR', key);
        var p = _units[key];
        if (p && p.indexOf('{0}') >= 0) return p.replace('{0}', n);
        return tr('FOR', key, [n]) || String(n);
    }

    function fmtDur(ms) {
        if (!(ms > 0) || !isFinite(ms)) return '';
        var s = Math.floor(ms / 1000),
            d = Math.floor(s / 86400),
            h = Math.floor((s % 86400) / 3600),
            m = Math.floor((s % 3600) / 60),
            sec = s % 60;
        if (d > 0) return unit('DaysShort', d) + (h ? ' ' + unit('HoursShort', h) : '');
        if (h > 0) return unit('HoursShort', h) + (m ? ' ' + unit('MinutesShort', m) : '');
        if (m > 0) return unit('MinutesShort', m) + (m < 10 && sec ? ' ' + unit('SecondsShort', sec) : '');
        return unit('SecondsShort', Math.max(1, sec));
    }

    function alertMsg(msg) {
        if (!msg) return;
        try { game.showAlert(msg); } catch (e) { log(e); }
    }

    /* ------------------------------------------------------------------ */
    /* Persistent settings                                                 */
    /* ------------------------------------------------------------------ */

    function normPath(p) {
        return p ? String(p).replace(/\\/g, '/').toLowerCase() : '';
    }

    function normName(n) {
        return n ? String(n).trim().toLowerCase() : '';
    }

    function dedupeRecent(list) {
        if (!isArr(list)) return [];
        var out = [], seenPath = {}, seenName = {};
        for (var i = 0; i < list.length; i++) {
            var it = list[i];
            if (!it) continue;
            var nm = normName(it.name);
            var np = normPath(it.path);
            if (!nm && !np) continue;
            if (np && seenPath[np]) continue;
            if (nm && seenName[nm]) continue;
            if (np) seenPath[np] = true;
            if (nm) seenName[nm] = true;
            out.push(it);
        }
        return out.slice(0, 10);
    }

    function loadCfg() {
        var c = {
            buffStopped: DEFAULTS.buffStopped,
            safeMines: DEFAULTS.safeMines,
            delay: DEFAULTS.delay,
            autoMin: DEFAULTS.autoMin,
            recent: []
        };
        var s = safe(function () { return settings.read(null, SETTINGS_KEY); }, null);
        if (s && typeof s === 'object') {
            if (typeof s.buffStopped === 'boolean') c.buffStopped = s.buffStopped;
            if (typeof s.safeMines === 'boolean') c.safeMines = s.safeMines;
            if (typeof s.autoMin === 'boolean') c.autoMin = s.autoMin;
            if (SPEEDS.indexOf(Number(s.delay)) >= 0) c.delay = Number(s.delay);
            if (isArr(s.recent)) c.recent = dedupeRecent(s.recent);
        }
        return c;
    }

    var cfg = loadCfg();

    function saveCfg() {
        try {
            // settings.store() deep-merges: arrays would keep their old tail (deleted recent templates
            // came back), so the stored entry is replaced as a whole.
            if (settings.settings && typeof settings.settings === 'object') delete settings.settings[SETTINGS_KEY];
            settings.store({
                buffStopped: cfg.buffStopped,
                safeMines: cfg.safeMines,
                delay: cfg.delay,
                autoMin: cfg.autoMin,
                recent: dedupeRecent(cfg.recent)
            }, SETTINGS_KEY);
        } catch (e) {
            log(e);
        }
    }

    // rec: the template (its island is kept in the recent entry for the cards).
    function addRecentTemplate(name, path, rec) {
        if (!name && !path) return;
        var cleanName = String(name || '').replace(/\.[^.]+$/, '').trim();
        var cleanPath = String(path || '').trim();
        var list = isArr(cfg.recent) ? cfg.recent : [];
        var existingAlias = '', existing = null;
        for (var i = 0; i < list.length; i++) {
            if (cleanPath && list[i] && list[i].path && normPath(list[i].path) === normPath(cleanPath)) {
                existing = list[i];
                existingAlias = list[i].name;
                break;
            }
        }
        var next = [];
        for (var j = 0; j < list.length; j++) {
            var it = list[j];
            if (!it) continue;
            if (cleanPath && it.path && normPath(it.path) === normPath(cleanPath)) continue;
            if (cleanName && it.name && normName(it.name) === normName(cleanName)) continue;
            next.push(it);
        }
        var finalName = existingAlias || cleanName || (cleanPath ? cleanPath.split(/[\/\\]/).pop().replace(/\.[^.]+$/, '') : '');
        var entry = {
            name: finalName,
            path: cleanPath,
            time: now()
        };
        if (!setRecentZone(entry, rec) && existing) setRecentZone(entry, existing);
        next.unshift(entry);
        cfg.recent = dedupeRecent(next);
        saveCfg();
    }

    // Island of a recent template (zoneId, zoneUser) kept in its entry; true when it changed.
    function setRecentZone(item, rec) {
        var z = rec ? Number(rec.zoneId) : NaN;
        if (!item || !rec || rec.zoneId === null || rec.zoneId === undefined || rec.zoneId === '' || !isFinite(z)) return false;
        var u = String(rec.zoneUser == null ? '' : rec.zoneUser);
        if (item.zoneId === z && item.zoneUser === u) return false;
        item.zoneId = z;
        item.zoneUser = u;
        return true;
    }

    var _rzMiss = {}, _rzDirty = false;

    // { id, user } of a recent template: cached in the entry, otherwise read from its file once
    // (an unreadable file is not tried again in this session); null when unknown.
    function recentZone(item) {
        if (!item) return null;
        if (typeof item.zoneId !== 'number' || !isFinite(item.zoneId)) {
            var path = recentPath(item), key = normPath(path);
            if (!key || own(_rzMiss, key)) return null;
            var fo = readFileDirect(path), d = null;
            if (fo) {
                try { d = JSON.parse(fo.data); } catch (e) { d = null; }
            }
            if (!d || typeof d !== 'object' || !setRecentZone(item, d)) {
                _rzMiss[key] = 1;
                return null;
            }
            _rzDirty = true;
        }
        return { id: item.zoneId, user: String(item.zoneUser || '') };
    }

    function removeRecentTemplate(idx) {
        if (!isArr(cfg.recent)) return;
        if (idx >= 0 && idx < cfg.recent.length) {
            cfg.recent.splice(idx, 1);
            if (S.editingRecent === idx) S.editingRecent = null;
            else if (typeof S.editingRecent === 'number' && S.editingRecent > idx) S.editingRecent--;
            saveCfg();
            renderBody();
        }
    }

    function startEditRecent(idx) {
        if (!isArr(cfg.recent) || idx < 0 || idx >= cfg.recent.length) return;
        S.editingRecent = idx;
        renderBody();
        setTimeout(function () {
            var $inp = $(SEL + ' .bm-rec-input');
            if ($inp.length) $inp.focus().select();
        }, 20);
    }

    function cancelEditRecent() {
        if (S.editingRecent === null || S.editingRecent === undefined) return;
        S.editingRecent = null;
        renderBody();
    }

    function commitEditRecent(idx, newName) {
        if (!isArr(cfg.recent) || idx < 0 || idx >= cfg.recent.length) {
            S.editingRecent = null;
            renderBody();
            return;
        }
        if (newName === undefined) {
            var $inp = $(SEL + ' .bm-rec-input');
            newName = $inp.length ? $inp.val() : '';
        }
        newName = String(newName || '').trim();
        var item = cfg.recent[idx];
        if (!item) {
            S.editingRecent = null;
            renderBody();
            return;
        }
        var oldName = item.name;
        if (newName && newName !== oldName) {
            // Local visual display name only: the underlying template file on disk is never touched or renamed
            item.name = newName;
            cfg.recent = dedupeRecent(cfg.recent);
            saveCfg();
            if (S.templateName === oldName) {
                S.templateName = newName;
                updateTitle();
            }
        }
        S.editingRecent = null;
        renderBody();
    }

    function initRecentFromLRU() {
        if (cfg.recent && cfg.recent.length > 0) return;
        try {
            if (typeof lruTemplate !== 'undefined' && lruTemplate[TEMPLATE_MODULE] && lruTemplate[TEMPLATE_MODULE].tracker) {
                var tracker = lruTemplate[TEMPLATE_MODULE].tracker.slice().reverse();
                var store = lruTemplate[TEMPLATE_MODULE].store || {};
                var list = [];
                for (var i = 0; i < tracker.length; i++) {
                    var p = store[tracker[i]];
                    if (p) {
                        var base = String(p).split(/[\/\\]/).pop().replace(/\.[^.]+$/, '');
                        list.push({ name: base, path: p, time: Number(tracker[i]) || now() });
                    }
                }
                list = dedupeRecent(list);
                if (list.length) {
                    cfg.recent = list;
                    saveCfg();
                }
            }
        } catch (e) {
            log(e);
        }
    }
    initRecentFromLRU();

    // Reads a template file without the blocking alerts of loadFileWithRetry(); relative paths
    // (shortcuts folder setting) are resolved against mainSettings.shortcutsDir.
    function readFileDirect(filePath) {
        var p = String(filePath || ''), list = [p];
        var dir = String(safe(function () { return mainSettings.shortcutsDir; }, '') || '');
        if (dir && p.indexOf(dir) !== 0) list.push(dir + p);
        for (var i = 0; i < list.length; i++) {
            try {
                var f = new air.File(list[i]);
                if (!f.exists || f.isDirectory) continue;
                var fs = new air.FileStream();
                fs.open(f, air.FileMode.READ);
                var content = fs.readUTFBytes(f.size);
                fs.close();
                if (content) return { data: content, name: f.name, path: f.nativePath };
            } catch (e) { }
        }
        return null;
    }

    function baseName(n) {
        return String(n || '').split(/[\/\\]/).pop().replace(/\.[^.]+$/, '');
    }

    function recentPath(item) {
        if (!item) return '';
        if (item.path) return item.path;
        var t = getTpl(), sep = safe(function () { return air.File.separator; }, '\\');
        return (t && item.name) ? t.getLastDir() + sep + item.name + '.txt' : '';
    }

    // Recent template -> { rec, name, path } (null and an alert when the file is gone or broken).
    function loadRecent(idx) {
        var item = (isArr(cfg.recent) ? cfg.recent : [])[idx];
        if (!item) return null;
        var path = recentPath(item), fo = path ? readFileDirect(path) : null, rec = null;
        if (fo) {
            try { rec = normalizeRecord(JSON.parse(fo.data)); } catch (e) { log(e); }
        }
        if (!rec) {
            alertMsg((fo ? txt('badTpl') : txt('loadError')) + (item.name ? ': ' + item.name : ''));
            return null;
        }
        if (setRecentZone(item, rec)) saveCfg();
        return { rec: rec, name: item.name || baseName(fo.name), path: fo.path || path };
    }

    function openRecentTemplate(idx) {
        if (S.rec) return;
        var t = loadRecent(idx);
        if (t) onTemplate(t.rec, t.name, t.path);
    }

    // Quick start from a recent card: the template goes straight into the queue. Like the stock
    // module a template is used only on its island (the card of another island offers a visit).
    function queueRecent(idx) {
        if (S.rec) return;
        var t = loadRecent(idx);
        if (!t) return;
        if (Number(t.rec.zoneId) !== viewedZone()) {
            alertMsg(t.name + ': ' + txt('needVisit', [recUser(t.rec)]));
            refresh(true);
            return;
        }
        var items = defaultItems(t.rec);
        if (!items.length) {
            alertMsg(t.name + ': ' + txt('unavailable'));
            refresh(true);
            return;
        }
        enqueueRecord(t.rec, t.name, items);
        alertMsg(t.name + ': ' + txt('sent'));
        refresh(true);
    }

    // Visit button of a recent card (template of another island): the template is opened and its
    // island visited; the rows are checked as soon as the island is loaded.
    function visitRecent(idx) {
        if (S.rec) return;
        var t = loadRecent(idx);
        if (!t) return;
        onTemplate(t.rec, t.name, t.path);
        visitZone(t.rec.zoneId);
    }

    /* ------------------------------------------------------------------ */
    /* Runtime state                                                       */
    /* ------------------------------------------------------------------ */

    var S = {
        record: null,        // { zoneId, zoneUser, data: [{ buffName, buiGrid, buiName }] }
        templateName: '',
        templatePath: '',
        manual: {},          // grid -> boolean, manual selection override
        rec: null,           // active recording { backup, backupName, backupPath, count }
        filter: 'all',
        search: '',
        editingRecent: null, // index of recent template being renamed, or null
        showSettings: false,
        showRecents: false,  // recent templates panel in the list view
        rows: [],
        counts: {},
        ctx: null,
        zoneSig: '',
        lastAuto: 0,
        needFull: false,
        sub: false,
        uiT: null,
        refreshT: null,
        settleT: null,
        unseen: false,
        searchT: null,
        fitT: null,
        tip: null,
        tipAnchor: null,
        disposed: false
    };

    // Apply engine (independent of the window: keeps working while it is minimized or closed).
    var E = {
        runs: [],            // templates in queue order: { id, name, zoneId, zoneUser, jobs, total, ok, fail, skip, cancelled }
        pend: {},            // 'zone:grid' -> unfinished commands of all queued templates, in queue order
        reserved: {},        // star menu stack id -> commands sent and not confirmed yet
        res: {},             // 'zone:grid' -> { st: 'done' | 'failed', buff } result of the last command
        done: [],            // summaries of finished templates, newest first
        touch: {},           // 'zone:grid' -> 1: rows to analyse again at the next window update
        dirty: false,        // a command changed outside the engine step (confirmation, cancel)
        zw: null,            // island watch { v: viewed zone id, n: buildings, own: their owner, at: last change, stale }
        watchT: null,
        timer: null,
        lastSend: 0,
        seq: 0
    };

    /* ------------------------------------------------------------------ */
    /* Game images -> CSS classes (each bitmap is encoded only once)        */
    /* ------------------------------------------------------------------ */

    var _uri = {}, _icls = {}, _icss = [], _iseq = 0;

    function bdValid(b) {
        return !!b && Number(safe(function () { return b.width; }, 0)) > 1 &&
            Number(safe(function () { return b.height; }, 0)) > 1;
    }

    function bdAsset(name) {
        return safe(function () { return assets.GetBitmapData(name); }, null);
    }

    function bdClass(qname) {
        return safe(function () {
            var C = swmmo.getDefinitionByName(qname);
            var o = C ? new C() : null;
            return o ? o.bitmapData : null;
        }, null);
    }

    function uriOf(key, getter) {
        if (own(_uri, key)) return _uri[key];
        var u = null;
        try {
            var b = getter();
            if (bdValid(b)) {
                var w = Number(b.width), h = Number(b.height);
                var html = String(utils.getImage(b, w + 'px', h + 'px') || '');
                var m = /src="(data:image\/png;base64,[^"]+)"/.exec(html);
                if (m) u = { src: m[1], w: w, h: h };
            }
        } catch (e) {
            log(e);
        }
        _uri[key] = u;
        return u;
    }

    function assetUri(name) {
        return uriOf('a:' + name, function () { return bdAsset(name); });
    }

    // Returns a CSS class that draws the game bitmap fitted into a w x h box.
    function icCls(name, w, h) {
        var k = name + '|' + w + '|' + h;
        if (own(_icls, k)) return _icls[k];
        var u = name ? assetUri(name) : null, c = '';
        if (u) {
            c = 'bmI' + (++_iseq);
            var sc = Math.min(w / u.w, h / u.h, 1.5),
                bw = Math.max(1, Math.round(u.w * sc)),
                bh = Math.max(1, Math.round(u.h * sc));
            _icss.push(SEL + ' .' + c + '{width:' + w + 'px;height:' + h + 'px;background-image:url(' + u.src +
                ');-webkit-background-size:' + bw + 'px ' + bh + 'px;background-size:' + bw + 'px ' + bh + 'px}');
        }
        _icls[k] = c;
        return c;
    }

    function ic(name, w, h, extra, attrs) {
        var c = icCls(name, w, h);
        return '<i class="bm-i' + (c ? ' ' + c : '') + (extra ? ' ' + extra : '') + '"' + (attrs ? ' ' + attrs : '') +
            (c ? '' : ' style="width:' + w + 'px;height:' + h + 'px"') + '></i>';
    }

    function flushIcons() {
        if (!_icss.length) return;
        var el = document.getElementById('buffManagerIcons');
        if (!el) {
            el = document.createElement('style');
            el.type = 'text/css';
            el.id = 'buffManagerIcons';
            (document.head || document.getElementsByTagName('head')[0]).appendChild(el);
        }
        el.appendChild(document.createTextNode(_icss.join('\n') + '\n'));
        _icss = [];
    }

    // Native checkbox textures of the game client (StandardCheckBox), with fallbacks.
    function checkboxRules() {
        var B = SEL + ' .bm-cb', R = [];
        var off = uriOf('cb:off', function () {
            var b = bdClass('GUI.Components::StandardCheckBox_icon_normal');
            return bdValid(b) ? b : bdAsset('RadioButtonInactive');
        });
        var offH = uriOf('cb:offH', function () { return bdClass('GUI.Components::StandardCheckBox_iconInactiveMouseOver'); });
        var on = uriOf('cb:on', function () { return bdClass('GUI.Components::StandardCheckBox_iconActive'); });
        var onH = uriOf('cb:onH', function () { return bdClass('GUI.Components::StandardCheckBox_iconActiveMouseOver'); });
        var half = uriOf('cb:half', function () { return bdClass('GUI.Components::StandardCheckBox_icon_half_selected'); });
        var mark = assetUri('CheckMarkYellow');
        var HOV = B + ':hover,' + SEL + ' tr.bm-row:hover .bm-cb,' + SEL + ' .bm-opt:hover .bm-cb';
        var ONH = B + '.bm-on:hover,' + SEL + ' tr.bm-row:hover .bm-cb.bm-on,' + SEL + ' .bm-opt:hover .bm-cb.bm-on';
        var ON = B + '.bm-on,' + ONH;
        var HALF = B + '.bm-half,' + B + '.bm-half:hover';
        var DIS = B + '.bm-dis,' + B + '.bm-dis:hover,' + SEL + ' tr.bm-row:hover .bm-cb.bm-dis';
        var DISON = B + '.bm-dis.bm-on,' + B + '.bm-dis.bm-on:hover,' + SEL + ' tr.bm-row:hover .bm-cb.bm-dis.bm-on';
        if (off) {
            R.push(B + '{background-image:url(' + off.src + ')}');
            if (offH) R.push(HOV + '{background-image:url(' + offH.src + ')}');
            if (on) {
                R.push(ON + '{background-image:url(' + on.src + ')}');
                if (onH) R.push(ONH + '{background-image:url(' + onH.src + ')}');
            } else if (mark) {
                R.push(ON + '{background-image:url(' + mark.src + '),url(' + off.src + ');' +
                    '-webkit-background-size:15px 15px,19px 19px;background-size:15px 15px,19px 19px;background-position:2px 1px,0 0}');
            }
            if (half) {
                R.push(HALF + '{background-image:url(' + half.src + ')}');
            } else if (mark) {
                R.push(HALF + '{background-image:url(' + mark.src + '),url(' + off.src + ');' +
                    '-webkit-background-size:9px 9px,19px 19px;background-size:9px 9px,19px 19px;background-position:5px 5px,0 0}');
            }
            R.push(DIS + '{background-image:url(' + off.src + ');opacity:.35;cursor:default}');
            // Rows queued in a running batch stay visibly checked.
            if (on) {
                R.push(DISON + '{background-image:url(' + on.src + ')}');
            } else if (mark) {
                R.push(DISON + '{background-image:url(' + mark.src + '),url(' + off.src + ');' +
                    '-webkit-background-size:15px 15px,19px 19px;background-size:15px 15px,19px 19px;background-position:2px 1px,0 0}');
            }
        } else {
            R.push(B + '{width:15px;height:15px;border:1px solid #9C7A45;background-color:#2B241B;-webkit-border-radius:3px;border-radius:3px}');
            R.push(HOV + '{border-color:#E0B050}');
            if (mark) {
                R.push(ON + '{background-image:url(' + mark.src + ');-webkit-background-size:13px 13px;background-size:13px 13px;background-position:center center}');
            } else {
                R.push(ON + '{background-color:#D7A84A}');
            }
            R.push(HALF + '{background-color:#7A6236}');
            R.push(DIS + '{opacity:.35;cursor:default;border-color:#9C7A45}');
        }
        return R;
    }

    // Close / highlight icons for row delete and window buttons, arrows for minimize.
    function windowIconRules() {
        var R = [], c = assetUri('Close'), ch = assetUri('CloseHighlight');
        if (c) {
            R.push(SEL + ' .bm-del,' + SEL + ' .bm-x{background-image:url(' + c.src + ')}');
            if (ch) R.push(SEL + ' .bm-del:hover,' + SEL + ' .bm-x:hover{background-image:url(' + ch.src + ')}');
            R.push(SEL + ' .bm-del.bm-dis,' + SEL + ' .bm-del.bm-dis:hover{background-image:url(' + c.src + ')}');
        }
        var up = assetUri('ArrowUp'), uph = assetUri('ArrowUpHighlight'),
            dn = assetUri('ArrowDown'), dnh = assetUri('ArrowDownHighlight');
        var T = SEL + ' .modal-header .floating-modal-toggle';
        if (up && dn) {
            R.push(T + '{width:25px!important;height:23px!important;right:40px!important;top:3px!important;' +
                'margin:0!important;padding:0!important;border:0!important;font-size:0!important;' +
                'line-height:0!important;color:transparent!important;text-indent:-9999px;overflow:hidden;' +
                'outline:none!important;-webkit-box-shadow:none!important;box-shadow:none!important;' +
                'background:url(' + up.src + ') no-repeat center center!important;' +
                '-webkit-background-size:22px 20px!important;background-size:22px 20px!important}');
            if (uph) R.push(T + ':hover{background-image:url(' + uph.src + ')!important}');
            R.push(SEL + '.floating-modal-minimized .modal-header .floating-modal-toggle{background-image:url(' + dn.src + ')!important}');
            if (dnh) R.push(SEL + '.floating-modal-minimized .modal-header .floating-modal-toggle:hover{background-image:url(' + dnh.src + ')!important}');
        }
        return R;
    }

    /* ------------------------------------------------------------------ */
    /* Game access                                                         */
    /* ------------------------------------------------------------------ */

    function gi() { return safe(function () { return game.gi; }, null); }

    function curZone() {
        return safe(function () { return game.gi.mCurrentPlayerZone; }, null) || safe(function () { return game.zone; }, null);
    }

    function curPlayer() {
        return safe(function () { return game.gi.mCurrentPlayer; }, null) || safe(function () { return game.player; }, null);
    }

    function viewedZone() {
        return Number(safe(function () { return game.gi.mCurrentViewedZoneID; }, -1));
    }

    function clientTime() {
        var t = Number(safe(function () { return game.gi.GetClientTime(); }, 0));
        return t > 0 ? t : now();
    }

    function myId() {
        // game.player.getPlayerID() is what the stock module compares buffOwnerID with.
        var id = safe(function () { return game.player.getPlayerID(); }, null);
        if (id === null) id = safe(function () { return game.gi.mHomePlayer.GetPlayerId(); }, null);
        if (id === null) id = safe(function () { return curPlayer().getPlayerID(); }, null);
        return id === null ? -1 : Number(id);
    }

    function homeZoneId() {
        var id = safe(function () { return game.gi.mHomePlayer.GetHomeZoneId(); }, null);
        return id === null ? myId() : Number(id);
    }

    function isHomeZone(zoneId) { return Number(zoneId) === homeZoneId(); }

    function myName() {
        return String(safe(function () { return game.gi.mHomePlayer.GetPlayerName_string(); }, '') ||
            safe(function () { return game.playerName; }, '') || '');
    }

    function zoneOwnerName(zoneId) {
        if (isHomeZone(zoneId)) return myName();
        var fl = safe(function () { return globalFlash.gui.mFriendsList; }, null), n = '';
        if (fl) {
            n = safe(function () { return fl.GetFriendById(zoneId).username; }, '');
            if (!n) n = safe(function () { return fl.GetGuildMemberById(zoneId).username; }, '');
        }
        if (!n) n = safe(function () { return game.gi.GetPlayerName_string(Number(zoneId)); }, '');
        return String(n || '');
    }

    function recUser(rec) {
        return rec ? (rec.zoneUser || zoneOwnerName(rec.zoneId) || String(rec.zoneId)) : '';
    }

    // Owner of a building: the client writes it into the building description
    // (<Building name='..' grid='..' player='<id>' ... />); null when unknown.
    var OWNER_RE = /\bplayer='(-?\d+)'/;
    function buildingOwner(bui) {
        if (!bui) return null;
        var m = OWNER_RE.exec(String(safe(function () { return bui.toString(); }, '') || ''));
        var id = m ? Number(m[1]) : 0;
        return id > 0 ? id : null;
    }

    // Owner of the shown island from its first buildings: { id: the owner most of them have, mixed:
    // they belong to several players (adventures, shared islands) }, null when unknown.
    function zoneOwnerOf(z) {
        var vec = z ? safe(function () { return z.mStreetDataMap.GetBuildings_vector(); }, null) : null;
        var n = vec ? Number(safe(function () { return vec.length; }, 0)) : 0, cnt = {}, best = null, kinds = 0, seen = 0;
        for (var i = 0; i < n && i < OWNER_SAMPLE * 3 && seen < OWNER_SAMPLE; i++) {
            var id = buildingOwner(safe(function () { return vec[i]; }, null));
            if (id === null) continue;
            seen++;
            if (!own(cnt, id)) { cnt[id] = 0; kinds++; }
            cnt[id]++;
            if (best === null || cnt[id] > cnt[best]) best = id;
        }
        return best === null ? null : { id: best, mixed: kinds > 1 };
    }

    // Owner the buildings of an island belong to: a home island has the id of its owner, the own one
    // the own player id; adventures (buildings of several players) are not checked (null).
    function zoneOwnerId(zoneId) {
        var z = Number(zoneId);
        if (!isFinite(z) || z <= 0) return null;
        if (z === homeZoneId()) {
            var me = myId();
            return me > 0 ? me : null;
        }
        var g = gi(), adv = (g && typeof g.IsAdventureZoneID === 'function') ?
            safe(function () { return g.IsAdventureZoneID(z); }, false) :
            (z === viewedZone() && safe(function () { return curPlayer().mIsAdventureZone; }, false));
        return adv ? null : z;
    }

    function isRemoveBuff(name) { return String(name || '').indexOf('RemoveBuff') >= 0; }

    function buffVector() {
        return safe(function () { return curPlayer().getAvailableBuffs_vector(); }, null) ||
            safe(function () { return game.getBuffs(); }, null);
    }

    function stackName(b) {
        return String(safe(function () { return b.GetBuffDefinition().GetName_string(); }, '') || '');
    }

    function stackAmount(b) {
        var a = safe(function () { return b.GetInstantAmount(); }, null);
        if (a === null) a = safe(function () { return b.GetAmount(); }, 0);
        a = Number(a);
        return a > 0 ? a : 0;
    }


    function stackId(b) {
        var u = safe(function () { return b.GetUniqueId(); }, null);
        return u ? String(u.uniqueID1) + '_' + String(u.uniqueID2) : '';
    }

    // Star menu stacks grouped by buff name, the fullest stack first. Commands sent and not confirmed
    // yet are reserved on their stack; withQueue also subtracts the commands still waiting in the
    // queue (what is left for another template).
    function collectStacks(withQueue) {
        var out = {}, vec = buffVector(), name, i;
        var n = vec ? Number(safe(function () { return vec.length; }, 0)) : 0;
        for (i = 0; i < n; i++) {
            var b = vec[i];
            if (!b) continue;
            name = stackName(b);
            if (!name) continue;
            var id = stackId(b), amt = Math.max(0, stackAmount(b) - (E.reserved[id] || 0));
            var e = out[name] || (out[name] = { list: [], total: 0 });
            e.list.push({ b: b, id: id, n: amt });
            e.total += amt;
        }
        for (name in out) {
            if (own(out, name) && out[name].list.length > 1) out[name].list.sort(function (x, y) { return y.n - x.n; });
        }
        if (withQueue) {
            var w = queuedDemand();
            for (name in w) {
                if (own(w, name) && own(out, name)) out[name].total = Math.max(0, out[name].total - w[name]);
            }
        }
        return out;
    }

    function buffDef(name, ctx) {
        var st = ctx && ctx.stacks ? ctx.stacks[name] : null;
        var d = (st && st.list.length) ? safe(function () { return st.list[0].b.GetBuffDefinition(); }, null) : null;
        if (!d) d = safe(function () { return game.def('global').map_BuffName_BuffDefinition[name]; }, null);
        return d;
    }

    function durMode(zoneId) {
        if (isHomeZone(zoneId)) return 0;
        return safe(function () { return curPlayer().hasActivePremiumAccount(); }, false) ? 31 : 1;
    }

    function buffDuration(def, mode) {
        if (!def) return 0;
        var d = Number(safe(function () { return def.getDuration(mode); }, 0));
        if (!(d > 0) && mode !== 1) d = Number(safe(function () { return def.getDuration(1); }, 0));
        if (!(d > 0) && mode !== 0) d = Number(safe(function () { return def.getDuration(0); }, 0));
        return d > 0 ? d : 0;
    }

    function activeBuff(bui, t) {
        var pb = safe(function () { return bui.productionBuff; }, null);
        if (!pb || !safe(function () { return pb.IsActive(t); }, false)) return null;
        var def = safe(function () { return pb.GetBuffDefinition(); }, null);
        var name = def ? String(safe(function () { return def.GetName_string(); }, '') || '') : '';
        if (isRemoveBuff(name)) return null;
        var start = Number(safe(function () { return pb.GetStartTime(); }, 0)) || 0;
        var dur = Number(safe(function () { return def.getDuration(pb.GetApplicanceMode()); }, 0)) || 0;
        return { name: name, end: (start > 0 && dur > 0) ? start + dur : 0 };
    }

    function idleState(bui) {
        if (safe(function () { return bui.IsUpgradeInProgress(); }, false)) return 'upgrade';
        if (!safe(function () { return bui.IsProductionActive(); }, true)) return 'stopped';
        var rc = safe(function () { return bui.GetResourceCreation(); }, null);
        if (!rc) return '';
        switch (Number(safe(function () { return rc.GetProductionState(); }, 0))) {
            case 0: return '';
            case 1: return 'noRes';
            case 2: return 'whFull';
            case 3: return 'noSettler';
            case 4: return 'noTools';
            case 7: case 14: return 'upgrade';
            case 8: return 'prodStopped';
            default: return 'stopped';
        }
    }

    // Deposit under the building (mines): time until depletion with the buffed consumption.
    function mineInfo(bui, grid, ctx, def) {
        var dep = safe(function () { return ctx.zone.mStreetDataMap.mDepositContainer.get(grid); }, null);
        if (!dep) return null;
        var bn = String(safe(function () { return bui.GetBuildingName_string(); }, '') || '');
        if (bn.indexOf('Endless') >= 0) return { endless: true, ms: Infinity };
        var left = Number(safe(function () { return dep.GetAmount(); }, 0)) || 0;
        if (left <= 0) return { endless: false, ms: 0 };
        var rcd = safe(function () { return bui.GetResourceCreation().GetResourceCreationDefinition(); }, null) ||
            safe(function () { return game.def('ServerState::gEconomics').GetResourcesCreationDefinitionForBuilding(bn); }, null);
        var removed = rcd ? Number(safe(function () { return rcd.amountRemoved; }, 1)) : 1;
        if (!(removed > 0)) return { endless: true, ms: Infinity };
        var cycle = Number(safe(function () { return bui.CalculateWays(); }, 0)) || 0;
        var inF = Number(safe(function () { return bui.GetResourceInputFactor(); }, 1)) || 1;
        var p = Number(safe(function () { return def.getProductivityInputPercent(); }, 0)) || 0;
        var per = removed * inF * (p > 0 ? p / 100 : 1);
        return { endless: false, ms: (cycle > 0 && per > 0) ? left / per * cycle : Infinity };
    }

    /* ------------------------------------------------------------------ */
    /* Analysis                                                            */
    /* ------------------------------------------------------------------ */

    var BAD = { zone: 1, missing: 1, foreign: 1, unavail: 1, nostock: 1, failed: 1, depleted: 1 };
    var BUFFED = { buffed: 1, done: 1, pending: 1, queued: 1 };
    // Short waits of the production cycle (resources, warehouse, settler, tools): the building works
    // and is buffed like in the stock module. The other states stop the production (option).
    var WAITS = { noRes: 1, whFull: 1, noSettler: 1, noTools: 1 };
    // Statuses right before a command that may change in a moment: checked again a bit later.
    var RETRY = { pending: 1, unavail: 1 };

    // forSend: check right before a command (raw stacks minus reservations, no queue overlay, only what
    // makes the command impossible: the options of the selection were applied when it was chosen).
    // zoneOk: the island of the template is shown (loading: it is opened but not shown yet);
    // owner: the player its buildings must belong to (null: not checked).
    function makeCtx(zoneId, forSend) {
        var w = zoneWatch(), zone = curZone(), viewed = viewedZone(), z = Number(zoneId);
        var same = isFinite(z) && z === viewed, ok = same && !!zone && !w.stale;
        return {
            zone: zone,
            gi: gi(),
            player: curPlayer(),
            now: clientTime(),
            viewed: viewed,
            zoneId: z,
            zoneOk: ok,
            loading: same && !ok,
            owner: ok ? rowOwner(z, w) : null,
            stacks: collectStacks(!forSend),
            mode: durMode(z),
            send: !!forSend
        };
    }

    // Island watch: the viewed island, its buildings count and their owner, with the time of the last
    // change (the first loaded island seen counts as settled). Right after another island was opened the client may
    // still show the zone of the previous one: its buildings do not belong to the owner of the opened
    // island, the zone is stale (at most ZONE_STALE_MAX; the rows keep the owner check). An island
    // that turns out to belong to another player than its id tells is trusted when its zone replaced
    // the one of the previous island after the visit.
    function zoneWatch() {
        var z = curZone(), v = viewedZone(), w = E.zw, t = now();
        var n = z ? Number(safe(function () { return z.mStreetDataMap.GetBuildings_vector().length; }, 0)) : -1;
        if (!w) {
            E.zw = w = { v: v, n: n, at: 0, own: null, mixed: false, ownAt: t, sampled: 0, prev: null, vAt: -ZONE_STALE_MAX,
                trust: null, stale: false, loaded: false };
        }
        var first = !w.loaded, moved = w.v !== v, changed = moved || w.n !== n;
        if (moved) {
            w.prev = w.own;
            w.vAt = t;
            w.trust = null;
        }
        if (first || changed || w.stale || (w.own === null && n > 0 && t - w.sampled >= 1000)) {
            var so = n > 0 ? zoneOwnerOf(z) : null, o = so ? so.id : null, exp = o ? zoneOwnerId(v) : null, stale = false;
            w.sampled = t;
            w.mixed = !!(so && so.mixed);
            if (o !== w.own) {
                w.own = o;
                w.ownAt = t;
            }
            if (o && exp !== null && o !== exp && o !== v) {
                if (w.trust !== o && w.prev !== null && o !== w.prev && t - w.vAt < ZONE_STALE_MAX) w.trust = o;
                stale = w.trust !== o && t - Math.max(w.vAt, w.ownAt) < ZONE_STALE_MAX;
            }
            if (stale !== w.stale) {
                w.stale = stale;
                changed = true;
            }
        }
        if (changed) {
            w.v = v;
            w.n = n;
            if (!first) w.at = t;
        }
        if (n > 0) w.loaded = true;
        return w;
    }

    // Owner the buildings of the shown island must have (null: not checked). The island of the expected
    // owner is checked even when a few buildings belong to others; an island of several players whose
    // owner is not the expected one (shared island) is not checked.
    function rowOwner(zoneId, w) {
        var exp = zoneOwnerId(zoneId);
        if (exp === null || w.own === null || w.own === exp || w.own === Number(zoneId)) return exp;
        if (w.mixed) return null;
        return w.trust === w.own ? w.own : exp;
    }

    function watchTick() {
        if (S.disposed) return;
        try { zoneWatch(); } catch (e) { log(e); }
    }

    function zoneSig() {
        var w = zoneWatch();
        return w.v + ':' + w.n + ':' + (w.stale ? 's' : '') + (w.own === null ? '' : w.own);
    }

    // Commands may go: the island of the template is shown, loaded and did not change just now.
    function zoneReady(zoneId) {
        var w = zoneWatch();
        return w.v === Number(zoneId) && w.n > 0 && !w.stale && now() - w.at >= ZONE_SETTLE;
    }

    function setActive(r, act, buffName) {
        if (act.end > 0) { r.endAt = act.end; r.timeCls = 'buf'; }
        if (act.name && act.name !== buffName) r.tip = buffTitle(act.name);
    }

    // Queue overlay of a row: an unfinished command for this building. A command after a queued
    // RemoveBuff of another template does not wait for it here (it is ordered by the engine).
    function queuedState(zoneId, grid, buffName) {
        var pj = lastPending(zoneId + ':' + grid);
        if (!pj) return null;
        if (!isRemoveBuff(buffName) && isRemoveBuff(pj.buffName)) return { after: true };
        return { st: pj.st === 'sent' ? 'pending' : 'queued', tip: pj.run.name };
    }

    function analyzeRow(item, ctx) {
        var grid = Number(item.buiGrid),
            buffName = String(item.buffName || ''),
            buiName = String(item.buiName || '');
        var r = {
            grid: grid, buffName: buffName, buiName: buiName, level: 0, st: 'ready',
            ok: false, sel: false, idle: false, mine: false, act: null,
            time: '', timeCls: '', timeTip: '', endAt: 0, tip: ''
        };
        var remove = isRemoveBuff(buffName), after = false, q = null, failed = false;
        if (!ctx.send) {
            q = queuedState(ctx.zoneId, grid, buffName);
            if (q && q.after) { after = true; q = null; }
        }
        var bui = ctx.zoneOk ? safe(function () { return ctx.zone.GetBuildingFromGridPosition(grid); }, null) : null;
        if (bui && String(safe(function () { return bui.GetBuildingName_string(); }, '')) !== buiName) bui = null;
        if (bui) {
            var lv = safe(function () { return bui.GetUIUpgradeLevel(); }, null);
            if (lv === null) lv = safe(function () { return bui.GetUpgradeLevel(); }, 0);
            r.level = Number(lv) || 0;
        }
        if (q) { r.st = q.st; r.tip = q.tip; return r; }
        if (!ctx.zoneOk) { r.st = ctx.loading ? 'loading' : 'zone'; return r; }
        if (!bui) { r.st = 'missing'; return r; }
        if (ctx.owner !== null) {
            // Only buildings of the island owner (never a building of another player).
            var bo = buildingOwner(bui);
            if (bo !== null && bo !== ctx.owner && bo !== ctx.zoneId) { r.st = 'foreign'; return r; }
        }

        var act = after ? null : activeBuff(bui, ctx.now);
        r.act = act;
        if (!ctx.send && !after) {
            // Result of the last command: 'done' while the building shows it (at least DONE_HOLD, a buff
            // without duration until the window is reset), then the row is analysed again (the buff
            // expired: it can be buffed again). A failed row keeps its normal analysis (it can be sent again).
            var key = ctx.zoneId + ':' + grid, res = E.res[key];
            if (res && res.buff === buffName) {
                var hit = remove ? !act : !!(act && act.name === buffName);
                if (hit || (res.st === 'done' && (now() - (res.at || 0) < DONE_HOLD ||
                        (!remove && !(buffDuration(buffDef(buffName, ctx), ctx.mode) > 0))))) {
                    r.st = 'done';
                    if (act && !remove) setActive(r, act, buffName);
                    return r;
                }
                if (res.st === 'done') delete E.res[key];
                else failed = true;
            }
        }
        if (act && !remove) {
            r.st = 'buffed';
            setActive(r, act, buffName);
            return r;
        }

        var stk = ctx.stacks[buffName], probe = (stk && stk.list.length) ? stk.list[0].b : null;
        if (probe && !after) {
            var ap = safe(function () { return probe.IsApplyable(ctx.player, ctx.gi, grid); }, null);
            var code = (typeof ap === 'number') ? ap : (ap === false ? -1 : 0);
            if (code === AP_MAX_BUFFS) { r.st = 'buffed'; return r; }
            if (code === AP_NO_DEPOSIT) { r.st = 'depleted'; r.mine = true; return r; }
            if (code === AP_BLOCKED) { r.st = 'pending'; return r; }
            if (code !== 0) { r.st = 'unavail'; return r; }
        }
        if (!stk || !(stk.total > 0)) {
            r.st = 'nostock';
            r.tip = tr('LAB', 'InputResourceMissing', [buffName]);
            return r;
        }

        var ok = true, idle = idleState(bui), soft = !ctx.send;
        if (idle) {
            r.st = idle;
            if (idle === 'noSettler') r.tip = tr('LAB', 'MissingWorkyardSettler');
            if (!WAITS[idle]) {
                r.idle = true;
                if (soft) ok = cfg.buffStopped;
            }
        }

        var def = buffDef(buffName, ctx), dur = buffDuration(def, ctx.mode);
        var mi = mineInfo(bui, grid, ctx, def);
        if (mi) {
            r.mine = true;
            if (!mi.endless) {
                if (!(mi.ms > 0)) { r.st = 'depleted'; return r; }
                var unsafe = dur > 0 && mi.ms < dur;
                if (isFinite(mi.ms)) {
                    r.time = fmtDur(mi.ms);
                    r.timeCls = unsafe ? 'bad' : 'good';
                    r.timeTip = txt('deposit') + ': ' + r.time;
                }
                if (unsafe) {
                    if (soft && cfg.safeMines) ok = false;
                    if (!r.idle) r.st = 'unsafe';
                }
            }
        }
        if (dur > 0) {
            if (r.timeTip) {
                r.timeTip += '\n' + txt('duration') + ': ' + fmtDur(dur);
            } else if (!r.idle) {
                r.time = fmtDur(dur);
                r.timeCls = 'dim';
                r.timeTip = txt('duration') + ': ' + r.time;
            }
        }
        r.ok = ok;
        if (failed && r.st === 'ready') r.st = 'failed';
        return r;
    }

    function applySelection() {
        var c = { all: 0, ready: 0, buffed: 0, idle: 0, mines: 0, bad: 0, sel: 0 }, rows = S.rows;
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            r.sel = r.ok && (own(S.manual, r.grid) ? !!S.manual[r.grid] : true);
            c.all++;
            if (r.ok) c.ready++;
            if (r.sel) c.sel++;
            if (BUFFED[r.st]) c.buffed++;
            if (r.idle) c.idle++;
            if (r.mine) c.mines++;
            if (BAD[r.st]) c.bad++;
        }
        S.counts = c;
    }

    function analyzeAll() {
        S.zoneSig = zoneSig();
        S.rows = [];
        S.ctx = null;
        S.needFull = false;
        E.touch = {};
        if (S.record) {
            var ctx = makeCtx(S.record.zoneId, false), data = S.record.data;
            for (var i = 0; i < data.length; i++) S.rows.push(analyzeRow(data[i], ctx));
            S.ctx = ctx;
        }
        applySelection();
        return S.rows;
    }

    // Rows a template would buff with the default selection (quick start): none on another island;
    // while its island is still loading all rows go to the queue and are checked before each command.
    function defaultItems(rec) {
        var ctx = makeCtx(rec.zoneId, false), out = [];
        if (ctx.viewed !== ctx.zoneId) return out;
        for (var i = 0; i < rec.data.length; i++) {
            var it = rec.data[i];
            if (ctx.zoneOk) {
                if (analyzeRow(it, ctx).ok) out.push(it);
            } else {
                var q = queuedState(ctx.zoneId, Number(it.buiGrid), String(it.buffName || ''));
                if (!q || q.after) out.push(it);
            }
        }
        return out;
    }

    // Quick update: only the rows whose command or building changed (and the rows still waiting
    // in the queue) are analysed again; false: a full analysis is needed.
    function updateRows() {
        var rec = S.record;
        if (!rec || !S.ctx) return false;
        var ctx = makeCtx(rec.zoneId, false);
        if (ctx.zoneOk !== S.ctx.zoneOk || ctx.loading !== S.ctx.loading || ctx.owner !== S.ctx.owner) return false;
        var rows = S.rows, touched = E.touch;
        E.touch = {};
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            if (!touched[rec.zoneId + ':' + r.grid] && r.st !== 'queued' && r.st !== 'pending') continue;
            rows[i] = analyzeRow({ buiGrid: r.grid, buffName: r.buffName, buiName: r.buiName }, ctx);
        }
        S.ctx = ctx;
        applySelection();
        return true;
    }

    function matchFilter(r, f) {
        switch (f) {
            case 'ready': return r.ok;
            case 'buffed': return !!BUFFED[r.st];
            case 'idle': return r.idle;
            case 'mines': return r.mine;
            case 'bad': return !!BAD[r.st];
            default: return true;
        }
    }

    function visibleRows() {
        var q = trim(S.search).toLowerCase(), out = [];
        for (var i = 0; i < S.rows.length; i++) {
            var r = S.rows[i];
            if (!matchFilter(r, S.filter)) continue;
            if (q && (buiTitle(r.buiName) + '\n' + buffTitle(r.buffName)).toLowerCase().indexOf(q) < 0) continue;
            out.push(r);
        }
        return out;
    }

    /* ------------------------------------------------------------------ */
    /* Buff events (own tracker, never the stock 'buff' one)               */
    /* ------------------------------------------------------------------ */

    var tracker = null;

    function trackerProxy(e) {
        var bm = window.__BUFF_MANAGER__;
        if (bm && typeof bm._onBuff === 'function') bm._onBuff(e);
    }

    function getTracker() {
        if (!tracker) tracker = safe(function () { return game.getTracker(TRACKER_NAME, trackerProxy); }, null);
        return tracker;
    }

    function subscribe() {
        if (S.sub) return;
        var t = getTracker();
        if (!t) return;
        try { game.gi.channels.BUFF.removePropertyObserver('buffApplied', t); } catch (e0) { }
        try {
            game.gi.channels.BUFF.addPropertyObserver('buffApplied', t);
            S.sub = true;
        } catch (e) {
            log(e);
        }
    }

    function unsubscribe(force) {
        if (!S.sub && !force) return;
        var t = getTracker();
        try { if (t) game.gi.channels.BUFF.removePropertyObserver('buffApplied', t); } catch (e) { }
        S.sub = false;
    }

    function syncSub() {
        // Also while the window is open: buffs placed by hand or by friends update their rows.
        if (!S.disposed && (busy() || S.rec || S.uiT)) subscribe(); else unsubscribe();
    }

    // BuffAppliedNotification { buff, target, amount, buffOwnerID }: sent by the client when a game tick
    // applies a buff on the viewed island (whoever placed it), i.e. after the server accepted it.
    function onBuff(e) {
        if (S.disposed) return;
        var d = e ? e.data : null;
        if (!d) return;
        var mine = Number(safe(function () { return d.buffOwnerID; }, -2)) === myId(), used = false;
        // Matched by building and buff whatever owner id it carries: the building has the buff now.
        try { used = confirmBuff(d); } catch (err) { log(err); }
        if (mine && S.rec && !used) recordBuff(d);
        if (!used) {
            try { noteBuff(d, mine); } catch (err2) { log(err2); }
        }
    }

    // A buff the queue did not send (star menu, a friend, another script): the row of its building
    // is analysed again; own buffs also change the star menu stocks shown in the window.
    function noteBuff(d, mine) {
        var rec = S.record;
        if (!rec || S.rec || Number(rec.zoneId) !== viewedZone()) {
            if (mine) requestRefresh(false);
            return;
        }
        var grid = Number(safe(function () { return d.target.GetGrid(); }, NaN)), hit = false;
        for (var i = 0; isFinite(grid) && i < rec.data.length; i++) {
            if (Number(rec.data[i].buiGrid) === grid) {
                E.touch[rec.zoneId + ':' + grid] = 1;
                hit = true;
                break;
            }
        }
        if (hit || mine) requestRefresh(false);
    }

    /* ------------------------------------------------------------------ */
    /* Apply engine: FIFO queue of templates, one paced sender              */
    /* ------------------------------------------------------------------ */

    function busy() { return E.runs.length > 0; }

    function pendAdd(job) {
        (E.pend[job.key] || (E.pend[job.key] = [])).push(job);
    }

    function pendRemove(job) {
        var l = E.pend[job.key];
        if (!l) return;
        for (var i = 0; i < l.length; i++) {
            if (l[i] === job) { l.splice(i, 1); break; }
        }
        if (!l.length) delete E.pend[job.key];
    }

    function lastPending(key) {
        var l = E.pend[key];
        return (l && l.length) ? l[l.length - 1] : null;
    }

    // Commands still waiting in the queue, per buff name (sent ones are reserved on their stack).
    function queuedDemand() {
        var w = {};
        for (var i = 0; i < E.runs.length; i++) {
            var jobs = E.runs[i].jobs;
            for (var j = 0; j < jobs.length; j++) {
                if (jobs[j].st === 'wait') w[jobs[j].buffName] = (w[jobs[j].buffName] || 0) + 1;
            }
        }
        return w;
    }

    function release(job) {
        if (job.stack && E.reserved[job.stack]) {
            if (--E.reserved[job.stack] <= 0) delete E.reserved[job.stack];
        }
        job.stack = '';
    }

    // The row of a command changed: it is analysed again at the next window update.
    function touch(job) {
        E.touch[job.key] = 1;
        E.dirty = true;
    }

    // st: 'done' | 'fail' | 'skip' (why: the row status that prevented the command).
    function finishJob(job, st, why) {
        if (job.st !== 'wait' && job.st !== 'sent') return;
        release(job);
        job.st = st;
        job.why = why || '';
        pendRemove(job);
        touch(job);
        var run = job.run;
        if (st === 'done') run.ok++;
        else if (st === 'fail') run.fail++;
        else run.skip++;
        if (st !== 'skip') E.res[job.key] = { st: st === 'done' ? 'done' : 'failed', buff: job.buffName, at: now() };
    }

    // Adds a template to the queue. Every row is checked again right before its command.
    function enqueueRecord(rec, name, items) {
        if (!rec || !items || !items.length) return null;
        var zoneId = Number(rec.zoneId), seq = E.seq + 1;
        var run = {
            id: seq,
            name: String(name || rec.zoneUser || ('#' + seq)),
            zoneId: zoneId,
            zoneUser: String(rec.zoneUser || ''),
            jobs: [], total: 0, ok: 0, fail: 0, skip: 0, cancelled: false, waitZone: false
        };
        for (var i = 0; i < items.length; i++) {
            var it = items[i], grid = Number(it.buiGrid);
            if (!isFinite(grid)) continue;
            run.jobs.push({
                run: run, key: zoneId + ':' + grid, buiGrid: grid,
                buffName: String(it.buffName || ''), buiName: String(it.buiName || ''),
                st: 'wait', why: '', sends: 0, sentAt: 0, notBefore: 0, blocked: 0, stack: '', top: null
            });
        }
        if (!run.jobs.length) return null;
        E.seq = seq;
        for (i = 0; i < run.jobs.length; i++) {
            pendAdd(run.jobs[i]);
            touch(run.jobs[i]);
            delete E.res[run.jobs[i].key];
        }
        run.total = run.jobs.length;
        E.runs.push(run);
        syncSub();
        schedule(0);
        return run;
    }

    // Apply button: the selected rows of the window go to the queue (also while another one runs).
    function startRun() {
        if (S.rec || !S.record) return;
        analyzeAll();
        var items = [];
        for (var i = 0; i < S.rows.length; i++) {
            var r = S.rows[i];
            if (r.sel) items.push({ buiGrid: r.grid, buffName: r.buffName, buiName: r.buiName });
        }
        if (!items.length || !enqueueRecord(S.record, S.templateName, items)) {
            refresh(true);
            return;
        }
        alertMsg(txt('sent'));
        if (cfg.autoMin) setMinimized(true);
        refresh(true);
    }

    function schedule(ms) {
        if (S.disposed) return;
        if (E.timer) clearTimeout(E.timer);
        E.timer = setTimeout(pump, Math.max(0, ms || 0));
    }

    function stopTimer() {
        if (E.timer) clearTimeout(E.timer);
        E.timer = null;
    }

    function pump() {
        E.timer = null;
        if (S.disposed) return;
        var t = now(), changed = false;
        try {
            if (checkSent(t)) changed = true;
            if (t - E.lastSend >= cfg.delay && sendNext(t)) changed = true;
            if (finishRuns()) changed = true;
        } catch (e) {
            log(e);
        }
        if (E.dirty) {
            E.dirty = false;
            changed = true;
        }
        if (busy()) {
            schedule(PUMP_TICK);
        } else {
            stopTimer();
            syncSub();
        }
        if (changed) {
            updateTitle();
            if (busy()) requestRefresh(false); else queueDone();
        }
    }

    // The queue is empty: full analysis now and once more a bit later (the game finishes its own
    // updates of the buffed buildings, stocks and production meanwhile).
    function queueDone() {
        requestRefresh(true);
        if (S.settleT) clearTimeout(S.settleT);
        S.settleT = setTimeout(function () {
            S.settleT = null;
            if (!S.disposed && !busy()) requestRefresh(true);
        }, SETTLE_REFRESH);
    }

    // Sends the first command that can go now, in queue order. Rows that cannot be buffed any more
    // are skipped; a building waits until the earlier command for it is finished; a template of
    // another island waits until that island is open and loaded.
    function sendNext(t) {
        var ctxs = {}, held = {}, checks = 0, changed = false;
        for (var i = 0; i < E.runs.length; i++) {
            var run = E.runs[i], ctx = null;
            if (run.cancelled) continue;
            for (var j = 0; j < run.jobs.length; j++) {
                var job = run.jobs[j];
                if (job.st !== 'wait') continue;
                var l = E.pend[job.key];
                if (held[job.key] || job.notBefore > t || (l && l[0] !== job)) {
                    held[job.key] = 1;
                    continue;
                }
                if (!ctx) {
                    var ready = zoneReady(run.zoneId);
                    if (!!run.waitZone === ready) {
                        run.waitZone = !ready;
                        changed = true;
                    }
                    if (!ready) break;
                    ctx = own(ctxs, run.zoneId) ? ctxs[run.zoneId] : (ctxs[run.zoneId] = makeCtx(run.zoneId, true));
                }
                if (++checks > MAX_CHECKS) return changed;
                var v = checkJob(job, ctx, t);
                if (v === 'send') {
                    sendJob(job, ctx, t);
                    return true;
                }
                if (v === 'later') held[job.key] = 1;
                else changed = true;
            }
        }
        return changed;
    }

    // A command for this buff waits for the server (its stack is reserved until the result).
    function inFlight(buffName) {
        for (var i = 0; i < E.runs.length; i++) {
            var jobs = E.runs[i].jobs;
            for (var j = 0; j < jobs.length; j++) {
                if (jobs[j].st === 'sent' && jobs[j].buffName === buffName) return true;
            }
        }
        return false;
    }

    // 'send' | 'later' | 'final' (the command is finished: done, failed or skipped).
    function checkJob(job, ctx, t) {
        var r = analyzeRow(job, ctx), remove = isRemoveBuff(job.buffName), st = r.st;
        var seen = ctx.zoneOk && st !== 'missing' && st !== 'foreign';
        if (job.sends > 0 && seen && (remove ? !r.act : !!(r.act && r.act.name === job.buffName))) {
            // Sent before and not confirmed (e.g. another island was opened): it was applied.
            finishJob(job, 'done');
            return 'final';
        }
        if (job.sends >= MAX_SENDS) {
            finishJob(job, 'fail');
            return 'final';
        }
        if (r.ok) {
            var stk = ctx.stacks[job.buffName], top = (stk && stk.list.length) ? stk.list[0] : null;
            if (top && top.n > 0) {
                job.top = top;
                return 'send';
            }
            st = 'nostock';
        }
        // The rest of the stock is reserved by commands still waiting for the server: one may fail.
        if (st === 'nostock' && inFlight(job.buffName)) {
            job.notBefore = t + BLOCKED_RETRY;
            return 'later';
        }
        // Blocked or not applicable for a moment, or not found right after an island change (still
        // loading): later, a few times.
        var soon = st === 'missing' && !!E.zw && now() - E.zw.at < MISSING_GRACE;
        if ((RETRY[st] || soon) && ++job.blocked <= BLOCKED_MAX) {
            job.notBefore = t + BLOCKED_RETRY;
            return 'later';
        }
        finishJob(job, 'skip', st);
        return 'final';
    }

    function sendJob(job, ctx, t) {
        var top = job.top;
        job.top = null;
        E.lastSend = t;
        if (!sendApply(ctx.gi || gi(), top.b, job.buiGrid)) {
            finishJob(job, 'fail', 'unavail');
            return;
        }
        job.st = 'sent';
        job.sends++;
        job.sentAt = t;
        touch(job);
        top.n--;
        if (top.id) {
            job.stack = top.id;
            E.reserved[top.id] = (E.reserved[top.id] || 0) + 1;
        }
    }

    // APPLY_BUFF like the stock module: a dServerAction batch of one command.
    function sendApply(g, stack, grid) {
        try {
            var u = stack.GetUniqueId();
            var uid = game.def('Communication.VO::dUniqueID').Create(u.uniqueID1, u.uniqueID2);
            if (typeof g.SendServerActionBatch === 'function') {
                g.SendServerActionBatch([game.def('Communication.VO::dServerAction').createForCommand(CMD_APPLY_BUFF, 0, grid, 0, uid)]);
            } else {
                g.SendServerAction(CMD_APPLY_BUFF, 0, grid, 0, uid);
            }
            return true;
        } catch (e) {
            log(e);
            return false;
        }
    }

    function appliedNow(job, ctx) {
        var bui = safe(function () { return ctx.zone.GetBuildingFromGridPosition(job.buiGrid); }, null);
        if (!bui || String(safe(function () { return bui.GetBuildingName_string(); }, '')) !== job.buiName) return false;
        var act = activeBuff(bui, ctx.now);
        return isRemoveBuff(job.buffName) ? !act : !!(act && act.name === job.buffName);
    }

    // Sent commands: done as soon as the building shows the buff (also when the notification is
    // missed); without a result in time the command is queued again, after MAX_SENDS commands it fails.
    function checkSent(t) {
        var changed = false, zs = {};
        for (var i = 0; i < E.runs.length; i++) {
            var run = E.runs[i];
            for (var j = 0; j < run.jobs.length; j++) {
                var job = run.jobs[j], age = t - job.sentAt;
                if (job.st !== 'sent' || age < EARLY_CHECK) continue;
                var zc = own(zs, run.zoneId) ? zs[run.zoneId] :
                    (zs[run.zoneId] = { zone: curZone(), now: clientTime(), zoneOk: zoneReady(run.zoneId) });
                if (zc.zoneOk && appliedNow(job, zc)) {
                    finishJob(job, 'done');
                    changed = true;
                    continue;
                }
                if (age < CONFIRM_TIMEOUT) continue;
                changed = true;
                if (run.cancelled) finishJob(job, 'skip', 'cancel');
                else if (zc.zoneOk && job.sends >= MAX_SENDS) finishJob(job, 'fail');
                else {
                    release(job);
                    job.st = 'wait';
                    job.notBefore = 0;
                    touch(job);
                }
            }
        }
        return changed;
    }

    // Own 'buffApplied' matching a sent command: the command is done.
    function confirmBuff(d) {
        if (!busy()) return false;
        var grid = Number(safe(function () { return d.target.GetGrid(); }, NaN));
        var name = String(safe(function () { return d.buff.GetBuffDefinition().GetName_string(); }, '') || '');
        var l = (isFinite(grid) && name) ? E.pend[viewedZone() + ':' + grid] : null;
        if (!l) return false;
        for (var i = 0; i < l.length; i++) {
            if (l[i].st === 'sent' && l[i].buffName === name) {
                finishJob(l[i], 'done');
                schedule(0);
                return true;
            }
        }
        return false;
    }

    function runOpen(run) {
        for (var j = 0; j < run.jobs.length; j++) {
            if (run.jobs[j].st === 'wait' || run.jobs[j].st === 'sent') return true;
        }
        return false;
    }

    function runSummary(lr) {
        if (!lr) return '';
        return (lr.name ? lr.name + ' - ' : '') + (lr.reason === 'done' ? txt('done') : txt('cancelled')) +
            ': ' + lr.ok + ' / ' + lr.total;
    }

    function finishRuns() {
        var changed = false, quiet = isOpen() && !isMinimized();
        for (var i = 0; i < E.runs.length; i++) {
            var run = E.runs[i];
            if (runOpen(run)) continue;
            E.runs.splice(i--, 1);
            var sum = {
                id: run.id, name: run.name, reason: run.cancelled ? 'cancel' : 'done',
                total: run.total, ok: run.ok, fail: run.fail, skip: run.skip
            };
            E.done.unshift(sum);
            if (E.done.length > KEEP_DONE) E.done.length = KEEP_DONE;
            if (!quiet) {
                alertMsg(runSummary(sum));
                S.unseen = true;
            }
            changed = true;
        }
        return changed;
    }

    // Cancels one template (id) or the whole queue; commands already sent still get confirmed.
    function cancelRun(id) {
        for (var i = 0; i < E.runs.length; i++) {
            var run = E.runs[i];
            if (id !== undefined && run.id !== id) continue;
            run.cancelled = true;
            for (var j = 0; j < run.jobs.length; j++) {
                if (run.jobs[j].st === 'wait') finishJob(run.jobs[j], 'skip', 'cancel');
            }
        }
        finishRuns();
        if (!busy()) {
            stopTimer();
            syncSub();
        }
        refresh(true);
    }

    function findRun(id) {
        for (var i = 0; i < E.runs.length; i++) if (E.runs[i].id === id) return E.runs[i];
        return null;
    }

    function runLeft(run) {
        var o = { wait: 0, sent: 0 };
        for (var j = 0; j < run.jobs.length; j++) {
            if (run.jobs[j].st === 'wait') o.wait++;
            else if (run.jobs[j].st === 'sent') o.sent++;
        }
        return o;
    }

    function queueInfo() {
        var out = [];
        for (var i = 0; i < E.runs.length; i++) {
            var r = E.runs[i], left = runLeft(r);
            out.push({
                id: r.id, name: r.name, zoneId: r.zoneId, total: r.total, ok: r.ok, fail: r.fail, skip: r.skip,
                wait: left.wait, sent: left.sent, cancelled: r.cancelled, waitZone: !!r.waitZone
            });
        }
        return out;
    }

    function visitZone(zoneId) {
        zoneId = Number(zoneId);
        if (!isFinite(zoneId) || zoneId === viewedZone()) return;
        try { game.gi.visitZone(zoneId); } catch (e) { log(e); }
        requestRefresh(true);
    }

    /* ------------------------------------------------------------------ */
    /* Recording (the stock module rules)                                  */
    /* ------------------------------------------------------------------ */

    function cloneRecord(rec) {
        if (!rec) return null;
        var out = { zoneId: rec.zoneId, zoneUser: rec.zoneUser, data: [] };
        for (var i = 0; i < rec.data.length; i++) {
            var it = rec.data[i];
            out.data.push({ buffName: it.buffName, buiGrid: it.buiGrid, buiName: it.buiName });
        }
        return out;
    }

    function startRecording() {
        if (busy() || S.rec) return;
        S.rec = { backup: cloneRecord(S.record), backupName: S.templateName, backupPath: S.templatePath, count: 0 };
        S.showRecents = false;
        syncSub();
        alertMsg(txt('recStarted'));
        refresh(true);
        if (!setMinimized(true)) hideWindow();
    }

    function stopRecording(keep) {
        var rec = S.rec;
        if (!rec) return;
        S.rec = null;
        if (!keep) {
            S.record = rec.backup;
            S.templateName = rec.backupName;
            S.templatePath = rec.backupPath;
        }
        if (S.record && !S.record.data.length) {
            S.record = null;
            S.templateName = '';
            S.templatePath = '';
        }
        syncSub();
        if (keep) alertMsg(txt('recStopped'));
        setMinimized(false);
        refresh(true);
    }

    // Like the stock module: every own buff applied to a building is recorded (whatever its type),
    // the first one fixes the island, buildings already in the list keep their recorded buff.
    function recordBuff(d) {
        var buff = d.buff, target = d.target;
        if (!buff || !target) return;
        var name = String(safe(function () { return buff.GetBuffDefinition().GetName_string(); }, '') || '');
        var grid = Number(safe(function () { return target.GetGrid(); }, NaN));
        var bn = String(safe(function () { return target.GetBuildingName_string(); }, '') || '');
        if (!name || !isFinite(grid) || !bn) return;
        var viewed = viewedZone();
        if (!S.record) {
            S.record = { zoneId: viewed, zoneUser: zoneOwnerName(viewed), data: [] };
            S.templateName = '';
            S.templatePath = '';
        } else if (Number(S.record.zoneId) !== viewed) {
            return;
        }
        var data = S.record.data;
        for (var i = 0; i < data.length; i++) {
            if (Number(data[i].buiGrid) === grid) return;
        }
        data.push({ buffName: name, buiGrid: grid, buiName: bn });
        delete S.manual[grid];
        S.rec.count++;
        updateTitle();
        updateRecPanel();
    }

    /* ------------------------------------------------------------------ */
    /* Templates (compatible with the stock buff module files)             */
    /* ------------------------------------------------------------------ */

    function normalizeRecord(d) {
        if (!d || typeof d !== 'object' || !isArr(d.data)) return null;
        var zoneId = Number(d.zoneId);
        if (!isFinite(zoneId)) return null;
        var out = { zoneId: zoneId, zoneUser: String(d.zoneUser == null ? '' : d.zoneUser), data: [] }, seen = {};
        for (var i = 0; i < d.data.length; i++) {
            var it = d.data[i];
            if (!it || typeof it !== 'object') continue;
            var g = Number(it.buiGrid), b = String(it.buffName || ''), n = String(it.buiName || '');
            if (!isFinite(g) || g < 0 || !b || !n || own(seen, g)) continue;
            seen[g] = 1;
            out.data.push({ buffName: b, buiGrid: g, buiName: n });
        }
        return out.data.length ? out : null;
    }

    // Folder rules (lastDir, shortcuts folder) of the stock SaveLoadTemplate('buff').
    function getTpl() {
        return safe(function () { return new SaveLoadTemplate(TEMPLATE_MODULE, function () { }); }, null);
    }

    function lastDir() {
        var t = getTpl();
        return String((t && safe(function () { return t.getLastDir(); }, '')) ||
            safe(function () { return air.File.documentsDirectory.nativePath; }, '') || '');
    }

    function putLRU(path) {
        if (!path) return;
        try {
            if (typeof lruTemplate === 'undefined' || typeof LRUCache === 'undefined') return;
            lruTemplate[TEMPLATE_MODULE] = lruTemplate[TEMPLATE_MODULE] || new LRUCache(mainSettings.lruCacheSize);
            lruTemplate[TEMPLATE_MODULE].put(now(), path);
        } catch (e) {
            log(e);
        }
    }

    function aliasOf(path) {
        var list = isArr(cfg.recent) ? cfg.recent : [], np = normPath(path);
        for (var i = 0; np && i < list.length; i++) {
            if (list[i] && list[i].path && normPath(list[i].path) === np) return list[i].name;
        }
        return '';
    }

    function onTemplate(data, name, fullPath) {
        if (S.disposed || S.rec) return;
        var rec = normalizeRecord(data);
        if (!rec) {
            alertMsg(txt('badTpl'));
            return;
        }
        if (!fullPath && typeof lruTemplate !== 'undefined' && lruTemplate[TEMPLATE_MODULE] && lruTemplate[TEMPLATE_MODULE].tracker) {
            var lastKey = lruTemplate[TEMPLATE_MODULE].tracker.slice(-1)[0];
            if (lastKey) fullPath = lruTemplate[TEMPLATE_MODULE].store[lastKey];
        }
        S.record = rec;
        S.templatePath = fullPath || '';
        S.templateName = aliasOf(S.templatePath) || baseName(name) || baseName(S.templatePath);
        S.manual = {};
        S.filter = 'all';
        S.search = '';
        S.editingRecent = null;
        S.showRecents = false;
        if (!busy()) E.done = [];
        $(SEL).find('.bm-search input').val('');
        addRecentTemplate(S.templateName, S.templatePath, rec);
        openWindow();
    }

    // Open dialog of the stock module (same folder, LRU entry), keeping the full path of the file.
    function loadTemplate() {
        if (S.rec) return;
        try {
            var f = new air.File(lastDir());
            f.addEventListener(air.Event.SELECT, function (e) {
                var sel = e.target;
                sel.addEventListener(air.Event.COMPLETE, function (ev) {
                    var data = null, p = String(ev.target.nativePath || '');
                    try { data = JSON.parse(ev.target.data); } catch (err) { log(err); }
                    if (!data) {
                        alertMsg(txt('badTpl'));
                        return;
                    }
                    putLRU(p);
                    var bm = window.__BUFF_MANAGER__;
                    if (bm && typeof bm._onTemplate === 'function') bm._onTemplate(data, ev.target.name, p);
                });
                sel.load();
            });
            f.browseForOpen('Open', [new air.FileFilter('All files', '*.*')]);
        } catch (e) {
            log(e);
            alertMsg(txt('loadError'));
        }
    }

    function fileName(name) {
        var n = trim(String(name || '').replace(/[\\\/:*?"<>|]+/g, '_'));
        return (n || TEMPLATE_MODULE + 'Template') + '.txt';
    }

    // Save dialog like SaveLoadTemplate.save() (same file format and folder rules); the saved file
    // becomes the current template and a recent card.
    function saveTemplate() {
        if (!S.record || S.rec) return;
        try {
            var f = S.templatePath ? safe(function () { return new air.File(S.templatePath); }, null) : null;
            if (!f) f = new air.File(lastDir()).resolvePath(fileName(S.templateName));
            var data = JSON.stringify(cloneRecord(S.record), null, ' ');
            f.addEventListener(air.Event.COMPLETE, function (ev) { onSaved(ev.target); });
            f.save(data);
        } catch (e) {
            log(e);
            alertMsg(txt('loadError'));
        }
    }

    function onSaved(file) {
        var p = String(safe(function () { return file.nativePath; }, '') || '');
        try {
            if (mainSettings.changeTemplateFolder) {
                var t = getTpl(), a = {};
                var dir = t ? t.getRealPath(file.parent.nativePath, true) : file.parent.nativePath;
                a[TEMPLATE_MODULE + 'lastDir'] = dir;
                mainSettings[TEMPLATE_MODULE + 'lastDir'] = dir;
                settings.store(a);
            }
        } catch (e) {
            log(e);
        }
        if (S.disposed || !p) return;
        S.templatePath = p;
        addRecentTemplate(baseName(file.name || p), p, S.record);
        S.templateName = aliasOf(p) || baseName(file.name || p);
        updateTitle();
    }

    function resetAll() {
        if (S.rec) return;
        S.record = null;
        S.templateName = '';
        S.templatePath = '';
        S.manual = {};
        S.filter = 'all';
        S.search = '';
        S.editingRecent = null;
        S.showRecents = false;
        if (!busy()) {
            E.done = [];
            E.res = {};
        }
        $(SEL).find('.bm-search input').val('');
        refresh(true);
    }

    function deleteRow(grid) {
        if (S.rec || !S.record) return;
        var data = S.record.data;
        for (var i = data.length - 1; i >= 0; i--) {
            if (Number(data[i].buiGrid) === grid) data.splice(i, 1);
        }
        delete S.manual[grid];
        if (!data.length) {
            S.record = null;
            S.templateName = '';
            S.templatePath = '';
        }
        refresh(true);
    }

    function gotoGrid(grid) {
        var z = curZone();
        if (!z) return;
        try { z.ScrollToGrid(grid); } catch (e) { log(e); }
        if (!setMinimized(true)) hideWindow();
    }

    /* ------------------------------------------------------------------ */
    /* Styles: everything is scoped to the manager window                  */
    /* ------------------------------------------------------------------ */

    function btnBg(kind) {
        return 'background-image:url(images/btn_' + kind + '_left.png),url(images/btn_' + kind + '_right.png),url(images/btn_' + kind + '_middle.png);';
    }

    function radius(r) {
        return '-webkit-border-radius:' + r + ';border-radius:' + r + ';';
    }

    function shadow(s) {
        return '-webkit-box-shadow:' + s + ';box-shadow:' + s + ';';
    }

    function injectStyles() {
        $('#buffManagerStyle').remove();
        $('#buffManagerStyle2').remove();
        var P = SEL + ' ';
        var F = 'font-family:Arial,Helvetica,sans-serif;';
        var PANEL = 'background-color:rgba(0,0,0,.22);border:1px solid #6B5634;' + radius('4px');
        var R = [
            /* window */
            P + '.modal-dialog{width:900px;margin-top:50px!important}',
            '@media (max-width:919px){' + P + '.modal-dialog{width:auto;margin:50px 10px 10px!important}}',
            P + '.modal-content{' + F + 'font-size:13px;color:#F1E6CC}',
            P + '.bm-hide{display:none!important}',
            P + '.bm-i{display:inline-block;vertical-align:middle;font-style:normal;background-repeat:no-repeat;background-position:center center}',

            /* header */
            P + '.modal-header{position:relative;min-height:56px;padding:11px 84px 11px 18px;white-space:nowrap;' +
                '-webkit-user-select:none;user-select:none}',
            SEL + '.floating-modal-minimized .modal-header{min-height:56px;padding:11px 84px 11px 18px}',
            P + '.modal-title{display:inline-block;max-width:100%;margin-top:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:top;' +
                F + 'font-size:17px;font-weight:bold;line-height:34px;color:#F6E7C1;text-shadow:0 1px 2px #000}',
            P + '.modal-title .bm-ti{vertical-align:top;margin:0 8px 0 -4px}',
            P + '.bm-tag{display:inline-block;vertical-align:top;max-width:260px;height:22px;margin:6px 0 0 10px;padding:0 10px 0 5px;' +
                'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default;' + F + 'font-size:12px;font-weight:bold;' +
                'line-height:20px;color:#3B2A14;text-shadow:none;background-color:#E9D9AE;border:1px solid #8C6A3C;' + radius('11px') + '}',
            P + '.bm-tag .bm-i{vertical-align:top;margin:1px 4px 0 0}',
            P + '.bm-tag.bm-rec{color:#FCEBD0;background-color:#8E3B1E;border-color:#5A2210}',
            P + '.bm-tag.bm-run{color:#2B1D0E;background-color:#E2C27A;border-color:#8C6A3C}',
            P + '.modal-title .bm-btn{vertical-align:top;margin:4px 0 0 8px}',
            P + '.bm-x{position:absolute;z-index:3;right:10px;top:3px;width:25px;height:23px;margin:0;padding:0;border:0;outline:none;' +
                'cursor:pointer;-webkit-appearance:none;background-color:transparent;background-repeat:no-repeat;background-position:center center}',

            /* body / footer */
            P + '.modal-body{height:auto;max-height:none;overflow:visible;padding:8px 16px 4px;color:#F1E6CC;' + F + 'font-size:13px;line-height:18px}',
            P + '.modal-body b{color:#FFE7A8}',
            P + '.modal-footer{padding:12px 18px 16px;text-align:left;white-space:nowrap}',
            P + '.bm-fl{float:left}',
            P + '.bm-frt{float:right}',
            P + '.bm-fl .bm-btn{margin:0 6px 0 0}',
            P + '.bm-frt .bm-btn{margin:0 0 0 6px}',

            /* buttons: game textures, no Bootstrap .btn involved */
            P + '.bm-btn{position:relative;display:inline-block;vertical-align:middle;height:32px;margin:0;padding:0 14px;border:0;outline:none;' +
                '-webkit-appearance:none;cursor:pointer;white-space:nowrap;text-align:center;text-decoration:none;' + F +
                'font-size:13px;font-weight:bold;line-height:32px;color:#2B1D0E;text-shadow:0 1px 0 rgba(255,240,200,.45);' +
                'background-color:transparent;' + btnBg('normal') + 'background-repeat:no-repeat,no-repeat,repeat-x;' +
                'background-position:left top,right top,left top;' +
                '-webkit-background-size:auto 100%,auto 100%,100% 100%;background-size:auto 100%,auto 100%,100% 100%;' +
                '-webkit-background-origin:border-box,border-box,content-box;background-origin:border-box,border-box,content-box;' +
                '-webkit-background-clip:border-box,border-box,content-box;background-clip:border-box,border-box,content-box;' +
                shadow('none') + '-webkit-user-select:none;user-select:none}',
            P + '.bm-btn:hover,' + P + '.bm-btn.bm-act{' + btnBg('hover') + '}',
            P + '.bm-btn.bm-act{' + shadow('0 0 6px rgba(255,205,90,.6)') + '}',
            P + '.bm-btn:active{top:1px}',
            P + '.bm-btn[disabled],' + P + '.bm-btn[disabled]:hover,' + P + '.bm-btn[disabled]:active{top:0;cursor:default;color:#5E5E5E;' +
                'text-shadow:none;' + shadow('none') + btnBg('disabled') + '}',
            P + '.bm-btn[disabled] .bm-i{opacity:.45}',
            P + '.bm-btn .bm-i{margin:-2px 0 0}',
            P + '.bm-btn .bm-i+span{margin-left:6px}',
            P + '.bm-sm{height:26px;padding:0 10px;font-size:12px;line-height:26px}',
            P + '.bm-icon{padding:0 7px}',
            P + '.bm-badge{display:inline-block;vertical-align:middle;min-width:12px;height:18px;margin:-2px -4px 0 7px;padding:0 4px;' +
                F + 'font-size:11px;font-weight:bold;line-height:16px;text-align:center;color:#FFF3D6;text-shadow:none;' +
                'background-color:#8E3B1E;border:1px solid #5A2210;' + radius('9px') + '}',
            P + '.bm-btn[disabled] .bm-badge{color:#EDEDED;background-color:#8A8A8A;border-color:#6A6A6A}',

            /* info bar with search and tools */
            P + '.bm-info{height:32px;margin:0 0 8px;padding:0 3px 0 10px;line-height:30px;white-space:nowrap;' + PANEL + '}',
            P + '.bm-infol{overflow:hidden;white-space:nowrap}',
            P + '.bm-it{display:inline-block;vertical-align:top;margin-right:18px}',
            P + '.bm-it .bm-i{margin:-3px 6px 0 0}',
            P + '.bm-warn{color:#FFB39A}',
            P + '.bm-infol .bm-btn{vertical-align:top;margin:2px 10px 0 -8px}',
            P + '.bm-tools{float:right;height:30px;white-space:nowrap}',
            P + '.bm-tools .bm-btn{vertical-align:top;margin:2px 0 0 5px}',
            P + '.bm-search{position:relative;display:inline-block;vertical-align:top;margin:2px 3px 0 0}',
            P + '.bm-search .bm-i{position:absolute;left:7px;top:4px}',
            P + '.bm-search input{width:170px;height:26px;margin:0;padding:0 10px 0 29px;' + F + 'font-size:12px;line-height:normal;' +
                'color:#2B1D0E;background-color:#F4E6C3;border:1px solid #8C6A3C;outline:none;-webkit-appearance:none;' + radius('13px') +
                shadow('inset 0 1px 2px rgba(0,0,0,.35)') + '}',
            P + '.bm-search input:focus{border-color:#D9A441}',

            /* buff cards */
            P + '.bm-cards{margin:0 -6px 2px 0;overflow:hidden}',
            P + '.bm-card{float:left;width:211px;height:46px;margin:0 6px 6px 0;padding:6px 8px 0 6px;overflow:hidden;white-space:nowrap;' + PANEL + '}',
            P + '.bm-card .bm-i{float:left;margin:1px 8px 0 0}',
            P + '.bm-cn{display:block;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:bold;line-height:17px;color:#F6E7C1}',
            P + '.bm-cq{display:block;overflow:hidden;text-overflow:ellipsis;font-size:11px;line-height:16px;color:#CDBF9E}',
            P + '.bm-card.bm-short{border-color:#B24A2A;background-color:rgba(120,30,10,.28)}',
            P + '.bm-card.bm-short .bm-have{color:#FF9C7A}',
            P + '.bm-card.bm-zero{opacity:.55}',

            /* progress */
            P + '.bm-prog{height:34px;margin:0 0 8px;padding:0 3px 0 8px;line-height:32px;white-space:nowrap;overflow:hidden;' +
                'background-color:rgba(0,0,0,.28);border:1px solid #8C6A3C;' + radius('4px') + '}',
            P + '.bm-prog .bm-btn{float:right;margin:3px 0 0 6px}',
            P + '.bm-prog .bm-del{float:right;margin:4px 3px 0 0}',
            P + '.bm-pt{display:inline-block;vertical-align:top;min-width:150px;max-width:220px;margin-right:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:bold;color:#F6E7C1}',
            P + '.bm-pt .bm-i{margin:-3px 6px 0 0}',
            P + '.bm-bar{display:inline-block;vertical-align:top;width:180px;height:12px;margin:9px 14px 0 0;overflow:hidden;' +
                'background-color:#2A231B;border:1px solid #8B6B3E;' + radius('6px') + '}',
            P + '.bm-bar i{display:block;height:10px;background-color:#D9A441;' + radius('5px') + '}',
            P + '.bm-pc{display:inline-block;vertical-align:top;margin-right:14px}',
            P + '.bm-pc .bm-i{margin:-3px 4px 0 0}',

            /* filter chips */
            P + '.bm-chips{min-height:30px;margin:0 0 4px}',
            P + '.bm-chip{display:inline-block;vertical-align:top;height:26px;margin:2px 5px 2px 0;padding:0 5px 0 6px;cursor:pointer;' +
                'white-space:nowrap;' + F + 'font-size:12px;font-weight:bold;line-height:24px;color:#E9DDBF;' +
                'background-color:rgba(0,0,0,.25);border:1px solid #6B5634;' + radius('13px') + '}',
            P + '.bm-chip:hover{color:#FFF1CF;border-color:#D9A441}',
            P + '.bm-chip.bm-act{color:#2B1D0E;background-color:#E2C27A;border-color:#F3DDA0}',
            P + '.bm-chip .bm-i{margin:-2px 4px 0 0}',
            P + '.bm-n{display:inline-block;vertical-align:top;min-width:10px;height:16px;margin:4px 0 0 6px;padding:0 4px;' +
                'font-size:11px;line-height:16px;text-align:center;color:#F6E7C1;background-color:rgba(0,0,0,.35);' + radius('8px') + '}',
            P + '.bm-chip.bm-act .bm-n{color:#2B1D0E;background-color:rgba(255,255,255,.5)}',

            /* settings */
            P + '.bm-set{margin:2px 0 8px;padding:7px 10px 3px;overflow:hidden;' + PANEL + '}',
            P + '.bm-sg{float:left;margin:0 26px 4px 0;white-space:nowrap}',
            P + '.bm-sl{display:inline-block;vertical-align:top;margin-right:8px;font-weight:bold;line-height:26px;color:#F6E7C1}',
            P + '.bm-seg{display:inline-block;vertical-align:top;height:26px;margin:0;padding:0 10px;cursor:pointer;' + F +
                'font-size:12px;font-weight:bold;line-height:24px;color:#E9DDBF;background-color:rgba(0,0,0,.3);' +
                'border:1px solid #6B5634;border-left-width:0}',
            P + '.bm-seg.bm-first{border-left-width:1px;-webkit-border-top-left-radius:13px;-webkit-border-bottom-left-radius:13px;' +
                'border-top-left-radius:13px;border-bottom-left-radius:13px}',
            P + '.bm-seg.bm-last{-webkit-border-top-right-radius:13px;-webkit-border-bottom-right-radius:13px;' +
                'border-top-right-radius:13px;border-bottom-right-radius:13px}',
            P + '.bm-seg:hover{color:#FFF1CF;background-color:rgba(255,220,150,.12)}',
            P + '.bm-seg.bm-act,' + P + '.bm-seg.bm-act:hover{color:#2B1D0E;background-color:#E2C27A}',
            P + '.bm-opt{display:inline-block;vertical-align:top;height:26px;margin-right:16px;line-height:26px;cursor:pointer;white-space:nowrap}',
            P + '.bm-opt:hover{color:#FFF1CF}',
            P + '.bm-opt .bm-cb{margin:-3px 6px 0 0}',
            P + '.bm-opt .bm-i{margin:-3px 4px 0 0}',

            /* native checkbox */
            P + '.bm-cb{display:inline-block;vertical-align:middle;width:19px;height:19px;cursor:pointer;font-style:normal;' +
                'background-repeat:no-repeat;background-position:0 0}',

            /* grid */
            P + '.bm-grid{margin:0 0 6px;overflow:hidden;background-color:rgba(0,0,0,.2);border:1px solid #5A4527;' + radius('4px') + '}',
            P + '.bm-thead{padding-right:10px;background-color:#B2A589}',
            P + '.bm-tbody{max-height:400px;overflow-x:hidden;overflow-y:scroll}',
            P + '.bm-tbody::-webkit-scrollbar, ' + P + '.bm-recents-grid::-webkit-scrollbar{width:10px}',
            P + '.bm-tbody::-webkit-scrollbar-track, ' + P + '.bm-recents-grid::-webkit-scrollbar-track{background-color:#2A231B}',
            P + '.bm-tbody::-webkit-scrollbar-thumb, ' + P + '.bm-recents-grid::-webkit-scrollbar-thumb{background-color:#8B6B3E;border:2px solid #2A231B;' + radius('5px') + '}',
            P + '.bm-tbody::-webkit-scrollbar-thumb:hover, ' + P + '.bm-recents-grid::-webkit-scrollbar-thumb:hover{background-color:#A8844C}',
            P + '.bm-grid table{width:100%;margin:0;table-layout:fixed;border-collapse:collapse;border-spacing:0;' + F +
                'font-size:13px;color:#F1E6CC}',
            P + '.bm-grid th{height:26px;padding:0 6px;border:0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
                F + 'font-size:12px;font-weight:bold;line-height:26px;color:#2B1D0E;text-shadow:0 1px 0 rgba(255,245,215,.4)}',
            P + '.bm-grid td{height:30px;padding:0 6px;border:0;border-top:1px solid rgba(0,0,0,.25);vertical-align:middle;' +
                'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' + F + 'font-size:13px;line-height:28px}',
            P + '.bm-grid tr.bm-row{cursor:pointer}',
            P + '.bm-grid tr.bm-odd td{background-color:rgba(0,0,0,.14)}',
            P + '.bm-grid tr.bm-row:hover td{background-color:rgba(255,220,150,.10)}',
            P + '.bm-grid tr.bm-sel td{background-color:rgba(217,164,65,.16)}',
            P + '.bm-grid tr.bm-sel:hover td{background-color:rgba(217,164,65,.24)}',
            P + '.bm-grid tr.bm-sel td.bm-c0{' + shadow('inset 3px 0 0 #D9A441') + '}',
            P + '.bm-grid tr.bm-na td{color:#A89A80}',
            P + '.bm-grid tr.bm-na .bm-bi,' + P + '.bm-grid tr.bm-na td.bm-c2 .bm-i{opacity:.65}',
            P + '.bm-grid col.bm-c0{width:34px}',
            P + '.bm-grid col.bm-c2{width:30%}',
            P + '.bm-grid col.bm-c3{width:22%}',
            P + '.bm-grid col.bm-c4{width:104px}',
            P + '.bm-grid col.bm-c5{width:32px}',
            P + '.bm-grid th.bm-c0,' + P + '.bm-grid td.bm-c0,' + P + '.bm-grid th.bm-c5,' + P + '.bm-grid td.bm-c5{padding:0;text-align:center}',
            P + '.bm-grid td.bm-c2 .bm-i{margin:-2px 6px 0 0}',
            P + '.bm-grid td.bm-c3 .bm-i{margin:-3px 5px 0 0}',
            P + '.bm-goto{margin:-2px 6px 0 0;cursor:pointer;opacity:.75}',
            P + '.bm-goto:hover{opacity:1}',
            P + '.bm-bi{position:relative;display:inline-block;vertical-align:middle;width:26px;height:26px;margin:-2px 8px 0 0}',
            P + '.bm-bi .bm-i{position:absolute;left:0;top:0}',
            P + '.bm-lv{position:absolute;right:-6px;bottom:-2px;min-width:9px;height:13px;padding:0 2px;' + F +
                'font-size:10px;font-weight:bold;line-height:11px;text-align:center;color:#FFF3D6;text-shadow:none;' +
                'background-color:#5A3D1A;border:1px solid #C9A25A;' + radius('7px') + '}',
            P + '.bm-t.bm-good{color:#A6DC74}',
            P + '.bm-t.bm-bad{color:#FF8A6A}',
            P + '.bm-t.bm-buf{color:#FFD27A}',
            P + '.bm-t.bm-dim{color:#A89A80}',
            P + '.bm-s-ok{color:#D3EBA4}',
            P + '.bm-s-buf{color:#FFD27A}',
            P + '.bm-s-wait{color:#A9D2F5}',
            P + '.bm-s-warn{color:#FFC66B}',
            P + '.bm-s-bad{color:#FF8A6A}',
            P + '.bm-del{display:inline-block;vertical-align:middle;width:25px;height:23px;margin-top:-2px;cursor:pointer;' +
                'background-repeat:no-repeat;background-position:center center;-webkit-background-size:20px 18px;background-size:20px 18px}',
            P + '.bm-del.bm-dis{opacity:.35;cursor:default}',
            P + '.bm-grid tr.bm-nomatch td{height:70px;text-align:center;background-color:transparent}',
            P + '.bm-nomatch .bm-i{opacity:.45}',

            /* empty state */
            P + '.bm-empty{padding:4px 0 16px;text-align:center}',
            P + '.bm-orn{display:block;margin:0 auto 12px}',
            P + '.bm-tile{display:inline-block;vertical-align:top;width:250px;height:120px;margin:0 10px;padding:16px 10px 0;' +
                'text-align:center;cursor:pointer;' + PANEL + radius('6px') + '}',
            P + '.bm-tile:hover{background-color:rgba(255,220,150,.08);border-color:#D9A441}',
            P + '.bm-tile .bm-i{display:block;margin:0 auto 10px}',
            P + '.bm-tile span{display:block;font-size:14px;font-weight:bold;line-height:18px;color:#F6E7C1}',

            /* recent templates */
            P + '.bm-recents{width:820px;max-width:100%;margin:16px auto 0;padding:10px 14px 12px;text-align:left;box-sizing:border-box;' + PANEL + radius('6px') + '}',
            P + '.bm-recents-head{margin:0 0 8px 2px;font-size:12px;font-weight:bold;color:#E2C27A;text-transform:uppercase;letter-spacing:.5px}',
            P + '.bm-recents-head .bm-i{margin:-2px 6px 0 0}',
            P + '.bm-recents-grid{display:block;margin:0 -4px;max-height:220px;overflow-y:auto;padding-right:2px;box-sizing:border-box;font-size:0}',
            P + '.bm-rec-item{position:relative;display:inline-block;vertical-align:top;width:256px;height:36px;line-height:34px;box-sizing:border-box;margin:4px;padding:0 76px 0 34px;cursor:pointer;' +
                'background-color:rgba(30,22,14,.65);border:1px solid #7D5F35;' + radius('4px') +
                ';color:#F6E7C1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
                shadow('inset 0 1px 0 rgba(255,255,255,.05)') + '}',
            P + '.bm-rec-item:hover{background-color:rgba(255,220,150,.14);border-color:#D9A441;color:#FFF3D6;' +
                shadow('inset 0 1px 0 rgba(255,255,255,.1), 0 2px 4px rgba(0,0,0,.35)') + '}',
            P + '.bm-rec-item.bm-rec-editing{background-color:rgba(30,22,14,.85);border-color:#D9A441;cursor:default}',
            P + '.bm-rec-ico{position:absolute;left:8px;top:7px;margin:0;pointer-events:none}',
            P + '.bm-rec-name{display:block;width:100%;height:34px;line-height:34px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
                F + 'font-size:13px;font-weight:bold;color:#F6E7C1}',
            P + '.bm-rec-input{display:block;width:100%;height:24px;line-height:22px;margin:5px 0 0;padding:0 6px;box-sizing:border-box;' +
                F + 'font-size:12px;font-weight:bold;color:#FFF3D6;background-color:#1A120B;border:1px solid #D9A441;' +
                radius('3px') + shadow('inset 0 1px 2px rgba(0,0,0,.6)') + 'outline:none}',
            P + '.bm-rec-edit{position:absolute;right:28px;top:8px;width:18px;height:18px;line-height:18px;text-align:center;cursor:pointer;opacity:.45}',
            P + '.bm-rec-edit:hover{opacity:1}',
            P + '.bm-rec-save{position:absolute;right:28px;top:8px;width:18px;height:18px;line-height:18px;text-align:center;cursor:pointer;opacity:.75}',
            P + '.bm-rec-save:hover{opacity:1}',
            P + '.bm-rec-cancel{position:absolute;right:6px;top:7px;margin:0;opacity:.5}',
            P + '.bm-rec-cancel:hover{opacity:1}',
            P + '.bm-rec-del{position:absolute;right:6px;top:7px;margin:0;opacity:.45}',
            P + '.bm-rec-del:hover{opacity:1}',

            /* recording */
            P + '.bm-recp{padding:16px 0 20px;text-align:center}',
            P + '.bm-big{display:block;margin:0 auto 8px}',
            P + '.bm-recp h3{margin:0 0 10px;' + F + 'font-size:18px;font-weight:bold;line-height:22px;color:#F6E7C1;text-shadow:0 1px 2px #000}',
            P + '.bm-rc{margin:0 0 16px;font-size:14px;line-height:22px}',
            P + '.bm-rc .bm-i{margin:-3px 6px 0 0}',
            P + '.bm-rc b{font-size:16px}',
            P + '.bm-recp .bm-btn{margin:0 5px}',

            /* tooltip */
            P + '.bm-tip{position:absolute;z-index:3000;display:none;max-width:320px;padding:5px 8px;white-space:pre-line;text-align:left;' +
                'pointer-events:none;' + F + 'font-size:12px;font-weight:normal;line-height:16px;color:#2B1D0E;text-shadow:none;' +
                'background-color:#F4E6C3;border:1px solid #6B4A2B;' + radius('4px') + shadow('0 2px 6px rgba(0,0,0,.5)') + '}',
            /* queue */
            P + '.bm-pw{display:inline-block;vertical-align:top;width:180px;margin-right:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#FFB39A}',
            P + '.bm-queue{height:30px;margin:-4px 0 8px;padding:0 3px 0 8px;line-height:28px;white-space:nowrap;overflow:hidden;' + PANEL + '}',
            P + '.bm-queue .bm-btn{float:right;margin:1px 0 0 6px}',
            P + '.bm-ql{display:inline-block;vertical-align:top;margin-right:8px;font-weight:bold;color:#F6E7C1}',
            P + '.bm-ql .bm-i{margin:-3px 5px 0 0}',
            P + '.bm-qi{display:inline-block;vertical-align:top;height:22px;max-width:230px;margin:2px 6px 0 0;padding:0 3px 0 8px;line-height:20px;' +
                'overflow:hidden;white-space:nowrap;font-size:12px;color:#E9DDBF;background-color:rgba(0,0,0,.25);border:1px solid #6B5634;' + radius('11px') + '}',
            P + '.bm-qi .bm-i{margin:-2px 4px 0 -3px}',
            P + '.bm-qn{display:inline-block;vertical-align:top;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:bold}',
            P + '.bm-qi b{display:inline-block;vertical-align:top;margin:0 2px 0 6px;font-weight:normal;color:#F6E7C1}',
            P + '.bm-qi .bm-del{width:18px;height:18px;margin:1px 0 0 2px;vertical-align:top;-webkit-background-size:14px 13px;background-size:14px 13px}',

            /* recent templates in the list view, quick start */
            P + '.bm-recw .bm-recents{width:auto;margin:0 0 8px;padding:6px 10px 8px}',
            P + '.bm-recw .bm-recents-grid{max-height:132px}',
            P + '.bm-rec-item.bm-rec-editing{padding-right:54px}',
            P + '.bm-rec-item.bm-cur{border-color:#D9A441}',
            P + '.bm-rec-go{position:absolute;right:50px;top:8px;width:22px;height:18px;line-height:18px;text-align:center;cursor:pointer;opacity:.6}',
            P + '.bm-rec-go:hover{opacity:1}',
            P + '.bm-rec-go .bm-i{margin:2px 0 0;vertical-align:top}',
            P + '.bm-rec-go[data-bm="visitRecent"] .bm-i{margin:0}',
            P + '.bm-rec-item.bm-rec-2l .bm-rec-name{line-height:15px;padding-top:3px;box-sizing:border-box}',
            P + '.bm-rec-own{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:normal;line-height:14px;color:#C9AE7E}',
            P + '.bm-rec-own .bm-i{margin:-2px 4px 0 0}',
            P + '.bm-rec-away .bm-rec-name{color:#D9C9A3}',
            P + '.bm-rec-sep{display:block;margin:6px 4px 2px;padding:5px 2px 0;border-top:1px solid rgba(125,95,53,.6);' + F +
                'font-size:11px;font-weight:bold;line-height:14px;color:#BFA67A;text-transform:uppercase;letter-spacing:.5px}',
            P + '.bm-tile.bm-dis,' + P + '.bm-tile.bm-dis:hover{opacity:.45;cursor:default;background-color:rgba(0,0,0,.22);border-color:#6B5634}'
        ];
        R = R.concat(checkboxRules(), windowIconRules());
        var el = document.createElement('style');
        el.type = 'text/css';
        el.id = 'buffManagerStyle2';
        el.appendChild(document.createTextNode(R.join('\n')));
        (document.head || document.getElementsByTagName('head')[0]).appendChild(el);
    }

    /* ------------------------------------------------------------------ */
    /* Window helpers                                                      */
    /* ------------------------------------------------------------------ */

    function isShown($m) {
        var d = ($m && $m.length) ? $m.data('bs.modal') : null;
        return !!(d && d.isShown);
    }

    function isOpen() {
        var $m = $(SEL);
        return $m.length > 0 && $m.is(':visible');
    }

    function isMinimized() {
        return $(SEL).hasClass('floating-modal-minimized');
    }

    // Minimise / restore through the client's FloatingModalHost (false if not available).
    function setMinimized(min) {
        var H = safe(function () { return FloatingModalHost; }, null), $m = $(SEL);
        if (!H || !$m.length || !$m.is(':visible')) return false;
        if (!H.active || H.active.id !== MODAL_ID) {
            try { if (H.activate) H.activate($m); } catch (eAct) { }
        }
        try {
            if (min) {
                if (H.minimize) H.minimize();
                else $m.addClass('floating-modal-minimized');
            } else {
                if (H.restore) H.restore();
                else $m.removeClass('floating-modal-minimized');
            }
        } catch (e) {
            log(e);
            return false;
        }
        return !!min === $m.hasClass('floating-modal-minimized');
    }

    // Bootstrap fires hide.bs.modal (and the stage layer swap) even for hidden windows: guard it.
    function hideWindow() {
        var $m = $(SEL);
        if ($m.length && $m.is(':visible') && isShown($m)) $m.modal('hide');
    }

    // Removes a window synchronously (no fade) keeping the stage layer swap balanced.
    function dropModal($m) {
        if (!$m || !$m.length) return;
        $m.off('.bm2');
        if ($m.is(':visible')) {
            if (!isShown($m)) {
                $m.attr('id', MODAL_ID + 'Old').one('hidden.bs.modal', function () { $m.remove(); });
                return;
            }
            $m.removeClass('fade');
            try { $m.modal('hide'); } catch (e) { log(e); }
        }
        $m.remove();
    }

    /* ------------------------------------------------------------------ */
    /* Rendering                                                           */
    /* ------------------------------------------------------------------ */

    // status -> [icon, text id, colour]
    var ST = {
        ready: ['CheckMarkYellow', 'ready', 'ok'],
        buffed: ['BuffStarIndicator1', 'buffed', 'buf'],
        done: ['IconPlayerIn', 'done', 'ok'],
        pending: ['IconPlayerWait', 'pending', 'wait'],
        queued: ['IconPlayerWait', 'queued', 'wait'],
        failed: ['FailedIcon', 'failed', 'bad'],
        zone: ['ButtonIconSendToOtherZone', 'otherIsland', 'bad'],
        loading: ['IconPlayerWait', 'loading', 'wait'],
        missing: ['IconToolTipWarning', 'notFound', 'bad'],
        foreign: ['IconToolTipWarning', 'foreign', 'bad'],
        unavail: ['IconToolTipWarning', 'unavailable', 'bad'],
        nostock: ['BuildQueueResourceMissing', 'nostock', 'bad'],
        noRes: ['BuildQueueResourceMissing', 'nostock', 'warn'],
        depleted: ['DetailsIconDeposit', 'depleted', 'bad'],
        unsafe: ['DetailsIconDeposit', 'deposit', 'warn'],
        stopped: ['BuildingSleepMode', 'stopped', 'warn'],
        upgrade: ['ButtonIconUpgrade', 'upgrade', 'warn'],
        noTools: ['BuildQueueResourceMissing', 'noTools', 'warn'],
        noSettler: ['IconToolTipWarning', 'noSettler', 'warn'],
        whFull: ['IconToolTipWarning', 'whFull', 'warn'],
        prodStopped: ['IconToolTipWarning', 'prodStopped', 'warn']
    };

    // filter -> [icon, text id]
    var CHIPS = [
        ['all', 'StarMenuTabIconAll', 'all'],
        ['ready', 'CheckMarkYellow', 'ready'],
        ['buffed', 'BuffStarIndicator1', 'buffed'],
        ['idle', 'BuildingSleepMode', 'stopped'],
        ['mines', 'DetailsIconDeposit', 'mines'],
        ['bad', 'IconToolTipWarning', 'unavailable']
    ];

    function tipAttr(s) { return s ? ' data-tip="' + esc(s) + '"' : ''; }

    function btn(act, icon, w, h, label, extra) {
        return '<button type="button" class="bm-btn' + (extra ? ' ' + extra : '') + '" data-bm="' + act + '">' +
            ic(icon, w, h) + '<span>' + esc(label) + '</span></button>';
    }

    function iconBtn(act, icon, w, h, tip, disabled) {
        return '<button type="button" class="bm-btn bm-sm bm-icon" data-bm="' + act + '"' + tipAttr(tip) +
            (disabled ? ' disabled' : '') + '>' + ic(icon, w, h) + '</button>';
    }

    // Replaces the content only when it changed (keeps hover states and tooltips of live parts).
    function setHtml($el, h) {
        if (!$el.length || $el.data('bmh') === h) return;
        $el.data('bmh', h).html(h);
    }

    function colgroup() {
        return '<colgroup><col class="bm-c0"><col class="bm-c1"><col class="bm-c2"><col class="bm-c3"><col class="bm-c4"><col class="bm-c5"></colgroup>';
    }

    function skeleton() {
        return '<div class="bm-progw"></div>' +
            '<div class="bm-empty bm-hide"></div>' +
            '<div class="bm-recp bm-hide"></div>' +
            '<div class="bm-list bm-hide">' +
                '<div class="bm-info">' +
                    '<div class="bm-tools">' +
                        '<span class="bm-search">' + ic('SearchBtnIcon', 18, 18) +
                            '<input type="text" maxlength="40" placeholder="' + esc(txt('search')) + '"></span>' +
                        iconBtn('update', 'ButtonIconReload', 22, 21, txt('update')) +
                        iconBtn('settings', 'OptionsButtonOptions', 22, 22, txt('settings')) +
                        iconBtn('tpls', 'ChangeLogIcon', 20, 20, txt('templates')) +
                        iconBtn('record', 'ButtonIconStart', 20, 18, txt('recMore') || txt('record')) +
                    '</div>' +
                    '<div class="bm-infol"></div>' +
                '</div>' +
                '<div class="bm-setw"></div>' +
                '<div class="bm-recw"></div>' +
                '<div class="bm-cards"></div>' +
                '<div class="bm-chips"></div>' +
                '<div class="bm-grid">' +
                    '<div class="bm-thead"><table>' + colgroup() + '<thead><tr>' +
                        '<th class="bm-c0"><i class="bm-cb" data-bm="master"' + tipAttr(txt('selectAll')) + '></i></th>' +
                        '<th class="bm-c1">' + esc(txt('buildings')) + '</th>' +
                        '<th class="bm-c2">' + esc(txt('buff')) + '</th>' +
                        '<th class="bm-c3">' + esc(txt('status')) + '</th>' +
                        '<th class="bm-c4">' + esc(txt('time')) + '</th>' +
                        '<th class="bm-c5"></th>' +
                    '</tr></thead></table></div>' +
                    '<div class="bm-tbody"><table>' + colgroup() + '<tbody></tbody></table></div>' +
                '</div>' +
            '</div>';
    }

    function footerHtml() {
        return '<div class="bm-fl">' +
                btn('save', 'IconMailWrite', 24, 24, txt('save')) +
                btn('load', 'ChangeLogIcon', 24, 23, txt('load')) +
            '</div>' +
            '<div class="bm-frt">' +
                btn('reset', 'ButtonIconThrowAway', 24, 23, txt('reset')) +
                '<button type="button" class="bm-btn bm-act" data-bm="apply">' + ic('ButtonIconAcceptLoot', 36, 20) +
                    '<span class="bm-al">' + esc(txt('apply')) + '</span><span class="bm-badge">0</span></button>' +
                '<button type="button" class="bm-btn" data-dismiss="modal">' + ic('Close', 20, 18) +
                    '<span>' + esc(txt('close')) + '</span></button>' +
            '</div>';
    }

    function ensureModal() {
        var $m = $(SEL);
        if ($m.length && $m.data('bm2') !== TOKEN) {
            // Window of an older script version.
            dropModal($m);
            $m = $(SEL);
            if ($m.length) $m.attr('id', MODAL_ID + 'Old');
            $m = $();
        }
        if ($m.length) return $m;
        injectStyles();
        try { createModalWindow(MODAL_ID, ''); } catch (e) { log(e); }
        $m = $(SEL);
        if (!$m.length) return $m;
        $m.data('bm2', TOKEN);
        var $h = $m.find('.modal-header');
        $h.children('a').remove();
        $h.find('.templateFile').remove();
        $h.append('<button type="button" class="bm-x" data-dismiss="modal"' + tipAttr(txt('close')) + '></button>');
        var body = skeleton(), foot = footerHtml();
        flushIcons();
        $m.find('.modal-body').html(body);
        $m.find('.modal-footer').html(foot);
        bindEvents($m);
        return $m;
    }

    function runName(run) { return run.name || run.zoneUser || ('#' + run.id); }

    function runDone(run) { return run.ok + run.fail + run.skip; }

    // The template shown in the progress line: the first one that is not waiting for its island.
    function activeRun() {
        for (var i = 0; i < E.runs.length; i++) if (!E.runs[i].waitZone) return E.runs[i];
        return E.runs[0] || null;
    }

    function queueTip() {
        var out = [];
        for (var i = 0; i < E.runs.length; i++) {
            var r = E.runs[i];
            out.push(runName(r) + ': ' + runDone(r) + ' / ' + r.total + (r.waitZone ? ' (' + txt('waitZone') + ')' : ''));
        }
        return out.join('\n');
    }

    function updateTitle() {
        var $t = $(SEL + ' .modal-title');
        if (!$t.length) return;
        var h = ic('ProductivityBuffLvl3', 34, 34, 'bm-ti') + esc(txt('title'));
        if (S.rec) {
            h += '<span class="bm-tag bm-rec"' + tipAttr(txt('recProgress')) + '>' + ic('BuffStarIndicator1', 18, 18) + S.rec.count + '</span>' +
                iconBtn('recOk', 'OKIcon', 20, 20, txt('recStop') || txt('ok'));
        } else {
            if (busy()) {
                var done = 0, total = 0;
                for (var i = 0; i < E.runs.length; i++) {
                    done += runDone(E.runs[i]);
                    total += E.runs[i].total;
                }
                h += '<span class="bm-tag bm-run"' + tipAttr(queueTip()) + '>' + ic('IconPlayerWait', 18, 18) +
                    done + ' / ' + total + (E.runs.length > 1 ? ' \u00b7 ' + E.runs.length : '') + '</span>' +
                    iconBtn('cancelAll', 'ButtonIconAbort', 20, 20, E.runs.length > 1 ? txt('clearQueue') : txt('cancel'));
            }
            if (S.templateName) {
                h += '<span class="bm-tag"' + tipAttr(txt('current')) + '>' + ic('ChangeLogIcon', 18, 18) + esc(S.templateName) + '</span>';
            }
        }
        flushIcons();
        setHtml($t, h);
    }

    // Owner and size of the template; on another island a visit button, while its island is still
    // loading a note (the rows are checked once it is shown).
    function renderInfo() {
        var rec = S.record;
        if (!rec) return '';
        var ctx = S.ctx, user = recUser(rec);
        var h = '<span class="bm-it">' + ic('IconMailTypeFriend', 22, 18) + esc(txt('player')) + ': <b>' + esc(user) + '</b></span>' +
            '<span class="bm-it">' + ic('StarMenuTabIconBuilding', 18, 18) + esc(txt('buildings')) + ': <b>' + rec.data.length + '</b></span>';
        if (ctx && !ctx.zoneOk && !ctx.loading) {
            h += '<span class="bm-it bm-warn">' + ic('ButtonIconSendToOtherZone', 22, 20) + esc(txt('otherIsland')) + '</span>' +
                '<button type="button" class="bm-btn bm-sm" data-bm="visit"' + tipAttr(txt('visit') + ': ' + user) + '>' +
                ic('ButtonIconSendToOtherZone', 22, 20) + '<span>' + esc(txt('visit')) + '</span></button>';
        } else if (ctx && ctx.loading) {
            h += '<span class="bm-it bm-warn">' + ic('IconPlayerWait', 18, 18) + esc(txt('loading')) + '</span>';
        }
        return h;
    }

    function renderCards() {
        if (!S.record) return '';
        var order = [], need = {}, data = S.record.data, i, b;
        for (i = 0; i < data.length; i++) {
            b = data[i].buffName;
            if (!own(need, b)) { need[b] = 0; order.push(b); }
        }
        for (i = 0; i < S.rows.length; i++) if (S.rows[i].sel && own(need, S.rows[i].buffName)) need[S.rows[i].buffName]++;
        var stacks = S.ctx ? S.ctx.stacks : {}, h = '';
        for (i = 0; i < order.length; i++) {
            b = order[i];
            var n = need[b], have = stacks[b] ? stacks[b].total : 0, name = buffTitle(b);
            h += '<div class="bm-card' + (n > have ? ' bm-short' : '') + (n === 0 ? ' bm-zero' : '') + '"' +
                tipAttr(name.length > 22 ? name : '') + '>' + ic(b, 30, 30) +
                '<span class="bm-cn">' + esc(name) + '</span>' +
                '<span class="bm-cq">' + esc(txt('requires')) + ': <b>' + n + '</b>&nbsp;&nbsp; ' +
                esc(txt('ready')) + ': <b class="bm-have">' + have + '</b></span></div>';
        }
        return h;
    }

    function progCounts(o) {
        return '<span class="bm-pc"' + tipAttr(txt('done')) + '>' + ic('IconPlayerIn', 20, 20) + o.ok + '</span>' +
            (o.fail ? '<span class="bm-pc"' + tipAttr(txt('failed')) + '>' + ic('FailedIcon', 17, 20) + o.fail + '</span>' : '') +
            (o.skip ? '<span class="bm-pc"' + tipAttr(txt('unavailable')) + '>' + ic('IconToolTipWarning', 20, 20) + o.skip + '</span>' : '');
    }

    function sumHead(lr) { return lr.reason === 'done' ? txt('done') : txt('cancelled'); }

    function sumIcon(lr) {
        return lr.reason === 'cancel' ? 'ButtonIconAbort' : ((lr.fail || lr.skip) ? 'IconToolTipWarning' : 'IconPlayerIn');
    }

    // Active template with its progress, the rest of the queue as chips; when the queue is empty,
    // the summary of the finished templates.
    function renderProg() {
        var run = activeRun(), h, i, r;
        if (run) {
            var done = runDone(run), left = runLeft(run),
                pct = run.total ? Math.min(100, Math.round(done * 100 / run.total)) : 0,
                user = run.zoneUser || zoneOwnerName(run.zoneId) || String(run.zoneId),
                icon = run.waitZone ? 'IconToolTipWarning' : (left.wait ? 'ButtonIconStart' : 'IconPlayerWait'),
                tip = runName(run) + '\n' + (run.waitZone ? txt('waitZone') + ': ' + user : (left.wait ? txt('apply') : txt('pending')));
            h = '<div class="bm-prog">' +
                '<button type="button" class="bm-btn bm-sm" data-bm="cancelRun" data-id="' + run.id + '"' + (run.cancelled ? ' disabled' : '') + '>' +
                    ic('ButtonIconAbort', 20, 19) + '<span>' + esc(txt('cancel')) + '</span></button>' +
                (run.waitZone ? '<button type="button" class="bm-btn bm-sm" data-bm="visitRun" data-id="' + run.id + '">' +
                    ic('ButtonIconSendToOtherZone', 22, 20) + '<span>' + esc(txt('visit')) + '</span></button>' : '') +
                '<span class="bm-pt"' + tipAttr(tip) + '>' + ic(icon, 20, 20) + esc(runName(run)) + '</span>' +
                (run.waitZone ?
                    '<span class="bm-pw">' + esc(txt('waitZone') + ': ' + user) + '</span>' :
                    '<span class="bm-bar"><i style="width:' + pct + '%"></i></span>') +
                '<span class="bm-pc"><b>' + done + '</b> / ' + run.total + '</span>' +
                progCounts(run) + '</div>';
            if (E.runs.length > 1) {
                var q = '';
                for (i = 0; i < E.runs.length; i++) {
                    r = E.runs[i];
                    if (r === run) continue;
                    q += '<span class="bm-qi"' + tipAttr(runName(r) + (r.waitZone ? '\n' + txt('waitZone') : '')) + '>' +
                        (r.waitZone ? ic('IconToolTipWarning', 16, 16) : '') +
                        '<span class="bm-qn">' + esc(runName(r)) + '</span><b>' + runDone(r) + ' / ' + r.total + '</b>' +
                        '<i class="bm-del" data-bm="cancelRun" data-id="' + r.id + '"' + tipAttr(txt('cancel')) + '></i></span>';
                }
                h += '<div class="bm-queue">' +
                    '<button type="button" class="bm-btn bm-sm" data-bm="cancelAll">' + ic('ButtonIconAbort', 20, 19) +
                        '<span>' + esc(txt('clearQueue') || txt('cancel')) + '</span></button>' +
                    '<span class="bm-ql">' + ic('IconPlayerWait', 18, 18) + esc(txt('inQueue')) + ':</span>' + q + '</div>';
            }
            return h;
        }
        var lr = E.done[0];
        if (!lr) return '';
        h = '<div class="bm-prog">' +
            '<i class="bm-del" data-bm="dismissRun"' + tipAttr(txt('close')) + '></i>' +
            '<span class="bm-pt"' + tipAttr(lr.name ? lr.name + '\n' + sumHead(lr) : '') + '>' + ic(sumIcon(lr), 20, 20) +
                esc(lr.name || sumHead(lr)) + '</span>' +
            '<span class="bm-pc">' + esc(sumHead(lr)) + ': <b>' + lr.ok + '</b> / ' + lr.total + '</span>' +
            (lr.fail ? '<span class="bm-pc"' + tipAttr(txt('failed')) + '>' + ic('FailedIcon', 17, 20) + lr.fail + '</span>' : '') +
            (lr.skip ? '<span class="bm-pc"' + tipAttr(txt('unavailable')) + '>' + ic('IconToolTipWarning', 20, 20) + lr.skip + '</span>' : '') +
            '</div>';
        if (E.done.length > 1) {
            var older = '';
            for (i = 1; i < E.done.length; i++) {
                r = E.done[i];
                older += '<span class="bm-qi"' + tipAttr(sumHead(r) + (r.fail ? '\n' + txt('failed') + ': ' + r.fail : '') +
                        (r.skip ? '\n' + txt('unavailable') + ': ' + r.skip : '')) + '>' + ic(sumIcon(r), 16, 16) +
                    '<span class="bm-qn">' + esc(r.name || '#' + r.id) + '</span><b>' + r.ok + ' / ' + r.total + '</b></span>';
            }
            h += '<div class="bm-queue">' + older + '</div>';
        }
        return h;
    }

    function renderProgPanel() {
        var $w = $(SEL + ' .bm-progw');
        if (!$w.length) return;
        var h = S.rec ? '' : renderProg();
        flushIcons();
        setHtml($w, h);
    }

    function renderChips() {
        var c = S.counts || {}, h = '';
        for (var i = 0; i < CHIPS.length; i++) {
            var f = CHIPS[i][0], n = c[f] || 0, act = S.filter === f;
            if (!n && !act && f !== 'all') continue;
            h += '<span class="bm-chip' + (act ? ' bm-act' : '') + '" data-bm="filter" data-f="' + f + '">' +
                ic(CHIPS[i][1], 18, 18) + esc(txt(CHIPS[i][2])) + '<span class="bm-n">' + n + '</span></span>';
        }
        return h;
    }

    function opt(act, on, icon, w, h, label) {
        return '<span class="bm-opt" data-bm="' + act + '"><i class="bm-cb' + (on ? ' bm-on' : '') + '"></i>' +
            ic(icon, w, h) + esc(label) + '</span>';
    }

    function renderSettings() {
        if (!S.showSettings) return '';
        var seg = '';
        for (var i = 0; i < SPEEDS.length; i++) {
            seg += '<span class="bm-seg' + (i === 0 ? ' bm-first' : '') + (i === SPEEDS.length - 1 ? ' bm-last' : '') +
                (cfg.delay === SPEEDS[i] ? ' bm-act' : '') + '" data-bm="speed" data-v="' + SPEEDS[i] + '">' +
                esc(unit('SecondsShort', SPEEDS[i] / 1000)) + '</span>';
        }
        return '<div class="bm-set">' +
            '<div class="bm-sg"><span class="bm-sl">' + esc(txt('select')) + ':</span>' +
                opt('optStopped', cfg.buffStopped, 'BuildingSleepMode', 16, 20, txt('stopped')) +
                opt('optMines', !cfg.safeMines, 'DetailsIconDeposit', 20, 19, txt('depleted')) + '</div>' +
            '<div class="bm-sg"><span class="bm-sl">' + esc(txt('speed')) + ':</span>' + seg + '</div>' +
            '<div class="bm-sg">' + opt('optAutoMin', cfg.autoMin, 'IconPlayerWait', 18, 18, txt('autoMin')) + '</div>' +
            '</div>';
    }

    function rowHtml(r, odd, zoneOk) {
        var st = ST[r.st] || ST.unavail, bn = buiTitle(r.buiName), fn = buffTitle(r.buffName), sText = txt(st[1]) || r.st;
        var sTip = r.tip || (r.st === 'unsafe' ? r.timeTip : '') || (sText.length > 22 ? sText : '');
        var tTip = r.timeTip || (r.endAt ? txt('time') : '');
        var tVal = r.endAt ? fmtDur(r.endAt - clientTime()) : r.time;
        var locked = !!S.rec;
        return '<tr class="bm-row' + (odd ? ' bm-odd' : '') + (r.sel ? ' bm-sel' : '') + (r.ok ? '' : ' bm-na') + '" data-g="' + r.grid + '">' +
            '<td class="bm-c0"><i class="bm-cb' + (r.sel ? ' bm-on' : '') + (r.ok && !locked ? '' : ' bm-dis') + '"></i></td>' +
            '<td class="bm-c1">' +
                (zoneOk ? ic('accuracy.png', 18, 18, 'bm-goto', 'data-bm="goto"' + tipAttr(txt('goto'))) : '') +
                '<span class="bm-bi">' + ic(r.buiName, 26, 26) +
                    (r.level > 0 ? '<span class="bm-lv"' + tipAttr(tr('LAB', 'Level', [r.level])) + '>' + r.level + '</span>' : '') +
                '</span><span' + tipAttr(bn.length > 24 ? bn : '') + '>' + esc(bn) + '</span></td>' +
            '<td class="bm-c2">' + ic(r.buffName, 24, 24) + '<span' + tipAttr(fn.length > 26 ? fn : '') + '>' + esc(fn) + '</span></td>' +
            '<td class="bm-c3"' + tipAttr(sTip) + '>' + ic(st[0], 20, 20) + '<span class="bm-s-' + st[2] + '">' + esc(sText) + '</span></td>' +
            '<td class="bm-c4"' + tipAttr(tTip) + '><span class="bm-t' + (r.timeCls ? ' bm-' + r.timeCls : '') + '"' +
                (r.endAt ? ' data-end="' + r.endAt + '"' : '') + '>' + esc(tVal) + '</span></td>' +
            '<td class="bm-c5"><i class="bm-del' + (locked ? ' bm-dis' : '') + '" data-bm="del"' + tipAttr(txt('del')) + '></i></td>' +
            '</tr>';
    }

    function updateMaster(rows) {
        var $cb = $(SEL + ' [data-bm="master"]');
        if (!$cb.length) return;
        rows = rows || visibleRows();
        var n = 0, s = 0;
        for (var i = 0; i < rows.length; i++) {
            if (!rows[i].ok) continue;
            n++;
            if (rows[i].sel) s++;
        }
        $cb.toggleClass('bm-on', n > 0 && s === n)
            .toggleClass('bm-half', s > 0 && s < n)
            .toggleClass('bm-dis', n === 0 || !!S.rec);
    }

    function renderTable() {
        var $m = $(SEL);
        if (!$m.length) return;
        var rows = visibleRows(), zoneOk = !!(S.ctx && S.ctx.zoneOk), out = [];
        for (var i = 0; i < rows.length; i++) out.push(rowHtml(rows[i], i % 2 === 1, zoneOk));
        var h = out.length ? out.join('') : '<tr class="bm-nomatch"><td colspan="6">' + ic('SearchBtnIcon', 26, 25) + '</td></tr>';
        flushIcons();
        // Redrawn only when something changed (keeps hover, clicks and tooltips during live updates).
        var tb = $m.find('.bm-tbody')[0], top = tb ? tb.scrollTop : 0, $b = $m.find('.bm-tbody tbody');
        if ($b.data('bmh') !== h) {
            $b.data('bmh', h).html(h);
            if (tb && top) tb.scrollTop = top;
        }
        updateMaster(rows);
    }

    // Selection changed without re-analysis: only classes, cards, counters.
    function syncSelection() {
        var $m = $(SEL);
        if (!$m.length) return;
        var map = {}, i;
        for (i = 0; i < S.rows.length; i++) map[S.rows[i].grid] = S.rows[i];
        $m.find('.bm-tbody tr.bm-row').each(function () {
            var r = map[this.getAttribute('data-g')];
            if (!r) return;
            $(this).toggleClass('bm-sel', r.sel).find('.bm-cb').toggleClass('bm-on', r.sel);
        });
        $m.find('.bm-tbody tbody').removeData('bmh');
        updateMaster();
        var cards = renderCards();
        flushIcons();
        setHtml($m.find('.bm-cards'), cards);
        updateFooter();
    }

    function renderSettingsPanel() {
        var $m = $(SEL);
        if (!$m.length) return;
        var h = renderSettings();
        flushIcons();
        setHtml($m.find('.bm-setw'), h);
        $m.find('[data-bm="settings"]').toggleClass('bm-act', !!S.showSettings);
    }

    function renderChipsAndTable() {
        var $m = $(SEL);
        if (!$m.length) return;
        var h = renderChips();
        flushIcons();
        setHtml($m.find('.bm-chips'), h);
        renderTable();
        fitTable();
    }

    // Recent templates inside the list view (open another one or put it into the queue).
    function renderRecentsPanel() {
        var $m = $(SEL);
        if (!$m.length) return;
        var has = isArr(cfg.recent) && cfg.recent.length > 0, show = has && S.showRecents && !!S.record && !S.rec;
        var h = show ? recentsHtml() : '';
        flushIcons();
        setHtml($m.find('.bm-recw'), h);
        $m.find('.bm-tools [data-bm="tpls"]').toggleClass('bm-act', show).prop('disabled', !has);
    }

    function renderList() {
        var $m = $(SEL);
        if (!$m.length) return;
        var info = renderInfo(), cards = renderCards(), chips = renderChips();
        flushIcons();
        setHtml($m.find('.bm-infol'), info);
        setHtml($m.find('.bm-cards'), cards);
        setHtml($m.find('.bm-chips'), chips);
        renderSettingsPanel();
        renderRecentsPanel();
        $m.find('.bm-tools [data-bm="record"]').prop('disabled', busy() || !(S.ctx && S.ctx.zoneOk));
        renderTable();
    }

    // Recent template cards: those of the viewed island first (quick start), then the ones of other
    // islands (visit button); every card shows the owner of its island.
    function recentsHtml() {
        var list = isArr(cfg.recent) ? cfg.recent : [], cur = normPath(S.templatePath), viewed = viewedZone();
        var here = '', away = '';
        for (var i = 0; i < list.length && i < 10; i++) {
            var it = list[i];
            if (!it) continue;
            var nm = it.name || baseName(it.path) || ('#' + (i + 1)), z = recentZone(it), h;
            var other = !!z && z.id !== viewed, user = z ? (z.user || zoneOwnerName(z.id) || String(z.id)) : '';
            if (S.editingRecent === i) {
                h = '<div class="bm-rec-item bm-rec-editing" data-idx="' + i + '">' +
                    ic('ChangeLogIcon', 20, 20, 'bm-rec-ico') +
                    '<input type="text" class="bm-rec-input" value="' + esc(nm) + '" maxlength="40" data-idx="' + i + '">' +
                    '<span class="bm-rec-save" data-bm="saveRecent" data-idx="' + i + '"' + tipAttr(txt('ok')) + '>' +
                        ic('OKIcon', 18, 18) +
                    '</span>' +
                    '<i class="bm-del bm-rec-cancel" data-bm="cancelRecent" data-idx="' + i + '"' + tipAttr(txt('cancel')) + '></i>' +
                '</div>';
            } else {
                h = '<div class="bm-rec-item' + (cur && it.path && normPath(it.path) === cur ? ' bm-cur' : '') +
                        (user ? ' bm-rec-2l' : '') + (other ? ' bm-rec-away' : '') +
                        '" data-bm="openRecent" data-idx="' + i + '"' + tipAttr(nm.length > 24 ? nm : '') + '>' +
                    ic('ChangeLogIcon', 20, 20, 'bm-rec-ico') +
                    '<span class="bm-rec-name">' + esc(nm) +
                        (user ? '<span class="bm-rec-own">' + ic('IconMailTypeFriend', 14, 11) + esc(user) + '</span>' : '') +
                    '</span>' +
                    (other ?
                        '<span class="bm-rec-go" data-bm="visitRecent" data-idx="' + i + '"' + tipAttr(txt('visit') + ': ' + user) + '>' +
                            ic('ButtonIconSendToOtherZone', 20, 18) +
                        '</span>' :
                        '<span class="bm-rec-go" data-bm="queueRecent" data-idx="' + i + '"' + tipAttr(txt('quick')) + '>' +
                            ic('ButtonIconAcceptLoot', 22, 14) +
                        '</span>') +
                    '<span class="bm-rec-edit" data-bm="editRecent" data-idx="' + i + '"' + tipAttr(txt('rename')) + '>' +
                        ic('IconMailWrite', 16, 16) +
                    '</span>' +
                    '<i class="bm-del bm-rec-del" data-bm="delRecent" data-idx="' + i + '"' + tipAttr(txt('del')) + '></i>' +
                '</div>';
            }
            if (other) away += h; else here += h;
        }
        if (_rzDirty) {
            _rzDirty = false;
            saveCfg();
        }
        if (!here && !away) return '';
        return '<div class="bm-recents">' +
            '<div class="bm-recents-head">' + ic('ChangeLogIcon', 20, 20) +
                '<span>' + esc(txt('history') || txt('templates')) + '</span>' +
            '</div>' +
            '<div class="bm-recents-grid">' + here +
                (here && away ? '<div class="bm-rec-sep">' + esc(txt('otherIslands')) + '</div>' : '') + away +
            '</div>' +
        '</div>';
    }

    function emptyHtml() {
        return ic('HelpOrnamentalTop', 293, 70, 'bm-orn') +
            '<div>' +
                '<span class="bm-tile" data-bm="load">' + ic('IconMailInbox', 56, 56) + '<span>' + esc(txt('loadTpl')) + '</span></span>' +
                '<span class="bm-tile' + (busy() ? ' bm-dis' : '') + '" data-bm="record">' + ic('ProductivityBuffLvl3', 48, 48) +
                    '<span>' + esc(txt('recStart')) + '</span></span>' +
            '</div>' + recentsHtml();
    }

    function updateRecPanel() {
        var $p = $(SEL + ' .bm-recp');
        if (!$p.length || !S.rec) return;
        var rec = S.record, user = rec ? (rec.zoneUser || zoneOwnerName(rec.zoneId) || String(rec.zoneId)) : '';
        var h = ic('ProductivityBuffLvl3', 48, 48, 'bm-big') +
            '<h3>' + esc(txt('recProgress') || txt('record')) + '</h3>' +
            (rec ? '<div class="bm-rc">' + ic('IconMailTypeFriend', 22, 18) + esc(txt('player')) + ': <b>' + esc(user) + '</b>&nbsp;&nbsp; ' +
                ic('StarMenuTabIconBuilding', 18, 18) + esc(txt('buildings')) + ': <b>' + rec.data.length + '</b></div>' : '') +
            '<div class="bm-rc">' + ic('BuffStarIndicator1', 22, 22) + esc(txt('buffed')) + ': <b>' + S.rec.count + '</b></div>' +
            '<button type="button" class="bm-btn bm-act" data-bm="recOk">' + ic('OKIcon', 20, 20) + '<span>' + esc(txt('recStop') || txt('ok')) + '</span></button>' +
            '<button type="button" class="bm-btn" data-bm="recCancel">' + ic('ButtonIconAbort', 20, 19) + '<span>' + esc(txt('discard')) + '</span></button>';
        flushIcons();
        $p.html(h);
    }

    function updateFooter() {
        var $f = $(SEL + ' .modal-footer');
        if (!$f.length) return;
        var rec = !!S.rec, has = !!S.record, sel = (has && S.counts && S.counts.sel) || 0;
        $f.find('[data-bm="save"]').prop('disabled', !has || rec);
        $f.find('[data-bm="load"]').prop('disabled', rec);
        $f.find('[data-bm="reset"]').prop('disabled', !has || rec);
        $f.find('[data-bm="apply"]').prop('disabled', !has || rec || !sel);
        $f.find('.bm-al').text(busy() ? (txt('enqueue') || txt('apply')) : txt('apply'));
        $f.find('.bm-badge').text(String(sel)).toggleClass('bm-hide', !has || rec);
    }

    function renderBody() {
        var $m = $(SEL);
        if (!$m.length) return;
        var mode = S.rec ? 'rec' : (S.record ? 'list' : 'empty');
        $m.find('.bm-empty').toggleClass('bm-hide', mode !== 'empty');
        $m.find('.bm-recp').toggleClass('bm-hide', mode !== 'rec');
        $m.find('.bm-list').toggleClass('bm-hide', mode !== 'list');
        renderProgPanel();
        if (mode === 'empty') {
            var h = emptyHtml();
            flushIcons();
            setHtml($m.find('.bm-empty'), h);
        } else {
            // Hidden views keep no stale inputs (rename field) behind.
            setHtml($m.find('.bm-empty'), '');
            if (mode === 'rec') {
                setHtml($m.find('.bm-recw'), '');
                updateRecPanel();
            } else {
                renderList();
            }
        }
        updateFooter();
    }

    // Keeps the dialog inside the window: the table body gets the remaining height.
    function fitTable() {
        var $m = $(SEL);
        if (!$m.length || !$m.is(':visible') || isMinimized()) return;
        var tb = $m.find('.bm-tbody')[0], dlg = $m.find('.modal-dialog')[0];
        if (!tb || !dlg || $m.find('.bm-list').hasClass('bm-hide')) return;
        var winH = Number($(window).height()) || 700;
        var chrome = dlg.offsetHeight - tb.offsetHeight;
        var maxH = Math.max(150, Math.min(520, winH - 60 - chrome));
        tb.style.maxHeight = maxH + 'px';
        var sw = tb.offsetWidth - tb.clientWidth;
        $m.find('.bm-thead').css('padding-right', (sw > 0 ? sw : 0) + 'px');
    }

    // Live countdown of active buffs.
    function tickTimes() {
        var $m = $(SEL);
        if (!$m.length) return;
        var t = clientTime(), expired = false;
        $m.find('.bm-tbody [data-end]').each(function () {
            var left = Number(this.getAttribute('data-end')) - t;
            if (!(left > 0)) {
                expired = true;
                this.removeAttribute('data-end');
                this.textContent = '';
                return;
            }
            var s = fmtDur(left);
            if (this.textContent !== s) this.textContent = s;
        });
        if (expired) requestRefresh(true);
    }

    /* ------------------------------------------------------------------ */
    /* Tooltips (own, inside the dialog: the HTML layer is clipped to it)   */
    /* ------------------------------------------------------------------ */

    function hideTip() {
        if (S.tip) S.tip.style.display = 'none';
        S.tipAnchor = null;
    }

    function showTip(el) {
        var text = el ? el.getAttribute('data-tip') : '';
        var content = $(SEL + ' .modal-content')[0];
        if (!text || !content) return;
        var tip = S.tip;
        if (!tip || tip.parentNode !== content) {
            if (tip && tip.parentNode) tip.parentNode.removeChild(tip);
            tip = document.createElement('div');
            tip.className = 'bm-tip';
            content.appendChild(tip);
            S.tip = tip;
        }
        tip.textContent = text;
        tip.style.left = '0px';
        tip.style.top = '0px';
        tip.style.display = 'block';
        S.tipAnchor = el;
        var cr = content.getBoundingClientRect(), er = el.getBoundingClientRect();
        var cw = cr.right - cr.left, ch = cr.bottom - cr.top, tw = tip.offsetWidth, th = tip.offsetHeight;
        var x = er.left - cr.left + ((er.right - er.left) - tw) / 2;
        var y = er.bottom - cr.top + 6;
        if (y + th > ch - 4) y = er.top - cr.top - th - 6;
        x = Math.max(4, Math.min(x, cw - tw - 4));
        y = Math.max(4, Math.min(y, ch - th - 4));
        tip.style.left = Math.round(x) + 'px';
        tip.style.top = Math.round(y) + 'px';
    }

    function tipCheck() {
        var a = S.tipAnchor;
        if (a && !(document.body.contains(a) && $(a).is(':visible'))) hideTip();
    }

    /* ------------------------------------------------------------------ */
    /* Events                                                              */
    /* ------------------------------------------------------------------ */

    function rowGrid($el) {
        return Number($el.closest('tr').attr('data-g'));
    }

    function findRow(grid) {
        for (var i = 0; i < S.rows.length; i++) if (S.rows[i].grid === grid) return S.rows[i];
        return null;
    }

    function toggleRow(grid) {
        if (S.rec) return;
        var r = findRow(grid);
        if (!r || !r.ok) return;
        S.manual[grid] = !r.sel;
        applySelection();
        syncSelection();
    }

    function toggleMaster() {
        if (S.rec) return;
        var rows = visibleRows(), list = [], all = true, i;
        for (i = 0; i < rows.length; i++) {
            if (!rows[i].ok) continue;
            list.push(rows[i]);
            if (!rows[i].sel) all = false;
        }
        if (!list.length) return;
        for (i = 0; i < list.length; i++) S.manual[list[i].grid] = !all;
        applySelection();
        syncSelection();
    }

    function visitRecordZone() {
        if (!S.record || S.rec) return;
        visitZone(S.record.zoneId);
    }

    function stopEvent(e) {
        if (e) { e.stopPropagation(); e.stopImmediatePropagation(); }
    }

    function onAction(act, $el, e) {
        var v;
        switch (act) {
            case 'apply': startRun(); break;
            case 'cancelRun':
                v = Number($el.attr('data-id'));
                if (isFinite(v)) cancelRun(v);
                break;
            case 'cancelAll': cancelRun(); break;
            case 'visitRun':
                v = findRun(Number($el.attr('data-id')));
                if (v) visitZone(v.zoneId);
                break;
            case 'dismissRun':
                E.done = [];
                if (!busy()) E.res = {};
                refresh(true);
                break;
            case 'save': saveTemplate(); break;
            case 'load': loadTemplate(); break;
            case 'reset': resetAll(); break;
            case 'record': startRecording(); break;
            case 'recOk': stopRecording(true); break;
            case 'recCancel': stopRecording(false); break;
            case 'update': refresh(true); break;
            case 'settings':
                S.showSettings = !S.showSettings;
                renderSettingsPanel();
                fitTable();
                break;
            case 'tpls':
                S.showRecents = !S.showRecents;
                S.editingRecent = null;
                renderRecentsPanel();
                fitTable();
                break;
            case 'visit': visitRecordZone(); break;
            case 'goto': gotoGrid(rowGrid($el)); break;
            case 'del': deleteRow(rowGrid($el)); break;
            case 'openRecent':
                if (e && $(e.target).closest('[data-bm="delRecent"], [data-bm="editRecent"], [data-bm="saveRecent"], [data-bm="cancelRecent"], [data-bm="queueRecent"], [data-bm="visitRecent"], .bm-rec-input').length) break;
                if (S.editingRecent !== null) {
                    cancelEditRecent();
                    break;
                }
                openRecentTemplate(Number($el.attr('data-idx')));
                break;
            case 'queueRecent':
                stopEvent(e);
                if (S.editingRecent !== null) {
                    cancelEditRecent();
                    break;
                }
                queueRecent(Number($el.attr('data-idx')));
                break;
            case 'visitRecent':
                stopEvent(e);
                if (S.editingRecent !== null) {
                    cancelEditRecent();
                    break;
                }
                visitRecent(Number($el.attr('data-idx')));
                break;
            case 'editRecent':
                stopEvent(e);
                startEditRecent(Number($el.attr('data-idx')));
                break;
            case 'saveRecent':
                stopEvent(e);
                commitEditRecent(Number($el.attr('data-idx')));
                break;
            case 'cancelRecent':
                stopEvent(e);
                cancelEditRecent();
                break;
            case 'delRecent':
                stopEvent(e);
                removeRecentTemplate(Number($el.attr('data-idx')));
                break;
            case 'filter':
                v = String($el.attr('data-f') || 'all');
                S.filter = (S.filter === v) ? 'all' : v;
                renderChipsAndTable();
                break;
            case 'optStopped':
                cfg.buffStopped = !cfg.buffStopped;
                saveCfg();
                refresh(true);
                break;
            case 'optMines':
                cfg.safeMines = !cfg.safeMines;
                saveCfg();
                refresh(true);
                break;
            case 'optAutoMin':
                cfg.autoMin = !cfg.autoMin;
                saveCfg();
                renderSettingsPanel();
                break;
            case 'speed':
                v = Number($el.attr('data-v'));
                if (SPEEDS.indexOf(v) >= 0 && v !== cfg.delay) {
                    cfg.delay = v;
                    saveCfg();
                    renderSettingsPanel();
                }
                break;
            case 'master': toggleMaster(); break;
        }
    }

    function bindEvents($m) {
        $m.off('.bm2');
        $m.on('click.bm2', '[data-bm]', function (e) {
            e.stopPropagation();
            e.preventDefault();
            var $el = $(this);
            if ($el.is('[disabled]') || $el.hasClass('bm-dis')) return;
            hideTip();
            try { onAction($el.attr('data-bm'), $el, e); } catch (err) { log(err); }
        });
        $m.on('click.bm2', 'tr.bm-row', function () {
            try { toggleRow(Number(this.getAttribute('data-g'))); } catch (err) { log(err); }
        });
        $m.on('mouseenter.bm2', '[data-tip]', function () { showTip(this); });
        $m.on('mouseleave.bm2', '[data-tip]', function () { hideTip(); });
        $m.on('mousedown.bm2', function () { hideTip(); });
        // Restored with the title bar button: show the current state at once, not on the next tick.
        $m.on('click.bm2', '.floating-modal-toggle', function () {
            setTimeout(function () {
                try {
                    if (!S.disposed && isOpen() && !isMinimized() && S.needFull) refresh(false);
                } catch (err) { log(err); }
            }, 0);
        });
        // Buttons must not keep focus/active look after a click (AIR keeps it otherwise).
        $m.on('mouseup.bm2', 'button', function () {
            var b = this;
            setTimeout(function () { try { b.blur(); } catch (x) { } }, 0);
        });
        $m.on('dblclick.bm2', '.bm-rec-name', function (e) {
            e.stopPropagation();
            var idx = Number($(this).closest('.bm-rec-item').attr('data-idx'));
            if (!isNaN(idx)) startEditRecent(idx);
        });
        $m.on('click.bm2', '.bm-rec-input', function (e) {
            e.stopPropagation();
        });
        $m.on('keydown.bm2', '.bm-rec-input', function (e) {
            e.stopPropagation();
            var idx = Number($(this).attr('data-idx'));
            if (e.keyCode === 13) {
                e.preventDefault();
                commitEditRecent(idx, this.value);
            } else if (e.keyCode === 27) {
                e.preventDefault();
                cancelEditRecent();
            }
        });
        $m.on('input.bm2 keyup.bm2', '.bm-search input', function () {
            var v = String(this.value || '');
            if (v === S.search) return;
            S.search = v;
            if (S.searchT) clearTimeout(S.searchT);
            S.searchT = setTimeout(function () {
                S.searchT = null;
                renderTable();
                fitTable();
            }, SEARCH_DELAY);
        });
        $m.on('keydown.bm2', '.bm-search input', function (e) {
            if (e.keyCode !== 27) return;
            // Esc clears the search instead of closing the window.
            e.stopPropagation();
            e.preventDefault();
            if (!this.value) return;
            this.value = '';
            S.search = '';
            renderTable();
            fitTable();
        });
        $m.on('shown.bs.modal.bm2', function (e) {
            if (e.target !== this) return;
            startUi();
            refresh(true);
        });
        $m.on('hidden.bs.modal.bm2', function (e) {
            if (e.target !== this) return;
            stopUi();
            hideTip();
            // The queue keeps working without the window; its template stays loaded.
            if (!busy() && !S.rec) resetAll();
        });
        $m.find('.bm-tbody').on('scroll.bm2', hideTip);
    }

    /* ------------------------------------------------------------------ */
    /* Refresh loop                                                        */
    /* ------------------------------------------------------------------ */

    function startUi() {
        stopUi();
        S.lastAuto = now();
        S.uiT = setInterval(uiTick, UI_TICK);
        syncSub();
    }

    function stopUi() {
        if (S.uiT) clearInterval(S.uiT);
        S.uiT = null;
        syncSub();
    }

    function uiTick() {
        if (S.disposed) return;
        try {
            tipCheck();
            if (!isOpen() || isMinimized() || S.rec) return;
            if (S.needFull || zoneSig() !== S.zoneSig) { requestRefresh(true); return; }
            if (S.record && now() - S.lastAuto >= AUTO_REFRESH) { refresh(false); return; }
            tickTimes();
        } catch (e) {
            log(e);
        }
    }

    // full: all rows are analysed again; otherwise only the rows whose command or building changed.
    function requestRefresh(full) {
        if (S.disposed) return;
        if (full) S.needFull = true;
        if (S.refreshT) return;
        S.refreshT = setTimeout(function () {
            S.refreshT = null;
            try {
                if (S.needFull) refresh(false); else refreshRun();
            } catch (e) {
                log(e);
            }
        }, REFRESH_DELAY);
    }

    // Quick update: progress, title and the changed rows (a hidden or minimized window is analysed
    // in full as soon as it is shown again).
    function refreshRun() {
        updateTitle();
        var $m = $(SEL);
        if (!$m.length) return;
        if (!$m.is(':visible') || isMinimized()) {
            S.needFull = true;
            return;
        }
        if (S.rec) return;
        if (S.record && !updateRows()) {
            refresh(false);
            return;
        }
        renderProgPanel();
        if (S.record) {
            var chips = renderChips(), cards = renderCards();
            flushIcons();
            setHtml($m.find('.bm-chips'), chips);
            setHtml($m.find('.bm-cards'), cards);
            renderTable();
        }
        updateFooter();
        fitTable();
    }

    function refresh(force) {
        if (S.disposed) return;
        if (S.refreshT) {
            clearTimeout(S.refreshT);
            S.refreshT = null;
        }
        var $m = $(SEL);
        if (!$m.length) return;
        var vis = $m.is(':visible') && !isMinimized();
        if (!vis && !force) {
            S.needFull = true;
            updateTitle();
            return;
        }
        if (!S.rec) analyzeAll();
        S.needFull = false;
        S.lastAuto = now();
        updateTitle();
        renderBody();
        if (vis) fitTable();
    }

    function openWindow() {
        if (S.disposed) return;
        try {
            var $m = ensureModal();
            if (!$m.length) return;
            if ($m.is(':visible')) {
                if (!isShown($m)) {
                    // Closing right now: reopen once it is hidden.
                    $m.one('hidden.bs.modal', function () { setTimeout(openWindow, 0); });
                    return;
                }
                setMinimized(false);
                refresh(true);
                return;
            }
            refresh(true);
            $("div[role='dialog']:visible").each(function () {
                if (this.id === MODAL_ID) return;
                var $o = $(this);
                if (isShown($o)) $o.modal('hide');
            });
            $m.modal({ backdrop: 'static' });
        } catch (e) {
            log(e);
        }
    }

    /* ------------------------------------------------------------------ */
    /* Init / dispose                                                      */
    /* ------------------------------------------------------------------ */

    var API = null;

    function onResize() {
        if (S.fitT) clearTimeout(S.fitT);
        S.fitT = setTimeout(function () {
            S.fitT = null;
            fitTable();
        }, 150);
    }

    function dispose() {
        if (S.disposed) return;
        S.disposed = true;
        stopUi();
        stopTimer();
        if (S.refreshT) clearTimeout(S.refreshT);
        if (S.searchT) clearTimeout(S.searchT);
        if (S.fitT) clearTimeout(S.fitT);
        if (S.settleT) clearTimeout(S.settleT);
        if (E.watchT) clearInterval(E.watchT);
        S.refreshT = S.searchT = S.fitT = S.settleT = E.watchT = null;
        E.runs = [];
        E.pend = {};
        E.reserved = {};
        S.rec = null;
        unsubscribe(true);
        $(window).off('.bm2');
        hideTip();
        try { dropModal($(SEL)); } catch (e) { log(e); }
        $('#buffManagerStyle2').remove();
        $('#buffManagerIcons').remove();
        if (window.__BUFF_MANAGER__ === API) window.__BUFF_MANAGER__ = null;
    }

    function openFromMenu() {
        // A window closed during a run keeps its template and results until they are looked at.
        if (!busy() && !S.rec && !S.unseen) resetAll();
        S.unseen = false;
        openWindow();
    }

    API = {
        version: VERSION,
        config: cfg,
        open: openFromMenu,
        refresh: function () { refresh(true); },
        dispose: dispose,
        queue: queueInfo,
        _onBuff: onBuff,
        _onTemplate: onTemplate
    };
    if (window.__BUFF_MANAGER_TEST__) {
        API._t = {
            S: S, E: E, cfg: cfg, enqueueRecord: enqueueRecord, pump: pump, analyzeAll: analyzeAll, makeCtx: makeCtx,
            collectStacks: collectStacks, defaultItems: defaultItems, startRun: startRun, cancelRun: cancelRun,
            queueRecent: queueRecent, startRecording: startRecording, stopRecording: stopRecording, saveCfg: saveCfg,
            loadCfg: loadCfg, renderBody: renderBody, renderProg: renderProg, refresh: refresh, onAction: onAction,
            addRecentTemplate: addRecentTemplate, removeRecentTemplate: removeRecentTemplate, onSaved: onSaved,
            visitRecent: visitRecent, recentsHtml: recentsHtml, zoneWatch: zoneWatch, zoneReady: zoneReady
        };
    }
    window.__BUFF_MANAGER__ = API;

    $('#buffManagerStyle').remove();
    unsubscribe(true);
    $(window).off('.bm2').on('resize.bm2', onResize);
    watchTick();
    E.watchT = setInterval(watchTick, WATCH_TICK);
    try {
        addToolsMenuItem(txt('menu') || txt('title') || 'Buff Manager', openFromMenu);
    } catch (e) {
        log(e);
    }
})();
