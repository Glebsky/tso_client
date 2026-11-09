// Userscript for TSO Client: Export Generals & Adventure Snapshot to Battle-Sim
// Install: copy this file to %LOCALAPPDATA%\tso_portable\userscripts\ and restart the game (or reload scripts).

function getLoca(category, id, fallback)
{
	try {
		if(typeof loca !== 'undefined' && loca && typeof loca.GetText === 'function') {
			var txt = loca.GetText(category, id);
			if(txt && typeof txt === 'string') {
				var low = txt.toLowerCase();
				if(low.indexOf('undefined') === -1 && low.indexOf('missing') === -1 && low.trim() !== '') {
					return txt;
				}
			}
		}
	} catch(e) {}
	return (fallback !== undefined && fallback !== null) ? fallback : id;
}

function getCombatMapLabel()
{
	return getLoca("LAB", "AttackOverview", "Карта места боя");
}

function getGeneralsLabel()
{
	var t = getLoca("ACL", "MilitarySpecialists", null);
	if(!t) { t = getLoca("SPE", "General", null); }
	if(!t) { t = getLoca("RES", "General", null); }
	if(!t) { t = getLoca("RES", "MilitarySpecialists", null); }
	if(!t) {
		var isRu = /[а-яА-ЯёЁ]/.test(getCombatMapLabel());
		t = isRu ? "Генералы" : "Generals";
	}
	return t;
}

function getMundaneWarfareLabel()
{
	var t = getLoca("ACL", "ExcelsiorLostCityBeforeRitual", null);
	if(!t) {
		var isRu = /[а-яА-ЯёЁ]/.test(getCombatMapLabel());
		t = isRu ? "Типичная война" : "Mundane Warfare";
	}
	return t;
}

function getScriptMenuLabel()
{
	return getMundaneWarfareLabel() + " / " + getCombatMapLabel();
}

addToolsMenuItem(getScriptMenuLabel(), exportMenuHandler);

var EXPORT_TYPE_TO_BASE = {
	0: 'General',
	1: 'General',
	3: 'General',
	7: 'HalloweenGeneral',
	8: 'General',
	9: 'EasterGeneral',
	11: 'General',
	13: 'MajorGeneral',
	14: 'StarGeneral1',
	15: 'StarGeneral2',
	16: 'StarGeneral3',
	24: 'General',
	25: 'LordDraculGeneral',
	27: 'SantaGeneral',
	29: 'GeneralVargus',
	30: 'GeneralAnslem',
	31: 'GeneralNusala',
	33: 'Xmas2019General',
	36: 'MedicGeneral',
	37: 'MadScientistGeneral',
	47: 'MajorGeneral',
	50: 'Halloween2019General',
	56: 'AssassinGeneral',
	57: 'SylvanaGeneral',
	63: 'GhostGeneral',
	75: 'NutcrackerGeneral',
	79: 'ResoluteGeneral',
	85: 'GeneralJuan',
	96: 'NarcissisticGeneral'
};

var GENERAL_ICONS_MAP = {
	'MajorGeneral': ['icon_majorgeneral', 'MajorGeneral'],
	'BorisGeneral': ['icon_borisgeneral', 'BorisGeneral'],
	'GhostGeneral': ['icon_ghostgeneral', 'icon_ghostgeneral_2', 'GhostGeneral'],
	'Halloween2019General': ['icon_halloween2019general', 'icon_halloween2019general_2', 'Halloween2019General'],
	'Anniversary2019General': ['icon_anniversary2019general', 'icon_anniversary2019general_2', 'Anniversary2019General'],
	'SylvanaGeneral': ['icon_sylvanageneral', 'SylvanaGeneral'],
	'AssassinGeneral': ['icon_assassingeneral', 'icon_assassingeneral_2', 'AssassinGeneral'],
	'GeneralVargus': ['icon_generalvargus', 'GeneralVargus'],
	'GeneralAnslem': ['icon_generalanslem', 'GeneralAnslem'],
	'GeneralNusala': ['icon_generalnusala', 'GeneralNusala'],
	'GeneralMary': ['icon_generalmary', 'icon_generalmary_2', 'GeneralMary'],
	'EasterGeneral': ['icon_eastergeneral', 'MasterEasterGeneral', 'EasterGeneral'],
	'LordDraculGeneral': ['icon_halloweengeneraldracul', 'HalloweenGeneralDracul'],
	'HalloweenGeneral': ['icon_halloweengeneral', 'HalloweenGeneral'],
	'Xmas2019General': ['icon_xmas2019general', 'icon_xmas2019general_2', 'Xmas2019General'],
	'MedicGeneral': ['icon_medicgeneral', 'icon_medicgeneral_2', 'MedicGeneral'],
	'MadScientistGeneral': ['icon_madscientistgeneral', 'icon_madscientistgeneral_2', 'MadScientistGeneral'],
	'NutcrackerGeneral': ['icon_nutcrackergeneral', 'icon_nutcrackergeneral_2', 'NutcrackerGeneral'],
	'ResoluteGeneral': ['icon_resolutegeneral', 'icon_resolutegeneral_2', 'ResoluteGeneral'],
	'NarcissisticGeneral': ['icon_generalloudmouth', 'GeneralLoudmouth', 'icon_general'],
	'StarGeneral1': ['StarGeneral1', 'icon_general'],
	'StarGeneral2': ['icon_stargeneral2', 'StarGeneral2'],
	'StarGeneral3': ['icon_stargeneral3', 'StarGeneral3'],
	'GeneralJuan': ['GeneralJuanGarrison', 'icon_general'],
	'SantaGeneral': ['SantaGeneral', 'specialist_santa_general', 'icon_general'],
	'General': ['icon_general', 'General', 'specialist_general']
};

var EXPORT_SKILL_MAP = {
	"0": "Skill_IncreaseBowmanMaximumAD",
	"1": "Skill_IncreaseXP",
	"2": "Skill_IncreaseGeneralSplashAndAD",
	"3": "Skill_DescreaseBossHP",
	"4": "Skill_IncreaseLongbowmanAndMarksmanAD",
	"5": "Skill_IncreaseCavalryAD",
	"6": "Skill_IncreaseMilitiaAndSwordsmanAD",
	"7": "Skill_ReduceTravelTime",
	"8": "Skill_IncreaseRecruitAD",
	"9": "Skill_IncreaseBossAndGeneralAD",
	"10": "Skill_IncreaseSoldierAndMountedMarksmanAD",
	"11": "Skill_IncreaseRevivalChance",
	"12": "Skill_GarrisonAnnex",
	"13": "Skill_IncreaseEliteTroopsAD",
	"14": "Skill_IncreaseCannoneerAndBesiegerAD",
	"15": "Skill_IncreaseGeneralCombatSpeed",
	"16": "Skill_InstantRecovery",
	"17": "Skill_ExtraCasualtiesAndAD",
	"18": "Skill_EnemyDefenceReduction",
	"19": "Skill_BountyHunt"
};

var exportGeneralsLastData = null;
var exportSnapshotLastData = null;

function exportGeneralsFallbackBase(name)
{
	var lower = (name || "").toLowerCase();
	if(lower.indexOf('призрак') >= 0 || lower.indexOf('ghost') >= 0 || lower.indexOf('geist') >= 0 || lower.indexOf('duch') >= 0) return 'GhostGeneral';
	if(lower.indexOf('младш') >= 0 || lower.indexOf('younger') >= 0 || lower.indexOf('близнец') >= 0 || lower.indexOf('jüngere') >= 0 || lower.indexOf('młodszy') >= 0) return 'Halloween2019General';
	if(lower.indexOf('старш') >= 0 || lower.indexOf('older') >= 0 || lower.indexOf('ältere') >= 0 || lower.indexOf('starszy') >= 0) return 'Anniversary2019General';
	if(lower.indexOf('мастер') >= 0 || lower.indexOf('mma') >= 0 || lower.indexOf('meister') >= 0 || lower.indexOf('mistrz') >= 0) return 'EasterGeneral';
	if(lower.indexOf('майор') >= 0 || lower.indexOf('major') >= 0) return 'MajorGeneral';
	if(lower.indexOf('варвар') >= 0 || lower.indexOf('barbarian') >= 0) return 'StarGeneral1';
	if(lower.indexOf('сильван') >= 0 || lower.indexOf('sylvan') >= 0) return 'SylvanaGeneral';
	if(lower.indexOf('ассасин') >= 0 || lower.indexOf('assassin') >= 0 || lower.indexOf('skrytobójca') >= 0) return 'AssassinGeneral';
	if(lower.indexOf('медик') >= 0 || lower.indexOf('medic') >= 0 || lower.indexOf('sanitäter') >= 0 || lower.indexOf('medyk') >= 0) return 'MedicGeneral';
	if(lower.indexOf('учен') >= 0 || lower.indexOf('scientist') >= 0 || lower.indexOf('wissenschaft') >= 0 || lower.indexOf('szalony') >= 0) return 'MadScientistGeneral';
	if(lower.indexOf('щелкунчик') >= 0 || lower.indexOf('nutcracker') >= 0 || lower.indexOf('nussknacker') >= 0 || lower.indexOf('dziadek') >= 0) return 'NutcrackerGeneral';
	if(lower.indexOf('хуан') >= 0 || lower.indexOf('juan') >= 0) return 'GeneralJuan';
	if(lower.indexOf('решительн') >= 0 || lower.indexOf('resolute') >= 0 || lower.indexOf('standhafte') >= 0 || lower.indexOf('stanowczy') >= 0) return 'ResoluteGeneral';
	if(lower.indexOf('клаус') >= 0 || lower.indexOf('claus') >= 0 || lower.indexOf('mikołaj') >= 0) return 'Xmas2019General';
	if(lower.indexOf('жнец') >= 0 || lower.indexOf('reaper') >= 0 || lower.indexOf('sensenmann') >= 0 || lower.indexOf('żniwiarz') >= 0) return 'HalloweenGeneral';
	if(lower.indexOf('нарцис') >= 0 || lower.indexOf('narciss') >= 0 || lower.indexOf('loudmouth') >= 0 || lower.indexOf('angeber') >= 0) return 'NarcissisticGeneral';
	if(lower.indexOf('варгус') >= 0 || lower.indexOf('vargus') >= 0) return 'GeneralVargus';
	if(lower.indexOf('анслем') >= 0 || lower.indexOf('anslem') >= 0) return 'GeneralAnslem';
	if(lower.indexOf('нусала') >= 0 || lower.indexOf('nusala') >= 0) return 'GeneralNusala';
	if(lower.indexOf('борис') >= 0 || lower.indexOf('boris') >= 0) return 'BorisGeneral';
	if(lower.indexOf('мери') >= 0 || lower.indexOf('mary') >= 0) return 'GeneralMary';
	return 'General';
}

function resolveSpecialistIcon(item, base, size)
{
	var s = size || '24px';
	var tried = {};

	function tryTag(name) {
		if(!name || tried[name]) return null;
		tried[name] = true;
		try {
			if(typeof getImageTag === 'function') {
				var tag = getImageTag(name, s, s);
				// If bitmap was found, utils.getImage outputs an <img ...> tag.
				// If missing, utils.getImage outputs an empty grey box <span style="... background-color: #ccc;">.
				if(tag && tag.indexOf('<img') >= 0) {
					return tag;
				}
			}
		} catch(e) {}
		return null;
	}

	// 1. Try item direct icon ID if available
	if(item) {
		try {
			if(typeof item.getIconID === 'function') {
				var id = item.getIconID();
				if(id) {
					var r1 = tryTag(id) || tryTag(id.replace('.png', '')) || tryTag(id + '.png');
					if(r1) return r1;
				}
			}
		} catch(e) {}
	}

	// 2. Try mapped icon IDs from verified TSO icon catalog by general base
	var baseKey = base || (item && typeof item.GetType === 'function' ? EXPORT_TYPE_TO_BASE[item.GetType()] : '');
	if(baseKey && GENERAL_ICONS_MAP[baseKey]) {
		var list = GENERAL_ICONS_MAP[baseKey];
		for(var i = 0; i < list.length; i++) {
			var cand = list[i];
			var r2 = tryTag(cand) || tryTag(cand + '.png') || tryTag(cand.replace('.png', ''));
			if(r2) return r2;
		}
	}

	// 3. Try specialist description
	if(item) {
		try {
			if(typeof item.GetSpecialistDescription === 'function') {
				var desc = item.GetSpecialistDescription();
				if(desc) {
					if(desc.icon_string) {
						var r3 = tryTag(desc.icon_string) || tryTag(desc.icon_string.replace('.png', '')) || tryTag(desc.icon_string + '.png');
						if(r3) return r3;
					}
					if(typeof desc.getName_string === 'function') {
						var ns = desc.getName_string();
						var r4 = tryTag(ns) || tryTag(ns.replace('.png', '')) || tryTag(ns + '.png');
						if(r4) return r4;
					}
				}
			}
		} catch(e) {}

		try {
			if(typeof item.GetType === 'function') {
				var t = item.GetType();
				var r5 = tryTag('icon_general_' + t) || tryTag('icon_general_' + t + '.png');
				if(r5) return r5;
			}
		} catch(e) {}
	}

	// 4. Universal fallbacks
	var fallbacks = ['icon_general', 'icon_general.png', 'General', 'General.png', 'IconAllGenerals', 'SwordsIconGeneral'];
	for(var j = 0; j < fallbacks.length; j++) {
		var rFb = tryTag(fallbacks[j]);
		if(rFb) return rFb;
	}

	// 5. Ultimate fallback: styled emoji icon badge (NEVER an empty grey rectangle)
	return '<span style="display:inline-block;width:' + s + ';height:' + s + ';line-height:' + s + ';text-align:center;font-size:14px;vertical-align:middle;">⚔️</span>';
}

function stripInternalFields(specialists)
{
	if(!specialists || !specialists.length) return [];
	return specialists.map(function(s) {
		var copy = {};
		for(var k in s) {
			if(k !== 'iconHtml') copy[k] = s[k];
		}
		return copy;
	});
}

function getActiveAdventureInfo()
{
	var isAdv = false;
	var advName = "";
	var advKey = "";
	var zoneId = 0;

	try {
		var gi = (typeof swmmo !== 'undefined' && swmmo && swmmo.application)
			? swmmo.application.mGameInterface
			: (typeof game !== 'undefined' && game ? game.gi : null);

		if(gi) {
			zoneId = gi.mCurrentViewedZoneID || (gi.mCurrentPlayerZone ? gi.mCurrentPlayerZone.mZoneID : 0);

			var homeZoneId = 1;
			if(gi.mCurrentPlayer && typeof gi.mCurrentPlayer.GetHomeZoneId === 'function') {
				homeZoneId = gi.mCurrentPlayer.GetHomeZoneId() || 1;
			}

			var isHome = false;
			if(typeof gi.isOnHomzone === 'function') {
				isHome = !!gi.isOnHomzone();
			} else if(typeof gi.isOnHomeZone === 'function') {
				isHome = !!gi.isOnHomeZone();
			} else if(zoneId === homeZoneId || zoneId === 1) {
				isHome = true;
			}

			if(typeof gi.IsAdventureZone === 'function') {
				isAdv = !!gi.IsAdventureZone();
			} else if(gi.mCurrentPlayer && gi.mCurrentPlayer.mIsAdventureZone) {
				isAdv = !isHome;
			} else {
				isAdv = !isHome && zoneId > 1 && zoneId !== homeZoneId;
			}
		}

		if(typeof swmmo !== 'undefined' && swmmo.getDefinitionByName) {
			var AdvManagerClass = swmmo.getDefinitionByName("com.bluebyte.tso.adventure.logic::AdventureManager");
			if(AdvManagerClass && typeof AdvManagerClass.getInstance === 'function') {
				var advManager = AdvManagerClass.getInstance();
				if(advManager && typeof advManager.getAdventures === 'function') {
					var advList = advManager.getAdventures();
					if(advList) {
						advList.forEach(function(item) {
							if(item && item.zoneID === zoneId) {
								isAdv = true;
								advKey = item.adventureName || "";
								if(typeof loca !== 'undefined' && loca.GetText) {
									advName = loca.GetText("ADN", advKey);
								} else {
									advName = advKey;
								}
							}
						});
					}
				}
			}
		}
	} catch(e) {}

	if(isAdv && !advName) {
		advName = advKey || (getLoca("LAB", "Adventures", "Adventure") + " #" + zoneId);
	}
	if(!isAdv) {
		advName = getLoca("ACL", "HomeIsland", "Home Island");
	}

	return {
		isAdventure: isAdv,
		adventureName: advName,
		adventureKey: advKey,
		zoneId: zoneId
	};
}

function getActiveZoneObject()
{
	if(typeof swmmo !== 'undefined' && swmmo && swmmo.application && swmmo.application.mGameInterface) {
		if(swmmo.application.mGameInterface.mCurrentPlayerZone) {
			return swmmo.application.mGameInterface.mCurrentPlayerZone;
		}
	}
	if(typeof game !== 'undefined' && game) {
		if(game.gi && game.gi.mCurrentPlayerZone) return game.gi.mCurrentPlayerZone;
		if(game.zone) return game.zone;
	}
	return null;
}

function exportGeneralsCollect()
{
	var specialists = [];
	try {
		var armySPECIALIST_TYPE = (typeof swmmo !== 'undefined' && swmmo && swmmo.getDefinitionByName)
			? swmmo.getDefinitionByName("Enums::SPECIALIST_TYPE")
			: null;

		var curZone = getActiveZoneObject();
		var specsVector = curZone && typeof curZone.GetSpecialists_vector === 'function'
			? curZone.GetSpecialists_vector()
			: (game && game.gi && game.gi.mCurrentPlayerZone ? game.gi.mCurrentPlayerZone.GetSpecialists_vector() : null);

		if(!specsVector) { return { specialists: [], skillMap: EXPORT_SKILL_MAP }; }

		var sortFn = (typeof specNameSorter === 'function') ? specNameSorter : null;
		if(sortFn) {
			try { specsVector.sort(sortFn); } catch(sErr) {}
		}

		var myPlayerId = (game && game.player && typeof game.player.GetPlayerId === 'function') ? game.player.GetPlayerId() : 0;

		specsVector.forEach(function(item) {
			try {
				if(!item || typeof item === 'undefined') { return; }
				if(myPlayerId > 0 && typeof item.getPlayerID === 'function' && item.getPlayerID() !== myPlayerId) {
					return;
				}

				var isGen = false;
				if(armySPECIALIST_TYPE && typeof armySPECIALIST_TYPE.IsGeneral === 'function') {
					isGen = armySPECIALIST_TYPE.IsGeneral(item.GetType());
				} else if(typeof item.GetBaseType === 'function') {
					isGen = (item.GetBaseType() === 1 || item.GetBaseType() === 3);
				}
				if(!isGen) { return; }

				if(item.GetSpecialistDescription && typeof item.GetSpecialistDescription === 'function') {
					var descObj = item.GetSpecialistDescription();
					if(descObj && typeof descObj.isTransportGeneral === 'function' && descObj.isTransportGeneral()) {
						return;
					}
				}

				var uniqId = item.GetUniqueID().toKeyString();
				var rawName = item.getName(false);
				var cleanName = rawName.replace(/<[^>]+>/g, "").trim();
				var type = item.GetType();
				var base = EXPORT_TYPE_TO_BASE[type] || exportGeneralsFallbackBase(cleanName);

				var skills = {};
				var totalSkillPoints = 0;
				if(item.getSkillTree && item.getSkillTree()) {
					item.getSkillTree().getItems_vector().forEach(function(skill, index) {
						var lvl = skill.getLevel();
						if(lvl > 0) {
							skills[String(index)] = lvl;
							totalSkillPoints += lvl;
						}
					});
				}

				var baseCap = 200;
				if(item.GetSpecialistDescription && typeof item.GetSpecialistDescription === 'function') {
					var d = item.GetSpecialistDescription();
					if(d && typeof d.GetMaxUnits === 'function') {
						baseCap = d.GetMaxUnits() || 200;
					}
				}
				var capBonus = (skills["12"] ? Number(skills["12"]) * 5 : 0);
				var capacity = baseCap + capBonus;

				var garrisonGrid = 0;
				try {
					if(typeof item.GetGarrisonGridIdx === 'function') {
						garrisonGrid = item.GetGarrisonGridIdx() || 0;
					} else if(typeof item.GetGarrisonGrid === 'function') {
						garrisonGrid = item.GetGarrisonGrid() || 0;
					} else if(typeof item.getGrid === 'function') {
						garrisonGrid = item.getGrid() || 0;
					}
				} catch(gErr) {}

				var iconHtml = resolveSpecialistIcon(item, base, '24px');

				specialists.push({
					id: uniqId,
					name: cleanName,
					rawName: rawName.indexOf('<b') >= 0 ? rawName : '<b>' + rawName + '</b>',
					base: base,
					type: type,
					grid: garrisonGrid,
					capacity: capacity,
					skills: skills,
					skillPoints: totalSkillPoints,
					iconId: (typeof item.getIconID === 'function' ? item.getIconID() : ''),
					iconHtml: iconHtml
				});
			} catch(err) {
				debug("Error reading general: " + err);
			}
		});
	} catch(e) {
		alert(getGeneralsLabel() + " Error: " + e);
	}

	return {
		specialists: specialists,
		skillMap: EXPORT_SKILL_MAP,
		exportedAt: new Date().toISOString()
	};
}

function calcPathDistance(startGrid, destGrid)
{
	try {
		if(typeof game !== 'undefined' && game && game.gi && game.gi.mPathFinder && typeof game.gi.mPathFinder.CalculatePath === 'function') {
			var path = game.gi.mPathFinder.CalculatePath(destGrid, startGrid, null, true);
			if(path && path.pathLenX10000 > 0) {
				return Math.round(path.pathLenX10000 / 100) / 100;
			}
		}
	} catch(pErr) {}

	if(startGrid > 0 && destGrid > 0) {
		var W = 64;
		var dx = (startGrid % W) - (destGrid % W);
		var dy = Math.floor(startGrid / W) - Math.floor(destGrid / W);
		return Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10;
	}
	return 0;
}

function exportAdventureCampsCollect(curZone)
{
	var camps = [];
	try {
		if(!curZone || !curZone.mStreetDataMap) return camps;
		var bldVector = null;
		if(typeof curZone.mStreetDataMap.GetBuildings_vector === 'function') {
			bldVector = curZone.mStreetDataMap.GetBuildings_vector();
		}
		if(!bldVector) return camps;

		bldVector.forEach(function(bld) {
			try {
				if(!bld) return;
				var bldName = "";
				if(typeof bld.GetBuildingName_string === 'function') {
					bldName = bld.GetBuildingName_string() || "";
				}

				var isLeader = false;
				try {
					if(typeof bld.IsLeaderCamp === 'function') {
						isLeader = !!bld.IsLeaderCamp();
					} else if(bld.mIsLeaderCamp) {
						isLeader = true;
					} else if(/leader|boss/i.test(bldName)) {
						isLeader = true;
					}
				} catch(leadErr) {}

				var isBandit = false;
				if(typeof bld.IsBanditCamp === 'function') {
					isBandit = bld.IsBanditCamp();
				} else if(bldName.indexOf("Bandit") >= 0 || bldName.indexOf("Camp") >= 0 || bldName.indexOf("Leader") >= 0 || isLeader) {
					isBandit = true;
				}

				if(!isBandit && !isLeader && bldName.indexOf("Bandit") < 0 && bldName.indexOf("Camp") < 0) return;

				var hp = 1;
				if(typeof bld.GetHitPoints === 'function') {
					hp = bld.GetHitPoints();
				}
				if(hp <= 0) return;

				var grid = 0;
				if(typeof bld.GetGrid === 'function') {
					grid = bld.GetGrid() || 0;
				}

				var entryGrid = grid;
				if(typeof bld.GetStreetGridEntry === 'function') {
					entryGrid = bld.GetStreetGridEntry() || grid;
				}

				var sector = 0;
				try {
					if(curZone && curZone.mStreetDataMap && curZone.mStreetDataMap.mAdditionalData) {
						var sectorMod = (typeof game !== 'undefined' && game && game.def) ? game.def("Map::AdditionalDataTSO").Sector : 0;
						sector = curZone.mStreetDataMap.mAdditionalData.get(grid, sectorMod) || 0;
					}
				} catch(secErr) {}

				var units = {};
				if(typeof bld.GetArmy === 'function' && bld.GetArmy()) {
					var armyObj = bld.GetArmy();
					if(typeof armyObj.GetSquads_vector === 'function') {
						var squads = armyObj.GetSquads_vector();
						if(squads) {
							squads.forEach(function(sq) {
								if(sq && typeof sq.GetType === 'function' && typeof sq.GetAmount === 'function') {
									var uType = sq.GetType();
									var uAmt = sq.GetAmount();
									if(uAmt > 0) units[uType] = uAmt;
								}
							});
						}
					}
				}

				var locName = "";
				if(bldName) {
					locName = getLoca("BUI", bldName, "");
					if(!locName || locName === bldName) {
						locName = getLoca("LAB", bldName, "");
					}
				}
				if(!locName) locName = bldName;

				camps.push({
					grid: grid,
					entryGrid: entryGrid,
					sector: sector,
					buildingKey: bldName,
					name: locName,
					isLeader: isLeader,
					hp: hp,
					units: units
				});
			} catch(bldErr) {}
		});
	} catch(e) {}
	return camps;
}

function exportAdventureSnapshotCollect()
{
	var curZone = getActiveZoneObject();
	var advInfo = getActiveAdventureInfo();
	var genData = exportGeneralsCollect();
	var camps = exportAdventureCampsCollect(curZone);

	// Compute real game distances from placed generals to each camp
	// to enable precise interception and safe attack timeout calculations
	genData.specialists.forEach(function(gen) {
		if(gen.grid > 0) {
			gen.distancesToCamps = {};
			camps.forEach(function(camp) {
				var d = calcPathDistance(gen.grid, camp.entryGrid || camp.grid);
				if(d > 0) {
					gen.distancesToCamps[camp.grid] = d;
					camp.distances = camp.distances || {};
					camp.distances[gen.id] = d;
				}
			});
		}
	});

	// Distance between camps to prevent cross-camp interception
	for(var ci = 0; ci < camps.length; ci++) {
		var c1 = camps[ci];
		c1.distancesToOtherCamps = {};
		for(var cj = 0; cj < camps.length; cj++) {
			if(ci !== cj) {
				var c2 = camps[cj];
				var cd = calcPathDistance(c1.entryGrid || c1.grid, c2.entryGrid || c2.grid);
				if(cd > 0) {
					c1.distancesToOtherCamps[c2.grid] = cd;
				}
			}
		}
	}

	return {
		type: "adventure_snapshot",
		version: 1,
		isAdventure: advInfo.isAdventure,
		adventureName: advInfo.adventureName,
		adventureKey: advInfo.adventureKey,
		zoneId: advInfo.zoneId,
		exportedAt: new Date().toISOString(),
		campsCount: camps.length,
		camps: camps,
		specialists: genData.specialists,
		skillMap: EXPORT_SKILL_MAP
	};
}

function exportGeneralsCopyToClipboard(text)
{
	try {
		if(typeof air !== 'undefined' && air.Clipboard && air.Clipboard.generalClipboard) {
			air.Clipboard.generalClipboard.clear();
			air.Clipboard.generalClipboard.setData(air.ClipboardFormats.TEXT_FORMAT, text, false);
			return true;
		}
	} catch(e) {}

	try {
		if(navigator && navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text);
			return true;
		}
	} catch(e) {}

	try {
		var $temp = $("<textarea>");
		$("body").append($temp);
		$temp.val(text).select();
		document.execCommand("copy");
		$temp.remove();
		return true;
	} catch(e) {}

	return false;
}

function exportGeneralsSaveFile(jsonStr, fileName)
{
	var name = fileName || "generals.json";
	try {
		if(typeof air !== 'undefined' && air && air.File) {
			var baseDir = air.File.documentsDirectory;
			if(typeof mainSettings !== 'undefined' && mainSettings && mainSettings.shortcutsDir) {
				try { baseDir = new air.File(mainSettings.shortcutsDir); } catch(eDir) {}
			}
			var file = baseDir.resolvePath(name);
			file.addEventListener(air.Event.COMPLETE, function(ev) {
				var savedTarget = ev && ev.target ? ev.target : file;
				var savedPath = savedTarget.nativePath || name;
				var msg = getLoca("LAB", "Save", "Save") + " " + getLoca("LAB", "Complete", "OK") + ": " + savedPath;
				if(typeof showGameAlert === 'function') {
					showGameAlert(msg);
				} else {
					alert(msg);
				}
				if($('#exportStatusMsg').length) {
					$('#exportStatusMsg').html('✓ ' + msg);
				}
			});
			// file.save() opens the native OS Save As dialog just like SaveLoadTemplate in user_shortcut_trader.js
			file.save(jsonStr, name);
			return true;
		}
	} catch(airErr) {
		try { debug("AIR File save error: " + airErr); } catch(dErr) {}
	}

	try {
		var blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
		var url = URL.createObjectURL(blob);
		var a = document.createElement("a");
		a.href = url;
		a.download = name;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		var bMsg = getLoca("LAB", "Save", "Save") + " " + getLoca("LAB", "Complete", "OK") + ": " + name;
		if($('#exportStatusMsg').length) {
			$('#exportStatusMsg').html('✓ ' + bMsg);
		}
		return true;
	} catch(e) {
		alert(getLoca("LAB", "Save", "Save") + " Error: " + e);
	}
	return false;
}

function renderExportModal(defaultAction)
{
	// Clean up any stale modal elements, overlays, and styles
	$('#tsoExportModalStyles').remove();
	$('#exportGeneralsStyle').remove();
	$('#exportGeneralsModal').remove();
	$('.modal-backdrop').remove();

	// Close other open dialogs
	$("div[role='dialog']:visible").modal("hide");

	// Create modal window cleanly from template
	createModalWindow('exportGeneralsModal', getScriptMenuLabel());

	// Injected clean layout styles with proper top margins and ZERO box-shadows
	$("head").append($("<style>", { 'id': 'exportGeneralsStyle' }).text(
		'#exportGeneralsModal, #exportGeneralsModal .modal-dialog, #exportGeneralsModal .modal-content {' +
		'  box-shadow: none !important;' +
		'  -webkit-box-shadow: none !important;' +
		'  border: none !important;' +
		'  outline: none !important;' +
		'}' +
		'#exportGeneralsModal {' +
		'  overflow: hidden !important;' +
		'}' +
		'#exportGeneralsModal .modal-dialog {' +
		'  margin: 60px auto !important;' +
		'  max-width: 860px !important;' +
		'  overflow: hidden !important;' +
		'}' +
		'#exportGeneralsModal .modal-content {' +
		'  height: 90%;' +
		'  background: transparent !important;' +
		'  overflow: hidden !important;' +
		'}' +
		'#exportGeneralsModal .modal-header {' +
		'  padding: 16px 22px 10px 22px !important;' +
		'  box-shadow: none !important;' +
		'  -webkit-box-shadow: none !important;' +
		'}' +
		'#exportGeneralsModal .modal-title {' +
		'  margin-top: 6px !important;' +
		'  margin-bottom: 2px !important;' +
		'  font-size: 15px !important;' +
		'  font-weight: bold !important;' +
		'  color: #ffffff !important;' +
		'}' +
		'#exportGeneralsModal .modal-body {' +
		'  height: calc(100% - 145px) !important;' +
		'  max-height: calc(100% - 145px) !important;' +
		'  overflow-x: hidden !important;' +
		'  overflow-y: auto !important;' +
		'  padding: 14px 20px 10px 20px !important;' +
		'  box-shadow: none !important;' +
		'  -webkit-box-shadow: none !important;' +
		'}' +
		'#exportGeneralsModal .modal-footer {' +
		'  padding: 12px 20px 14px 20px !important;' +
		'  box-shadow: none !important;' +
		'  -webkit-box-shadow: none !important;' +
		'}' +
		'#exportGeneralsModal .container-fluid, #exportGeneralsModal .modal-body .container-fluid {' +
		'  overflow: visible !important;' +
		'  height: auto !important;' +
		'  user-select: text;' +
		'}' +
		'#exportGeneralsModal .row div {' +
		'  line-height: 24px;' +
		'}' +
		'#exportGeneralsModal .row.tblHeader div {' +
		'  line-height: 23px;' +
		'}' +
		'#exportGeneralsModal .btnExportDynamic {' +
		'  margin-right: 6px !important;' +
		'  font-size: 11px !important;' +
		'  padding: 4px 8px !important;' +
		'}'
	));

	var titleIcon = resolveSpecialistIcon(null, 'General', '22px');
	$('#exportGeneralsModal .modal-title').html(titleIcon + getScriptMenuLabel());

	exportSnapshotLastData = exportAdventureSnapshotCollect();
	exportGeneralsLastData = {
		specialists: stripInternalFields(exportSnapshotLastData.specialists),
		skillMap: exportSnapshotLastData.skillMap,
		exportedAt: exportSnapshotLastData.exportedAt
	};

	var isAdv = exportSnapshotLastData.isAdventure;
	var advName = exportSnapshotLastData.adventureName;
	var campsCount = exportSnapshotLastData.campsCount;
	var genCount = exportSnapshotLastData.specialists.length;

	var snapshotCleanData = {
		type: exportSnapshotLastData.type,
		version: exportSnapshotLastData.version,
		isAdventure: exportSnapshotLastData.isAdventure,
		adventureName: exportSnapshotLastData.adventureName,
		adventureKey: exportSnapshotLastData.adventureKey,
		zoneId: exportSnapshotLastData.zoneId,
		exportedAt: exportSnapshotLastData.exportedAt,
		campsCount: exportSnapshotLastData.campsCount,
		camps: exportSnapshotLastData.camps,
		specialists: stripInternalFields(exportSnapshotLastData.specialists),
		skillMap: exportSnapshotLastData.skillMap
	};

	var snapshotJsonStr = JSON.stringify(snapshotCleanData, null, 2);
	var generalsJsonStr = JSON.stringify(exportGeneralsLastData, null, 2);

	var autoCopied = false;
	if(isAdv) {
		autoCopied = exportGeneralsCopyToClipboard(snapshotJsonStr);
	} else {
		autoCopied = exportGeneralsCopyToClipboard(generalsJsonStr);
	}

	var out = '<div class="container-fluid">';

	// Header Info Line with nice top/bottom spacing directly on TSO background
	out += '<div style="margin-top: 4px; margin-bottom: 14px; padding: 2px 4px; font-size: 12px; color: #f5edd7;">';
	if(isAdv) {
		out += getImageTag('AdventureAvatarDefault', '20px') + getLoca("ACL", "Adventure", "Adventure") + ': <b style="color: #ffd873;">' + advName + '</b>' +
			'&nbsp;&nbsp;|&nbsp;&nbsp;' + getLoca("LAB", "DefenseModeCampL1", "Camps") + ': <b style="color: #ffffff;">' + campsCount + '</b>' +
			'&nbsp;&nbsp;|&nbsp;&nbsp;' + getGeneralsLabel() + ': <b style="color: #ffffff;">' + genCount + '</b>' +
			'<div id="exportStatusMsg" style="margin-top: 6px; font-size: 11px; color: #8cfba1; font-weight: bold;">' +
			(autoCopied
				? getImageTag('ReturnToStarIcon', '24px') + getLoca("LAB", "Complete", "Complete") + ' (' + getLoca("LAB", "AttackOverview", "Combat Map") + ' — ' + advName + ')'
				: getLoca("LAB", "Status", "Status") + ': ' + getLoca("LAB", "AttackOverview", "Combat Map") + ' (' + advName + ')') +
			'</div>';
	} else {
		out += getImageTag('Banditsleader_RoyalResidence', '24px') + getLoca("ACL", "HomeIsland", "Home Island") +
			'&nbsp;&nbsp;|&nbsp;&nbsp;' + getGeneralsLabel() + ': <b style="color: #ffffff;">' + genCount + '</b>' +
			'<div id="exportStatusMsg" style="margin-top: 6px; font-size: 11px; color: #8cfba1; font-weight: bold;">' +
			(autoCopied
				? getImageTag('ReturnToStarIcon', '24px') + getLoca("LAB", "Complete", "Complete") + ' (' + getGeneralsLabel() + ')'
				: getLoca("LAB", "Status", "Status") + ': ' + getGeneralsLabel()) +
			'</div>';
	}
	out += '</div>';

	// Authentic Settlers table header
	out += createTableRow([
		[1, ''],
		[5, getLoca("LAB", "Name", "Name")],
		[2, getLoca("LAB", "Type", "Type")],
		[2, getLoca("LAB", "Capacity", "Capacity")],
		[2, getLoca("ACL", "Skills", "Skills")]
	], true);

	// Table Rows
	exportSnapshotLastData.specialists.forEach(function(g) {
		var iconTag = g.iconHtml || resolveSpecialistIcon(null, g.base, '24px');
		var gridBadge = g.grid > 0 ? '<small style="color: #7ef59b; font-weight: normal;">&nbsp;[#' + g.grid + ']</small>' : '';
		out += createTableRow([
			[1, iconTag],
			[5, '<span style="font-weight: bold; color: #ffffff;">' + g.name + '</span>' + gridBadge],
			[2, '<span style="color: #ffd873;">' + g.base + '</span>'],
			[2, '<span style="color: #a8d5ff; font-weight: bold;">' + g.capacity + '</span>'],
			[2, '<span style="color: #b5fca6; font-weight: bold;">' + g.skillPoints + '</span>']
		]);
	});

	out += '</div>';
	$('#exportGeneralsModalData').html(out);

	// Authentic TSO wood buttons in footer
	$("#exportGeneralsModal .modal-footer .btnExportDynamic").remove();

	var rawAdvBase = exportSnapshotLastData.adventureKey || advName || "adventure";
	var cleanAdvBase = String(rawAdvBase)
		.replace(/<[^>]+>/g, '')
		.replace(/[<>:"/\\|?*]/g, '')
		.replace(/[\s\t\r\n]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '')
		.trim() || "adventure";

	var snapshotFn = cleanAdvBase + ".json";
	var generalsFn = "generals.json";

	var footerButtons = [];
	if(isAdv) {
		footerButtons.push(
			$('<button>').attr({ "id": "btnExportCopySnapshot", "class": "btn btn-success pull-left btnExportDynamic" })
				.html(getImageTag('DepositSchool', '20px') + getLoca("LAB", "AttackOverview", "Combat Map") + " (JSON)"),
			$('<button>').attr({ "id": "btnExportSaveSnapshot", "class": "btn btn-primary pull-left btnExportDynamic" })
				.html(getImageTag('IconMailWrite', '20px') + getLoca("LAB", "Save", "Save") + " (" + getLoca("LAB", "AttackOverview", "Combat Map") + ")"),
			$('<button>').attr({ "id": "btnExportCopyGenerals", "class": "btn btn-info pull-left btnExportDynamic" })
				.html(getImageTag('DepositSchool', '20px') + getGeneralsLabel() + " (JSON)"),
			$('<button>').attr({ "id": "btnExportSaveGenerals", "class": "btn btn-primary pull-left btnExportDynamic" })
				.html(getImageTag('IconMailWrite', '20px') + getLoca("LAB", "Save", "Save") + " (" + getGeneralsLabel() + ")")
		);
	} else {
		footerButtons.push(
			$('<button>').attr({ "id": "btnExportCopyGenerals", "class": "btn btn-success pull-left btnExportDynamic" })
				.html(getImageTag('DepositSchool', '20px') + getGeneralsLabel() + " (JSON)"),
			$('<button>').attr({ "id": "btnExportSaveGenerals", "class": "btn btn-primary pull-left btnExportDynamic" })
				.html(getImageTag('IconMailWrite', '20px') + getLoca("LAB", "Save", "Save") + " (generals.json)")
		);
		if(campsCount > 0) {
			footerButtons.push(
				$('<button>').attr({ "id": "btnExportCopySnapshot", "class": "btn btn-info pull-left btnExportDynamic" })
					.html(getImageTag('DepositSchool', '20px') + getLoca("LAB", "AttackOverview", "Combat Map") + " (" + campsCount + ")"),
				$('<button>').attr({ "id": "btnExportSaveSnapshot", "class": "btn btn-primary pull-left btnExportDynamic" })
					.html(getImageTag('IconMailWrite', '20px') + getLoca("LAB", "Save", "Save") + " (snapshot.json)")
			);
		}
	}

	$("#exportGeneralsModal .modal-footer").prepend(footerButtons);

	// Event Handlers
	$('#btnExportCopySnapshot').click(function() {
		if(exportGeneralsCopyToClipboard(snapshotJsonStr)) {
			var msg = '✓ ' + getLoca("LAB", "Complete", "Complete") + ' (' + getLoca("LAB", "AttackOverview", "Combat Map") + ': ' + advName + ')';
			$('#exportStatusMsg').html(msg);
			if(typeof showGameAlert === 'function') {
				showGameAlert(msg);
			}
		}
	});

	$('#btnExportSaveSnapshot').click(function() {
		exportGeneralsSaveFile(snapshotJsonStr, snapshotFn);
	});

	$('#btnExportCopyGenerals').click(function() {
		if(exportGeneralsCopyToClipboard(generalsJsonStr)) {
			var msg = '✓ ' + getLoca("LAB", "Complete", "Complete") + ' (' + getGeneralsLabel() + ': ' + genCount + ')';
			$('#exportStatusMsg').html(msg);
			if(typeof showGameAlert === 'function') {
				showGameAlert(msg);
			}
		}
	});

	$('#btnExportSaveGenerals').click(function() {
		exportGeneralsSaveFile(generalsJsonStr, generalsFn);
	});

	$('#exportGeneralsModal').on('hidden.bs.modal', function() {
		$('.modal-backdrop').remove();
	});

	$('#exportGeneralsModal:not(:visible)').modal({ backdrop: "static" });
}

function exportMenuHandler(event)
{
	try {
		renderExportModal('auto');
	} catch(e) {
		alert(getGeneralsLabel() + " Error: " + e);
	}
}
