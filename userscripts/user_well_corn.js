const WellCorn = (function () {
    const SCRIPT_CONST = {
        PREFIX: 'WC',
        NAME: 'Well Corn',
        BUILD_TYPE: {well: 'well', corn: 'corn'},
        BUILD_NAMES: {
            WELL: 'Well_03',
            WELL_DEPLETED: 'MineDepletedDepositWater',
            CORN: 'Farmfield_03',
            CORN_DEPLETED: 'MineDepletedDepositCorn',
        }
    };

    const UIMap = {
        ids: {
            modal: SCRIPT_CONST.PREFIX + '_WellCornModal',
            modalData: SCRIPT_CONST.PREFIX + '_WellCornModalData',
            cornBtn: SCRIPT_CONST.PREFIX + '_CornBtn',
            wellBtn: SCRIPT_CONST.PREFIX + '_WellBtn',
            startBtn: SCRIPT_CONST.PREFIX + '_StartBtn',
            stopBtn: SCRIPT_CONST.PREFIX + '_StopBtn',
            counts: SCRIPT_CONST.PREFIX + '_Counts'
        },
        classes: {}
    };

    function openModal() {
        try {
            if (!game.gi.isOnHomzone()) {
                game.showAlert(getText('not_home'));
                return;
            }

            $("div[role='dialog']:not(#" + UIMap.ids.modal + "):visible").modal("hide");
            createModalWindow(UIMap.ids.modal, SCRIPT_CONST.NAME);

            UIRenderer.renderBody();
            UIRenderer.renderFooter();

            ActionService.bindEvents();
            ActionService.update();

            $('.modal-header').css('padding-top', '20px');
            $('#' + UIMap.ids.modal + ':not(:visible)').modal({backdrop: "static"});
        } catch (e) {
            debug(e);
        }
    }

    function init() {
        try {
            SettingsService.loadSettings();
            addToolsMenuItem(SCRIPT_CONST.NAME, openModal);
        } catch (e) {
            debug(e);
        }
    }

    const ActionService = (function () {

        function bindEvents() {
            $('#' + UIMap.ids.cornBtn).click(function () {
                setActiveTab(SCRIPT_CONST.BUILD_TYPE.corn);
            });
            $('#' + UIMap.ids.wellBtn).click(function () {
                setActiveTab(SCRIPT_CONST.BUILD_TYPE.well);
            });
            $('#' + UIMap.ids.startBtn).click(startBuilding);
            $('#' + UIMap.ids.stopBtn).click(stopBuilding);
        }

        function setActiveTab(tab) {
            var state = SettingsService.getState();
            state.data.activeTab = tab;
            SettingsService.setState(state);
            SettingsService.saveSettings();
            update();
        }

        function update() {
            var countData = getCount();
            UIRenderer.update(SettingsService.getActiveTab(), countData);
        }

        function getDepletedName() {
            return SettingsService.getState().data.activeTab === SCRIPT_CONST.BUILD_TYPE.corn ? SCRIPT_CONST.BUILD_NAMES.CORN_DEPLETED : SCRIPT_CONST.BUILD_NAMES.WELL_DEPLETED;
        }

        function getCount() {
            var name = getDepletedName();
            var count = 0;
            try {
                if (game.zone.mStreetDataMap && game.zone.mStreetDataMap.getBuildingsByName_vector) {
                    var buildings = game.zone.mStreetDataMap.getBuildingsByName_vector(name);
                    count = buildings ? buildings.length : 0;
                }
            } catch (e) {
                debug(e);
            }
            return {count: count, name: name};
        }

        function startBuilding() {
            BuildingService.setRunningStatus(true);
            BuildingService.startAutoBuild(SettingsService.getActiveTab());
            debug("Start building " + SettingsService.getActiveTab());
        }

        function stopBuilding() {
            BuildingService.setRunningStatus(false);
            debug("Stop building");
        }

        return {
            bindEvents: bindEvents,
            update: update,
        };
    })();

    const UIRenderer = (function () {
        function renderBody() {
            var $modalData = $('#' + UIMap.ids.modalData);
            $modalData.empty();

            var container = $('<div>', {'class': 'container-fluid'});

            // Row 1: Radio Buttons (Images)
            var row1 = $('<div>', {'class': 'row', 'style': 'text-align: center; margin-bottom: 15px;'});
            var col1 = $('<div>', {'class': 'col-xs-12'});

            var btnCorn = createIconButton(UIMap.ids.cornBtn, SCRIPT_CONST.BUILD_NAMES.CORN, '50px');
            var btnWell = createIconButton(UIMap.ids.wellBtn, SCRIPT_CONST.BUILD_NAMES.WELL, '50px');

            col1.append(btnCorn, btnWell);
            row1.append(col1);

            // Row 2: Counts Info
            var row2 = $('<div>', {'class': 'row', 'style': 'text-align: center; margin-bottom: 15px;'});
            var col2 = $('<div>', {'class': 'col-xs-12', 'id': UIMap.ids.counts, 'style': 'font-weight: bold;'});
            row2.append(col2);

            // Row 3: Start/Stop Buttons
            var row3 = $('<div>', {'class': 'row', 'style': 'text-align: center;'});
            var col3 = $('<div>', {'class': 'col-xs-12'});

            var btnStart = createIconButton(UIMap.ids.startBtn, 'ButtonIconStart', '35px');
            var btnStop = createIconButton(UIMap.ids.stopBtn, 'ButtonIconStop', '35px');

            col3.append(btnStart, btnStop);
            row3.append(col3);

            container.append(row1, row2, row3);
            $modalData.append(container);

            $('#' + UIMap.ids.modal).find('.modal-content').draggable({
                handle: '.modal-header',
                containment: 'window'
            });
        }

        function createIconButton(id, iconName, extraStyle) {
            var style = 'cursor: pointer; margin: 0 5px; transition: opacity 0.3s; display: inline-block;';
            return $('<div>', {'id': id, 'style': style})
                .append(getImageTag(iconName, extraStyle));
        }

        function renderFooter() {
            var $modal = $('#' + UIMap.ids.modal);
            var $footer = $modal.find('.modal-footer');
            $footer.empty();

            var btnClose = $('<button>', {
                'class': 'btn btn-secondary',
                'data-dismiss': 'modal'
            }).text(loca.GetText("LAB", "Close"));
            $footer.append(btnClose);
        }

        function update(activeTab, data) {
            // Update Visuals (Opacity)
            var btnCorn = $('#' + UIMap.ids.cornBtn);
            var btnWell = $('#' + UIMap.ids.wellBtn);

            if (activeTab === SCRIPT_CONST.BUILD_TYPE.corn) {
                btnCorn.css('opacity', '1');
                btnWell.css('opacity', '0.5');
            } else {
                btnCorn.css('opacity', '0.5');
                btnWell.css('opacity', '1');
            }

            // Update Counts
            $('#' + UIMap.ids.counts).html(getImageTag(data.name, '50px') + ' ' + data.count);
        }

        return {
            renderBody: renderBody,
            renderFooter: renderFooter,
            update: update
        };
    })();

    const SettingsService = (function () {
        var STATE = initStateData();

        function initStateData() {
            return {
                modalInitialized: false,
                data: {
                    activeTab: false
                }
            }
        }

        function loadSettings() {
            $.extend(STATE.data, settings.read(null, SCRIPT_CONST.PREFIX + '_SETTINGS'));
        }

        function saveSettings() {
            settings.settings[SCRIPT_CONST.PREFIX + '_SETTINGS'] = {};
            settings.store(STATE.data, SCRIPT_CONST.PREFIX + '_SETTINGS');
        }


        function getState() {
            return STATE;
        }

        function setState(state) {
            STATE = state;
        }

        function getActiveTab() {
            return STATE.data.activeTab;
        }

        return {
            getState: getState,
            setState: setState,
            loadSettings: loadSettings,
            saveSettings: saveSettings,
            getActiveTab: getActiveTab
        };
    })();

    const BuildingService = (function () {
        var isRunning = false;
        var currentQueue = 0;
        var currentQueueFree = 0;
        var queueTotal;
        var bldName, depletedBldName, depletedBuildings

        function startAutoBuild(type) {
            refreshData(type);
            if (isBuildsEmpty()) {
                isRunning = false;
                return false;
            }

            isRunning = true;
            NotifyService.notifyStartBuilding();

            handleAutoMode(type);
        }

        function handleAutoMode(type){
            refreshData(type);
            if (validateAutoMode()){
                buildBuildings(depletedBuildings, bldName);
                // setTimeout(function (){
                //     handleAutoMode(type);
                // },10000);
            }
        }

        function refreshData(type){
            bldName = getBuildingNameByType(type);
            depletedBldName = getDepletedBuildingNameByType(type);
            depletedBuildings = getDepletedBuildings(depletedBldName);
            initBuildQueue();
        }

        function validateAutoMode(){
            if(isBuildsEmpty())return false;
            if (currentQueueFree <= 0) return false;
            return isRunning;
        }

        function isBuildsEmpty(){
            if (depletedBuildings.length === 0) {
                NotifyService.notifyNothingToBuild()
                return true;
            }
            return false;
        }

        function initBuildQueue() {
            $.each(swmmo.application.mGameInterface.mHomePlayer.mBuildQueue.GetQueue_vector(), function () {
                currentQueue++;
            });
            queueTotal = swmmo.application.mGameInterface.mHomePlayer.mBuildQueue.GetTotalAvailableSlots();
            currentQueueFree = queueTotal - currentQueue;
        }

        function buildBuildings(depletedBuildings, bldName) {
            var x = new TimedQueue(3000);
            for (var i = 0; i < depletedBuildings.length; i++) {
                if (currentQueueFree <= 0) {
                    break;
                }
                var depletedBld = depletedBuildings[i];

                var gridId = depletedBld.GetGrid();
                var bldNrNumber = depletedBld.mGoGroup.GetNrFromName(bldName);

                (function (gridId, bldNrNumber) {
                    x.add(function () {
                        game.gi.SendServerAction(51, bldNrNumber, gridId, 0, null);
                        game.showAlert(
                            loca.GetText("BUI", "DefenseModeGhostGarrison") + ' ' +
                            loca.GetText("RES", bldName)
                        );
                    });
                })(gridId, bldNrNumber);

                currentQueueFree--;
            }
            x.run();
        }

        function getDepletedBuildings(depletedBldName) {
            var buildings = [];

            if (game.zone.mStreetDataMap && game.zone.mStreetDataMap.getBuildingsByName_vector) {
                buildings = game.zone.mStreetDataMap.getBuildingsByName_vector(depletedBldName);
            }
            return buildings;
        }

        function getDepletedBuildingNameByType(type) {
            if (type === SCRIPT_CONST.BUILD_TYPE.corn) {
                return SCRIPT_CONST.BUILD_NAMES.CORN_DEPLETED;
            }
            return SCRIPT_CONST.BUILD_NAMES.WELL_DEPLETED;
        }

        function getBuildingNameByType(type) {
            if (type === SCRIPT_CONST.BUILD_TYPE.corn) {
                return SCRIPT_CONST.BUILD_NAMES.CORN;
            }
            return SCRIPT_CONST.BUILD_NAMES.WELL;
        }

        function getRunningStatus() {
            return isRunning;
        }

        function setRunningStatus(status) {
            isRunning = status;
        }

        function toggleRunningStatus() {
            isRunning = !isRunning;
        }

        return {
            startAutoBuild: startAutoBuild,
            getRunningStatus: getRunningStatus,
            setRunningStatus: setRunningStatus,
            toggleRunningStatus: toggleRunningStatus
        }
    })()

    const NotifyService = (function () {
        function notifyStopBuilding() {
            game.showAlert('Construction completed.');
        }

        function notifyStartBuilding() {
            game.showAlert('Construction started.');
        }

        function notifyNothingToBuild() {
            game.showAlert('Nothing to build.');
        }

        return {
            notifyStartBuilding: notifyStartBuilding,
            notifyStopBuilding: notifyStopBuilding,
            notifyNothingToBuild: notifyNothingToBuild,
        }
    })()

    return {
        init: init,
    };
})();
WellCorn.init();