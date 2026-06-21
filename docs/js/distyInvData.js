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

  async function fetchData() {
    var liveUrl = window.MSI_CONFIG.APPS_SCRIPT_URL + '?action=distyinv&_=' + Date.now();
    try {
      var res = await fetch(liveUrl, { method: 'GET' });
      if (!res.ok) throw new Error('status ' + res.status);
      var json = await res.json();
      if (json.error) throw new Error(json.error);
      applyData_(json);
      return json;
    } catch (liveErr) {
      console.warn('[DistyInv] Live fetch (action=distyinv) chua san sang, dung static snapshot:', liveErr.message);
      var res2 = await fetch('data/disty-inv.json');
      if (!res2.ok) throw new Error('Disty INV static fallback that bai: ' + res2.status);
      var json2 = await res2.json();
      applyData_(json2);
      return json2;
    }
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
    isLoaded: isLoaded,
    getMeta: getMeta,
    getRows: getRows,
    onHandAtMonth: onHandAtMonth,
    onHandByDistyAtMonth: onHandByDistyAtMonth,
    getDistys: getDistys
  };
})();
