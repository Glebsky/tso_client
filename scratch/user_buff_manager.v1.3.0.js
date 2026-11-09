/**
 * Buff Manager (Advanced Buff Template Automation)
 * 
 * Features:
 * - Authentic TSO client window background with styled cards, badges, and table
 * - Clean, crisp typography without washed-out or glowing fonts
 * - Dedicated entry in Tools (Инструменты) menu
 * - Toggle to buff or skip stopped/sleeping buildings (persistent setting) with in-game BuildingSleepMode icon
 * - Safe mine buffing toggle: prevents buffing mines that will deplete before the buff duration expires
 * - Multi-stack star menu buff support: pools and splits multiple buff stacks seamlessly
 * - Individual row checkboxes, Master Checkbox, and properly proportioned "Select All" / "Reset" action buttons with margins
 * - In-game search icon (GUI.Assets::gAssetManager_SearchBtnIcon) with proper padding and no broken font glyphs
 * - Informative time badges: depletion time vs buff duration, active buff remaining time
 * - Quick search and category filter pills (All, Ready, Stopped, Mines) with instant DOM filtering
 * - GoTo building camera centering & delete row controls
 * - 100% compatible with standard TSO buff templates (SaveLoadTemplate('buff'))
 * - Uses ONLY built-in loca.GetText and game getText translations
 * 
 * Author: MadFx
 */

(function () {
    'use strict';

    var SCRIPT_ID = 'BuffManager';
    var SETTINGS_KEY = 'BUFF_MANAGER_SETTINGS';
    var MODAL_ID = 'buffManagerModal';
    var BUFF_TYPES = ["ProductivityBuff", "RecruitingBuff", "ProvisionerBuff", "BookbinderBuff", "AreaBuff", "RemoveBuff"];

    // Image caches for instant rendering
    var _buffImgCache = {};
    var _buiImgCache = {};
    var _searchIconHtml = null;

    // Persistent settings
    var config = {
        buffStopped: false, // false = skip stopped buildings; true = buff stopped buildings
        safeMines: true     // true = skip mines that deplete before buff ends
    };

    try {
        if (typeof settings !== 'undefined' && settings.read) {
            var saved = settings.read(null, SETTINGS_KEY);
            if (saved && typeof saved === 'object') {
                if (typeof saved.buffStopped === 'boolean') config.buffStopped = saved.buffStopped;
                if (typeof saved.safeMines === 'boolean') config.safeMines = saved.safeMines;
            }
        }
    } catch (e) {
        debug(e);
    }

    function saveConfig() {
        try {
            if (typeof settings !== 'undefined' && settings.store) {
                settings.store(config, SETTINGS_KEY);
            }
        } catch (e) {
            debug(e);
        }
    }

    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function checkBuffType(type) {
        if (!type) return false;
        for (var i = 0; i < BUFF_TYPES.length; i++) {
            if (type.indexOf(BUFF_TYPES[i]) >= 0) return true;
        }
        return false;
    }

    function formatDuration(seconds) {
        if (!isFinite(seconds) || seconds <= 0) return '0m';
        if (seconds === Infinity) return loca.GetText('LAB', 'All');
        var s = Math.floor(seconds);
        var d = Math.floor(s / 86400);
        var h = Math.floor((s % 86400) / 3600);
        var m = Math.floor((s % 3600) / 60);

        var isRu = (typeof gameLang === 'string' && gameLang.toLowerCase().indexOf('ru') === 0);
        var dStr = isRu ? 'д' : 'd';
        var hStr = isRu ? 'ч' : 'h';
        var mStr = isRu ? 'м' : 'm';

        if (d > 0) return d + dStr + ' ' + (h > 0 ? h + hStr : '');
        if (h > 0) return h + hStr + ' ' + (m > 0 ? (m < 10 ? '0' + m : m) + mStr : '');
        return m + mStr;
    }

    function getBuffImg(buffName, size) {
        size = size || '22px';
        var key = buffName + '_' + size;
        if (!_buffImgCache[key]) {
            try {
                _buffImgCache[key] = getImageTag(buffName, size, size);
            } catch (e) {
                _buffImgCache[key] = '';
            }
        }
        return _buffImgCache[key];
    }

    function getBuiImg(buiName, size) {
        size = size || '22px';
        var key = buiName + '_' + size;
        if (!_buiImgCache[key]) {
            try {
                _buiImgCache[key] = getImageTag(buiName, size, size);
            } catch (e) {
                _buiImgCache[key] = '';
            }
        }
        return _buiImgCache[key];
    }

    // In-game search icon from TSO client SWF assets
    function getInGameSearchIcon(size) {
        size = size || '14px';
        if (_searchIconHtml) return _searchIconHtml;
        try {
            if (typeof game !== 'undefined' && game.def) {
                var cls = game.def("GUI.Assets::gAssetManager_SearchBtnIcon");
                if (cls) {
                    var inst = new cls();
                    if (inst && inst.bitmapData && typeof utils !== 'undefined' && utils.getImage) {
                        _searchIconHtml = utils.getImage(inst.bitmapData, size, size);
                        return _searchIconHtml;
                    }
                }
            }
        } catch (e) {}
        try {
            var tag = getImageTag('accuracy.png', size, size);
            if (tag && tag.indexOf('<img') >= 0) {
                _searchIconHtml = tag;
                return _searchIconHtml;
            }
        } catch (e) {}
        return '';
    }

    // High-end UI styles: maintains native modal window textures while providing styled cards, badges & table
    function injectStyles() {
        $('#buffManagerStyle').remove();
        var css = [
            '#' + MODAL_ID + ' .modal-dialog { width: 940px !important; max-width: 96vw !important; }',
            '#' + MODAL_ID + ' .modal-body { padding: 10px 14px !important; }',

            /* Controls Toolbar with generous margins & spacing */
            '#' + MODAL_ID + ' .be-toolbar { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 12px !important; margin-bottom: 10px !important; background: rgba(22, 14, 7, 0.88) !important; padding: 7px 12px !important; border: 1px solid #4a341b !important; border-radius: 4px !important; }',
            '#' + MODAL_ID + ' .be-btn-group { display: inline-flex !important; align-items: center !important; gap: 10px !important; flex-shrink: 0 !important; }',
            '#' + MODAL_ID + ' .be-toggle-btn { display: inline-flex !important; align-items: center !important; padding: 4px 12px !important; background: #26170c !important; border: 1px solid #5a3c1e !important; color: #cfbda2 !important; border-radius: 4px !important; cursor: pointer !important; font-size: 11.5px !important; font-weight: bold !important; transition: all 0.15s ease !important; user-select: none !important; }',
            '#' + MODAL_ID + ' .be-toggle-btn:hover { background: #3a2312 !important; border-color: #8c6734 !important; color: #ffffff !important; }',
            '#' + MODAL_ID + ' .be-toggle-btn.active { background: #442710 !important; border-color: #bfa158 !important; color: #fae4a7 !important; }',
            
            /* Toggle indicator dot & icon spacing */
            '#' + MODAL_ID + ' .be-toggle-indicator { width: 9px !important; height: 9px !important; border-radius: 50% !important; background: #66503b !important; display: inline-block !important; margin-right: 8px !important; flex-shrink: 0 !important; }',
            '#' + MODAL_ID + ' .be-toggle-btn.active .be-toggle-indicator { background: #4caf50 !important; }',
            '#' + MODAL_ID + ' .be-toggle-icon { display: inline-block !important; margin-right: 6px !important; vertical-align: middle !important; }',
            '#' + MODAL_ID + ' .be-toggle-text { vertical-align: middle !important; }',

            /* Search input with proper icon padding & margin */
            '#' + MODAL_ID + ' .be-search-box { position: relative !important; display: inline-flex !important; align-items: center !important; margin-left: auto !important; }',
            '#' + MODAL_ID + ' .be-search-input { background: #140d06 !important; border: 1px solid #4d351d !important; color: #e8dcc4 !important; border-radius: 4px !important; padding: 4px 10px 4px 28px !important; font-size: 11.5px !important; width: 220px !important; outline: none !important; transition: border-color 0.2s !important; }',
            '#' + MODAL_ID + ' .be-search-input:focus { border-color: #bfa158 !important; }',
            '#' + MODAL_ID + ' .be-search-icon { position: absolute !important; left: 7px !important; top: 50% !important; transform: translateY(-50%) !important; pointer-events: none !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 16px !important; height: 16px !important; }',

            /* Filter Pills & Actions Bar with distinct spacing */
            '#' + MODAL_ID + ' .be-pills-bar { display: flex !important; align-items: center !important; justify-content: space-between !important; margin-bottom: 10px !important; gap: 12px !important; }',
            '#' + MODAL_ID + ' .be-pills { display: inline-flex !important; gap: 6px !important; align-items: center !important; }',
            '#' + MODAL_ID + ' .be-pill { padding: 3px 11px !important; font-size: 11px !important; font-weight: bold !important; border-radius: 12px !important; cursor: pointer !important; background: #221509 !important; border: 1px solid #4a331c !important; color: #bbaa88 !important; user-select: none !important; transition: background 0.15s !important; }',
            '#' + MODAL_ID + ' .be-pill:hover { background: #36210f !important; color: #ffffff !important; }',
            '#' + MODAL_ID + ' .be-pill.active { background: #523315 !important; border-color: #ba8c42 !important; color: #ffebaa !important; }',

            /* Dedicated Action Buttons (Select All / Deselect) with clear margin between each other */
            '#' + MODAL_ID + ' .be-action-btn-group { display: inline-flex !important; align-items: center !important; gap: 10px !important; flex-shrink: 0 !important; }',
            '#' + MODAL_ID + ' .be-action-btn { display: inline-block !important; padding: 4px 12px !important; font-size: 11px !important; font-weight: bold !important; border-radius: 4px !important; cursor: pointer !important; background: #28190d !important; border: 1px solid #5a3c1e !important; color: #d0bba0 !important; user-select: none !important; transition: all 0.15s ease !important; white-space: nowrap !important; line-height: 1.4 !important; }',
            '#' + MODAL_ID + ' .be-action-btn:hover { background: #3e2614 !important; border-color: #9e7438 !important; color: #ffffff !important; }',

            /* Buffs Available / Required Summary */
            '#' + MODAL_ID + ' .be-summary-container { background: rgba(18, 12, 6, 0.75) !important; border: 1px solid #3d2914 !important; border-radius: 4px !important; padding: 6px 10px !important; margin-bottom: 10px !important; display: flex !important; flex-wrap: wrap !important; gap: 8px !important; align-items: center !important; }',
            '#' + MODAL_ID + ' .be-summary-card { display: inline-flex !important; align-items: center !important; gap: 6px !important; background: #24160b !important; border: 1px solid #4a341b !important; border-radius: 4px !important; padding: 3px 8px !important; font-size: 11px !important; color: #dcd0bc !important; }',
            '#' + MODAL_ID + ' .be-summary-card.ok { border-color: #2e6631 !important; }',
            '#' + MODAL_ID + ' .be-summary-card.deficit { border-color: #8c2828 !important; background: #2a1110 !important; }',
            '#' + MODAL_ID + ' .be-count-ok { color: #81c784 !important; font-weight: bold !important; }',
            '#' + MODAL_ID + ' .be-count-deficit { color: #ff7878 !important; font-weight: bold !important; }',

            /* Table Container with Sticky Header */
            '#' + MODAL_ID + ' .be-table-wrap { max-height: 44vh !important; overflow-y: auto !important; border: 1px solid #48321a !important; border-radius: 4px !important; background: rgba(16, 10, 5, 0.88) !important; }',
            '#' + MODAL_ID + ' .be-table { width: 100% !important; margin-bottom: 0 !important; border-collapse: collapse !important; font-size: 11.5px !important; }',
            '#' + MODAL_ID + ' .be-table th { position: sticky !important; top: 0 !important; background: #26170b !important; color: #dfb259 !important; font-weight: bold !important; border-bottom: 2px solid #52371d !important; padding: 6px 8px !important; z-index: 2 !important; user-select: none !important; }',
            '#' + MODAL_ID + ' .be-table td { padding: 5px 8px !important; vertical-align: middle !important; border-top: 1px solid #28190d !important; color: #d8caba !important; }',
            '#' + MODAL_ID + ' .be-table tbody tr:nth-child(even) { background: rgba(255, 255, 255, 0.015) !important; }',
            '#' + MODAL_ID + ' .be-table tbody tr:hover { background: rgba(186, 140, 66, 0.12) !important; }',
            '#' + MODAL_ID + ' .be-table tbody tr.be-row-unchecked { opacity: 0.5 !important; }',

            /* Badges / Плашки */
            '#' + MODAL_ID + ' .be-badge { display: inline-block !important; padding: 2px 7px !important; font-size: 10.5px !important; font-weight: bold !important; border-radius: 3px !important; text-align: center !important; white-space: nowrap !important; line-height: 1.3 !important; }',
            '#' + MODAL_ID + ' .be-badge-ready { background: #256b29 !important; color: #ffffff !important; }',
            '#' + MODAL_ID + ' .be-badge-buffed { background: #37474f !important; color: #cfd8dc !important; }',
            '#' + MODAL_ID + ' .be-badge-stopped { background: #965b05 !important; color: #ffffff !important; }',
            '#' + MODAL_ID + ' .be-badge-unsafe { background: #b73229 !important; color: #ffffff !important; }',
            '#' + MODAL_ID + ' .be-badge-error { background: #a32222 !important; color: #ffffff !important; }',
            '#' + MODAL_ID + ' .be-badge-lvl { background: #2d1c0e !important; color: #dfb259 !important; border: 1px solid #5a3c1e !important; border-radius: 3px !important; padding: 1px 4px !important; font-size: 10px !important; margin-left: 4px !important; font-weight: bold !important; }',

            /* Action Buttons & GoTo Icon */
            '#' + MODAL_ID + ' .be-goto-btn { cursor: pointer !important; opacity: 0.85 !important; transition: transform 0.15s ease !important; vertical-align: middle !important; display: inline-block !important; }',
            '#' + MODAL_ID + ' .be-goto-btn:hover { opacity: 1 !important; transform: scale(1.15) !important; }',
            '#' + MODAL_ID + ' .be-del-btn { background: transparent !important; border: none !important; color: #a84848 !important; font-size: 16px !important; font-weight: bold !important; cursor: pointer !important; padding: 0 4px !important; line-height: 1 !important; float: right !important; }',
            '#' + MODAL_ID + ' .be-del-btn:hover { color: #ff5252 !important; transform: scale(1.2) !important; }',

            /* Checkbox */
            '#' + MODAL_ID + ' input[type="checkbox"] { cursor: pointer !important; width: 14px !important; height: 14px !important; margin: 0 !important; vertical-align: middle !important; }',

            /* Template tag in header */
            '#' + MODAL_ID + ' .be-template-tag { font-size: 12px !important; font-weight: normal !important; color: #e2ba5e !important; background: #28180c !important; border: 1px solid #583b1d !important; padding: 2px 8px !important; border-radius: 3px !important; margin-left: 10px !important; }',

            /* Scrollbar */
            '#' + MODAL_ID + ' .be-table-wrap::-webkit-scrollbar { width: 5px; }',
            '#' + MODAL_ID + ' .be-table-wrap::-webkit-scrollbar-thumb { background: #5a3e20; border-radius: 7px; }',
            '#' + MODAL_ID + ' .be-table-wrap::-webkit-scrollbar-thumb:hover { background: #7d572d; }'
        ];
        $('<style>', { id: 'buffManagerStyle' }).text(css.join('\n')).appendTo('head');
    }

    // Main runtime state
    var bmRecord = null;
    var bmRecordEnabled = false;
    var bmTemplates = null;
    var buffVector = [];
    var buffStacks = {};
    var selectedGrids = {}; // grid -> boolean
    var currentFilter = 'all'; // 'all', 'ready', 'stopped', 'mines'
    var searchQuery = '';
    var lastRowData = [];
    var currentTemplateName = '';

    // Mine depletion calculation vs cycle time
    function getMineDepletion(bui, grid) {
        try {
            var zone = game.gi.mCurrentPlayerZone;
            if (!zone || !zone.mStreetDataMap) return null;
            var deposit = zone.mStreetDataMap.mDepositContainer ? zone.mStreetDataMap.mDepositContainer.get(Number(grid)) : null;
            if (!deposit) return null;

            var bldName = bui.GetBuildingName_string();
            if (bldName.indexOf('Endless') >= 0) {
                return { isMine: true, isEndless: true, secondsLeft: Infinity, resLeft: Infinity };
            }

            var resLeft = deposit.GetAmount();
            var cycleMs = bui.CalculateWays ? bui.CalculateWays() : 0;
            var cycleSec = isFinite(cycleMs) && cycleMs > 0 ? cycleMs / 1000 : 0;

            var gEconomics = swmmo.getDefinitionByName('ServerState::gEconomics');
            var rcd = gEconomics ? gEconomics.GetResourcesCreationDefinitionForBuilding(bldName) : null;
            var amountRemoved = rcd ? rcd.amountRemoved : 1;
            var inputFactor = bui.GetResourceInputFactor ? bui.GetResourceInputFactor() : (bui.GetUpgradeLevel ? bui.GetUpgradeLevel() : 1);
            var totalRemoved = inputFactor * amountRemoved;

            var secondsLeft = (cycleSec > 0 && totalRemoved > 0 && resLeft > 0)
                ? (resLeft * cycleSec) / totalRemoved
                : (resLeft <= 0 ? 0 : Infinity);

            return {
                isMine: true,
                isEndless: false,
                resLeft: resLeft,
                secondsLeft: secondsLeft,
                cycleSec: cycleSec,
                totalRemoved: totalRemoved
            };
        } catch (e) {
            return null;
        }
    }

    // Get buff duration in ms (handles home zone vs friend zone)
    function getBuffDurationMs(buffName, isFriendZone) {
        var app = isFriendZone ? 1 : 0;
        try {
            if (buffVector && buffVector.length) {
                for (var i = 0; i < buffVector.length; i++) {
                    var it = buffVector[i];
                    if (it && it.GetBuffDefinition && it.GetBuffDefinition().GetName_string() === buffName) {
                        var d = it.GetBuffDefinition().getDuration(app);
                        if (isFinite(d) && d > 0) return d;
                    }
                }
            }
            var globalDef = swmmo.getDefinitionByName('global');
            if (globalDef && globalDef.map_BuffName_BuffDefinition) {
                var bd = globalDef.map_BuffName_BuffDefinition[buffName];
                if (bd && bd.getDuration) {
                    var d2 = bd.getDuration(app);
                    if (isFinite(d2) && d2 > 0) return d2;
                }
            }
        } catch (e) {}
        return 0;
    }

    // Multi-stack buff pooling from star menu
    function refreshBuffStacks() {
        buffStacks = {};
        try {
            buffVector = game.gi.mCurrentPlayer.getAvailableBuffs_vector();
            if (buffVector && buffVector.length) {
                buffVector.forEach(function (item) {
                    if (!item || !item.GetBuffDefinition || !item.GetAmount) return;
                    var bName = item.GetBuffDefinition().GetName_string();
                    var amt = item.GetAmount();
                    if (amt <= 0) return;

                    var uId = item.GetUniqueId();
                    var idStr = uId.uniqueID1 + '_' + uId.uniqueID2;

                    if (!buffStacks[bName]) buffStacks[bName] = [];
                    buffStacks[bName].push({ id: idStr, count: amt });
                });
            }
        } catch (e) {
            debug(e);
        }
    }

    function getAvailableBuffTotal(buffName) {
        if (!buffStacks[buffName]) return 0;
        var total = 0;
        buffStacks[buffName].forEach(function (s) { total += s.count; });
        return total;
    }

    function getBuffPacket(buffId, grid) {
        try {
            var uniqueIdArr = buffId.split('_'),
                uniqueID = game.def('Communication.VO::dUniqueID').Create(uniqueIdArr[0], uniqueIdArr[1]);
            return game.def('Communication.VO::dServerAction').createForCommand(61, 0, grid, 0, uniqueID);
        } catch (ex) {
            debug(ex);
            return null;
        }
    }

    // Analyze building and calculate status using strictly native texts and classes
    function analyzeRow(data, isZoneRight) {
        var grid = Number(data.buiGrid);
        var bui = null;
        try {
            bui = game.zone.GetBuildingFromGridPosition(grid);
        } catch (e) {}

        var info = {
            data: data,
            grid: grid,
            bui: bui,
            buiName: data.buiName,
            buffName: data.buffName,
            level: bui ? (bui.GetUIUpgradeLevel ? bui.GetUIUpgradeLevel() : bui.GetUpgradeLevel()) : 0,
            status: 'buff_ready',
            statusText: getText('buff_ready'),
            badgeClass: 'be-badge-ready',
            isMine: false,
            isEndless: false,
            isStopped: false,
            isUnsafeMine: false,
            canBuff: false,
            timeHtml: '',
            tooltipText: ''
        };

        if (!isZoneRight) {
            info.status = 'buff_wrong_zone';
            info.statusText = getText('buff_wrong_zone');
            info.badgeClass = 'be-badge-error';
            return info;
        }

        if (!bui) {
            info.status = 'buff_not_exist';
            info.statusText = getText('buff_not_exist');
            info.badgeClass = 'be-badge-error';
            return info;
        }

        if (bui.GetBuildingName_string() !== data.buiName) {
            info.status = 'buff_wrong_name';
            info.statusText = getText('buff_wrong_name');
            info.badgeClass = 'be-badge-error';
            return info;
        }

        // Active buff check
        var clientNow = game.gi.GetClientTime();
        var pb = bui.productionBuff;
        if (pb && pb.IsActive && pb.IsActive(clientNow)) {
            var pbDef = pb.GetBuffDefinition();
            if (pbDef && checkBuffType(pbDef.GetName_string())) {
                info.status = 'buff_buffed';
                info.statusText = getText('buff_buffed');
                info.badgeClass = 'be-badge-buffed';

                var remMs = (pb.GetStartTime() + pbDef.getDuration(pb.GetApplicanceMode())) - clientNow;
                if (remMs > 0) {
                    info.timeHtml = '<span style="color:#90caf9;">' + formatDuration(remMs / 1000) + '</span>';
                    info.tooltipText = getText('buff_buffed') + ': ' + formatDuration(remMs / 1000);
                }
            }
        }

        // RemoveBuff check
        if (data.buffName.indexOf('RemoveBuff') >= 0) {
            if (info.status === 'buff_buffed') {
                info.status = 'buff_ready';
                info.statusText = getText('buff_ready');
                info.badgeClass = 'be-badge-ready';
            } else {
                info.status = 'buff_not_buffed';
                info.statusText = getText('buff_not_buffed');
                info.badgeClass = 'be-badge-buffed';
            }
        }

        if (info.status !== 'buff_ready') return info;

        // Stopped / Sleeping check
        var isWorking = bui.IsProductionActive && bui.IsProductionActive() &&
            (!bui.IsUpgradeInProgress || !bui.IsUpgradeInProgress()) &&
            (!bui.GetResourceCreation || bui.GetResourceCreation() == null || bui.GetResourceCreation().GetProductionState() === 0);

        info.isStopped = !isWorking;

        if (info.isStopped && !config.buffStopped) {
            info.status = 'buff_notactive';
            info.statusText = getText('buff_notactive');
            info.badgeClass = 'be-badge-stopped';
            info.timeHtml = '<span style="color:#ffa726;">' + getText('buff_notactive') + '</span>';
            return info;
        }

        // Mine depletion check
        var mine = getMineDepletion(bui, grid);
        if (mine) {
            info.isMine = true;
            info.isEndless = mine.isEndless;

            if (mine.isEndless) {
                info.timeHtml = '<span style="color:#81c784;">' + loca.GetText('LAB', 'All') + '</span>';
            } else {
                var isFriend = (bmRecord && bmRecord.zoneId !== game.player.getPlayerID()) || !game.gi.isOnHomzone();
                var buffDurMs = getBuffDurationMs(data.buffName, isFriend);
                var buffDurSec = buffDurMs / 1000;

                var depStr = formatDuration(mine.secondsLeft);
                var buffStr = formatDuration(buffDurSec);

                if (buffDurSec > 0 && mine.secondsLeft < buffDurSec) {
                    info.isUnsafeMine = true;
                    info.timeHtml = '<span style="color:#ff6b6b;font-weight:bold;" title="' + esc(loca.GetText('LAB', 'DepositDepleted')) + '">! ' + depStr + ' &lt; ' + buffStr + '</span>';
                    info.tooltipText = loca.GetText('LAB', 'DepositDepleted');

                    if (config.safeMines) {
                        info.status = 'buff_mine_unsafe';
                        info.statusText = loca.GetText('LAB', 'DepositDepleted');
                        info.badgeClass = 'be-badge-unsafe';
                        return info;
                    }
                } else {
                    info.timeHtml = '<span style="color:#81c784;">' + depStr + ' / ' + buffStr + '</span>';
                }
            }
        } else if (info.isStopped) {
            info.timeHtml = '<span style="color:#ffa726;">' + getText('buff_notactive') + '</span>';
        }

        info.canBuff = true;
        return info;
    }

    // Open main window
    function openBuffManagerWindow(event) {
        injectStyles();
        $('div[role="dialog"]:not(#' + MODAL_ID + '):visible').modal('hide');
        createModalWindow(MODAL_ID, getImageTag('ProductivityBuffLvl3', '45px') + ' ' + loca.GetText('LAB', 'Buffs'));

        bmTemplates = new SaveLoadTemplate('buff', function (data, name) {
            currentTemplateName = name || '';
            bmRecord = data;
            selectedGrids = {};
            renderModal();
        });

        // Initialize modal footer buttons once
        if ($('#' + MODAL_ID + ' .bmSaveTemplate').length === 0) {
            $('#' + MODAL_ID + ' .modal-footer').prepend([
                $('<button>').attr({ 'class': 'btn btn-warning bmReset' }).text(getText('btn_reset')),
                $('<button>').attr({ 'class': 'btn btn-success bmSubmit' }).text(getText('btn_submit')),
                $('<button>').attr({ 'class': 'btn btn-primary pull-left bmSaveTemplate' }).text(getText('save_template')),
                $('<button>').attr({ 'class': 'btn btn-primary pull-left bmLoadTemplate' }).text(getText('load_template'))
            ]);

            $('#' + MODAL_ID + ' .bmSaveTemplate').click(function () {
                if (bmRecord) bmTemplates.save(bmRecord);
            });
            $('#' + MODAL_ID + ' .bmLoadTemplate').click(function () {
                bmTemplates.load();
            });
            $('#' + MODAL_ID + ' .bmReset').click(function () {
                bmRecord = null;
                currentTemplateName = '';
                selectedGrids = {};
                renderModal();
            });
            $('#' + MODAL_ID + ' .bmSubmit').click(executeBuffJobs);
        }

        renderModal();
        $('#' + MODAL_ID + ':not(:visible)').modal({ backdrop: 'static' });
    }

    // Render modal contents based on current state
    function renderModal() {
        var $modal = $('#' + MODAL_ID);
        var $body = $('#' + MODAL_ID + 'Data');

        // Update modal title with template name if loaded
        var titleHtml = getImageTag('ProductivityBuffLvl3', '45px') + ' ' + loca.GetText('LAB', 'Buffs');
        if (currentTemplateName) {
            titleHtml += ' <span class="be-template-tag">' + esc(loca.GetText('LAB', 'AvatarCurrentSelection') + ': ' + currentTemplateName) + '</span>';
        }
        $modal.find('.modal-title').html(titleHtml);

        $('.bmSubmit, .bmReset, .bmSaveTemplate').attr('disabled', true);

        // State 1: Welcome / Empty
        if (!bmRecordEnabled && bmRecord == null) {
            var welcomeHtml = '<div class="container-fluid">' +
                '<p><strong>' + getText('buff_welcome') + '</strong></p>' +
                getText('buff_welcome_block') + '<br>' +
                '<button type="button" class="btn btn-primary btn-lg btn-block" id="bmStartRec">' + getText('buff_start_record') + '</button>' +
                '</div>';
            $body.html(welcomeHtml);

            $('#bmStartRec').off('click').on('click', startRecording);
            return;
        }

        // State 2: Recording in progress
        if (bmRecordEnabled) {
            var recCount = (bmRecord && bmRecord.data) ? bmRecord.data.length : 0;
            var recHtml = '<div class="container-fluid">' +
                '<h3 class="text-center">' + getText('buff_rec_progress') + '</h3>' +
                '<p class="text-center" style="font-size:14px;margin:15px 0;">' +
                loca.GetText('LAB', 'Buffs') + ': <strong>' + recCount + '</strong>' +
                '</p>' +
                '<button type="button" class="btn btn-primary btn-lg btn-block" id="bmStopRec">' + getText('buff_stop_record') + '</button>' +
                '</div>';
            $body.html(recHtml);

            $('#bmStopRec').off('click').on('click', stopRecording);
            return;
        }

        // State 3: Template loaded / recorded
        refreshBuffStacks();

        var isZoneRight = (bmRecord && bmRecord.zoneId === game.gi.mCurrentViewedZoneID);
        var rows = [];
        var neededCounts = {};

        if (bmRecord && bmRecord.data && bmRecord.data.length) {
            bmRecord.data.forEach(function (item) {
                var row = analyzeRow(item, isZoneRight);
                rows.push(row);
                if (selectedGrids[row.grid] === undefined) {
                    selectedGrids[row.grid] = (row.status === 'buff_ready');
                }
                if (selectedGrids[row.grid]) {
                    neededCounts[row.buffName] = (neededCounts[row.buffName] || 0) + 1;
                }
            });
        }
        lastRowData = rows;

        // Toolbar HTML: Toggle Buttons & Search (with proper margins, in-game icons, and indicator spacing)
        var stoppedLabel = getText('buffactive_desc') + ': ' + (config.buffStopped ? getText('buffall') : getText('buffonlyactive'));
        var safeMineLabel = loca.GetText('BUI', 'BuildingMountainOre') + ' (' + loca.GetText('LAB', 'Expires') + '): ' + (config.safeMines ? loca.GetText('LAB', 'Yes') : loca.GetText('LAB', 'No'));

        var sleepIconTag = getImageTag('BuildingSleepMode', '16px', '16px');
        var mineIconTag = getImageTag('BuildingMountainOre', '16px', '16px');
        var searchIconImg = getInGameSearchIcon('14px');

        var toolbarHtml = '<div class="be-toolbar">' +
            '<div class="be-btn-group">' +
            '<button type="button" class="be-toggle-btn ' + (config.buffStopped ? 'active' : '') + '" id="bmToggleStopped" title="' + esc(getText('buffactive_desc')) + '">' +
            '<span class="be-toggle-indicator"></span>' +
            '<span class="be-toggle-icon">' + sleepIconTag + '</span>' +
            '<span class="be-toggle-text">' + esc(stoppedLabel) + '</span>' +
            '</button>' +
            '<button type="button" class="be-toggle-btn ' + (config.safeMines ? 'active' : '') + '" id="bmToggleSafeMines" title="' + esc(loca.GetText('LAB', 'DepositDepleted')) + '">' +
            '<span class="be-toggle-indicator"></span>' +
            '<span class="be-toggle-icon">' + mineIconTag + '</span>' +
            '<span class="be-toggle-text">' + esc(safeMineLabel) + '</span>' +
            '</button>' +
            '</div>' +
            '<div class="be-search-box">' +
            '<span class="be-search-icon">' + searchIconImg + '</span>' +
            '<input type="text" class="be-search-input" id="bmSearchInput" placeholder="' + esc(loca.GetText('LAB', 'Name')) + ' / ' + esc(loca.GetText('LAB', 'Buff')) + '..." value="' + esc(searchQuery) + '">' +
            '</div>' +
            '</div>';

        // Filter Pills & Action Buttons Bar (with distinct spacing between Select All and Reset)
        var readyCount = rows.filter(function (r) { return r.status === 'buff_ready'; }).length;
        var stoppedCount = rows.filter(function (r) { return r.isStopped; }).length;
        var minesCount = rows.filter(function (r) { return r.isMine; }).length;

        var selectAllText = loca.GetText('LAB', 'Select') + ' ' + loca.GetText('LAB', 'All');
        var deselectText = getText('btn_reset');

        var pillsHtml = '<div class="be-pills-bar">' +
            '<div class="be-pills">' +
            '<span class="be-pill ' + (currentFilter === 'all' ? 'active' : '') + '" data-filter="all">' + esc(getText('buffall')) + ' (' + rows.length + ')</span>' +
            '<span class="be-pill ' + (currentFilter === 'ready' ? 'active' : '') + '" data-filter="ready">' + esc(getText('buff_ready')) + ' (' + readyCount + ')</span>' +
            '<span class="be-pill ' + (currentFilter === 'stopped' ? 'active' : '') + '" data-filter="stopped">' + esc(getText('buff_notactive')) + ' (' + stoppedCount + ')</span>' +
            '<span class="be-pill ' + (currentFilter === 'mines' ? 'active' : '') + '" data-filter="mines">' + esc(loca.GetText('LAB', 'Miner')) + ' (' + minesCount + ')</span>' +
            '</div>' +
            '<div class="be-action-btn-group">' +
            '<span class="be-action-btn" id="bmSelectAll">' + esc(selectAllText) + '</span>' +
            '<span class="be-action-btn" id="bmDeselectAll">' + esc(deselectText) + '</span>' +
            '</div>' +
            '</div>';

        // Used Buffs Summary (Requires vs Available in Star Menu)
        var summaryHtml = '<div class="be-summary-container" id="bmSummaryBox">';
        var hasBuffs = false;
        for (var bName in neededCounts) {
            hasBuffs = true;
            var need = neededCounts[bName];
            var avail = getAvailableBuffTotal(bName);
            var isOk = (avail >= need);
            var cardClass = isOk ? 'ok' : 'deficit';
            var countClass = isOk ? 'be-count-ok' : 'be-count-deficit';

            summaryHtml += '<div class="be-summary-card ' + cardClass + '" title="' + esc(loca.GetText('RES', bName)) + '">' +
                getBuffImg(bName, '20px') + ' ' +
                '<span>' + esc(loca.GetText('RES', bName)) + '</span> ' +
                '<span class="' + countClass + '">' + need + ' / ' + avail + '</span>' +
                '</div>';
        }
        if (!hasBuffs) {
            summaryHtml += '<span style="color:#9e8b70;font-size:11px;">' + esc(getText('NoData')) + '</span>';
        }
        summaryHtml += '</div>';

        // Filter Rows
        var filteredRows = rows.filter(function (r) {
            if (currentFilter === 'ready' && r.status !== 'buff_ready') return false;
            if (currentFilter === 'stopped' && !r.isStopped) return false;
            if (currentFilter === 'mines' && !r.isMine) return false;

            if (searchQuery) {
                var q = searchQuery.toLowerCase();
                var bNameLoc = loca.GetText('BUI', r.buiName).toLowerCase();
                var buffLoc = loca.GetText('RES', r.buffName).toLowerCase();
                if (bNameLoc.indexOf(q) === -1 && buffLoc.indexOf(q) === -1 && String(r.grid).indexOf(q) === -1) {
                    return false;
                }
            }
            return true;
        });

        // Building Rows with Sticky Header
        var allChecked = filteredRows.length > 0 && filteredRows.every(function (r) { return selectedGrids[r.grid]; });
        var rowsHtml = '<div class="be-table-wrap"><table class="be-table" id="bmMainTable">' +
            '<thead>' +
            '<tr>' +
            '<th style="width:30px;text-align:center;"><input type="checkbox" id="bmMasterCheckboxTh" ' + (allChecked ? 'checked' : '') + ' title="' + esc(selectAllText) + '"></th>' +
            '<th style="width:34px;text-align:center;">#</th>' +
            '<th style="width:230px;">' + esc(loca.GetText('LAB', 'Name')) + '</th>' +
            '<th style="width:190px;">' + esc(loca.GetText('LAB', 'Buff')) + '</th>' +
            '<th style="width:190px;">' + esc(loca.GetText('LAB', 'ProductionStatus')) + '</th>' +
            '<th style="width:140px;">' + esc(loca.GetText('LAB', 'Status')) + '</th>' +
            '<th style="width:30px;text-align:center;"></th>' +
            '</tr>' +
            '</thead>' +
            '<tbody>';

        if (filteredRows.length === 0) {
            rowsHtml += '<tr><td colspan="7" style="text-align:center;padding:25px;color:#9e8b70;">' + esc(getText('NoData')) + '</td></tr>';
        } else {
            filteredRows.forEach(function (r) {
                var isChecked = !!selectedGrids[r.grid];
                var rowClass = isChecked ? '' : 'be-row-unchecked';

                var buiImg = getBuiImg(r.buiName, '22px');
                var buffImg = getBuffImg(r.buffName, '22px');
                var bNameLoc = loca.GetText('BUI', r.buiName);
                if (bNameLoc.indexOf('[undefined text]') >= 0) bNameLoc = r.buiName;
                var buffLoc = loca.GetText('RES', r.buffName);

                var sleepIcon = r.isStopped ? ' <span title="' + esc(getText('buff_notactive')) + '" style="vertical-align:middle;margin-left:3px;">' + getImageTag('BuildingSleepMode', '15px', '15px') + '</span>' : '';
                var levelBadge = r.level > 0 ? '<span class="be-badge-lvl">lvl ' + r.level + '</span>' : '';

                var gotoIconHtml = getImageTag('accuracy.png', '18px', '18px')
                    .replace('<img', '<img class="be-goto-btn" data-grid="' + r.grid + '" title="' + esc(loca.GetText('LAB', 'Visit')) + '"');

                var timeContent = r.timeHtml || (r.canBuff ? ('<span style="color:#81c784;">' + esc(getText('buff_ready')) + '</span>') : ('<span style="color:#ffa726;">' + esc(getText('buff_notactive')) + '</span>'));

                rowsHtml += '<tr class="' + rowClass + '" data-grid="' + r.grid + '">' +
                    '<td style="text-align:center;"><input type="checkbox" class="be-row-cb" data-grid="' + r.grid + '" ' + (isChecked ? 'checked' : '') + '></td>' +
                    '<td style="text-align:center;">' + gotoIconHtml + '</td>' +
                    '<td>' + buiImg + ' ' + esc(bNameLoc) + levelBadge + sleepIcon + '</td>' +
                    '<td>' + buffImg + ' ' + esc(buffLoc) + '</td>' +
                    '<td>' + timeContent + '</td>' +
                    '<td><span class="be-badge ' + r.badgeClass + '" title="' + esc(r.tooltipText || '') + '">' + esc(r.statusText) + '</span></td>' +
                    '<td style="text-align:center;"><button type="button" class="be-del-btn" data-grid="' + r.grid + '" title="' + esc(loca.GetText('LAB', 'Close')) + '">&times;</button></td>' +
                    '</tr>';
            });
        }

        rowsHtml += '</tbody></table></div>';

        // Zone Info & Mismatch Warning
        var zoneNoticeHtml = '';
        if (bmRecord && bmRecord.zoneUser) {
            zoneNoticeHtml += '<p style="margin-top:6px;font-size:11px;color:#bbaa88;">' + getText('buff_zoneowner') + ' ' + esc(bmRecord.zoneUser) + '</p>';
        }
        if (!isZoneRight) {
            zoneNoticeHtml += '<p style="color:#ff6b6b;font-weight:bold;">' + getText('buff_not_your_zone') + '</p>';
        }

        // Bottom "Record More" button
        var recordMoreHtml = '<div style="margin-top:8px;">' +
            '<button type="button" class="btn btn-primary btn-block" id="bmRecordMore">' + getText('buff_record_more') + '</button>' +
            '</div>';

        // Assemble body
        $body.html('<div class="container-fluid">' +
            toolbarHtml +
            pillsHtml +
            summaryHtml +
            zoneNoticeHtml +
            rowsHtml +
            recordMoreHtml +
            '</div>');

        // Enable footer buttons
        $('.bmReset, .bmSaveTemplate').attr('disabled', false);

        var totalSelected = 0;
        rows.forEach(function (r) { if (selectedGrids[r.grid]) totalSelected++; });
        if (totalSelected > 0 && isZoneRight) {
            $('.bmSubmit').attr('disabled', false).text(getText('btn_submit') + ' (' + totalSelected + ')');
        } else {
            $('.bmSubmit').attr('disabled', true).text(getText('btn_submit'));
        }

        bindEvents();
    }

    // Attach event listeners
    function bindEvents() {
        var $modal = $('#' + MODAL_ID);

        // Toggle: Buff Stopped
        $('#bmToggleStopped').off('click').on('click', function () {
            config.buffStopped = !config.buffStopped;
            saveConfig();
            if (lastRowData) {
                lastRowData.forEach(function (r) {
                    if (r.isStopped) {
                        selectedGrids[r.grid] = config.buffStopped;
                    }
                });
            }
            renderModal();
        });

        // Toggle: Safe Mine Buffing
        $('#bmToggleSafeMines').off('click').on('click', function () {
            config.safeMines = !config.safeMines;
            saveConfig();
            if (lastRowData) {
                lastRowData.forEach(function (r) {
                    if (r.isUnsafeMine) {
                        selectedGrids[r.grid] = !config.safeMines;
                    }
                });
            }
            renderModal();
        });

        // Filter Pills
        $modal.find('.be-pill').off('click').on('click', function () {
            currentFilter = $(this).attr('data-filter') || 'all';
            renderModal();
        });

        // Select All Button
        $('#bmSelectAll').off('click').on('click', function () {
            if (lastRowData) {
                lastRowData.forEach(function (r) {
                    if (r.status === 'buff_ready' || (config.buffStopped && r.isStopped) || (!config.safeMines && r.isUnsafeMine)) {
                        selectedGrids[r.grid] = true;
                    }
                });
            }
            renderModal();
        });

        // Deselect All Button
        $('#bmDeselectAll').off('click').on('click', function () {
            if (lastRowData) {
                lastRowData.forEach(function (r) {
                    selectedGrids[r.grid] = false;
                });
            }
            renderModal();
        });

        // Search Input (debounced)
        var searchTimer = null;
        $('#bmSearchInput').off('input').on('input', function () {
            var val = $(this).val();
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                searchQuery = val.trim();
                renderModal();
                var $in = $('#bmSearchInput');
                $in.focus();
                var len = $in.val().length;
                if ($in[0] && $in[0].setSelectionRange) $in[0].setSelectionRange(len, len);
            }, 250);
        });

        // Master Checkbox
        $('#bmMasterCheckboxTh').off('change').on('change', function () {
            var checked = $(this).is(':checked');
            $modal.find('.be-row-cb').each(function () {
                var grid = $(this).attr('data-grid');
                selectedGrids[grid] = checked;
            });
            renderModal();
        });

        // Individual Row Checkbox
        $modal.find('.be-row-cb').off('change').on('change', function () {
            var grid = $(this).attr('data-grid');
            selectedGrids[grid] = $(this).is(':checked');
            renderModal();
        });

        // Camera GoTo Button
        $modal.find('.be-goto-btn').off('click').on('click', function () {
            var grid = Number($(this).attr('data-grid'));
            try {
                $modal.modal('hide');
                if (game.zone && game.zone.ScrollToGrid) {
                    game.zone.ScrollToGrid(grid);
                } else if (swmmo.application.mGameInterface.mCurrentPlayerZone) {
                    swmmo.application.mGameInterface.mCurrentPlayerZone.ScrollToGrid(grid);
                }
            } catch (e) {
                debug(e);
            }
        });

        // Delete Row Button (remove from template)
        $modal.find('.be-del-btn').off('click').on('click', function (e) {
            e.stopPropagation();
            var grid = Number($(this).attr('data-grid'));
            if (bmRecord && bmRecord.data) {
                bmRecord.data = bmRecord.data.filter(function (it) { return Number(it.buiGrid) !== grid; });
                delete selectedGrids[grid];
                if (bmRecord.data.length === 0) {
                    bmRecord = null;
                    currentTemplateName = '';
                }
            }
            renderModal();
        });

        // Record More Button
        $('#bmRecordMore').off('click').on('click', startRecording);
    }

    // Recording operations
    var bmEventTracker = game.getTracker('buff', bmBuffAppliedHandler);

    function bmBuffAppliedHandler(event) {
        if (!bmRecordEnabled) return;
        if (event.data.buffOwnerID != game.player.getPlayerID()) return;
        if (!checkBuffType(event.data.buff.GetType())) {
            showGameAlert(getText('buff_not_recorded') + event.data.buff.GetType());
            return;
        }

        if (bmRecord == null) {
            var zoneUser = game.player.GetPlayerName_string();
            if (game.gi.isOnHomzone() == false) {
                try {
                    zoneUser = globalFlash.gui.mFriendsList.GetFriendById(game.gi.mCurrentViewedZoneID).username;
                } catch (e) {
                    zoneUser = globalFlash.gui.mFriendsList.GetGuildMemberById(game.gi.mCurrentViewedZoneID).username;
                }
            }
            bmRecord = {
                zoneId: game.gi.mCurrentViewedZoneID,
                zoneUser: zoneUser,
                data: []
            };
        } else {
            if (game.gi.mCurrentViewedZoneID != bmRecord.zoneId) return;
            if ($.grep(bmRecord.data, function (e) { return e.buiGrid == event.data.target.GetGrid(); }).length > 0) return;
        }

        bmRecord.data.push({
            buffName: event.data.buff.GetBuffDefinition().GetName_string(),
            buiGrid: event.data.target.GetGrid(),
            buiName: event.data.target.GetBuildingName_string()
        });
    }

    function startRecording() {
        $('#' + MODAL_ID).modal('hide');
        game.showAlert(getText('buff_rec_start'));
        bmRecordEnabled = true;
        game.gi.channels.BUFF.addPropertyObserver('buffApplied', bmEventTracker);
    }

    function stopRecording() {
        bmRecordEnabled = false;
        game.showAlert(getText('buff_rec_stop'));
        game.gi.channels.BUFF.removePropertyObserver('buffApplied', bmEventTracker);
        openBuffManagerWindow(null);
    }

    // Buff applicator with multi-stack star menu resolution
    function executeBuffJobs() {
        if (!bmRecord || !bmRecord.data) return;

        refreshBuffStacks();

        var tasks = [];
        var missingCount = 0;
        var selectedItems = [];

        lastRowData.forEach(function (r) {
            if (selectedGrids[r.grid]) {
                selectedItems.push(r);
            }
        });

        if (!selectedItems.length) return;

        // Clone available stacks for consumption
        var workingStacks = {};
        for (var k in buffStacks) {
            workingStacks[k] = buffStacks[k].map(function (s) {
                return { id: s.id, count: s.count };
            });
        }

        selectedItems.forEach(function (item) {
            var buffName = item.buffName;
            var grid = item.grid;
            var allocatedId = null;

            if (workingStacks[buffName]) {
                for (var i = 0; i < workingStacks[buffName].length; i++) {
                    if (workingStacks[buffName][i].count > 0) {
                        workingStacks[buffName][i].count--;
                        allocatedId = workingStacks[buffName][i].id;
                        break;
                    }
                }
            }

            if (allocatedId) {
                var packet = getBuffPacket(allocatedId, grid);
                if (packet) tasks.push(packet);
            } else {
                missingCount++;
            }
        });

        if (tasks.length > 0) {
            var queue = new TimedQueue(1000);
            tasks.forEach(function (task) {
                queue.addTask(task);
            });
            queue.run();

            $('#' + MODAL_ID).modal('hide');
            game.showAlert(getText('command_sent'));
        }
    }

    // Register Menu Item under Tools (Инструменты)
    addToolsMenuItem(loca.GetText('LAB', 'Buffs') + ' (Manager)', openBuffManagerWindow);

    // Global debug export
    window.__BUFF_MANAGER__ = {
        version: '1.3.0',
        config: config,
        open: openBuffManagerWindow,
        refresh: renderModal
    };

})();
