// ==UserScript==
// @name         Wild Rift XP + Auto Farm + Auto Buy Seeds
// @namespace    http://tampermonkey.net/
// @version      2026-04-25.3
// @description  Wild Rift Crystal Rose: XP farming + auto planting + auto buy seeds + compact UI
// @author       Gavin Zhang
// @match        https://crystalrosegame.wildrift.leagueoflegends.com/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=leagueoflegends.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const PANEL_ID = "__wildrift_compact_panel__";
    const TOGGLE_ID = "__wildrift_compact_toggle__";
    const STYLE_ID = "__wildrift_compact_style__";
    const MAX_LOG_LINES = 400;
    const AF_WAIT_LOG_MIN_MS = 2000;
    const SCRIPT_START_PERF_TIME = (() => {
        try {
            return performance.now();
        } catch (err) {
            return Number.POSITIVE_INFINITY;
        }
    })();
    const DEFAULT_API_REGION = "AUTO";
    const CUSTOM_API_REGION = "CUSTOM";
    const FALLBACK_API_REGION = "AM";
    const API_SERVERS = Object.freeze({
        AM: "https://na.api.h5.wildrift.leagueoflegends.com/5c/crystalrose/pub/",
        EU: "https://eu.api.h5.wildrift.leagueoflegends.com/5c/crystalrose/pub/",
        AS: "https://as.api.h5.wildrift.leagueoflegends.com/5c/crystalrose/pub/",
    });
    const API_HOST_REGION_MAP = Object.freeze({
        "na.api.h5.wildrift.leagueoflegends.com": "AM",
        "eu.api.h5.wildrift.leagueoflegends.com": "EU",
        "as.api.h5.wildrift.leagueoflegends.com": "AS",
    });
    const API_REGION_OPTIONS = Object.freeze([
        { value: "AUTO", labelKey: "apiRegionAuto" },
        { value: "AM", labelKey: "apiRegionAM" },
        { value: "EU", labelKey: "apiRegionEU" },
        { value: "AS", labelKey: "apiRegionAS" },
        { value: "CUSTOM", labelKey: "apiRegionCustom" },
    ]);

    const FIXED_STEPS_PER_ROUND = 6;
    const DEFAULT_XP_TIMER_MODE = "always";
    const DEFAULT_XP_COUNTDOWN_DAYS = 0;
    const DEFAULT_XP_COUNTDOWN_HOURS = 0;
    const DEFAULT_XP_COUNTDOWN_MINUTES = 30;
    const DEFAULT_XP_STOP_HOUR = 23;
    const DEFAULT_XP_STOP_MINUTE = 59;
    const DEFAULT_XP_LAND = "1";
    const LEGACY_DEFAULT_XP_LAND = "5";
    const DEFAULT_XP_CROP = "2000001";   // 霞光郁金香
    const DEFAULT_AF_CROP = "2000005";   // 火鸢尾花
    const DEFAULT_LANG = "en";
    const DEFAULT_AF_INTERVAL = 1;
    const DEFAULT_AF_LANDS = ["1", "2", "3", "4", "5", "6"];
    const LEGACY_DEFAULT_AF_LANDS = ["1", "2", "3", "4", "6"];
    const DEFAULT_BUY_CROP = DEFAULT_XP_CROP;
    const DEFAULT_BUY_COUNT = 99;
    const DEFAULT_BUY_TIMES = 1;
    const DEFAULT_PANEL_OPACITY = 0.95;
    const MIN_PANEL_OPACITY = 0.4;
    const MAX_PANEL_OPACITY = 1;
    const SETTINGS_STORAGE_KEY = "__wildrift_crystal_settings_v1__";
    const I18N = {
        tabAutoFarm: { zh: '🚜 自动种植', en: '🚜 Auto Farm' },
        tabXp: { zh: '💰 刷金币', en: '💰 Gold Farm' },
        tabBuy: { zh: '🛒 买种子', en: '🛒 Buy Seeds' },
        tabStatus: { zh: '📊 状态', en: '📊 Status' },
        tabMissions: { zh: '📋 任务', en: '📋 Missions' },
        tabSettings: { zh: '⚙️ 设置', en: '⚙️ Settings' },
        apiRegionTitle: { zh: '服务器', en: 'Server' },
        apiRegionAuto: { zh: '自动', en: 'Auto' },
        apiRegionAM: { zh: '北美', en: 'NA' },
        apiRegionEU: { zh: '欧洲', en: 'EU' },
        apiRegionAS: { zh: '亚洲', en: 'AS' },
        apiRegionCustom: { zh: '✏️ 自定义', en: '✏️ Custom' },
        apiRegionSet: { zh: 'API 区服已切换为', en: 'API region set to' },
        apiAutoDetected: { zh: '自动检测', en: 'Auto detected' },
        apiFallback: { zh: '兜底', en: 'fallback' },
        apiActiveEndpoint: { zh: '当前接口', en: 'Active endpoint' },
        apiRegionHint: { zh: '通过查看状态tab检测当前服务器选择是否正确', en: 'Check the Status tab to verify whether the current server selection is correct' },
        apiCustomUrl: { zh: '手动 API 地址', en: 'Manual API URL' },
        apiCustomUrlPlaceholder: { zh: 'https://eu.api.h5.wildrift.leagueoflegends.com/5c/crystalrose/pub/', en: 'https://eu.api.h5.wildrift.leagueoflegends.com/5c/crystalrose/pub/' },
        apiApplyCustomUrl: { zh: '应用地址', en: 'Apply URL' },
        apiInvalidCustomUrl: { zh: '手动 API 地址无效', en: 'Manual API URL is invalid' },
        apiSettingsLocked: { zh: '请先停止任务或等待刷新结束，再切换 API 区服', en: 'Stop tasks or wait for refresh before changing API region' },
        panelOpacity: { zh: '面板透明度', en: 'Panel opacity' },
        resetDefaults: { zh: '↩️ 重置所有设置', en: '↩️ Reset All Settings' },
        resetAllSettingsTitle: { zh: '重置', en: 'Reset' },
        togglePanel: { zh: '控制面板', en: 'Control Panel' },
        guideXp: {
            zh: '刷经验 = 重复种植霞光郁金香 + 铲除 + 提交在 6 个地块处种下种子（28经验+120金钱）<br>土地上没有作物（指定地块看到一直种下然后消失）是正常的',
            en: 'XP = repeat plant Skyglow Tulip + remove + submit Plant seeds on 6 plot(s) (28 XP + 120 Gold)<br>No crop on land (the selected land keeps planting then disappearing) is normal'
        },
        guideAutoFarm: { zh: '自动种植 = 检查全部地块，按需种植 / 浇水 / 收获', en: 'Auto Farm = check lands, plant / water / harvest' },
        guideBuy: { zh: '自动买种子 = 可手动批量购买 <br>前端显示无法自动更新，手动刷新页面来显示最新状态', en: 'Auto Buy = batch buy <br>Frontend can\'t update automatically, please refresh the page manually to see the latest status' },
        notLoaded: { zh: '未读取', en: 'Not loaded' },
        refresh: { zh: '🔄 刷新状态', en: '🔄 Refresh' },
        level: { zh: '当前等级', en: 'Level' },
        gold: { zh: '金钱', en: 'Gold' },
        bloomCoins: { zh: '花绽币', en: 'Bloom Coins' },
        plotInfo: { zh: '当前地块信息', en: 'Land Info' },
        flowerOverview: { zh: '鲜花概览', en: 'Flower Overview' },
        seedOverview: { zh: '种子概览', en: 'Seed Overview' },
        missionPanel: { zh: '任务面板', en: 'Missions' },
        hideCompletedTasks: { zh: '隐藏已完成任务', en: 'Hide completed tasks' },
        loading: { zh: '⏳ 读取中...', en: '⏳ Loading...' },
        refreshedAt: { zh: '✅ 已刷新：', en: '✅ Refreshed: ' },
        start: { zh: '▶️ 开始', en: '▶️ Start' },
        stop: { zh: '⏹️ 停止', en: '⏹️ Stop' },
        apply: { zh: '💾 应用设置', en: '💾 Apply' },
        crop: { zh: '作物', en: 'Crop' },
        seed: { zh: '种子', en: 'Seed' },
        plot: { zh: '地块', en: 'Land' },
        quest: { zh: '任务', en: 'Quest' },
        timerMode: { zh: '计时模式', en: 'Timer Mode' },
        modeAlways: { zh: '一直运行', en: 'Always' },
        modeCountdown: { zh: '倒计时', en: 'Countdown' },
        modeCountup: { zh: '正计时', en: 'Count Up' },
        countdownSettings: { zh: '倒计时设置', en: 'Countdown Settings' },
        days: { zh: '天', en: 'Days' },
        hours: { zh: '小时', en: 'Hours' },
        mins: { zh: '分钟', en: 'Min' },
        countupSettings: { zh: '正计时到点停止（本地时间）', en: 'Stop at time (local)' },
        hour: { zh: '时', en: 'Hour' },
        min: { zh: '分', en: 'Min' },
        timerProgress: { zh: '计时进度', en: 'Timer' },
        roundProgress: { zh: '当前轮次进度', en: 'Round' },
        currentStep: { zh: '当前步骤', en: 'Step' },
        requests: { zh: '请求', en: 'Requests' },
        plantsOk: { zh: '种植成功', en: 'Plants OK' },
        removesOk: { zh: '消除成功', en: 'Removes OK' },
        questsOk: { zh: '任务提交成功', en: 'Quests OK' },
        autoBuys: { zh: '自动补货次数', en: 'Auto-buys' },
        waiting: { zh: '等待中', en: 'Waiting' },
        elapsed: { zh: '已耗时', en: 'Elapsed' },
        remaining: { zh: '剩余时间', en: 'Remaining' },
        buyNow: { zh: '🛒 立即购买', en: '🛒 Buy Now' },
        seedType: { zh: '种子类型', en: 'Seed Type' },
        buyTimes: { zh: '购买次数', en: 'Times' },
        perBuyCount: { zh: '每次购买数量', en: 'Per Count' },
        buyNotStarted: { zh: '⏸️ 未执行', en: '⏸️ Idle' },
        totalReq: { zh: '总购买请求', en: 'Total Req' },
        successReq: { zh: '成功请求', en: 'Success' },
        failedReq: { zh: '失败请求', en: 'Failed' },
        buyOk: { zh: '成功购买次数', en: 'Buy OK' },
        seedsGot: { zh: '累计买到种子', en: 'Seeds Got' },
        lastAction: { zh: '最近动作', en: 'Last Action' },
        runOnce: { zh: '▶️ 立即执行一次', en: '▶️ Run Once' },
        intervalMin: { zh: '检查间隔(分钟)', en: 'Check Interval (min)' },
        randomDelay: { zh: '随机延迟区间：', en: 'Random Delay:' },
        delayMin: { zh: '随机延迟最小(ms)', en: 'Min Delay (ms)' },
        delayMax: { zh: '随机延迟最大(ms)', en: 'Max Delay (ms)' },
        plotSelection: { zh: '地块选择', en: 'Land Selection' },
        goalPlanting: { zh: '花种选择', en: 'Flower Seed Selection' },
        singleFlowerSeed: { zh: '单花种', en: 'Single Seed' },
        multiFlowerSeed: { zh: '多花种', en: 'Multiple Seeds' },
        allGoalProgress: { zh: '总目标进度', en: 'All Goals' },
        estimatedTime: { zh: '预估时间', en: 'ETA' },
        etaUnavailable: { zh: '暂无足够数据', en: 'ETA unavailable' },
        goalDisabled: { zh: '当前目标：未开启', en: 'Goal: disabled' },
        afNotStarted: { zh: '⏸️ 未启动', en: '⏸️ Idle' },
        scheduler: { zh: '调度状态', en: 'Scheduler' },
        nextRun: { zh: '下次运行', en: 'Next Run' },
        cycles: { zh: '已执行轮次', en: 'Cycles' },
        harvestsOk: { zh: '收获成功', en: 'Harvests OK' },
        watersOk: { zh: '浇水成功', en: 'Waters OK' },
        skipped: { zh: '跳过地块', en: 'Skipped' },
        logTitle: { zh: '📝 日志', en: '📝 Log' },
        logCollapse: { zh: '收起日志', en: 'Collapse log' },
        logExpand: { zh: '展开日志', en: 'Expand log' },
        noLogs: { zh: '暂无日志', en: 'No logs' },
        thPlot: { zh: '地块', en: 'Land' },
        thCrop: { zh: '作物', en: 'Crop' },
        thState: { zh: '状态', en: 'State' },
        thTime: { zh: '时间', en: 'Time' },
        thFlower: { zh: '鲜花', en: 'Flower' },
        thId: { zh: 'ID', en: 'ID' },
        thCount: { zh: '数量', en: 'Qty' },
        thSeed: { zh: '种子', en: 'Seed' },
        thSeedCount: { zh: '种子数量', en: 'Seeds' },
        thOwned: { zh: '背包数量', en: 'Owned' },
        thShop: { zh: '商店', en: 'Store' },
        thPrice: { zh: '价格', en: 'Price' },
        thOwnedFlowers: { zh: '已有', en: 'Owned' },
        thGrowing: { zh: '成长中', en: 'Growing' },
        thGoal: { zh: '目标', en: 'Goal' },
        empty: { zh: '空地', en: 'Empty' },
        harvestable: { zh: '可收获', en: 'Ready' },
        needsWater: { zh: '需浇水', en: 'Needs Water' },
        growingState: { zh: '生长中', en: 'Growing' },
        mature: { zh: '已成熟', en: 'Mature' },
        remainLeft: { zh: '剩余', en: 'Left' },
        grownFor: { zh: '已生长', en: 'Grown' },
        mainQuests: { zh: '主线任务', en: 'Main Quests' },
        chapterQuests: { zh: '章节任务', en: 'Chapter Quests' },
        orderQuests: { zh: '订单任务', en: 'Order Quests' },
        completed: { zh: '已完成', en: 'Done' },
        incomplete: { zh: '未完成', en: 'Incomplete' },
        inProgress: { zh: '进行中', en: 'In Progress' },
        claimed: { zh: '已领取', en: 'Claimed' },
        notStarted: { zh: '未开始', en: 'Not Started' },
        noMissions: { zh: '无任务', en: 'None' },
        noMissionData: { zh: '暂无任务数据', en: 'No mission data' },
        allComplete: { zh: '全部已完成', en: 'All complete' },
        allCatComplete: { zh: '本类任务已全部完成', en: 'All complete' },
        unfinishedLabel: { zh: '未完成汇总：', en: 'Incomplete: ' },
        unfinishedQuests: { zh: '未完成任务', en: 'Incomplete' },
        progressCol: { zh: '进度/状态', en: 'Progress' },
        noStartedOrders: { zh: '暂无已开始的订单任务', en: 'No started order quests' },
        totalQuestsLabel: { zh: '个任务', en: ' quests' },
        pendingLearn: { zh: '待学习', en: 'Unknown' },
        noGoalCrops: { zh: '暂无可配置种子', en: 'No seeds' },
        noFlowers: { zh: '背包里暂无鲜花', en: 'No flowers' },
        noLandData: { zh: '暂无地块数据', en: 'No land data' },
        noSeedData: { zh: '暂无种子数据', en: 'No seed data' },
        shopNotListed: { zh: '未上架', en: 'N/A' },
        shopCanBuy: { zh: '可购买', en: 'Available' },
        shopLocked: { zh: '未解锁', en: 'Locked' },
        schedOff: { zh: '未开启', en: 'Off' },
        schedOn: { zh: '已开启', en: 'On' },
        schedRunning: { zh: '运行中 + 已开启定时', en: 'Running + Scheduled' },
        schedCurrent: { zh: '本轮运行中', en: 'Running' },
        schedExecuting: { zh: '当前执行中', en: 'Executing' },
        goalDefault: { zh: '当前目标：未开启，默认种植', en: 'Goal: off, default' },
        goalCurrent: { zh: '当前目标：', en: 'Goal: ' },
        goalAllDone: { zh: '当前目标：全部已完成', en: 'Goal: All done' },
        alwaysRunLabel: { zh: '一直运行', en: 'Always on' },
        countdownLeft: { zh: '倒计时剩余', en: 'Countdown' },
        clockStopLeft: { zh: '剩余', en: 'left' },
        xpStopped: { zh: '⏸️ 已停止', en: '⏸️ Stopped' },
        repeatQuestLabel: { zh: '循环任务', en: 'Repeat' },
        completedLabel: { zh: '完成', en: 'Done' },
        xpSettingsUpdated: { zh: '⚙️ 刷经验设置已更新', en: '⚙️ XP settings updated' },
        buySettingsUpdated: { zh: '⚙️ 自动买种子设置已更新', en: '⚙️ Buy settings updated' },
        afSettingsUpdated: { zh: '⚙️ 自动种植设置已更新', en: '⚙️ Farm settings updated' },
        round: { zh: '轮', en: 'R' },
        fail: { zh: '失败', en: 'fail' },
        success: { zh: '成功', en: 'ok' },
        plotLabel: { zh: '地块', en: 'Land' },
        savedOption: { zh: '已保存选项', en: 'saved' },
        savedCrop: { zh: '已保存种子', en: 'saved seed' },
        savedQuest: { zh: '已保存任务', en: 'saved quest' },
        stopTasksFirst: { zh: '请先停止正在运行的任务，再恢复默认设置', en: 'Stop running tasks before resetting' },
        defaultsRestored: { zh: '已恢复默认设置并保存', en: 'Default settings restored & saved' },
        scriptLoaded: { zh: '综合脚本已加载，面板默认隐藏', en: 'Script loaded, panel hidden' },
        statusRefreshOk: { zh: '当前状态刷新成功', en: 'Status refreshed' },
        statusRefreshFail: { zh: '刷新当前状态失败', en: 'Status refresh failed' },
        startRefresh: { zh: '开始刷新当前状态', en: 'Refreshing status...' },
        doneLabel: { zh: '完成', en: 'Done' },
        buyRunning: { zh: '🛒 自动买种子执行中...', en: '🛒 Buying seeds...' },
        buyDone: { zh: '✅ 自动买种子执行完成', en: '✅ Buy complete' },
        afRunning: { zh: '🚜 自动种植执行中...', en: '🚜 Auto farming...' },
        afScheduledRun: { zh: '🤖 定时自动种植执行中...', en: '🤖 Scheduled farming...' },
        afDone: { zh: '✅ 自动种植本轮执行完成', en: '✅ Farm cycle done' },
        afScheduled: { zh: '⏳ 自动种植已安排', en: '⏳ Farm scheduled' },
        afMinLater: { zh: '分钟后再次执行', en: ' min later' },
        afSchedulerOn: { zh: '🟢 自动种植定时器已开启，先执行一次', en: '🟢 Scheduler on, running first cycle' },
        afSchedulerOff: { zh: '⏹️ 自动种植定时器已停止', en: '⏹️ Scheduler stopped' },
        afSchedulerWait: { zh: '⏹️ 已停止定时，当前轮次跑完后不再继续', en: '⏹️ Scheduler off after current cycle' },
        flowerLabel: { zh: '鲜花', en: 'Flower' },
    };
    const LOCALIZED_NAME_ENTRIES = [
        { zh: '霞光郁金香种子', en: 'Skyglow Tulip Seed', keys: ['2000001'] },
        { zh: '霞光郁金香', en: 'Skyglow Tulip', keys: ['3000001'] },
        { zh: '战斗玫瑰种子', en: 'Battle Rose Seed', keys: ['2000002'] },
        { zh: '战斗玫瑰', en: 'Battle Rose', keys: ['3000002'] },
        { zh: '灵莲种子', en: 'Spirit Lotus Seed', keys: ['2000003'] },
        { zh: '灵莲', en: 'Spirit Lotus', keys: ['3000003'] },
        { zh: '翡翠藤蔓种子', en: 'Emerald Vine Seed', keys: ['2000004'] },
        { zh: '翡翠藤蔓', en: 'Emerald Vine', keys: ['3000004'] },
        { zh: '火鸢尾花种子', en: 'Fire Iris Seed', keys: ['2000005'], aliases: ['火焰鸢尾种子'] },
        { zh: '火鸢尾花', en: 'Fire Iris', keys: ['3000005'], aliases: ['火焰鸢尾'] },
        { zh: '沙漠玫瑰种子', en: 'Desert Rose Seed', keys: ['2000006'] },
        { zh: '沙漠玫瑰', en: 'Desert Rose', keys: ['3000006'] },
        { zh: '虚空之花种子', en: 'Voidbloom Seed', keys: ['2000007'] },
        { zh: '虚空之花', en: 'Voidbloom', keys: ['3000007'], aliases: ['虚空花朵'] },
        { zh: '雷鸣鸢尾种子', en: 'Thunder Iris Seed', keys: ['2000008'] },
        { zh: '雷鸣鸢尾', en: 'Thunder Iris', keys: ['3000008'], aliases: ['雷霆鸢尾'] },
        { zh: '水晶蔷薇种子', en: 'Crystal Rose Seed', keys: ['2000009'] },
        { zh: '水晶蔷薇', en: 'Crystal Rose', keys: ['3000009'] },
        { zh: '极光冰花种子', en: 'Aurora Icebloom Seed', keys: ['2000010'], aliases: ['极光冰绽种子'] },
        { zh: '极光冰花', en: 'Aurora Icebloom', keys: ['3000010'], aliases: ['极光冰绽', '冰晶花'] },
        { zh: '皓月之莲种子', en: 'Moonlight Lotus Seed', keys: ['2000011'], aliases: ['月光莲种子'] },
        { zh: '皓月之莲', en: 'Moonlight Lotus', keys: ['3000011'], aliases: ['月光莲'] },
        { zh: '星光百合种子', en: 'Starlight Lily Seed', keys: ['2000012'] },
        { zh: '星光百合', en: 'Starlight Lily', keys: ['3000012'] },
        { zh: '水晶蔷薇雕塑', en: 'Crystal Rose Sculpture', keys: [] },
        { zh: '邮箱', en: 'Mailbox', keys: [] },
        { zh: '猫家具', en: 'Cat Furniture', keys: [] },
        { zh: '狗屋', en: 'Doghouse', keys: [] },
        { zh: '不同的狗屋', en: 'Different Doghouses', keys: [] },
        { zh: '迷你波罗雕塑', en: 'Mini Poro Statue', keys: [] },
        { zh: '不同颜色的迷你波罗雕塑', en: 'Mini Poro Statues of Different Colors', keys: [] },
        { zh: '心形坩埚', en: 'Heart-Shaped Crucible', keys: ['7000306'], aliases: ['心型坩锅'] },
        { zh: '刃锋追忆', en: "Blade's Memory", keys: [] },
        { zh: '执法者的休假', en: "The Enforcer's Day Off", keys: [] },
        { zh: '生灵之触', en: "Life's Touch", keys: [] },
        { zh: '跨越界限', en: 'Crossing Boundaries', keys: [] },
        { zh: '水晶下的阴谋', en: 'Conspiracy Beneath the Crystal', keys: [] },
        { zh: '玫瑰丛间的邂逅', en: 'A Meeting Among Roses', keys: [] },
        { zh: '觅光香韵', en: 'Seeking Light and Fragrance', keys: [] },
        { zh: '暮光交织的音韵', en: 'Twilight Interwoven Melody', keys: [] },
        { zh: '播种，交换，修补', en: 'Sow, Exchange, Repair', keys: [] },
        { zh: '金钱', en: 'Gold', keys: ['1000001'] },
        { zh: '花绽币', en: 'Bloom Coins', keys: ['1000002'], aliases: ['花碇币'] },
    ];
    const LOCALIZED_NAME_MAP = Object.freeze(LOCALIZED_NAME_ENTRIES.reduce((acc, entry) => {
        acc[entry.zh] = entry;
        for (const alias of entry.aliases || []) {
            acc[String(alias)] = entry;
        }
        for (const key of entry.keys || []) {
            acc[String(key)] = entry;
        }
        return acc;
    }, {}));
    const LOCALIZED_REPLACE_ENTRIES = Object.freeze(
        [...new Map(LOCALIZED_NAME_ENTRIES
            .flatMap(entry => [
                entry,
                ...(entry.aliases || []).map(alias => ({ zh: alias, en: entry.en })),
            ])
            .map(entry => [entry.zh, entry])).values()]
            .sort((a, b) => b.zh.length - a.zh.length)
    );
    const t = (key) => I18N[key]?.[state.ui.lang] ?? I18N[key]?.zh ?? key;

    const normalizeApiRegion = (value, fallback = DEFAULT_API_REGION) => {
        const raw = String(value ?? '').trim().toUpperCase();
        if (raw === DEFAULT_API_REGION) return DEFAULT_API_REGION;
        if (raw === CUSTOM_API_REGION) return CUSTOM_API_REGION;
        const region = raw === 'NA' ? 'AM' : raw;
        return API_SERVERS[region] ? region : fallback;
    };

    const normalizeApiBaseUrl = (value) => {
        let raw = String(value ?? '').trim();
        if (!raw) return '';
        if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
        try {
            const url = new URL(raw);
            if (!['http:', 'https:'].includes(url.protocol)) return '';
            url.search = '';
            url.hash = '';
            if (!url.pathname.endsWith('/')) {
                url.pathname = `${url.pathname}/`;
            }
            return url.href;
        } catch (err) {
            return '';
        }
    };

    const normalizePanelOpacity = (value, fallback = DEFAULT_PANEL_OPACITY) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.min(MAX_PANEL_OPACITY, Math.max(MIN_PANEL_OPACITY, n));
    };

    const normalizeOverlayCoord = (value) => {
        const n = Number(value);
        return Number.isFinite(n) && n >= 0 ? n : null;
    };

    const getDefaultOverlayTopOffset = () => (window.innerWidth <= 768 ? 72 : 16);

    const state = {
        ui: {
            activeTab: "autofarm",
            lang: DEFAULT_LANG,
            hideCompletedMissions: false,
            logsCollapsed: false,
            apiRegion: DEFAULT_API_REGION,
            apiCustomBaseUrl: "",
            panelOpacity: DEFAULT_PANEL_OPACITY,
            toggleCustomPosition: false,
            toggleLeft: null,
            toggleTop: null,
        },
        xp: {
            timerMode: DEFAULT_XP_TIMER_MODE,
            countdownDays: DEFAULT_XP_COUNTDOWN_DAYS,
            countdownHours: DEFAULT_XP_COUNTDOWN_HOURS,
            countdownMinutes: DEFAULT_XP_COUNTDOWN_MINUTES,
            stopHour: DEFAULT_XP_STOP_HOUR,
            stopMinute: DEFAULT_XP_STOP_MINUTE,
            stopAtTs: 0,
            firstRoundSteps: FIXED_STEPS_PER_ROUND,
            landIndex: DEFAULT_XP_LAND,
            cropId: DEFAULT_XP_CROP,
            missionType: "1",
            missionId: "7000003",
            stopped: true,
            isRunning: false,
            stats: {
                startTime: 0,
                stopTime: 0,
                finishedOperations: 0,
                totalReq: 0,
                successReq: 0,
                failReq: 0,
                plantOk: 0,
                eliminateOk: 0,
                missionOk: 0,
                autoBuyTriggered: 0,
                currentRound: 0,
                currentStep: 0,
                currentRoundFinishedOperations: 0,
                currentRoundStepTarget: FIXED_STEPS_PER_ROUND,
            }
        },
        autoFarm: {
            cropId: DEFAULT_AF_CROP,
            selectedLands: [...DEFAULT_AF_LANDS],
            intervalMin: DEFAULT_AF_INTERVAL,
            randomDelayMinMs: 500,
            randomDelayMaxMs: 1500,
            goalModeEnabled: false,
            flowerGoals: [],
            cropFlowerMap: {},
            currentGoalCropId: "",
            stopped: true,
            isRunning: false,
            schedulerEnabled: false,
            timerId: null,
            nextRunAt: 0,
            waterThreshold: 900,
            stats: {
                lastStartTime: 0,
                lastFinishTime: 0,
                cycleCount: 0,
                totalReq: 0,
                successReq: 0,
                failReq: 0,
                plantOk: 0,
                harvestOk: 0,
                waterOk: 0,
                skipped: 0,
                lastDurationMs: 0,
            }
        },
        autoBuy: {
            cropId: DEFAULT_BUY_CROP,
            perBuyCount: DEFAULT_BUY_COUNT,
            repeatTimes: DEFAULT_BUY_TIMES,
            isRunning: false,
            stats: {
                totalReq: 0,
                successReq: 0,
                failReq: 0,
                successActions: 0,
                boughtSeedCount: 0,
                lastAction: '--',
            }
        },
        status: {
            loading: false,
            lastRefreshAt: 0,
            userInfo: null,
            assetsMap: {},
            bagSeeds: [],
            bagFlowers: [],
            shopSeeds: [],
            shopSeedCatalog: [],
            gardenInfo: [],
            cropMap: {},
            missionMap: {},
            mainMissionMap: {},
            missionOverview: null,
            repeatMissionId: "",
            repeatMissionProgress: "",
            repeatMissionTarget: "",
            landOptions: ["1", "2", "3", "4", "5", "6"],
        }
    };

    const nativeUiBridge = {
        scene: null,
        lookupAt: 0,
        loggedReady: false,
        loggedMissing: false,
    };

    const uiRuntime = {
        autoFarmGoalDragging: false,
        autoFarmGoalTableDirty: true,
        statusTablesDirty: true,
        detectedApiRegion: '',
        apiRegionLookupAt: 0,
        toggleDragSuppressClick: false,
    };

    const clampInt = (value, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) => {
        const n = Number.parseInt(value, 10);
        if (!Number.isFinite(n)) return fallback;
        return Math.min(max, Math.max(min, n));
    };

    const isObjectLike = (value) => value !== null && (typeof value === 'object' || typeof value === 'function');

    const safeGet = (target, key) => {
        try {
            if (target == null) return undefined;
            if (typeof key !== 'string' || !key.includes('.')) return target?.[key];
            return key.split('.').reduce((value, part) => (
                value == null || !part ? undefined : value[part]
            ), target);
        } catch (err) {
            return undefined;
        }
    };

    const getApiRegionFromUrl = (url) => {
        try {
            const hostname = new URL(String(url)).hostname.toLowerCase();
            return API_HOST_REGION_MAP[hostname] || '';
        } catch (err) {
            return '';
        }
    };

    const detectApiRegionFromPerformance = () => {
        try {
            const entries = performance.getEntriesByType('resource') || [];
            for (let i = entries.length - 1; i >= 0; i--) {
                const entry = entries[i];
                const startTime = Number(entry?.startTime ?? 0);
                if (Number.isFinite(SCRIPT_START_PERF_TIME) && startTime > SCRIPT_START_PERF_TIME) {
                    continue;
                }
                const region = getApiRegionFromUrl(entry?.name);
                if (region) return region;
            }
        } catch (err) {
            // ignore performance access errors
        }
        return '';
    };

    const detectApiRegionFromRiotCookie = () => {
        try {
            const rawCookie = document.cookie
                .split(';')
                .map(part => part.trim())
                .find(part => part.startsWith('__Secure-id_hint='));
            if (!rawCookie) return '';
            const payload = rawCookie.slice('__Secure-id_hint='.length);
            const info = JSON.parse(decodeURIComponent(payload));
            const country = String(info?.country || '').trim();
            const wrLib = window.WRLib;
            const region = typeof wrLib?.getRegionCode === 'function'
                ? wrLib.getRegionCode(country)
                : typeof wrLib?.getRegionCodeByISO2 === 'function'
                    ? wrLib.getRegionCodeByISO2(country)
                    : '';
            return normalizeApiRegion(region, '');
        } catch (err) {
            return '';
        }
    };

    const findNativeGameSceneSilently = () => {
        if (isLikelyNativeGameScene(nativeUiBridge.scene)) return nativeUiBridge.scene;

        const queue = [];
        const seen = new WeakSet();
        const push = (value) => {
            if (!isObjectLike(value) || seen.has(value)) return;
            seen.add(value);
            queue.push(value);
        };

        for (const root of getNativeSearchRoots()) {
            push(root);
        }

        let inspected = 0;
        while (queue.length && inspected < 300) {
            const current = queue.shift();
            inspected += 1;

            const scene = extractNativeGameScene(current);
            if (scene) {
                nativeUiBridge.scene = scene;
                return scene;
            }

            if (Array.isArray(current)) {
                current.slice(0, 20).forEach(push);
                continue;
            }

            for (const key of ['game', 'scene', 'scenes', 'manager', 'parent', 'children', 'value', '_value', 'proxy', '__vueParentComponent', '__vue_app__', '__vnode']) {
                push(safeGet(current, key));
            }
        }

        return null;
    };

    const detectApiRegionFromNative = () => normalizeApiRegion(
        safeGet(findNativeGameSceneSilently(), 'game.GameData.loginInfo.region'),
        ''
    );

    const detectApiRegion = () => {
        const now = Date.now();
        if (uiRuntime.detectedApiRegion) {
            return uiRuntime.detectedApiRegion;
        }
        if (now - uiRuntime.apiRegionLookupAt < 3000) {
            return '';
        }

        uiRuntime.apiRegionLookupAt = now;
        const detectedRegion = detectApiRegionFromNative()
            || detectApiRegionFromPerformance()
            || detectApiRegionFromRiotCookie()
            || '';
        if (detectedRegion) {
            uiRuntime.detectedApiRegion = detectedRegion;
        }
        return uiRuntime.detectedApiRegion;
    };

    const getActiveApiRegion = () => {
        const configured = normalizeApiRegion(state.ui.apiRegion, DEFAULT_API_REGION);
        if (configured === CUSTOM_API_REGION) return CUSTOM_API_REGION;
        if (configured !== DEFAULT_API_REGION) return configured;
        return detectApiRegion() || FALLBACK_API_REGION;
    };

    const getApiBaseUrlForRegion = (region) => API_SERVERS[normalizeApiRegion(region, '')] || '';

    const getApiBaseUrl = () => {
        const activeRegion = getActiveApiRegion();
        if (activeRegion === CUSTOM_API_REGION) {
            const customUrl = normalizeApiBaseUrl(state.ui.apiCustomBaseUrl);
            if (!customUrl) throw new Error(t('apiInvalidCustomUrl'));
            return customUrl;
        }
        return getApiBaseUrlForRegion(activeRegion) || API_SERVERS[FALLBACK_API_REGION];
    };

    const buildApiUrl = (pathOrUrl) => {
        const value = String(pathOrUrl || '');
        if (/^https?:\/\//i.test(value)) return value;
        return `${getApiBaseUrl()}${value.replace(/^\/+/, '')}`;
    };

    const getApiRegionLabel = (region) => {
        const normalized = normalizeApiRegion(region, '');
        if (normalized === CUSTOM_API_REGION) return state.ui.lang === 'zh' ? '自定义' : 'Custom';
        if (normalized === 'AM') return 'NA';
        return normalized || String(region || '');
    };

    const getApiRegionDisplay = (region = state.ui.apiRegion) => {
        const normalized = normalizeApiRegion(region, DEFAULT_API_REGION);
        if (normalized === DEFAULT_API_REGION) {
            return `${t('apiRegionAuto')} -> ${getApiRegionLabel(getActiveApiRegion())}`;
        }
        return getApiRegionLabel(normalized);
    };

    const markAutoFarmGoalTableDirty = () => {
        uiRuntime.autoFarmGoalTableDirty = true;
    };

    const markStatusTablesDirty = () => {
        uiRuntime.statusTablesDirty = true;
        markAutoFarmGoalTableDirty();
    };

    const normalizeTimerMode = (mode, fallback = DEFAULT_XP_TIMER_MODE) => {
        const m = String(mode || '').trim();
        return ['countdown', 'countup', 'always'].includes(m) ? m : fallback;
    };

    const normalizeLandSettings = (lands, fallback = DEFAULT_AF_LANDS) => {
        const arr = Array.isArray(lands) ? lands : fallback;
        const unique = [...new Set(arr.map(v => String(v).trim()).filter(Boolean))];
        return unique.length ? unique : [...fallback];
    };

    const sameLandSet = (a, b) => {
        const left = normalizeLandSettings(a, []);
        const right = normalizeLandSettings(b, []);
        return left.length === right.length && left.every((value, index) => value === right[index]);
    };

    const resetStateSettingsToDefault = () => {
        state.ui.activeTab = "autofarm";
        state.ui.hideCompletedMissions = false;
        state.ui.logsCollapsed = false;
        state.ui.apiRegion = DEFAULT_API_REGION;
        state.ui.apiCustomBaseUrl = "";
        state.ui.panelOpacity = DEFAULT_PANEL_OPACITY;
        state.ui.toggleCustomPosition = false;
        state.ui.toggleLeft = null;
        state.ui.toggleTop = null;

        state.xp.timerMode = DEFAULT_XP_TIMER_MODE;
        state.xp.countdownDays = DEFAULT_XP_COUNTDOWN_DAYS;
        state.xp.countdownHours = DEFAULT_XP_COUNTDOWN_HOURS;
        state.xp.countdownMinutes = DEFAULT_XP_COUNTDOWN_MINUTES;
        state.xp.stopHour = DEFAULT_XP_STOP_HOUR;
        state.xp.stopMinute = DEFAULT_XP_STOP_MINUTE;
        state.xp.stopAtTs = 0;
        state.xp.firstRoundSteps = FIXED_STEPS_PER_ROUND;
        state.xp.landIndex = DEFAULT_XP_LAND;
        state.xp.cropId = DEFAULT_XP_CROP;
        state.xp.missionType = "1";
        state.xp.missionId = "7000003";

        state.autoFarm.cropId = DEFAULT_AF_CROP;
        state.autoFarm.selectedLands = [...DEFAULT_AF_LANDS];
        state.autoFarm.intervalMin = DEFAULT_AF_INTERVAL;
        state.autoFarm.randomDelayMinMs = 500;
        state.autoFarm.randomDelayMaxMs = 1500;
        state.autoFarm.goalModeEnabled = false;
        state.autoFarm.flowerGoals = [];
        state.autoFarm.cropFlowerMap = {};
        state.autoFarm.currentGoalCropId = "";

        state.autoBuy.cropId = DEFAULT_BUY_CROP;
        state.autoBuy.perBuyCount = DEFAULT_BUY_COUNT;
        state.autoBuy.repeatTimes = DEFAULT_BUY_TIMES;
    };

    const applyPersistedSettingsToState = (settings) => {
        if (!settings || typeof settings !== 'object') return;

        const ui = settings.ui || {};
        if (['autofarm', 'xp', 'buy', 'status', 'missions', 'settings'].includes(String(ui.activeTab || ''))) {
            state.ui.activeTab = String(ui.activeTab);
        }
        if (['zh', 'en'].includes(String(ui.lang || ''))) {
            state.ui.lang = String(ui.lang);
        }
        state.ui.hideCompletedMissions = ui.hideCompletedMissions === true;
        state.ui.logsCollapsed = ui.logsCollapsed === true;
        state.ui.apiRegion = normalizeApiRegion(ui.apiRegion, DEFAULT_API_REGION);
        state.ui.apiCustomBaseUrl = normalizeApiBaseUrl(ui.apiCustomBaseUrl) || String(ui.apiCustomBaseUrl || '').trim();
        state.ui.panelOpacity = normalizePanelOpacity(ui.panelOpacity, DEFAULT_PANEL_OPACITY);
        state.ui.toggleCustomPosition = ui.toggleCustomPosition === true;
        state.ui.toggleLeft = state.ui.toggleCustomPosition ? normalizeOverlayCoord(ui.toggleLeft) : null;
        state.ui.toggleTop = state.ui.toggleCustomPosition ? normalizeOverlayCoord(ui.toggleTop) : null;

        const xp = settings.xp || {};
        state.xp.timerMode = normalizeTimerMode(xp.timerMode, state.xp.timerMode);
        state.xp.countdownDays = clampInt(xp.countdownDays, state.xp.countdownDays, 0, 365);
        state.xp.countdownHours = clampInt(xp.countdownHours, state.xp.countdownHours, 0, 23);
        state.xp.countdownMinutes = clampInt(xp.countdownMinutes, state.xp.countdownMinutes, 0, 59);
        state.xp.stopHour = clampInt(xp.stopHour, state.xp.stopHour, 0, 23);
        state.xp.stopMinute = clampInt(xp.stopMinute, state.xp.stopMinute, 0, 59);
        const savedXpLandIndex = String(xp.landIndex || state.xp.landIndex).trim() || state.xp.landIndex;
        state.xp.landIndex = savedXpLandIndex === LEGACY_DEFAULT_XP_LAND ? DEFAULT_XP_LAND : savedXpLandIndex;
        state.xp.cropId = String(xp.cropId || state.xp.cropId).trim() || state.xp.cropId;
        state.xp.missionId = String(xp.missionId || state.xp.missionId).trim() || state.xp.missionId;

        const autoFarm = settings.autoFarm || {};
        state.autoFarm.cropId = String(autoFarm.cropId || state.autoFarm.cropId).trim() || state.autoFarm.cropId;
        const savedAutoFarmLands = normalizeLandSettings(autoFarm.selectedLands, state.autoFarm.selectedLands);
        state.autoFarm.selectedLands = sameLandSet(savedAutoFarmLands, LEGACY_DEFAULT_AF_LANDS)
            ? [...DEFAULT_AF_LANDS]
            : savedAutoFarmLands;
        state.autoFarm.intervalMin = clampInt(autoFarm.intervalMin, state.autoFarm.intervalMin, 1, 1440);
        state.autoFarm.randomDelayMinMs = clampInt(autoFarm.randomDelayMinMs, state.autoFarm.randomDelayMinMs, 0, 60000);
        state.autoFarm.randomDelayMaxMs = clampInt(autoFarm.randomDelayMaxMs, state.autoFarm.randomDelayMaxMs, 0, 60000);
        state.autoFarm.goalModeEnabled = autoFarm.goalModeEnabled === true;
        state.autoFarm.flowerGoals = Array.isArray(autoFarm.flowerGoals)
            ? autoFarm.flowerGoals.map(goal => ({
                cropId: String(goal?.cropId || '').trim(),
                targetCount: clampInt(goal?.targetCount, 0, 0, 999999),
                order: clampInt(goal?.order, 0, 0, 999),
            })).filter(goal => goal.cropId)
            : [];
        state.autoFarm.cropFlowerMap = autoFarm.cropFlowerMap && typeof autoFarm.cropFlowerMap === 'object'
            ? Object.fromEntries(
                Object.entries(autoFarm.cropFlowerMap).map(([cropId, info]) => ([
                    String(cropId).trim(),
                    {
                        flowerId: String(info?.flowerId || '').trim(),
                        flowerName: String(info?.flowerName || '').trim(),
                        yieldCount: clampInt(info?.yieldCount, 0, 0, 9999),
                    }
                ])).filter(([cropId, info]) => cropId && info.flowerId)
            )
            : {};
        state.autoFarm.currentGoalCropId = String(autoFarm.currentGoalCropId || '').trim();
        if (state.autoFarm.randomDelayMinMs > state.autoFarm.randomDelayMaxMs) {
            const t = state.autoFarm.randomDelayMinMs;
            state.autoFarm.randomDelayMinMs = state.autoFarm.randomDelayMaxMs;
            state.autoFarm.randomDelayMaxMs = t;
        }

        const autoBuy = settings.autoBuy || {};
        state.autoBuy.cropId = String(autoBuy.cropId || state.autoBuy.cropId).trim() || state.autoBuy.cropId;
        state.autoBuy.perBuyCount = clampInt(autoBuy.perBuyCount, state.autoBuy.perBuyCount, 1, 9999);
        state.autoBuy.repeatTimes = clampInt(autoBuy.repeatTimes, state.autoBuy.repeatTimes, 1, 999);
    };

    const getPersistedSettingsFromState = () => ({
        ui: {
            activeTab: state.ui.activeTab,
            lang: state.ui.lang,
            hideCompletedMissions: state.ui.hideCompletedMissions,
            logsCollapsed: state.ui.logsCollapsed,
            apiRegion: normalizeApiRegion(state.ui.apiRegion, DEFAULT_API_REGION),
            apiCustomBaseUrl: String(state.ui.apiCustomBaseUrl || '').trim(),
            panelOpacity: normalizePanelOpacity(state.ui.panelOpacity, DEFAULT_PANEL_OPACITY),
            toggleCustomPosition: state.ui.toggleCustomPosition === true,
            toggleLeft: state.ui.toggleCustomPosition ? normalizeOverlayCoord(state.ui.toggleLeft) : null,
            toggleTop: state.ui.toggleCustomPosition ? normalizeOverlayCoord(state.ui.toggleTop) : null,
        },
        xp: {
            timerMode: state.xp.timerMode,
            countdownDays: state.xp.countdownDays,
            countdownHours: state.xp.countdownHours,
            countdownMinutes: state.xp.countdownMinutes,
            stopHour: state.xp.stopHour,
            stopMinute: state.xp.stopMinute,
            landIndex: state.xp.landIndex,
            cropId: state.xp.cropId,
            missionId: state.xp.missionId,
        },
        autoFarm: {
            cropId: state.autoFarm.cropId,
            selectedLands: [...(state.autoFarm.selectedLands || [])],
            intervalMin: state.autoFarm.intervalMin,
            randomDelayMinMs: state.autoFarm.randomDelayMinMs,
            randomDelayMaxMs: state.autoFarm.randomDelayMaxMs,
            goalModeEnabled: state.autoFarm.goalModeEnabled,
            flowerGoals: [...(state.autoFarm.flowerGoals || [])].map(goal => ({
                cropId: goal.cropId,
                targetCount: goal.targetCount,
                order: goal.order,
            })),
            cropFlowerMap: { ...(state.autoFarm.cropFlowerMap || {}) },
            currentGoalCropId: state.autoFarm.currentGoalCropId,
        },
        autoBuy: {
            cropId: state.autoBuy.cropId,
            perBuyCount: state.autoBuy.perBuyCount,
            repeatTimes: state.autoBuy.repeatTimes,
        },
    });

    const saveSettingsToStorage = () => {
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(getPersistedSettingsFromState()));
        } catch (err) {
            // ignore storage errors
        }
    };

    const loadSettingsFromStorage = () => {
        try {
            const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            applyPersistedSettingsToState(parsed);
        } catch (err) {
            // ignore storage errors
        }
    };

    resetStateSettingsToDefault();
    loadSettingsFromStorage();

    const getOptions = (body) => ({
        method: 'POST',
        headers: {
            accept: 'application/json, text/plain, */*',
        },
        body,
        credentials: 'include',
        mode: 'cors'
    });

    const createFD = (fields = {}) => {
        const fd = new FormData();
        Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
        return fd;
    };

    const readJsonResponse = async (res, label) => {
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : {};
        } catch (err) {
            throw new Error(`${label} returned non-JSON response: ${text.slice(0, 160)}`);
        }
        if (!res.ok) {
            throw new Error(`${label} HTTP ${res.status}: ${text.slice(0, 160)}`);
        }
        return data;
    };

    const requestFormJson = async ({
        path = '',
        url = '',
        fields = {},
        formData = null,
        label = '',
        requireSuccess = false,
    } = {}) => {
        const requestLabel = label || `API ${path || url}`;
        const targetUrl = buildApiUrl(url || path);
        const body = formData || createFD(fields);
        const data = await readJsonResponse(await fetch(targetUrl, getOptions(body)), requestLabel);
        return requireSuccess ? assertApiSuccess(data, requestLabel) : data;
    };

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const nowSec = () => Math.floor(Date.now() / 1000);

    const isSuccess = (data) => {
        if (!data) return false;
        if (data.iRet === 0 || data.ret === 0 || data.code === 0 || data.success === true) return true;
        const msg = String(data.sMsg || data.msg || '').toLowerCase();
        return msg.includes('success') || msg.includes('成功');
    };

    const hasExplicitApiStatus = (data) => (
        isObjectLike(data)
        && (
            data.iRet !== undefined
            || data.ret !== undefined
            || data.code !== undefined
            || data.success !== undefined
        )
    );
    const isExplicitApiStatusSuccess = (data) => {
        const statusCodes = [data?.iRet, data?.ret, data?.code]
            .filter(value => value !== undefined && value !== null && value !== '');
        if (statusCodes.length) {
            return statusCodes.some(value => Number(value) === 0);
        }
        if (data?.success !== undefined) {
            const successText = String(data.success).toLowerCase();
            return data.success === true || data.success === 1 || successText === '1' || successText === 'true';
        }
        return false;
    };
    const getApiErrorDetail = (data) => {
        if (!isObjectLike(data)) return String(data ?? '');
        const code = data.iRet ?? data.ret ?? data.code ?? data.success ?? 'unknown';
        const msg = data.sMsg || data.msg || data.message || data.errMsg || '';
        return `code=${code}${msg ? `, msg=${msg}` : ''}`;
    };
    const assertApiSuccess = (data, label) => {
        if (!isObjectLike(data)) {
            throw new Error(`${label} response is not an object`);
        }
        if (hasExplicitApiStatus(data) && !isExplicitApiStatusSuccess(data)) {
            throw new Error(`${label} failed: ${getApiErrorDetail(data)}`);
        }
        return data;
    };
    const assertApiShape = (condition, label, detail) => {
        if (!condition) {
            throw new Error(`${label} invalid response shape: ${detail}`);
        }
    };

    const isNotNeeded = (data) => data?.iRet === 10002202;
    const getRetCode = (data) => {
        const code = Number(data?.iRet ?? data?.ret ?? data?.code);
        return Number.isFinite(code) ? code : NaN;
    };

    const fmtMs = (ms) => {
        if (!Number.isFinite(ms) || ms < 0) return '--';
        if (ms < 1000) return `${Math.floor(ms)}ms`;
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    const fmtMsWithDays = (ms) => {
        if (!Number.isFinite(ms) || ms < 0) return '--';
        const totalSec = Math.floor(ms / 1000);
        const d = Math.floor(totalSec / 86400);
        const h = Math.floor((totalSec % 86400) / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        if (d > 0) return `${d}d ${h}h ${m}m`;
        if (h > 0) return `0d ${h}h ${m}m`;
        if (m > 0) return `0d ${m}m ${s}s`;
        return `0d ${s}s`;
    };

    const fmtCountdown = (ms) => {
        if (!Number.isFinite(ms) || ms <= 0) return '0s';
        return fmtMs(ms);
    };

    const fmtSeedGrowDuration = (seconds) => {
        const totalSec = Number(seconds);
        if (!Number.isFinite(totalSec) || totalSec <= 0) return '--';
        const totalMin = Math.max(1, Math.ceil(totalSec / 60));
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${h}h ${m} min`;
    };

    const escapeHtml = (str) => String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const renderApiRegionOptionButtons = () => {
        const selected = normalizeApiRegion(state.ui.apiRegion, DEFAULT_API_REGION);
        return API_REGION_OPTIONS.map(option => {
            const value = option.value;
            const label = t(option.labelKey);
            const activeClass = value === selected ? 'cg-primary' : 'cg-muted';
            return `<button type="button" data-api-region="${escapeHtml(value)}" class="cg-btn cg-btn-sm ${activeClass}">${escapeHtml(label)}</button>`;
        }).join('');
    };

    const removeOldUI = () => {
        document.getElementById(PANEL_ID)?.remove();
        document.getElementById(TOGGLE_ID)?.remove();
    };

    const injectUIStyles = () => {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${PANEL_ID} .cg-card {
                margin-bottom: 10px;
                background: rgba(255,255,255,0.05);
                border-radius: 10px;
                padding: 8px 10px;
            }
            #${PANEL_ID} .cg-actions {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
                justify-content: center;
                margin-bottom: 8px;
            }
            #${PANEL_ID} .cg-between {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
                margin-bottom: 8px;
            }
            #${PANEL_ID} .cg-table-wrap {
                overflow: auto;
                border-radius: 8px;
                background: rgba(255,255,255,0.04);
                margin-bottom: 8px;
            }
            #${PANEL_ID} .cg-title {
                font-weight: 700;
                margin: 8px 0 4px 0;
            }
            #${PANEL_ID} .cg-stat-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 4px 12px;
            }
            #${PANEL_ID} .cg-field {
                width: 100%;
                margin-top: 3px;
                border: 1px solid #555;
                background: #222;
                color: #fff;
                border-radius: 6px;
                padding: 6px 8px;
                box-sizing: border-box;
            }
            #${PANEL_ID} .cg-field-dark { background: #111; }
            #${PANEL_ID} .cg-api-url {
                margin-top: 3px;
                padding: 6px 8px;
                border-radius: 6px;
                background: rgba(255,255,255,0.05);
                color: #ddd;
                word-break: break-all;
                font-size: 12px;
            }
            #${PANEL_ID} .cg-region-options {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            #${PANEL_ID} .cg-icon-btn {
                border: none;
                background: #595959;
                color: #fff;
                width: 28px;
                height: 28px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
            }
            #${PANEL_ID} .cg-toolbar {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
                justify-content: center;
                margin-bottom: 8px;
            }
            #${PANEL_ID} .cg-btn {
                border: none;
                color: #fff;
                padding: 6px 10px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 12px;
            }
            #${PANEL_ID} .cg-btn-sm {
                padding: 5px 8px;
                font-size: 11px;
                line-height: 1;
                white-space: nowrap;
            }
            #${PANEL_ID} .cg-primary { background: #1677ff; }
            #${PANEL_ID} .cg-success { background: #52c41a; }
            #${PANEL_ID} .cg-danger { background: #ff4d4f; }
            #${PANEL_ID} .cg-teal { background: #13c2c2; }
            #${PANEL_ID} .cg-orange { background: #fa8c16; }
            #${PANEL_ID} .cg-muted { background: #434343; }
            #${PANEL_ID} .cg-gray { background: #8c8c8c; }
            #${PANEL_ID} .cg-purple { background: #722ed1; }
            #${PANEL_ID} .cg-mode-btn {
                padding: 7px 10px;
                font-weight: 700;
            }
        `;
        document.head.appendChild(style);
    };

    const inputStyle = (background = '#222', extra = '') => (
        `width:100%;margin-top:3px;border:1px solid #555;background:${background};color:#fff;border-radius:6px;padding:6px 8px;box-sizing:border-box;${extra}`
    );

    const createUI = () => {
        removeOldUI();
        injectUIStyles();

        const overlayTopOffset = getDefaultOverlayTopOffset();
        const panelOpacity = normalizePanelOpacity(state.ui.panelOpacity, DEFAULT_PANEL_OPACITY);
        const hasCustomTogglePosition = state.ui.toggleCustomPosition === true;
        const toggleLeft = hasCustomTogglePosition ? normalizeOverlayCoord(state.ui.toggleLeft) : null;
        const toggleTop = hasCustomTogglePosition ? normalizeOverlayCoord(state.ui.toggleTop) : null;

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.style.cssText = `
            position: fixed;
            top: ${overlayTopOffset}px;
            right: 16px;
            width: 620px;
            max-width: calc(100vw - 32px);
            height: calc(100vh - 32px);
            display: none;
            flex-direction: column;
            background: rgba(20,20,20,0.96);
            color: #fff;
            z-index: 999999;
            border-radius: 12px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.35);
            font-family: Arial, sans-serif;
            font-size: 13px;
            line-height: 1.5;
            backdrop-filter: blur(6px);
            overflow: hidden;
            user-select: text;
            -webkit-user-select: text;
            opacity: ${panelOpacity};
        `;

        panel.innerHTML = `
            <div style="
                flex: 0 0 auto;
                background: rgba(20,20,20,0.98);
                padding: 12px 14px 10px 14px;
                border-bottom: 1px solid rgba(255,255,255,0.08);
            ">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                    <div id="module-tab-bar" style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
                        <button id="tab-autofarm-btn" data-tab="autofarm" class="cg-btn cg-btn-sm cg-primary">${t('tabAutoFarm')}</button>
                        <button id="tab-xp-btn" data-tab="xp" class="cg-btn cg-btn-sm cg-muted">${t('tabXp')}</button>
                        <button id="tab-buy-btn" data-tab="buy" class="cg-btn cg-btn-sm cg-muted">${t('tabBuy')}</button>
                        <button id="tab-missions-btn" data-tab="missions" class="cg-btn cg-btn-sm cg-muted">${t('tabMissions')}</button>
                        <button id="tab-status-btn" data-tab="status" class="cg-btn cg-btn-sm cg-muted">${t('tabStatus')}</button>
                        <button id="tab-settings-btn" data-tab="settings" class="cg-btn cg-btn-sm cg-muted">${t('tabSettings')}</button>
                    </div>
                    <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                        <button id="lang-toggle-btn" class="cg-btn cg-btn-sm cg-purple">${state.ui.lang === 'zh' ? 'EN' : '中文'}</button>
                        <button id="tab-hide-btn" class="cg-icon-btn">-</button>
                    </div>
                </div>
            </div>

            <div id="main-scroll-area" style="
                flex: 1 1 auto;
                overflow: auto;
                padding: 12px 14px 10px 14px;
                min-height: 0;
            ">
                <div id="section-status" data-tab-pane="status" class="cg-card">
                    <div style="margin-top:8px;">
                        <div class="cg-between">
                            <div id="status-summary" style="color:#ddd;">${t('notLoaded')}</div>
                            <button id="status-refresh-btn" class="cg-btn cg-primary">${t('refresh')}</button>
                        </div>

                        <div class="cg-stat-grid" style="margin-bottom:8px;">
                            <div>${t('level')}</div><div id="status-level">--</div>
                            <div>${t('gold')}</div><div id="status-money">--</div>
                            <div>${t('bloomCoins')}</div><div id="status-huading">--</div>
                        </div>

                        <div class="cg-title">${t('plotInfo')}</div>
                        <div id="status-land-table-wrap" class="cg-table-wrap">--</div>

                        <div class="cg-title">${t('flowerOverview')}</div>
                        <div id="status-flower-table-wrap" class="cg-table-wrap">--</div>

                        <div class="cg-title">${t('seedOverview')}</div>
                        <div id="status-seed-table-wrap" class="cg-table-wrap">--</div>
                    </div>
                </div>

                <div id="section-missions" data-tab-pane="missions" class="cg-card">
                    <div style="margin-top:8px;">
                        <div class="cg-between">
                            <div style="font-weight:700;">${t('missionPanel')}</div>
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#eee;">
                                    <input id="mission-hide-completed" type="checkbox" ${state.ui.hideCompletedMissions ? 'checked' : ''} style="accent-color:#52c41a;">
                                    <span>${t('hideCompletedTasks')}</span>
                                </label>
                                <button id="mission-refresh-btn" class="cg-btn cg-primary">${t('refresh')}</button>
                            </div>
                        </div>
                        <div id="status-mission-panel-wrap" class="cg-table-wrap" style="margin-bottom:0;">--</div>
                    </div>
                </div>

                <div id="section-xp" data-tab-pane="xp" class="cg-card">
                    <div style="margin-top:8px;">
                        <div class="cg-actions">
                            <button id="xp-start-btn" class="cg-btn cg-success">${t('start')}</button>
                            <button id="xp-stop-btn" class="cg-btn cg-danger" style="display:none;">${t('stop')}</button>
                            <button id="xp-apply-btn" class="cg-btn cg-primary">${t('apply')}</button>
                        </div>
                        <div style="text-align:center;color:#bbb;font-size:12px;line-height:1.6;margin:-2px 0 10px 0;user-select:text;-webkit-user-select:text;">${t('guideXp')}</div>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 10px;margin-bottom:8px;">
                            <label>
                                ${t('crop')}
                                <select id="xp-crop-id" class="cg-field"></select>
                            </label>

                            <label>
                                ${t('plot')}
                                <select id="xp-land-index" class="cg-field"></select>
                            </label>

                            <label style="grid-column:1 / span 2;">
                                ${t('quest')}
                                <select id="xp-mission-id" class="cg-field"></select>
                            </label>

                            <div style="grid-column:1 / span 2;">
                                ${t('timerMode')}
                                <div id="xp-timer-mode-group" style="display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:3px;border:1px solid #555;background:#222;border-radius:6px;padding:8px;">
                                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                                        <input id="xp-mode-always" type="radio" name="xp-timer-mode-radio" value="always" ${state.xp.timerMode === 'always' ? 'checked' : ''} style="accent-color:#52c41a;">
                                        <span>${t('modeAlways')}</span>
                                    </label>
                                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                                        <input id="xp-mode-countdown" type="radio" name="xp-timer-mode-radio" value="countdown" ${state.xp.timerMode === 'countdown' ? 'checked' : ''} style="accent-color:#52c41a;">
                                        <span>${t('modeCountdown')}</span>
                                    </label>
                                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                                        <input id="xp-mode-countup" type="radio" name="xp-timer-mode-radio" value="countup" ${state.xp.timerMode === 'countup' ? 'checked' : ''} style="accent-color:#52c41a;">
                                        <span>${t('modeCountup')}</span>
                                    </label>
                                </div>
                            </div>

                            <div id="xp-countdown-settings" style="grid-column:1 / span 2;">
                                ${t('countdownSettings')}
                                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px 10px;margin-top:3px;">
                                    <label>
                                        ${t('days')}
                                        <input id="xp-countdown-days" class="cg-field" type="number" min="0" step="1" value="${state.xp.countdownDays}">
                                    </label>
                                    <label>
                                        ${t('hours')}
                                        <input id="xp-countdown-hours" class="cg-field" type="number" min="0" max="23" step="1" value="${state.xp.countdownHours}">
                                    </label>
                                    <label>
                                        ${t('mins')}
                                        <input id="xp-countdown-minutes" class="cg-field" type="number" min="0" max="59" step="1" value="${state.xp.countdownMinutes}">
                                    </label>
                                </div>
                            </div>

                            <div id="xp-countup-settings" style="grid-column:1 / span 2;">
                                ${t('countupSettings')}
                                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 10px;margin-top:3px;">
                                    <label>
                                        ${t('hour')}
                                        <input id="xp-stop-hour" class="cg-field" type="number" min="0" max="23" step="1" value="${state.xp.stopHour}">
                                    </label>
                                    <label>
                                        ${t('min')}
                                        <input id="xp-stop-minute" class="cg-field" type="number" min="0" max="59" step="1" value="${state.xp.stopMinute}">
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div style="margin-bottom:8px;">
                            <div style="display:flex;justify-content:space-between;"><span>${t('timerProgress')}</span><span id="xp-progress-text">0 / 0</span></div>
                            <div style="width:100%;height:10px;background:#333;border-radius:999px;overflow:hidden;margin-top:4px;">
                                <div id="xp-progress-bar" style="width:0%;height:100%;background:linear-gradient(90deg,#52c41a,#95de64);transition:width .25s ease;"></div>
                            </div>
                        </div>

                        <div style="margin-bottom:8px;">
                            <div style="display:flex;justify-content:space-between;"><span>${t('roundProgress')}</span><span id="xp-batch-progress-text">0 / 0</span></div>
                            <div style="width:100%;height:10px;background:#333;border-radius:999px;overflow:hidden;margin-top:4px;">
                                <div id="xp-batch-progress-bar" style="width:0%;height:100%;background:linear-gradient(90deg,#1677ff,#69b1ff);transition:width .25s ease;"></div>
                            </div>
                        </div>

                        <div id="xp-status" style="margin-bottom:8px;color:#ddd;">${t('xpStopped')}</div>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;">
                            <div>${t('currentStep')}</div><div id="xp-step-summary">0${t('round')} [0/0]</div>
                            <div>${t('requests')}</div><div id="xp-req-summary">0 [0/0]</div>
                            <div>${t('plantsOk')}</div><div id="xp-plant-ok">0</div>
                            <div>${t('removesOk')}</div><div id="xp-eliminate-ok">0</div>
                            <div>${t('questsOk')}</div><div id="xp-mission-ok">0</div>
                            <div>${t('autoBuys')}</div><div id="xp-autobuy-triggered">0</div>
                            <div>${t('waiting')}</div><div id="xp-waiting">0ms</div>
                            <div>${t('elapsed')}</div><div id="xp-elapsed">0s</div>
                            <div>${t('remaining')}</div><div id="xp-eta">--</div>
                        </div>
                    </div>
                </div>

                <div id="section-buy" data-tab-pane="buy" class="cg-card">
                    <div style="margin-top:8px;">
                        <div class="cg-actions">
                            <button id="buy-run-btn" class="cg-btn cg-orange">${t('buyNow')}</button>
                            <button id="buy-apply-btn" class="cg-btn cg-primary">${t('apply')}</button>
                        </div>
                        <div style="text-align:center;color:#bbb;font-size:12px;margin:-2px 0 10px 0;">${t('guideBuy')}</div>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 10px;margin-bottom:8px;">
                            <label style="grid-column:1 / span 2;">
                                ${t('seedType')}
                                <select id="buy-crop-id" class="cg-field"></select>
                            </label>

                            <label>
                                ${t('buyTimes')}
                                <input id="buy-repeat-times" class="cg-field" type="number" min="1" step="1" value="${state.autoBuy.repeatTimes}">
                            </label>

                            <label>
                                ${t('perBuyCount')}
                                <input id="buy-per-count" class="cg-field" type="number" min="1" step="1" value="${state.autoBuy.perBuyCount}">
                            </label>
                        </div>

                        <div id="buy-status" style="margin-bottom:8px;color:#ddd;">${t('buyNotStarted')}</div>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;">
                            <div>${t('totalReq')}</div><div id="buy-total-req">0</div>
                            <div>${t('successReq')}</div><div id="buy-success-req">0</div>
                            <div>${t('failedReq')}</div><div id="buy-fail-req">0</div>
                            <div>${t('buyOk')}</div><div id="buy-success-actions">0</div>
                            <div>${t('seedsGot')}</div><div id="buy-bought-count">0</div>
                            <div>${t('lastAction')}</div><div id="buy-last-action">--</div>
                        </div>
                    </div>
                </div>

                <div id="section-autofarm" data-tab-pane="autofarm" class="cg-card">
                    <div style="margin-top:8px;">
                        <div class="cg-actions">
                            <button id="af-scheduler-stop-btn" class="cg-btn cg-danger" style="display:none;">${t('stop')}</button>
                            <button id="af-scheduler-start-btn" class="cg-btn cg-success">${t('start')}</button>
                            <button id="af-run-once-btn" class="cg-btn cg-teal">${t('runOnce')}</button>
                            <button id="af-apply-btn" class="cg-btn cg-primary">${t('apply')}</button>
                        </div>
                        <div style="text-align:center;color:#bbb;font-size:12px;margin:-2px 0 10px 0;">${t('guideAutoFarm')}</div>

                        <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:8px 10px;margin-bottom:8px;">
                            <label>
                                ${t('intervalMin')}
                                <input id="af-interval-min" class="cg-field" type="number" min="1" step="1" value="${state.autoFarm.intervalMin}">
                            </label>

                            <label>
                                ${t('delayMin')}
                                <input id="af-delay-min" class="cg-field" type="number" min="0" step="100" value="${state.autoFarm.randomDelayMinMs}">
                            </label>

                            <label>
                                ${t('delayMax')}
                                <input id="af-delay-max" class="cg-field" type="number" min="0" step="100" value="${state.autoFarm.randomDelayMaxMs}">
                            </label>

                            <div style="grid-column:1 / span 3;">
                                ${t('plotSelection')}
                                <div id="af-land-select-wrap" style="
                                    margin-top:3px;
                                    color:#fff;
                                    box-sizing:border-box;
                                    display:grid;
                                    grid-template-columns:repeat(3, minmax(0, 1fr));
                                    gap:8px;
                                "></div>
                            </div>

                            <div style="grid-column:1 / span 3;">
                                ${t('goalPlanting')}
                                <div style="margin-top:3px;border:1px solid #555;background:#222;border-radius:6px;padding:8px;">
                                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                                        <button id="af-mode-single-btn" type="button" class="cg-btn cg-mode-btn cg-primary">${t('singleFlowerSeed')}</button>
                                        <button id="af-mode-multi-btn" type="button" class="cg-btn cg-mode-btn cg-muted">${t('multiFlowerSeed')}</button>
                                    </div>

                                    <div id="af-single-seed-panel" style="border:1px solid rgba(255,255,255,0.10);border-radius:8px;padding:8px;margin-bottom:8px;">
                                        <label>
                                            ${t('seed')}
                                            <select id="af-crop-id" class="cg-field cg-field-dark"></select>
                                        </label>
                                        <div id="af-single-seed-count" style="margin-top:6px;color:#aaa;font-size:12px;">${t('thSeedCount')}: 0</div>
                                    </div>

                                    <div id="af-multi-seed-panel" style="border:1px solid rgba(255,255,255,0.10);border-radius:8px;padding:8px;">
                                        <div id="af-current-goal" style="margin-top:6px;color:#ccc;">${t('goalDisabled')}</div>
                                        <div style="margin-top:8px;">
                                            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;color:#ddd;font-size:12px;">
                                                <span>${t('allGoalProgress')}</span>
                                                <span id="af-goal-progress-text">0 / 0</span>
                                            </div>
                                            <div style="width:100%;height:10px;background:#111;border-radius:999px;overflow:hidden;margin-top:4px;">
                                                <div id="af-goal-progress-bar" style="width:0%;height:100%;background:linear-gradient(90deg,#13c2c2,#73d13d);transition:width .25s ease;"></div>
                                            </div>
                                            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:4px;color:#aaa;font-size:12px;">
                                                <span>${t('estimatedTime')}</span>
                                                <span id="af-goal-eta">--</span>
                                            </div>
                                        </div>
                                        <div id="af-goal-table-wrap" style="margin-top:8px;background:rgba(255,255,255,0.04);border-radius:8px;"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="af-status" style="margin-bottom:8px;color:#ddd;">${t('afNotStarted')}</div>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;">
                            <div>${t('scheduler')}</div><div id="af-scheduler-status">${t('schedOff')}</div>
                            <div>${t('nextRun')}</div><div id="af-next-run">--</div>
                            <div>${t('cycles')}</div><div id="af-cycle-count">0</div>
                            <div>${t('requests')}</div><div id="af-req-summary">0 [0/0]</div>
                            <div>${t('plantsOk')}</div><div id="af-plant-ok">0</div>
                            <div>${t('harvestsOk')}</div><div id="af-harvest-ok">0</div>
                            <div>${t('watersOk')}</div><div id="af-water-ok">0</div>
                            <div>${t('skipped')}</div><div id="af-skipped">0</div>
                        </div>

                    </div>
                </div>

                <div id="section-settings" data-tab-pane="settings" class="cg-card">
                    <div style="margin-top:8px;">
                        <div class="cg-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <span>${t('apiRegionTitle')}:</span>
                            <span id="api-region-options" class="cg-region-options">
                                ${renderApiRegionOptionButtons()}
                            </span>
                        </div>
                        <div style="color:#bbb;font-size:12px;line-height:1.5;margin:-2px 0 8px 0;">${t('apiRegionHint')}</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 10px;margin-bottom:10px;">
                            <div>
                                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;white-space:nowrap;">
                                    <span style="color:#bbb;font-size:12px;">${t('apiAutoDetected')}:</span>
                                    <span id="api-auto-region" style="font-weight:400;color:#fff;">--</span>
                                </div>
                                <div id="api-auto-url" class="cg-api-url">--</div>
                            </div>
                            <div>
                                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;white-space:nowrap;">
                                    <span style="color:#bbb;font-size:12px;">${t('apiActiveEndpoint')}:</span>
                                    <span id="api-current-region" style="font-weight:400;color:#fff;">--</span>
                                </div>
                                <div id="api-current-url" class="cg-api-url">--</div>
                            </div>
                        </div>

                        <label>
                            ${t('apiCustomUrl')}
                            <input id="api-custom-url" class="cg-field" type="text" spellcheck="false" placeholder="${escapeHtml(t('apiCustomUrlPlaceholder'))}" value="${escapeHtml(state.ui.apiCustomBaseUrl)}">
                        </label>
                        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px;">
                            <button id="api-custom-apply-btn" type="button" class="cg-btn cg-primary">${t('apiApplyCustomUrl')}</button>
                        </div>

                        <div style="margin-top:14px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);">
                            <label style="display:block;">
                                <div class="cg-between" style="margin-bottom:6px;">
                                    <span>${t('panelOpacity')}</span>
                                    <span id="panel-opacity-value">${Math.round(panelOpacity * 100)}%</span>
                                </div>
                                <input id="panel-opacity-range" type="range" min="40" max="100" step="5" value="${Math.round(panelOpacity * 100)}" style="width:100%;accent-color:#1677ff;">
                            </label>
                        </div>

                        <div style="margin-top:14px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);">
                            <div class="cg-title" style="margin-top:0;">${t('resetAllSettingsTitle')}</div>
                            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px;">
                                <button id="reset-defaults-btn" type="button" class="cg-btn cg-gray">${t('resetDefaults')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="log-footer" style="
                flex: 0 0 auto;
                border-top: 1px solid rgba(255,255,255,0.08);
                background: rgba(20,20,20,0.98);
                padding: ${state.ui.logsCollapsed ? '6px 14px' : '10px 14px 12px 14px'};
            ">
                <div id="log-title-bar" style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:700;cursor:pointer;">
                    <span>${t('logTitle')}</span>
                    <button id="log-collapse-btn" style="display:inline-flex;align-items:center;justify-content:center;border:none;background:transparent;color:#bbb;width:20px;height:20px;padding:0;border-radius:0;cursor:pointer;line-height:1;outline:none;box-shadow:none;appearance:none;-webkit-tap-highlight-color:transparent;" title="${state.ui.logsCollapsed ? t('logExpand') : t('logCollapse')}"><span aria-hidden="true" style="display:inline-block;width:7px;height:7px;border-style:solid;border-color:currentColor;border-width:0 2px 2px 0;transform:rotate(${state.ui.logsCollapsed ? '-135deg' : '45deg'});transform-origin:center;"></span></button>
                </div>
                <div id="merged-log" style="
                    display: ${state.ui.logsCollapsed ? 'none' : 'block'};
                    height: 180px;
                    overflow: auto;
                    background: rgba(255,255,255,0.06);
                    border-radius: 8px;
                    padding: 8px;
                    margin-top: 4px;
                    font-size: 12px;
                    white-space: pre-wrap;
                    user-select: text;
                    -webkit-user-select: text;
                    cursor: text;
                ">${t('noLogs')}</div>
            </div>
        `;

        const toggle = document.createElement('button');
        toggle.id = TOGGLE_ID;
        toggle.textContent = t('togglePanel');
        toggle.style.cssText = `
            position: fixed;
            top: ${toggleTop ?? overlayTopOffset}px;
            ${toggleLeft !== null ? `left: ${toggleLeft}px;` : 'right: 16px;'}
            z-index: 999999;
            border: none;
            background: rgba(20,20,20,0.96);
            color: #fff;
            padding: 10px 12px;
            border-radius: 10px;
            cursor: pointer;
            box-shadow: 0 8px 30px rgba(0,0,0,0.35);
            font-family: Arial, sans-serif;
            font-size: 13px;
            display: block;
            user-select: none;
            -webkit-user-select: none;
            touch-action: none;
            opacity: ${panelOpacity};
        `;

        const stopPropagation = (e) => e.stopPropagation();
        for (const evt of ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'mousemove', 'click', 'touchstart', 'touchmove', 'touchend', 'wheel']) {
            panel.addEventListener(evt, stopPropagation, false);
        }

        document.body.appendChild(panel);
        document.body.appendChild(toggle);

        return { panel, toggle };
    };

    let uiResult = createUI();

    const EL_IDS = Object.freeze({
        langToggleBtn: 'lang-toggle-btn',
        resetDefaultsBtn: 'reset-defaults-btn',
        panelOpacityRange: 'panel-opacity-range',
        panelOpacityValue: 'panel-opacity-value',
        apiRegionOptionWrap: 'api-region-options',
        apiCustomUrl: 'api-custom-url',
        apiCustomApplyBtn: 'api-custom-apply-btn',
        apiAutoRegion: 'api-auto-region',
        apiAutoUrl: 'api-auto-url',
        apiCurrentRegion: 'api-current-region',
        apiCurrentUrl: 'api-current-url',
        hideBtn: 'tab-hide-btn',
        logFooter: 'log-footer',
        logTitleBar: 'log-title-bar',
        logCollapseBtn: 'log-collapse-btn',
        log: 'merged-log',
        tabStatusBtn: 'tab-status-btn',
        tabMissionsBtn: 'tab-missions-btn',
        tabXpBtn: 'tab-xp-btn',
        tabBuyBtn: 'tab-buy-btn',
        tabAutoFarmBtn: 'tab-autofarm-btn',
        tabSettingsBtn: 'tab-settings-btn',
        sectionStatus: 'section-status',
        sectionMissions: 'section-missions',
        sectionXp: 'section-xp',
        sectionBuy: 'section-buy',
        sectionAutoFarm: 'section-autofarm',
        sectionSettings: 'section-settings',
        statusRefreshBtn: 'status-refresh-btn',
        statusSummary: 'status-summary',
        statusLevel: 'status-level',
        statusMoney: 'status-money',
        statusHuading: 'status-huading',
        statusLandTableWrap: 'status-land-table-wrap',
        statusSeedTableWrap: 'status-seed-table-wrap',
        statusFlowerTableWrap: 'status-flower-table-wrap',
        statusMissionPanelWrap: 'status-mission-panel-wrap',
        missionHideCompleted: 'mission-hide-completed',
        missionRefreshBtn: 'mission-refresh-btn',
        xpStartBtn: 'xp-start-btn',
        xpStopBtn: 'xp-stop-btn',
        xpApplyBtn: 'xp-apply-btn',
        xpModeCountdown: 'xp-mode-countdown',
        xpModeCountup: 'xp-mode-countup',
        xpModeAlways: 'xp-mode-always',
        xpCountdownSettings: 'xp-countdown-settings',
        xpCountupSettings: 'xp-countup-settings',
        xpCountdownDays: 'xp-countdown-days',
        xpCountdownHours: 'xp-countdown-hours',
        xpCountdownMinutes: 'xp-countdown-minutes',
        xpStopHour: 'xp-stop-hour',
        xpStopMinute: 'xp-stop-minute',
        xpLandIndex: 'xp-land-index',
        xpCropId: 'xp-crop-id',
        xpMissionId: 'xp-mission-id',
        xpProgressBar: 'xp-progress-bar',
        xpProgressText: 'xp-progress-text',
        xpBatchProgressBar: 'xp-batch-progress-bar',
        xpBatchProgressText: 'xp-batch-progress-text',
        xpStatus: 'xp-status',
        xpStepSummary: 'xp-step-summary',
        xpReqSummary: 'xp-req-summary',
        xpPlantOk: 'xp-plant-ok',
        xpEliminateOk: 'xp-eliminate-ok',
        xpMissionOk: 'xp-mission-ok',
        xpAutoBuyTriggered: 'xp-autobuy-triggered',
        xpWaiting: 'xp-waiting',
        xpElapsed: 'xp-elapsed',
        xpEta: 'xp-eta',
        buyRunBtn: 'buy-run-btn',
        buyApplyBtn: 'buy-apply-btn',
        buyCropId: 'buy-crop-id',
        buyPerCount: 'buy-per-count',
        buyRepeatTimes: 'buy-repeat-times',
        buyStatus: 'buy-status',
        buyTotalReq: 'buy-total-req',
        buySuccessReq: 'buy-success-req',
        buyFailReq: 'buy-fail-req',
        buySuccessActions: 'buy-success-actions',
        buyBoughtCount: 'buy-bought-count',
        buyLastAction: 'buy-last-action',
        afRunOnceBtn: 'af-run-once-btn',
        afSchedulerStartBtn: 'af-scheduler-start-btn',
        afSchedulerStopBtn: 'af-scheduler-stop-btn',
        afApplyBtn: 'af-apply-btn',
        afCropId: 'af-crop-id',
        afIntervalMin: 'af-interval-min',
        afLandSelectWrap: 'af-land-select-wrap',
        afDelayMin: 'af-delay-min',
        afDelayMax: 'af-delay-max',
        afModeSingleBtn: 'af-mode-single-btn',
        afModeMultiBtn: 'af-mode-multi-btn',
        afSingleSeedPanel: 'af-single-seed-panel',
        afMultiSeedPanel: 'af-multi-seed-panel',
        afSingleSeedCount: 'af-single-seed-count',
        afCurrentGoal: 'af-current-goal',
        afGoalProgressText: 'af-goal-progress-text',
        afGoalProgressBar: 'af-goal-progress-bar',
        afGoalEta: 'af-goal-eta',
        afGoalTableWrap: 'af-goal-table-wrap',
        afStatus: 'af-status',
        afSchedulerStatus: 'af-scheduler-status',
        afNextRun: 'af-next-run',
        afCycleCount: 'af-cycle-count',
        afReqSummary: 'af-req-summary',
        afPlantOk: 'af-plant-ok',
        afHarvestOk: 'af-harvest-ok',
        afWaterOk: 'af-water-ok',
        afSkipped: 'af-skipped',
    });

    const collectEls = ({ panel = null, toggle = null } = {}) => {
        const refs = {
            panel: panel || document.getElementById(PANEL_ID),
            toggle: toggle || document.getElementById(TOGGLE_ID),
        };
        Object.entries(EL_IDS).forEach(([key, id]) => {
            refs[key] = document.getElementById(id);
        });
        return refs;
    };

    const els = collectEls(uiResult);

    const logText = (zh, en = zh) => (state.ui.lang === 'en' ? en : zh);

    const formatPanelOpacityPercent = (value = state.ui.panelOpacity) => `${Math.round(normalizePanelOpacity(value, DEFAULT_PANEL_OPACITY) * 100)}%`;

    const applyPanelOpacityUI = () => {
        const opacity = normalizePanelOpacity(state.ui.panelOpacity, DEFAULT_PANEL_OPACITY);
        if (els.panel) els.panel.style.opacity = String(opacity);
        if (els.toggle) els.toggle.style.opacity = String(opacity);
        if (els.panelOpacityRange && document.activeElement !== els.panelOpacityRange) {
            els.panelOpacityRange.value = String(Math.round(opacity * 100));
        }
        if (els.panelOpacityValue) {
            els.panelOpacityValue.textContent = formatPanelOpacityPercent(opacity);
        }
    };

    const applyTogglePositionUI = () => {
        if (!els.toggle) return;
        const defaultTop = getDefaultOverlayTopOffset();
        const width = Math.max(1, els.toggle.offsetWidth || 0);
        const height = Math.max(1, els.toggle.offsetHeight || 0);
        const maxLeft = Math.max(0, window.innerWidth - width);
        const maxTop = Math.max(0, window.innerHeight - height);
        const hasCustomPosition = state.ui.toggleCustomPosition === true;
        const left = hasCustomPosition ? normalizeOverlayCoord(state.ui.toggleLeft) : null;
        const top = hasCustomPosition ? normalizeOverlayCoord(state.ui.toggleTop) : null;

        if (hasCustomPosition) {
            const nextLeft = Math.min(maxLeft, Math.max(0, left));
            const nextTop = Math.min(maxTop, Math.max(0, top));
            state.ui.toggleLeft = nextLeft;
            state.ui.toggleTop = nextTop;
            els.toggle.style.left = `${nextLeft}px`;
            els.toggle.style.right = 'auto';
            els.toggle.style.top = `${nextTop}px`;
        } else {
            state.ui.toggleCustomPosition = false;
            state.ui.toggleLeft = null;
            state.ui.toggleTop = null;
            els.toggle.style.left = '';
            els.toggle.style.right = '16px';
            els.toggle.style.top = `${defaultTop}px`;
        }
    };

    const bindToggleDrag = () => {
        if (!els.toggle) return;
        let pointerId = null;
        let startClientX = 0;
        let startClientY = 0;
        let startLeft = 0;
        let startTop = 0;
        let moved = false;

        const endDrag = () => {
            if (pointerId === null) return;
            pointerId = null;
            if (moved) {
                uiRuntime.toggleDragSuppressClick = true;
                saveSettingsToStorage();
                setTimeout(() => { uiRuntime.toggleDragSuppressClick = false; }, 0);
            }
        };

        els.toggle.addEventListener('pointerdown', (event) => {
            if (event.button !== undefined && event.button !== 0) return;
            applyTogglePositionUI();
            pointerId = event.pointerId;
            startClientX = event.clientX;
            startClientY = event.clientY;
            const rect = els.toggle.getBoundingClientRect();
            startLeft = Math.max(0, rect.left);
            startTop = Math.max(0, rect.top);
            moved = false;
            els.toggle.setPointerCapture?.(pointerId);
            event.preventDefault();
        });

        els.toggle.addEventListener('pointermove', (event) => {
            if (pointerId === null || event.pointerId !== pointerId) return;
            const nextLeft = startLeft + (event.clientX - startClientX);
            const nextTop = startTop + (event.clientY - startClientY);
            if (!moved && (Math.abs(event.clientX - startClientX) > 3 || Math.abs(event.clientY - startClientY) > 3)) {
                moved = true;
                state.ui.toggleCustomPosition = true;
            }
            if (!moved) return;
            state.ui.toggleLeft = nextLeft;
            state.ui.toggleTop = nextTop;
            applyTogglePositionUI();
            event.preventDefault();
        });

        els.toggle.addEventListener('pointerup', endDrag);
        els.toggle.addEventListener('pointercancel', endDrag);
    };

    const localizeLogFallback = (msg) => {
        let text = String(msg ?? '');
        if (state.ui.lang !== 'en') return text;

        const replacements = [
            ['自动买种子', 'Buy Seeds'],
            ['自动种植', 'Auto Farm'],
            ['刷经验', 'XP Farm'],
            ['买种子', 'Buy Seeds'],
            ['前端原生', 'native frontend'],
            ['花园', 'garden'],
            ['任务窗口', 'mission window'],
            ['任务进度', 'quest progress'],
            ['循环任务', 'repeat quest'],
            ['任务提交', 'quest submit'],
            ['任务', 'quest'],
            ['个地块', 'lands'],
            ['地块', 'land'],
            ['作物', 'crop'],
            ['种子', 'seed'],
            ['鲜花', 'flower'],
            ['浇水阈值', 'water threshold'],
            ['浇水', 'water'],
            ['收获后补种', 'replant after harvest'],
            ['补种', 'replant'],
            ['种植重试', 'plant retry'],
            ['预清空', 'pre-clear'],
            ['清空', 'clear'],
            ['消除', 'remove'],
            ['铲除', 'remove'],
            ['收获', 'harvest'],
            ['种植', 'plant'],
            ['提交', 'submit'],
            ['设置已应用', 'settings applied'],
            ['检查间隔', 'check interval'],
            ['计时模式无效', 'invalid timer mode'],
            ['倒计时天数无效', 'invalid countdown days'],
            ['倒计时小时无效', 'invalid countdown hours'],
            ['倒计时分钟无效', 'invalid countdown minutes'],
            ['正计时停止小时无效', 'invalid stop hour'],
            ['正计时停止分钟无效', 'invalid stop minute'],
            ['倒计时模式下，天/小时/分钟至少需要一个大于 0', 'countdown mode needs days/hours/minutes greater than 0'],
            ['每次购买数量无效', 'invalid per-buy count'],
            ['购买次数无效', 'invalid buy times'],
            ['间隔无效', 'invalid interval'],
            ['随机延迟无效', 'invalid random delay'],
            ['至少勾选 1 个', 'select at least 1'],
            ['用户请求停止', 'user requested stop'],
            ['启动前', 'before start'],
            ['刷新失败', 'refresh failed'],
            ['刷新', 'refresh'],
            ['异常停止', 'stopped by error'],
            ['异常', 'error'],
            ['失败', 'failed'],
            ['成功', 'succeeded'],
            ['已完成', 'done'],
            ['完成', 'done'],
            ['未完成', 'not ready'],
            ['未配置停止条件', 'no stop condition'],
            ['一直运行', 'always run'],
            ['倒计时', 'countdown'],
            ['到点停止', 'stop at time'],
            ['正计时到点停止时间', 'count-up stop time'],
            ['首轮进度已满', 'first-round progress already full'],
            ['跳过种植/铲除，直接提交', 'skip plant/remove and submit directly'],
            ['本步跳过', 'skip this step'],
            ['本步可能不计任务进度', 'this step may not count toward quest progress'],
            ['本轮存在步骤失败', 'this round had step failures'],
            ['直接进入下一轮', 'go to next round'],
            ['不重试，直接继续下一轮', 'no retry, continue next round'],
            ['提交后', 'after submit'],
            ['提交失败后', 'after submit failure'],
            ['前序步骤未完全计入', 'previous steps may not have counted fully'],
            ['已有任务在跑，本次跳过', 'already running, skip this run'],
            ['读取到', 'loaded'],
            ['未勾选，跳过', 'not selected, skipped'],
            ['已空置，鲜花目标已完成，不再补种', 'is empty and flower goals are done; not replanting'],
            ['收获后目标已完成，不再补种', 'goals are done after harvest; not replanting'],
            ['已种植', 'planted'],
            ['已收获', 'harvested'],
            ['已识别', 'identified'],
            ['收获被服务器判定为不需要', 'harvest marked not needed by server'],
            ['被服务器判定暂时不需浇水', 'server says water is not needed yet'],
            ['暂不需要处理，跳过', 'needs no action, skipped'],
            ['鲜花目标已全部完成', 'all flower goals are done'],
            ['本轮执行完成', 'cycle complete'],
            ['已安排下次运行', 'next run scheduled'],
            ['分钟后', 'minutes later'],
            ['定时器开启，间隔', 'scheduler started, interval'],
            ['定时器已停止', 'scheduler stopped'],
            ['已请求关闭', 'requested close'],
            ['已直接调用', 'called directly'],
            ['已通过 EventBus 请求关闭', 'requested close through EventBus'],
            ['关闭', 'close'],
            ['已接入', 'connected to'],
            ['暂未找到', 'not found yet'],
            ['将仅刷新脚本状态', 'will only refresh script state'],
            ['检测到', 'detected'],
            ['当前', 'current'],
            ['自动购买 99 个', 'auto-buying 99'],
            ['手动购买', 'manual buy'],
            ['缺种子自动补货', 'seed restock'],
            ['第', '#'],
            ['次', 'x'],
            ['轮', 'round'],
            ['步数', 'steps'],
            ['分钟', 'min'],
            ['后', 'after'],
            ['等待', 'wait'],
            ['已', ''],
        ];

        for (const [zh, en] of replacements) {
            text = text.split(zh).join(en);
        }
        return text;
    };

    const addLog = (msg, type = 'INFO') => {
        const time = new Date().toLocaleTimeString();
        if (els.log.textContent === t('noLogs') || els.log.textContent === '暂无日志' || els.log.textContent === 'No logs') els.log.textContent = '';
        const nextText = `[${time}] [${type}] ${localizeLogFallback(msg)}\n` + els.log.textContent;
        els.log.textContent = nextText.split('\n').slice(0, MAX_LOG_LINES).join('\n');
    };

    const showPanel = () => {
        setActiveTab(state.ui.activeTab);
        saveSettingsToStorage();
        els.panel.style.display = 'flex';
        els.toggle.style.display = 'none';
    };

    const hidePanel = () => {
        els.panel.style.display = 'none';
        els.toggle.style.display = 'block';
    };

    const setXpRunningUI = (running) => {
        els.xpStartBtn.style.display = running ? 'none' : 'inline-block';
        els.xpStopBtn.style.display = running ? 'inline-block' : 'none';
    };

    const setSchedulerUI = (enabled) => {
        els.afSchedulerStartBtn.style.display = enabled ? 'none' : 'inline-block';
        els.afSchedulerStopBtn.style.display = enabled ? 'inline-block' : 'none';
    };

    const getLogCollapseIconMarkup = (collapsed = state.ui.logsCollapsed) => `
        <span aria-hidden="true" style="
            display:inline-block;
            width:7px;
            height:7px;
            border-style:solid;
            border-color:currentColor;
            border-width:0 2px 2px 0;
            transform:rotate(${collapsed ? '-135deg' : '45deg'});
            transform-origin:center;
        "></span>
    `;

    const setLogCollapsedUI = (collapsed = state.ui.logsCollapsed) => {
        state.ui.logsCollapsed = collapsed === true;
        if (els.log) {
            els.log.style.display = state.ui.logsCollapsed ? 'none' : 'block';
        }
        if (els.logFooter) {
            els.logFooter.style.padding = state.ui.logsCollapsed ? '6px 14px' : '10px 14px 12px 14px';
        }
        if (els.logCollapseBtn) {
            els.logCollapseBtn.innerHTML = getLogCollapseIconMarkup(state.ui.logsCollapsed);
            els.logCollapseBtn.title = state.ui.logsCollapsed ? t('logExpand') : t('logCollapse');
        }
    };

    const setActiveTab = (tabName) => {
        const target = String(tabName || 'autofarm');
        const paneMap = {
            status: els.sectionStatus,
            missions: els.sectionMissions,
            xp: els.sectionXp,
            buy: els.sectionBuy,
            autofarm: els.sectionAutoFarm,
            settings: els.sectionSettings,
        };
        const buttonMap = {
            status: els.tabStatusBtn,
            missions: els.tabMissionsBtn,
            xp: els.tabXpBtn,
            buy: els.tabBuyBtn,
            autofarm: els.tabAutoFarmBtn,
            settings: els.tabSettingsBtn,
        };

        state.ui.activeTab = Object.prototype.hasOwnProperty.call(paneMap, target) ? target : 'autofarm';

        for (const [key, pane] of Object.entries(paneMap)) {
            if (!pane) continue;
            const active = key === state.ui.activeTab;
            pane.style.display = active ? 'block' : 'none';
            if (pane.tagName === 'DETAILS') pane.open = active;
        }

        for (const [key, button] of Object.entries(buttonMap)) {
            if (!button) continue;
            const active = key === state.ui.activeTab;
            button.style.background = active ? '#1677ff' : '#434343';
        }
    };

    const pluralizeWord = (count, singular, plural = `${singular}s`) => (
        Number(count) === 1 ? singular : plural
    );

    const formatCountedText = (count, singular, plural = `${singular}s`) => (
        `${count} ${pluralizeWord(count, singular, plural)}`
    );

    const getLocalizedNameEntry = (rawName = '', key = '') => {
        const id = String(key ?? '').trim();
        const raw = String(rawName ?? '').trim();
        return LOCALIZED_NAME_MAP[id] || LOCALIZED_NAME_MAP[raw] || null;
    };

    const localizeKnownName = (rawName = '', key = '') => {
        const raw = String(rawName ?? '').trim();
        if (!raw) return raw;

        const entry = getLocalizedNameEntry(raw, key);
        if (entry) {
            return state.ui.lang === 'en'
                ? String(entry.en || entry.zh || raw).trim()
                : String(entry.zh || raw).trim();
        }
        return raw;
    };

    const localizeEmbeddedNames = (rawText = '') => {
        let text = String(rawText ?? '').trim();
        if (!text || state.ui.lang !== 'en') return text;

        for (const entry of LOCALIZED_REPLACE_ENTRIES) {
            text = text.split(entry.zh).join(entry.en);
        }
        return text;
    };

    const normalizeMissionTargetText = (rawText = '') => (
        String(rawText ?? '').trim().replace(/^[颗枚个朵棵株份只件]+/, '').trim()
    );

    const localizeMissionTarget = (rawText = '') => (
        localizeEmbeddedNames(normalizeMissionTargetText(rawText))
    );
    const localizeMissionTargetForCount = (rawText = '') => {
        const target = localizeMissionTarget(rawText);
        if (state.ui.lang === 'en' && target === 'Fire Iris') {
            return 'Fire Iris(es)';
        }
        return target;
    };

    const localizeMissionText = (rawText = '', key = '') => {
        const raw = String(rawText ?? '').trim();
        if (!raw || state.ui.lang !== 'en') return raw;

        const direct = localizeKnownName(raw, key);
        if (direct !== raw) return direct;

        const rules = [
            {
                pattern: /^在(\d+)个地块处种下种子$/,
                build: ([count]) => `Plant seeds on ${count} plot(s)`,
            },
            {
                pattern: /^在商店购买种子$/,
                build: () => 'Buy seeds from the Store',
            },
            {
                pattern: /^在商店购买(\d+)颗种子$/,
                build: ([count]) => `Buy ${count} seed(s) from the Store`,
            },
            {
                pattern: /^在商店购买(\d+)个建筑物$/,
                build: ([count]) => `Buy ${count} structure(s) from the Store`,
            },
            {
                pattern: /^在商店使用(?:花绽币|花碇币)$/,
                build: () => `Spend ${t('bloomCoins')} in the Store`,
            },
            {
                pattern: /^在商店使用(\d+)(?:枚)?(?:花绽币|花碇币)$/,
                build: ([count]) => `Spend ${count} ${t('bloomCoins')} in the Store`,
            },
            {
                pattern: /^在商店使用(\d+)金钱$/,
                build: ([count]) => `Spend ${count} ${t('gold')} in the Store`,
            },
            {
                pattern: /^在商店使用(\d+)朵花朵$/,
                build: ([count]) => `Spend ${count} flower(s) in the Store`,
            },
            {
                pattern: /^播种(\d+)颗(.+)$/,
                build: ([count, target]) => `Plant ${count} ${localizeMissionTarget(target)}`,
            },
            {
                pattern: /^种下(\d+)(.+)$/,
                build: ([count, target]) => `Plant ${count} ${localizeMissionTarget(target)}`,
            },
            {
                pattern: /^清理(\d+)个地块$/,
                build: ([count]) => `Clear ${formatCountedText(count, 'land')}`,
            },
            {
                pattern: /^查看你的庄园$/,
                build: () => 'View your Manor',
            },
            {
                pattern: /^给花园里的花朵浇水(\d+)次$/,
                build: ([count]) => `Water the flowers in your garden ${count} time(s)`,
            },
            {
                pattern: /^在你的花园里浇灌(.+?)(\d+)次$/,
                build: ([target, count]) => `Water ${localizeMissionTarget(target)} ${count} ${pluralizeWord(count, 'time')}`,
            },
            {
                pattern: /^给(.+)浇水(\d+)次$/,
                build: ([target, count]) => `Water ${localizeMissionTarget(target)} ${count} ${pluralizeWord(count, 'time')}`,
            },
            {
                pattern: /^采集鲜花(\d+)次$/,
                build: ([count]) => `Harvest flowers ${count} ${pluralizeWord(count, 'time')}`,
            },
            {
                pattern: /^收获鲜花(\d+)次$/,
                build: ([count]) => `Harvest flowers ${count} ${pluralizeWord(count, 'time')}`,
            },
            {
                pattern: /^收获(\d+)朵花朵$/,
                build: ([count]) => `Harvest ${count} flower(s)`,
            },
            {
                pattern: /^收获(\d+)次(.+)$/,
                build: ([count, target]) => `Harvest ${localizeMissionTarget(target)} ${count} ${pluralizeWord(count, 'time')}`,
            },
            {
                pattern: /^收获(.+?)(\d+)次$/,
                build: ([target, count]) => `Harvest ${localizeMissionTarget(target)} ${count} ${pluralizeWord(count, 'time')}`,
            },
            {
                pattern: /^在庄园放置(\d+)棵以前未放置过的植物$/,
                build: ([count]) => `Place ${count} plant(s) that haven't previously been placed in your Manor`,
            },
            {
                pattern: /^在庄园放置(\d+)个以前未放置过的植物$/,
                build: ([count]) => `Place ${count} plant(s) that haven't previously been placed in your Manor`,
            },
            {
                pattern: /^在庄园放置(\d+)个以前未放置过的(.+)$/,
                build: ([count, target]) => `Place ${count} ${localizeMissionTarget(target)} that haven't previously been placed in your Manor`,
            },
            {
                pattern: /^在庄园移除(\d+)个建筑物$/,
                build: ([count]) => `Remove ${count} structure(s) from your Manor`,
            },
            {
                pattern: /^移除(\d+)个建筑物$/,
                build: ([count]) => `Remove ${count} structure(s)`,
            },
            {
                pattern: /^在庄园界面更改房屋(\d+)次$/,
                build: ([count]) => `Change your house ${count} time(s) on the Manor screen`,
            },
            {
                pattern: /^使用(\d+)(.+)在《激斗峡谷》商店兑换道具$/,
                build: ([count, target]) => `Use ${count} ${localizeMissionTargetForCount(target)} to redeem items in Wild Rift from the Store`,
            },
            {
                pattern: /^使用(\d+)(.+)在商店兑换建筑物$/,
                build: ([count, target]) => `Use ${count} ${localizeMissionTarget(target)} to redeem structure(s) from the Store`,
            },
            {
                pattern: /^达到(\d+)级$/,
                build: ([count]) => `Reach Level ${count}`,
            },
        ];

        for (const rule of rules) {
            const matched = raw.match(rule.pattern);
            if (matched) {
                return rule.build(matched.slice(1));
            }
        }

        return localizeEmbeddedNames(raw);
    };

    const getCropRawName = (cropId) => {
        const crop = (state.status.shopSeeds || []).find(seed => String(seed.commodityId) === String(cropId));
        const catalogSeed = (state.status.shopSeedCatalog || []).find(seed => String(seed.commodityId) === String(cropId));
        return String(crop?.name || catalogSeed?.name || state.status.cropMap[String(cropId)] || cropId).trim();
    };

    const getCropDisplayName = (cropId) => localizeKnownName(getCropRawName(cropId), cropId);

    const getFlowerDisplayName = (flowerId, fallback = '') => {
        const id = String(flowerId ?? '').trim();
        const bagFlower = (state.status.bagFlowers || []).find(item => String(item.iItemId) === id);
        const raw = String(bagFlower?.sItemName || fallback || id).trim();
        return localizeKnownName(raw, id);
    };

    const getMissionDisplayName = (missionId, fallback = '') => {
        const id = String(missionId ?? '').trim();
        const raw = String(fallback || state.status.missionMap[id] || id).trim();
        return localizeMissionText(raw, id);
    };

    const getOwnedSeedCount = (cropId) => {
        const item = (state.status.bagSeeds || []).find(x => String(x.iItemId) === String(cropId));
        return Number(item?.iAmount ?? 0);
    };

    const formatSeedOptionLabel = (seed, { showOwnedCount = false } = {}) => {
        const cropId = String(seed?.commodityId ?? '').trim();
        const ownedCount = Math.max(0, Number(seed?.ownedAmount ?? getOwnedSeedCount(cropId) ?? 0));
        const ownedSuffix = showOwnedCount ? ` (${t('thOwned')}: ${ownedCount})` : '';
        return `${cropId} - ${getCropDisplayName(cropId)}${ownedSuffix}`;
    };

    const adjustBagSeedCount = (cropId, delta) => {
        const id = String(cropId);
        let item = (state.status.bagSeeds || []).find(x => String(x.iItemId) === id);

        if (!item) {
            item = {
                iItemId: Number(id),
                sItemName: state.status.cropMap[id] || id,
                iAmount: 0,
            };
            state.status.bagSeeds.push(item);
        }

        item.iAmount = Math.max(0, Number(item.iAmount || 0) + Number(delta || 0));
    };

    const updateKnownSeedOwnedAmount = (cropId, ownedAmount) => {
        const id = String(cropId);
        const nextAmount = Math.max(0, Number(ownedAmount || 0));

        for (const list of [state.status.shopSeeds || [], state.status.shopSeedCatalog || []]) {
            for (const seed of list) {
                const seedId = String(seed?.commodityId ?? seed?.iItemId ?? '').trim();
                if (seedId !== id) continue;
                seed.ownedAmount = nextAmount;
            }
        }
    };

    const getOwnedFlowerCount = (flowerId) => {
        const item = (state.status.bagFlowers || []).find(x => String(x.iItemId) === String(flowerId));
        return Number(item?.iAmount ?? 0);
    };

    const adjustBagFlowerCount = (flowerId, delta, flowerName = '') => {
        const id = String(flowerId);
        let item = (state.status.bagFlowers || []).find(x => String(x.iItemId) === id);

        if (!item) {
            item = {
                iItemId: Number(id),
                sItemName: flowerName || id,
                iAmount: 0,
            };
            state.status.bagFlowers.push(item);
        }

        if (flowerName && !item.sItemName) {
            item.sItemName = flowerName;
        }
        item.iAmount = Math.max(0, Number(item.iAmount || 0) + Number(delta || 0));
    };

    const populateSelect = (selectEl, options, selectedValue) => {
        const previous = String(selectedValue ?? '');
        selectEl.innerHTML = '';

        const seen = new Set();
        for (const opt of options) {
            const value = String(opt.value);
            if (seen.has(value)) continue;
            seen.add(value);

            const option = document.createElement('option');
            option.value = value;
            option.textContent = opt.label;
            if (value === previous) option.selected = true;
            selectEl.appendChild(option);
        }

        if (![...selectEl.options].some(o => o.value === previous) && selectEl.options.length > 0) {
            selectEl.value = selectEl.options[0].value;
        }
    };

    const withPersistedOption = (options, selectedValue, labelBuilder = (value) => `${value} - ${t('savedOption')}`) => {
        const value = String(selectedValue ?? '').trim();
        const list = Array.isArray(options) ? [...options] : [];

        if (value && !list.some(opt => String(opt?.value) === value)) {
            list.unshift({
                value,
                label: labelBuilder(value),
            });
        }

        return list;
    };

    const normalizeLandList = (landOptions) => {
        const raw = Array.isArray(landOptions) && landOptions.length
            ? landOptions
            : ["1", "2", "3", "4", "5", "6"];

        return [...new Set(raw.map(v => String(v)).filter(Boolean))].sort((a, b) => {
            const an = Number(a);
            const bn = Number(b);
            if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
            return String(a).localeCompare(String(b), 'en-US');
        });
    };

    const getDefaultAutoFarmLandSelection = (landOptions) => {
        const options = normalizeLandList(landOptions);
        return options.length ? options : [...DEFAULT_AF_LANDS];
    };

    const renderAutoFarmLandChecks = (landOptions) => {
        if (!els.afLandSelectWrap) return;

        const options = normalizeLandList(landOptions);
        const selectedSet = new Set((state.autoFarm.selectedLands || []).map(String));
        els.afLandSelectWrap.innerHTML = '';

        for (const idx of options) {
            const label = document.createElement('label');
            const selected = selectedSet.has(idx);
            label.style.cssText = `
                display:flex;
                align-items:center;
                justify-content:center;
                min-height:34px;
                border:1px solid ${selected ? '#52c41a' : '#555'};
                background:${selected ? 'rgba(82,196,26,0.22)' : '#222'};
                color:${selected ? '#fff' : '#ccc'};
                border-radius:8px;
                cursor:pointer;
                font-weight:700;
                user-select:none;
            `;

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = idx;
            input.checked = selectedSet.has(idx);
            input.style.display = 'none';

            const text = document.createElement('span');
            text.textContent = `${t('plotLabel')} ${idx}`;

            label.appendChild(input);
            label.appendChild(text);
            label.addEventListener('click', (event) => {
                event.preventDefault();
                input.checked = !input.checked;
                const nextSelectedSet = new Set((state.autoFarm.selectedLands || []).map(String));
                if (input.checked) {
                    nextSelectedSet.add(idx);
                } else {
                    nextSelectedSet.delete(idx);
                }
                state.autoFarm.selectedLands = [...nextSelectedSet].sort((a, b) => {
                    const an = Number(a);
                    const bn = Number(b);
                    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
                    return String(a).localeCompare(String(b), 'en-US');
                });
                saveSettingsToStorage();
                renderAutoFarmLandChecks(state.status.landOptions);
                updateUI();
            });
            els.afLandSelectWrap.appendChild(label);
        }
    };

    const getSelectedAutoFarmLandsFromUI = () => {
        if (!els.afLandSelectWrap) return [];
        return [...els.afLandSelectWrap.querySelectorAll('input[type="checkbox"]:checked')]
            .map(input => String(input.value))
            .filter(Boolean);
    };

    const getKnownSeedEntries = ({ includeLockedShop = false, requireUsable = false } = {}) => {
        const entries = new Map();
        const upsert = (seed) => {
            const id = String(seed?.commodityId ?? seed?.iItemId ?? seed?.cropId ?? '').trim();
            if (!id || id === '0') return;

            const previous = entries.get(id) || {};
            entries.set(id, {
                commodityId: id,
                name: String(seed?.name || seed?.sItemName || seed?.sName || previous.name || state.status.cropMap[id] || id).trim(),
                yieldCount: Number(seed?.yieldCount ?? previous.yieldCount ?? 0),
                expValue: Number(seed?.expValue ?? seed?.iExpValue ?? previous.expValue ?? 0),
                growDuration: Number(seed?.growDuration ?? seed?.growTime ?? previous.growDuration ?? 0),
                cost: Number(seed?.cost ?? previous.cost ?? 0),
                costName: String(seed?.costName || previous.costName || '').trim(),
                unlocked: seed?.unlocked === true || previous.unlocked === true,
                ownedAmount: Number(seed?.ownedAmount ?? seed?.iAmount ?? previous.ownedAmount ?? 0),
                source: previous.source || seed?.source || '',
            });
        };

        if (includeLockedShop) {
            for (const seed of state.status.shopSeedCatalog || []) {
                upsert({ ...seed, source: 'shopCatalog' });
            }
        }
        for (const seed of state.status.shopSeeds || []) {
            upsert({ ...seed, unlocked: true, source: 'shopUnlocked' });
        }
        for (const seed of state.status.bagSeeds || []) {
            upsert({
                commodityId: seed.iItemId,
                name: seed.sItemName,
                ownedAmount: seed.iAmount,
                source: 'bag',
            });
        }
        for (const land of state.status.gardenInfo || []) {
            const cropId = String(land?.cropId ?? '').trim();
            if (!cropId || cropId === '0') continue;
            upsert({
                commodityId: cropId,
                name: land?.cropDetail?.sName,
                expValue: land?.cropDetail?.iExpValue,
                growDuration: land?.cropDetail?.growTime,
                source: 'garden',
            });
        }

        return [...entries.values()]
            .filter(seed => !requireUsable || seed.unlocked || seed.ownedAmount > 0 || seed.source === 'garden')
            .sort((a, b) => {
                const an = Number(a?.commodityId);
                const bn = Number(b?.commodityId);
                if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
                return String(a?.commodityId ?? '').localeCompare(String(b?.commodityId ?? ''), 'en-US');
            });
    };

    const buildSelectors = () => {
        const rawLandOptions = normalizeLandList(state.status.landOptions);
        const landOptions = rawLandOptions
            .map(v => ({ value: String(v), label: `${t('plotLabel')} ${v}` }));

        const cropOptions = getKnownSeedEntries({ requireUsable: true })
            .map(seed => ({
                value: String(seed.commodityId),
                label: formatSeedOptionLabel(seed)
            }))
            .sort((a, b) => {
                const an = Number(a.value);
                const bn = Number(b.value);
                if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
                return a.value.localeCompare(b.value, 'en-US');
            });

        const buyCropOptions = getKnownSeedEntries({ requireUsable: true })
            .map(seed => ({
                value: String(seed.commodityId),
                label: formatSeedOptionLabel(seed, { showOwnedCount: true })
            }))
            .sort((a, b) => {
                const an = Number(a.value);
                const bn = Number(b.value);
                if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
                return a.value.localeCompare(b.value, 'en-US');
            });

        const fallbackCropOptions = [
            { value: DEFAULT_XP_CROP, label: `${DEFAULT_XP_CROP} - ${getCropDisplayName(DEFAULT_XP_CROP)}` },
            { value: DEFAULT_AF_CROP, label: `${DEFAULT_AF_CROP} - ${getCropDisplayName(DEFAULT_AF_CROP)}` },
        ];

        const mainMissionEntries = Object.entries(state.status.mainMissionMap || {})
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([id, name]) => ({
                value: id,
                label: `${id} - ${getMissionDisplayName(id, name)}`
            }));

        const fallbackMission = [
            { value: "7000003", label: state.ui.lang === 'zh' ? "7000003 - 在6个地块处种下种子" : "7000003 - Plant seeds on 6 plot(s)" }
        ];

        populateSelect(
            els.xpLandIndex,
            withPersistedOption(landOptions, state.xp.landIndex, value => `${t('plotLabel')} ${value}`),
            state.xp.landIndex
        );
        populateSelect(
            els.xpCropId,
            withPersistedOption(cropOptions.length ? cropOptions : fallbackCropOptions, state.xp.cropId, value => `${value} - ${t('savedCrop')}`),
            state.xp.cropId
        );
        populateSelect(
            els.afCropId,
            withPersistedOption(cropOptions.length ? cropOptions : fallbackCropOptions, state.autoFarm.cropId, value => `${value} - ${t('savedCrop')}`),
            state.autoFarm.cropId
        );
        populateSelect(
            els.buyCropId,
            withPersistedOption(buyCropOptions.length ? buyCropOptions : fallbackCropOptions, state.autoBuy.cropId, value => `${value} - ${t('savedCrop')}`),
            state.autoBuy.cropId
        );
        populateSelect(
            els.xpMissionId,
            withPersistedOption(mainMissionEntries.length ? mainMissionEntries : fallbackMission, state.xp.missionId, value => `${value} - ${t('savedQuest')}`),
            state.xp.missionId
        );

        const validAutoFarmLandSet = new Set(rawLandOptions);
        state.autoFarm.selectedLands = (state.autoFarm.selectedLands || [])
            .map(v => String(v))
            .filter(v => validAutoFarmLandSet.has(v));
        if (!state.autoFarm.selectedLands.length) {
            state.autoFarm.selectedLands = getDefaultAutoFarmLandSelection(rawLandOptions);
        }
        syncAutoFarmFlowerGoals();
        renderAutoFarmLandChecks(rawLandOptions);

        state.xp.landIndex = String(els.xpLandIndex.value || state.xp.landIndex);
        state.xp.cropId = String(els.xpCropId.value || state.xp.cropId);
        state.autoFarm.cropId = String(els.afCropId.value || state.autoFarm.cropId);
        state.autoBuy.cropId = String(els.buyCropId.value || state.autoBuy.cropId);
        state.xp.missionId = String(els.xpMissionId.value || state.xp.missionId);
    };

    const getCropSeedInfo = (cropId) => getKnownSeedEntries({ includeLockedShop: true })
        .find(seed => String(seed.commodityId) === String(cropId)) || null;

    const getCropYieldCount = (cropId) => {
        const crop = getCropSeedInfo(cropId);
        const learnedYield = Number(state.autoFarm.cropFlowerMap?.[String(cropId)]?.yieldCount ?? 0);
        const raw = Number(crop?.yieldCount ?? crop?.itemNum ?? learnedYield ?? 0);
        return raw > 0 ? raw : 1;
    };

    const getFlowerNameFromSeedName = (seedName, fallback = '') => {
        const normalized = String(seedName || '').trim();
        if (!normalized) return String(fallback || '').trim();
        if (normalized.endsWith('种子')) {
            return normalized.slice(0, -2) || normalized;
        }
        if (/\s+seed$/i.test(normalized)) {
            return normalized.replace(/\s+seed$/i, '').trim();
        }
        return normalized;
    };

    const inferFlowerIdFromCropId = (cropId) => {
        const key = String(cropId || '').trim();
        if (!/^2\d+$/.test(key)) return '';
        return `3${key.slice(1)}`;
    };

    const getGardenDerivedFlowerInfoForCrop = (cropId, garden = state.status.gardenInfo || []) => {
        const cropKey = String(cropId);
        const land = (garden || []).find(item =>
            String(item?.cropId ?? '') === cropKey
            && String(item?.cropDetail?.iHarvestItemId ?? '').trim()
        );
        if (!land) return null;

        const flowerId = String(land?.cropDetail?.iHarvestItemId ?? '').trim();
        if (!flowerId) return null;

        const existingBagFlower = (state.status.bagFlowers || []).find(item => String(item.iItemId) === flowerId);
        return {
            flowerId,
            flowerName: String(
                existingBagFlower?.sItemName
                || getFlowerNameFromSeedName(land?.cropDetail?.sName, `${t('flowerLabel')} ${flowerId}`)
            ).trim(),
            yieldCount: getCropYieldCount(cropKey),
        };
    };

    const sortAutoFarmGoals = (goals = []) => [...goals].sort((a, b) => {
        const orderA = Number(a?.order ?? 0);
        const orderB = Number(b?.order ?? 0);
        if (orderA !== orderB) return orderA - orderB;
        return String(a?.cropId ?? '').localeCompare(String(b?.cropId ?? ''), 'en-US');
    });

    const syncAutoFarmFlowerGoals = () => {
        const statusSeedEntries = getKnownSeedEntries({ includeLockedShop: true });
        const cropList = (statusSeedEntries.length ? statusSeedEntries : getKnownSeedEntries({ requireUsable: true }))
            .map(seed => String(seed.commodityId));
        const cropSet = new Set(cropList);
        const hasStatusSeedList = cropList.length > 0;
        const normalizeGoalCropId = (rawCropId) => {
            const cropId = String(rawCropId || '').trim();
            if (!cropId) return '';
            if (cropSet.has(cropId)) return cropId;
            const inferredSeedId = /^3\d+$/.test(cropId) ? `2${cropId.slice(1)}` : '';
            if (inferredSeedId && (!hasStatusSeedList || cropSet.has(inferredSeedId))) return inferredSeedId;
            return hasStatusSeedList ? '' : cropId;
        };
        const goalsByCropId = new Map();
        const nextGoals = [];

        for (const goal of sortAutoFarmGoals(state.autoFarm.flowerGoals || [])) {
            const cropId = normalizeGoalCropId(goal?.cropId);
            if (!cropId) continue;
            const normalized = {
                cropId,
                targetCount: clampInt(goal?.targetCount, 0, 0, 999999),
                order: clampInt(goal?.order, 0, 0, 999),
            };
            const existing = goalsByCropId.get(normalized.cropId);
            if (existing) {
                existing.targetCount = Math.max(existing.targetCount, normalized.targetCount);
                if (normalized.order > 0 && (existing.order <= 0 || normalized.order < existing.order)) {
                    existing.order = normalized.order;
                }
                continue;
            }
            goalsByCropId.set(normalized.cropId, normalized);
            nextGoals.push(normalized);
        }

        let nextOrder = 1;
        for (const goal of nextGoals) {
            if (goal.order <= 0) {
                goal.order = nextOrder;
            }
            nextOrder = Math.max(nextOrder, Number(goal.order || 0) + 1);
        }

        for (const cropId of cropList) {
            if (goalsByCropId.has(cropId)) continue;
            const normalized = {
                cropId,
                targetCount: 0,
                order: nextOrder,
            };
            nextOrder = Math.max(nextOrder, normalized.order + 1);
            goalsByCropId.set(cropId, normalized);
            nextGoals.push(normalized);
        }

        state.autoFarm.flowerGoals = sortAutoFarmGoals(nextGoals);
    };

    const getAutoFarmGoalForCrop = (cropId) => sortAutoFarmGoals(state.autoFarm.flowerGoals || [])
        .find(goal => String(goal.cropId) === String(cropId));

    const getAutoFarmFlowerInfoForCrop = (cropId) => {
        const key = String(cropId);
        const learned = state.autoFarm.cropFlowerMap?.[key];
        if (learned?.flowerId) {
            return learned;
        }

        const sameIdFlower = (state.status.bagFlowers || []).find(item => String(item.iItemId) === key);
        if (sameIdFlower) {
            return {
                flowerId: key,
                flowerName: sameIdFlower.sItemName || getCropRawName(key),
                yieldCount: getCropYieldCount(key),
            };
        }

        const gardenDerived = getGardenDerivedFlowerInfoForCrop(key);
        if (gardenDerived?.flowerId) {
            return gardenDerived;
        }

        const seedName = getCropRawName(key);
        const derivedFlowerName = getFlowerNameFromSeedName(seedName);
        if (derivedFlowerName) {
            const matchedFlower = (state.status.bagFlowers || []).find(item =>
                String(item.sItemName || '').trim() === derivedFlowerName
            );
            if (matchedFlower) {
                const info = {
                    flowerId: String(matchedFlower.iItemId),
                    flowerName: derivedFlowerName,
                    yieldCount: getCropYieldCount(key),
                };
                state.autoFarm.cropFlowerMap[key] = info;
                saveSettingsToStorage();
                return info;
            }

            const inferredFlowerId = inferFlowerIdFromCropId(key);
            if (inferredFlowerId) {
                return {
                    flowerId: inferredFlowerId,
                    flowerName: String(
                        getLocalizedNameEntry(derivedFlowerName, inferredFlowerId)?.zh
                        || derivedFlowerName
                    ).trim(),
                    yieldCount: getCropYieldCount(key),
                };
            }
        }

        return null;
    };

    const syncAutoFarmFlowerMappingsFromGarden = (garden = state.status.gardenInfo || []) => {
        let changed = false;

        for (const land of (garden || [])) {
            const cropId = String(land?.cropId ?? '').trim();
            if (!cropId || cropId === '0') continue;

            const gardenDerived = getGardenDerivedFlowerInfoForCrop(cropId, garden);
            if (!gardenDerived?.flowerId) continue;

            const previous = state.autoFarm.cropFlowerMap?.[cropId];
            if (
                previous?.flowerId === gardenDerived.flowerId
                && previous?.flowerName === gardenDerived.flowerName
                && Number(previous?.yieldCount ?? 0) === Number(gardenDerived.yieldCount ?? 0)
            ) {
                continue;
            }

            state.autoFarm.cropFlowerMap[cropId] = {
                flowerId: gardenDerived.flowerId,
                flowerName: gardenDerived.flowerName,
                yieldCount: gardenDerived.yieldCount,
            };
            changed = true;
        }

        if (changed) {
            saveSettingsToStorage();
        }
    };

    const learnAutoFarmFlowerMapping = (cropId, assetsNotify = []) => {
        const list = Array.isArray(assetsNotify) ? assetsNotify : [];
        const flowerAsset = list.find(item => {
            const itemId = String(item?.iItemId ?? item?.itemId ?? '');
            const delta = Number(item?.itemIncr ?? item?.iItemIncr ?? item?.delta ?? 0);
            return delta > 0 && !itemId.startsWith('100') && !itemId.startsWith('900');
        });

        if (!flowerAsset) return null;

        const flowerId = String(flowerAsset?.iItemId ?? flowerAsset?.itemId ?? '').trim();
        if (!flowerId) return null;

        const existingBagFlower = (state.status.bagFlowers || []).find(item => String(item.iItemId) === flowerId);
        const flowerName = String(
            flowerAsset?.sItemName
            || flowerAsset?.itemName
            || existingBagFlower?.sItemName
            || getCropRawName(cropId)
        ).trim();
        const yieldCount = Math.max(1, Number(flowerAsset?.itemIncr ?? flowerAsset?.iItemIncr ?? getCropYieldCount(cropId) ?? 1));

        state.autoFarm.cropFlowerMap[String(cropId)] = {
            flowerId,
            flowerName,
            yieldCount,
        };
        saveSettingsToStorage();

        return state.autoFarm.cropFlowerMap[String(cropId)];
    };

    const getAutoFarmCurrentFlowerCountForCrop = (cropId) => {
        const flowerInfo = getAutoFarmFlowerInfoForCrop(cropId);
        if (!flowerInfo?.flowerId) return 0;
        return getOwnedFlowerCount(flowerInfo.flowerId);
    };

    const getAutoFarmProjectedFlowerCountForCrop = (cropId, garden = state.status.gardenInfo || []) => {
        const cropKey = String(cropId);
        const currentCount = getAutoFarmCurrentFlowerCountForCrop(cropKey);
        const projectedInGarden = (garden || []).reduce((sum, land) => {
            return String(land?.cropId ?? '') === cropKey ? sum + getCropYieldCount(cropKey) : sum;
        }, 0);
        return currentCount + projectedInGarden;
    };

    const getNextAutoFarmGoal = (garden = state.status.gardenInfo || []) => {
        if (!state.autoFarm.goalModeEnabled) return null;

        const goals = sortAutoFarmGoals(state.autoFarm.flowerGoals || [])
            .filter(goal => Number(goal.targetCount || 0) > 0);

        for (const goal of goals) {
            const projected = getAutoFarmProjectedFlowerCountForCrop(goal.cropId, garden);
            if (projected < Number(goal.targetCount || 0)) {
                return goal;
            }
        }

        return null;
    };

    const getAutoFarmPlantCropId = (garden = state.status.gardenInfo || []) => {
        const nextGoal = getNextAutoFarmGoal(garden);
        const previousGoalCropId = String(state.autoFarm.currentGoalCropId || '');
        if (nextGoal?.cropId) {
            state.autoFarm.currentGoalCropId = String(nextGoal.cropId);
            if (previousGoalCropId !== state.autoFarm.currentGoalCropId) {
                saveSettingsToStorage();
            }
            return String(nextGoal.cropId);
        }

        state.autoFarm.currentGoalCropId = '';
        if (previousGoalCropId) {
            saveSettingsToStorage();
        }
        return state.autoFarm.goalModeEnabled ? '' : String(state.autoFarm.cropId || DEFAULT_AF_CROP);
    };

    const getGrowingCountForCrop = (cropId) => {
        const key = String(cropId);
        return (state.status.gardenInfo || []).filter(land => String(land?.cropId ?? '') === key).length;
    };

    const renderAutoFarmGoalTable = () => {
        if (!els.afGoalTableWrap) return;

        syncAutoFarmFlowerGoals();
        const goals = sortAutoFarmGoals(state.autoFarm.flowerGoals || []);
        if (!goals.length) {
            els.afGoalTableWrap.innerHTML = `<div style="padding:8px;color:#ccc;">${t('noGoalCrops')}</div>`;
            uiRuntime.autoFarmGoalTableDirty = false;
            return;
        }

        const rows = goals.map(goal => {
            const cropId = String(goal.cropId);
            const flowerInfo = getAutoFarmFlowerInfoForCrop(cropId);
            const currentCount = getAutoFarmCurrentFlowerCountForCrop(cropId);
            const targetCount = Number(goal.targetCount || 0);
            const flowerLabel = flowerInfo?.flowerName
                ? getFlowerDisplayName(flowerInfo.flowerId, flowerInfo.flowerName)
                : t('pendingLearn');
            const currentText = flowerInfo?.flowerId ? String(currentCount) : '--';
            const growingCount = getGrowingCountForCrop(cropId);
            const seedCount = getOwnedSeedCount(cropId);
            const seedLabel = `${getCropDisplayName(cropId)} (${seedCount})`;

            return `
                <tr data-crop-id="${escapeHtml(cropId)}">
                    <td draggable="true" data-drag-handle="true" style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;cursor:grab;">&#9776;</td>
                    <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${escapeHtml(flowerLabel)}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${escapeHtml(seedLabel)}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${escapeHtml(currentText)}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${growingCount > 0 ? escapeHtml(growingCount) : '0'}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);width:92px;">
                        <input data-goal-field="targetCount" data-crop-id="${escapeHtml(cropId)}" type="number" min="0" step="1" value="${escapeHtml(targetCount)}" style="${inputStyle('#111', 'margin-top:0;padding:4px 6px;')}">
                    </td>
                </tr>
            `;
        }).join('');

        els.afGoalTableWrap.innerHTML = `
            <table id="af-goal-table" style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead>
                    <tr style="background:rgba(255,255,255,0.06);text-align:left;">
                        <th style="padding:6px 8px;white-space:nowrap;width:28px;"></th>
                        <th style="padding:6px 8px;white-space:nowrap;">${t('thFlower')}</th>
                        <th style="padding:6px 8px;white-space:nowrap;">${t('thSeed')}</th>
                        <th style="padding:6px 6px;white-space:nowrap;">${t('thOwnedFlowers')}</th>
                        <th style="padding:6px 6px;white-space:nowrap;">${t('thGrowing')}</th>
                        <th style="padding:6px 18px;white-space:nowrap;">${t('thGoal')}</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

        const tbody = els.afGoalTableWrap.querySelector('#af-goal-table tbody');
        if (tbody) {
            let dragSrcRow = null;
            tbody.addEventListener('dragstart', (e) => {
                const handle = e.target.closest('[data-drag-handle="true"]');
                if (!handle) {
                    e.preventDefault();
                    return;
                }
                const row = handle.closest('tr[data-crop-id]');
                if (!row) return;
                dragSrcRow = row;
                uiRuntime.autoFarmGoalDragging = true;
                row.style.opacity = '0.4';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', row.dataset.cropId);
            });
            tbody.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const row = e.target.closest('tr[data-crop-id]');
                if (!row || row === dragSrcRow) return;
                const rows = [...tbody.querySelectorAll('tr[data-crop-id]')];
                const dragIdx = rows.indexOf(dragSrcRow);
                const hoverIdx = rows.indexOf(row);
                if (dragIdx < 0 || hoverIdx < 0) return;
                if (dragIdx < hoverIdx) {
                    row.after(dragSrcRow);
                } else {
                    row.before(dragSrcRow);
                }
            });
            tbody.addEventListener('dragend', (e) => {
                uiRuntime.autoFarmGoalDragging = false;
                if (dragSrcRow) dragSrcRow.style.opacity = '1';
                dragSrcRow = null;
                const newOrder = [...tbody.querySelectorAll('tr[data-crop-id]')].map(r => r.dataset.cropId);
                syncAutoFarmFlowerGoals();
                for (let i = 0; i < newOrder.length; i++) {
                    const goal = state.autoFarm.flowerGoals.find(g => String(g.cropId) === newOrder[i]);
                    if (goal) goal.order = i + 1;
                }
                state.autoFarm.flowerGoals = sortAutoFarmGoals(state.autoFarm.flowerGoals);
                saveSettingsToStorage();
                updateUI();
            });
        }
        uiRuntime.autoFarmGoalTableDirty = false;
    };

    const isApiSettingsLocked = () => (
        state.status.loading || state.xp.isRunning || state.autoFarm.isRunning || state.autoBuy.isRunning
    );

    const updateSettingsUI = () => {
        const configuredRegion = normalizeApiRegion(state.ui.apiRegion, DEFAULT_API_REGION);
        const detectedRegion = detectApiRegion();
        const autoRegion = detectedRegion || FALLBACK_API_REGION;
        const autoRegionLabel = `${getApiRegionLabel(autoRegion)}${detectedRegion ? '' : ` (${t('apiFallback')})`}`;
        const autoUrl = getApiBaseUrlForRegion(autoRegion) || '--';
        const currentUrl = configuredRegion === CUSTOM_API_REGION
            ? (normalizeApiBaseUrl(state.ui.apiCustomBaseUrl) || t('apiInvalidCustomUrl'))
            : getApiBaseUrlForRegion(getActiveApiRegion()) || '--';
        const locked = isApiSettingsLocked();

        if (els.apiAutoRegion) els.apiAutoRegion.textContent = autoRegionLabel;
        if (els.apiAutoUrl) els.apiAutoUrl.textContent = autoUrl;
        if (els.apiCurrentRegion) els.apiCurrentRegion.textContent = getApiRegionDisplay();
        if (els.apiCurrentUrl) els.apiCurrentUrl.textContent = currentUrl;

        if (els.apiRegionOptionWrap) {
            els.apiRegionOptionWrap.querySelectorAll('[data-api-region]').forEach(button => {
                const active = String(button.dataset.apiRegion || '') === configuredRegion;
                button.disabled = locked;
                button.style.background = active ? '#1677ff' : '#434343';
            });
        }
        if (els.apiCustomUrl && document.activeElement !== els.apiCustomUrl) {
            els.apiCustomUrl.value = String(state.ui.apiCustomBaseUrl || '');
        }
        if (els.apiCustomUrl) els.apiCustomUrl.disabled = locked;
        if (els.apiCustomApplyBtn) els.apiCustomApplyBtn.disabled = locked;
        if (els.resetDefaultsBtn) els.resetDefaultsBtn.disabled = locked;
        applyPanelOpacityUI();
    };

    const syncFormControlsFromState = () => {
        updateSettingsUI();
        if (els.xpCountdownDays) els.xpCountdownDays.value = String(state.xp.countdownDays);
        if (els.xpCountdownHours) els.xpCountdownHours.value = String(state.xp.countdownHours);
        if (els.xpCountdownMinutes) els.xpCountdownMinutes.value = String(state.xp.countdownMinutes);
        if (els.xpStopHour) els.xpStopHour.value = String(state.xp.stopHour);
        if (els.xpStopMinute) els.xpStopMinute.value = String(state.xp.stopMinute);
        if (els.buyPerCount) els.buyPerCount.value = String(state.autoBuy.perBuyCount);
        if (els.buyRepeatTimes) els.buyRepeatTimes.value = String(state.autoBuy.repeatTimes);
        if (els.afIntervalMin) els.afIntervalMin.value = String(state.autoFarm.intervalMin);
        if (els.afDelayMin) els.afDelayMin.value = String(state.autoFarm.randomDelayMinMs);
        if (els.afDelayMax) els.afDelayMax.value = String(state.autoFarm.randomDelayMaxMs);
        applyTogglePositionUI();
        applyPanelOpacityUI();
        buildSelectors();
        setActiveTab(state.ui.activeTab);
        updateUI();
    };

    const restoreDefaultSettings = () => {
        if (state.xp.isRunning || state.autoFarm.isRunning || state.autoBuy.isRunning) {
            addLog(t('stopTasksFirst'), 'WARN');
            return;
        }

        resetStateSettingsToDefault();
        state.autoFarm.selectedLands = getDefaultAutoFarmLandSelection(state.status.landOptions);
        syncFormControlsFromState();
        saveSettingsToStorage();
        addLog(t('defaultsRestored'));
    };

    const xpStepsForRound = (round) => (Number(round) === 1 ? state.xp.firstRoundSteps : FIXED_STEPS_PER_ROUND);
    const xpOperationsForRound = (round) => xpStepsForRound(round) * 2 + 1;
    const getXpCountdownTotalMs = () => {
        const days = Math.max(0, Number(state.xp.countdownDays || 0));
        const hours = Math.max(0, Number(state.xp.countdownHours || 0));
        const minutes = Math.max(0, Number(state.xp.countdownMinutes || 0));
        return (((days * 24) + hours) * 60 + minutes) * 60 * 1000;
    };
    const resolveXpStopAtTs = () => {
        const hour = Math.min(23, Math.max(0, Number(state.xp.stopHour || 0)));
        const minute = Math.min(59, Math.max(0, Number(state.xp.stopMinute || 0)));
        const now = new Date();
        const target = new Date(now);
        target.setHours(hour, minute, 0, 0);
        if (target.getTime() <= now.getTime()) {
            target.setDate(target.getDate() + 1);
        }
        return target.getTime();
    };
    const getXpTimingInfo = () => {
        const startTime = Number(state.xp.stats.startTime || 0);
        const stopTime = Number(state.xp.stats.stopTime || 0);
        const now = Date.now();
        const refTime = state.xp.isRunning ? now : (stopTime || startTime || now);
        const elapsedMs = startTime ? Math.max(0, refTime - startTime) : 0;
        const mode = String(state.xp.timerMode || 'countdown');
        const countdownTotalMs = getXpCountdownTotalMs();
        const countdownEnabled = mode === 'countdown' && countdownTotalMs > 0;
        const countdownRemainingMs = countdownEnabled ? Math.max(0, countdownTotalMs - elapsedMs) : Number.POSITIVE_INFINITY;

        const countupEnabled = mode === 'countup' && Number(state.xp.stopAtTs) > 0;
        const countupRemainingMs = countupEnabled
            ? Math.max(0, Number(state.xp.stopAtTs) - refTime)
            : Number.POSITIVE_INFINITY;

        const remainingCandidates = [];
        if (countdownEnabled) remainingCandidates.push(countdownRemainingMs);
        if (countupEnabled) remainingCandidates.push(countupRemainingMs);
        const hasFiniteRemaining = remainingCandidates.length > 0;
        const remainingMs = hasFiniteRemaining ? Math.min(...remainingCandidates) : 0;

        const countupTotalMs = countupEnabled && startTime > 0
            ? Math.max(1, Number(state.xp.stopAtTs) - startTime)
            : 0;
        const progressBaseMs = countdownEnabled ? countdownTotalMs : countupTotalMs;
        const progressPercent = progressBaseMs > 0 ? Math.min(100, (elapsedMs / progressBaseMs) * 100) : 0;
        const timerReached = (countdownEnabled && countdownRemainingMs <= 0) || (countupEnabled && countupRemainingMs <= 0);

        return {
            mode,
            elapsedMs,
            countdownEnabled,
            countdownRemainingMs,
            countupEnabled,
            countupRemainingMs,
            remainingMs,
            hasFiniteRemaining,
            progressPercent,
            timerReached,
        };
    };
    const getXpTimerStopReason = () => {
        const timing = getXpTimingInfo();
        if (!timing.timerReached) return '';
        if (timing.countdownEnabled && timing.countdownRemainingMs <= 0) return 'countdown';
        if (timing.countupEnabled && timing.countupRemainingMs <= 0) return 'countup';
        return 'timer';
    };
    const resetXpStats = () => {
        Object.assign(state.xp.stats, {
            startTime: Date.now(),
            stopTime: 0,
            finishedOperations: 0,
            currentRoundFinishedOperations: 0,
            totalReq: 0,
            successReq: 0,
            failReq: 0,
            plantOk: 0,
            eliminateOk: 0,
            missionOk: 0,
            autoBuyTriggered: 0,
            currentRound: 0,
            currentStep: 0,
            currentRoundStepTarget: state.xp.firstRoundSteps,
        });
        els.xpWaiting.textContent = '0ms';
    };

    const updateXpUI = () => {
        const stats = state.xp.stats;
        const currentRoundForDisplay = stats.currentRound > 0 ? stats.currentRound : 1;
        const roundOps = xpOperationsForRound(currentRoundForDisplay);
        const roundStepTarget = stats.currentRoundStepTarget || xpStepsForRound(currentRoundForDisplay);
        const roundPercent = roundOps === 0 ? 0 : Math.min(100, (stats.currentRoundFinishedOperations / roundOps) * 100);
        const timing = getXpTimingInfo();

        if (timing.mode === 'always') {
            els.xpProgressBar.style.width = state.xp.isRunning ? '100%' : '0%';
            els.xpProgressText.textContent = `${t('alwaysRunLabel')} (${t('elapsed')} ${fmtMs(timing.elapsedMs)})`;
            els.xpEta.textContent = '--';
        } else {
            els.xpProgressBar.style.width = `${timing.progressPercent.toFixed(2)}%`;
            const parts = [];
            if (timing.countdownEnabled) {
                parts.push(`${t('countdownLeft')} ${fmtMs(timing.countdownRemainingMs)}`);
            }
            if (timing.countupEnabled) {
                const hh = String(state.xp.stopHour).padStart(2, '0');
                const mm = String(state.xp.stopMinute).padStart(2, '0');
                parts.push(`${hh}:${mm} ${t('clockStopLeft')} ${fmtMs(timing.countupRemainingMs)}`);
            }
            if (!parts.length) {
                parts.push(`${t('elapsed')} ${fmtMs(timing.elapsedMs)}`);
            }
            els.xpProgressText.textContent = parts.join(' | ');
            els.xpEta.textContent = state.xp.isRunning && timing.hasFiniteRemaining ? fmtMs(timing.remainingMs) : '--';
        }

        els.xpBatchProgressBar.style.width = `${roundPercent.toFixed(2)}%`;
        els.xpBatchProgressText.textContent = `${stats.currentRoundFinishedOperations} / ${roundOps} (${roundPercent.toFixed(2)}%)`;
        els.xpStepSummary.textContent = `${stats.currentRound}${t('round')} [${stats.currentStep}/${roundStepTarget}]`;
        els.xpReqSummary.textContent = `${stats.totalReq} [${stats.failReq}${t('fail')}/${stats.successReq}${t('success')}]`;
        els.xpPlantOk.textContent = String(stats.plantOk);
        els.xpEliminateOk.textContent = String(stats.eliminateOk);
        els.xpMissionOk.textContent = String(stats.missionOk);
        els.xpAutoBuyTriggered.textContent = String(stats.autoBuyTriggered);
        els.xpElapsed.textContent = fmtMs(timing.elapsedMs);
    };

    const updateAutoBuyUI = () => {
        const s = state.autoBuy.stats;
        els.buyTotalReq.textContent = String(s.totalReq);
        els.buySuccessReq.textContent = String(s.successReq);
        els.buyFailReq.textContent = String(s.failReq);
        els.buySuccessActions.textContent = String(s.successActions);
        els.buyBoughtCount.textContent = String(s.boughtSeedCount);
        els.buyLastAction.textContent = s.lastAction || '--';
    };

    const getAutoFarmGoalProgressInfo = () => {
        const goals = sortAutoFarmGoals(state.autoFarm.flowerGoals || [])
            .filter(goal => Number(goal.targetCount || 0) > 0);
        const totalTarget = goals.reduce((sum, goal) => sum + Number(goal.targetCount || 0), 0);
        const current = goals.reduce((sum, goal) => {
            const target = Number(goal.targetCount || 0);
            const projected = getAutoFarmProjectedFlowerCountForCrop(goal.cropId, state.status.gardenInfo || []);
            return sum + Math.min(target, Math.max(0, projected));
        }, 0);

        return {
            totalTarget,
            current,
            percent: totalTarget > 0 ? Math.min(100, Math.max(0, (current / totalTarget) * 100)) : 0,
        };
    };

    const estimateAutoFarmGoalEtaMs = () => {
        const goals = sortAutoFarmGoals(state.autoFarm.flowerGoals || [])
            .filter(goal => Number(goal.targetCount || 0) > 0);
        if (!goals.length) return 0;

        const selectedLandCount = Math.max(
            1,
            (state.autoFarm.selectedLands || []).length || normalizeLandList(state.status.landOptions).length
        );
        const checkMs = Math.max(0, Number(state.autoFarm.intervalMin || 0)) * 60 * 1000;
        let totalMs = 0;

        for (const goal of goals) {
            const target = Number(goal.targetCount || 0);
            const projected = getAutoFarmProjectedFlowerCountForCrop(goal.cropId, state.status.gardenInfo || []);
            const remainingFlowers = Math.max(0, target - projected);
            if (remainingFlowers <= 0) continue;

            const yieldCount = Math.max(1, getCropYieldCount(goal.cropId));
            const seedInfo = getCropSeedInfo(goal.cropId);
            const growMs = Number(seedInfo?.growDuration || 0) * 1000;
            if (!Number.isFinite(growMs) || growMs <= 0) return null;

            const plantsNeeded = Math.ceil(remainingFlowers / yieldCount);
            const batchesNeeded = Math.ceil(plantsNeeded / selectedLandCount);
            totalMs += batchesNeeded * Math.max(growMs, checkMs);
        }

        return totalMs;
    };

    const updateAutoFarmModeUI = () => {
        const multiMode = state.autoFarm.goalModeEnabled === true;
        if (els.afModeSingleBtn) {
            els.afModeSingleBtn.style.background = multiMode ? '#434343' : '#1677ff';
            els.afModeSingleBtn.style.opacity = '1';
        }
        if (els.afModeMultiBtn) {
            els.afModeMultiBtn.style.background = multiMode ? '#1677ff' : '#434343';
            els.afModeMultiBtn.style.opacity = '1';
        }
        if (els.afSingleSeedPanel) {
            els.afSingleSeedPanel.style.display = multiMode ? 'none' : 'block';
        }
        if (els.afMultiSeedPanel) {
            els.afMultiSeedPanel.style.display = multiMode ? 'block' : 'none';
        }
    };

    const updateAutoFarmGoalProgressUI = () => {
        const progress = getAutoFarmGoalProgressInfo();
        if (els.afGoalProgressText) {
            els.afGoalProgressText.textContent = `${progress.current} / ${progress.totalTarget}`;
        }
        if (els.afGoalProgressBar) {
            els.afGoalProgressBar.style.width = `${progress.percent}%`;
        }
        if (els.afGoalEta) {
            const etaMs = estimateAutoFarmGoalEtaMs();
            els.afGoalEta.textContent = progress.totalTarget <= 0
                ? '--'
                : (etaMs === null ? t('etaUnavailable') : (etaMs > 0 ? fmtMsWithDays(etaMs) : t('completed')));
        }
    };

    const updateAutoFarmUI = () => {
        const af = state.autoFarm;
        const stats = af.stats;
        const nextMs = af.schedulerEnabled && af.nextRunAt ? Math.max(0, af.nextRunAt - Date.now()) : 0;
        const nextGoal = getNextAutoFarmGoal(state.status.gardenInfo || []);
        const currentGoal = getAutoFarmGoalForCrop(af.currentGoalCropId) || nextGoal;

        els.afSchedulerStatus.textContent = af.schedulerEnabled
            ? (af.isRunning ? t('schedRunning') : t('schedOn'))
            : (af.isRunning ? t('schedCurrent') : t('schedOff'));

        els.afNextRun.textContent = af.schedulerEnabled
            ? (af.isRunning ? t('schedExecuting') : fmtCountdown(nextMs))
            : '--';

        els.afCycleCount.textContent = String(stats.cycleCount);
        els.afReqSummary.textContent = `${stats.totalReq} [${stats.failReq}${t('fail')}/${stats.successReq}${t('success')}]`;
        els.afPlantOk.textContent = String(stats.plantOk);
        els.afHarvestOk.textContent = String(stats.harvestOk);
        els.afWaterOk.textContent = String(stats.waterOk);
        els.afSkipped.textContent = String(stats.skipped);
        updateAutoFarmModeUI();
        updateAutoFarmGoalProgressUI();
        if (els.afSingleSeedCount) {
            els.afSingleSeedCount.textContent = `${t('thSeedCount')}: ${getOwnedSeedCount(af.cropId)}`;
        }
        if (els.afCurrentGoal) {
            if (!af.goalModeEnabled) {
                els.afCurrentGoal.textContent = t('goalDisabled');
            } else if (currentGoal?.cropId) {
                const targetCount = Number(currentGoal.targetCount || 0);
                const projectedCount = getAutoFarmProjectedFlowerCountForCrop(currentGoal.cropId, state.status.gardenInfo || []);
                const progressCount = targetCount > 0
                    ? Math.min(targetCount, Math.max(0, projectedCount))
                    : Math.max(0, projectedCount);
                const flowerInfo = getAutoFarmFlowerInfoForCrop(currentGoal.cropId);
                els.afCurrentGoal.textContent = `${t('goalCurrent')}${getCropDisplayName(currentGoal.cropId)} (${getOwnedSeedCount(currentGoal.cropId)}) / ${flowerInfo?.flowerName ? getFlowerDisplayName(flowerInfo.flowerId, flowerInfo.flowerName) : t('pendingLearn')} ${progressCount}/${targetCount}`;
            } else {
                els.afCurrentGoal.textContent = t('goalAllDone');
            }
        }
        const isEditingGoalTable = !!(els.afGoalTableWrap && document.activeElement && els.afGoalTableWrap.contains(document.activeElement));
        const hasGoalSelection = !!(els.afGoalTableWrap && hasTextSelectionInside(els.afGoalTableWrap));
        if (uiRuntime.autoFarmGoalTableDirty && !isEditingGoalTable && !hasGoalSelection && !uiRuntime.autoFarmGoalDragging) {
            renderAutoFarmGoalTable();
        }
    };

    const getSelectionHostElement = (node) => {
        if (!node) return null;
        return node.nodeType === 1 ? node : node.parentElement || null;
    };

    const hasTextSelectionInside = (container) => {
        if (!container || typeof window.getSelection !== 'function') return false;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;

        const anchorEl = getSelectionHostElement(selection.anchorNode);
        const focusEl = getSelectionHostElement(selection.focusNode);
        return Boolean(
            (anchorEl && container.contains(anchorEl))
            || (focusEl && container.contains(focusEl))
        );
    };

    const setContainerHtml = (container, html) => {
        if (!container) return;
        if (container.innerHTML === html) return;
        if (hasTextSelectionInside(container)) return;
        container.innerHTML = html;
    };

    const renderLandTable = () => {
        const lands = [...(state.status.gardenInfo || [])].sort((a, b) => Number(a?.landIndex ?? 0) - Number(b?.landIndex ?? 0));

        if (!lands.length) {
            setContainerHtml(els.statusLandTableWrap, `<div style="padding:8px;color:#ccc;">${t('noLandData')}</div>`);
            return;
        }

        const rows = lands.map(land => {
            const landIndex = String(land?.landIndex ?? '--');
            const cropId = Number(land?.cropId ?? 0);
            const cropName = cropId === 0
                ? t('empty')
                : localizeKnownName(land?.cropDetail?.sName || state.status.cropMap[String(cropId)] || String(cropId), cropId);

            let stateText = t('empty');
            let timeText = '--';

            if (cropId !== 0) {
                const fields = calcLandFields(land);
                if (fields.isMature) {
                    stateText = t('harvestable');
                    timeText = t('mature');
                } else if (fields.needsWater) {
                    stateText = t('needsWater');
                    timeText = `${t('grownFor')} ${fmtMs(Math.max(0, fields.elapsed) * 1000)}`;
                } else {
                    const remainSec = Math.max(0, fields.matureAt - nowSec());
                    const remainText = fmtMs(remainSec * 1000);
                    stateText = t('growingState');
                    timeText = state.ui.lang === 'en'
                        ? `${remainText} left`
                        : `${t('remainLeft')} ${remainText}`;
                }
            }

            return `
                <tr>
                    <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${escapeHtml(landIndex)}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${escapeHtml(cropName)}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${escapeHtml(stateText)}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${escapeHtml(timeText)}</td>
                </tr>
            `;
        }).join('');

        const html = `
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead>
                    <tr style="background:rgba(255,255,255,0.06);text-align:left;">
                        <th style="padding:6px 8px;white-space:nowrap;">${t('thPlot')}</th>
                        <th style="padding:6px 8px;white-space:nowrap;">${t('thCrop')}</th>
                        <th style="padding:6px 8px;white-space:nowrap;">${t('thState')}</th>
                        <th style="padding:6px 8px;white-space:nowrap;">${t('thTime')}</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
        setContainerHtml(els.statusLandTableWrap, html);
    };

    const renderSeedTable = () => {
        const seeds = getKnownSeedEntries({ includeLockedShop: true });

        if (!seeds.length) {
            setContainerHtml(els.statusSeedTableWrap, `<div style="padding:8px;color:#ccc;">${t('noSeedData')}</div>`);
            return;
        }

        const rows = seeds.map(seed => {
            const seedId = String(seed.commodityId);
            const ownedAmount = seed.ownedAmount ?? 0;
            const seedName = localizeKnownName(seed.name || seedId, seedId);
            const shopStatus = !seed.source?.includes('shop')
                ? t('shopNotListed')
                : seed.unlocked
                    ? t('shopCanBuy')
                    : t('shopLocked');
            const expValue = seed.expValue ? String(seed.expValue) : '--';
            const growDuration = fmtSeedGrowDuration(seed.growDuration);
            const costName = localizeKnownName(seed.costName, seed.costName);
            const price = seed.source?.includes('shop')
                ? `${seed.cost}${costName ? ` ${costName}` : ''}`
                : '--';

            return `
                <tr>
                    <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${escapeHtml(seedName)}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${escapeHtml(seedId)}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${escapeHtml(ownedAmount)}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${escapeHtml(shopStatus)}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${escapeHtml(expValue)}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${escapeHtml(growDuration)}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${escapeHtml(price)}</td>
                </tr>
            `;
        }).join('');

        const html = `
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead>
                    <tr style="background:rgba(255,255,255,0.06);text-align:left;">
                        <th style="padding:6px 8px;white-space:nowrap;">${t('thSeed')}</th>
                        <th style="padding:6px 8px;white-space:nowrap;">${t('thId')}</th>
                        <th style="padding:6px 8px;white-space:nowrap;">${t('thOwned')}</th>
                        <th style="padding:6px 8px;white-space:nowrap;">${t('thShop')}</th>
                        <th style="padding:6px 8px;white-space:nowrap;">EXP</th>
                        <th style="padding:6px 8px;white-space:nowrap;">${t('thTime')}</th>
                        <th style="padding:6px 8px;white-space:nowrap;">${t('thPrice')}</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
        setContainerHtml(els.statusSeedTableWrap, html);
    };

    const renderFlowerTable = (targetEl = els.statusFlowerTableWrap) => {
        if (!targetEl) return;
        const flowers = [...(state.status.bagFlowers || [])].sort((a, b) => {
            const an = Number(a?.iItemId);
            const bn = Number(b?.iItemId);
            if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
            return String(a?.iItemId ?? '').localeCompare(String(b?.iItemId ?? ''), 'en-US');
        });

        if (!flowers.length) {
            setContainerHtml(targetEl, `<div style="padding:8px;color:#ccc;">${t('noFlowers')}</div>`);
            return;
        }

        const rows = flowers.map(item => `
            <tr>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${escapeHtml(getFlowerDisplayName(item.iItemId, item.sItemName || item.iItemId))}</td>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${escapeHtml(item.iItemId)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">${escapeHtml(item.iAmount)}</td>
            </tr>
        `).join('');

        const html = `
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead>
                    <tr style="background:rgba(255,255,255,0.06);text-align:left;">
                        <th style="padding:6px 8px;white-space:nowrap;">${t('thFlower')}</th>
                        <th style="padding:6px 8px;white-space:nowrap;">${t('thId')}</th>
                        <th style="padding:6px 8px;white-space:nowrap;">${t('thCount')}</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
        setContainerHtml(targetEl, html);
    };

    const renderMissionPanel = () => {
        if (!els.statusMissionPanelWrap) return;

        const overview = state.status.missionOverview;
        const categories = Array.isArray(overview?.categories) ? overview.categories : [];
        const hideCompleted = state.ui.hideCompletedMissions === true;

        if (!categories.length) {
            setContainerHtml(els.statusMissionPanelWrap, `<div style="padding:8px;color:#ccc;">${t('noMissionData')}</div>`);
            return;
        }

        const summaryParts = [
            `${overview.totalCount || 0}${t('totalQuestsLabel')}`,
            `${t('completedLabel')} ${overview.completedCount || 0}`,
            `${t('incomplete')} ${overview.unfinishedCount || 0}`,
        ];
        if (state.status.repeatMissionId) {
            summaryParts.push(`${t('repeatQuestLabel')} ${state.status.repeatMissionId} ${state.status.repeatMissionProgress || 0}/${state.status.repeatMissionTarget || '--'}`);
        }
        const summaryLine = summaryParts.join(state.ui.lang === 'zh' ? '，' : ', ');
        const getCategoryTitle = (category) => {
            if (category.key === 'main') return t('mainQuests');
            if (category.key === 'chapter') return t('chapterQuests');
            if (category.key === 'order') return t('orderQuests');
            return category.title;
        };
        const renderOrderCategory = (category) => {
            const allOrderMissions = category.orderMissions || [];
            const orderMissions = hideCompleted
                ? allOrderMissions.filter(m => !m.isCompleted)
                : allOrderMissions;
            if (!orderMissions.length) {
                if (hideCompleted && allOrderMissions.length) return '';
                return `<div style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div style="font-weight:700;">${escapeHtml(getCategoryTitle(category))}</div>
                    <div style="margin-top:6px;color:#ccc;">${t('noStartedOrders')}</div>
                </div>`;
            }

            const missionCards = orderMissions.map(m => {
                const mComplete = m.isCompleted;
                const mBadgeColor = mComplete ? '#52c41a' : '#faad14';
                const mLabel = mComplete ? t('completed') : `${m.completedSubTasks}/3`;
                const subTaskRows = m.subTasks.map(st => {
                    const stColor = st.isCompleted ? '#b7eb8f' : '#ddd';
                    return `<tr>
                        <td style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.04);color:${stColor};">${escapeHtml(localizeMissionText(st.name, st.id))}</td>
                        <td style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap;color:${stColor};">${escapeHtml(st.progressText)}</td>
                    </tr>`;
                }).join('');
                const missionTitle = localizeMissionText(m.name, m.id);

                return `<div style="margin-bottom:8px;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,0.03);">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
                        <span style="font-weight:700;">${escapeHtml(m.charName || missionTitle)}${m.charName ? ` - ${escapeHtml(missionTitle)}` : ''}</span>
                        <span style="padding:2px 8px;border-radius:999px;background:${mBadgeColor};color:#111;font-weight:700;font-size:11px;">${escapeHtml(mLabel)}</span>
                    </div>
                    <table style="width:100%;border-collapse:collapse;font-size:12px;">
                        <tbody>${subTaskRows}</tbody>
                    </table>
                </div>`;
            }).join('');

            const categoryStateLabel = category.totalCount === 0 ? t('noMissions') : (category.isComplete ? t('completed') : t('incomplete'));
            const badgeColor = category.totalCount === 0 ? '#8c8c8c' : (category.isComplete ? '#52c41a' : '#faad14');

            return `<div style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                    <div style="font-weight:700;">${escapeHtml(getCategoryTitle(category))}</div>
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span style="padding:2px 8px;border-radius:999px;background:${badgeColor};color:#111;font-weight:700;">${escapeHtml(categoryStateLabel)}</span>
                        <span style="color:#ddd;">${escapeHtml(`${t('doneLabel')} ${category.completedCount}/${category.totalCount}`)}</span>
                    </div>
                </div>
                ${missionCards}
            </div>`;
        };

        const categoryHtml = categories.map(category => {
            if (category.key === 'order') {
                return renderOrderCategory(category);
            }

            const categoryStateLabel = category.totalCount === 0 ? t('noMissions') : (category.isComplete ? t('completed') : t('incomplete'));
            const badgeColor = category.totalCount === 0 ? '#8c8c8c' : (category.isComplete ? '#52c41a' : '#faad14');
            const unfinishedSummary = category.missions.filter(item => !item.isCompleted).length
                ? category.missions
                    .filter(item => !item.isCompleted)
                    .slice(0, 6)
                    .map(item => `${localizeMissionText(item.rawName || item.name, item.id)} (${item.progressText})`)
                    .join(state.ui.lang === 'zh' ? '；' : '; ')
                : t('allComplete');
            const visibleMissions = category.missions
                .filter(item => !hideCompleted || !item.isCompleted);
            if (hideCompleted && category.totalCount > 0 && !visibleMissions.length) {
                return '';
            }
            const missionList = visibleMissions
                .map(item => `
                    <tr>
                        <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);vertical-align:top;color:${item.isCompleted ? '#b7eb8f' : '#ddd'};">${escapeHtml(localizeMissionText(item.rawName || item.name, item.id))}</td>
                        <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;vertical-align:top;color:${item.isCompleted ? '#b7eb8f' : '#ddd'};">${escapeHtml(item.progressText)}</td>
                    </tr>
                `)
                .join('');

            return `
                <div style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                        <div style="font-weight:700;">${escapeHtml(getCategoryTitle(category))}</div>
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <span style="padding:2px 8px;border-radius:999px;background:${badgeColor};color:#111;font-weight:700;">${escapeHtml(categoryStateLabel)}</span>
                            <span style="color:#ddd;">${escapeHtml(`${t('doneLabel')} ${category.completedCount}/${category.totalCount}`)}</span>
                        </div>
                    </div>
                    <div style="margin-top:6px;color:#ddd;">${t('unfinishedLabel')}${escapeHtml(unfinishedSummary)}</div>
                    <div style="margin-top:8px;overflow:auto;border-radius:6px;background:rgba(255,255,255,0.03);">
                        ${missionList
                            ? `
                                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                                    <thead>
                                        <tr style="background:rgba(255,255,255,0.06);text-align:left;">
                                            <th style="padding:6px 8px;white-space:nowrap;">${hideCompleted ? t('unfinishedQuests') : t('quest')}</th>
                                            <th style="padding:6px 8px;white-space:nowrap;">${t('progressCol')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>${missionList}</tbody>
                                </table>
                            `
                            : `<div style="padding:8px;color:#b7eb8f;">${t('allCatComplete')}</div>`
                        }
                    </div>
                </div>
            `;
        }).join('');

        const html = `
            <div style="padding:8px 10px;color:#ddd;border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(summaryLine)}</div>
            ${categoryHtml}
        `;
        setContainerHtml(els.statusMissionPanelWrap, html);
    };

    const renderStatusTables = () => {
        const containers = [
            els.statusLandTableWrap,
            els.statusFlowerTableWrap,
            els.statusSeedTableWrap,
            els.statusMissionPanelWrap,
        ].filter(Boolean);
        if (containers.some(container => hasTextSelectionInside(container))) return;

        renderLandTable();
        renderFlowerTable(els.statusFlowerTableWrap);
        renderSeedTable();
        renderMissionPanel();
        uiRuntime.statusTablesDirty = false;
    };

    const updateStatusUI = ({ renderTables = false } = {}) => {
        const s = state.status;
        const userInfo = s.userInfo || {};
        const assets = s.assetsMap || {};
        const level = userInfo.iLevel ?? '--';
        const nextExp = userInfo.iNextLevelExp;
        const currentExp = assets?.['1000000']?.iAmount;
        const hasExpPair = nextExp !== undefined && nextExp !== null && nextExp !== '' && currentExp !== undefined && currentExp !== null && currentExp !== '';
        els.statusLevel.textContent = hasExpPair ? `${level} [${currentExp}/${nextExp}]` : String(level);
        els.statusMoney.textContent = assets?.['1000001']?.iAmount ?? '--';
        els.statusHuading.textContent = assets?.['1000002']?.iAmount ?? '--';

        els.statusSummary.textContent = s.loading
            ? t('loading')
            : s.lastRefreshAt
                ? `${t('refreshedAt')}${new Date(s.lastRefreshAt).toLocaleTimeString()}`
                : t('notLoaded');

        if (renderTables || uiRuntime.statusTablesDirty) {
            renderStatusTables();
        }
    };

    const updateUI = () => {
        updateXpUI();
        updateAutoBuyUI();
        updateAutoFarmUI();
        updateStatusUI();
        updateSettingsUI();
        applyTogglePositionUI();
        applyPanelOpacityUI();
        if (els.xpModeCountdown && els.xpModeCountup && els.xpModeAlways) {
            els.xpModeCountdown.checked = state.xp.timerMode === 'countdown';
            els.xpModeCountup.checked = state.xp.timerMode === 'countup';
            els.xpModeAlways.checked = state.xp.timerMode === 'always';
        }
        if (els.missionHideCompleted) {
            els.missionHideCompleted.checked = state.ui.hideCompletedMissions === true;
        }
        if (els.statusRefreshBtn) {
            els.statusRefreshBtn.disabled = state.status.loading;
        }
        if (els.missionRefreshBtn) {
            els.missionRefreshBtn.disabled = state.status.loading;
        }
        if (els.xpCountdownSettings) {
            els.xpCountdownSettings.style.display = state.xp.timerMode === 'countdown' ? 'block' : 'none';
        }
        if (els.xpCountupSettings) {
            els.xpCountupSettings.style.display = state.xp.timerMode === 'countup' ? 'block' : 'none';
        }
        if (els.xpCountdownDays && els.xpCountdownHours && els.xpCountdownMinutes) {
            const disableCountdown = state.xp.timerMode !== 'countdown';
            els.xpCountdownDays.disabled = disableCountdown;
            els.xpCountdownHours.disabled = disableCountdown;
            els.xpCountdownMinutes.disabled = disableCountdown;
            const opacity = disableCountdown ? '0.6' : '1';
            els.xpCountdownDays.style.opacity = opacity;
            els.xpCountdownHours.style.opacity = opacity;
            els.xpCountdownMinutes.style.opacity = opacity;
        }
        if (els.xpStopHour && els.xpStopMinute) {
            const disableClockInputs = state.xp.timerMode !== 'countup';
            els.xpStopHour.disabled = disableClockInputs;
            els.xpStopMinute.disabled = disableClockInputs;
            els.xpStopHour.style.opacity = disableClockInputs ? '0.6' : '1';
            els.xpStopMinute.style.opacity = disableClockInputs ? '0.6' : '1';
        }
    };

    const applyXpSettings = () => {
        const timerMode = els.xpModeCountdown?.checked
            ? 'countdown'
            : els.xpModeCountup?.checked
                ? 'countup'
                : els.xpModeAlways?.checked
                    ? 'always'
                    : DEFAULT_XP_TIMER_MODE;
        const countdownDays = Number.parseInt(els.xpCountdownDays.value, 10);
        const countdownHours = Number.parseInt(els.xpCountdownHours.value, 10);
        const countdownMinutes = Number.parseInt(els.xpCountdownMinutes.value, 10);
        const stopHour = Number.parseInt(els.xpStopHour.value, 10);
        const stopMinute = Number.parseInt(els.xpStopMinute.value, 10);

        if (!['countdown', 'countup', 'always'].includes(timerMode)) {
            addLog(logText(`刷经验计时模式无效: ${timerMode}`, `XP timer mode invalid: ${timerMode}`), 'ERROR');
            return false;
        }

        if (!Number.isFinite(countdownDays) || countdownDays < 0) {
            addLog(logText(`刷经验倒计时天数无效: ${els.xpCountdownDays.value}`, `XP countdown days invalid: ${els.xpCountdownDays.value}`), 'ERROR');
            return false;
        }
        if (!Number.isFinite(countdownHours) || countdownHours < 0 || countdownHours > 23) {
            addLog(logText(`刷经验倒计时小时无效: ${els.xpCountdownHours.value}`, `XP countdown hours invalid: ${els.xpCountdownHours.value}`), 'ERROR');
            return false;
        }
        if (!Number.isFinite(countdownMinutes) || countdownMinutes < 0 || countdownMinutes > 59) {
            addLog(logText(`刷经验倒计时分钟无效: ${els.xpCountdownMinutes.value}`, `XP countdown minutes invalid: ${els.xpCountdownMinutes.value}`), 'ERROR');
            return false;
        }
        if (!Number.isFinite(stopHour) || stopHour < 0 || stopHour > 23) {
            addLog(logText(`刷经验正计时停止小时无效: ${els.xpStopHour.value}`, `XP stop hour invalid: ${els.xpStopHour.value}`), 'ERROR');
            return false;
        }
        if (!Number.isFinite(stopMinute) || stopMinute < 0 || stopMinute > 59) {
            addLog(logText(`刷经验正计时停止分钟无效: ${els.xpStopMinute.value}`, `XP stop minute invalid: ${els.xpStopMinute.value}`), 'ERROR');
            return false;
        }

        const countdownTotalMs = (((countdownDays * 24) + countdownHours) * 60 + countdownMinutes) * 60 * 1000;
        if (timerMode === 'countdown' && countdownTotalMs <= 0) {
            addLog(logText('刷经验倒计时模式下，天/小时/分钟至少需要一个大于 0', 'XP countdown mode needs days/hours/minutes greater than 0'), 'ERROR');
            return false;
        }

        state.xp.timerMode = timerMode;
        state.xp.countdownDays = countdownDays;
        state.xp.countdownHours = countdownHours;
        state.xp.countdownMinutes = countdownMinutes;
        state.xp.stopHour = stopHour;
        state.xp.stopMinute = stopMinute;
        state.xp.stopAtTs = 0;
        state.xp.firstRoundSteps = FIXED_STEPS_PER_ROUND;
        state.xp.landIndex = String(els.xpLandIndex.value || DEFAULT_XP_LAND).trim();
        state.xp.cropId = String(els.xpCropId.value || DEFAULT_XP_CROP).trim();
        state.xp.missionType = "1";
        state.xp.missionId = String(els.xpMissionId.value || state.xp.missionId).trim();

        els.xpStatus.textContent = t('xpSettingsUpdated');
        const stopTimeLabel = `${String(state.xp.stopHour).padStart(2, '0')}:${String(state.xp.stopMinute).padStart(2, '0')}`;
        addLog(
            logText(
                `刷经验设置已应用：mode=${state.xp.timerMode}, countdown=${state.xp.countdownDays}d ${state.xp.countdownHours}h ${state.xp.countdownMinutes}m, clockStop=${stopTimeLabel}, land=${state.xp.landIndex}, seed=${state.xp.cropId}, mission=${state.xp.missionId}`,
                `XP settings applied: mode=${state.xp.timerMode}, countdown=${state.xp.countdownDays}d ${state.xp.countdownHours}h ${state.xp.countdownMinutes}m, clockStop=${stopTimeLabel}, land=${state.xp.landIndex}, seed=${state.xp.cropId}, quest=${state.xp.missionId}`
            )
        );
        saveSettingsToStorage();
        updateUI();
        return true;
    };

    const applyAutoBuySettings = () => {
        const perBuyCount = Number.parseInt(els.buyPerCount.value, 10);
        const repeatTimes = Number.parseInt(els.buyRepeatTimes.value, 10);

        if (!Number.isFinite(perBuyCount) || perBuyCount < 1) {
            addLog(logText(`自动买种子每次购买数量无效: ${els.buyPerCount.value}`, `Buy seeds per-count invalid: ${els.buyPerCount.value}`), 'ERROR');
            return false;
        }
        if (!Number.isFinite(repeatTimes) || repeatTimes < 1) {
            addLog(logText(`自动买种子购买次数无效: ${els.buyRepeatTimes.value}`, `Buy seeds times invalid: ${els.buyRepeatTimes.value}`), 'ERROR');
            return false;
        }

        state.autoBuy.cropId = String(els.buyCropId.value || DEFAULT_BUY_CROP).trim();
        state.autoBuy.perBuyCount = perBuyCount;
        state.autoBuy.repeatTimes = repeatTimes;

        els.buyStatus.textContent = t('buySettingsUpdated');
        addLog(logText(
            `自动买种子设置已应用：seed=${state.autoBuy.cropId}, perBuy=${state.autoBuy.perBuyCount}, times=${state.autoBuy.repeatTimes}`,
            `Buy seeds settings applied: seed=${state.autoBuy.cropId}, perBuy=${state.autoBuy.perBuyCount}, times=${state.autoBuy.repeatTimes}`
        ));
        saveSettingsToStorage();
        updateUI();
        return true;
    };

    const applyAutoFarmSettings = () => {
        const intervalMin = Number.parseInt(els.afIntervalMin.value, 10);
        const delayMin = Number.parseInt(els.afDelayMin.value, 10);
        const delayMax = Number.parseInt(els.afDelayMax.value, 10);

        if (!Number.isFinite(intervalMin) || intervalMin < 1) {
            addLog(logText(`自动种植间隔无效: ${els.afIntervalMin.value}`, `Auto farm interval invalid: ${els.afIntervalMin.value}`), 'ERROR');
            return false;
        }
        if (!Number.isFinite(delayMin) || delayMin < 0 || !Number.isFinite(delayMax) || delayMax < 0 || delayMin > delayMax) {
            addLog(logText(`自动种植随机延迟无效: min=${els.afDelayMin.value}, max=${els.afDelayMax.value}`, `Auto farm random delay invalid: min=${els.afDelayMin.value}, max=${els.afDelayMax.value}`), 'ERROR');
            return false;
        }

        const validLands = new Set(normalizeLandList(state.status.landOptions));
        const selectedLands = getSelectedAutoFarmLandsFromUI().filter(v => validLands.has(v));
        if (!selectedLands.length) {
            addLog(logText('自动种植至少勾选 1 个地块', 'Auto farm requires at least 1 selected land'), 'ERROR');
            return false;
        }

        state.autoFarm.cropId = String(els.afCropId.value || DEFAULT_AF_CROP).trim();
        state.autoFarm.selectedLands = selectedLands;
        state.autoFarm.intervalMin = intervalMin;
        state.autoFarm.randomDelayMinMs = delayMin;
        state.autoFarm.randomDelayMaxMs = delayMax;

        els.afStatus.textContent = t('afSettingsUpdated');
        addLog(
            logText(
                `自动种植设置已应用：seed=${state.autoFarm.cropId}, lands=${state.autoFarm.selectedLands.join('/')}, checkInterval=${intervalMin}分钟, delay=${delayMin}-${delayMax}ms`,
                `Auto farm settings applied: seed=${state.autoFarm.cropId}, lands=${state.autoFarm.selectedLands.join('/')}, checkInterval=${intervalMin} min, delay=${delayMin}-${delayMax}ms`
            )
        );
        saveSettingsToStorage();
        updateUI();
        return true;
    };

    const xpSleepRandom = async () => {
        const ms = Math.floor(Math.random() * (1500 - 500 + 1)) + 500;
        const start = Date.now();

        while (Date.now() - start < ms) {
            if (state.xp.stopped) throw new Error('用户停止刷经验脚本');
            const left = ms - (Date.now() - start);
            els.xpWaiting.textContent = `${Math.max(0, left)}ms`;
            updateXpUI();
            await sleep(100);
        }

        els.xpWaiting.textContent = '0ms';
        updateXpUI();
    };

    const isAutoFarmStopError = (err) => String(err?.message || '').includes('用户停止自动种植脚本');
    const assertAutoFarmNotStopped = () => {
        if (state.autoFarm.stopped) throw new Error('用户停止自动种植脚本');
    };

    const afSleepRandom = async (label = '') => {
        const min = Math.max(0, Number(state.autoFarm.randomDelayMinMs || 0));
        const max = Math.max(min, Number(state.autoFarm.randomDelayMaxMs || 0));
        const ms = Math.floor(Math.random() * (max - min + 1)) + min;
        if (ms > 0) {
            if (ms >= AF_WAIT_LOG_MIN_MS) {
                addLog(logText(`自动种植 ${label} 等待 ${ms}ms`, `Auto farm ${label} wait ${ms}ms`));
            }
            const start = Date.now();
            while (Date.now() - start < ms) {
                assertAutoFarmNotStopped();
                const left = ms - (Date.now() - start);
                await sleep(Math.min(100, Math.max(0, left)));
            }
        }
        assertAutoFarmNotStopped();
    };

    const postApi = async (path, fields = {}) => {
        return requestFormJson({
            path,
            fields,
            label: `API ${path}`,
            requireSuccess: true,
        });
    };

    const buildCropMap = (bagSeeds = [], shopSeeds = []) => {
        const map = {};

        for (const seed of bagSeeds) {
            if (seed?.iItemId && seed?.sItemName) {
                map[String(seed.iItemId)] = seed.sItemName;
            }
        }

        for (const seed of shopSeeds) {
            if (seed?.commodityId && seed?.sName) {
                map[String(seed.commodityId)] = seed.sName;
            }
        }

        return map;
    };

    const normalizeBagItemList = (items = []) => {
        const list = Array.isArray(items) ? items : [];
        return list
            .filter(Boolean)
            .map(item => ({
                iItemId: item?.iItemId ?? item?.itemId ?? item?.id ?? '',
                sItemName: item?.sItemName ?? item?.itemName ?? item?.name ?? '',
                iAmount: Number(item?.iAmount ?? item?.amount ?? item?.ownNum ?? item?.count ?? 0),
            }))
            .filter(item => String(item.iItemId).trim());
    };

    const buildMissionMap = (allMissionRes) => {
        const map = {};
        const main = allMissionRes?.jData?.mission?.main || [];
        const chapter = allMissionRes?.jData?.mission?.chapter?.missionInfo || [];
        const order = allMissionRes?.jData?.mission?.order?.OrderMissionInfo || [];

        for (const item of main) {
            if (item?.questId && item?.questName) {
                map[String(item.questId)] = item.questName;
            }
        }

        for (const item of chapter) {
            if (item?.questId && item?.questName) {
                map[String(item.questId)] = item.questName;
            }
        }

        for (const item of order) {
            if (item?.taskId && item?.taskName) {
                map[String(item.taskId)] = item.taskName;
            }
        }

        return map;
    };

    const buildMainMissionMap = (allMissionRes) => {
        const map = {};
        const main = allMissionRes?.jData?.mission?.main || [];

        for (const item of main) {
            if (item?.questId && item?.questName) {
                map[String(item.questId)] = item.questName;
            }
        }

        return map;
    };

    const getFirstDefinedValue = (target, keys = []) => {
        for (const key of keys) {
            const value = safeGet(target, key);
            if (value !== undefined && value !== null && value !== '') {
                return value;
            }
        }
        return undefined;
    };

    const getFiniteMissionNumber = (target, keys = []) => {
        const raw = getFirstDefinedValue(target, keys);
        const value = Number.parseInt(raw, 10);
        return Number.isFinite(value) ? value : NaN;
    };

    const getMissionBoolean = (target, keys = []) => {
        for (const key of keys) {
            const value = safeGet(target, key);
            if (value === true || value === false) return value;
            if (value === 1 || value === '1' || value === 'true') return true;
            if (value === 0 || value === '0' || value === 'false') return false;
        }
        return null;
    };

    const isCompletedMissionStatus = (rawStatus) => {
        const text = String(rawStatus ?? '').trim().toLowerCase();
        if (!text) return false;
        const code = Number.parseInt(text, 10);
        if (code === 2) return true;
        return ['complete', 'completed', 'done', 'finished', 'finish', 'claimed', 'received'].includes(text);
    };

    const normalizeMissionStatusText = (mission) => {
        const currentProgress = getFiniteMissionNumber(mission, [
            'currentProgress', 'progress', 'curProgress', 'doneNum', 'finishNum', 'currentNum', 'currentCount'
        ]);
        const totalProgress = getFiniteMissionNumber(mission, [
            'totalProgress', 'target', 'targetNum', 'needNum', 'totalNum', 'maxProgress', 'totalCount'
        ]);

        const explicitComplete = getMissionBoolean(mission, [
            'isCompleted', 'isDone', 'isFinish', 'isFinished', 'isComplete', 'completed', 'done', 'finish'
        ]);
        const explicitClaimed = getMissionBoolean(mission, [
            'isReceived', 'isRewardReceived', 'isClaimed', 'claimed', 'received', 'gotReward'
        ]);

        const rawStatus = getFirstDefinedValue(mission, [
            'iStatus', 'status', 'taskStatus', 'questStatus', 'missionStatus', 'state', 'rewardStatus', 'awardStatus', 'receiveStatus'
        ]);
        const rawStatusText = String(rawStatus ?? '').trim();
        const statusCompleted = isCompletedMissionStatus(rawStatus);

        const hasProgress = Number.isFinite(currentProgress) && Number.isFinite(totalProgress) && totalProgress > 0;
        const progressComplete = hasProgress && currentProgress >= totalProgress;
        const progressIncomplete = hasProgress && currentProgress < totalProgress;
        const isCompleted = explicitClaimed === true
            || statusCompleted
            || progressComplete
            || (explicitComplete === true && !progressIncomplete);
        const isClaimed = explicitClaimed === true;

        let progressText = t('inProgress');
        if (isClaimed) {
            progressText = t('claimed');
        } else if (hasProgress) {
            progressText = `${currentProgress}/${totalProgress}`;
            if (isCompleted) {
                progressText = `${progressText} ${t('completed')}`;
            }
        } else if (isCompleted) {
            progressText = t('completed');
        } else if (rawStatusText) {
            progressText = `${state.ui.lang === 'zh' ? '状态' : 'Status'} ${rawStatusText}`;
        }

        return {
            currentProgress: Number.isFinite(currentProgress) ? currentProgress : null,
            totalProgress: Number.isFinite(totalProgress) ? totalProgress : null,
            isCompleted,
            isClaimed,
            progressText,
            rawStatusText,
        };
    };

    const normalizeMissionItem = (mission, categoryKey) => {
        const id = String(getFirstDefinedValue(mission, ['questId', 'taskId', 'id']) || '').trim();
        const rawName = String(getFirstDefinedValue(mission, ['questName', 'taskName', 'name', 'title']) || id || (state.ui.lang === 'zh' ? '未命名任务' : 'Unnamed Quest')).trim();
        const name = localizeMissionText(rawName, id);
        const status = normalizeMissionStatusText(mission);

        return {
            id,
            name,
            rawName,
            categoryKey,
            currentProgress: status.currentProgress,
            totalProgress: status.totalProgress,
            isCompleted: status.isCompleted,
            isClaimed: status.isClaimed,
            progressText: status.progressText,
            rawStatusText: status.rawStatusText,
        };
    };

    const buildMissionCategoryOverview = (categoryKey, title, missions = []) => {
        const normalizedMissions = (Array.isArray(missions) ? missions : [])
            .filter(Boolean)
            .map(item => normalizeMissionItem(item, categoryKey));

        const completedCount = normalizedMissions.filter(item => item.isCompleted).length;
        const unfinished = normalizedMissions.filter(item => !item.isCompleted);
        const unfinishedSummary = unfinished.length
            ? unfinished
                .slice(0, 6)
                .map(item => `${item.name} (${item.progressText})`)
                .join(state.ui.lang === 'zh' ? '；' : '; ')
            : t('allComplete');

        return {
            key: categoryKey,
            title,
            totalCount: normalizedMissions.length,
            completedCount,
            unfinishedCount: unfinished.length,
            isComplete: normalizedMissions.length > 0 && unfinished.length === 0,
            unfinishedSummary,
            missions: normalizedMissions,
        };
    };

    const getVisibleMainMissions = (missions = []) => {
        const list = (Array.isArray(missions) ? missions : []).filter(Boolean);
        return list.length <= 3 ? list : list.slice(-3);
    };

    const PUBLISHER_NAMES = {
        1: 'Lux', 2: 'Ezreal', 7: 'Akali', 8: 'Yone', 10: 'Gwen',
        12: 'Seraphine', 15: "Kai'sa", 17: 'Vladimir', 22: 'Ahri', 23: 'Caitlyn',
    };

    const ORDER_SUBTASK_DEFS = {
        1: [
            { name: '收获10次战斗玫瑰', totalProgress: 10 },
            { name: '给花园里的花朵浇水10次', totalProgress: 10 },
            { name: '在庄园放置2个以前未放置过的植物', totalProgress: 2 },
        ],
        2: [
            { name: '在商店购买10颗种子', totalProgress: 10 },
            { name: '收获10次翡翠藤蔓', totalProgress: 10 },
            { name: '使用5个火鸢尾花在《激斗峡谷》商店兑换道具', totalProgress: 5 },
        ],
        7: [
            { name: '收获虚空之花20次', totalProgress: 20 },
            { name: '在商店使用200枚花绽币', totalProgress: 200 },
            { name: '在庄园放置1个以前未放置过的水晶蔷薇雕塑', totalProgress: 1 },
        ],
        8: [
            { name: '在商店使用50金钱', totalProgress: 50 },
            { name: '给花园里的花朵浇水20次', totalProgress: 20 },
            { name: '在庄园放置1个以前未放置过的邮箱', totalProgress: 1 },
        ],
        10: [
            { name: '播种10颗火鸢尾花种子', totalProgress: 10 },
            { name: '在庄园移除3个建筑物', totalProgress: 3 },
            { name: '在庄园界面更改房屋1次', totalProgress: 1 },
        ],
        12: [
            { name: '在商店使用150枚花绽币', totalProgress: 150 },
            { name: '收获鲜花50次', totalProgress: 50 },
            { name: '给霞光郁金香浇水3次', totalProgress: 3 },
        ],
        15: [
            { name: '收获鲜花50次', totalProgress: 50 },
            { name: '在商店使用100金钱', totalProgress: 100 },
            { name: '使用30冰晶花在商店兑换建筑物', totalProgress: 30 },
        ],
        17: [
            { name: '收获鲜花100次', totalProgress: 100 },
            { name: '在商店使用200金钱', totalProgress: 200 },
            { name: '在庄园放置3个以前未放置过的不同颜色的迷你波罗雕塑', totalProgress: 3 },
        ],
        22: [
            { name: '收获鲜花30次', totalProgress: 30 },
            { name: '在庄园放置1个以前未放置过的猫家具', totalProgress: 1 },
            { name: '在庄园放置2个以前未放置过的不同的狗屋', totalProgress: 2 },
        ],
        23: [
            { name: '给花园里的花朵浇水20次', totalProgress: 20 },
            { name: '给雷鸣鸢尾浇水3次', totalProgress: 3 },
            { name: '给虚空之花浇水3次', totalProgress: 3 },
        ],
    };

    const normalizeOrderMission = (mission) => {
        const publisher = Number(mission?.publisher ?? 0);
        const charName = PUBLISHER_NAMES[publisher] || '';
        const rawSubTasks = Array.isArray(mission?.subTasks) ? mission.subTasks : [];
        const defs = ORDER_SUBTASK_DEFS[publisher] || [];
        const finishedTaskNum = Number(mission?.finishedTaskNum ?? 0);
        const rawStatus = Number.parseInt(mission?.iStatus ?? mission?.status ?? mission?.taskStatus ?? '', 10);
        const claimedRewardCount = Object.values(mission?.claimedRewards || {})
            .filter(value => Number(value) === 1)
            .length;
        const missionFullyComplete = rawStatus === 2 || finishedTaskNum >= 3 || claimedRewardCount >= 3;
        const subTasks = [];
        for (let i = 0; i < 3; i++) {
            const raw = rawSubTasks[i] || {};
            const def = defs[i] || {};
            const hasData = Boolean(
                raw.subTaskId
                || raw.subTaskName
                || raw.totalProgress !== undefined
                || raw.completedProgress !== undefined
                || raw.isCompleted !== undefined
            );

            if (hasData) {
                const total = Number(raw.totalProgress ?? def.totalProgress ?? 0);
                const current = Number(raw.completedProgress ?? raw.currentProgress ?? raw.progress ?? 0);
                const rawSubStatus = raw.iStatus ?? raw.status ?? raw.taskStatus;
                const subProgressComplete = total > 0 && current >= total;
                const subProgressIncomplete = total > 0 && current < total;
                const completed = isCompletedMissionStatus(rawSubStatus)
                    || subProgressComplete
                    || (raw.isCompleted === true && !subProgressIncomplete);
                subTasks.push({
                    id: String(raw.subTaskId ?? `${publisher}-${i + 1}`),
                    name: raw.subTaskName || def.name || `${state.ui.lang === 'zh' ? '子任务' : 'Task'} ${i + 1}`,
                    totalProgress: total,
                    currentProgress: current,
                    isCompleted: completed,
                    progressText: total > 0 ? `${current}/${total}${completed ? ' ✓' : ''}` : (completed ? '✓' : '--'),
                });
            } else {
                const inferCompleted = missionFullyComplete;
                const total = def.totalProgress || 0;
                subTasks.push({
                    id: `${publisher}-${i + 1}`,
                    name: def.name || `${state.ui.lang === 'zh' ? '子任务' : 'Task'} ${i + 1}`,
                    totalProgress: total,
                    currentProgress: inferCompleted ? total : 0,
                    isCompleted: inferCompleted,
                    progressText: inferCompleted ? `${total}/${total} ✓` : (total ? `0/${total}` : t('notStarted')),
                });
            }
        }

        const completedSubTasks = subTasks.filter(st => st.isCompleted).length;
        const missionDone = missionFullyComplete || completedSubTasks >= 3;

        return {
            id: String(mission?.taskId ?? ''),
            name: mission?.taskName || mission?.publisherTitle || '',
            charName,
            publisher,
            finishedTaskNum,
            isCompleted: missionDone,
            starRating: Number(mission?.starRating ?? 0),
            subTasks,
            completedSubTasks,
        };
    };

    const buildOrderCategoryOverview = (orderMissions = []) => {
        const normalized = (Array.isArray(orderMissions) ? orderMissions : [])
            .filter(Boolean)
            .map(normalizeOrderMission)
            .filter(m => m.finishedTaskNum > 0 || m.subTasks.some(st => st.currentProgress > 0));

        const completedCount = normalized.filter(m => m.isCompleted).length;
        const unfinished = normalized.filter(m => !m.isCompleted);

        return {
            key: 'order',
            title: t('orderQuests'),
            totalCount: normalized.length,
            completedCount,
            unfinishedCount: unfinished.length,
            isComplete: normalized.length > 0 && unfinished.length === 0,
            unfinishedSummary: unfinished.length
                ? unfinished.slice(0, 4).map(m => `${m.charName || m.name} (${m.completedSubTasks}/3)`).join(state.ui.lang === 'zh' ? '；' : '; ')
                : t('allComplete'),
            missions: normalized.map(m => normalizeMissionItem({
                questId: m.id,
                questName: `${m.charName ? m.charName + ' - ' : ''}${m.name}`,
                totalProgress: 3,
                currentProgress: m.completedSubTasks,
                isDone: m.isCompleted,
            }, 'order')),
            orderMissions: normalized,
        };
    };

    const buildMissionOverview = (allMissionRes) => {
        const main = getVisibleMainMissions(allMissionRes?.jData?.mission?.main || []);
        const chapter = allMissionRes?.jData?.mission?.chapter?.missionInfo || [];
        const order = allMissionRes?.jData?.mission?.order?.OrderMissionInfo || [];

        const categories = [
            buildMissionCategoryOverview('main', t('mainQuests'), main),
            buildMissionCategoryOverview('chapter', t('chapterQuests'), chapter),
            buildOrderCategoryOverview(order),
        ];

        return {
            categories,
            totalCount: categories.reduce((sum, item) => sum + item.totalCount, 0),
            completedCount: categories.reduce((sum, item) => sum + item.completedCount, 0),
            unfinishedCount: categories.reduce((sum, item) => sum + item.unfinishedCount, 0),
        };
    };

    const fetchXpMissionProgress = async (missionId) => {
        const targetMissionId = String(missionId || '').trim();
        const missionRes = await postApi('init?a=getAllMissions', {});
        const missionMap = buildMissionMap(missionRes);
        const mainMissionMap = buildMainMissionMap(missionRes);
        state.status.missionMap = missionMap;
        state.status.mainMissionMap = mainMissionMap;

        const mainMissions = missionRes?.jData?.mission?.main || [];
        const mission = mainMissions.find(item => String(item?.questId) === targetMissionId);
        if (!mission) {
            throw new Error(logText(`getAllMissions 未找到任务 ${targetMissionId}`, `getAllMissions did not find quest ${targetMissionId}`));
        }

        const totalRaw = Number.parseInt(mission?.totalProgress, 10);
        const currentRaw = Number.parseInt(mission?.currentProgress, 10);
        const totalProgress = Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : FIXED_STEPS_PER_ROUND;
        const currentProgress = Number.isFinite(currentRaw)
            ? Math.min(totalProgress, Math.max(0, currentRaw))
            : 0;
        const remainingPlantTimes = Math.max(0, totalProgress - currentProgress);

        return {
            missionId: targetMissionId,
            missionName: mission?.questName || mainMissionMap[targetMissionId] || missionMap[targetMissionId] || '',
            totalProgress,
            currentProgress,
            remainingPlantTimes,
        };
    };

    const refreshXpSummaryState = async () => {
        const summaryRes = await postApi('init?a=summary', {});
        const repeatMissionData = summaryRes?.jData?.debugInfo?.repeatMissionData || {};
        state.status.repeatMissionId = String(repeatMissionData?.id || '');
        state.status.repeatMissionProgress = repeatMissionData?.progress ?? '';
        state.status.repeatMissionTarget = repeatMissionData?.target ?? '';
        return {
            repeatMissionId: state.status.repeatMissionId,
            repeatMissionProgress: state.status.repeatMissionProgress,
            repeatMissionTarget: state.status.repeatMissionTarget,
        };
    };

    const waitXpMissionReadyForSubmit = async (round, maxChecks = 3) => {
        let lastInfo = null;
        let lastError = null;

        for (let i = 1; i <= maxChecks; i++) {
            try {
                const info = await fetchXpMissionProgress(state.xp.missionId);
                lastInfo = info;
                addLog(logText(`XP Round ${round}: 提交前任务进度 ${info.currentProgress}/${info.totalProgress}`, `XP Round ${round}: quest progress before submit ${info.currentProgress}/${info.totalProgress}`));
                if (info.currentProgress >= info.totalProgress) {
                    return { ready: true, info, error: null };
                }
            } catch (err) {
                lastError = err;
                addLog(logText(`XP Round ${round}: 获取任务进度失败: ${err.message}`, `XP Round ${round}: failed to fetch quest progress: ${err.message}`), 'WARN');
            }

            if (i < maxChecks) {
                const waitMs = 300 * i;
                await sleep(waitMs);
            }
        }

        return { ready: false, info: lastInfo, error: lastError };
    };

    const fetchGarden = async () => {
        const data = await requestFormJson({
            path: 'farm?a=garden',
            label: 'API farm?a=garden',
            requireSuccess: true,
        });
        const garden = data?.jData?.gardenInfo;
        if (!Array.isArray(garden)) {
            throw new Error(`gardenInfo 解析失败: ${JSON.stringify(data)}`);
        }
        return { data, garden };
    };

    const fetchCurrentStatusData = async () => {
        const requests = [
            { key: 'farm', label: 'init?a=farm', run: () => postApi('init?a=farm', { region: 'am', nickName: '' }) },
            { key: 'bag', label: 'init?a=getBagStoreMissionData', run: () => postApi('init?a=getBagStoreMissionData', {}) },
            { key: 'mission', label: 'init?a=getAllMissions', run: () => postApi('init?a=getAllMissions', {}) },
            { key: 'summary', label: 'init?a=summary', run: () => postApi('init?a=summary', {}) },
            { key: 'garden', label: 'farm?a=garden', run: () => fetchGarden() },
        ];

        const settled = await Promise.allSettled(requests.map(item => item.run()));
        const results = {};
        const partialErrors = [];

        settled.forEach((result, index) => {
            const request = requests[index];
            if (result.status === 'fulfilled') {
                results[request.key] = result.value;
            } else {
                partialErrors.push(`${request.label}: ${result.reason?.message || String(result.reason)}`);
            }
        });

        const shapeOk = (condition, label, detail) => {
            if (condition) return true;
            partialErrors.push(`${label}: ${detail}`);
            return false;
        };

        const farmRes = results.farm;
        const bagRes = results.bag;
        const missionRes = results.mission;
        const summaryRes = results.summary;
        const gardenRes = results.garden;

        const farmOk = Boolean(farmRes)
            && shapeOk(isObjectLike(farmRes?.jData?.userInfo), 'init?a=farm', 'missing jData.userInfo')
            && shapeOk(isObjectLike(farmRes?.jData?.userAssetsMap), 'init?a=farm', 'missing jData.userAssetsMap');
        const bagOk = Boolean(bagRes)
            && shapeOk(isObjectLike(bagRes?.jData?.bag), 'init?a=getBagStoreMissionData', 'missing jData.bag')
            && shapeOk(Array.isArray(bagRes?.jData?.shop?.seeds), 'init?a=getBagStoreMissionData', 'missing jData.shop.seeds');
        const missionOk = Boolean(missionRes)
            && shapeOk(isObjectLike(missionRes?.jData?.mission), 'init?a=getAllMissions', 'missing jData.mission');
        const summaryOk = Boolean(summaryRes)
            && shapeOk(isObjectLike(summaryRes?.jData), 'init?a=summary', 'missing jData');
        const gardenOk = Boolean(gardenRes)
            && shapeOk(Array.isArray(gardenRes?.garden), 'farm?a=garden', 'missing gardenInfo');

        const usableCount = [farmOk, bagOk, missionOk, summaryOk, gardenOk].filter(Boolean).length;
        if (!usableCount) {
            throw new Error(partialErrors.join(' | ') || 'all status requests failed');
        }

        const userInfo = farmOk ? (farmRes?.jData?.userInfo || {}) : (state.status.userInfo || {});
        const assetsMap = farmOk ? (farmRes?.jData?.userAssetsMap || {}) : (state.status.assetsMap || {});
        const bagSeeds = bagOk ? normalizeBagItemList(bagRes?.jData?.bag?.seeds || []) : [...(state.status.bagSeeds || [])];
        const bagFlowers = bagOk
            ? normalizeBagItemList(bagRes?.jData?.bag?.flowers || bagRes?.jData?.bag?.flower || [])
            : [...(state.status.bagFlowers || [])];
        const shopSeeds = bagOk ? (bagRes?.jData?.shop?.seeds || []) : [];
        const gardenInfo = gardenOk
            ? [...(gardenRes?.garden || [])].sort((a, b) => Number(a?.landIndex ?? 0) - Number(b?.landIndex ?? 0))
            : [...(state.status.gardenInfo || [])];

        const cropMap = bagOk ? buildCropMap(bagSeeds, shopSeeds) : { ...(state.status.cropMap || {}) };
        for (const land of gardenInfo) {
            const cropId = String(land?.cropId ?? '').trim();
            const cropName = String(land?.cropDetail?.sName || '').trim();
            if (cropId && cropId !== '0' && cropName && !cropMap[cropId]) {
                cropMap[cropId] = cropName;
            }
        }

        const missionMap = missionOk ? buildMissionMap(missionRes) : { ...(state.status.missionMap || {}) };
        const mainMissionMap = missionOk ? buildMainMissionMap(missionRes) : { ...(state.status.mainMissionMap || {}) };
        const missionOverview = missionOk ? buildMissionOverview(missionRes) : state.status.missionOverview;

        const repeatMissionData = summaryOk ? (summaryRes?.jData?.debugInfo?.repeatMissionData || {}) : null;
        const repeatMissionId = summaryOk ? String(repeatMissionData?.id || '') : state.status.repeatMissionId;
        const repeatMissionProgress = summaryOk ? (repeatMissionData?.progress ?? '') : state.status.repeatMissionProgress;
        const repeatMissionTarget = summaryOk ? (repeatMissionData?.target ?? '') : state.status.repeatMissionTarget;

        const landOptions = gardenOk
            ? gardenInfo.map(x => String(x.landIndex)).filter(Boolean)
            : [...(state.status.landOptions || [])];

        const shopSeedCatalog = bagOk
            ? shopSeeds
                .map(seed => ({
                    commodityId: seed.commodityId,
                    name: seed.sName,
                    yieldCount: Number(seed?.gainInfo?.itemNum ?? 1),
                    expValue: Number(seed?.gainInfo?.expValue ?? 0),
                    growDuration: Number(seed?.gainInfo?.growDuration ?? 0),
                    cost: Number(seed?.buyInfo?.[0]?.itemNum ?? 0),
                    costName: seed?.buyInfo?.[0]?.itemName || '',
                    unlocked: Number(seed?.unlockedStatus ?? seed?.iIsOpen ?? 0) === 1,
                }))
                .filter(seed => String(seed.commodityId || '').trim())
            : [...(state.status.shopSeedCatalog || [])];

        shopSeedCatalog.sort((a, b) => {
            const an = Number(a?.commodityId);
            const bn = Number(b?.commodityId);
            if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
            return String(a?.commodityId ?? '').localeCompare(String(b?.commodityId ?? ''), 'en-US');
        });

        const unlockedSeeds = bagOk
            ? shopSeeds
                .filter(seed => Number(seed?.unlockedStatus ?? seed?.iIsOpen ?? 0) === 1)
                .map(seed => ({
                    commodityId: seed.commodityId,
                    name: seed.sName,
                    yieldCount: Number(seed?.gainInfo?.itemNum ?? 1),
                    expValue: Number(seed?.gainInfo?.expValue ?? 0),
                    growDuration: Number(seed?.gainInfo?.growDuration ?? 0),
                    cost: Number(seed?.buyInfo?.[0]?.itemNum ?? 0),
                    costName: seed?.buyInfo?.[0]?.itemName || '',
                }))
            : [...(state.status.shopSeeds || [])];

        unlockedSeeds.sort((a, b) => {
            const an = Number(a?.commodityId);
            const bn = Number(b?.commodityId);
            if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
            return String(a?.commodityId ?? '').localeCompare(String(b?.commodityId ?? ''), 'en-US');
        });

        return {
            userInfo,
            assetsMap,
            bagSeeds,
            bagFlowers,
            shopSeedCatalog,
            unlockedSeeds,
            gardenInfo,
            cropMap,
            missionMap,
            mainMissionMap,
            missionOverview,
            repeatMissionId,
            repeatMissionProgress,
            repeatMissionTarget,
            landOptions: landOptions.length ? landOptions : ["1", "2", "3", "4", "5", "6"],
            partialErrors,
        };
    };

    const refreshCurrentStatus = async () => {
        if (state.status.loading) return false;

        state.status.loading = true;
        updateStatusUI();
        addLog(t('startRefresh'));
        let refreshOk = false;

        try {
            const data = await fetchCurrentStatusData();

            state.status.userInfo = data.userInfo;
            state.status.assetsMap = data.assetsMap;
            state.status.bagSeeds = data.bagSeeds;
            state.status.bagFlowers = data.bagFlowers;
            state.status.shopSeedCatalog = data.shopSeedCatalog;
            state.status.shopSeeds = data.unlockedSeeds;
            state.status.gardenInfo = data.gardenInfo;
            state.status.cropMap = data.cropMap;
            state.status.missionMap = data.missionMap;
            state.status.mainMissionMap = data.mainMissionMap;
            state.status.missionOverview = data.missionOverview;
            state.status.repeatMissionId = data.repeatMissionId;
            state.status.repeatMissionProgress = data.repeatMissionProgress;
            state.status.repeatMissionTarget = data.repeatMissionTarget;
            state.status.landOptions = data.landOptions;
            state.status.lastRefreshAt = Date.now();
            syncAutoFarmFlowerMappingsFromGarden(state.status.gardenInfo);
            markStatusTablesDirty();

            if (!data.cropMap[state.xp.cropId]) {
                state.xp.cropId = DEFAULT_XP_CROP;
            }
            if (!data.cropMap[state.autoFarm.cropId]) {
                state.autoFarm.cropId = DEFAULT_AF_CROP;
            }
            if (!data.cropMap[state.autoBuy.cropId]) {
                state.autoBuy.cropId = DEFAULT_BUY_CROP;
            }
            if (!data.mainMissionMap[state.xp.missionId] && data.repeatMissionId) {
                state.xp.missionId = String(data.repeatMissionId);
            }
            if (!data.landOptions.includes(String(state.xp.landIndex))) {
                state.xp.landIndex = DEFAULT_XP_LAND;
                if (!data.landOptions.includes(DEFAULT_XP_LAND)) {
                    state.xp.landIndex = String(data.landOptions[0] || DEFAULT_XP_LAND);
                }
            }

            syncAutoFarmFlowerGoals();
            buildSelectors();
            updateUI();
            saveSettingsToStorage();

            addLog(
                `${t('statusRefreshOk')}: ${t('level')} ${data.userInfo?.iLevel ?? '--'}, ${t('gold')} ${data.assetsMap?.['1000001']?.iAmount ?? '--'}, ${t('bloomCoins')} ${data.assetsMap?.['1000002']?.iAmount ?? '--'}`
            );
            if (data.partialErrors?.length) {
                const partialErrorText = data.partialErrors.slice(0, 3).join(' | ');
                const suffix = data.partialErrors.length > 3 ? ` (+${data.partialErrors.length - 3})` : '';
                addLog(logText(
                    `状态刷新部分失败，已保留旧数据：${partialErrorText}${suffix}`,
                    `Status refresh partially failed; kept old data: ${partialErrorText}${suffix}`
                ), 'WARN');
            }
            refreshOk = true;
        } catch (err) {
            addLog(`${t('statusRefreshFail')}: ${err.message}`, 'ERROR');
        } finally {
            state.status.loading = false;
            updateUI();
        }

        return refreshOk;
    };

    const isLikelyNativeGameScene = (value) => {
        return isObjectLike(value)
            && typeof value.currentView === 'string'
            && typeof value.currentPage === 'number'
            && typeof value.getGameOrderSummary === 'function'
            && isObjectLike(value.game)
            && isObjectLike(value.game.GameApi)
            && typeof value.game.GameApi.init === 'function';
    };

    const extractNativeGameScene = (candidate) => {
        if (isLikelyNativeGameScene(candidate)) return candidate;

        const directSceneSets = [
            safeGet(candidate, 'scenes'),
            safeGet(safeGet(candidate, 'scene'), 'scenes'),
            safeGet(safeGet(candidate, 'manager'), 'scenes'),
            safeGet(safeGet(safeGet(candidate, 'scene'), 'manager'), 'scenes'),
            safeGet(safeGet(safeGet(candidate, 'game'), 'scene'), 'scenes'),
        ];

        for (const scenes of directSceneSets) {
            if (!Array.isArray(scenes)) continue;
            const scene = scenes.find(isLikelyNativeGameScene);
            if (scene) return scene;
        }

        const game = safeGet(candidate, 'game');
        if (isObjectLike(game) && isLikelyNativeGameScene(safeGet(game, 'scene'))) {
            return safeGet(game, 'scene');
        }

        return null;
    };

    const getNativeSearchRoots = () => {
        const roots = [window, document, document.body, document.documentElement];

        const domCandidates = [
            document.querySelector('#app'),
            document.querySelector('[data-v-app]'),
            document.querySelector('canvas'),
        ].filter(Boolean);

        for (const node of domCandidates) {
            roots.push(node);
            roots.push(safeGet(node, '__vueParentComponent'));
            roots.push(safeGet(node, '__vue_app__'));
            roots.push(safeGet(node, '__vnode'));
        }

        const vueHook = safeGet(window, '__VUE_DEVTOOLS_GLOBAL_HOOK__');
        if (isObjectLike(vueHook)) {
            roots.push(vueHook);
            const apps = safeGet(vueHook, 'apps');
            if (Array.isArray(apps)) {
                roots.push(...apps);
            } else if (isObjectLike(apps)) {
                roots.push(...Object.values(apps));
            }
        }

        const commonWindowKeys = [
            'game',
            '__game__',
            '__phaserGame__',
            'phaserGame',
            'app',
            '__app__',
            '__vue_app__',
        ];

        for (const key of commonWindowKeys) {
            roots.push(safeGet(window, key));
        }

        return roots.filter(Boolean);
    };

    const getNativeGameScene = () => {
        const now = Date.now();
        if (isLikelyNativeGameScene(nativeUiBridge.scene)) {
            return nativeUiBridge.scene;
        }
        if (now - nativeUiBridge.lookupAt < 1500) {
            return null;
        }

        nativeUiBridge.lookupAt = now;
        nativeUiBridge.scene = null;

        const queue = [];
        const seen = new WeakSet();
        const push = (value) => {
            if (!isObjectLike(value) || seen.has(value)) return;
            seen.add(value);
            queue.push(value);
        };

        const relatedKeys = [
            'game',
            'scene',
            'scenes',
            'manager',
            'sys',
            'events',
            'parent',
            'children',
            'value',
            '_value',
            'ctx',
            'proxy',
            '_instance',
            'setupState',
            'subTree',
            'component',
            'appContext',
            'provides',
            '__vueParentComponent',
            '__vue_app__',
            '__vnode',
        ];

        for (const root of getNativeSearchRoots()) {
            push(root);
        }

        let inspected = 0;
        while (queue.length && inspected < 500) {
            const current = queue.shift();
            inspected += 1;

            const scene = extractNativeGameScene(current);
            if (scene) {
                nativeUiBridge.scene = scene;
                if (!nativeUiBridge.loggedReady) {
                    addLog(logText('脚本已接入前端原生花园刷新', 'Script connected to native garden refresh'));
                    nativeUiBridge.loggedReady = true;
                }
                return scene;
            }

            if (Array.isArray(current)) {
                current.slice(0, 20).forEach(push);
                continue;
            }

            for (const key of relatedKeys) {
                push(safeGet(current, key));
            }

            if (current === window) {
                const keys = Object.getOwnPropertyNames(window);
                for (const key of keys) {
                    if (!key) continue;
                    if (!(key.startsWith('__') || /app|vue|game|scene|phaser/i.test(key))) continue;
                    push(safeGet(window, key));
                }
            }
        }

        if (!nativeUiBridge.loggedMissing) {
            addLog(logText('暂未找到前端原生花园对象，将仅刷新脚本状态', 'Native garden object not found yet; only script status will refresh'), 'WARN');
            nativeUiBridge.loggedMissing = true;
        }
        return null;
    };

    const refreshNativeFrontEnd = async (actionType, landIndex, {
        refreshAssets = false,
        refreshInfoData = false,
        refreshSummary = true,
        refreshGarden = true,
        refreshShop = false,
        refreshBagTypes = [],
        logPrefix = logText('脚本', 'Script'),
    } = {}) => {
        const scene = getNativeGameScene();
        if (!scene) {
            try {
                window.dispatchEvent(new Event('focus'));
                document.dispatchEvent(new Event('visibilitychange'));
            } catch (err) {
                // ignore fallback event errors
            }
            return false;
        }

        try {
            const gameApi = safeGet(scene, 'game.GameApi');
            if (refreshAssets && typeof gameApi?.init === 'function') {
                await Promise.resolve(gameApi.init(true));
            }

            if (refreshInfoData && typeof gameApi?.initBagStoreMissionData === 'function') {
                const infoRes = await Promise.resolve(gameApi.initBagStoreMissionData());
                if (isSuccess(infoRes) && infoRes?.jData && scene.game?.GameData) {
                    scene.game.GameData.infoData = infoRes.jData;
                }
            }

            if (refreshSummary && typeof scene.getGameOrderSummary === 'function') {
                await Promise.resolve(scene.getGameOrderSummary());
            }

            const allInterface = safeGet(scene.game, 'allInterface');
            if (typeof allInterface?.bagInterface === 'function') {
                for (const bagType of refreshBagTypes) {
                    await Promise.resolve(allInterface.bagInterface(bagType));
                }
            }
            if (refreshShop && typeof allInterface?.getShopItems === 'function') {
                await Promise.resolve(allInterface.getShopItems());
            }

            if (refreshGarden && (scene.currentView === 'FarmView' || scene.currentPage === 0) && typeof scene.plantView?.getLandData === 'function') {
                await Promise.resolve(scene.plantView.getLandData());
            } else if (refreshGarden && typeof scene.events?.emit === 'function') {
                await Promise.resolve(scene.events.emit('camera-open', { type: 2, source: 'userscript-sync', actionType, landIndex }));
            }

            return true;
        } catch (err) {
            addLog(logText(`${logPrefix}前端原生刷新失败: ${err.message}`, `${logPrefix} native frontend refresh failed: ${err.message}`), 'WARN');
            return false;
        }
    };

    const waterNativeLand = (landIndex) => {
        const scene = getNativeGameScene();
        if (!scene) return false;
        try {
            const children = scene.plantView?.landGroup?.getChildren?.();
            if (!Array.isArray(children)) return false;
            const idx = Number(landIndex);
            const land = children[idx - 1];
            if (land && typeof land.water === 'function') {
                land.water();
                if (land.growUpInfoConfig && typeof land.showGrowUpInfo === 'function') {
                    const serverTime = scene.game?.GameApi?.serverUnixTime || Math.floor(Date.now() / 1000);
                    land.showGrowUpInfo({
                        plantTime: land.growUpInfoConfig.plantTime,
                        wateringTime: serverTime,
                        remainingTime: land.growUpInfoConfig.remainingTime,
                    });
                }
                return true;
            }
        } catch (err) {
            // ignore
        }
        return false;
    };

    const refreshNativeFrontEndAfterAutoFarm = async (actionType, landIndex, { refreshAssets = false } = {}) => {
        const refreshBagTypes = actionType === 'plant'
            ? [1]
            : actionType === 'harvest'
                ? [2]
                : [];
        const refreshShop = actionType === 'harvest';

        return refreshNativeFrontEnd(actionType, landIndex, {
            refreshAssets,
            refreshSummary: true,
            refreshGarden: actionType !== 'cycle',
            refreshShop,
            refreshBagTypes,
            logPrefix: logText('自动种植', 'Auto Farm'),
        });
    };

    const refreshNativeFrontEndAfterXp = async (actionType, landIndex, {
        refreshAssets = false,
        refreshSummary = false,
        refreshShop = false,
        refreshBagTypes = [],
    } = {}) => refreshNativeFrontEnd(actionType, landIndex, {
        refreshAssets,
        refreshSummary,
        refreshGarden: true,
        refreshShop,
        refreshBagTypes,
        logPrefix: logText('刷经验', 'XP Farm'),
    });

    const refreshNativeFrontEndAfterBuy = async ({ refreshAssets = true } = {}) => refreshNativeFrontEnd('buy', 0, {
        refreshAssets,
        refreshInfoData: true,
        refreshSummary: false,
        refreshGarden: false,
        refreshShop: true,
        refreshBagTypes: [1],
        logPrefix: logText('买种子', 'Buy Seeds'),
    });

    const applySeedPackageInfoToState = (packageInfo) => {
        const normalized = (Array.isArray(packageInfo) ? packageInfo : []).map(item => {
            const id = String(item?.iItemId ?? item?.itemId ?? '').trim();
            return {
                ...item,
                iItemId: id,
                sItemName: String(item?.sItemName ?? item?.itemName ?? state.status.cropMap[id] ?? id).trim(),
                iAmount: Math.max(0, Number(item?.iAmount ?? item?.amount ?? item?.itemCount ?? 0)),
            };
        }).filter(item => item.iItemId);

        state.status.bagSeeds = normalized;

        const ownedMap = new Map(normalized.map(item => [String(item.iItemId), Number(item.iAmount || 0)]));
        for (const list of [state.status.shopSeeds || [], state.status.shopSeedCatalog || []]) {
            for (const seed of list) {
                const seedId = String(seed?.commodityId ?? seed?.iItemId ?? '').trim();
                if (!seedId) continue;
                seed.ownedAmount = ownedMap.get(seedId) ?? 0;
            }
        }

        return normalized;
    };

    const syncNativeSeedBagAfterBuy = async ({ repaintVisibleBag = true } = {}) => {
        const scene = getNativeGameScene();
        const gameApi = safeGet(scene, 'game.GameApi');
        const getPackageItems = safeGet(gameApi, 'getPackageItems');
        if (!scene || typeof getPackageItems !== 'function') {
            return false;
        }

        try {
            const data = await getPackageItems.call(gameApi, 1, '');
            if (!isSuccess(data)) {
                return false;
            }

            const packageInfo = Array.isArray(data?.jData?.packageInfo) ? data.jData.packageInfo : [];
            const bagState = safeGet(scene, 'game.GameData.infoData.bag');
            if (bagState && typeof bagState === 'object') {
                bagState.seeds = packageInfo;
            }

            applySeedPackageInfoToState(packageInfo);

            const bagView = safeGet(scene, 'bagView');
            if (repaintVisibleBag && Number(bagView?.itemType) === 1 && typeof bagView?.fillItems === 'function') {
                bagView.fillItems(packageInfo);
            }

            buildSelectors();
            return true;
        } catch (err) {
            addLog(logText(`买种子前台背包同步失败: ${err.message}`, `Seed bag frontend sync after buy failed: ${err.message}`), 'WARN');
            return false;
        }
    };

    const postNativeSeedBuyTracked = async (cropId, count, actionName) => {
        const scene = getNativeGameScene();
        const gameApi = safeGet(scene, 'game.GameApi');
        const exchangeItem = safeGet(gameApi, 'exchangeItem');
        if (!scene || typeof exchangeItem !== 'function') {
            return { attempted: false, ok: false, data: null, native: false };
        }

        const stats = state.autoBuy.stats;
        if (stats) stats.totalReq++;
        updateUI();

        try {
            const data = await exchangeItem.call(gameApi, String(cropId), String(count));
            const ok = isSuccess(data);

            if (stats) {
                if (ok) stats.successReq++;
                else stats.failReq++;
            }

            if (!ok) {
                addLog(logText(`AUTOBUY ${actionName} 失败 | ${JSON.stringify(data)}`, `AUTOBUY ${actionName} failed | ${JSON.stringify(data)}`), 'ERROR');
            }

            updateUI();
            return { attempted: true, ok, data, native: true };
        } catch (err) {
            const data = isObjectLike(err) ? err : null;
            const ok = isSuccess(data);

            if (stats) {
                if (ok) stats.successReq++;
                else stats.failReq++;
            }

            if (!ok) {
                const detail = data ? JSON.stringify(data) : (err?.message || String(err));
                addLog(logText(`AUTOBUY ${actionName} 失败 | ${detail}`, `AUTOBUY ${actionName} failed | ${detail}`), 'ERROR');
            }

            updateUI();
            return { attempted: true, ok, data, error: err, native: true };
        }
    };

    const isMissionViewLikelyOpen = (scene) => {
        if (!scene) return false;

        const currentPage = Number(safeGet(scene, 'currentPage'));
        const currentView = String(safeGet(scene, 'currentView') || '');
        const historyPages = Array.isArray(safeGet(scene, 'historyPages'))
            ? safeGet(scene, 'historyPages')
            : [];
        const latestHistory = String(historyPages[historyPages.length - 1] || '');

        return currentPage === 3
            || currentView === 'MissionsView'
            || latestHistory === 'MissionsView'
            || safeGet(scene, 'isMessageView') === true;
    };

    const closeNativeMissionWindow = async ({ force = false, logPrefix = logText('刷经验', 'XP Farm') } = {}) => {
        const scene = getNativeGameScene();
        if (!scene) return false;

        if (!force && !isMissionViewLikelyOpen(scene)) {
            return false;
        }

        const payload = {
            viewName: 'MissionsView',
            source: 'userscript-xp',
        };

        try {
            if (typeof scene.events?.emit === 'function') {
                scene.events.emit('close_view', payload);
                addLog(logText(`${logPrefix}：已请求关闭任务窗口`, `${logPrefix}: requested mission window close`));
                return true;
            }

            if (typeof scene.onCloseView === 'function') {
                scene.onCloseView(payload);
                addLog(logText(`${logPrefix}：已直接调用任务窗口关闭逻辑`, `${logPrefix}: called mission window close directly`));
                return true;
            }

            const eventBus = safeGet(window, 'EventBus');
            if (typeof eventBus?.emit === 'function') {
                eventBus.emit('close_view', payload);
                addLog(logText(`${logPrefix}：已通过 EventBus 请求关闭任务窗口`, `${logPrefix}: requested mission window close through EventBus`));
                return true;
            }
        } catch (err) {
            addLog(logText(`${logPrefix}关闭任务窗口失败: ${err.message}`, `${logPrefix} failed to close mission window: ${err.message}`), 'WARN');
        }

        return false;
    };

    const getAssetsNotifyList = (data) => {
        const rawList = data?.jData?.assetsNotify || data?.assetsNotify || [];
        return (Array.isArray(rawList) ? rawList : []).map(item => ({
            iItemId: String(item?.iItemId ?? item?.itemId ?? '').trim(),
            sItemName: String(item?.sItemName ?? item?.itemName ?? '').trim(),
            itemIncr: Number(item?.itemIncr ?? item?.iItemIncr ?? item?.delta ?? 0),
            itemCount: Number(item?.itemCount ?? item?.iAmount ?? item?.amount ?? 0),
        })).filter(item => item.iItemId);
    };

    const applyHarvestAssetsToState = (cropId, data) => {
        const assetsNotify = getAssetsNotifyList(data);
        const learned = learnAutoFarmFlowerMapping(cropId, assetsNotify);

        for (const item of assetsNotify) {
            if (item.itemIncr <= 0) continue;
            if (item.iItemId.startsWith('100') || item.iItemId.startsWith('900')) continue;
            adjustBagFlowerCount(item.iItemId, item.itemIncr, item.sItemName);
        }

        return {
            assetsNotify,
            learnedFlower: learned,
        };
    };

    const postFormTracked = async (url, formData, moduleName, actionName) => {
        let stats = null;
        if (moduleName === 'xp') stats = state.xp.stats;
        if (moduleName === 'autoFarm') stats = state.autoFarm.stats;
        if (moduleName === 'autoBuy') stats = state.autoBuy.stats;

        if (stats) stats.totalReq++;
        updateUI();

        try {
            const data = await requestFormJson({
                url,
                formData,
                label: `${moduleName.toUpperCase()} ${actionName}`,
            });
            const ok = isSuccess(data);

            if (stats) {
                if (ok) stats.successReq++;
                else stats.failReq++;
            }

            if (!ok) {
                addLog(logText(`${moduleName.toUpperCase()} ${actionName} 失败 | ${JSON.stringify(data)}`, `${moduleName.toUpperCase()} ${actionName} failed | ${JSON.stringify(data)}`), 'ERROR');
            }

            updateUI();
            return { ok, data };
        } catch (err) {
            if (stats) stats.failReq++;
            addLog(logText(`${moduleName.toUpperCase()} ${actionName} 异常 | ${err.message}`, `${moduleName.toUpperCase()} ${actionName} error | ${err.message}`), 'ERROR');
            updateUI();
            return { ok: false, data: null, error: err };
        }
    };

    const buySeedOnce = async (commodityId, buyCount, reason = logText('手动购买', 'manual buy')) => {
        const cropId = String(commodityId);
        const count = Number(buyCount);

        let result = await postNativeSeedBuyTracked(cropId, count, `${reason} ${cropId} x${count}`);
        if (!result.attempted) {
            result = await postFormTracked(
                buildApiUrl('shop?a=buy'),
                createFD({ commodityId: cropId, buyCount: String(count) }),
                'autoBuy',
                `${reason} ${cropId} x${count}`
            );
        }

        if (result.ok) {
            state.autoBuy.stats.successActions++;
            state.autoBuy.stats.boughtSeedCount += count;
            state.autoBuy.stats.lastAction = `${reason}: ${cropId} +${count}`;
            adjustBagSeedCount(cropId, count);
            updateKnownSeedOwnedAmount(cropId, getOwnedSeedCount(cropId));
            buildSelectors();
            addLog(logText(`买种子成功：${cropId} x${count}（${reason}）`, `Seed buy succeeded: ${cropId} x${count} (${reason})`));
            await refreshNativeFrontEndAfterBuy({ refreshAssets: true });
            await syncNativeSeedBagAfterBuy();
        } else {
            state.autoBuy.stats.lastAction = logText(`${reason} 失败`, `${reason} failed`);
        }

        updateUI();
        return result.ok;
    };

    const runManualBuy = async () => {
        if (state.autoBuy.isRunning) return;
        if (!applyAutoBuySettings()) return;

        state.autoBuy.isRunning = true;
        els.buyStatus.textContent = t('buyRunning');
        updateUI();

        try {
            for (let i = 1; i <= state.autoBuy.repeatTimes; i++) {
                const ok = await buySeedOnce(
                    state.autoBuy.cropId,
                    state.autoBuy.perBuyCount,
                    logText(`手动购买 第${i}/${state.autoBuy.repeatTimes}次`, `manual buy ${i}/${state.autoBuy.repeatTimes}`)
                );
                if (!ok) break;
                await sleep(300);
            }

            els.buyStatus.textContent = t('buyDone');
        } catch (err) {
            els.buyStatus.textContent = `❌ ${state.ui.lang === 'zh' ? '自动买种子异常' : 'Buy error'}: ${err.message}`;
            addLog(logText(`自动买种子异常: ${err.stack || err.message}`, `Buy seeds error: ${err.stack || err.message}`), 'ERROR');
        } finally {
            state.autoBuy.isRunning = false;
            updateUI();
            await refreshCurrentStatus();
        }
    };

    const ensureSeedStockForAutomation = async (cropId, {
        contextZh = '自动化',
        contextEn = 'Automation',
        reasonZh = '缺种子自动补货',
        reasonEn = 'seed restock',
        buyCount = DEFAULT_BUY_COUNT,
        onTriggered = null,
    } = {}) => {
        const id = String(cropId || '').trim();
        const owned = getOwnedSeedCount(id);
        if (owned >= 1) return true;

        if (typeof onTriggered === 'function') {
            onTriggered();
        }

        const cropLabel = `${getCropDisplayName(id)}(${id})`;
        addLog(logText(
            `${contextZh}检测到种子不足：${cropLabel} 当前 ${owned}，自动购买 ${buyCount} 个`,
            `${contextEn} detected low seed stock: ${cropLabel} current ${owned}, auto-buying ${buyCount}`
        ));

        const ok = await buySeedOnce(
            id,
            buyCount,
            logText(`${reasonZh} x${buyCount}`, `${reasonEn} x${buyCount}`)
        );
        if (!ok) return false;

        return getOwnedSeedCount(id) >= 1;
    };

    const ensureXpSeedStock = async () => {
        return ensureSeedStockForAutomation(state.xp.cropId, {
            contextZh: '刷经验',
            contextEn: 'XP',
            reasonZh: '刷经验缺种子自动补货',
            reasonEn: 'XP seed restock',
            buyCount: DEFAULT_BUY_COUNT,
            onTriggered: () => {
                state.xp.stats.autoBuyTriggered++;
            },
        });
    };

    const runXpAutomation = async () => {
        if (state.xp.isRunning) return;
        if (!applyXpSettings()) return;

        els.xpStatus.textContent = state.ui.lang === 'zh' ? '🔄 刷经验启动前刷新任务进度...' : '🔄 Refreshing quest progress...';
        updateUI();

        try {
            const firstRoundInfo = await fetchXpMissionProgress(state.xp.missionId);
            state.xp.firstRoundSteps = firstRoundInfo.remainingPlantTimes;
            addLog(
                logText(
                    `刷经验任务刷新：${firstRoundInfo.missionId} ${firstRoundInfo.currentProgress}/${firstRoundInfo.totalProgress}，首轮需执行 ${state.xp.firstRoundSteps} 次`,
                    `XP quest refreshed: ${firstRoundInfo.missionId} ${firstRoundInfo.currentProgress}/${firstRoundInfo.totalProgress}, first round needs ${state.xp.firstRoundSteps} steps`
                )
            );
            buildSelectors();
            updateUI();
        } catch (err) {
            state.xp.firstRoundSteps = FIXED_STEPS_PER_ROUND;
            els.xpStatus.textContent = logText(`⚠️ 启动前任务刷新失败，按固定 ${FIXED_STEPS_PER_ROUND} 步继续`, `⚠️ Quest refresh failed before start, continuing with fixed ${FIXED_STEPS_PER_ROUND} steps`);
            addLog(logText(`刷经验启动前任务刷新失败: ${err.message}，改按固定 ${FIXED_STEPS_PER_ROUND} 步继续`, `XP quest refresh before start failed: ${err.message}; continuing with fixed ${FIXED_STEPS_PER_ROUND} steps`), 'WARN');
            updateUI();
        }

        state.xp.stopped = false;
        state.xp.isRunning = true;
        resetXpStats();
        if (state.xp.timerMode === 'countup') {
            state.xp.stopAtTs = resolveXpStopAtTs();
            addLog(logText(`刷经验正计时到点停止时间：${new Date(state.xp.stopAtTs).toLocaleString()}`, `XP count-up stop time: ${new Date(state.xp.stopAtTs).toLocaleString()}`));
        } else {
            state.xp.stopAtTs = 0;
        }
        setXpRunningUI(true);
        const startPolicy = [];
        if (state.xp.timerMode === 'always') {
            startPolicy.push(t('alwaysRunLabel'));
        }
        if (state.xp.timerMode === 'countdown') {
            startPolicy.push(`${t('modeCountdown')} ${state.xp.countdownDays}d ${state.xp.countdownHours}h ${state.xp.countdownMinutes}m`);
        }
        if (state.xp.timerMode === 'countup') {
            startPolicy.push(`${t('modeCountup')} ${String(state.xp.stopHour).padStart(2, '0')}:${String(state.xp.stopMinute).padStart(2, '0')}`);
        }
        els.xpStatus.textContent = logText(`🚀 开始刷经验：${startPolicy.join(' + ') || '未配置停止条件'}，首轮步数 ${state.xp.firstRoundSteps}`, `🚀 XP started: ${startPolicy.join(' + ') || 'no stop condition'}, first round steps ${state.xp.firstRoundSteps}`);
        addLog(
            logText(
                `刷经验开始运行：mode=${state.xp.timerMode}, policy=${startPolicy.join(' + ') || 'none'}, 首轮步数=${state.xp.firstRoundSteps}, 后续固定步数=${FIXED_STEPS_PER_ROUND}, 地块=${state.xp.landIndex}, 种子=${state.xp.cropId}, 任务=${state.xp.missionId}`,
                `XP started: mode=${state.xp.timerMode}, policy=${startPolicy.join(' + ') || 'none'}, firstRoundSteps=${state.xp.firstRoundSteps}, laterFixedSteps=${FIXED_STEPS_PER_ROUND}, land=${state.xp.landIndex}, seed=${state.xp.cropId}, quest=${state.xp.missionId}`
            )
        );
        updateUI();

        let stoppedByTimerReason = '';
        let round = 0;
        try {
            while (!state.xp.stopped) {
                const outerStopReason = getXpTimerStopReason();
                if (outerStopReason) {
                    stoppedByTimerReason = outerStopReason;
                    break;
                }

                round += 1;
                const stepsThisRound = round === 1 ? state.xp.firstRoundSteps : FIXED_STEPS_PER_ROUND;
                let roundHadStepFailure = false;
                state.xp.stats.currentRound = round;
                state.xp.stats.currentStep = 0;
                state.xp.stats.currentRoundStepTarget = stepsThisRound;
                state.xp.stats.currentRoundFinishedOperations = 0;
                els.xpStatus.textContent = state.ui.lang === 'zh' ? `🟢 刷经验 第 ${round} 轮开始（步数 ${stepsThisRound}）` : `🟢 XP Round ${round} (${stepsThisRound} steps)`;
                updateUI();

                if (stepsThisRound === 0) {
                    els.xpStatus.textContent = logText(`[XP Round ${round}] 首轮进度已满，直接提交任务`, `[XP Round ${round}] First-round progress is full, submitting quest`);
                    addLog(logText(`XP Round ${round}: 当前任务进度已满，跳过种植/铲除，直接提交`, `XP Round ${round}: quest progress is full, skip plant/remove and submit`));
                    updateUI();
                }

                for (let i = 1; i <= stepsThisRound; i++) {
                    if (state.xp.stopped) break;
                    const stepStartStopReason = getXpTimerStopReason();
                    if (stepStartStopReason) {
                        stoppedByTimerReason = stepStartStopReason;
                        break;
                    }

                    state.xp.stats.currentStep = i;
                    updateUI();

                    const enoughSeeds = await ensureXpSeedStock();
                    if (!enoughSeeds) {
                        roundHadStepFailure = true;
                        els.xpStatus.textContent = `[XP R${round}] ${i}/${stepsThisRound} - ${state.ui.lang === 'zh' ? '种子不足' : 'No seeds'}`;
                        addLog(logText(`XP Round ${round} Step ${i}: 种子不足且自动购买失败，本步跳过`, `XP Round ${round} Step ${i}: not enough seeds and auto-buy failed; skipped`), 'WARN');
                        updateUI();
                        await xpSleepRandom();
                        continue;
                    }

                    els.xpStatus.textContent = `[XP R${round}] ${i}/${stepsThisRound} - 🌱 ${state.ui.lang === 'zh' ? '种植中' : 'Planting'}`;
                    let plantResult = await postFormTracked(
                        buildApiUrl('farm?a=plant'),
                        createFD({ landIndex: state.xp.landIndex, cropId: state.xp.cropId }),
                        'xp',
                        logText(`种植 [Round ${round} Step ${i}]`, `plant [Round ${round} Step ${i}]`)
                    );
                    let plantOk = plantResult.ok;

                    if (!plantOk && isNotNeeded(plantResult.data)) {
                        addLog(logText(`XP Round ${round} Step ${i}: 地块可能未清空，先消除再重试种植`, `XP Round ${round} Step ${i}: land may not be empty, removing before plant retry`), 'WARN');
                        const preClearResult = await postFormTracked(
                            buildApiUrl('farm?a=eliminate'),
                            createFD({ landIndex: state.xp.landIndex }),
                            'xp',
                            logText(`预清空 [Round ${round} Step ${i}]`, `pre-clear [Round ${round} Step ${i}]`)
                        );
                        if (preClearResult.ok) {
                            state.xp.stats.eliminateOk++;
                            addLog(logText(`XP Round ${round} Step ${i}: 预清空成功`, `XP Round ${round} Step ${i}: pre-clear succeeded`));
                            await refreshNativeFrontEndAfterXp('eliminate', state.xp.landIndex);
                        }
                        await sleep(150);
                        plantResult = await postFormTracked(
                            buildApiUrl('farm?a=plant'),
                            createFD({ landIndex: state.xp.landIndex, cropId: state.xp.cropId }),
                            'xp',
                            logText(`种植重试 [Round ${round} Step ${i}]`, `plant retry [Round ${round} Step ${i}]`)
                        );
                        plantOk = plantResult.ok;
                    } else if (!plantOk && plantResult?.error) {
                        await sleep(250);
                        plantResult = await postFormTracked(
                            buildApiUrl('farm?a=plant'),
                            createFD({ landIndex: state.xp.landIndex, cropId: state.xp.cropId }),
                            'xp',
                            logText(`种植重试 [Round ${round} Step ${i}]`, `plant retry [Round ${round} Step ${i}]`)
                        );
                        plantOk = plantResult.ok;
                    }

                    if (plantOk) {
                        state.xp.stats.plantOk++;
                        adjustBagSeedCount(state.xp.cropId, -1);
                        addLog(logText(`XP Round ${round} Step ${i}: 种植成功`, `XP Round ${round} Step ${i}: plant succeeded`));
                        await refreshNativeFrontEndAfterXp('plant', state.xp.landIndex, {
                            refreshBagTypes: [1],
                        });
                    } else {
                        roundHadStepFailure = true;
                        addLog(logText(`XP Round ${round} Step ${i}: 种植未成功，本步可能不计任务进度`, `XP Round ${round} Step ${i}: plant did not succeed, this step may not count`), 'WARN');
                    }
                    state.xp.stats.finishedOperations++;
                    state.xp.stats.currentRoundFinishedOperations++;
                    updateUI();

                    await xpSleepRandom();
                    const afterPlantStopReason = getXpTimerStopReason();
                    if (afterPlantStopReason) {
                        stoppedByTimerReason = afterPlantStopReason;
                        break;
                    }

                    els.xpStatus.textContent = `[XP R${round}] ${i}/${stepsThisRound} - 🪓 ${state.ui.lang === 'zh' ? '消除中' : 'Removing'}`;
                    const eliminateResult = await postFormTracked(
                        buildApiUrl('farm?a=eliminate'),
                        createFD({ landIndex: state.xp.landIndex }),
                        'xp',
                        logText(`消除 [Round ${round} Step ${i}]`, `remove [Round ${round} Step ${i}]`)
                    );
                    if (eliminateResult.ok) {
                        state.xp.stats.eliminateOk++;
                        addLog(logText(`XP Round ${round} Step ${i}: 铲除成功`, `XP Round ${round} Step ${i}: remove succeeded`));
                        await refreshNativeFrontEndAfterXp('eliminate', state.xp.landIndex);
                    } else {
                        roundHadStepFailure = true;
                    }
                    state.xp.stats.finishedOperations++;
                    state.xp.stats.currentRoundFinishedOperations++;
                    updateUI();

                    await xpSleepRandom();
                }

                if (state.xp.stopped || stoppedByTimerReason) break;

                const missionReadyState = await waitXpMissionReadyForSubmit(round, 3);
                if (!missionReadyState.ready) {
                    const progressLabel = missionReadyState.info
                        ? `${missionReadyState.info.currentProgress}/${missionReadyState.info.totalProgress}`
                        : t('pendingLearn');
                    els.xpStatus.textContent = logText(`[XP Round ${round}] 任务未满(${progressLabel})，跳过提交`, `[XP Round ${round}] Quest not ready (${progressLabel}), skipping submit`);
                    if (roundHadStepFailure) {
                        addLog(logText(`XP Round ${round}: 本轮存在步骤失败，提交前任务仍未满(${progressLabel})`, `XP Round ${round}: this round had step failures and quest is still not ready before submit (${progressLabel})`), 'WARN');
                    } else {
                        addLog(logText(`XP Round ${round}: 任务未满(${progressLabel})，直接进入下一轮`, `XP Round ${round}: quest not ready (${progressLabel}), going to next round`), 'WARN');
                    }
                    updateUI();
                    await xpSleepRandom();
                    continue;
                }

                els.xpStatus.textContent = `[XP R${round}] 🏁 ${state.ui.lang === 'zh' ? '提交任务中' : 'Submitting'}`;
                const missionResult = await postFormTracked(
                    buildApiUrl('mission?a=missionSubmit'),
                    createFD({ missionType: "1", missionId: state.xp.missionId }),
                    'xp',
                    logText(`任务提交 [Round ${round}]`, `quest submit [Round ${round}]`)
                );

                if (missionResult?.ok) {
                    state.xp.stats.missionOk++;
                    addLog(logText(`XP Round ${round}: 任务提交成功`, `XP Round ${round}: quest submitted`));
                    const missionViewClosed = await closeNativeMissionWindow({ logPrefix: logText('刷经验', 'XP Farm') });
                    if (missionViewClosed) {
                        await sleep(150);
                    }
                    await refreshNativeFrontEndAfterXp('missionSubmit', state.xp.landIndex, {
                        refreshAssets: true,
                        refreshSummary: true,
                        refreshShop: true,
                        refreshBagTypes: [1, 2],
                    });
                    await sleep(250);
                    try {
                        const summaryState = await refreshXpSummaryState();
                        const nextInfo = await fetchXpMissionProgress(state.xp.missionId);
                        addLog(
                            logText(
                                `XP Round ${round}: 提交后任务进度 ${nextInfo.currentProgress}/${nextInfo.totalProgress}，循环任务=${summaryState.repeatMissionId || '--'} ${summaryState.repeatMissionProgress || 0}/${summaryState.repeatMissionTarget || '--'}`,
                                `XP Round ${round}: quest progress after submit ${nextInfo.currentProgress}/${nextInfo.totalProgress}, repeat=${summaryState.repeatMissionId || '--'} ${summaryState.repeatMissionProgress || 0}/${summaryState.repeatMissionTarget || '--'}`
                            )
                        );
                    } catch (err) {
                        addLog(logText(`XP Round ${round}: 提交后刷新任务状态失败: ${err.message}`, `XP Round ${round}: failed to refresh quest status after submit: ${err.message}`), 'WARN');
                    }
                } else {
                    const code = getRetCode(missionResult.data);
                    addLog(logText(`XP Round ${round}: 任务提交失败(code=${Number.isFinite(code) ? code : 'unknown'})，不重试，直接继续下一轮`, `XP Round ${round}: quest submit failed (code=${Number.isFinite(code) ? code : 'unknown'}), no retry, continuing next round`), 'WARN');
                    try {
                        await refreshNativeFrontEndAfterXp('missionSubmit', state.xp.landIndex, {
                            refreshSummary: true,
                        });
                        await sleep(250);
                        const summaryState = await refreshXpSummaryState();
                        const missionInfo = await fetchXpMissionProgress(state.xp.missionId);
                        addLog(
                            logText(
                                `XP Round ${round}: 提交失败后任务进度 ${missionInfo.currentProgress}/${missionInfo.totalProgress}，循环任务=${summaryState.repeatMissionId || '--'} ${summaryState.repeatMissionProgress || 0}/${summaryState.repeatMissionTarget || '--'}`,
                                `XP Round ${round}: quest progress after submit failure ${missionInfo.currentProgress}/${missionInfo.totalProgress}, repeat=${summaryState.repeatMissionId || '--'} ${summaryState.repeatMissionProgress || 0}/${summaryState.repeatMissionTarget || '--'}`
                            ),
                            'WARN'
                        );
                    } catch (err) {
                        addLog(logText(`XP Round ${round}: 提交失败后刷新任务状态失败: ${err.message}`, `XP Round ${round}: failed to refresh quest status after submit failure: ${err.message}`), 'WARN');
                    }
                    if (roundHadStepFailure) {
                        addLog(logText(`XP Round ${round}: 本轮存在步骤失败，任务提交失败可能是前序步骤未完全计入`, `XP Round ${round}: this round had step failures; submit may have failed because earlier steps did not count`), 'WARN');
                    }
                }
                state.xp.stats.finishedOperations++;
                state.xp.stats.currentRoundFinishedOperations++;
                updateUI();

                await xpSleepRandom();
            }

            if (state.xp.stopped) {
                els.xpStatus.textContent = t('xpStopped');
                addLog(logText('刷经验已由用户停止', 'XP stopped by user'), 'WARN');
            } else if (stoppedByTimerReason) {
                els.xpStatus.textContent = state.ui.lang === 'zh' ? '⏱️ 计时条件达到，已停止' : '⏱️ Timer reached, stopped';
                addLog(logText('刷经验已按计时条件自动停止', 'XP auto-stopped by timer'));
            } else {
                els.xpStatus.textContent = state.ui.lang === 'zh' ? '✅ 刷经验循环结束' : '✅ XP cycle done';
                addLog(logText('刷经验循环结束', 'XP cycle finished'));
            }
        } catch (err) {
            if (String(err?.message || '').includes('用户停止刷经验脚本')) {
                els.xpStatus.textContent = t('xpStopped');
                addLog(logText('刷经验已由用户停止', 'XP stopped by user'), 'WARN');
            } else {
                els.xpStatus.textContent = logText(`❌ 刷经验异常停止: ${err.message}`, `❌ XP stopped by error: ${err.message}`);
                addLog(logText(`刷经验异常: ${err.stack || err.message}`, `XP error: ${err.stack || err.message}`), 'ERROR');
            }
        } finally {
            state.xp.stopped = true;
            state.xp.isRunning = false;
            state.xp.stats.stopTime = Date.now();
            setXpRunningUI(false);
            els.xpWaiting.textContent = '0ms';
            updateUI();
            await refreshCurrentStatus();
        }
    };

    const calcLandFields = (land) => {
        const { cropId, plantTime, wateringTime, cropDetail } = land;
        const growTime = Number(cropDetail?.growTime ?? 0);
        const matureAt = Number(plantTime ?? 0) + growTime;
        const ts = nowSec();
        const isMature = Number(cropId) !== 0 && ts >= matureAt;
        const elapsed = Math.min(ts, matureAt) - Number(wateringTime ?? 0);
        const needsWater = Number(cropId) !== 0 && elapsed >= state.autoFarm.waterThreshold;
        return { growTime, matureAt, isMature, elapsed, needsWater };
    };

    const fetchFarmInit = async () => {
        return requestFormJson({
            path: 'init?a=farm',
            fields: { region: 'am', nickName: '' },
            label: 'API init?a=farm',
        });
    };

    const runAutoFarmOnce = async ({ fromScheduler = false } = {}) => {
        if (state.autoFarm.isRunning) {
            addLog(logText('自动种植已有任务在跑，本次跳过', 'Auto farm is already running; skipped this run'), 'WARN');
            return;
        }

        if (!applyAutoFarmSettings()) {
            if (fromScheduler && state.autoFarm.schedulerEnabled) {
                state.autoFarm.schedulerEnabled = false;
                clearAutoFarmTimer();
                setSchedulerUI(false);
                els.afStatus.textContent = logText('自动种植设置无效，定时器已停止', 'Auto farm settings invalid; scheduler stopped');
                addLog(logText('自动种植定时运行前设置校验失败，已停止定时器', 'Auto farm scheduled run settings validation failed; scheduler stopped'), 'ERROR');
                updateUI();
            }
            return;
        }

        state.autoFarm.isRunning = true;
        state.autoFarm.stopped = false;
        state.autoFarm.stats.lastStartTime = Date.now();
        state.autoFarm.stats.cycleCount += 1;
        els.afStatus.textContent = fromScheduler ? t('afScheduledRun') : t('afRunning');
        updateUI();

        try {
            assertAutoFarmNotStopped();
            const initRes = await fetchFarmInit();
            assertAutoFarmNotStopped();
            state.autoFarm.waterThreshold = Number(initRes?.jData?.gameConfig?.farmEnterWaterDeficitCountdown ?? 900);
            addLog(logText(`自动种植启动，浇水阈值 = ${state.autoFarm.waterThreshold}s`, `Auto farm started, water threshold = ${state.autoFarm.waterThreshold}s`));
            updateUI();

            const { garden } = await fetchGarden();
            assertAutoFarmNotStopped();
            const workingGarden = garden.map(land => ({
                ...land,
                cropDetail: land?.cropDetail ? { ...land.cropDetail } : null,
            }));
            addLog(logText(`自动种植读取到 ${workingGarden.length} 个地块`, `Auto farm loaded ${workingGarden.length} lands`));
            const selectedLandSet = new Set((state.autoFarm.selectedLands || []).map(String));
            let shouldRefreshNativeAssets = false;

            for (const land of workingGarden) {
                assertAutoFarmNotStopped();
                const idx = String(land.landIndex);
                const cropId = Number(land.cropId ?? 0);
                const cropName = cropId === 0 ? t('empty') : getCropDisplayName(cropId);
                const fields = calcLandFields(land);

                if (!selectedLandSet.has(idx)) {
                    state.autoFarm.stats.skipped++;
                    addLog(logText(`       地块 ${idx} 未勾选，跳过`, `       Land ${idx} not selected, skipped`));
                    continue;
                }

                if (cropId === 0) {
                    const plantCropId = getAutoFarmPlantCropId(workingGarden);
                    if (!plantCropId) {
                        state.autoFarm.stats.skipped++;
                        addLog(logText(`自动种植：地块 ${idx} 已空置，鲜花目标已完成，不再补种`, `Auto farm: land ${idx} is empty and flower goals are done; not replanting`));
                        continue;
                    }

                    const enoughSeeds = await ensureSeedStockForAutomation(plantCropId, {
                        contextZh: '自动种植',
                        contextEn: 'Auto farm',
                        reasonZh: '自动种植缺种子自动补货',
                        reasonEn: 'Auto farm seed restock',
                        buyCount: DEFAULT_BUY_COUNT,
                    });
                    if (!enoughSeeds) {
                        state.autoFarm.stats.skipped++;
                        addLog(logText(
                            `自动种植：地块 ${idx} ${getCropDisplayName(plantCropId)} 种子不足且自动购买失败，跳过`,
                            `Auto farm: land ${idx} ${getCropDisplayName(plantCropId)} has no seeds and auto-buy failed; skipped`
                        ), 'WARN');
                        continue;
                    }
                    assertAutoFarmNotStopped();

                    const plantResult = await postFormTracked(
                        buildApiUrl('farm?a=plant'),
                        createFD({ landIndex: idx, cropId: plantCropId }),
                        'autoFarm',
                        logText(`地块 ${idx} 种植 ${plantCropId}`, `land ${idx} plant ${plantCropId}`)
                    );
                    if (plantResult.ok) {
                        const seedInfo = getCropSeedInfo(plantCropId);
                        state.autoFarm.stats.plantOk++;
                        adjustBagSeedCount(plantCropId, -1);
                        land.cropId = Number(plantCropId);
                        land.cropDetail = {
                            ...(land.cropDetail || {}),
                            sName: getCropRawName(plantCropId),
                            growTime: Number(seedInfo?.growDuration ?? 0),
                        };
                        land.plantTime = nowSec();
                        land.wateringTime = nowSec();
                        addLog(logText(`自动种植：地块 ${idx} 已种植 ${getCropDisplayName(plantCropId)}`, `Auto farm: land ${idx} planted ${getCropDisplayName(plantCropId)}`));
                        await refreshNativeFrontEndAfterAutoFarm('plant', idx);
                    }
                    await afSleepRandom(`地块 ${idx} 种植后`);
                    continue;
                }

                if (fields.isMature) {
                    const harvestResult = await postFormTracked(
                        buildApiUrl('farm?a=harvest'),
                        createFD({ landIndexs: idx }),
                        'autoFarm',
                        logText(`地块 ${idx} 收获`, `land ${idx} harvest`)
                    );
                    if (harvestResult.ok) {
                        const harvestState = applyHarvestAssetsToState(String(cropId), harvestResult.data);
                        state.autoFarm.stats.harvestOk++;
                        addLog(logText(`自动种植：地块 ${idx} 已收获`, `Auto farm: land ${idx} harvested`));
                        if (harvestState.learnedFlower?.flowerId) {
                            addLog(logText(
                                `自动种植：已识别 ${getCropDisplayName(cropId)} -> ${getFlowerDisplayName(harvestState.learnedFlower.flowerId, harvestState.learnedFlower.flowerName || harvestState.learnedFlower.flowerId)}`,
                                `Auto farm: identified ${getCropDisplayName(cropId)} -> ${getFlowerDisplayName(harvestState.learnedFlower.flowerId, harvestState.learnedFlower.flowerName || harvestState.learnedFlower.flowerId)}`
                            ));
                        }
                        shouldRefreshNativeAssets = true;
                        land.cropId = 0;
                        land.cropDetail = null;
                        land.plantTime = 0;
                        land.wateringTime = nowSec();
                        await refreshNativeFrontEndAfterAutoFarm('harvest', idx);
                    } else if (isNotNeeded(harvestResult.data)) {
                        addLog(logText(`自动种植：地块 ${idx} 收获被服务器判定为不需要`, `Auto farm: land ${idx} harvest marked not needed by server`), 'WARN');
                        await afSleepRandom(`地块 ${idx} 收获后`);
                        continue;
                    } else {
                        await afSleepRandom(`地块 ${idx} 收获后`);
                        continue;
                    }
                    await afSleepRandom(`地块 ${idx} 收获后`);
                    assertAutoFarmNotStopped();

                    const replantCropId = getAutoFarmPlantCropId(workingGarden);
                    if (!replantCropId) {
                        state.autoFarm.stats.skipped++;
                        addLog(logText(`自动种植：地块 ${idx} 收获后目标已完成，不再补种`, `Auto farm: land ${idx} goals are done after harvest; not replanting`));
                        continue;
                    }

                    const enoughSeeds = await ensureSeedStockForAutomation(replantCropId, {
                        contextZh: '自动种植',
                        contextEn: 'Auto farm',
                        reasonZh: '自动种植缺种子自动补货',
                        reasonEn: 'Auto farm seed restock',
                        buyCount: DEFAULT_BUY_COUNT,
                    });
                    if (!enoughSeeds) {
                        state.autoFarm.stats.skipped++;
                        addLog(logText(
                            `自动种植：地块 ${idx} 收获后补种 ${getCropDisplayName(replantCropId)} 时种子不足且自动购买失败，跳过`,
                            `Auto farm: land ${idx} replant ${getCropDisplayName(replantCropId)} has no seeds and auto-buy failed; skipped`
                        ), 'WARN');
                        continue;
                    }
                    assertAutoFarmNotStopped();

                    const replantResult = await postFormTracked(
                        buildApiUrl('farm?a=plant'),
                        createFD({ landIndex: idx, cropId: replantCropId }),
                        'autoFarm',
                        logText(`地块 ${idx} 收获后补种 ${replantCropId}`, `land ${idx} replant after harvest ${replantCropId}`)
                    );
                    if (replantResult.ok) {
                        const seedInfo = getCropSeedInfo(replantCropId);
                        state.autoFarm.stats.plantOk++;
                        adjustBagSeedCount(replantCropId, -1);
                        land.cropId = Number(replantCropId);
                        land.cropDetail = {
                            ...(land.cropDetail || {}),
                            sName: getCropRawName(replantCropId),
                            growTime: Number(seedInfo?.growDuration ?? 0),
                        };
                        land.plantTime = nowSec();
                        land.wateringTime = nowSec();
                        addLog(logText(`自动种植：地块 ${idx} 收获后已补种 ${getCropDisplayName(replantCropId)}`, `Auto farm: land ${idx} replanted ${getCropDisplayName(replantCropId)} after harvest`));
                        await refreshNativeFrontEndAfterAutoFarm('plant', idx);
                    }
                    await afSleepRandom(`地块 ${idx} 补种后`);
                    continue;
                }

                assertAutoFarmNotStopped();
                if (fields.needsWater) {
                    const waterResult = await postFormTracked(
                        buildApiUrl('farm?a=water'),
                        createFD({ landIndex: idx }),
                        'autoFarm',
                        logText(`地块 ${idx} 浇水`, `land ${idx} water`)
                    );
                    if (waterResult.ok) {
                        state.autoFarm.stats.waterOk++;
                        addLog(logText(`自动种植：地块 ${idx} 已浇水`, `Auto farm: land ${idx} watered`));
                        shouldRefreshNativeAssets = true;
                                waterNativeLand(idx);
                                await refreshNativeFrontEndAfterAutoFarm('water', idx, { refreshAssets: true });
                    } else if (isNotNeeded(waterResult.data)) {
                        addLog(logText(`自动种植：地块 ${idx} 被服务器判定暂时不需浇水`, `Auto farm: land ${idx} server says water is not needed yet`), 'WARN');
                    }
                    await afSleepRandom(`地块 ${idx} 浇水后`);
                    continue;
                }

                state.autoFarm.stats.skipped++;
                addLog(logText(`自动种植：地块 ${idx} (${cropName}) 暂不需要处理，跳过`, `Auto farm: land ${idx} (${cropName}) needs no action, skipped`));
            }

            assertAutoFarmNotStopped();
            if (state.autoFarm.goalModeEnabled && !getNextAutoFarmGoal(workingGarden)) {
                addLog(logText('自动种植：鲜花目标已全部完成', 'Auto farm: all flower goals are done'));
            }

            if (shouldRefreshNativeAssets) {
                await refreshNativeFrontEndAfterAutoFarm('cycle', 'all', { refreshAssets: true });
            }

            els.afStatus.textContent = t('afDone');
            addLog(logText('自动种植本轮执行完成', 'Auto farm cycle complete'));
        } catch (err) {
            if (isAutoFarmStopError(err)) {
                els.afStatus.textContent = logText('自动种植已停止', 'Auto farm stopped');
                addLog(logText('自动种植已由用户停止', 'Auto farm stopped by user'), 'WARN');
            } else {
                els.afStatus.textContent = `❌ ${state.ui.lang === 'zh' ? '自动种植异常' : 'Farm error'}: ${err.message}`;
                addLog(logText(`自动种植异常: ${err.stack || err.message}`, `Auto farm error: ${err.stack || err.message}`), 'ERROR');
            }
        } finally {
            state.autoFarm.isRunning = false;
            state.autoFarm.stopped = true;
            state.autoFarm.stats.lastFinishTime = Date.now();
            state.autoFarm.stats.lastDurationMs = state.autoFarm.stats.lastFinishTime - state.autoFarm.stats.lastStartTime;
            updateUI();
            await refreshCurrentStatus();

            if (state.autoFarm.schedulerEnabled) {
                scheduleNextAutoFarm();
            }
        }
    };

    const clearAutoFarmTimer = () => {
        if (state.autoFarm.timerId) {
            clearTimeout(state.autoFarm.timerId);
            state.autoFarm.timerId = null;
        }
        state.autoFarm.nextRunAt = 0;
    };

    const scheduleNextAutoFarm = () => {
        clearAutoFarmTimer();
        if (!state.autoFarm.schedulerEnabled) return;

        const delayMs = state.autoFarm.intervalMin * 60 * 1000;
        state.autoFarm.nextRunAt = Date.now() + delayMs;
        els.afStatus.textContent = `${t('afScheduled')}, ${state.autoFarm.intervalMin}${t('afMinLater')}`;
        addLog(logText(`自动种植已安排下次运行：${state.autoFarm.intervalMin} 分钟后`, `Auto farm next run scheduled in ${state.autoFarm.intervalMin} min`));
        updateUI();

        state.autoFarm.timerId = setTimeout(async () => {
            state.autoFarm.timerId = null;
            state.autoFarm.nextRunAt = 0;
            await runAutoFarmOnce({ fromScheduler: true });
        }, delayMs);
    };

    const startAutoFarmScheduler = async () => {
        if (state.autoFarm.schedulerEnabled) return;

        if (!applyAutoFarmSettings()) return;
        state.autoFarm.schedulerEnabled = true;
        setSchedulerUI(true);
        els.afStatus.textContent = t('afSchedulerOn');
        addLog(logText(`自动种植定时器开启，检查间隔 ${state.autoFarm.intervalMin} 分钟`, `Auto farm scheduler started, check interval ${state.autoFarm.intervalMin} min`));
        updateUI();

        await runAutoFarmOnce({ fromScheduler: true });
    };

    const stopAutoFarmScheduler = () => {
        state.autoFarm.schedulerEnabled = false;
        state.autoFarm.stopped = true;
        clearAutoFarmTimer();
        setSchedulerUI(false);
        els.afStatus.textContent = state.autoFarm.isRunning
            ? logText('自动种植正在停止...', 'Auto farm stopping...')
            : t('afSchedulerOff');
        addLog(logText('自动种植定时器已停止', 'Auto farm scheduler stopped'), 'WARN');
        updateUI();
    };

    const refreshElsRefs = () => {
        Object.assign(els, collectEls());
    };

    const wireEvents = () => {
        const onXpModeChange = () => {
            const mode = els.xpModeCountdown?.checked
                ? 'countdown'
                : els.xpModeCountup?.checked
                    ? 'countup'
                    : els.xpModeAlways?.checked
                        ? 'always'
                        : DEFAULT_XP_TIMER_MODE;
            state.xp.timerMode = mode;
            saveSettingsToStorage();
            updateUI();
        };

        els.langToggleBtn.onclick = () => {
            state.ui.lang = state.ui.lang === 'zh' ? 'en' : 'zh';
            markStatusTablesDirty();
            saveSettingsToStorage();
            rebuildFullUI();
        };
        const applyApiRegionChoice = async (region, customUrl = state.ui.apiCustomBaseUrl) => {
            if (isApiSettingsLocked()) {
                addLog(t('apiSettingsLocked'), 'WARN');
                updateSettingsUI();
                return false;
            }

            const normalizedRegion = normalizeApiRegion(region, DEFAULT_API_REGION);
            const normalizedCustomUrl = normalizeApiBaseUrl(customUrl);
            if (normalizedRegion === CUSTOM_API_REGION && !normalizedCustomUrl) {
                addLog(t('apiInvalidCustomUrl'), 'ERROR');
                updateSettingsUI();
                return false;
            }

            state.ui.apiRegion = normalizedRegion;
            if (customUrl !== undefined) {
                state.ui.apiCustomBaseUrl = normalizedCustomUrl || String(customUrl || '').trim();
            }
            markStatusTablesDirty();
            saveSettingsToStorage();
            updateUI();
            addLog(`${t('apiRegionSet')}: ${getApiRegionDisplay()}`);
            await refreshCurrentStatus();
            return true;
        };

        els.apiRegionOptionWrap?.addEventListener('click', async (event) => {
            const button = event.target?.closest?.('[data-api-region]');
            if (!button) return;
            await applyApiRegionChoice(button.dataset.apiRegion, els.apiCustomUrl?.value);
        });
        els.apiCustomApplyBtn?.addEventListener('click', async () => {
            await applyApiRegionChoice(CUSTOM_API_REGION, els.apiCustomUrl?.value);
        });
        els.apiCustomUrl?.addEventListener('change', () => {
            const raw = String(els.apiCustomUrl.value || '').trim();
            state.ui.apiCustomBaseUrl = normalizeApiBaseUrl(raw) || raw;
            saveSettingsToStorage();
            updateSettingsUI();
        });
        els.hideBtn.onclick = hidePanel;
        els.resetDefaultsBtn.onclick = restoreDefaultSettings;
        els.toggle.onclick = (event) => {
            if (uiRuntime.toggleDragSuppressClick) {
                event.preventDefault();
                uiRuntime.toggleDragSuppressClick = false;
                return;
            }
            showPanel();
        };
        bindToggleDrag();
        els.tabStatusBtn.onclick = () => { setActiveTab('status'); saveSettingsToStorage(); };
        els.tabXpBtn.onclick = () => { setActiveTab('xp'); saveSettingsToStorage(); };
        els.tabBuyBtn.onclick = () => { setActiveTab('buy'); saveSettingsToStorage(); };
        els.tabAutoFarmBtn.onclick = () => { setActiveTab('autofarm'); saveSettingsToStorage(); };
        els.tabMissionsBtn.onclick = () => { setActiveTab('missions'); saveSettingsToStorage(); };
        els.tabSettingsBtn.onclick = () => { setActiveTab('settings'); saveSettingsToStorage(); };
        els.panelOpacityRange?.addEventListener('input', () => {
            state.ui.panelOpacity = normalizePanelOpacity(Number(els.panelOpacityRange.value) / 100, DEFAULT_PANEL_OPACITY);
            applyPanelOpacityUI();
        });
        els.panelOpacityRange?.addEventListener('change', () => {
            state.ui.panelOpacity = normalizePanelOpacity(Number(els.panelOpacityRange.value) / 100, DEFAULT_PANEL_OPACITY);
            applyPanelOpacityUI();
            saveSettingsToStorage();
        });
        els.statusRefreshBtn.onclick = refreshCurrentStatus;
        els.missionRefreshBtn.onclick = refreshCurrentStatus;
        els.missionHideCompleted?.addEventListener('change', () => {
            state.ui.hideCompletedMissions = els.missionHideCompleted.checked;
            markStatusTablesDirty();
            saveSettingsToStorage();
            updateUI();
        });
        els.logTitleBar?.addEventListener('click', () => {
            setLogCollapsedUI(!state.ui.logsCollapsed);
            saveSettingsToStorage();
        });
        els.logCollapseBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            setLogCollapsedUI(!state.ui.logsCollapsed);
            saveSettingsToStorage();
        });
        els.xpApplyBtn.onclick = applyXpSettings;
        els.xpStartBtn.onclick = runXpAutomation;
        els.xpStopBtn.onclick = () => { state.xp.stopped = true; addLog(logText('用户请求停止刷经验', 'User requested XP stop'), 'WARN'); };
        els.buyApplyBtn.onclick = applyAutoBuySettings;
        els.buyRunBtn.onclick = runManualBuy;
        els.afApplyBtn.onclick = applyAutoFarmSettings;
        els.afRunOnceBtn.onclick = () => runAutoFarmOnce({ fromScheduler: false });
        els.afSchedulerStartBtn.onclick = startAutoFarmScheduler;
        els.afSchedulerStopBtn.onclick = stopAutoFarmScheduler;
        els.xpLandIndex.addEventListener('change', () => { state.xp.landIndex = String(els.xpLandIndex.value || DEFAULT_XP_LAND).trim(); saveSettingsToStorage(); });
        els.xpCropId.addEventListener('change', () => { state.xp.cropId = String(els.xpCropId.value || DEFAULT_XP_CROP).trim(); saveSettingsToStorage(); });
        els.xpCountdownDays.addEventListener('change', () => { const v = Number.parseInt(els.xpCountdownDays.value, 10); if (Number.isFinite(v) && v >= 0) state.xp.countdownDays = v; saveSettingsToStorage(); });
        els.xpCountdownHours.addEventListener('change', () => { const v = Number.parseInt(els.xpCountdownHours.value, 10); if (Number.isFinite(v) && v >= 0 && v <= 23) state.xp.countdownHours = v; saveSettingsToStorage(); });
        els.xpCountdownMinutes.addEventListener('change', () => { const v = Number.parseInt(els.xpCountdownMinutes.value, 10); if (Number.isFinite(v) && v >= 0 && v <= 59) state.xp.countdownMinutes = v; saveSettingsToStorage(); });
        els.xpStopHour.addEventListener('change', () => { const v = Number.parseInt(els.xpStopHour.value, 10); if (Number.isFinite(v) && v >= 0 && v <= 23) state.xp.stopHour = v; saveSettingsToStorage(); });
        els.xpStopMinute.addEventListener('change', () => { const v = Number.parseInt(els.xpStopMinute.value, 10); if (Number.isFinite(v) && v >= 0 && v <= 59) state.xp.stopMinute = v; saveSettingsToStorage(); });
        els.xpModeCountdown?.addEventListener('change', onXpModeChange);
        els.xpModeCountup?.addEventListener('change', onXpModeChange);
        els.xpModeAlways?.addEventListener('change', onXpModeChange);
        els.afCropId.addEventListener('change', () => { state.autoFarm.cropId = String(els.afCropId.value || DEFAULT_AF_CROP).trim(); saveSettingsToStorage(); updateUI(); });
        els.afLandSelectWrap?.addEventListener('change', () => { state.autoFarm.selectedLands = getSelectedAutoFarmLandsFromUI(); saveSettingsToStorage(); renderAutoFarmLandChecks(state.status.landOptions); updateUI(); });
        els.buyCropId.addEventListener('change', () => { state.autoBuy.cropId = String(els.buyCropId.value || DEFAULT_BUY_CROP).trim(); saveSettingsToStorage(); });
        els.buyPerCount.addEventListener('change', () => { const v = Number.parseInt(els.buyPerCount.value, 10); if (Number.isFinite(v) && v >= 1) state.autoBuy.perBuyCount = v; saveSettingsToStorage(); });
        els.buyRepeatTimes.addEventListener('change', () => { const v = Number.parseInt(els.buyRepeatTimes.value, 10); if (Number.isFinite(v) && v >= 1) state.autoBuy.repeatTimes = v; saveSettingsToStorage(); });
        els.xpMissionId.addEventListener('change', () => { state.xp.missionId = String(els.xpMissionId.value || state.xp.missionId).trim(); saveSettingsToStorage(); });
        els.afIntervalMin.addEventListener('change', () => { const v = Number.parseInt(els.afIntervalMin.value, 10); if (Number.isFinite(v) && v >= 1) state.autoFarm.intervalMin = v; saveSettingsToStorage(); });
        els.afDelayMin.addEventListener('change', () => { const v = Number.parseInt(els.afDelayMin.value, 10); if (Number.isFinite(v) && v >= 0) state.autoFarm.randomDelayMinMs = v; saveSettingsToStorage(); });
        els.afDelayMax.addEventListener('change', () => { const v = Number.parseInt(els.afDelayMax.value, 10); if (Number.isFinite(v) && v >= 0) state.autoFarm.randomDelayMaxMs = v; saveSettingsToStorage(); });
        els.afModeSingleBtn?.addEventListener('click', () => {
            state.autoFarm.goalModeEnabled = false;
            state.autoFarm.currentGoalCropId = '';
            markAutoFarmGoalTableDirty();
            saveSettingsToStorage();
            updateUI();
        });
        els.afModeMultiBtn?.addEventListener('click', () => {
            state.autoFarm.goalModeEnabled = true;
            markAutoFarmGoalTableDirty();
            saveSettingsToStorage();
            updateUI();
        });
        els.afGoalTableWrap?.addEventListener('change', (event) => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement)) return;
            const field = String(input.dataset.goalField || '');
            const cropId = String(input.dataset.cropId || '').trim();
            if (!field || !cropId) return;
            syncAutoFarmFlowerGoals();
            const goal = state.autoFarm.flowerGoals.find(item => String(item.cropId) === cropId);
            if (!goal) return;
            const value = Number.parseInt(input.value, 10);
            if (field === 'targetCount') goal.targetCount = Number.isFinite(value) && value >= 0 ? value : goal.targetCount;
            state.autoFarm.flowerGoals = sortAutoFarmGoals(state.autoFarm.flowerGoals);
            saveSettingsToStorage();
            updateUI();
        });
    };

    const rebuildFullUI = () => {
        const wasVisible = els.panel && els.panel.style.display !== 'none';
        markStatusTablesDirty();
        createUI();
        refreshElsRefs();
        wireEvents();
        setXpRunningUI(state.xp.isRunning);
        setSchedulerUI(state.autoFarm.schedulerEnabled);
        setLogCollapsedUI(state.ui.logsCollapsed);
        syncFormControlsFromState();
        if (wasVisible) showPanel(); else hidePanel();
    };

    wireEvents();

    setXpRunningUI(false);
    setSchedulerUI(false);
    setLogCollapsedUI(state.ui.logsCollapsed);
    setActiveTab(state.ui.activeTab);
    buildSelectors();
    updateUI();
    saveSettingsToStorage();
    hidePanel();
    addLog(t('scriptLoaded'));
    refreshCurrentStatus();
    setInterval(updateUI, 1000);
})();
