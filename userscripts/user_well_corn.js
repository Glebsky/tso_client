const WellCorn = (function () {
    const SCRIPT_CONST = {
        PREFIX: 'WC',
        NAME: 'Well Corn',
    };

    const UIMap = {
        ids: {
            modal: SCRIPT_CONST.PREFIX + '_WellCornModal',
            modalData: SCRIPT_CONST.PREFIX + '_WellCornModalData',
            cornBtn: SCRIPT_CONST.PREFIX + '_CornBtn',
            wellBtn: SCRIPT_CONST.PREFIX + '_WellBtn',
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

    const ActionService = (function() {
        var activeTab = 'corn';
        var isRunning = false;
        var wellDepletedName = 'MineDepletedDepositWell';

        function setActiveTab(tab) {
            activeTab = tab;
        }

        function getActiveTab() {
            return activeTab;
        }

        function getDepletedName() {
            return activeTab === 'corn' ? 'MineDepletedDepositCorn' : wellDepletedName;
        }

        function getCount() {
            var name = getDepletedName();
            var count = 0;
            try {
                if (game.zone.mStreetDataMap && game.zone.mStreetDataMap.GetNrFromName) {
                    count = game.zone.mStreetDataMap.GetNrFromName(name);
                }
            } catch(e) {
                // ignore
            }
            return { count: count, name: name };
        }

        function startBuilding() {
            isRunning = true;
            debug("Start building " + activeTab);
        }

        function stopBuilding() {
            isRunning = false;
            debug("Stop building");
        }

        return {
            setActiveTab: setActiveTab,
            getActiveTab: getActiveTab,
            getCount: getCount,
            startBuilding: startBuilding,
            stopBuilding: stopBuilding
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
            
            var style = 'cursor: pointer; margin: 0 5px; transition: opacity 0.3s;';
            
            var btnCorn = $('<div>', {'id': UIMap.ids.cornBtn, 'style': 'display: inline-block;' + style})
                .append(getImageTag('Farmfield_03', '24px'));
            
            var btnWell = $('<div>', {'id': UIMap.ids.wellBtn, 'style': 'display: inline-block;' + style})
                .append(getImageTag('Well', '24px'));

            function updateVisuals() {
                var activeTab = ActionService.getActiveTab();
                if (activeTab === 'corn') {
                    btnCorn.css('opacity', '1');
                    btnWell.css('opacity', '0.5');
                } else {
                    btnCorn.css('opacity', '0.5');
                    btnWell.css('opacity', '1');
                }
                updateCounts();
            }

            btnCorn.click(function() { ActionService.setActiveTab('corn'); updateVisuals(); });
            btnWell.click(function() { ActionService.setActiveTab('well'); updateVisuals(); });

            col1.append(btnCorn, btnWell);
            row1.append(col1);
            
            // Row 2: Counts Info
            var row2 = $('<div>', {'class': 'row', 'style': 'text-align: center; margin-bottom: 15px;'});
            var col2 = $('<div>', {'class': 'col-xs-12', 'id': UIMap.ids.counts, 'style': 'font-weight: bold;'});
            row2.append(col2);

            // Row 3: Start/Stop Buttons
            var row3 = $('<div>', {'class': 'row', 'style': 'text-align: center;'});
            var col3 = $('<div>', {'class': 'col-xs-12'});
            
            var btnStart = $('<button>', {'class': 'btn btn-success', 'style': 'margin-right: 5px;'}).text('Start').click(ActionService.startBuilding);
            var btnStop = $('<button>', {'class': 'btn btn-danger'}).text('Stop').click(ActionService.stopBuilding);
            
            col3.append(btnStart, btnStop);
            row3.append(col3);

            container.append(row1, row2, row3);
            $modalData.append(container);
            
            updateVisuals();
        }

        function renderFooter() {
            var $modal = $('#' + UIMap.ids.modal);
            var $footer = $modal.find('.modal-footer');
            $footer.empty();
            
            var btnClose = $('<button>', {'class': 'btn btn-secondary', 'data-dismiss': 'modal'}).text(loca.GetText("LAB", "Close"));
            $footer.append(btnClose);
        }

        function updateCounts() {
            var data = ActionService.getCount();
            $('#' + UIMap.ids.counts).html(loca.GetText("LAB", "Amount") + ': ' + data.count + ' (' + data.name + ')');
        }

        return {
            renderBody: renderBody,
            renderFooter: renderFooter
        };
    })();

    const SettingsService = (function () {
        var STATE = initStateData();

        function initStateData() {
            return {
                modalInitialized: false,
                data: {}
            }
        }

        function loadSettings(){
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

        return {
            getState: getState,
            setState: setState,
            loadSettings: loadSettings,
            saveSettings: saveSettings,
            resetState: resetState,
        };
    })();

    return {
        init: init,
    };
})();
WellCorn.init();