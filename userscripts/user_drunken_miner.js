// language=JavaScript; ECMAScript 5.1
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////Created by MadFX | Thanks for PiTi for source code. ////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
(function () {
    const SCRIPT_PREFIX    = 'DM_';
    const DM_MaxUpgradeLvl = 7;
    const RESOURCES = {
        ores: ["BronzeOre", "IronOre", "Coal", "GoldOre", "TitaniumOre", "Salpeter"],
        oreOrder: {
            BronzeOre: 1, IronOre: 2, Coal: 3, GoldOre: 4, TitaniumOre: 5, Salpeter: 6
        },
        mines: [
            "BronzeMine", "EpicBronzeMine", "BronzeMineEndless",
            "IronMine", "EpicIronMine", "ArcticIronMine",
            "CoalMine", "EpicCoalMine",
            "GoldMine", "EpicGoldMine",
            "TitaniumMine", "EpicTitaniumMine", "ArcticTitaniumMine",
            "SalpeterMine", "EpicSalpeterMine",
            "IronMineEndless", "CoalMineEndless", "GoldMineEndless", "ArcticGoldMine"
        ],
        // Улучшаемые шахты (gfx_settings: BuildingUpgradeBonuses уровни 0..7).
        // Epic*, Arctic*, SpookyBronzeMine имеют только уровень 1 — не улучшаются.
        upgradableMines: [
            "BronzeMine", "IronMine", "CoalMine", "GoldMine", "TitaniumMine", "SalpeterMine",
            "BronzeMineEndless", "IronMineEndless", "CoalMineEndless", "GoldMineEndless"
        ],
        assertNames: [
            "IronOre", "Coal", "BronzeOre", "GoldOre", "TitaniumOre", "Salpeter", "MineDepletedDepositIronOre",
            "MineDepletedDepositCoal", "MineDepletedDepositBronzeOre", "MineDepletedDepositGoldOre",
            "MineDepletedDepositTitaniumOre", "MineDepletedDepositSalpeter", "MineDepletedDepositGoldOreIndustrial",
            "MineDepletedDepositIronOreIndustrial"
        ],
        icons: {
            IronOre: 'ButtonIconIron',
            Coal: 'ButtonIconCoal',
            BronzeOre: 'ButtonIconBronze',
            GoldOre: 'ButtonIconGold',
            TitaniumOre: 'ButtonIconTitanium',
            Salpeter: 'ButtonIconSalpeter'
        },
        buildMapping: {
            IronOre: {number: 50, text: "IronOre"},
            Coal: {number: 37, text: "Coal"},
            BronzeOre: {number: 36, text: "BronzeOre"},
            GoldOre: {number: 46, text: "GoldOre"},
            TitaniumOre: {number: 69, text: "TitaniumOre"},
            Salpeter: {number: 63, text: "Salpeter"}
        },
        mineToOre: {
            BronzeMine: "BronzeOre", EpicBronzeMine: "BronzeOre", BronzeMineEndless: "BronzeOre",
            IronMine: "IronOre", EpicIronMine: "IronOre", ArcticIronMine: "IronOre", IronMineEndless: "IronOre",
            CoalMine: "Coal", EpicCoalMine: "Coal", CoalMineEndless: "Coal",
            GoldMine: "GoldOre", EpicGoldMine: "GoldOre", GoldMineEndless: "GoldOre", ArcticGoldMine: "GoldOre",
            TitaniumMine: "TitaniumOre", EpicTitaniumMine: "TitaniumOre", ArcticTitaniumMine: "TitaniumOre",
            SalpeterMine: "Salpeter", EpicSalpeterMine: "Salpeter"
        },
        maxLevelDefaults: {
            IronOre: 1,
            CoalOre: 1,
            BronzeOre: 1,
            GoldOre: 1,
            TitaniumOre: 1,
            SalpeterOre: 1
        }
    };

    // COMMAND.STOP_PRODUCTION = 107
    // SendServerAction(107, 0, grid, 0, null) → stop production
    // SendServerAction(107, 1, grid, 0, null) → run production
    const CMD_STOP_PRODUCTION = 107;
    const CMD_BUILD           = 50;
    const CMD_UPGRADE         = 60;

    window.DM_MenuHandler = DM_MenuHandler;
    addToolsMenuItem(loca.GetText("RES", 'BuffAd_Drunken_Miner'), window.DM_MenuHandler);

    var _DM_ModalInitialized = false;
    var DM_build_newTemplates;

    var DM_AutoModeSwitchStatus    = false;
    var DM_UpgradeSwitchStatus     = false;

    const DM_lements = {
        ON_OFF_RADIO:             SCRIPT_PREFIX + 'StateSwitch',
        ON_OFF_RADIO_TEXT:        SCRIPT_PREFIX + 'StateSwitch_TEXT',
        ON_OFF_AUTOMODE_RADIO:    SCRIPT_PREFIX + 'AutoModeStateSwitch',
        ON_OFF_AUTOMODE_RADIO_TEXT: SCRIPT_PREFIX + 'AutoModeStateSwitch_TEXT',
        BUILD_CHECKBX:            SCRIPT_PREFIX + 'buildCheckBox',
        UPGR_CHECKBX:             SCRIPT_PREFIX + 'upgrCheckBox',
        SAFE_BUFF_BTN:            SCRIPT_PREFIX + 'toggleSafeBuffing',
        SELECT_ALL_BTN:           SCRIPT_PREFIX + 'selectAll_ALL',
        STOP_AFTER_BUILD_BTN:     SCRIPT_PREFIX + 'stopAfterBuild',
        STOP_AFTER_BUILD_LABEL:   SCRIPT_PREFIX + 'stopAfterBuildLabel',
    };

    const DM_SwitchStatuses = {
        UPGRADE:      loca.GetText('ACL', 'Upgrades'),
        BUILD:        loca.GetText('BUI', 'TwinTown_building_spot'),
        AUTOMODE_ON:  loca.GetText('ACL', 'BuildQueueSlotTemp') + ' ' + loca.GetText('LAB', 'Yes'),
        AUTOMODE_OFF: loca.GetText('ACL', 'BuildQueueSlotTemp') + ' ' + loca.GetText('LAB', 'No'),
        AUTOSTOP_ON:  loca.GetText('LAB', 'StopProduction') + ' ' + loca.GetText('LAB', 'Yes'),
        AUTOSTOP_OFF: loca.GetText('LAB', 'StopProduction') + ' ' + loca.GetText('LAB', 'No'),
    };

    var DM_config = {
        build: [],
        upgrade: [],
        switchStatus:     DM_UpgradeSwitchStatus,
        AutoModeStatus:   DM_AutoModeSwitchStatus,
        maxLvl:           $.extend({}, RESOURCES.maxLevelDefaults),
        safeBuffing:      false,
        stopAfterBuild:   false
    };
    $.extend(DM_config, settings.read(null, SCRIPT_PREFIX + 'SETTINGS'));
    DM_config.maxLvl  = $.extend({}, RESOURCES.maxLevelDefaults, DM_config.maxLvl || {});
    DM_config.build   = Array.isArray(DM_config.build)   ? DM_config.build   : [];
    DM_config.upgrade = Array.isArray(DM_config.upgrade) ? DM_config.upgrade : [];

    // =====================================================================================
    //  Движок автоматизации
    //  - две независимые очереди (DM_runs.build / DM_runs.upgrade), у каждой свой id:
    //    перезапуск очереди гасит только её старый таймер/команды;
    //  - пробуждение к ближайшему завершению стройки/улучшения + страховочный опрос;
    //  - событий завершения стройки/улучшения клиент не рассылает (cBuilding.Upgrade() и
    //    завершение стройки в cComputeResourceCreation ничего не шлют в channels), поэтому
    //    используется точный таймер по данным игры (время старта + длительность);
    //  - каждая команда имеет состояние "отправлено" и проверяется по факту в игре.
    // =====================================================================================
    // Время строительства (сек) из gfx_settings (constructionDuration). Для сортировки стройки.
    var DM_BUILD_DURATION = { BronzeOre: 300, IronOre: 300, Coal: 600, GoldOre: 600, Salpeter: 1200, TitaniumOre: 1500 };

    var DM_SEND_INTERVAL       = 1000;   // пауза между командами серверу
    var DM_BUILD_VERIFY_MS     = 15000;  // сколько ждём появления стройки после команды
    var DM_UPGRADE_PENDING_MS  = 20000;  // сколько ждём подтверждения улучшения
    var DM_MIN_DELAY           = 3000;
    var DM_MAX_DELAY           = 60000;  // страховочный опрос
    var DM_OFFZONE_DELAY       = 30000;
    var DM_STOPWATCH_DELAY     = 15000;

    var DM_runs           = { build: _DM_newRun(false), upgrade: _DM_newRun(true) };
    var DM_stopWatch      = {};   // grid -> {type: 'build'|'upgrade', since: ms}
    var DM_stopWatchTimer = null;

    function _DM_notify(text) {
        try { game.showAlert(text); } catch (e) { debug(e); }
    }

    function _DM_bld(grid) {
        try { return game.gi.mCurrentPlayerZone.GetBuildingFromGridPosition(Number(grid)); } catch (e) { return null; }
    }

    function _DM_depositOre(grid) {
        try {
            var d = game.zone.mStreetDataMap.mDepositContainer.get(Number(grid));
            return d ? d.GetName_string() : null;
        } catch (e) { return null; }
    }

    function _DM_call(obj, fn, def) {
        try { return (obj && typeof obj[fn] === 'function') ? obj[fn]() : def; } catch (e) { return def; }
    }

    function _DM_maxLvlFor(buildingName) {
        var ore = RESOURCES.mineToOre[buildingName];
        if (!ore) return 0;
        var key = (ore === 'Coal' || ore === 'Salpeter') ? ore + 'Ore' : ore;
        var v = parseInt(DM_config.maxLvl[key], 10);
        return isNaN(v) ? 1 : v;
    }

    function _DM_isUpgradableMine(name) {
        return RESOURCES.upgradableMines.indexOf(name) !== -1;
    }

    function _DM_isUpgradeBusy(bld) {
        return _DM_call(bld, 'IsUpgradeInProgress', false) || _DM_call(bld, 'IsUpgradeInitiated', false);
    }

    function _DM_removeFrom(list, grid) {
        var i = list.indexOf(grid);
        if (i !== -1) list.splice(i, 1);
    }

    // --- Производство: как в родном клиенте (cBuilding.SetProductionActiveCommand) ---
    function _DM_setMineProduction(grid, active) {
        try {
            var bld = _DM_bld(grid);
            if (bld && typeof bld.SetProductionActiveCommand === 'function') {
                if (_DM_call(bld, 'IsWaitForCommand', false)) return false;
                bld.SetProductionActiveCommand(!!active);
            } else {
                game.gi.SendServerAction(CMD_STOP_PRODUCTION, active ? 1 : 0, Number(grid), 0, null);
            }
            return true;
        } catch (e) {
            debug(e);
            return false;
        }
    }

    // --- Остановка после завершения (стройки / улучшения до лимита) ---
    function _DM_addStopWatch(grid, type) {
        DM_stopWatch[String(grid)] = { type: type, since: Date.now() };
        if (!DM_stopWatchTimer) DM_stopWatchTimer = setTimeout(_DM_checkStopWatch, DM_STOPWATCH_DELAY);
    }

    function _DM_checkStopWatch() {
        DM_stopWatchTimer = null;
        var left = 0;
        try {
            if (game.gi.isOnHomzone()) {
                Object.keys(DM_stopWatch).forEach(function (grid) {
                    var w   = DM_stopWatch[grid];
                    var bld = _DM_bld(grid);
                    if (!bld) {
                        // стройка ещё не появилась / здание исчезло
                        if (Date.now() - w.since > 120000) delete DM_stopWatch[grid];
                        return;
                    }
                    var ready = w.type === 'build'
                        ? _DM_call(bld, 'IsBuildingInProduction', false)
                        : !_DM_isUpgradeBusy(bld);
                    if (!ready) return;

                    delete DM_stopWatch[grid];
                    if (w.type === 'upgrade') {
                        var name = _DM_call(bld, 'GetBuildingName_string', '');
                        if (_DM_call(bld, 'GetUIUpgradeLevel', 0) < _DM_maxLvlFor(name)) return; // лимит ещё не достигнут
                    }
                    if (_DM_call(bld, 'IsProductionActive', false)) _DM_setMineProduction(grid, false);
                });
            }
            left = Object.keys(DM_stopWatch).length;
        } catch (e) {
            debug(e);
            left = Object.keys(DM_stopWatch).length;
        }
        if (left > 0) DM_stopWatchTimer = setTimeout(_DM_checkStopWatch, DM_STOPWATCH_DELAY);
    }

    // --- Управление очередями: стройка и улучшение работают независимо ---
    function _DM_newRun(isUpgrade) {
        return {
            id: 0, active: false, isUpgrade: isUpgrade, oneShot: false, sentOnce: false,
            grids: [], pending: {}, timer: null, queue: null
        };
    }

    function _DM_runName(run) {
        return loca.GetText('RES', 'BuffAd_Drunken_Miner') + ' (' + (run.isUpgrade ? DM_SwitchStatuses.UPGRADE : DM_SwitchStatuses.BUILD) + ')';
    }

    function _DM_stopRun(run, silent) {
        var wasActive = run.active && !run.oneShot;
        run.id++;
        run.active = false;
        if (run.timer) { clearTimeout(run.timer); run.timer = null; }
        if (run.queue) { run.queue.reset(); run.queue = null; }
        run.pending = {};
        if (wasActive && !silent) _DM_notify(_DM_runName(run) + ': ' + loca.GetText('LAB', 'StopProduction'));
    }

    function _DM_stopAll(silent) {
        _DM_stopRun(DM_runs.build, silent);
        _DM_stopRun(DM_runs.upgrade, silent);
    }

    // Choosing a target is separate from deciding whether it can start now.
    function _DM_canChooseUpgrade(grid) {
        var b = _DM_bld(grid);
        var name = _DM_call(b, 'GetBuildingName_string', '');
        return !!b && _DM_isUpgradableMine(name) && !_DM_isUpgradeBusy(b) &&
            !_DM_call(b, 'IsWaitForCommand', true) &&
            DM_runs.upgrade.pending[String(grid)] === undefined;
    }

    function _DM_selectionCheckboxes() {
        var cls = DM_UpgradeSwitchStatus ? DM_lements.UPGR_CHECKBX : DM_lements.BUILD_CHECKBX;
        return $('#DrunkenMinerModalData input[type="checkbox"].' + cls + ':enabled');
    }

    function _DM_canStartUpgrade(grid) {
        var b = _DM_bld(grid);
        var name = _DM_call(b, 'GetBuildingName_string', '');
        var run = DM_runs.upgrade;
        var allowed = false;
        try { allowed = !!b && b.IsUpgradeAllowed(true); } catch (e) { debug(e); }
        return !!b && _DM_isUpgradableMine(name) && !_DM_isUpgradeBusy(b) &&
            !_DM_call(b, 'IsWaitForCommand', true) &&
            _DM_call(b, 'GetUIUpgradeLevel', DM_MaxUpgradeLvl) < _DM_maxLvlFor(name) &&
            _DM_call(b, 'IsProductionActive', false) &&
            allowed && run.pending[String(grid)] === undefined;
    }

    function _DM_startRun(isUpgrade, grids, oneShot) {
        var run = isUpgrade ? DM_runs.upgrade : DM_runs.build;
        if (isUpgrade) {
            var added = [];
            grids.map(String).forEach(function (grid) {
                if (added.indexOf(grid) !== -1 || (run.active && run.grids.indexOf(grid) !== -1)) return;
                if (_DM_canStartUpgrade(grid)) added.push(grid);
            });
            if (added.length === 0) {
                _DM_notify(_DM_runName(run) + ': нет новых доступных шахт для улучшения. Проверьте уровень, ресурсы и состояние шахты.');
                return;
            }
            if (run.active) {
                // Preserve existing commands and chains; append only new targets.
                run.grids = run.grids.concat(added);
                run.oneShot = run.oneShot && !!oneShot;
                run.sentOnce = false;
                var remaining = run.queue ? Math.max(0, run.queue.len() - run.queue.index) : 0;
                _DM_schedule(run, run.id, Math.max(DM_MIN_DELAY, remaining * DM_SEND_INTERVAL + 2000));
                return;
            }
            grids = added;
        }
        _DM_stopRun(run, true); // build keeps its existing restart policy
        run.active   = true;
        run.oneShot  = !!oneShot;
        run.sentOnce = false;
        run.grids    = grids.map(String);
        run.pending  = {};
        _DM_tick(run, run.id);
    }

    function _DM_schedule(run, runId, delay) {
        if (runId !== run.id || !run.active) return;
        if (run.timer) clearTimeout(run.timer);
        run.timer = setTimeout(function () {
            run.timer = null;
            _DM_tick(run, runId);
        }, Math.max(0, delay));
    }

    function _DM_tick(run, runId) {
        if (runId !== run.id || !run.active) return;
        try {
            if (!game.gi.isOnHomzone()) {
                _DM_schedule(run, runId, DM_OFFZONE_DELAY);
                return;
            }
            var delay = run.isUpgrade ? _DM_upgradeStep(run, runId) : _DM_buildStep(run, runId);
            if (delay === null) {
                var oneShot = run.oneShot;
                _DM_stopRun(run, true);
                if (!oneShot) _DM_notify(_DM_runName(run) + ': ' + loca.GetText('LAB', 'QuestCompleted'));
                return;
            }
            _DM_schedule(run, runId, Math.min(Math.max(delay, DM_MIN_DELAY), DM_MAX_DELAY));
        } catch (e) {
            debug(e);
            _DM_schedule(run, runId, DM_OFFZONE_DELAY);
        }
    }

    function _DM_sendQueued(run, runId, actions) {
        if (actions.length === 0) return;
        var q = new TimedQueue(DM_SEND_INTERVAL);
        actions.forEach(function (fn) {
            q.add(function () {
                if (runId !== run.id) return;
                try { fn(); } catch (e) { debug(e); }
            });
        });
        run.queue = q;
        q.run();
    }

    function _DM_freeQueueSlots() {
        try {
            var queue = game.gi.mHomePlayer.mBuildQueue;
            return queue.GetTotalAvailableSlots() - queue.GetQueue_vector().length;
        } catch (e) { return 0; }
    }

    function _DM_nearestQueueFinish() {
        var min = null;
        try {
            var vec = game.gi.mHomePlayer.mBuildQueue.GetQueue_vector();
            for (var i = 0; i < vec.length; i++) {
                var t = _DM_call(vec[i], 'GetRemainingConstructionDuration', 0);
                if (t > 0 && (min === null || t < min)) min = t;
            }
        } catch (e) { debug(e); }
        return min === null ? DM_MAX_DELAY : min + 1500;
    }

    // --- Стройка ---
    function _DM_dropBuild(run, grid) {
        _DM_removeFrom(run.grids, grid);
        _DM_removeFrom(DM_config.build, grid);
        delete run.pending[grid];
    }

    function _DM_buildStep(run, runId) {
        var now     = Date.now();
        var grids   = run.grids;
        var pending = run.pending;
        var failed  = 0;
        var buildCountBefore = DM_config.build.length;
        var i;

        // 1. Проверяем отправленные команды по факту на карте
        Object.keys(pending).forEach(function (grid) {
            if (_DM_bld(grid)) {
                _DM_dropBuild(run, grid);
                if (DM_config.stopAfterBuild) _DM_addStopWatch(grid, 'build');
            } else if (now - pending[grid] > DM_BUILD_VERIFY_MS) {
                failed++;
                _DM_dropBuild(run, grid);
            }
        });
        if (failed > 0) {
            _DM_notify(_DM_runName(run) + ': не удалось начать стройку (' + failed + ') — не хватает ресурсов. Шахты убраны из списка.');
        }

        // 2. Убираем неактуальные месторождения
        for (i = grids.length - 1; i >= 0; i--) {
            var g = grids[i];
            if (pending[g] !== undefined) continue;
            var ore = _DM_depositOre(g);
            if (!ore || !RESOURCES.buildMapping[ore] || _DM_bld(g)) _DM_dropBuild(run, g);
        }
        if (DM_config.build.length !== buildCountBefore) _DM_saveTmpSetting();

        var pendingCount = Object.keys(pending).length;
        var candidates   = grids.filter(function (g) { return pending[g] === undefined; });

        if (pendingCount === 0 && (candidates.length === 0 || (run.oneShot && run.sentOnce))) return null;

        // 3. Отправляем новые стройки: сначала самые быстрые
        var actions = [];
        if (!(run.oneShot && run.sentOnce)) {
            var oreOf = {};
            candidates.forEach(function (g) { oreOf[g] = _DM_depositOre(g); });
            candidates.sort(function (a, b) {
                var oa = oreOf[a], ob = oreOf[b];
                var d  = (DM_BUILD_DURATION[oa] || 9999) - (DM_BUILD_DURATION[ob] || 9999);
                return d !== 0 ? d : (RESOURCES.oreOrder[oa] || 99) - (RESOURCES.oreOrder[ob] || 99);
            });

            var free = _DM_freeQueueSlots() - pendingCount;
            for (i = 0; i < candidates.length && free > 0; i++, free--) {
                (function (grid) {
                    var mapping = RESOURCES.buildMapping[oreOf[grid]];
                    pending[grid] = Infinity; // в очереди отправки
                    actions.push(function () {
                        if (_DM_bld(grid)) return; // уже занято — проверка в следующем такте
                        game.gi.SendServerAction(CMD_BUILD, mapping.number, Number(grid), 0, null);
                        pending[grid] = Date.now();
                        _DM_notify(loca.GetText("BUI", "DefenseModeGhostGarrison") + ' ' + loca.GetText("RES", mapping.text));
                    });
                })(candidates[i]);
            }
            run.sentOnce = true;
        }
        _DM_sendQueued(run, runId, actions);

        var delay = Object.keys(pending).length > 0 ? 5000 : _DM_nearestQueueFinish();
        return Math.max(delay, actions.length * DM_SEND_INTERVAL + 2000);
    }

    // --- Улучшение ---
    function _DM_dropUpgrade(run, grid) {
        _DM_removeFrom(run.grids, grid);
        _DM_removeFrom(DM_config.upgrade, grid);
        delete run.pending[grid];
    }

    function _DM_upgradeRemaining(bld) {
        var start = _DM_call(bld, 'GetUpgradeStartTime', 0);
        var dur   = _DM_call(bld, 'GetUpgradeDuration', -1);
        if (!start || dur <= 0) return null;
        return Math.max(0, start + dur - game.gi.GetClientTime());
    }

    function _DM_upgradeStep(run, runId) {
        var now      = Date.now();
        var grids    = run.grids;
        var pending  = run.pending;
        var canSend  = !(run.oneShot && run.sentOnce);
        var noRes    = [];
        var stopped  = 0;
        var minRem   = null;
        var actions  = [];
        var changed  = false;

        for (var i = grids.length - 1; i >= 0; i--) {
            var grid = grids[i];
            var bld  = _DM_bld(grid);
            var name = _DM_call(bld, 'GetBuildingName_string', null);

            // Эпические/арктические/Spooky не улучшаются (в игре только уровень 1)
            if (!bld || !_DM_isUpgradableMine(name)) { _DM_dropUpgrade(run, grid); changed = true; continue; }

            if (_DM_isUpgradeBusy(bld)) {
                delete pending[grid];
                var rem = _DM_upgradeRemaining(bld);
                if (rem !== null && (minRem === null || rem < minRem)) minRem = rem;
                continue;
            }

            if (pending[grid] !== undefined) {
                if (now - pending[grid] < DM_UPGRADE_PENDING_MS) continue;
                delete pending[grid]; // не подтвердилось — попробуем снова
            }

            if (_DM_call(bld, 'GetUIUpgradeLevel', 0) >= _DM_maxLvlFor(name)) { grids.splice(i, 1); continue; }

            // Остановленные шахты не улучшаем
            if (!_DM_call(bld, 'IsProductionActive', false)) { stopped++; _DM_dropUpgrade(run, grid); changed = true; continue; }

            if (!canSend) continue;
            if (_DM_call(bld, 'IsWaitForCommand', false)) continue;

            var allowed = false, allowedNoRes = false;
            try { allowed = bld.IsUpgradeAllowed(true); allowedNoRes = bld.IsUpgradeAllowed(false); } catch (e) { debug(e); }

            if (allowed) {
                (function (grid, name) {
                    pending[grid] = Infinity;
                    actions.push(function () {
                        var b = _DM_bld(grid);
                        if (!b || !b.IsUpgradeAllowed(true)) { delete pending[grid]; return; }
                        var ok;
                        if (typeof game.gi.mCurrentPlayerZone.UpgradeBuildingOnGridPosition === 'function') {
                            // как в родном клиенте (cBuildingInfoPanel.UpgradeBuildingHandler)
                            ok = game.gi.mCurrentPlayerZone.UpgradeBuildingOnGridPosition(Number(grid));
                            if (ok && typeof b.SetIsUpgradeInitiated === 'function') b.SetIsUpgradeInitiated(true);
                        } else {
                            game.gi.SendServerAction(CMD_UPGRADE, 0, Number(grid), 0, null);
                            ok = true;
                        }
                        if (!ok) { delete pending[grid]; return; }
                        pending[grid] = Date.now();
                        _DM_notify(loca.GetText("ALT", "UpgradeBuilding") + ' ' + loca.GetText('BUI', name));
                        if (DM_config.stopAfterBuild) _DM_addStopWatch(grid, 'upgrade');
                    });
                })(grid, name);
            } else if (allowedNoRes) {
                noRes.push(loca.GetText('BUI', name));
                _DM_dropUpgrade(run, grid);
                changed = true;
            }
            // иначе улучшение временно недоступно — ждём следующего такта
        }

        if (canSend) run.sentOnce = true;
        if (changed) _DM_saveTmpSetting();
        if (noRes.length > 0) {
            _DM_notify(_DM_runName(run) + ': не хватает ресурсов для улучшения — ' + noRes.join(', ') + '. Убраны из списка.');
        }
        if (stopped > 0) {
            _DM_notify(_DM_runName(run) + ': остановленные шахты пропущены (' + stopped + ').');
        }

        _DM_sendQueued(run, runId, actions);

        var pendingCount = Object.keys(pending).length;
        if (grids.length === 0) return null;
        if (run.oneShot && run.sentOnce && pendingCount === 0) return null;

        var delay = minRem !== null ? minRem + 1500 : DM_MAX_DELAY;
        if (pendingCount > 0) delay = Math.min(delay, 5000);
        return Math.max(delay, actions.length * DM_SEND_INTERVAL + 2000);
    }

    function DM_MenuHandler() {
        try {
            if (game.gi.isOnHomzone() === false) {
                game.showAlert(getText('not_home'));
                return;
            }
            _DM_init();
            _DM_renderHeader();
            _DM_renderBody();
            _DM_renderFooter();
            _DM_InitEvens();
            _DM_SetConfigValues();

            $('#DrunkenMinerModal:not(:visible)').modal({
                backdrop: "static"
            });
        } catch (e) {
            debug(e)
        }
    }

    function _DM_init() {
        $("div[role='dialog']:not(#DrunkenMinerModal):visible").modal("hide");
        if (!_DM_ModalInitialized) $('#DrunkenMinerModal').remove();
        createModalWindow('DrunkenMinerModal', loca.GetText("RES", 'BuffAd_Drunken_Miner'));

        DM_UpgradeSwitchStatus  = DM_config.switchStatus;
        DM_AutoModeSwitchStatus = DM_config.AutoModeStatus;

        DM_build_newTemplates = new SaveLoadTemplate('DrunkenMiner', function (data, name) {
            $("#DrunkenMinerModal .templateFile").html("{0} ({1}: {2})".format('&nbsp;'.repeat(5), loca.GetText("LAB", "AvatarCurrentSelection"), name));
            if (!data || data.length === 0) return;
            _DM_stopAll(false);
            DM_config = $.extend({ build: [], upgrade: [], safeBuffing: false, stopAfterBuild: false }, data);
            DM_config.maxLvl = $.extend({}, RESOURCES.maxLevelDefaults, data.maxLvl || {});
            DM_config.switchStatus   = DM_UpgradeSwitchStatus;
            DM_config.AutoModeStatus = DM_AutoModeSwitchStatus;
            _DM_renderBody();
            _DM_InitEvens();
            _DM_SetConfigValues();
            _DM_saveTmpSetting();
        });
    }

    function _DM_renderHeader() {

        function icon(id, iconName, extraStyle) {
            return getImageTag(iconName, '24px')
                .replace(
                    '<img',
                    '<img' +
                    (id ? ' id="' + id + '"' : '') +
                    ' style="vertical-align:top;cursor:pointer;' + (extraStyle || '') + '"'
                );
        }

        function labeledSwitch(id, status, text) {
            var label = $('<div>')
                .attr({
                    id: id + '_TEXT',
                    style: 'display:inline-block;vertical-align:top;padding:2px 0 0 5px;z-index:999'
                })
                .text(text);
            return createSwitch(id, status) + label[0].outerHTML;
        }

        function buildSelect(ore) {
            var html = icon(null, RESOURCES.icons[ore], '');
            if (ore === 'Coal' || ore === 'Salpeter') {
                ore += 'Ore';
            }
            html += '<select name="DM_maxUpgLvlFilter_' + ore + '">';
            for (var i = 1; i <= DM_MaxUpgradeLvl; i++) {
                html += '<option value="' + i + '">' + i + '</option>';
            }
            return html + '</select>';
        }

        var stopAfterBuildIcon = icon(
            DM_lements.STOP_AFTER_BUILD_BTN,
            'BuildingSleepMode',
            'height:100%;margin-right:8px;' + (!DM_config.stopAfterBuild ? 'opacity:0.4;' : 'opacity:1;')
        );
        var stopAfterBuildlabel = $('<div>', {
            id: DM_lements.STOP_AFTER_BUILD_LABEL,
            css: {
                display: 'inline-block',
                verticalAlign: 'top',
                padding: '2px 0 0 5px',
                zIndex: 999
            },
            text: DM_config.stopAfterBuild
                ? DM_SwitchStatuses.AUTOSTOP_ON
                : DM_SwitchStatuses.AUTOSTOP_OFF
        });

        stopAfterBuildIcon = stopAfterBuildIcon + stopAfterBuildlabel[0].outerHTML;

        var switchRow = createTableRow([
            [3, labeledSwitch(
                DM_lements.ON_OFF_RADIO,
                DM_UpgradeSwitchStatus,
                DM_UpgradeSwitchStatus ? DM_SwitchStatuses.UPGRADE : DM_SwitchStatuses.BUILD
            )],
            [3, labeledSwitch(
                DM_lements.ON_OFF_AUTOMODE_RADIO,
                DM_AutoModeSwitchStatus,
                DM_AutoModeSwitchStatus ? DM_SwitchStatuses.AUTOMODE_ON : DM_SwitchStatuses.AUTOMODE_OFF
            )],
            [6, stopAfterBuildIcon]
        ], true);

        var maxUpgradeHtml = '';
        var selectAllHtml  = '';

        RESOURCES.ores.forEach(function (ore) {
            maxUpgradeHtml += buildSelect(ore);
            selectAllHtml  += icon('DM_selectAll_' + ore, RESOURCES.icons[ore], 'margin-right:20px;');
        });

        selectAllHtml += icon(DM_lements.SELECT_ALL_BTN, 'RefreshTradeIcon', 'margin-right:20px;');
        selectAllHtml += icon(DM_lements.SAFE_BUFF_BTN, 'ProductivityBuffLvl3', 'margin-right:20px;');

        var maxUpgradeRow = createTableRow([
            [3, '<div style="text-align:right">' +
            loca.GetText('LAB', 'Max') + ' ' +
            loca.GetText('LAB', 'ExpeditionDifficultyTooltip') + ' ' +
            loca.GetText('ACL', 'Upgrades') +
            '</div>'],
            [9, maxUpgradeHtml]
        ], true);

        maxUpgradeRow = $(maxUpgradeRow)
            .attr('id', SCRIPT_PREFIX + 'maxUpgradeRow')
            .prop('outerHTML');

        var selectAllRow = createTableRow([
            [3, '<div style="text-align:right">' +
            loca.GetText('LAB', 'Select') + ' ' +
            loca.GetText('LAB', 'All') +
            '</div>'],
            [9, selectAllHtml]
        ], true);


        var tableHeadRow = createTableRow([
            [3, loca.GetText('BUI', 'BuildingMountainOre')],
            [1, loca.GetText('LAB', 'Tasks')],
            [1, loca.GetText('LAB', 'RareBuffGroup2')],
            [3, loca.GetText('LAB', 'Expires')],
            [3, loca.GetText('LAB', 'RareBuffGroup0')],
            [1, loca.GetText('LAB', 'Visit')]
        ], true);

        $('#DrunkenMinerModal .modal-header')
            .append(
                '<div class="container-fluid">' +
                switchRow +
                maxUpgradeRow +
                selectAllRow +
                '<br>' +
                tableHeadRow +
                '</div>'
            );
    }

    function _DM_renderBody() {
        var deposits;
        if (DM_UpgradeSwitchStatus) {
            deposits = _DM_getUpgradeData();
        } else {
            deposits = _DM_GetBuildData();
        }
        _DM_renderData(deposits);
        _DM_updateSelectAllOpacity();
    }

    function _DM_renderFooter() {
        $("#DrunkenMinerModal .modal-footer").prepend(
            $('<button>').attr({"class": "btn btn-warning upgradeReset"}).text(getText('btn_reset')),
            $('<button>').attr({"class": "btn btn-success upgradeSubmit"}).text(getText('btn_submit')),
            $('<button>').attr({"class": "btn btn-primary pull-left build_newSaveTemplate"}).text(getText('save_template')),
            $('<button>').attr({"class": "btn btn-primary pull-left build_newLoadTemplate"}).text(getText('load_template'))
        );
    }

    function _DM_startAutoMode() {
        if (!DM_AutoModeSwitchStatus || !game.gi.isOnHomzone()) return;
        game.showAlert(loca.GetText('ALT', 'ErrorRetrievingMail') + ' ' + loca.GetText('LAB', 'QuestNew'));
        if (DM_UpgradeSwitchStatus) {
            _DM_startRun(true, DM_config.upgrade.slice(), false);
        } else {
            _DM_startRun(false, DM_config.build.slice(), false);
        }
    }

    function _DM_getUpgradeData() {
        var resArr = { deposit: [], depleted: [] };
        var zone = swmmo.application.mGameInterface.mCurrentPlayerZone;
        var streetMap = zone.mStreetDataMap;

        var ores     = RESOURCES.ores;
        var oreOrder = RESOURCES.oreOrder || {};
        var mineToOre = RESOURCES.mineToOre || {};
        var icons    = RESOURCES.icons;

        var deposits  = [];
        var container = streetMap.mDepositContainer.mContainer;

        for (var i = 0, len = container.length; i < len; i++) {
            var item = container[i];
            if (!item) continue;

            var oreName;
            try { oreName = item.GetName_string(); } catch (e) { continue; }

            if (ores.indexOf(oreName) === -1) continue;

            var grid     = item.GetGrid();
            var building = zone.GetBuildingFromGridPosition(grid);
            if (!building) continue;

            var buildingName;
            try { buildingName = building.GetBuildingName_string(); } catch (e) { buildingName = null; }

            var ore = mineToOre[buildingName] || oreName;

            deposits.push({ deposit: item, ore: ore, order: oreOrder[ore] || 999 });
        }

        deposits.sort(function (a, b) { return a.order - b.order; });

        for (i = 0, len = deposits.length; i < len; i++) {
            var entry   = deposits[i];
            var deposit = entry.deposit;

            var bldData = _DM_getBuildingDataFromDeposit(deposit);
            if (!bldData) continue;

            var infoText = bldData.isUpgradeInProgress
                ? loca.GetText('LAB', 'Upgrade')
                : loca.GetText('QUL', 'TutBronzeMine');

            resArr.deposit.push({
                grid:         deposit.GetGrid(),
                buildingInfo: infoText,
                depositName:  entry.ore,
                resourcesLeft: deposit.GetAmount(),
                icon:         icons[entry.ore] || 'ButtonIconUnknown',
                buffIcon:     bldData.buffIcon || '',
                building:     bldData
            });
        }

        return resArr;
    }

    function _DM_GetBuildData() {
        var resArr = { deposit: [], depleted: [] };

        var ores      = RESOURCES.ores;
        var oreOrder  = RESOURCES.oreOrder || {};
        var icons     = RESOURCES.icons;
        var depositLabel = '(' + loca.GetText('LAB', 'DetailsDeposit') + ')';

        var zone      = swmmo.application.mGameInterface.mCurrentPlayerZone;
        var streetMap = zone.mStreetDataMap;
        if (!streetMap || !streetMap.mBuildingContainer) {
            debug('streetMap.mBuildingContainer is undefined');
            return resArr;
        }

        var freeDeposits = [];
        var deposits = streetMap.mDepositContainer.mContainer;

        for (var i = 0, len = deposits.length; i < len; i++) {
            var item = deposits[i];
            if (!item) continue;

            var name;
            try { name = item.GetName_string(); } catch (e) { continue; }

            if (ores.indexOf(name) === -1) continue;

            const grid = item.GetGrid();
            const bld  = zone.GetBuildingFromGridPosition(grid);

            if (!bld || bld.GetBuildingMode() === 1 || bld.GetBuildingMode() === 4) {
                freeDeposits.push({ deposit: item, ore: name, order: oreOrder[name] || 999 });
            }
        }

        freeDeposits.sort(function (a, b) { return a.order - b.order; });

        for (i = 0, len = freeDeposits.length; i < len; i++) {
            var entry   = freeDeposits[i];
            var deposit = entry.deposit;

            const grid = deposit.GetGrid();
            const bld  = zone.GetBuildingFromGridPosition(grid);

            resArr.deposit.push({
                grid:         grid,
                buildingInfo: depositLabel,
                depositName:  entry.ore,
                resourcesLeft: deposit.GetAmount(),
                icon:         icons[entry.ore] || 'ButtonIconMagnifier',
                buildMode:    bld ? bld.GetBuildingMode() : null
            });
        }

        var buildings   = streetMap.mBuildingContainer.mContainer;
        var assertNames = RESOURCES.assertNames;
        var depleted    = [];

        for (i = 0, len = buildings.length; i < len; i++) {
            var b = buildings[i];
            if (!b) continue;
            if (!streetMap.IsADepletedDeposit(b)) continue;

            var bName;
            try { bName = b.GetBuildingName_string(); } catch (e) { continue; }

            if (assertNames.indexOf(bName) === -1) continue;

            var ore = _DM_findOreInDepletedName(bName);
            if (!ore) continue;

            depleted.push({ grid: b.GetGrid(), icon: icons[ore] || 'ButtonIconUnknown', name: bName, Resource: ore });
        }

        depleted.sort(function (a, b) { return a.Resource.localeCompare(b.Resource); });
        resArr.depleted = depleted;
        return resArr;
    }

    function _DM_renderData(deposits) {
        var $rowHtml = '';
        deposits.deposit.forEach(function (deposit) {
            var bld           = deposit.building;
            var checkbox      = '';
            var bldLvl        = '';
            var depositName   = deposit.depositName !== undefined ? loca.GetText('RES', deposit.depositName) : '';
            var resourcesLeft = deposit.resourcesLeft !== undefined ? deposit.resourcesLeft : '';
            var buffName      = '';
            var buffIcon      = '';
            var buffEndTime   = '';
            var timeHtml      = '';

            var buildingGoto = getImageTag('accuracy.png', '24px', '24px')
                .replace('<img', '<img id="DM_MinePOS_' + deposit.grid + '"')
                .replace('style="', 'style="cursor: pointer;');

            if (bld) {
                if (bld.isSelectable) {
                    checkbox = '<input type="checkbox" id="DM_UpgradeMines_' + bld.grid + '" name="' + deposit.depositName + '" class="' + DM_lements.UPGR_CHECKBX + '"' + (bld.isUpgradeBusy ? ' disabled="disabled" aria-disabled="true"' : '') + ' />';
                }
                bldLvl        = bld.level;
                buffName      = bld.buff;
                buffEndTime   = bld.BufEndTime;
                resourcesLeft = bld.resourcesLeft;
                depositName   = bld.locName;
                buffIcon      = bld.buffIcon;

                if (bld.isUpgradeAllowed) {
                    timeHtml = _DM_ViewerSetTimeStr(bld.SecondsToDeplete, 2);
                    if (buffEndTime.length > 0) {
                        timeHtml = '<span style="color: ' + _DM_formatBuffTimeColor(timeHtml, buffEndTime) + '">' + timeHtml + ' / ' + buffEndTime + '</span>';
                    }
                } else if (bld.isUpgradeInProgress) {
                    timeHtml = loca.GetText('QUL', 'TutUpgrade');
                }
            } else if (deposit.buildMode < 1 || deposit.buildMode > 4) {
                checkbox = '<input type="checkbox" id="DM_RebuildMines_' + deposit.grid + '" name="' + deposit.depositName + '" class="' + DM_lements.BUILD_CHECKBX + '" />';
            } else if (deposit.buildMode >= 1 && deposit.buildMode <= 4) {
                timeHtml = loca.GetText('QUL', 'Birthday2018plus_Infrastructure_62-80_Main1_Sub5');
            }

            if (DM_UpgradeSwitchStatus && !bld) return;

            var $row = createTableRow([
                [3, getImageTag(deposit.icon, '24px') + '<sup>' + bldLvl + '</sup>' + ' ' + depositName],
                [1, checkbox],
                [1, resourcesLeft],
                [3, timeHtml],
                [3, (buffIcon ? getImageTag(buffIcon, '24px') : '') + ' <small>' + buffName + '</small>'],
                [1, '<div style="text-align: right;">' + buildingGoto + '</div>']
            ], false);

            if ((bld && (!bld.isUpgradeAllowed || bld.isUpgradeBusy)) || (deposit.buildMode >= 1 && deposit.buildMode <= 4)) {
                $row = $($row).css({opacity: '0.5'}).prop('outerHTML');
            }
            $rowHtml += $row;
        });

        deposits.depleted.forEach(function (deposit) {
            try {
                var buildingGoto = getImageTag('accuracy.png', '24px', '24px')
                    .replace('<img', '<img id="DM_MinePOS_' + deposit.grid + '"')
                    .replace('style="', 'style="cursor: pointer;');
                $rowHtml += createTableRow([
                    [11, getImageTag(deposit.icon, '24px') + ' ' + loca.GetText("BUI", deposit.name) + (deposit.Resource === "" ? "" : " (" + loca.GetText("RES", deposit.Resource) + ")")],
                    [1, '<div style="text-align: right;">' + buildingGoto + '</div>']
                ], false);
            } catch (e) {
                debug(e);
            }
        });

        $('#DrunkenMinerModalData').html("").append('<div class="container-fluid">' + $rowHtml + '</div>');
    }

    function _DM_InitEvens() {
        $('[id^="DM_MinePOS_"]').off('click').on('click', function () {
            var grid = this.id.replace("DM_MinePOS_", "");
            _DM_GoTo(grid);
        });

        $('select[name^="DM_maxUpgLvlFilter_"]').off('change').change(function () {
            if (this.disabled || !DM_UpgradeSwitchStatus) return;
            var ore = this.name.replace("DM_maxUpgLvlFilter_", "");
            DM_config.maxLvl[ore] = $(this).val();
            _DM_saveTmpSetting();
        });

        var mainSwitch = $("#" + DM_lements.ON_OFF_RADIO);
        mainSwitch.off('change').change(function () {
            if ($(this).is(':checked')) {
                $("#" + DM_lements.ON_OFF_RADIO_TEXT).text(DM_SwitchStatuses.UPGRADE);
                $("." + DM_lements.BUILD_CHECKBX).hide();
                DM_UpgradeSwitchStatus = true;
            } else {
                $("#" + DM_lements.ON_OFF_RADIO_TEXT).text(DM_SwitchStatuses.BUILD);
                $("." + DM_lements.BUILD_CHECKBX).show();
                DM_UpgradeSwitchStatus = false;
            }
            DM_config.switchStatus = DM_UpgradeSwitchStatus;
            _DM_renderBody();
            _DM_InitEvens();
            _DM_saveTmpSetting();
            _DM_SetConfigValues();
        });

        if (mainSwitch.is(':checked')) {
            $("." + DM_lements.BUILD_CHECKBX).hide();
            $("." + DM_lements.UPGR_CHECKBX).show();
        } else {
            $("." + DM_lements.UPGR_CHECKBX).hide();
            $("." + DM_lements.BUILD_CHECKBX).show();
        }

        var autoModeSwitch = $("#" + DM_lements.ON_OFF_AUTOMODE_RADIO);
        autoModeSwitch.off('change').change(function () {
            if ($(this).is(':checked')) {
                $("#" + DM_lements.ON_OFF_AUTOMODE_RADIO_TEXT).text(DM_SwitchStatuses.AUTOMODE_ON);
                DM_AutoModeSwitchStatus = true;
            } else {
                $("#" + DM_lements.ON_OFF_AUTOMODE_RADIO_TEXT).text(DM_SwitchStatuses.AUTOMODE_OFF);
                DM_AutoModeSwitchStatus = false;
                _DM_stopAll(false);
            }
            DM_config.AutoModeStatus = DM_AutoModeSwitchStatus;
            _DM_saveTmpSetting();
        });

        $('[id^="DM_UpgradeMines_"]').off('click').on('click', function () {
            var grid      = this.id.replace("DM_UpgradeMines_", "");
            if (this.disabled || (this.checked && !_DM_canChooseUpgrade(grid))) {
                $(this).prop('checked', false);
                if (_DM_isUpgradeBusy(_DM_bld(grid))) $(this).prop('disabled', true);
                return;
            }
            var isChecked = $('#DM_UpgradeMines_' + grid).prop('checked');
            _DM_pushUpgradeGridToConfig(grid, isChecked);
            _DM_saveTmpSetting();
            _DM_updateSelectAllOpacity();
        });

        $('[id^="DM_RebuildMines_"]').off('click').on('click', function () {
            var grid      = this.id.replace("DM_RebuildMines_", "");
            var isChecked = $('#DM_RebuildMines_' + grid).prop('checked');
            _DM_pushBuildGridToConfig(grid, isChecked);
            _DM_saveTmpSetting();
            _DM_updateSelectAllOpacity();
        });

        $('[id^="DM_selectAll_"]').off('click').on('click', function (e) {
            var ore = e.currentTarget.id.replace('DM_selectAll_', '');
            var targets = _DM_selectionCheckboxes().filter(function () {
                if (ore !== 'ALL' && this.name !== ore) return false;
                if (DM_UpgradeSwitchStatus) {
                    return _DM_canChooseUpgrade(this.id.replace('DM_UpgradeMines_', ''));
                }
                return true;
            });
            var checked = !targets.is(':checked');
            targets.each(function () {
                this.checked = checked;
                if (DM_UpgradeSwitchStatus) {
                    _DM_pushUpgradeGridToConfig(this.id.replace('DM_UpgradeMines_', ''), checked);
                } else {
                    _DM_pushBuildGridToConfig(this.id.replace('DM_RebuildMines_', ''), checked);
                }
            });
            _DM_saveTmpSetting();
            _DM_updateSelectAllOpacity();
        });

        $('#' + DM_lements.SAFE_BUFF_BTN).off('click').on('click', function () {
            DM_config.safeBuffing = !DM_config.safeBuffing;
            $(this).css('opacity', DM_config.safeBuffing ? '1' : '0.5');

            if (!DM_UpgradeSwitchStatus) {
                _DM_saveTmpSetting();
                return;
            }

            if (DM_UpgradeSwitchStatus) {
                $('#DrunkenMinerModalData input.' + DM_lements.UPGR_CHECKBX + ':enabled').each(function () {
                    var $cb   = $(this);
                    var grid  = $cb.attr('id').replace('DM_UpgradeMines_', '');
                    if (DM_config.safeBuffing && !_DM_canChooseUpgrade(grid)) return;
                    var $timeCell = $cb.parent().parent().find('div:eq(3)');
                    var timeText  = $timeCell.text().trim();

                    if (timeText.indexOf('/') === -1) return;
                    var parts      = timeText.split('/');
                    var depleteStr = parts[0].trim();
                    var buffStr    = parts[1].trim();

                    var color = _DM_formatBuffTimeColor(depleteStr, buffStr);
                    if (color !== 'orange') return;

                    if (DM_config.safeBuffing) {
                        $cb.prop('checked', true);
                        _DM_pushUpgradeGridToConfig(grid, true);
                    } else {
                        $cb.prop('checked', false);
                        _DM_pushUpgradeGridToConfig(grid, false);
                    }
                });
            }

            _DM_updateSelectAllOpacity();
            _DM_saveTmpSetting();
        });

        $('#' + DM_lements.STOP_AFTER_BUILD_BTN).off('click').on('click', function () {
            DM_config.stopAfterBuild = !DM_config.stopAfterBuild;

            var isOn = DM_config.stopAfterBuild;
            $(this).css('opacity', isOn ? '1' : '0.4');
            $('#' + DM_lements.STOP_AFTER_BUILD_LABEL)
                .text(isOn ? DM_SwitchStatuses.AUTOSTOP_ON : DM_SwitchStatuses.AUTOSTOP_OFF)

            _DM_saveTmpSetting();
        });

        $('#DrunkenMinerModal .upgradeReset').off('click').click(function () {
            _DM_stopAll(false);
            DM_config = {
                build: [], upgrade: [],
                switchStatus:   DM_UpgradeSwitchStatus,
                AutoModeStatus: DM_AutoModeSwitchStatus,
                maxLvl:         $.extend({}, RESOURCES.maxLevelDefaults),
                safeBuffing:    false,
                stopAfterBuild: false
            };
            _DM_SetConfigValues();
            _DM_saveTmpSetting();
        });

        $('#DrunkenMinerModal .upgradeSubmit').off('click').click(function () {
            $('#DrunkenMinerModal').modal('hide');

            if (DM_config.upgrade.length === 0 && DM_config.build.length === 0) {
                game.showAlert(loca.GetText('LAB', 'BuffGroup14'));
                return;
            }

            if (DM_UpgradeSwitchStatus) {
                if (DM_config.upgrade.length > 0) {
                    if (DM_AutoModeSwitchStatus) {
                        _DM_startAutoMode();
                    } else {
                        _DM_upgradeMines(DM_config.upgrade.slice());
                    }
                }
            } else {
                if (DM_config.build.length > 0) {
                    if (DM_AutoModeSwitchStatus) {
                        _DM_startAutoMode();
                    } else {
                        _DM_buildMines(DM_config.build.slice());
                    }
                }
            }
        });

        $('#DrunkenMinerModal .build_newSaveTemplate').off('click').click(function () {
            DM_build_newTemplates.save(DM_config);
        });
        $('#DrunkenMinerModal .build_newLoadTemplate').off('click').click(function () {
            DM_build_newTemplates.load();
        });
        $("#DrunkenMinerModal .btnClose").off('click').click(function () {
            $('#DrunkenMinerModal').modal('hide');
        });

        $('[data-toggle="tooltip"]').tooltip();
    }

    // Keep the row visible, but only allow editing in upgrade mode.
    function _DM_updateMaxUpgradeState() {
        var disabled = !DM_UpgradeSwitchStatus;
        var row = $('#DrunkenMinerModal #' + SCRIPT_PREFIX + 'maxUpgradeRow');
        row.css('opacity', '1')
            .attr('aria-disabled', disabled ? 'true' : 'false');
        // Light parchment tones derived from the client's #B2A589 header palette.
        // Empty values restore the client's normal CSS in upgrade mode.
        row.children('div').css({
            backgroundColor: disabled ? '#D8CEB8' : '',
            color: disabled ? '#6F6555' : ''
        });
        row.find('img')
            .attr('aria-disabled', disabled ? 'true' : 'false')
            .css({
                opacity: disabled ? '0.55' : '1',
                cursor: disabled ? 'default' : 'pointer'
            });
        row.find('select[name^="DM_maxUpgLvlFilter_"]')
            .prop('disabled', disabled)
            .css({
                backgroundColor: disabled ? '#EEE6D4' : '',
                color: disabled ? '#6F6555' : '',
                borderColor: disabled ? '#B2A589' : '',
                opacity: '1',
                cursor: disabled ? 'not-allowed' : ''
            });
    }

    function _DM_SetConfigValues() {
        _DM_updateMaxUpgradeState();
        for (var ore in DM_config.maxLvl) {
            if (DM_config.maxLvl.hasOwnProperty(ore)) {
                var value = DM_config.maxLvl[ore];
                $('select[name="DM_maxUpgLvlFilter_' + ore + '"]').val(value);
            }
        }

        $('[id^="DM_UpgradeMines_"]').prop('checked', false);
        $('[id^="DM_RebuildMines_"]').prop('checked', false);

        if (DM_UpgradeSwitchStatus) {
            DM_config.upgrade = DM_config.upgrade.filter(function (grid) {
                return (DM_runs.upgrade.active && DM_runs.upgrade.grids.indexOf(String(grid)) !== -1) ||
                    $('#DM_UpgradeMines_' + grid + ':enabled').length > 0;
            });
        } else {
            DM_config.build = DM_config.build.filter(function (grid) {
                return $('#DM_RebuildMines_' + grid).length > 0;
            });
        }

        DM_config.upgrade.forEach(function (grid) { $('#DM_UpgradeMines_' + grid + ':enabled').prop('checked', true); });
        DM_config.build.forEach(function (grid)   { $('#DM_RebuildMines_'  + grid).prop('checked', true); });

        var isOn = !!DM_config.stopAfterBuild;
        $('#' + DM_lements.STOP_AFTER_BUILD_BTN).css('opacity', isOn ? '1' : '0.4');
        $('#' + DM_lements.STOP_AFTER_BUILD_LABEL)
            .text(isOn ? DM_SwitchStatuses.AUTOSTOP_ON : DM_SwitchStatuses.AUTOSTOP_OFF)

        _DM_updateSelectAllOpacity();
    }

    function _DM_GoTo(g) {
        try {
            $('#DrunkenMinerModal').modal('hide');
            swmmo.application.mGameInterface.mCurrentPlayerZone.ScrollToGrid(g);
        } catch (e) {
            debug(e);
        }
    }

    function _DM_saveTmpSetting() {
        settings.settings[SCRIPT_PREFIX + 'SETTINGS'] = {};
        settings.store(DM_config, SCRIPT_PREFIX + 'SETTINGS');
    }

    // Ручной режим: один проход + проверка результата (тот же движок, без повторов)
    function _DM_buildMines(gridArr) {
        _DM_startRun(false, gridArr.slice(), true);
    }

    function _DM_upgradeMines(gridArr) {
        _DM_startRun(true, gridArr.slice(), true);
    }

    function _DM_getBuildingDataFromDeposit(deposit) {
        var bld = _DM_bld(deposit.GetGrid());
        if (!bld || typeof bld.GetBuildingName_string !== 'function') return null;

        var name = bld.GetBuildingName_string();
        if (
            RESOURCES.mines.indexOf(name) === -1 ||
            bld.isGarrison() ||
            name.toUpperCase().indexOf('EW_') !== -1 ||
            name.toUpperCase().indexOf('DECORATION_MOUNTAIN_PEAK') !== -1 ||
            name.toUpperCase().indexOf('BANDITS') !== -1
        ) {
            return null;
        }

        var locName = loca.GetText('BUI', name);
        if (locName.indexOf('[undefined text]') >= 0) locName = name;

        var level                       = bld.GetUIUpgradeLevel();
        var isUpgradable                = _DM_isUpgradableMine(name);
        var grid                        = bld.GetGrid();
        var resLeft                     = deposit.GetAmount();
        var secsToBuffEnd               = 0;
        var cycleSeconds                = bld.CalculateWays() / 1000;
        var resourcesRemovedEverySecond = 0;
        var timeStr                     = "";
        var buffName                    = "";
        var buff                        = bld.productionBuff;
        var isWorking                   = bld.IsProductionActive();
        var buffIcon                    = '';

        if (buff != null) {
            var app = buff.GetApplicanceMode();
            if (buff.IsActive(swmmo.application.mGameInterface.GetClientTime())) {
                secsToBuffEnd = new window.runtime.Date(Date.now() + (buff.GetStartTime() + buff.GetBuffDefinition().getDuration(app)) - swmmo.application.mGameInterface.GetClientTime());
                buffName      = loca.GetText("RES", buff.GetBuffDefinition().GetName_string());
                buffIcon      = buff.GetBuffDefinition().GetName_string();
            }
            if (secsToBuffEnd > 0) {
                timeStr = _DM_getDateFormatter().format(new window.runtime.Date(secsToBuffEnd));
            }
        }

        var rcd     = swmmo.getDefinitionByName("ServerState::gEconomics").GetResourcesCreationDefinitionForBuilding(name);
        var rcd_pck = 0;
        if (rcd != null) rcd_pck = rcd.amountRemoved;
        var totalRemoved = bld.GetResourceInputFactor() * rcd_pck;

        if (isWorking) resourcesRemovedEverySecond += (totalRemoved === 0 ? 0 : totalRemoved / cycleSeconds);

        return {
            'grid':               grid,
            'name':               name,
            'locName':            locName,
            'level':              level,
            "resourcesLeft":      resLeft,
            'isWorking':          bld.IsProductionActive(),
            'isUpgradeInProgress': _DM_isUpgradeBusy(bld),
            'isUpgradeBusy':      _DM_isUpgradeBusy(bld) || _DM_call(bld, 'IsWaitForCommand', false) ||
                DM_runs.upgrade.pending[String(grid)] !== undefined,
            'isUpgradeAllowed':   isUpgradable && bld.IsUpgradeAllowed(true),
            // Busy rows remain visible with a disabled checkbox.
            // Existing automation chains are preserved in DM_runs.upgrade.
            'isSelectable':       isUpgradable && level < DM_MaxUpgradeLvl && (bld.IsUpgradeAllowed(true) || _DM_isUpgradeBusy(bld) ||
                DM_runs.upgrade.pending[String(grid)] !== undefined),
            'buff':               buffName,
            'buffIcon':           buffIcon,
            'BufEndTime':         timeStr,
            "AmountRemoved":      totalRemoved,
            "SecondsToDeplete":   (resourcesRemovedEverySecond > 0 && resLeft > 0 ? (resLeft / resourcesRemovedEverySecond) : 0),
        };
    }

    var DM_dateFormatter = null;
    function _DM_getDateFormatter() {
        if (!DM_dateFormatter) {
            DM_dateFormatter = new window.runtime.flash.globalization.DateTimeFormatter("en-US");
            if (gameLang.indexOf("en-") > 0) DM_dateFormatter.setDateTimePattern("MM-dd-yyyy HH:mm");
            else DM_dateFormatter.setDateTimePattern("dd-MM HH:mm");
        }
        return DM_dateFormatter;
    }

    function _DM_pushUpgradeGridToConfig(grid, isChecked) {
        if (isChecked && !_DM_canChooseUpgrade(grid)) return;
        if (DM_config.upgrade.indexOf(grid) === -1 && isChecked) {
            DM_config.upgrade.push(grid);
        } else if (DM_config.upgrade.indexOf(grid) !== -1 && !isChecked) {
            DM_config.upgrade.splice(DM_config.upgrade.indexOf(grid), 1);
        }
    }

    function _DM_pushBuildGridToConfig(grid, isChecked) {
        if (DM_config.build.indexOf(grid) === -1 && isChecked) {
            DM_config.build.push(grid);
        } else if (DM_config.build.indexOf(grid) !== -1 && !isChecked) {
            DM_config.build.splice(DM_config.build.indexOf(grid), 1);
        }
    }

    function _DM_updateSelectAllOpacity() {
        var hasAnyOrangeChecked = false;
        RESOURCES.ores.forEach(function (oreName) {
            var hasChecked = false;
            var relatedCheckboxes = _DM_selectionCheckboxes().filter(function () {
                return this.name === oreName;
            });
            relatedCheckboxes.each(function () {
                var $cb = $(this);
                if ($cb.is(':checked')) {
                    hasChecked = true;
                    if (!hasAnyOrangeChecked) {
                        var $timeCell = $cb.parent().parent().find('div:eq(3)');
                        var timeText  = $timeCell.text().trim();
                        if (timeText.indexOf('/') !== -1) {
                            var parts = timeText.split('/');
                            var color = _DM_formatBuffTimeColor(parts[0].trim(), parts[1].trim());
                            if (color === 'orange') hasAnyOrangeChecked = true;
                        }
                    }
                    if (hasChecked && hasAnyOrangeChecked) return false;
                }
            });
            var selectAllElement = $('#DM_selectAll_' + oreName);
            if (selectAllElement.length > 0) {
                selectAllElement.css('opacity', hasChecked ? '1' : '.5');
            }
        });

        var allCheckboxes = _DM_selectionCheckboxes();
        var isAnyChecked  = allCheckboxes.is(':checked');
        $('#' + DM_lements.SELECT_ALL_BTN).css('opacity', isAnyChecked ? '1' : '.5');
        $('#' + DM_lements.SAFE_BUFF_BTN).css('opacity', hasAnyOrangeChecked ? '1' : '.5');
    }

    function _DM_findOreInDepletedName(depletedName) {
        var result = "";
        RESOURCES.ores.forEach(function (ore) {
            if (depletedName.indexOf(ore) !== -1) result = ore;
        });
        return result;
    }

    function _DM_ViewerSetTimeStr(seconds, type) {
        try {
            if (seconds < 1) return "";
            switch (type) {
                case 1:
                    return new Date(seconds * 1000).toISOString().slice(11, 19);
                case 2:
                    var d  = new Date(new Date(Date.now()).getTime() + seconds * 1000);
                    var _m = ("00" + (d.getMonth() + 1).toString()).slice(-2);
                    var _d = ("00" + d.getDate().toString()).slice(-2);
                    if (gameLang.indexOf("en-") > 0) return _m + "-" + _d + " " + d.toLocaleTimeString();
                    else return _d + "-" + _m + " " + d.toLocaleTimeString();
            }
        } catch (e) {
            debug(e);
        }
        return "";
    }

    function _DM_parseBuffDate(dateStr) {
        try {
            var parts    = dateStr.split(" ");
            var day      = parts[0];
            var time     = parts[1];
            var dayParts = day.split("-");
            var dd       = parseInt(dayParts[0], 10);
            var MM       = parseInt(dayParts[1], 10);
            var timeParts = time.split(":");
            var hh        = parseInt(timeParts[0], 10);
            var mm        = parseInt(timeParts[1], 10);
            var ss        = timeParts.length > 2 ? parseInt(timeParts[2], 10) : 0;
            var now       = new Date();
            return new Date(now.getFullYear(), MM - 1, dd, hh, mm, ss);
        } catch (e) {
            debug(e);
            return '';
        }
    }

    function _DM_formatBuffTimeColor(dateStr1, dateStr2) {
        const date1 = _DM_parseBuffDate(dateStr1);
        const date2 = _DM_parseBuffDate(dateStr2);
        return date1 > date2 ? "yellow" : "orange";
    }
})();