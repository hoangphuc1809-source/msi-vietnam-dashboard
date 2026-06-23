// MSI Vietnam Dashboard - Userbuy Tracking tab - Monthly Sales Data module
// "Monthly Sales data": ban MONTHLY (khac Weekly Sales Data la theo TUAN) cua
// Sell In/Sell Out/On Hand theo tung Dealer. Dung RIENG cho "Dealers SOH" (KPI
// scorecard) - On hand (cot X) cong don tren TOAN BO mang luoi dealer.

window.MsiMonthlySalesData = (function () {
  'use strict';

  var skus = [];   // [{sku, sg, seg1, cpuSeg, gpu, disty, status, highEnd}]
  var facts = [];    // [{y, m, sku, onHand}]
  var byDealer = [];  // [{y, m, cust, onHand}]
  var byDealerSkus = {}; // { custName: [sku1, sku2, ...] } - cross-filter Dealer -> Model Detail
  var skuToDealersCache_ = null;
  var dealerOnHandIndex_ = null; // lazy reverse map: sku -> [dealer1, dealer2, ...]
  var byDealerModelOnHand = {}; // {'cust||sku||y||m': onHand} - per-dealer per-model onHand
  var skuIndex = {};
  var meta = {};
  var loaded = false;

  var EXCLUDED_SERIES_GROUPS = { 'Content Creation': true };
  function normSeriesGroup_(sg) {
    var s = String(sg || '').trim();
    if (/^Business\s*&\s*Productivity$/i.test(s)) return 'Business& Productivity';
    return s;
  }


  var SS_KEY_ = 'msivn_ms_v1';

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
      var r2 = await fetch('data/monthly-sales.json');
      if (r2.ok) { var j2 = await r2.json(); applyData_(j2); }
    } catch (_e) {}

    // 3. GAS fetch chạy BACKGROUND - không block caller
    // epoch_ ngăn stale response ghi đè khi user bấm Refresh
    var _epoch = epoch_;
    ;(async function () {
      try {
        var _res = await fetch(window.MSI_CONFIG.APPS_SCRIPT_URL + '?action=monthlysales&_=' + Date.now(), { method: 'GET' });
        if (!_res.ok) throw new Error('HTTP ' + _res.status);
        var _json = await _res.json();
        if (_json.error) throw new Error(_json.error);
        if (_epoch !== epoch_) return; // stale - user đã clear cache
        applyData_(_json);
        lsSet_(LS_KEY_, _json);
      } catch (_e) {
        console.warn('[MonthlySales GAS background]', _e.message);
      } finally {
        if (typeof onLiveReady === 'function') onLiveReady();
      }
    })();
  }

  function applyData_(json) {
    dealerOnHandIndex_ = null; // reset on new data
    skus = (json.skus || []).filter(function (s) { return !EXCLUDED_SERIES_GROUPS[normSeriesGroup_(s.sg)]; });
    skus.forEach(function (s) { s.sg = normSeriesGroup_(s.sg); });
    facts = json.facts || [];
    byDealer = json.byDealer || [];
    byDealerSkus = json.byDealerSkus || {}; // { cust: [sku1, sku2, ...] }
    skuToDealersCache_ = null; // reset lazy reverse map
    byDealerModelOnHand = json.byDealerModelOnHand || {};
    meta = json.meta || {};
    skuIndex = {};
    skus.forEach(function (s) { skuIndex[s.sku] = s; });
    loaded = true;
  }

  function isLoaded() { return loaded; }
  function getMeta() { return meta; }

  function normYear_(y) { return String(y || '').replace(/^Y/, ''); }

  // Tong On Hand (Dealers SOH) tai 1 THANG cu the, loc theo cac dim filter neu co
  function onHandAtMonth(year, month, filters) {
    filters = filters || {};
    if (!year || !month) return 0;
    var y = normYear_(year);
    var total = 0;
    facts.forEach(function (f) {
      if (normYear_(f.y) !== y || f.m !== month) return;
      var sk = skuIndex[f.sku];
      if (!sk) return;
      if (filters.segment && sk.seg1 !== filters.segment) return;
      if (filters.gpu && sk.gpu !== filters.gpu) return;
      if (filters.cpu && sk.cpuSeg !== filters.cpu) return;
      if (filters.disty && sk.disty !== filters.disty) return;
      if (filters.model && f.sku !== filters.model) return;
      if (filters.seriesGroups && filters.seriesGroups.length && filters.seriesGroups.indexOf(sk.sg) === -1) return;
      if (filters.highEndOnly && !sk.highEnd) return;
      total += (f.onHand || 0);
    });
    return Math.round(total * 100) / 100;
  }

  // Onhand cua 1 Dealer (Customer) tai 1 thang cu the (cong don tat ca SKU)
  // Build dealer onHand index [y][cust][m] → tra cứu O(1)
  function buildDealerOnHandIndex_() {
    dealerOnHandIndex_ = {};
    byDealer.forEach(function (r) {
      var y = normYear_(r.y);
      if (!dealerOnHandIndex_[y]) dealerOnHandIndex_[y] = {};
      if (!dealerOnHandIndex_[y][r.cust]) dealerOnHandIndex_[y][r.cust] = {};
      dealerOnHandIndex_[y][r.cust][r.m] = (dealerOnHandIndex_[y][r.cust][r.m] || 0) + (r.onHand || 0);
    });
  }

  // Trả về onHand của dealer tại tháng cụ thể.
  // Nếu tháng chính xác không có data (Monthly Sales chưa update),
  // fallback về tháng mới nhất ≤ tháng target trong cùng năm.
  function dealerOnHandAtMonth(customer, year, month) {
    if (!year || !month || !customer) return 0;
    if (!dealerOnHandIndex_) buildDealerOnHandIndex_();
    var y = normYear_(year);
    var custMap = (dealerOnHandIndex_[y] || {})[customer];
    if (!custMap) return 0;
    if (custMap[month] !== undefined) return custMap[month];
    // Fallback: latest available month ≤ target
    var best = 0;
    Object.keys(custMap).sort().forEach(function (m) {
      if (m <= month) best = custMap[m];
    });
    return best;
  }


  function getDealerSkus(customer) {
    if (!customer || !byDealerSkus[customer]) return [];
    return byDealerSkus[customer]; // sorted array of sku strings
  }

  // Tra ve danh sach SKU ma dealer nay da co inventory (tu byDealerSkus).
  // Dung cho cross-filter: khi click Dealers table row -> Model Detail chi hien
  // thi cac model thuoc dealer do.
  // Tra ve [] neu khong co du lieu (fallback: hien thi tat ca model - giu nguyen hien tai).
  function getDealerSkus(customer) {
    if (!customer || !byDealerSkus[customer]) return [];
    return byDealerSkus[customer]; // sorted array of sku strings
  }

  // Tra ve true neu byDealerSkus da duoc load (GAS v4+)
  function hasDealerSkus() {
    return Object.keys(byDealerSkus).length > 0;
  }

  // Tra ve tat ca dealer nao co SKU nay trong inventory (reverse map cua byDealerSkus).
  // Lazy-build lan dau goi, sau do cache lai. Reset khi fetchData() moi.
  // Dung cho cross-filter: model/segment/gpu duoc chon -> chi show relevant dealers.
  // Tra ve OnHand cua dealer cho 1 SKU cu the tai 1 thang (dung cho Dealers table
  // ONHAND column khi model/segment/gpu filter dang active).
  // Tra ve 0 neu khong co data (fallback: cot OnHand van dung dealerOnHandAtMonth).
  function dealerModelOnHandAtMonth(customer, sku, year, month) {
    var key = customer + '||' + sku + '||' + normYear_(year) + '||' + String(month);
    return byDealerModelOnHand[key] || 0;
  }

  function getDealersForSku(sku) {
    if (!skuToDealersCache_) {
      skuToDealersCache_ = {};
      Object.keys(byDealerSkus).forEach(function (cust) {
        byDealerSkus[cust].forEach(function (s) {
          if (!skuToDealersCache_[s]) skuToDealersCache_[s] = [];
          skuToDealersCache_[s].push(cust);
        });
      });
    }
    return skuToDealersCache_[sku] || [];
  }

  return {
    fetchData: fetchData,
    clearCache: function() { lsClear_(LS_KEY_); epoch_++; },
    isLoaded: isLoaded,
    getMeta: getMeta,
    onHandAtMonth: onHandAtMonth,
    dealerOnHandAtMonth: dealerOnHandAtMonth,
    getDealerSkus: getDealerSkus,
    hasDealerSkus: hasDealerSkus,
    getDealersForSku: getDealersForSku,
    dealerModelOnHandAtMonth: dealerModelOnHandAtMonth
  };
})();


