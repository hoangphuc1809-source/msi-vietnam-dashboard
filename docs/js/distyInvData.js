// MSI Vietnam Dashboard - Userbuy Tracking tab - Disty Monthly INV module
// Ton kho tai kho cua Nha Phan Phoi (NPP/Disty), gop theo THANG (khac Userbuy/
// Weekly Sales la theo TUAN). Dung de tinh Disty Onhand trong bang Disty va
// WOI (Tồn NPP + Tồn Đại lý).

window.MsiDistyInvData = (function () {
  'use strict';

  var rows = [];   // [{y,q,m,sku,sg,seg1,highEnd,gen,cpuSeg,gpu,disty,srp,priceSeg,status,gpuVendor,shipment,sellIn,onHand}]
  var meta = {};
  var loaded = false;

  var EXCLUDED_SERIES_GROUPS = { 'Content Creation': true };
  function normSeriesGroup_(sg) {
    var s = String(sg || '').trim();
    if (/^Business\s*&\s*Productivity$/i.test(s)) return 'Business& Productivity';
    return s;
  }


  var SS_KEY_ = 'msivn_di_v1';

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
      var r2 = await fetch('data/disty-inv.json');
      if (r2.ok) { var j2 = await r2.json(); applyData_(j2); }
    } catch (_e) {}

    // 3. GAS fetch chạy BACKGROUND - không block caller
    // epoch_ ngăn stale response ghi đè khi user bấm Refresh
    var _epoch = epoch_;
    ;(async function () {
      try {
        var _res = await fetch(window.MSI_CONFIG.APPS_SCRIPT_URL + '?action=distyinv&_=' + Date.now(), { method: 'GET' });
        if (!_res.ok) throw new Error('HTTP ' + _res.status);
        var _json = await _res.json();
        if (_json.error) throw new Error(_json.error);
        if (_epoch !== epoch_) return; // stale - user đã clear cache
        applyData_(_json);
        lsSet_(LS_KEY_, _json);
      } catch (_e) {
        console.warn('[DistyInv GAS background]', _e.message);
      } finally {
        if (typeof onLiveReady === 'function') onLiveReady();
      }
    })();
  }

  function applyData_(json) {
    rows = (json.rows || []).filter(function (r) { return !EXCLUDED_SERIES_GROUPS[normSeriesGroup_(r.sg)]; });
    rows.forEach(function (r) { r.sg = normSeriesGroup_(r.sg); });
    meta = json.meta || {};
    loaded = true;
  }

  function isLoaded() { return loaded; }
  function getMeta() { return meta; }
  function getRows() { return rows; }

  function normYear_(y) { return String(y || '').replace(/^Y/, ''); }

  // Tong On Hand cua Disty tai 1 THANG cu the (snapshot), loc them theo
  // disty/segment/gpu/cpu/model/seriesGroup/highEnd/series50 neu co trong filters.
  function onHandAtMonth(year, month, filters) {
    filters = filters || {};
    var y = normYear_(year);
    var total = 0;
    rows.forEach(function (r) {
      if (normYear_(r.y) !== y || r.m !== month) return;
      if (filters.disty && r.disty !== filters.disty) return;
      if (filters.segment && r.seg1 !== filters.segment) return;
      if (filters.gpu && r.gpu !== filters.gpu) return;
      if (filters.cpu && r.cpuSeg !== filters.cpu) return;
      if (filters.model && r.sku !== filters.model) return;
      if (filters.seriesGroups && filters.seriesGroups.length && filters.seriesGroups.indexOf(r.sg) === -1) return;
      if (filters.highEndOnly && !r.highEnd) return;
      total += (r.onHand || 0);
    });
    return Math.round(total * 100) / 100;
  }

  // Gop On Hand theo Disty tai 1 thang cu the (cho bang Disty), tra ve map disty -> onHand
  function onHandByDistyAtMonth(year, month, filters) {
    filters = filters || {};
    var y = normYear_(year);
    var out = {};
    rows.forEach(function (r) {
      if (normYear_(r.y) !== y || r.m !== month) return;
      if (filters.segment && r.seg1 !== filters.segment) return;
      if (filters.gpu && r.gpu !== filters.gpu) return;
      if (filters.cpu && r.cpuSeg !== filters.cpu) return;
      if (filters.model && r.sku !== filters.model) return;
      if (filters.seriesGroups && filters.seriesGroups.length && filters.seriesGroups.indexOf(r.sg) === -1) return;
      if (filters.highEndOnly && !r.highEnd) return;
      out[r.disty] = (out[r.disty] || 0) + (r.onHand || 0);
    });
    Object.keys(out).forEach(function (k) { out[k] = Math.round(out[k] * 100) / 100; });
    return out;
  }

  function getDistys() {
    var set = {};
    rows.forEach(function (r) { if (r.disty) set[r.disty] = true; });
    return Object.keys(set).sort();
  }

  return {
    fetchData: fetchData,
    clearCache: function() { lsClear_(LS_KEY_); epoch_++; },
    isLoaded: isLoaded,
    getMeta: getMeta,
    getRows: getRows,
    onHandAtMonth: onHandAtMonth,
    onHandByDistyAtMonth: onHandByDistyAtMonth,
    getDistys: getDistys
  };
})();

