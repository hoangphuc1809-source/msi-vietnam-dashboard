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


  var LS_KEY_ = 'msivn_ms_v2';
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
        var r2 = await fetch('data/monthly-sales.json');
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
        var _res = await fetch(window.MSI_CONFIG.APPS_SCRIPT_URL + '?action=monthlysales&_=' + Date.now(), { method: 'GET' });
        if (!_res.ok) throw new Error('HTTP ' + _res.status);
        var _json = await _res.json();
        if (_json.error) throw new Error(_json.error);
        if (_epoch !== epoch_) return; // stale - user đã clear cache
        applyData_(_json);
        lsSet_(LS_KEY_, _json); // cập nhật cache với data mới nhất từ GAS
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

  // Tra ve tat ca dealer co onHand > 0 cho 1 SKU tai 1 thang cu the
  // Dung de merge dealers OnHand-only vao Dealers table (khong co sell-out nhung co ton kho)
  function getDealersWithModelOnHand(sku, year, month) {
    var y = normYear_(year);
    var suffix = '||' + sku + '||' + y + '||' + String(month);
    var out = [];
    Object.keys(byDealerModelOnHand).forEach(function (key) {
      // key format: 'cust||sku||y||m'
      if (key.slice(-(suffix.length)) === suffix && byDealerModelOnHand[key] > 0) {
        var cust = key.slice(0, key.length - suffix.length);
        out.push(cust);
      }
    });
    return out;
  }

  // Tra ve tat ca dealer co onHand > 0 tai 1 thang (khong filter sku)
  // Dung cho Dealers table khi khong co model/segment filter
  function getAllDealersWithOnHand(year, month) {
    if (!dealerOnHandIndex_) buildDealerOnHandIndex_();
    var y = normYear_(year);
    var custMap = dealerOnHandIndex_[y] || {};
    var out = [];
    Object.keys(custMap).forEach(function (cust) {
      if ((custMap[cust][month] || 0) > 0) out.push(cust);
    });
    return out;
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
    dealerModelOnHandAtMonth: dealerModelOnHandAtMonth,
    getDealersWithModelOnHand: getDealersWithModelOnHand,
    getAllDealersWithOnHand: getAllDealersWithOnHand
  };
})();


