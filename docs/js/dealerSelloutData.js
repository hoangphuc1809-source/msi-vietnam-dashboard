// MSI Vietnam Dashboard - Userbuy Tracking tab - Dealer/Disty Sell Out module
// Dung CHUNG endpoint action=sellout voi Market Overall (salesData.js) nhung
// doc them 2 mang MOI: byDealer va byDisty (Apps Script ban moi gop san trong
// CUNG 1 lan doc sheet ngoai 12MB, khong doc lai). Day la Sell Out THUC SU cua
// Dealer (khac Userbuy - chi so hoat dong rieng, khong gan Dealer).

window.MsiDealerSelloutData = (function () {
  'use strict';

  var byDealer = [];  // [{w, cust, channel, sellOut, sellIn, onHand, rev}]
  var byDisty = [];    // [{w, disty, sellOut, onHand, rev}]
  var bySegment = [];   // [{w, segment, onHand}]
  var byGpu = [];        // [{w, gpu, onHand}]
  var byModel = [];       // [{w, sku, onHand}]
  var byDealerModel = []; // [{w, cust, sku, sellOut}] -- cross-filter sell out theo model
  var byDistyModel = [];  // [{w, disty, sku, sellOut}] -- cross-filter sell out theo model
  var meta = {};
  var loaded = false;


  var SS_KEY_ = 'msivn_ds_v1';

  // ===== SessionStorage cache =====
  // Du lieu duoc giu trong session (cung 1 browser tab) de tranh re-fetch khi
  // switch tab Market Overall <-> Userbuy Tracking. TTL 30 phut = bang GAS cache.
  // Refresh button se clear cache va fetch lai tu GAS.
  var SS_TTL_ = 30 * 60 * 1000; // 30 phut

  function ssGet_(key) {
    try {
      var item = localStorage.getItem(key);
      if (!item) return null;
      var obj = JSON.parse(item);
      if ((Date.now() - obj.ts) > SS_TTL_) { localStorage.removeItem(key); return null; }
      return obj.data;
    } catch (e) { return null; }
  }
  function ssSet_(key, data) {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data })); }
    catch (e) {} // QuotaExceeded -> bo qua, khong cache
  }
  function ssClear_(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  var LS_KEY_ = SS_KEY_;
  var epoch_ = 0;
  function lsGet_(k) { return ssGet_(k); }
  function lsSet_(k, v) { ssSet_(k, v); }
  function lsClear_(k) { ssClear_(k); }

  async function fetchData(onLiveReady) {
    // 1. localStorage cache: instant ~1ms, skip GAS hoàn toàn
    var _ls = lsGet_(LS_KEY_);
    if (_ls) { applyData_(_ls); return _ls; }

    // 2. Static fallback NGAY LẬP TỨC (browser HTTP cache ~10ms)
    // Cho phép page render mà không cần đợi GAS
    try {
      var r2 = await fetch('data/weekly-sellout-detail.json');
      if (r2.ok) { var j2 = await r2.json(); applyData_(j2); }
    } catch (_e) {}

    // 3. GAS fetch chạy BACKGROUND - không block caller
    // epoch_ ngăn stale response ghi đè khi user bấm Refresh
    var _epoch = epoch_;
    ;(async function () {
      try {
        var _res = await fetch(window.MSI_CONFIG.APPS_SCRIPT_URL + '?action=sellout&_=' + Date.now(), { method: 'GET' });
        if (!_res.ok) throw new Error('HTTP ' + _res.status);
        var _json = await _res.json();
        if (_json.error) throw new Error(_json.error);
        if (_epoch !== epoch_) return; // stale - user đã clear cache
        applyData_(_json);
        lsSet_(LS_KEY_, _json);
      } catch (_e) {
        console.warn('[DealerSellout GAS background]', _e.message);
      } finally {
        if (typeof onLiveReady === 'function') onLiveReady();
      }
    })();
  }

  function applyData_(json) {
    byDealer = json.byDealer || [];
    byDisty = json.byDisty || [];
    bySegment = json.bySegment || [];
    byGpu = json.byGpu || [];
    byModel = json.byModel || [];
    byDealerModel = json.byDealerModel || [];
    byDistyModel = json.byDistyModel || [];
    meta = json.meta || {};
    loaded = true;
    modelOnHandIndex_ = null; // rebuild lazy khi can
  }

  var modelOnHandIndex_ = null;
  function buildModelOnHandIndex_() {
    modelOnHandIndex_ = {};
    byModel.forEach(function (r) {
      var key = r.w + '|' + r.sku;
      modelOnHandIndex_[key] = (modelOnHandIndex_[key] || 0) + (r.onHand || 0);
    });
  }
  function modelOnHandAtWeek(sku, week) {
    if (!modelOnHandIndex_) buildModelOnHandIndex_();
    var v = modelOnHandIndex_[week + '|' + sku];
    return v ? Math.round(v * 100) / 100 : 0;
  }

  function isLoaded() { return loaded; }
  function hasByDealerModel() { return byDealerModel.length > 0; }
  function hasByDistyModel() { return byDistyModel.length > 0; }
  function getByDealerModel() { return byDealerModel; }
  function getByDistyModel() { return byDistyModel; }
  function getMeta() { return meta; }
  function getByDealer() { return byDealer; }
  function getByDisty() { return byDisty; }
  function getBySegment() { return bySegment; }
  function getByGpu() { return byGpu; }
  function getByModel() { return byModel; }

  // On Hand cua Dealer cho 1 Segment/GPU cu the tai 1 tuan (cho bang Segment/GPU)
  function segmentOnHandAtWeek(segment, week) {
    var total = 0;
    bySegment.forEach(function (r) { if (r.w === week && r.segment === segment) total += (r.onHand || 0); });
    return Math.round(total * 100) / 100;
  }
  function gpuOnHandAtWeek(gpu, week) {
    var total = 0;
    byGpu.forEach(function (r) { if (r.w === week && r.gpu === gpu) total += (r.onHand || 0); });
    return Math.round(total * 100) / 100;
  }
  function distyOnHandAtWeek(disty, week) {
    var total = 0;
    byDisty.forEach(function (r) { if (r.w === week && r.disty === disty) total += (r.onHand || 0); });
    return Math.round(total * 100) / 100;
  }

  // Tong On Hand cua 1 Dealer tai 1 TUAN cu the (snapshot, khong cong don nhieu tuan)
  function dealerOnHandAtWeek(customer, week) {
    var total = 0;
    byDealer.forEach(function (r) {
      if (r.w === week && r.cust === customer) total += (r.onHand || 0);
    });
    return Math.round(total * 100) / 100;
  }

  // Tong On Hand cua TAT CA Dealer tai 1 tuan (cho bang Disty - cot "Dealer onhand")
  function totalDealerOnHandAtWeek(week, dealerFilter) {
    var total = 0;
    byDealer.forEach(function (r) {
      if (r.w !== week) return;
      if (dealerFilter && dealerFilter.length && dealerFilter.indexOf(r.cust) === -1) return;
      total += (r.onHand || 0);
    });
    return Math.round(total * 100) / 100;
  }

  function getDealers() {
    var set = {};
    byDealer.forEach(function (r) { if (r.cust) set[r.cust] = true; });
    return Object.keys(set).sort();
  }

  function getWeeks() {
    var set = {};
    byDealer.forEach(function (r) { if (r.w) set[r.w] = true; });
    return Object.keys(set).sort();
  }

  return {
    fetchData: fetchData,
    clearCache: function() { lsClear_(LS_KEY_); epoch_++; },
    isLoaded: isLoaded,
    getMeta: getMeta,
    getByDealer: getByDealer,
    getByDisty: getByDisty,
    getBySegment: getBySegment,
    getByGpu: getByGpu,
    getByModel: getByModel,
    dealerOnHandAtWeek: dealerOnHandAtWeek,
    totalDealerOnHandAtWeek: totalDealerOnHandAtWeek,
    segmentOnHandAtWeek: segmentOnHandAtWeek,
    gpuOnHandAtWeek: gpuOnHandAtWeek,
    distyOnHandAtWeek: distyOnHandAtWeek,
    modelOnHandAtWeek: modelOnHandAtWeek,
    getDealers: getDealers,
    getWeeks: getWeeks,
    hasByDealerModel: hasByDealerModel,
    hasByDistyModel: hasByDistyModel,
    getByDealerModel: getByDealerModel,
    getByDistyModel: getByDistyModel
  };
})();


