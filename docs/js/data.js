// MSI Vietnam Dashboard - Data layer
// Fetch + transform du lieu RAW - IHS tu Apps Script Web App

window.MsiData = (function () {
  'use strict';

  var rawRows = [];
  var meta = {};
  var listeners = [];

  function onUpdate(fn) {
    listeners.push(fn);
  }

  function notify() {
    listeners.forEach(function (fn) {
      try { fn(); } catch (e) { console.error('listener error', e); }
    });
  }

  async function fetchData() {
    var url = window.MSI_CONFIG.APPS_SCRIPT_URL + '?action=ihs&_=' + Date.now();
    var res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error('Fetch failed: ' + res.status);
    var json = await res.json();
    if (json.error) throw new Error(json.error);
    rawRows = json.rows || [];
    meta = json.meta || {};
    notify();
    return json;
  }

  function getMeta() {
    return meta;
  }

  function getRows() {
    return rawRows;
  }

  // ===== Filter helpers =====
  // filters: { seriesGroup: string|string[]|null, customer: string|string[]|null,
  //            year: string|string[]|null, quarter: string|string[]|null,
  //            weekFrom: string|null, weekTo: string|null, brand: string|null }
  // Moi key co the la 1 string (exact match - dung cho cac vong lap override noi bo)
  // hoac 1 array (multi-select tu dropdown UI; mang rong = khong loc / All)
  function matchesMulti(rowVal, filterVal) {
    if (filterVal === undefined || filterVal === null || filterVal === '') return true;
    if (Array.isArray(filterVal)) {
      if (filterVal.length === 0) return true;
      return filterVal.indexOf(rowVal) !== -1;
    }
    return rowVal === filterVal;
  }

  // Chuan hoa 1 filter value (string|string[]|null) thanh array de dung lam danh sach duyet
  function toArray(v) {
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  }

  function applyFilters(filters) {
    filters = filters || {};
    return rawRows.filter(function (r) {
      if (!matchesMulti(r.sg, filters.seriesGroup)) return false;
      if (!matchesMulti(r.cust, filters.customer)) return false;
      if (!matchesMulti(r.brand, filters.brand)) return false;
      if (!matchesMulti(yearOfWeek(r.w), filters.year)) return false;
      if (!matchesMulti(r.q, filters.quarter)) return false;
      if (filters.weekFrom && r.w < filters.weekFrom) return false;
      if (filters.weekTo && r.w > filters.weekTo) return false;
      return true;
    });
  }

  // Danh sach week duy nhat, sap xep tang dan
  function getWeeks() {
    var set = {};
    rawRows.forEach(function (r) { if (r.w) set[r.w] = true; });
    return Object.keys(set).sort();
  }

  // Lay N tuan gan nhat (dua tren toan bo rawRows, khong theo filter)
  function getLastNWeeks(n) {
    var weeks = getWeeks();
    return weeks.slice(Math.max(0, weeks.length - n));
  }

  // Danh sach week duy nhat CHI trong pham vi filter hien tai (vd khi da chon Year=2024,
  // danh sach tuan se chi gom cac tuan thuoc 2024, khong phai tuan gan nhat toan cuc)
  function getWeeksForFilters(filters) {
    var set = {};
    applyFilters(filters).forEach(function (r) { if (r.w) set[r.w] = true; });
    return Object.keys(set).sort();
  }

  // Lay N tuan gan nhat TRONG PHAM VI filter (dung cho cac chart theo tuan de
  // ton trong dung Year/Quarter/Series/Dealers dang duoc chon, thay vi luon
  // mac dinh ve N tuan gan nhat toan cuc bat ke filter)
  function getLastNWeeksForFilters(filters, n) {
    var weeks = getWeeksForFilters(filters);
    return weeks.slice(Math.max(0, weeks.length - n));
  }

  // Lay 4 ky tu dau cua Week ('2026W24' -> '2026'). Dung de loc/list nam thay vi
  // phu thuoc cot Year rieng trong sheet (co the bi dien thieu/khong nhat quan
  // cho cac dong moi); cot Week luon duoc dien day du va dang tin cay hon.
  function yearOfWeek(w) {
    return (w && w.length >= 4) ? w.slice(0, 4) : '';
  }

  // Danh sach Year duy nhat (suy ra tu Week, vd '2026'), sap xep tang dan
  function getYears() {
    var set = {};
    rawRows.forEach(function (r) { var y = yearOfWeek(r.w); if (y) set[y] = true; });
    return Object.keys(set).sort();
  }

  // Danh sach Quarter duy nhat ('Q1'...'Q4'), sap xep tang dan
  function getQuarters() {
    var set = {};
    rawRows.forEach(function (r) { if (r.q) set[r.q] = true; });
    return Object.keys(set).sort();
  }

  // ===== Aggregations =====

  // MSI weekly Sell-Out (volume) toan thi truong (tat ca dealers), theo Series Group filter
  function msiWeeklyVolume(filters, weeks) {
    var f = Object.assign({}, filters, { brand: 'MSI' });
    var rows = applyFilters(f).filter(function (r) { return !r.isTotal; });
    var byWeek = {};
    rows.forEach(function (r) {
      byWeek[r.w] = (byWeek[r.w] || 0) + (r.brandVol || 0);
    });
    return weeks.map(function (w) { return { week: w, value: byWeek[w] || 0 }; });
  }

  // Key Dealers weekly total volume (TTL Volume cua tat ca series group cho 1 customer/week)
  // Dung dong isTotal=true va cong don cac series group lai (vi 1 customer co the co ca Gaming + B&P)
  function dealerWeeklyVolume(customer, filters, weeks) {
    var f = Object.assign({}, filters, { customer: customer });
    var rows = applyFilters(f).filter(function (r) { return r.isTotal; });
    var byWeek = {};
    rows.forEach(function (r) {
      byWeek[r.w] = (byWeek[r.w] || 0) + (r.ttlVol || 0);
    });
    return weeks.map(function (w) { return { week: w, value: byWeek[w] || 0 }; });
  }

  // Dealers Capacity table: cho tat ca customers, tinh TTL volume (capacity), YoY, MSI share,
  // Last3Wk/Last2Wk/LastWk (theo brand=MSI block, hoac theo TTL neu can dealer-level)
  function dealersCapacityTable(filters) {
    var weeks = getWeeksForFilters(filters);
    if (!weeks.length) return [];
    var lastWeek = weeks[weeks.length - 1];

    var customers = toArray(filters.customer).length ? toArray(filters.customer) : (meta.customers || []);

    return customers.map(function (cust) {
      var f = Object.assign({}, filters, { customer: cust });
      var totalRows = applyFilters(f).filter(function (r) { return r.isTotal; });
      // QUAN TRONG: lastYear/lastWk/last2Wk/last3Wk chi duoc dien o dong brand rieng le
      // (MSI, HP, Asus...) trong sheet RAW - IHS, KHONG BAO GIO o dong TTL (isTotal=true).
      // Phai cong don tu brandRows, giong cach brandsTable() da lam dung.
      var brandRows = applyFilters(f).filter(function (r) { return !r.isTotal; });
      var msiRows = applyFilters(Object.assign({}, f, { brand: 'MSI' })).filter(function (r) { return !r.isTotal; });

      var capacity = sum(totalRows, 'ttlVol');
      var lastYearCapacity = sum(brandRows, 'lastYear');
      var yoy = lastYearCapacity > 0 ? (capacity - lastYearCapacity) / lastYearCapacity : null;

      var msiVolTotal = sum(msiRows, 'brandVol');
      var msiShare = capacity > 0 ? msiVolTotal / capacity : 0;

      // Last3Wk/Last2Wk/LastWk: lay tu cac dong brand co w === lastWeek (cac cot lastWk/last2Wk/last3Wk
      // da duoc tinh san trong sheet IHS cho tuan hien tai, chi o dong brand)
      var lastWeekBrandRows = brandRows.filter(function (r) { return r.w === lastWeek; });
      var last3 = sum(lastWeekBrandRows, 'last3Wk');
      var last2 = sum(lastWeekBrandRows, 'last2Wk');
      var last1 = sum(lastWeekBrandRows, 'lastWk');

      // WoW: tuan gan nhat so voi tuan truoc do (dua tren capacity 2 tuan cuoi)
      var prevWeek = weeks.length > 1 ? weeks[weeks.length - 2] : null;
      var curWeekVol = sum(totalRows.filter(function (r) { return r.w === lastWeek; }), 'ttlVol');
      var prevWeekVol = prevWeek ? sum(totalRows.filter(function (r) { return r.w === prevWeek; }), 'ttlVol') : null;
      var wow = (curWeekVol > 0 && prevWeekVol && prevWeekVol > 0) ? (curWeekVol - prevWeekVol) / prevWeekVol : null;

      return {
        customer: cust,
        capacity: capacity,
        yoy: yoy,
        msiShare: msiShare,
        last3Wk: last3,
        last2Wk: last2,
        lastWk: last1,
        wow: wow
      };
    }).filter(function (row) { return row.capacity > 0; })
      .sort(function (a, b) { return b.capacity - a.capacity; });
  }

  // Brands table: cho tat ca brands (toan thi truong hoac 1 dealer neu filter.customer set)
  function brandsTable(filters) {
    var weeks = getWeeksForFilters(filters);
    if (!weeks.length) return [];
    var lastWeek = weeks[weeks.length - 1];
    var brands = filters.brand ? [filters.brand] : (meta.brands || []);

    var totalRows = applyFilters(Object.assign({}, filters)).filter(function (r) { return r.isTotal; });
    var grandTotal = sum(totalRows, 'ttlVol');

    return brands.map(function (brand) {
      var f = Object.assign({}, filters, { brand: brand });
      var rows = applyFilters(f).filter(function (r) { return !r.isTotal; });

      var volume = sum(rows, 'brandVol');
      var lastYearVol = sum(rows, 'lastYear');
      var yoy = lastYearVol > 0 ? (volume - lastYearVol) / lastYearVol : null;
      var shared = grandTotal > 0 ? volume / grandTotal : 0;

      var lastWeekRows = rows.filter(function (r) { return r.w === lastWeek; });
      var last3 = sum(lastWeekRows, 'last3Wk');
      var last2 = sum(lastWeekRows, 'last2Wk');
      var last1 = sum(lastWeekRows, 'lastWk');

      var weeks2 = weeks;
      var prevWeek = weeks2.length > 1 ? weeks2[weeks2.length - 2] : null;
      var curWeekVol = sum(rows.filter(function (r) { return r.w === lastWeek; }), 'brandVol');
      var prevWeekVol = prevWeek ? sum(rows.filter(function (r) { return r.w === prevWeek; }), 'brandVol') : null;
      var wow = (curWeekVol > 0 && prevWeekVol && prevWeekVol > 0) ? (curWeekVol - prevWeekVol) / prevWeekVol : null;

      return {
        brand: brand,
        volume: volume,
        shared: shared,
        yoy: yoy,
        last3Wk: last3,
        last2Wk: last2,
        lastWk: last1,
        wow: wow
      };
    }).filter(function (row) { return row.volume > 0 || row.brand === 'MSI'; })
      .sort(function (a, b) { return b.volume - a.volume; });
  }

  // Stacked share theo dealer (cho 100% stacked bar chart): cho moi dealer, % cua tung brand
  function dealerBrandShareMatrix(filters) {
    var customers = toArray(filters.customer).length ? toArray(filters.customer) : (meta.customers || []);
    var brands = meta.brands || [];

    return customers.map(function (cust) {
      var f = Object.assign({}, filters, { customer: cust });
      var totalRows = applyFilters(f).filter(function (r) { return r.isTotal; });
      var grandTotal = sum(totalRows, 'ttlVol');

      var brandVals = {};
      brands.forEach(function (brand) {
        var bf = Object.assign({}, f, { brand: brand });
        var bRows = applyFilters(bf).filter(function (r) { return !r.isTotal; });
        var vol = sum(bRows, 'brandVol');
        brandVals[brand] = grandTotal > 0 ? vol / grandTotal : 0;
      });

      return { customer: cust, total: grandTotal, shares: brandVals };
    }).filter(function (d) { return d.total > 0; })
      .sort(function (a, b) { return b.total - a.total; });
  }

  function sum(rows, field) {
    return rows.reduce(function (acc, r) { return acc + (r[field] || 0); }, 0);
  }

  return {
    fetchData: fetchData,
    onUpdate: onUpdate,
    getMeta: getMeta,
    getRows: getRows,
    getWeeks: getWeeks,
    getLastNWeeks: getLastNWeeks,
    getWeeksForFilters: getWeeksForFilters,
    getLastNWeeksForFilters: getLastNWeeksForFilters,
    getYears: getYears,
    getQuarters: getQuarters,
    applyFilters: applyFilters,
    msiWeeklyVolume: msiWeeklyVolume,
    dealerWeeklyVolume: dealerWeeklyVolume,
    dealersCapacityTable: dealersCapacityTable,
    brandsTable: brandsTable,
    dealerBrandShareMatrix: dealerBrandShareMatrix
  };
})();
