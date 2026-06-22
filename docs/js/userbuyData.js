// MSI Vietnam Dashboard - Userbuy Tracking tab - Userbuy Data module
// "Userbuy data": chi so HOAT DONG cua khach hang cuoi tren he thong rieng cua
// MSI - KHONG gan vao Dealer nao (khac Sell Out, von la cua Dealer). Dung de
// xac dinh xu huong ban hang va cross-check voi Sell Out cua dai ly.
// Uu tien fetch live (action=userbuy); neu chua deploy/loi se fallback ve
// static snapshot (data/userbuy.json).

window.MsiUserbuyData = (function () {
  'use strict';

  var WU = window.MsiWeekUtils;
  var skus = [];        // [{sku, sg, seg1, cpuSeg, cpuSeries, cpu, gpu, mem, disty, srp, priceSeg, status, highEnd}]
  var facts = [];        // [{w, sku, qty, rev}]
  var skuIndex = {};      // sku -> sku meta object (lookup nhanh)
  var meta = {};
  var loaded = false;

  var SERIES_50_RE = /RTX\s*50(50|60|70|70\s*Ti|80|90)/i;

  // Loai bo "Content Creation" khoi tab nay theo yeu cau cua Phuc (21/06)
  var EXCLUDED_SERIES_GROUPS = { 'Content Creation': true };

  // Sua loi cooking data: "Business & Productivity" (co cach truoc &) va
  // "Business& Productivity" (khong cach) thuc chat la 1 gia tri, gop ve 1
  // chuan duy nhat de khong bi tach thanh 2 dong rieng tren chart/bang.
  function normSeriesGroup_(sg) {
    var s = String(sg || '').trim();
    if (/^Business\s*&\s*Productivity$/i.test(s)) return 'Business& Productivity';
    return s;
  }


  var SS_KEY_ = 'msivn_ub_v1';

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

  async function fetchData() {
    var _ss = ssGet_(SS_KEY_);
    if (_ss) { applyData_(_ss); return _ss; }
    var liveUrl = window.MSI_CONFIG.APPS_SCRIPT_URL + '?action=userbuy&_=' + Date.now();
    try {
      var res = await fetch(liveUrl, { method: 'GET' });
      if (!res.ok) throw new Error('status ' + res.status);
      var json = await res.json();
      if (json.error) throw new Error(json.error);
      applyData_(json);
      ssSet_(SS_KEY_, json);
      return json;
    } catch (liveErr) {
      console.warn('[Userbuy] Live fetch (action=userbuy) chua san sang, dung static snapshot:', liveErr.message);
      var res2 = await fetch('data/userbuy.json');
      if (!res2.ok) throw new Error('Userbuy static fallback that bai: ' + res2.status);
      var json2 = await res2.json();
      applyData_(json2);
      ssSet_(SS_KEY_, json2);
      return json2;
    }
  }

  function applyData_(json) {
    skus = json.skus || [];
    facts = json.facts || [];
    meta = json.meta || {};
    skus.forEach(function (s) { s.sg = normSeriesGroup_(s.sg); });
    skuIndex = {};
    skus.forEach(function (s) { skuIndex[s.sku] = s; });
    loaded = true;
  }

  function isLoaded() { return loaded; }
  function getMeta() { return meta; }
  function getSkus() { return skus.filter(function (s) { return !EXCLUDED_SERIES_GROUPS[s.sg]; }); }
  function getSkuMeta(sku) { return skuIndex[sku] || null; }

  function yearOfWeek(w) { return (w && w.length >= 4) ? w.slice(0, 4) : ''; }
  function quarterOfWeek(w) {
    if (!WU) return '';
    var d = WU.weekLabelToThursday(w);
    return 'Q' + (Math.floor(d.getUTCMonth() / 3) + 1);
  }

  function isSeries50_(gpu) {
    return SERIES_50_RE.test(String(gpu || ''));
  }

  function getYears() {
    var set = {};
    facts.forEach(function (f) { var y = yearOfWeek(f.w); if (y) set[y] = true; });
    return Object.keys(set).sort();
  }
  function getQuarters() {
    var set = {};
    facts.forEach(function (f) { set[quarterOfWeek(f.w)] = true; });
    return Object.keys(set).sort();
  }
  function getSeriesGroups() {
    var set = {};
    skus.forEach(function (s) { if (s.sg && !EXCLUDED_SERIES_GROUPS[s.sg]) set[s.sg] = true; });
    return Object.keys(set).sort();
  }
  function getSegments() {
    var set = {};
    skus.forEach(function (s) { if (s.seg1 && !EXCLUDED_SERIES_GROUPS[s.sg]) set[s.seg1] = true; });
    return Object.keys(set).sort();
  }
  function getGpus() {
    var set = {};
    skus.forEach(function (s) { if (s.gpu && !EXCLUDED_SERIES_GROUPS[s.sg]) set[s.gpu] = true; });
    return Object.keys(set).sort();
  }
  function getCpuSegments() {
    var set = {};
    skus.forEach(function (s) { if (s.cpuSeg && !EXCLUDED_SERIES_GROUPS[s.sg]) set[s.cpuSeg] = true; });
    return Object.keys(set).sort();
  }
  function getDistys() {
    var set = {};
    skus.forEach(function (s) { if (s.disty) set[s.disty] = true; });
    return Object.keys(set).sort();
  }

  // state: { years, quarters, seriesGroups, highEndOnly, series50Only, model,
  //          segment, gpu, cpu, disty, weekFrom, weekTo }
  function matchesFact_(f, sk, state) {
    if (!sk) return false;
    if (EXCLUDED_SERIES_GROUPS[sk.sg]) return false;
    if (state.years && state.years.length && state.years.indexOf(yearOfWeek(f.w)) === -1) return false;
    if (state.quarters && state.quarters.length && state.quarters.indexOf(quarterOfWeek(f.w)) === -1) return false;
    if (state.seriesGroups && state.seriesGroups.length && state.seriesGroups.indexOf(sk.sg) === -1) return false;
    if (state.highEndOnly && !sk.highEnd) return false;
    if (state.series50Only && !isSeries50_(sk.gpu)) return false;
    if (state.model && f.sku !== state.model) return false;
    if (state.segment && sk.seg1 !== state.segment) return false;
    if (state.gpu && sk.gpu !== state.gpu) return false;
    if (state.cpu && sk.cpuSeg !== state.cpu) return false;
    if (state.disty && sk.disty !== state.disty) return false;
    if (state.weekFrom && f.w < state.weekFrom) return false;
    if (state.weekTo && f.w > state.weekTo) return false;
    return true;
  }

  // Tra ve facts da loc, kem theo thuoc tinh SKU duoc gop san (de tien group)
  function applyFilters(state) {
    state = state || {};
    var out = [];
    for (var i = 0; i < facts.length; i++) {
      var f = facts[i];
      var sk = skuIndex[f.sku];
      if (!matchesFact_(f, sk, state)) continue;
      out.push({ w: f.w, sku: f.sku, qty: f.qty, rev: f.rev, sk: sk });
    }
    return out;
  }

  function getWeeksForState(state) {
    var set = {};
    applyFilters(state).forEach(function (f) { set[f.w] = true; });
    return Object.keys(set).sort();
  }

  // Tong qty/rev theo tuan, align theo danh sach 'weeks' truyen vao (null neu khong co du lieu)
  function weeklySeries(state, weeks) {
    var filtered = applyFilters(state);
    var byWeek = {};
    filtered.forEach(function (f) {
      if (!byWeek[f.w]) byWeek[f.w] = { qty: 0, rev: 0 };
      byWeek[f.w].qty += f.qty;
      byWeek[f.w].rev += f.rev;
    });
    return weeks.map(function (w) {
      return byWeek[w] ? { w: w, qty: round2_(byWeek[w].qty), rev: round2_(byWeek[w].rev) } : { w: w, qty: null, rev: null };
    });
  }

  // Gop theo 1 truong thuoc tinh SKU (sg / seg1 / gpu / cpuSeg / disty), tra ve
  // map: groupValue -> { qty, rev, byWeek: {w:qty} }
  function groupBy(state, field) {
    var filtered = applyFilters(state);
    var groups = {};
    filtered.forEach(function (f) {
      var key = (f.sk && f.sk[field]) || 'Unknown';
      if (!groups[key]) groups[key] = { qty: 0, rev: 0, byWeek: {} };
      groups[key].qty += f.qty;
      groups[key].rev += f.rev;
      groups[key].byWeek[f.w] = (groups[key].byWeek[f.w] || 0) + f.qty;
    });
    return groups;
  }

  // Danh sach model (marketing_sku) khop voi 1 chuoi tim kiem (cho search box / global search)
  function searchModels(query, limit) {
    query = String(query || '').toLowerCase().trim();
    limit = limit || 20;
    if (!query) return [];
    var out = [];
    for (var i = 0; i < skus.length && out.length < limit; i++) {
      var s = skus[i];
      if (EXCLUDED_SERIES_GROUPS[s.sg]) continue;
      if (s.sku.toLowerCase().indexOf(query) !== -1) out.push(s);
    }
    return out;
  }

  function round2_(n) { return Math.round(n * 100) / 100; }

  return {
    fetchData: fetchData,
    clearCache: function() { ssClear_(SS_KEY_); },
    isLoaded: isLoaded,
    getMeta: getMeta,
    getSkus: getSkus,
    getSkuMeta: getSkuMeta,
    yearOfWeek: yearOfWeek,
    quarterOfWeek: quarterOfWeek,
    isSeries50: isSeries50_,
    getYears: getYears,
    getQuarters: getQuarters,
    getSeriesGroups: getSeriesGroups,
    getSegments: getSegments,
    getGpus: getGpus,
    getCpuSegments: getCpuSegments,
    getDistys: getDistys,
    applyFilters: applyFilters,
    getWeeksForState: getWeeksForState,
    weeklySeries: weeklySeries,
    groupBy: groupBy,
    searchModels: searchModels
  };
})();

