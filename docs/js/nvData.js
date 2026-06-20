// MSI Vietnam Dashboard - NV Report data module
// NV Report = bao cao sell-out toan thi truong Gaming (tat ca brand, khong chia theo dealer),
// tu 2023W26. Uu tien fetch live tu Apps Script (action=nv); neu chua deploy/loi thi
// tu dong fallback ve static snapshot (data/nv-report.json).

window.MsiNvData = (function () {
  'use strict';

  var brandRows = [];
  var gpuRows = [];
  var meta = {};
  var loaded = false;

  // Uu tien goi action=nv tu Apps Script (live, neu da deploy DashboardAPI.gs ban
  // moi). Neu chua deploy hoac loi, tu dong fallback ve static snapshot de dashboard
  // khong vo - khong can sua gi them phia client khi Apps Script duoc cap nhat sau.
  async function fetchData() {
    var liveUrl = window.MSI_CONFIG.APPS_SCRIPT_URL + '?action=nv&_=' + Date.now();
    try {
      var res = await fetch(liveUrl, { method: 'GET' });
      if (!res.ok) throw new Error('status ' + res.status);
      var json = await res.json();
      if (json.error) throw new Error(json.error);
      applyData_(json);
      return json;
    } catch (liveErr) {
      console.warn('[NV] Live fetch (action=nv) chua san sang, dung static snapshot:', liveErr.message);
      var res2 = await fetch('data/nv-report.json');
      if (!res2.ok) throw new Error('NV Report static fallback that bai: ' + res2.status);
      var json2 = await res2.json();
      applyData_(json2);
      return json2;
    }
  }

  function applyData_(json) {
    brandRows = json.brandRows || [];
    gpuRows = json.gpuRows || [];
    meta = json.meta || {};
    loaded = true;
  }

  function isLoaded() { return loaded; }
  function getMeta() { return meta; }

  function distinctWeeksSorted(rows) {
    var set = {};
    rows.forEach(function (r) { if (r.w) set[r.w] = true; });
    return Object.keys(set).sort();
  }

  function getWeeks() { return distinctWeeksSorted(brandRows); }

  // ===== Weekly MSI vs Market (whole market, tat ca brand) =====
  function weeklyMsiShare(n) {
    var weeks = distinctWeeksSorted(brandRows);
    if (n) weeks = weeks.slice(Math.max(0, weeks.length - n));
    var weekSet = {};
    weeks.forEach(function (w) { weekSet[w] = true; });

    var byWeek = {};
    weeks.forEach(function (w) { byWeek[w] = { total: 0, msi: 0, lastYearMsi: 0 }; });
    brandRows.forEach(function (r) {
      if (!weekSet[r.w]) return;
      byWeek[r.w].total += r.vol;
      if (r.brand === 'MSI') {
        byWeek[r.w].msi += r.vol;
        byWeek[r.w].lastYearMsi += r.lastYear;
      }
    });

    return weeks.map(function (w) {
      var d = byWeek[w];
      return {
        week: w,
        total: d.total,
        msi: d.msi,
        share: d.total > 0 ? d.msi / d.total : null,
        yoy: d.lastYearMsi > 0 ? (d.msi - d.lastYearMsi) / d.lastYearMsi : null
      };
    });
  }

  // ===== Quarterly trend (toan bo lich su tu 2023) - cho thay xu huong dai han =====
  function quarterlyTrend() {
    var byQ = {};
    brandRows.forEach(function (r) {
      var key = r.y + '_' + r.q;
      if (!byQ[key]) byQ[key] = { y: r.y, q: r.q, total: 0, byBrand: {} };
      byQ[key].total += r.vol;
      byQ[key].byBrand[r.brand] = (byQ[key].byBrand[r.brand] || 0) + r.vol;
    });
    return Object.keys(byQ).sort().map(function (key) {
      var d = byQ[key];
      var msi = d.byBrand['MSI'] || 0;
      return {
        label: d.y.replace('Y', '') + ' ' + d.q,
        year: d.y,
        quarter: d.q,
        total: d.total,
        msi: msi,
        msiShare: d.total > 0 ? msi / d.total : null
      };
    });
  }

  // ===== Brand ranking @ latest week (toan thi truong) =====
  function latestWeekBrandRanking() {
    var weeks = distinctWeeksSorted(brandRows);
    if (!weeks.length) return [];
    var lastWeek = weeks[weeks.length - 1];
    var rows = brandRows.filter(function (r) { return r.w === lastWeek; });
    var total = rows.reduce(function (a, r) { return a + r.vol; }, 0);
    return rows.map(function (r) {
      return {
        brand: r.brand,
        vol: r.vol,
        share: total > 0 ? r.vol / total : 0,
        yoy: r.lastYear > 0 ? (r.vol - r.lastYear) / r.lastYear : null
      };
    }).sort(function (a, b) { return b.vol - a.vol; });
  }

  // ===== GPU tier mix: MSI vs whole market, gop N tuan gan nhat =====
  function gpuTierComparison(n) {
    n = n || 8;
    var weeks = distinctWeeksSorted(gpuRows).slice(-n);
    var weekSet = {};
    weeks.forEach(function (w) { weekSet[w] = true; });

    var byTier = {};
    gpuRows.forEach(function (r) {
      if (!weekSet[r.w]) return;
      if (!byTier[r.gpu]) byTier[r.gpu] = { market: 0, msi: 0 };
      byTier[r.gpu].market += r.vol;
      byTier[r.gpu].msi += r.msiVol;
    });

    var marketTotal = 0, msiTotal = 0;
    Object.keys(byTier).forEach(function (gpu) {
      marketTotal += byTier[gpu].market;
      msiTotal += byTier[gpu].msi;
    });

    return Object.keys(byTier).map(function (gpu) {
      return {
        gpu: gpu,
        marketVol: byTier[gpu].market,
        msiVol: byTier[gpu].msi,
        marketShare: marketTotal > 0 ? byTier[gpu].market / marketTotal : 0,
        msiShare: msiTotal > 0 ? byTier[gpu].msi / msiTotal : 0
      };
    }).filter(function (d) { return d.marketVol > 0 || d.msiVol > 0; })
      .sort(function (a, b) { return b.marketShare - a.marketShare; });
  }

  return {
    fetchData: fetchData,
    isLoaded: isLoaded,
    getMeta: getMeta,
    getWeeks: getWeeks,
    weeklyMsiShare: weeklyMsiShare,
    quarterlyTrend: quarterlyTrend,
    latestWeekBrandRanking: latestWeekBrandRanking,
    gpuTierComparison: gpuTierComparison
  };
})();
