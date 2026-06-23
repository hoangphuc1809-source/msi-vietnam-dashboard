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


  var LS_KEY_ = 'msivn_ds_v2';
  var epoch_ = 0;

  // ===== localStorage "cache-last-open" =====
  // Không có TTL cứng. Cache sống vô thời hạn và chỉ bị replace khi GAS
  // fetch thành công. Mục đích: luôn hiển thị OnHand từ lần mở gần nhất,
  // thay vì fallback về static JSON cũ khi cache expire sau 30 phút.
  // Xóa cache chỉ khi user bấm Refresh (clearCache + epoch++).
  function lsGet_(k) {
    try {
      var raw = localStorage.getItem(k);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  function lsSet_(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); }
    catch (e) {} // QuotaExceeded -> bo qua
  }
  function lsClear_(k) {
    try { localStorage.removeItem(k); } catch (e) {}
  }

  async function fetchData(onLiveReady) {
    // 1. localStorage cache-last-open: instant ~1ms, không có TTL
    //    Nếu có cache từ lần mở trước -> render ngay với OnHand đúng.
    //    GAS vẫn chạy background để update data mới nhất.
    var _ls = lsGet_(LS_KEY_);
    if (_ls) { applyData_(_ls); }

    // 2. Static fallback: chỉ dùng khi localStorage TRỐNG (lần đầu mở)
    if (!_ls) {
      try {
        var r2 = await fetch('data/weekly-sellout-detail.json');
        if (r2.ok) { var j2 = await r2.json(); applyData_(j2); }
      } catch (_e) {}
    }

    // 3. GAS fetch chạy BACKGROUND - không block caller
    //    Nếu thành công: cập nhật localStorage + re-render qua onLiveReady
    //    Nếu lỗi: giữ nguyên cache cũ (OnHand vẫn hiển thị)
    //    epoch_ ngăn stale response ghi đè khi user bấm Refresh
    var _epoch = epoch_;
    ;(async function () {
      try {
        var _res = await fetch(window.MSI_CONFIG.APPS_SCRIPT_URL + '?action=sellout&_=' + Date.now(), { method: 'GET' });
        if (!_res.ok) throw new Error('HTTP ' + _res.status);
        var _json = await _res.json();
        if (_json.error) throw new Error(_json.error);
        if (_epoch !== epoch_) return; // stale - user đã clear cache
        applyData_(_json);
        lsSet_(LS_KEY_, _json); // cập nhật cache với data mới nhất từ GAS
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


