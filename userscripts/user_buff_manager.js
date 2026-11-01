/**
 * Buff Manager 2.0.0
 *
 * Buff template manager for The Settlers Online client.
 *  - Window styled to match classic client windows (window_*, btn_* textures),
 *    isolated from Bootstrap styles (custom classes, scoped to #buffManagerModal);
 *  - All text labels sourced from the in-game localization (loca), all images
 *    from game assets (gAssetManager / building and buff icons);
 *  - Template recording, loading/saving (compatible with SaveLoadTemplate('buff')),
 *    recent template history cards, filters, search, row selection, deposit & stopped building checks;
 *  - Batched application: APPLY_BUFF commands sent via TimedQueue with pre-check
 *    cBuff.IsApplyable, auto-minimize on run, server batch processing, cancellation,
 *    and automatic stop on zone change.
 *
 * Author: MadFx
 */
(function () {
    'use strict';

    var VERSION = '2.0.0';
    var MODAL_ID = 'buffManagerModal';
    var SEL = '#' + MODAL_ID;
    var SETTINGS_KEY = 'BUFF_MANAGER_SETTINGS';
    var TRACKER_NAME = 'buffManagerV2';
    var TEMPLATE_MODULE = 'buff';
    var BUFF_TYPES = ['ProductivityBuff', 'RecruitingBuff', 'ProvisionerBuff', 'BookbinderBuff', 'AreaBuff', 'RemoveBuff'];
    var CMD_APPLY_BUFF = 61;
    var AUTO_REFRESH = 15000;
    var UI_TICK = 1000;
    var REFRESH_DELAY = 120;
    var SEARCH_DELAY = 200;
    var DEFAULTS = { buffStopped: false, safeMines: true };
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

    var _txt = {};
    function txt(id, args) {
        if (!args && own(_txt, id)) return _txt[id];
        var chain = LOCA[id] || [], s = '';
        for (var i = 0; i < chain.length && !s; i++) s = tr(chain[i][0], chain[i][1], args);
        if (s && STRIP[id]) s = s.replace(/[\s:\uFF1A.\u3002]+$/, '');
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

    function loadCfg() {
        var c = {
            buffStopped: DEFAULTS.buffStopped,
            safeMines: DEFAULTS.safeMines,
            recent: []
        };
        var s = safe(function () { return settings.read(null, SETTINGS_KEY); }, null);
        if (s && typeof s === 'object') {
            if (typeof s.buffStopped === 'boolean') c.buffStopped = s.buffStopped;
            if (typeof s.safeMines === 'boolean') c.safeMines = s.safeMines;
            if (isArr(s.recent)) c.recent = s.recent.slice(0, 10);
        }
        return c;
    }

    var cfg = loadCfg();

    function saveCfg() {
        try {
            settings.store({
                buffStopped: cfg.buffStopped,
                safeMines: cfg.safeMines,
                recent: isArr(cfg.recent) ? cfg.recent.slice(0, 10) : []
            }, SETTINGS_KEY);
        } catch (e) {
            log(e);
        }
    }

    function addRecentTemplate(name, path) {
        if (!name && !path) return;
        var cleanName = String(name || '').replace(/\.[^.]+$/, '');
        var list = isArr(cfg.recent) ? cfg.recent : [];
        var next = [];
        for (var i = 0; i < list.length; i++) {
            var it = list[i];
            if (!it) continue;
            if (path && it.path && it.path === path) continue;
            if (cleanName && it.name && it.name === cleanName) continue;
            next.push(it);
        }
        next.unshift({
            name: cleanName,
            path: path || '',
            time: now()
        });
        if (next.length > 10) next = next.slice(0, 10);
        cfg.recent = next;
        saveCfg();
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
        newName = String(newName || '').trim().replace(/[\\/:*?"<>|]/g, '');
        var item = cfg.recent[idx];
        if (!item) {
            S.editingRecent = null;
            renderBody();
            return;
        }
        var oldName = item.name;
        if (newName && newName !== oldName) {
            var p = item.path;
            if (!p) {
                var t = getTpl();
                if (t && typeof t.getLastDir === 'function') {
                    var sep = (typeof air !== 'undefined' && air.File && air.File.separator) || '\\';
                    p = t.getLastDir() + sep + oldName + '.txt';
                }
            }
            if (p && typeof air !== 'undefined' && air.File) {
                try {
                    var f = new air.File(p);
                    if (f.exists && f.parent) {
                        var newFile = f.parent.resolvePath(newName + '.txt');
                        f.moveTo(newFile, true);
                        item.path = newFile.nativePath;
                    }
                } catch (eFile) {
                    log(eFile);
                }
            }
            item.name = newName;
            saveCfg();
            if (S.templateName === oldName) {
                S.templateName = newName;
                if (item.path) S.templatePath = item.path;
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
                for (var i = 0; i < tracker.length && list.length < 10; i++) {
                    var p = store[tracker[i]];
                    if (p) {
                        var base = String(p).split(/[\/\\]/).pop().replace(/\.[^.]+$/, '');
                        list.push({ name: base, path: p, time: Number(tracker[i]) || now() });
                    }
                }
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

    function readFileDirect(filePath) {
        if (typeof loadFileWithRetry === 'function') {
            try {
                var out = loadFileWithRetry(filePath, 0);
                if (out && out.data) return out;
            } catch (eRetry) { }
        }
        try {
            var f = new air.File(filePath);
            if (!f.exists) return null;
            var fs = new air.FileStream();
            fs.open(f, air.FileMode.READ);
            var content = fs.readUTFBytes(f.size);
            fs.close();
            return { data: content, name: f.name };
        } catch (e) {
            log(e);
            return null;
        }
    }

    function openRecentTemplate(idx) {
        if (S.run || S.rec) return;
        var list = isArr(cfg.recent) ? cfg.recent : [];
        var item = list[idx];
        if (!item) return;
        var path = item.path;
        if (!path) {
            var t = getTpl();
            if (t && typeof t.getLastDir === 'function') {
                var sep = (typeof air !== 'undefined' && air.File && air.File.separator) || '\\';
                path = t.getLastDir() + sep + item.name + '.txt';
            }
        }
        if (!path) {
            alertMsg(txt('loadError'));
            return;
        }
        var fileObj = readFileDirect(path);
        if (!fileObj || !fileObj.data) {
            alertMsg(txt('loadError'));
            return;
        }
        try {
            var data = JSON.parse(fileObj.data);
            onTemplate(data, fileObj.name || item.name, path);
        } catch (err) {
            log(err);
            alertMsg(txt('loadError'));
        }
    }

    /* ------------------------------------------------------------------ */
    /* Runtime state                                                       */
    /* ------------------------------------------------------------------ */

    var S = {
        record: null,        // { zoneId, zoneUser, data: [{ buffName, buiGrid, buiName }] }
        templateName: '',
        templatePath: '',
        manual: {},          // grid -> boolean, manual selection override
        res: {},             // grid -> 'pending' | 'done' | 'failed' (current/last run)
        lastRun: null,       // summary of the finished run
        run: null,           // active run
        rec: null,           // active recording { backup, backupName, count }
        filter: 'all',
        search: '',
        editingRecent: null, // index of recent template being renamed, or null
        showSettings: false,
        rows: [],
        counts: {},
        ctx: null,
        zoneSig: '',
        lastAuto: 0,
        sub: false,
        uiT: null,
        refreshT: null,
        searchT: null,
        fitT: null,
        tpl: null,
        tip: null,
        tipAnchor: null,
        disposed: false
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
        var p = safe(function () { return game.gi.mHomePlayer; }, null) || curPlayer();
        if (!p) return -1;
        var id = safe(function () { return p.GetPlayerId(); }, null);
        if (id === null) id = safe(function () { return p.getPlayerID(); }, null);
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
        return String(n || '');
    }

    function checkBuffType(type) {
        type = String(type || '');
        if (!type) return false;
        for (var i = 0; i < BUFF_TYPES.length; i++) {
            if (type.indexOf(BUFF_TYPES[i]) >= 0) return true;
        }
        return false;
    }

    function isRemoveBuff(name) { return String(name || '').indexOf('RemoveBuff') >= 0; }

    function buffVector() {
        return safe(function () { return curPlayer().getAvailableBuffs_vector(); }, null);
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

    // Star menu stacks grouped by buff name (several stacks of one buff are pooled).
    function collectStacks() {
        var out = {}, vec = buffVector();
        var n = vec ? Number(safe(function () { return vec.length; }, 0)) : 0;
        for (var i = 0; i < n; i++) {
            var b = vec[i];
            if (!b) continue;
            var name = stackName(b);
            if (!name) continue;
            var e = out[name] || (out[name] = { list: [], total: 0 });
            e.list.push(b);
            e.total += stackAmount(b);
        }
        return out;
    }

    function pickStack(name) {
        var vec = buffVector(), best = null, bestAmt = 0;
        var n = vec ? Number(safe(function () { return vec.length; }, 0)) : 0;
        for (var i = 0; i < n; i++) {
            var b = vec[i];
            if (!b || stackName(b) !== name) continue;
            var a = stackAmount(b);
            if (a > bestAmt) { best = b; bestAmt = a; }
        }
        return best;
    }

    function buffDef(name, ctx) {
        var st = ctx && ctx.stacks ? ctx.stacks[name] : null;
        var d = (st && st.list.length) ? safe(function () { return st.list[0].GetBuffDefinition(); }, null) : null;
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

    var BAD = { zone: 1, missing: 1, unavail: 1, nostock: 1, failed: 1, depleted: 1 };
    var BUFFED = { buffed: 1, done: 1, pending: 1 };

    function makeCtx() {
        var rec = S.record, zone = curZone(), viewed = viewedZone();
        return {
            zone: zone,
            gi: gi(),
            player: curPlayer(),
            now: clientTime(),
            viewed: viewed,
            zoneOk: !!zone && !!rec && Number(rec.zoneId) === viewed,
            stacks: collectStacks(),
            mode: rec ? durMode(rec.zoneId) : 0
        };
    }

    function zoneSig() {
        var z = curZone();
        var n = z ? Number(safe(function () { return z.mStreetDataMap.GetBuildings_vector().length; }, 0)) : -1;
        return viewedZone() + ':' + n;
    }

    function setActive(r, act, buffName) {
        if (act.end > 0) { r.endAt = act.end; r.timeCls = 'buf'; }
        if (act.name && act.name !== buffName) r.tip = buffTitle(act.name);
    }

    function analyzeRow(item, ctx) {
        var grid = Number(item.buiGrid),
            buffName = String(item.buffName || ''),
            buiName = String(item.buiName || '');
        var r = {
            grid: grid, buffName: buffName, buiName: buiName, level: 0, st: 'ready',
            ok: false, sel: false, idle: false, mine: false,
            time: '', timeCls: '', timeTip: '', endAt: 0, tip: ''
        };
        if (!ctx.zoneOk) { r.st = 'zone'; return r; }
        var bui = safe(function () { return ctx.zone.GetBuildingFromGridPosition(grid); }, null);
        if (!bui || String(safe(function () { return bui.GetBuildingName_string(); }, '')) !== buiName) {
            r.st = 'missing';
            return r;
        }
        var lv = safe(function () { return bui.GetUIUpgradeLevel(); }, null);
        if (lv === null) lv = safe(function () { return bui.GetUpgradeLevel(); }, 0);
        r.level = Number(lv) || 0;

        var remove = isRemoveBuff(buffName), act = activeBuff(bui, ctx.now), ov = S.res[grid];
        if (ov === 'failed' && (remove ? !act : !!act)) ov = 'done';
        if (ov === 'pending' || ov === 'done' || ov === 'failed') {
            r.st = ov;
            if (ov === 'done' && act && !remove) setActive(r, act, buffName);
            return r;
        }
        if (act && !remove) {
            r.st = 'buffed';
            setActive(r, act, buffName);
            return r;
        }

        var stk = ctx.stacks[buffName], probe = (stk && stk.list.length) ? stk.list[0] : null;
        if (probe) {
            var ap = safe(function () { return probe.IsApplyable(ctx.player, ctx.gi, grid); }, null);
            var code = (typeof ap === 'number') ? ap : (ap === false ? -1 : 0);
            if (code === 25) { r.st = 'buffed'; return r; }
            if (code === 13) { r.st = 'depleted'; r.mine = true; return r; }
            if (code === 28) { r.st = 'pending'; return r; }
            if (code !== 0) { r.st = 'unavail'; return r; }
        }
        if (!stk || !(stk.total > 0)) {
            r.st = 'nostock';
            r.tip = tr('LAB', 'InputResourceMissing', [buffName]);
            return r;
        }

        var ok = true, idle = idleState(bui);
        if (idle) { r.idle = true; r.st = idle; ok = cfg.buffStopped; }

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
                    ok = ok && !cfg.safeMines;
                    if (!idle) r.st = 'unsafe';
                }
            }
        }
        if (dur > 0) {
            if (r.timeTip) {
                r.timeTip += '\n' + txt('duration') + ': ' + fmtDur(dur);
            } else if (!idle) {
                r.time = fmtDur(dur);
                r.timeCls = 'dim';
                r.timeTip = txt('duration') + ': ' + r.time;
            }
        }
        r.ok = ok;
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
        if (S.record) {
            var ctx = makeCtx(), data = S.record.data;
            for (var i = 0; i < data.length; i++) S.rows.push(analyzeRow(data[i], ctx));
            S.ctx = ctx;
        }
        applySelection();
        return S.rows;
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
        if (S.run || S.rec) subscribe(); else unsubscribe();
    }

    function onBuff(e) {
        if (S.disposed) return;
        var d = e ? e.data : null;
        if (!d) return;
        if (Number(safe(function () { return d.buffOwnerID; }, -2)) !== myId()) return;
        if (S.rec) recordBuff(d);
    }

    /* ------------------------------------------------------------------ */
    /* Queue & apply engine                                               */
    /* ------------------------------------------------------------------ */

    function getBuffAvailableMap() {
        var avail = {};
        var vec = buffVector();
        var n = vec ? Number(safe(function () { return vec.length; }, 0)) : 0;
        for (var i = 0; i < n; i++) {
            var item = vec[i];
            if (!item) continue;
            var def = safe(function () { return item.GetBuffDefinition(); }, null);
            var name = def ? String(safe(function () { return def.GetName_string(); }, '') || '') : '';
            if (!name) continue;
            var amt = stackAmount(item);
            if (amt <= 0) continue;
            var uid = safe(function () { return item.GetUniqueId(); }, null);
            if (!uid) continue;
            var idStr = String(uid.uniqueID1) + '_' + String(uid.uniqueID2);
            if (!avail[name]) avail[name] = [];
            avail[name].push({ count: amt, id: idStr });
        }
        return avail;
    }

    function takeBuffId(avail, buffName) {
        var list = avail[buffName];
        if (!list || !list.length) return null;
        for (var i = 0; i < list.length; i++) {
            if (list[i].count > 0) {
                list[i].count--;
                return list[i].id;
            }
        }
        return null;
    }

    function getBuffPacket(buffId, grid) {
        try {
            var uniqueIdArr = String(buffId).split("_"),
                uniqueID = game.def("Communication.VO::dUniqueID").Create(uniqueIdArr[0], uniqueIdArr[1]);
            return game.def("Communication.VO::dServerAction").createForCommand(CMD_APPLY_BUFF, 0, grid, 0, uniqueID);
        } catch (ex) {
            log(ex);
            return null;
        }
    }

    function startRun() {
        if (S.run || S.rec || !S.record) return;
        analyzeAll();
        var sel = [], i;
        for (i = 0; i < S.rows.length; i++) {
            if (S.rows[i].sel) sel.push(S.rows[i]);
        }
        if (!sel.length) { refresh(true); return; }

        var avail = getBuffAvailableMap();
        var jobs = [];
        for (i = 0; i < sel.length; i++) {
            var r = sel[i];
            var buffId = takeBuffId(avail, r.buffName);
            if (buffId) {
                var pkt = getBuffPacket(buffId, r.grid);
                if (pkt) {
                    jobs.push({ grid: r.grid, buffName: r.buffName, buiName: r.buiName, packet: pkt });
                }
            }
        }

        S.res = {};
        S.lastRun = null;
        if (!jobs.length) {
            S.lastRun = { reason: 'done', total: sel.length, ok: 0, fail: 0, skip: sel.length };
            refresh(true);
            return;
        }

        for (i = 0; i < jobs.length; i++) {
            S.res[jobs[i].grid] = 'pending';
        }

        var QClass = (typeof TimedQueue !== 'undefined') ? TimedQueue : function (delay) {
            this.queue = [];
            this.index = 0;
            this.batchSize = 1;
            this.tasksQueue = [];
            this.defaultDelay = delay || 1000;
            this.stamp = 0;
            this.inId = void 0;
        };
        if (!QClass.prototype.addTask) {
            QClass.prototype.addTask = function (task) { this.tasksQueue.push(task); };
            QClass.prototype.tick = function (delay, callback) {
                var e = this;
                e.stamp = Date.now() + delay;
                e.inId = setInterval(function () {
                    if (Date.now() >= e.stamp) {
                        clearInterval(e.inId);
                        (callback || function () { e.next(); })();
                    }
                }, 50);
            };
            QClass.prototype.reset = function () {
                if (typeof this.inId === 'number') clearInterval(this.inId);
                this.index = 0;
                this.tasksQueue = [];
            };
        }

        var q = new QClass(1000);
        q.batchSize = 1;
        for (i = 0; i < jobs.length; i++) {
            q.addTask(jobs[i].packet);
        }

        S.run = {
            queue: q,
            jobs: jobs,
            total: sel.length,
            sent: 0,
            ok: 0,
            fail: 0,
            skip: sel.length - jobs.length,
            cancelled: false
        };

        var curJobIdx = 0;
        q.nextTaskBatch = function () {
            if (!S.run || S.run.cancelled) return;
            var batch = this.tasksQueue.splice(0, Math.max(1, this.batchSize));
            if (!batch.length) {
                finishRun('done');
                return;
            }
            try {
                var g = gi();
                if (g && typeof g.SendServerActionBatch === 'function') {
                    g.SendServerActionBatch(batch);
                }
            } catch (eSend) {
                log(eSend);
            }
            if (S.run) {
                for (var b = 0; b < batch.length; b++) {
                    if (curJobIdx < S.run.jobs.length) {
                        var jb = S.run.jobs[curJobIdx++];
                        S.res[jb.grid] = 'done';
                        S.run.ok++;
                        S.run.sent++;
                    }
                }
                requestRefresh();
                updateTitle();
            }
            if (this.tasksQueue.length && !S.run.cancelled) {
                var self = this;
                this.tick(this.defaultDelay, function () {
                    self.nextTaskBatch();
                });
            } else {
                finishRun('done');
            }
        };

        subscribe();
        q.run();
        setMinimized(true);
        try {
            if (typeof getText === 'function') {
                game.showAlert(getText('command_sent'));
            } else {
                alertMsg(txt('apply'));
            }
        } catch (eAlert) {
            log(eAlert);
        }
        refresh(true);
    }

    function cancelRun() {
        if (!S.run) return;
        S.run.cancelled = true;
        if (S.run.queue) {
            try {
                if (typeof S.run.queue.inId === 'number') clearInterval(S.run.queue.inId);
                if (typeof S.run.queue.reset === 'function') S.run.queue.reset();
                S.run.queue.tasksQueue = [];
            } catch (e) {
                log(e);
            }
        }
        finishRun('cancel');
    }

    function runSummary(lr) {
        if (!lr) return '';
        var head = lr.reason === 'done' ? txt('done') : (lr.reason === 'conn' ? txt('connLost') : txt('cancelled'));
        return head + ': ' + lr.ok + ' / ' + lr.total;
    }

    function finishRun(reason) {
        var run = S.run;
        if (!run) return;
        if (run.queue) {
            try {
                if (typeof run.queue.inId === 'number') clearInterval(run.queue.inId);
                if (typeof run.queue.reset === 'function') run.queue.reset();
                run.queue.tasksQueue = [];
            } catch (e) {
                log(e);
            }
        }
        for (var p in S.res) {
            if (own(S.res, p) && S.res[p] === 'pending') {
                if (reason === 'cancel') delete S.res[p];
            }
        }
        S.lastRun = { reason: reason, total: run.total, ok: run.ok, fail: run.fail, skip: run.skip };
        S.run = null;
        syncSub();
        var open = isOpen() && !isMinimized();
        if (!open) {
            S.record = null;
            S.templateName = '';
            S.templatePath = '';
            S.manual = {};
            S.res = {};
            S.filter = 'all';
            S.search = '';
        }
        refresh(true);
        if (!open) alertMsg(runSummary(S.lastRun));
    }

    /* ------------------------------------------------------------------ */
    /* Recording                                                           */
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
        if (S.run || S.rec) return;
        S.rec = { backup: cloneRecord(S.record), backupName: S.templateName, count: 0 };
        syncSub();
        refresh(true);
        if (!setMinimized(true)) {
            hideWindow();
            alertMsg(txt('record'));
        }
    }

    function stopRecording(keep) {
        var rec = S.rec;
        if (!rec) return;
        S.rec = null;
        if (!keep) {
            S.record = rec.backup;
            S.templateName = rec.backupName;
        }
        if (S.record && !S.record.data.length) {
            S.record = null;
            S.templateName = '';
        }
        syncSub();
        setMinimized(false);
        refresh(true);
    }

    function recordBuff(d) {
        var buff = d.buff, target = d.target;
        if (!buff || !target) return;
        var type = String(safe(function () { return buff.GetType(); }, '') || '');
        var name = String(safe(function () { return buff.GetBuffDefinition().GetName_string(); }, '') || '');
        if (!name || !(checkBuffType(type) || checkBuffType(name))) return;
        var grid = Number(safe(function () { return target.GetGrid(); }, NaN));
        var bn = String(safe(function () { return target.GetBuildingName_string(); }, '') || '');
        if (!isFinite(grid) || !bn) return;
        var viewed = viewedZone();
        if (!S.record) {
            S.record = { zoneId: viewed, zoneUser: zoneOwnerName(viewed), data: [] };
            S.templateName = '';
        } else if (Number(S.record.zoneId) !== viewed) {
            return;
        }
        var data = S.record.data, found = false;
        for (var i = 0; i < data.length; i++) {
            if (Number(data[i].buiGrid) === grid) {
                data[i].buffName = name;
                data[i].buiName = bn;
                found = true;
                break;
            }
        }
        if (!found) data.push({ buffName: name, buiGrid: grid, buiName: bn });
        delete S.manual[grid];
        delete S.res[grid];
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

    function getTpl() {
        if (!S.tpl) {
            S.tpl = safe(function () {
                var slt = new SaveLoadTemplate(TEMPLATE_MODULE, function (data, name, fullPath) {
                    var bm = window.__BUFF_MANAGER__;
                    if (bm && typeof bm._onTemplate === 'function') bm._onTemplate(data, name, fullPath);
                });
                if (slt) {
                    var origLoad = slt.load;
                    slt.load = function () {
                        try {
                            var t = this;
                            var file = new air.File(this.getLastDir());
                            var txtFilter = new air.FileFilter("All files", "*.*");
                            file.browseForOpen("Open", [txtFilter]);
                            file.addEventListener(air.Event.SELECT, function (e) {
                                e.target.addEventListener(air.Event.COMPLETE, function (ev) {
                                    try {
                                        var a = JSON.parse(ev.target.data);
                                        var fullPath = ev.target.nativePath;
                                        if (!t.skipLRU && typeof lruTemplate !== 'undefined') {
                                            lruTemplate[t.module] = (lruTemplate[t.module] || new LRUCache(mainSettings.lruCacheSize));
                                            lruTemplate[t.module].put(Date.now(), fullPath);
                                        }
                                        t.loadCallback(a, ev.target.name, fullPath);
                                    } catch (err) {
                                        if (typeof getText === 'function') alert(getText("bad_template"));
                                        if (typeof debug === 'function') debug(err);
                                    }
                                });
                                e.target.load();
                            });
                        } catch (e) {
                            if (origLoad) origLoad.call(slt);
                        }
                    };
                }
                return slt;
            }, null);
        }
        return S.tpl;
    }

    function onTemplate(data, name, fullPath) {
        if (S.disposed) return;
        try {
            var rec = normalizeRecord(data);
            if (!rec) throw new Error('template');
            if (S.run || S.rec) return;
            if (!fullPath && typeof lruTemplate !== 'undefined' && lruTemplate[TEMPLATE_MODULE] && lruTemplate[TEMPLATE_MODULE].tracker) {
                var lastKey = lruTemplate[TEMPLATE_MODULE].tracker.slice(-1)[0];
                if (lastKey) fullPath = lruTemplate[TEMPLATE_MODULE].store[lastKey];
            }
            S.record = rec;
            S.templateName = String(name || '').replace(/\.[^.]+$/, '');
            S.templatePath = fullPath || '';
            S.manual = {};
            S.res = {};
            S.lastRun = null;
            S.filter = 'all';
            addRecentTemplate(S.templateName, S.templatePath);
            openWindow();
        } catch (e) {
            log(e);
            alertMsg(txt('loadError'));
        }
    }

    function saveTemplate() {
        if (!S.record || S.rec) return;
        var t = getTpl();
        if (!t) return;
        try {
            t.save(cloneRecord(S.record));
            if (S.templateName) addRecentTemplate(S.templateName, S.templatePath || '');
        } catch (e) { log(e); }
    }

    function loadTemplate() {
        if (S.run || S.rec) return;
        var t = getTpl();
        if (!t) return;
        try { t.load(); } catch (e) { log(e); alertMsg(txt('loadError')); }
    }

    function resetAll() {
        if (S.run || S.rec) return;
        S.record = null;
        S.templateName = '';
        S.templatePath = '';
        S.manual = {};
        S.res = {};
        S.lastRun = null;
        S.filter = 'all';
        S.search = '';
        S.editingRecent = null;
        $(SEL).find('.bm-search input').val('');
        refresh(true);
    }

    function deleteRow(grid) {
        if (S.run || S.rec || !S.record) return;
        var data = S.record.data;
        for (var i = data.length - 1; i >= 0; i--) {
            if (Number(data[i].buiGrid) === grid) data.splice(i, 1);
        }
        delete S.manual[grid];
        delete S.res[grid];
        if (!data.length) {
            S.record = null;
            S.templateName = '';
            S.lastRun = null;
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
            P + '.bm-pt{display:inline-block;vertical-align:top;min-width:150px;margin-right:12px;font-weight:bold;color:#F6E7C1}',
            P + '.bm-pt .bm-i{margin:-3px 6px 0 0}',
            P + '.bm-bar{display:inline-block;vertical-align:top;width:260px;height:12px;margin:9px 14px 0 0;overflow:hidden;' +
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
            P + '.bm-recents-grid{display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin:0 -4px;max-height:220px;overflow-y:auto;padding-right:2px;box-sizing:border-box}',
            P + '.bm-rec-item{position:relative;display:inline-block;vertical-align:top;-webkit-flex:0 0 calc(33.333% - 8px);flex:0 0 calc(33.333% - 8px);width:calc(33.333% - 8px);height:36px;line-height:34px;box-sizing:border-box;margin:4px;padding:0 50px 0 10px;cursor:pointer;' +
                'background-color:rgba(30,22,14,.65);border:1px solid #7D5F35;' + radius('4px') +
                ';color:#F6E7C1;font-size:13px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
                shadow('inset 0 1px 0 rgba(255,255,255,.05)') + '}',
            P + '.bm-rec-item:hover{background-color:rgba(255,220,150,.14);border-color:#D9A441;color:#FFF3D6;' +
                shadow('inset 0 1px 0 rgba(255,255,255,.1), 0 2px 4px rgba(0,0,0,.35)') + '}',
            P + '.bm-rec-item.bm-rec-editing{background-color:rgba(30,22,14,.85);border-color:#D9A441;cursor:default}',
            P + '.bm-rec-ico{margin:-3px 8px 0 0;vertical-align:middle}',
            P + '.bm-rec-name{display:inline-block;vertical-align:middle;max-width:calc(100% - 28px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            P + '.bm-rec-input{display:inline-block;vertical-align:middle;width:calc(100% - 28px);height:24px;line-height:22px;margin:0;padding:0 5px;box-sizing:border-box;' +
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
                'background-color:#F4E6C3;border:1px solid #6B4A2B;' + radius('4px') + shadow('0 2px 6px rgba(0,0,0,.5)') + '}'
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
        failed: ['FailedIcon', 'failed', 'bad'],
        zone: ['IconToolTipWarning', 'unavailable', 'bad'],
        missing: ['IconToolTipWarning', 'unavailable', 'bad'],
        unavail: ['IconToolTipWarning', 'unavailable', 'bad'],
        nostock: ['BuildQueueResourceMissing', 'nostock', 'bad'],
        noRes: ['BuildQueueResourceMissing', 'nostock', 'warn'],
        depleted: ['DetailsIconDeposit', 'depleted', 'bad'],
        unsafe: ['DetailsIconDeposit', 'deposit', 'warn'],
        stopped: ['BuildingSleepMode', 'stopped', 'warn'],
        upgrade: ['ButtonIconUpgrade', 'upgrade', 'warn'],
        noTools: ['BuildQueueResourceMissing', 'noTools', 'warn'],
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

    function colgroup() {
        return '<colgroup><col class="bm-c0"><col class="bm-c1"><col class="bm-c2"><col class="bm-c3"><col class="bm-c4"><col class="bm-c5"></colgroup>';
    }

    function skeleton() {
        return '<div class="bm-empty bm-hide"></div>' +
            '<div class="bm-recp bm-hide"></div>' +
            '<div class="bm-list bm-hide">' +
                '<div class="bm-info">' +
                    '<div class="bm-tools">' +
                        '<span class="bm-search">' + ic('SearchBtnIcon', 18, 18) +
                            '<input type="text" maxlength="40" placeholder="' + esc(txt('search')) + '"></span>' +
                        iconBtn('update', 'ButtonIconReload', 22, 21, txt('update')) +
                        iconBtn('settings', 'OptionsButtonOptions', 22, 22, txt('settings')) +
                        iconBtn('record', 'ButtonIconStart', 20, 18, txt('record')) +
                    '</div>' +
                    '<div class="bm-infol"></div>' +
                '</div>' +
                '<div class="bm-setw"></div>' +
                '<div class="bm-cards"></div>' +
                '<div class="bm-progw"></div>' +
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
                    '<span>' + esc(txt('apply')) + '</span><span class="bm-badge">0</span></button>' +
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

    function updateTitle() {
        var $t = $(SEL + ' .modal-title');
        if (!$t.length) return;
        var h = ic('ProductivityBuffLvl3', 34, 34, 'bm-ti') + esc(txt('title'));
        if (S.rec) {
            h += '<span class="bm-tag bm-rec"' + tipAttr(txt('record')) + '>' + ic('BuffStarIndicator1', 18, 18) + S.rec.count + '</span>' +
                iconBtn('recOk', 'OKIcon', 20, 20, txt('ok'));
        } else {
            if (S.run) {
                h += '<span class="bm-tag bm-run"' + tipAttr(txt('apply')) + '>' + ic('IconPlayerWait', 18, 18) +
                    (S.run.ok + S.run.fail + S.run.skip) + ' / ' + S.run.total + '</span>' +
                    iconBtn('cancelRun', 'ButtonIconAbort', 20, 20, txt('cancel'));
            }
            if (S.templateName) {
                h += '<span class="bm-tag"' + tipAttr(txt('current')) + '>' + ic('ChangeLogIcon', 18, 18) + esc(S.templateName) + '</span>';
            }
        }
        flushIcons();
        $t.html(h);
    }

    function renderInfo() {
        var rec = S.record;
        if (!rec) return '';
        var zoneOk = !!(S.ctx && S.ctx.zoneOk), loading = !curZone();
        var user = rec.zoneUser || zoneOwnerName(rec.zoneId) || String(rec.zoneId);
        var h = '<span class="bm-it">' + ic('IconMailTypeFriend', 22, 18) + esc(txt('player')) + ': <b>' + esc(user) + '</b></span>' +
            '<span class="bm-it">' + ic('StarMenuTabIconBuilding', 18, 18) + esc(txt('buildings')) + ': <b>' + rec.data.length + '</b></span>';
        if (loading) {
            h += '<span class="bm-it bm-warn">' + ic('IconPlayerWait', 18, 18) + esc(txt('loading')) + '</span>';
        } else if (!zoneOk) {
            h += '<span class="bm-it bm-warn">' + ic('IconToolTipWarning', 18, 18) + esc(txt('unavailable')) + '</span>' +
                '<button type="button" class="bm-btn bm-sm" data-bm="visit"' + (S.run ? ' disabled' : '') + '>' +
                ic('ButtonIconSendToOtherZone', 22, 20) + '<span>' + esc(txt('visit')) + '</span></button>';
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

    function renderProg() {
        var run = S.run, lr = S.lastRun;
        if (run) {
            var done = run.ok + run.fail + run.skip,
                pct = run.total ? Math.min(100, Math.round(done * 100 / run.total)) : 0,
                waiting = run.cancelled || (run.ok + run.skip >= run.total),
                icon = waiting ? 'IconPlayerWait' : 'ButtonIconStart',
                label = waiting ? txt('pending') : txt('apply');
            return '<div class="bm-prog">' +
                '<button type="button" class="bm-btn bm-sm" data-bm="cancelRun"' + (run.cancelled ? ' disabled' : '') + '>' +
                    ic('ButtonIconAbort', 20, 19) + '<span>' + esc(txt('cancel')) + '</span></button>' +
                '<span class="bm-pt">' + ic(icon, 20, 20) + esc(label) + '</span>' +
                '<span class="bm-bar"><i style="width:' + pct + '%"></i></span>' +
                '<span class="bm-pc"><b>' + done + '</b> / ' + run.total + '</span>' +
                progCounts(run) + '</div>';
        }
        if (lr) {
            var clean = lr.reason === 'done' && !lr.fail && !lr.skip,
                icon2 = lr.reason === 'cancel' ? 'ButtonIconAbort' : (clean ? 'IconPlayerIn' : 'IconToolTipWarning'),
                head = lr.reason === 'done' ? txt('done') : (lr.reason === 'conn' ? txt('connLost') : txt('cancelled'));
            return '<div class="bm-prog">' +
                '<i class="bm-del" data-bm="dismissRun"' + tipAttr(txt('close')) + '></i>' +
                '<span class="bm-pt">' + ic(icon2, 20, 20) + esc(head) + '</span>' +
                progCounts(lr) + '</div>';
        }
        return '';
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
        return '<div class="bm-set">' +
            '<div class="bm-sg"><span class="bm-sl">' + esc(txt('select')) + ':</span>' +
                opt('optStopped', cfg.buffStopped, 'BuildingSleepMode', 16, 20, txt('stopped')) +
                opt('optMines', !cfg.safeMines, 'DetailsIconDeposit', 20, 19, txt('depleted')) + '</div>' +
            '</div>';
    }

    function rowHtml(r, odd, zoneOk, running) {
        var st = ST[r.st] || ST.unavail, bn = buiTitle(r.buiName), fn = buffTitle(r.buffName), sText = txt(st[1]) || r.st;
        var sTip = r.tip || (r.st === 'unsafe' ? r.timeTip : '') || (sText.length > 22 ? sText : '');
        var tTip = r.timeTip || (r.endAt ? txt('time') : '');
        var tVal = r.endAt ? fmtDur(r.endAt - clientTime()) : r.time;
        return '<tr class="bm-row' + (odd ? ' bm-odd' : '') + (r.sel ? ' bm-sel' : '') + (r.ok ? '' : ' bm-na') + '" data-g="' + r.grid + '">' +
            '<td class="bm-c0"><i class="bm-cb' + (r.sel ? ' bm-on' : '') + (r.ok && !running ? '' : ' bm-dis') + '"></i></td>' +
            '<td class="bm-c1">' +
                (zoneOk ? ic('accuracy.png', 18, 18, 'bm-goto', 'data-bm="goto"' + tipAttr(txt('goto'))) : '') +
                '<span class="bm-bi">' + ic(r.buiName, 26, 26) +
                    (r.level > 0 ? '<span class="bm-lv"' + tipAttr(tr('LAB', 'Level', [r.level])) + '>' + r.level + '</span>' : '') +
                '</span><span' + tipAttr(bn.length > 24 ? bn : '') + '>' + esc(bn) + '</span></td>' +
            '<td class="bm-c2">' + ic(r.buffName, 24, 24) + '<span' + tipAttr(fn.length > 26 ? fn : '') + '>' + esc(fn) + '</span></td>' +
            '<td class="bm-c3"' + tipAttr(sTip) + '>' + ic(st[0], 20, 20) + '<span class="bm-s-' + st[2] + '">' + esc(sText) + '</span></td>' +
            '<td class="bm-c4"' + tipAttr(tTip) + '><span class="bm-t' + (r.timeCls ? ' bm-' + r.timeCls : '') + '"' +
                (r.endAt ? ' data-end="' + r.endAt + '"' : '') + '>' + esc(tVal) + '</span></td>' +
            '<td class="bm-c5"><i class="bm-del' + (running ? ' bm-dis' : '') + '" data-bm="del"' + tipAttr(txt('del')) + '></i></td>' +
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
            .toggleClass('bm-dis', n === 0 || !!S.run || !!S.rec);
    }

    function renderTable() {
        var $m = $(SEL);
        if (!$m.length) return;
        var rows = visibleRows(), zoneOk = !!(S.ctx && S.ctx.zoneOk), running = !!S.run, h = '';
        for (var i = 0; i < rows.length; i++) h += rowHtml(rows[i], i % 2 === 1, zoneOk, running);
        if (!h) h = '<tr class="bm-nomatch"><td colspan="6">' + ic('SearchBtnIcon', 26, 25) + '</td></tr>';
        flushIcons();
        var tb = $m.find('.bm-tbody')[0], top = tb ? tb.scrollTop : 0;
        $m.find('.bm-tbody tbody').html(h);
        if (tb && top) tb.scrollTop = top;
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
        updateMaster();
        var cards = renderCards();
        flushIcons();
        $m.find('.bm-cards').html(cards);
        updateFooter();
    }

    function renderSettingsPanel() {
        var $m = $(SEL);
        if (!$m.length) return;
        var h = renderSettings();
        flushIcons();
        $m.find('.bm-setw').html(h);
        $m.find('[data-bm="settings"]').toggleClass('bm-act', !!S.showSettings);
    }

    function renderChipsAndTable() {
        var $m = $(SEL);
        if (!$m.length) return;
        var h = renderChips();
        flushIcons();
        $m.find('.bm-chips').html(h);
        renderTable();
        fitTable();
    }

    function renderList() {
        var $m = $(SEL);
        if (!$m.length) return;
        var info = renderInfo(), cards = renderCards(), prog = renderProg(), chips = renderChips();
        flushIcons();
        $m.find('.bm-infol').html(info);
        $m.find('.bm-cards').html(cards);
        $m.find('.bm-progw').html(prog);
        $m.find('.bm-chips').html(chips);
        renderSettingsPanel();
        $m.find('.bm-tools [data-bm="update"]').prop('disabled', !!S.run);
        $m.find('.bm-tools [data-bm="record"]').prop('disabled', !!S.run || !(S.ctx && S.ctx.zoneOk));
        renderTable();
    }

    function emptyHtml() {
        var loadLbl = '';
        var recLbl = '';
        try {
            if (typeof getText === 'function') {
                var t1 = getText('load_template'), t2 = getText('buff_start_record');
                if (t1 && t1.charAt(0) !== '!') loadLbl = t1;
                if (t2 && t2.charAt(0) !== '!') recLbl = t2;
            }
        } catch (e) { }
        if (!loadLbl) loadLbl = 'Загрузить шаблон';
        if (!recLbl) recLbl = 'Начать запись';
        var h = ic('HelpOrnamentalTop', 293, 70, 'bm-orn') +
            '<div>' +
                '<span class="bm-tile" data-bm="load">' + ic('IconMailInbox', 56, 56) + '<span>' + esc(loadLbl) + '</span></span>' +
                '<span class="bm-tile" data-bm="record">' + ic('ProductivityBuffLvl3', 48, 48) + '<span>' + esc(recLbl) + '</span></span>' +
            '</div>';

        var list = isArr(cfg.recent) ? cfg.recent : [];
        if (list.length > 0) {
            var itemsHtml = '';
            for (var i = 0; i < list.length && i < 10; i++) {
                var it = list[i];
                var nm = it.name || (it.path ? it.path.split(/[\/\\]/).pop().replace(/\.[^.]+$/, '') : ('#' + (i + 1)));
                if (S.editingRecent === i) {
                    itemsHtml += '<div class="bm-rec-item bm-rec-editing" data-idx="' + i + '">' +
                        ic('ChangeLogIcon', 20, 20, 'bm-rec-ico') +
                        '<input type="text" class="bm-rec-input" value="' + esc(nm) + '" maxlength="40" data-idx="' + i + '">' +
                        '<span class="bm-rec-save" data-bm="saveRecent" data-idx="' + i + '"' + tipAttr(txt('ok')) + '>' +
                            ic('OKIcon', 18, 18) +
                        '</span>' +
                        '<i class="bm-del bm-rec-cancel" data-bm="cancelRecent" data-idx="' + i + '"' + tipAttr(txt('cancel')) + '></i>' +
                    '</div>';
                } else {
                    itemsHtml += '<div class="bm-rec-item" data-bm="openRecent" data-idx="' + i + '"' + tipAttr(it.path || nm) + '>' +
                        ic('ChangeLogIcon', 20, 20, 'bm-rec-ico') +
                        '<span class="bm-rec-name">' + esc(nm) + '</span>' +
                        '<span class="bm-rec-edit" data-bm="editRecent" data-idx="' + i + '"' + tipAttr(txt('rename')) + '>' +
                            ic('IconMailWrite', 16, 16) +
                        '</span>' +
                        '<i class="bm-del bm-rec-del" data-bm="delRecent" data-idx="' + i + '"' + tipAttr(txt('del')) + '></i>' +
                    '</div>';
                }
            }
            h += '<div class="bm-recents">' +
                '<div class="bm-recents-head">' +
                    ic('ChangeLogIcon', 20, 20) +
                    '<span>' + esc(txt('history') || 'История') + '</span>' +
                '</div>' +
                '<div class="bm-recents-grid">' + itemsHtml + '</div>' +
            '</div>';
        }
        return h;
    }

    function updateRecPanel() {
        var $p = $(SEL + ' .bm-recp');
        if (!$p.length || !S.rec) return;
        var h = ic('ProductivityBuffLvl3', 48, 48, 'bm-big') +
            '<h3>' + esc(txt('record')) + '</h3>' +
            '<div class="bm-rc">' + ic('BuffStarIndicator1', 22, 22) + esc(txt('buffed')) + ': <b>' + S.rec.count + '</b></div>' +
            '<button type="button" class="bm-btn bm-act" data-bm="recOk">' + ic('OKIcon', 20, 20) + '<span>' + esc(txt('ok')) + '</span></button>' +
            '<button type="button" class="bm-btn" data-bm="recCancel">' + ic('ButtonIconAbort', 20, 19) + '<span>' + esc(txt('discard')) + '</span></button>';
        flushIcons();
        $p.html(h);
    }

    function updateFooter() {
        var $f = $(SEL + ' .modal-footer');
        if (!$f.length) return;
        var rec = !!S.rec, run = !!S.run, has = !!S.record, sel = (S.counts && S.counts.sel) || 0;
        $f.find('[data-bm="save"]').prop('disabled', !has || rec);
        $f.find('[data-bm="load"]').prop('disabled', run || rec);
        $f.find('[data-bm="reset"]').prop('disabled', !has || run || rec);
        $f.find('[data-bm="apply"]').prop('disabled', !has || run || rec || !sel);
        $f.find('.bm-badge').text(String(sel)).toggleClass('bm-hide', !has || rec);
    }

    function renderBody() {
        var $m = $(SEL);
        if (!$m.length) return;
        var mode = S.rec ? 'rec' : (S.record ? 'list' : 'empty');
        $m.find('.bm-empty').toggleClass('bm-hide', mode !== 'empty');
        $m.find('.bm-recp').toggleClass('bm-hide', mode !== 'rec');
        $m.find('.bm-list').toggleClass('bm-hide', mode !== 'list');
        if (mode === 'empty') {
            var h = emptyHtml();
            flushIcons();
            $m.find('.bm-empty').html(h);
        } else if (mode === 'rec') {
            updateRecPanel();
        } else {
            renderList();
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
        if (expired) requestRefresh();
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
        if (S.run || S.rec) return;
        var r = findRow(grid);
        if (!r || !r.ok) return;
        S.manual[grid] = !r.sel;
        applySelection();
        syncSelection();
    }

    function toggleMaster() {
        if (S.run || S.rec) return;
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
        if (!S.record || S.run || S.rec) return;
        try { game.gi.visitZone(Number(S.record.zoneId)); } catch (e) { log(e); }
        requestRefresh();
    }

    function onAction(act, $el, e) {
        var v;
        switch (act) {
            case 'apply': startRun(); break;
            case 'cancelRun': cancelRun(); break;
            case 'dismissRun':
                S.lastRun = null;
                S.res = {};
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
            case 'visit': visitRecordZone(); break;
            case 'goto': gotoGrid(rowGrid($el)); break;
            case 'del': deleteRow(rowGrid($el)); break;
            case 'openRecent':
                if (e && $(e.target).closest('[data-bm="delRecent"], [data-bm="editRecent"], [data-bm="saveRecent"], [data-bm="cancelRecent"], .bm-rec-input').length) break;
                if (S.editingRecent !== null) {
                    cancelEditRecent();
                    break;
                }
                v = Number($el.attr('data-idx'));
                openRecentTemplate(v);
                break;
            case 'editRecent':
                if (e) { e.stopPropagation(); e.stopImmediatePropagation(); }
                v = Number($el.attr('data-idx'));
                startEditRecent(v);
                break;
            case 'saveRecent':
                if (e) { e.stopPropagation(); e.stopImmediatePropagation(); }
                v = Number($el.attr('data-idx'));
                commitEditRecent(v);
                break;
            case 'cancelRecent':
                if (e) { e.stopPropagation(); e.stopImmediatePropagation(); }
                cancelEditRecent();
                break;
            case 'delRecent':
                if (e) { e.stopPropagation(); e.stopImmediatePropagation(); }
                v = Number($el.attr('data-idx'));
                removeRecentTemplate(v);
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
        // Buttons must not keep focus/active look after a click (AIR keeps it otherwise).
        $m.on('mouseup.bm2', 'button', function () {
            var b = this;
            setTimeout(function () { try { b.blur(); } catch (x) { } }, 0);
        });
        $m.on('dblclick.bm2', '.bm-rec-name', function (e) {
            e.stopPropagation();
            var $item = $(this).closest('.bm-rec-item');
            var idx = Number($item.attr('data-idx'));
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
            if (!S.run && !S.rec) {
                resetAll();
            }
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
    }

    function stopUi() {
        if (S.uiT) clearInterval(S.uiT);
        S.uiT = null;
    }

    function uiTick() {
        if (S.disposed) return;
        try {
            tipCheck();
            if (!isOpen() || isMinimized() || S.rec) return;
            if (zoneSig() !== S.zoneSig) { requestRefresh(); return; }
            if (!S.run && S.record && now() - S.lastAuto >= AUTO_REFRESH) { refresh(false); return; }
            tickTimes();
        } catch (e) {
            log(e);
        }
    }

    function requestRefresh() {
        if (S.disposed || S.refreshT) return;
        S.refreshT = setTimeout(function () {
            S.refreshT = null;
            try {
                if (S.run) refreshRun(); else refresh(false);
            } catch (e) {
                log(e);
            }
        }, REFRESH_DELAY);
    }

    // Light update while a run is active: overlay statuses, no re-analysis.
    function refreshRun() {
        var rows = S.rows;
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i], ov = S.res[r.grid];
            if ((ov === 'pending' || ov === 'done' || ov === 'failed') && r.st !== ov) {
                r.st = ov;
                r.ok = false;
                r.tip = '';
            }
        }
        applySelection();
        updateTitle();
        var $m = $(SEL);
        if (!$m.length || !$m.is(':visible') || isMinimized()) return;
        var prog = renderProg(), chips = renderChips();
        flushIcons();
        $m.find('.bm-progw').html(prog);
        $m.find('.bm-chips').html(chips);
        renderTable();
        updateFooter();
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
            updateTitle();
            return;
        }
        if (!S.rec) analyzeAll();
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
        if (S.refreshT) clearTimeout(S.refreshT);
        if (S.searchT) clearTimeout(S.searchT);
        if (S.fitT) clearTimeout(S.fitT);
        S.refreshT = S.searchT = S.fitT = null;
        if (S.run && S.run.queue) {
            try {
                if (typeof S.run.queue.inId === 'number') clearInterval(S.run.queue.inId);
                if (typeof S.run.queue.reset === 'function') S.run.queue.reset();
                S.run.queue.tasksQueue = [];
            } catch (e) { }
        }
        S.run = null;
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
        if (!S.run && !S.rec) {
            resetAll();
        }
        openWindow();
    }

    API = {
        version: VERSION,
        config: cfg,
        open: openFromMenu,
        refresh: function () { refresh(true); },
        dispose: dispose,
        _onBuff: onBuff,
        _onTemplate: onTemplate
    };
    window.__BUFF_MANAGER__ = API;

    $('#buffManagerStyle').remove();
    unsubscribe(true);
    $(window).off('.bm2').on('resize.bm2', onResize);
    try {
        addToolsMenuItem(txt('menu') || txt('title') || 'Buff Manager', openFromMenu);
    } catch (e) {
        log(e);
    }
})();
