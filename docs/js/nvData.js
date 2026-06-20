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
  // scopeWeeks: tuan trong pham vi hien thi (vd theo Year/Quarter dropdown) - dung
  // cho Volume/Share/YoY. recentWeeks (tuy chon): mang 3 nhan tuan [tuan-2, tuan-1,
  // tuan-0] DUNG CHUNG voi ben IHS (xem getRollingNWeekLabels_ trong app.js) de 2
  // bang Key Dealers/Nvidia Report hien thi DUNG CUNG 1 BO TUAN - neu NV chua co du
  // lieu cho 1 tuan nao do (thuong cham hon IHS vai tuan), tra ve null (de trong),
  // KHONG phai 0.
  //
  // YoY: KHONG dung cot "Last Year" co san trong sheet nua (da chung minh khong dang
  // tin cay, cung loai bug nhu Last Wk/2Wk/3Wk ben IHS). Thay vao do tu tinh bang
  // cach so sanh THANG DUNG so thu tu tuan giua nam dang xem va nam truoc do truc
  // tiep tu du lieu thuc (vd dang xem tuan 14-24 cua 2026 thi so voi tuan 14-24 cua
  // 2025) - cach nay luon kiem chung duoc va chinh xac hon dua vao 1 cot co san.
  function brandSummaryTable(scopeWeeks, recentWeeks) {
    var weeks = (scopeWeeks || []).slice();
    if (!weeks.length) return [];
    var weekSet = {};
    weeks.forEach(function (w) { weekSet[w] = true; });

    // Tuan tuong ung NAM TRUOC (cung so thu tu tuan, year-1) de tinh YoY truc tiep.
    var lastYearWeekSet = {};
    weeks.forEach(function (w) {
      var m = w.match(/^(\d{4})(W\d{2})$/);
      if (m) lastYearWeekSet[String(parseInt(m[1], 10) - 1) + m[2]] = true;
    });

    var rw = recentWeeks || [];
    var wkN2 = rw[0] || null;
    var wkN1 = rw[1] || null;
    var wkN = rw[2] || null;

    var byBrandThis = {};
    var byBrandLastYear = {};
    var byBrandRecent = {}; // brand -> { week: vol }

    brandRows.forEach(function (r) {
      if (weekSet[r.w]) byBrandThis[r.brand] = (byBrandThis[r.brand] || 0) + r.vol;
      if (lastYearWeekSet[r.w]) byBrandLastYear[r.brand] = (byBrandLastYear[r.brand] || 0) + r.vol;
      if (r.w === wkN2 || r.w === wkN1 || r.w === wkN) {
        if (!byBrandRecent[r.brand]) byBrandRecent[r.brand] = {};
        byBrandRecent[r.brand][r.w] = (byBrandRecent[r.brand][r.w] || 0) + r.vol;
      }
    });

    var grandTotal = 0;
    Object.keys(byBrandThis).forEach(function (brand) { grandTotal += byBrandThis[brand]; });

    return Object.keys(byBrandThis).map(function (brand) {
      var vol = byBrandThis[brand];
      var lastYearVol = byBrandLastYear[brand] || 0;
      var yoy = lastYearVol > 0 ? (vol - lastYearVol) / lastYearVol : null;

      var recentMap = byBrandRecent[brand] || {};
      var last3 = wkN2 && recentMap[wkN2] !== undefined ? recentMap[wkN2] : null;
      var last2 = wkN1 && recentMap[wkN1] !== undefined ? recentMap[wkN1] : null;
      var last1 = wkN && recentMap[wkN] !== undefined ? recentMap[wkN] : null;
      var wow = (last1 !== null && last2 !== null && last2 > 0) ? (last1 - last2) / last2 : null;

      return {
        brand: brand,
        volume: vol,
        lastYearVol: lastYearVol,
        shared: grandTotal > 0 ? vol / grandTotal : 0,
        yoy: yoy,
        last3Wk: last3,
        last2Wk: last2,
        lastWk: last1,
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
