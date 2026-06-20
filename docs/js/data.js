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
      if (!matchesMulti(r.channel, filters.channel)) return false;
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
  // recentWeeks (tuy chon): mang 3 nhan tuan [tuan-2, tuan-1, tuan-0], giong
  // brandsTable(). Last3Wk/2Wk/1Wk gio la TONG TOAN THI TRUONG (ttlVol) cua dung
  // 3 tuan do tai dealer, tinh truc tiep tu data hang tuan - khong dung cot
  // last3Wk/last2Wk/lastWk co san trong sheet nua (ly do xem ghi chu brandsTable()).
  function dealersCapacityTable(filters, recentWeeks) {
    var weeks = getWeeksForFilters(filters);
    if (!weeks.length) return [];

    var customers = toArray(filters.customer).length ? toArray(filters.customer) : (meta.customers || []);

    // QUAN TRONG: Capacity/YoY/Last3-2-1Wk/WoW phai LUON brand-agnostic (toan thi truong),
    // bat ke filters.brand co dang duoc chon hay khong (vd khi click 1 brand o chart khac
    // de drill-in). Neu de filters.brand "tham" vao totalRows/brandRows, no se loc mat het
    // cac dong TTL (vi dong TTL co brand = "TTL Gaming" chu khong phai ten brand cu the) ->
    // capacity ve 0 -> ca bang/chart bien mat hoan toan. Fix: bo brand ra khoi filter dung
    // cho cac so lieu "toan thi truong", giong cach msiRows da lam dung (luon ep brand=MSI).
    var filtersNoBrand = Object.assign({}, filters);
    delete filtersNoBrand.brand;

    var filtersForRecent = Object.assign({}, filtersNoBrand);
    delete filtersForRecent.year;
    delete filtersForRecent.quarter;

    var rw = recentWeeks;
    if (!rw || !rw.length) {
      var globalWeeks = getWeeksForFilters(filtersForRecent);
      rw = globalWeeks.slice(-3);
      while (rw.length < 3) rw.unshift(null);
    }
    var wkN2 = rw[0] || null;
    var wkN1 = rw[1] || null;
    var wkN = rw[2] || null;

    return customers.map(function (cust) {
      var fNoBrand = Object.assign({}, filtersNoBrand, { customer: cust });
      var totalRows = applyFilters(fNoBrand).filter(function (r) { return r.isTotal; });
      // QUAN TRONG: lastYear chi duoc dien o dong brand rieng le (MSI, HP, Asus...)
      // trong sheet RAW - IHS, KHONG BAO GIO o dong TTL (isTotal=true).
      var brandRows = applyFilters(fNoBrand).filter(function (r) { return !r.isTotal; });
      var msiRows = applyFilters(Object.assign({}, fNoBrand, { brand: 'MSI' })).filter(function (r) { return !r.isTotal; });

      var capacity = sum(totalRows, 'ttlVol');
      var lastYearCapacity = sum(brandRows, 'lastYear');
      var yoy = lastYearCapacity > 0 ? (capacity - lastYearCapacity) / lastYearCapacity : null;

      var msiVolTotal = sum(msiRows, 'brandVol');
      var msiShare = capacity > 0 ? msiVolTotal / capacity : 0;

      // Volume rieng cua brand dang duoc filter o noi khac (vd click "Asus" tren chart Brand
      // shared) - dung cho "Key Dealers - Volume" chart de hien dung volume cua brand do
      // theo tung dealer, thay vi luon hien TTL capacity khong doi du da chon brand nao.
      var selectedBrandVolume = null;
      if (filters.brand) {
        var selFilters = Object.assign({}, filters, { customer: cust });
        var selRows = applyFilters(selFilters).filter(function (r) { return !r.isTotal; });
        selectedBrandVolume = sum(selRows, 'brandVol');
      }

      // Last3Wk/Last2Wk/LastWk: TONG ttlVol (toan thi truong) cua dung 3 tuan,
      // khong bi gioi han Year/Quarter.
      var fRecentTotal = Object.assign({}, filtersForRecent, { customer: cust });
      var recentTotalRows = applyFilters(fRecentTotal).filter(function (r) { return r.isTotal; });
      var byWeek = {};
      recentTotalRows.forEach(function (r) { byWeek[r.w] = (byWeek[r.w] || 0) + (r.ttlVol || 0); });

      var last3 = wkN2 && byWeek[wkN2] !== undefined ? byWeek[wkN2] : null;
      var last2 = wkN1 && byWeek[wkN1] !== undefined ? byWeek[wkN1] : null;
      var last1 = wkN && byWeek[wkN] !== undefined ? byWeek[wkN] : null;
      var wow = (last1 !== null && last2 !== null && last2 > 0) ? (last1 - last2) / last2 : null;

      return {

        customer: cust,
        capacity: capacity,
        lastYearCapacity: lastYearCapacity,
        selectedBrandVolume: selectedBrandVolume,
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
  // recentWeeks (tuy chon): mang 3 nhan tuan [tuan-2, tuan-1, tuan-0] (cu -> moi,
  // tuan-0 = gan nhat). Neu khong truyen, tu suy ra tu chinh data (brand-agnostic,
  // khong gioi han Year/Quarter). LastWk/Last2Wk/Last3Wk gio TU TINH truc tiep tu
  // brandVol cua dung 3 tuan do (KHONG dung cot rieng last3Wk/last2Wk/lastWk co san
  // trong sheet nua - cot do chi dien o 1 dong duy nhat va da chung minh khong dang
  // tin cay/de gay bug ve 0). Tra ve null (khong phai 0) khi tuan do chua co du lieu
  // (vd tuan hien tai chua duoc cao xong) de phan biet "chua co" voi "that su bang 0".
  function brandsTable(filters, recentWeeks) {
    var weeks = getWeeksForFilters(filters);
    if (!weeks.length) return [];
    var brands = filters.brand ? [filters.brand] : (meta.brands || []);

    var filtersForRecent = Object.assign({}, filters);
    delete filtersForRecent.year;
    delete filtersForRecent.quarter;
    delete filtersForRecent.brand;

    var rw = recentWeeks;
    if (!rw || !rw.length) {
      var globalWeeks = getWeeksForFilters(filtersForRecent);
      rw = globalWeeks.slice(-3);
      while (rw.length < 3) rw.unshift(null);
    }
    var wkN2 = rw[0] || null;
    var wkN1 = rw[1] || null;
    var wkN = rw[2] || null;

    var filtersNoBrandForTotal = Object.assign({}, filters);
    delete filtersNoBrandForTotal.brand;
    var totalRows = applyFilters(filtersNoBrandForTotal).filter(function (r) { return r.isTotal; });
    var grandTotal = sum(totalRows, 'ttlVol');

    return brands.map(function (brand) {
      var f = Object.assign({}, filters, { brand: brand });
      var rows = applyFilters(f).filter(function (r) { return !r.isTotal; });

      var volume = sum(rows, 'brandVol');
      var lastYearVol = sum(rows, 'lastYear');
      var yoy = lastYearVol > 0 ? (volume - lastYearVol) / lastYearVol : null;
      var shared = grandTotal > 0 ? volume / grandTotal : 0;

      var rowsForRecent = applyFilters(Object.assign({}, filtersForRecent, { brand: brand })).filter(function (r) { return !r.isTotal; });
      var byWeek = {};
      rowsForRecent.forEach(function (r) { byWeek[r.w] = (byWeek[r.w] || 0) + (r.brandVol || 0); });

      var last3 = wkN2 && byWeek[wkN2] !== undefined ? byWeek[wkN2] : null;
      var last2 = wkN1 && byWeek[wkN1] !== undefined ? byWeek[wkN1] : null;
      var last1 = wkN && byWeek[wkN] !== undefined ? byWeek[wkN] : null;
      var wow = (last1 !== null && last2 !== null && last2 > 0) ? (last1 - last2) / last2 : null;

      return {
        brand: brand,
        volume: volume,
        lastYearVol: lastYearVol,
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
  // Khi co filters.brand: KHONG loc rows theo brand do (se pha vo bieu do stacked
  // - moi dealer se chi con 1 mau, mat y nghia "mix"). Thay vao do, dung brand do
  // de SAP XEP lai top-8 dealer (dealer nao co volume brand do cao nhat len dau),
  // van hien thi day du % mix cua TAT CA brand cho cac dealer duoc chon - vua
  // "theo dung" brand filter vua giu nguyen y nghia bieu do.
  function dealerBrandShareMatrix(filters) {
    var customers = toArray(filters.customer).length ? toArray(filters.customer) : (meta.customers || []);
    var brands = meta.brands || [];
    var sortBrand = filters.brand || null;

    var results = customers.map(function (cust) {
      var f = Object.assign({}, filters, { customer: cust });
      var fNoBrand = Object.assign({}, f);
      delete fNoBrand.brand;
      var totalRows = applyFilters(fNoBrand).filter(function (r) { return r.isTotal; });
      var grandTotal = sum(totalRows, 'ttlVol');

      var brandVals = {};
      var brandVolumes = {};
      brands.forEach(function (brand) {
        var bf = Object.assign({}, fNoBrand, { brand: brand });
        var bRows = applyFilters(bf).filter(function (r) { return !r.isTotal; });
        var vol = sum(bRows, 'brandVol');
        brandVals[brand] = grandTotal > 0 ? vol / grandTotal : 0;
        brandVolumes[brand] = vol;
      });

      return { customer: cust, total: grandTotal, shares: brandVals, brandVolumes: brandVolumes };
    }).filter(function (d) { return d.total > 0; });

    if (sortBrand) {
      results.sort(function (a, b) { return (b.brandVolumes[sortBrand] || 0) - (a.brandVolumes[sortBrand] || 0); });
    } else {
      results.sort(function (a, b) { return b.total - a.total; });
    }
    return results;
  }

  // Danh sach Channel Type duy nhat (Telco, Retailer - Chain, CES, MD...)
  function getChannelTypes() {
    var set = {};
    rawRows.forEach(function (r) { if (r.channel) set[r.channel] = true; });
    return Object.keys(set).sort();
  }

  // MSI share / YoY / WoW theo tung Channel Type (field co san trong RAW-IHS
  // nhung chua duoc dung o dau ca - vi du Telco vs Retailer-Chain vs CES...)
  function channelTypeScorecard(filters) {
    var channels = getChannelTypes();
    var weeks = getWeeksForFilters(filters);
    var lastWeek = weeks.length ? weeks[weeks.length - 1] : null;
    var prevWeek = weeks.length > 1 ? weeks[weeks.length - 2] : null;

    return channels.map(function (ch) {
      var f = Object.assign({}, filters, { channel: ch });
      var fNoBrand = Object.assign({}, f);
      delete fNoBrand.brand;
      var totalRows = applyFilters(fNoBrand).filter(function (r) { return r.isTotal; });
      var msiRows = applyFilters(Object.assign({}, fNoBrand, { brand: 'MSI' })).filter(function (r) { return !r.isTotal; });

      var capacity = sum(totalRows, 'ttlVol');
      var msiCapacity = sum(msiRows, 'brandVol');

      var curWeekTtl = lastWeek ? sum(totalRows.filter(function (r) { return r.w === lastWeek; }), 'ttlVol') : 0;
      var curWeekMsi = lastWeek ? sum(msiRows.filter(function (r) { return r.w === lastWeek; }), 'brandVol') : 0;
      var prevWeekTtl = prevWeek ? sum(totalRows.filter(function (r) { return r.w === prevWeek; }), 'ttlVol') : 0;
      var prevWeekMsi = prevWeek ? sum(msiRows.filter(function (r) { return r.w === prevWeek; }), 'brandVol') : 0;
      var lastYearMsi = lastWeek ? sum(msiRows.filter(function (r) { return r.w === lastWeek; }), 'lastYear') : 0;

      var shareThisWeek = curWeekTtl > 0 ? curWeekMsi / curWeekTtl : null;
      var sharePrevWeek = prevWeekTtl > 0 ? prevWeekMsi / prevWeekTtl : null;
      var shareWow = (shareThisWeek !== null && sharePrevWeek !== null) ? (shareThisWeek - sharePrevWeek) : null;
      var yoy = (curWeekMsi > 0 && lastYearMsi > 0) ? (curWeekMsi - lastYearMsi) / lastYearMsi : null;

      // Volume rieng cua brand dang duoc cross-filter tu noi khac (vd click "Asus"
      // tren bang Brands) - de Channel Type Scorecard cung "theo" dung brand do,
      // giong cach selectedBrandVolume da lam o dealersCapacityTable.
      var selectedBrandVolume = null;
      if (filters.brand) {
        var selRows = applyFilters(f).filter(function (r) { return !r.isTotal; });
        selectedBrandVolume = sum(selRows, 'brandVol');
      }

      return {
        channel: ch,
        capacity: capacity,
        msiCapacity: msiCapacity,
        selectedBrandVolume: selectedBrandVolume,
        msiShareOverall: capacity > 0 ? msiCapacity / capacity : null,
        shareThisWeek: shareThisWeek,
        shareWow: shareWow,
        yoy: yoy
      };
    }).filter(function (r) { return r.capacity > 0; })
      .sort(function (a, b) { return b.capacity - a.capacity; });
  }

  // Whitespace: dealer co thi truong (TTL Volume / capacity) lon (>= median toan
  // thi truong) nhung MSI share lai duoi trung binh toan thi truong - tuc la
  // "co hoi lon, MSI khai thac chua toi". Dung nguong TUONG DOI (median/average)
  // thay vi 1 con so % co dinh, vi MSI share thuc te dao dong rat rong giua cac
  // dealer (~4% o dealer lon nhat den ~33% o dealer nho) tuy theo pham vi filter.
  function whitespaceList(filters) {
    var customers = toArray(filters.customer).length ? toArray(filters.customer) : (meta.customers || []);

    var list = customers.map(function (cust) {
      var f = Object.assign({}, filters, { customer: cust });
      var fNoBrand = Object.assign({}, f);
      delete fNoBrand.brand;
      var totalRows = applyFilters(fNoBrand).filter(function (r) { return r.isTotal; });
      var msiRows = applyFilters(Object.assign({}, fNoBrand, { brand: 'MSI' })).filter(function (r) { return !r.isTotal; });
      var capacity = sum(totalRows, 'ttlVol');
      var msiVolume = sum(msiRows, 'brandVol');
      return {
        customer: cust,
        capacity: capacity,
        msiVolume: msiVolume,
        share: capacity > 0 ? msiVolume / capacity : null
      };
    }).filter(function (r) { return r.capacity > 0 && r.share !== null; });

    if (!list.length) return [];

    var avgShare = list.reduce(function (acc, r) { return acc + r.share; }, 0) / list.length;
    var sortedCap = list.map(function (r) { return r.capacity; }).sort(function (a, b) { return a - b; });
    var medianCapacity = sortedCap[Math.floor(sortedCap.length / 2)];

    return list.filter(function (r) { return r.capacity >= medianCapacity && r.share < avgShare; })
      .map(function (r) { return Object.assign({}, r, { avgShare: avgShare }); })
      .sort(function (a, b) { return b.capacity - a.capacity; });
  }

  // Volatility: dealer co MSI share dao dong manh tuan-qua-tuan trong N tuan gan nhat
  // (dung do lech chuan cua chuoi share). Loai bo dealer share qua nho (< 0.5%) de
  // tranh nhieu/false-positive tu so lieu gan bang 0.
  function volatilityFlags(filters, n) {
    n = n || 8;
    var weeks = getLastNWeeksForFilters(filters, n);
    if (weeks.length < 3) return [];
    var customers = toArray(filters.customer).length ? toArray(filters.customer) : (meta.customers || []);

    return customers.map(function (cust) {
      var f = Object.assign({}, filters, { customer: cust });
      var fNoBrand = Object.assign({}, f);
      delete fNoBrand.brand;
      var totalRows = applyFilters(fNoBrand).filter(function (r) { return r.isTotal; });
      var msiRows = applyFilters(Object.assign({}, fNoBrand, { brand: 'MSI' })).filter(function (r) { return !r.isTotal; });

      var byWeekTtl = {};
      var byWeekMsi = {};
      totalRows.forEach(function (r) { byWeekTtl[r.w] = (byWeekTtl[r.w] || 0) + (r.ttlVol || 0); });
      msiRows.forEach(function (r) { byWeekMsi[r.w] = (byWeekMsi[r.w] || 0) + (r.brandVol || 0); });

      var shares = [];
      weeks.forEach(function (w) {
        var ttl = byWeekTtl[w] || 0;
        if (ttl > 0) shares.push((byWeekMsi[w] || 0) / ttl);
      });
      if (shares.length < 3) return null;

      var meanShare = shares.reduce(function (a, b) { return a + b; }, 0) / shares.length;
      var variance = shares.reduce(function (acc, s) { return acc + Math.pow(s - meanShare, 2); }, 0) / shares.length;
      var stdev = Math.sqrt(variance);
      var range = Math.max.apply(null, shares) - Math.min.apply(null, shares);

      return { customer: cust, meanShare: meanShare, stdev: stdev, range: range, weeksCount: shares.length };
    }).filter(function (r) { return r && r.meanShare >= 0.005; })
      .sort(function (a, b) { return b.stdev - a.stdev; });
  }

  // TTL volume (brand-agnostic) cho tuan gan nhat va tuan ngay truoc do, dung de
  // tinh WoW dung cach. KHONG dung cac cot lastWk/last2Wk/last3Wk cho viec nay -
  // 3 cot do la 3 SNAPSHOT TUAN RIENG LE (tuan hien tai, tuan -2, tuan -3 - co
  // mot khoang trong o tuan -1), khong phai tong don, nen lay hieu giua chung
  // KHONG cho ra "tuan truoc" chinh xac (da gay bug WoW sai lech hang nghin %).
  function grandWeeklyTrend(filters) {
    var weeks = getWeeksForFilters(filters);
    if (!weeks.length) return { lastWeekVol: 0, prevWeekVol: null, wow: null };
    var lastWeek = weeks[weeks.length - 1];
    var prevWeek = weeks.length > 1 ? weeks[weeks.length - 2] : null;
    var fNoBrand = Object.assign({}, filters);
    delete fNoBrand.brand;
    var totalRows = applyFilters(fNoBrand).filter(function (r) { return r.isTotal; });
    var lastWeekVol = sum(totalRows.filter(function (r) { return r.w === lastWeek; }), 'ttlVol');
    var prevWeekVol = prevWeek ? sum(totalRows.filter(function (r) { return r.w === prevWeek; }), 'ttlVol') : null;
    var wow = (lastWeekVol > 0 && prevWeekVol && prevWeekVol > 0) ? (lastWeekVol - prevWeekVol) / prevWeekVol : null;
    return { lastWeekVol: lastWeekVol, prevWeekVol: prevWeekVol, wow: wow };
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
    dealerBrandShareMatrix: dealerBrandShareMatrix,
    grandWeeklyTrend: grandWeeklyTrend,
    getChannelTypes: getChannelTypes,
    channelTypeScorecard: channelTypeScorecard,
    whitespaceList: whitespaceList,
    volatilityFlags: volatilityFlags
  };
})();
