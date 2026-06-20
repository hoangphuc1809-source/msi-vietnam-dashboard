// MSI Vietnam Dashboard - Weekly Sales Data module
// Sell Out cua MSI tren TOAN BO mang luoi khach hang/dealer (~109 customers),
// khac voi RAW - IHS chi track ~9 "Key Dealers". Uu tien fetch live tu Apps
// Script (action=sellout); neu chua deploy/loi thi tu dong fallback ve static
// snapshot (data/weekly-sellout.json).

window.MsiSalesData = (function () {
  'use strict';

  var rows = [];
  var meta = {};
  var loaded = false;

  async function fetchData() {
    var liveUrl = window.MSI_CONFIG.APPS_SCRIPT_URL + '?action=sellout&_=' + Date.now();
    try {
      var res = await fetch(liveUrl, { method: 'GET' });
      if (!res.ok) throw new Error('status ' + res.status);
      var json = await res.json();
      if (json.error) throw new Error(json.error);
      applyData_(json);
      return json;
    } catch (liveErr) {
      console.warn('[Sellout] Live fetch (action=sellout) chua san sang, dung static snapshot:', liveErr.message);
      var res2 = await fetch('data/weekly-sellout.json');
      if (!res2.ok) throw new Error('Weekly Sellout static fallback that bai: ' + res2.status);
      var json2 = await res2.json();
      applyData_(json2);
      return json2;
    }
  }

  function applyData_(json) {
    rows = json.rows || [];
    meta = json.meta || {};
    loaded = true;
  }

  function isLoaded() { return loaded; }
  function getMeta() { return meta; }

  // Tong Sell Out theo tuan, loc theo Series Group neu co (mang rong = tat ca).
  // weeks: mang nhan tuan can lay (vd cung danh sach tuan voi chart IHS de
  // 2 duong khop truc X). seriesGroups: mang string hoac rong.
  function weeklyTotal(weeks, seriesGroups) {
    var sgSet = null;
    if (seriesGroups && seriesGroups.length) {
      sgSet = {};
      seriesGroups.forEach(function (sg) { sgSet[sg] = true; });
    }
    var byWeek = {};
    rows.forEach(function (r) {
      if (sgSet && !sgSet[r.sg]) return;
      byWeek[r.w] = (byWeek[r.w] || 0) + (r.sellOut || 0);
    });
    return weeks.map(function (w) {
      return byWeek[w] !== undefined ? byWeek[w] : null;
    });
  }

  return {
    fetchData: fetchData,
    isLoaded: isLoaded,
    getMeta: getMeta,
    weeklyTotal: weeklyTotal
  };
})();
