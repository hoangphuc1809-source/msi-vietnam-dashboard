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
  function getGpuWeeks() { return distinctWeeksSorted(gpuRows); }

  // Loc danh sach tuan cua NV theo CUNG Year/Quarter dropdown filter voi IHS -
  // NV luu y dang 'Y2026' (co tien to Y) trong khi dropdown dung '2026' (khong
  // co Y) nen phai bo tien to truoc khi so sanh. Mang rong = khong loc theo dim do.
  function getWeeksForYearQuarter(years, quarters) {
    var ySet = (years && years.length) ? {} : null;
    if (ySet) years.forEach(function (y) { ySet[y] = true; });
    var qSet = (quarters && quarters.length) ? {} : null;
    if (qSet) quarters.forEach(function (q) { qSet[q] = true; });

    var weekSet = {};
    brandRows.forEach(function (r) {
      var yPlain = String(r.y || '').replace(/^Y/, '');
      if (ySet && !ySet[yPlain]) return;
      if (qSet && !qSet[r.q]) return;
      if (r.w) weekSet[r.w] = true;
    });
    return Object.keys(weekSet).sort();
  }

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

  // ===== GPU tier mix: MSI vs whole market, gop theo danh sach tuan cu the =====
  // (weekLabels: mang cac tuan can gop, vd rolling 13w neo theo lich thuc te -
  // xem getRolling13WeekLabels() trong app.js. Truoc day ham nay tu lay "N tuan
  // gan nhat co trong data", nhung nhu vay phu thuoc vao data co day du hay khong;
  // gio nhan danh sach tuan tu ben ngoai de dam bao dung khung thoi gian mong muon.)
  function gpuTierComparison(weekLabels) {
    var weekSet = {};
    (weekLabels || []).forEach(function (w) { weekSet[w] = true; });

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

  // ===== Brand summary table (cho "NV Report" scorecard) =====
  // weekLabels: danh sach tuan trong pham vi (vd theo Year/Quarter filter dang chon).
  // QUAN TRONG: cot Last Wk/Last 2 Wk/Last 3 Wk trong sheet NV Report goc LUON RONG
  // (da xac nhan khi xay dung tinh nang nay) - nen phai TU TINH bang cach cong don
  // chinh du lieu brandRows theo tuan, khac voi cach IHS lam (IHS co san san cac
  // cot do, chi can doc truc tiep).
  function brandSummaryTable(weekLabels) {
    var weeks = (weekLabels || []).slice().sort();
    if (!weeks.length) return [];
    var weekSet = {};
    weeks.forEach(function (w) { weekSet[w] = true; });
    var lastWeek = weeks[weeks.length - 1];
    var prevWeek = weeks.length > 1 ? weeks[weeks.length - 2] : null;
    var last2Weeks = weeks.slice(-2);
    var last3Weeks = weeks.slice(-3);

    var byBrand = {};
    brandRows.forEach(function (r) {
      if (!weekSet[r.w]) return;
      if (!byBrand[r.brand]) {
        byBrand[r.brand] = { vol: 0, lastYearAtLastWeek: 0, last3WkVol: 0, last2WkVol: 0, lastWkVol: 0, prevWeekVol: 0 };
      }
      var b = byBrand[r.brand];
      b.vol += r.vol;
      if (r.w === lastWeek) { b.lastYearAtLastWeek += r.lastYear; b.lastWkVol += r.vol; }
      if (last3Weeks.indexOf(r.w) !== -1) b.last3WkVol += r.vol;
      if (last2Weeks.indexOf(r.w) !== -1) b.last2WkVol += r.vol;
      if (r.w === prevWeek) b.prevWeekVol += r.vol;
    });

    var grandTotal = 0;
    Object.keys(byBrand).forEach(function (brand) { grandTotal += byBrand[brand].vol; });

    return Object.keys(byBrand).map(function (brand) {
      var b = byBrand[brand];
      var yoy = b.lastYearAtLastWeek > 0 ? (b.lastWkVol - b.lastYearAtLastWeek) / b.lastYearAtLastWeek : null;
      var wow = (b.lastWkVol > 0 && b.prevWeekVol > 0) ? (b.lastWkVol - b.prevWeekVol) / b.prevWeekVol : null;
      return {
        brand: brand,
        volume: b.vol,
        lastYearVol: b.lastYearAtLastWeek,
        shared: grandTotal > 0 ? b.vol / grandTotal : 0,
        yoy: yoy,
        last3Wk: b.last3WkVol,
        last2Wk: b.last2WkVol,
        lastWk: b.lastWkVol,
        wow: wow
      };
    }).filter(function (d) { return d.volume > 0; })
      .sort(function (a, b) { return b.volume - a.volume; });
  }

  return {
    fetchData: fetchData,
    isLoaded: isLoaded,
    getMeta: getMeta,
    getWeeks: getWeeks,
    getGpuWeeks: getGpuWeeks,
    getWeeksForYearQuarter: getWeeksForYearQuarter,
    weeklyMsiShare: weeklyMsiShare,
    quarterlyTrend: quarterlyTrend,
    latestWeekBrandRanking: latestWeekBrandRanking,
    gpuTierComparison: gpuTierComparison,
    brandSummaryTable: brandSummaryTable
  };
})();
