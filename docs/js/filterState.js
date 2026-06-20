// MSI Vietnam Dashboard - Global filter state
// Quan ly trang thai filter dung chung cho toan bo dashboard (dropdown multi-select + click-to-filter)

window.MsiFilterState = (function () {
  'use strict';

  // Nam/Quy hien tai theo lich thuc te - dung lam mac dinh khi load trang
  // hoac khi bam Reset Filter (thay vi "All Years"/"All Quarters").
  function getCurrentYearQuarter_() {
    var today = new Date();
    var y = String(today.getFullYear());
    var q = 'Q' + (Math.floor(today.getMonth() / 3) + 1);
    return { year: y, quarter: q };
  }

  function defaultState_() {
    var cur = getCurrentYearQuarter_();
    return {
      years: [cur.year],     // mac dinh = nam hien tai (thay vi rong = All)
      quarters: [cur.quarter], // mac dinh = quy hien tai (thay vi rong = All)
      seriesGroups: [],
      customers: [],
      brand: null,
      weeksBack: 11
    };
  }

  var state = defaultState_();

  var listeners = [];

  function onChange(fn) {
    listeners.push(fn);
  }

  function notify() {
    listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { console.error('filter listener error', e); }
    });
  }

  // QUAN TRONG: Tom Select goi onChange(vals) voi 'vals' la THAM CHIEU TRUC TIEP
  // den mang 'items' noi bo cua no, khong phai ban copy. Neu luu thang tham chieu
  // do vao state.years roi sau nay dua chinh no nguoc lai cho ts.setValue(state.years),
  // setValue() se tu xoa items noi bo truoc khi gan lai - nhung vi la CUNG 1 mang,
  // thao tac xoa do lam rong luon gia tri dau vao -> chon xong lai bien mat.
  // Fix: luon .slice() de tao mang moi, cat dut moi tham chieu chia se.
  function setYears(arr) { state.years = (arr || []).slice(); notify(); }
  function setQuarters(arr) { state.quarters = (arr || []).slice(); notify(); }
  function setSeriesGroups(arr) { state.seriesGroups = (arr || []).slice(); notify(); }
  function setCustomers(arr) { state.customers = (arr || []).slice(); notify(); }

  // Click-to-filter tu bang/chart: chon dung 1 dealer (toggle)
  function setCustomer(cust) {
    if (state.customers.length === 1 && state.customers[0] === cust) {
      state.customers = [];
    } else {
      state.customers = [cust];
    }
    notify();
  }

  function setBrand(brand) {
    state.brand = (state.brand === brand) ? null : brand;
    notify();
  }

  function reset() {
    state = defaultState_();
    notify();
  }

  function getState() {
    // Clone mang de bat ky noi nao dung getState() cung khong the vo tinh
    // giu tham chieu song toi mang noi bo (xem ghi chu o setYears/...)
    return {
      years: state.years.slice(),
      quarters: state.quarters.slice(),
      seriesGroups: state.seriesGroups.slice(),
      customers: state.customers.slice(),
      brand: state.brand,
      weeksBack: state.weeksBack
    };
  }

  function getActiveFilterTags() {
    var tags = [];
    state.years.forEach(function (y) { tags.push({ type: 'year', label: y, value: y }); });
    state.quarters.forEach(function (q) { tags.push({ type: 'quarter', label: q, value: q }); });
    state.seriesGroups.forEach(function (sg) { tags.push({ type: 'seriesGroup', label: sg, value: sg }); });
    state.customers.forEach(function (c) { tags.push({ type: 'customer', label: c, value: c }); });
    if (state.brand) tags.push({ type: 'brand', label: state.brand, value: state.brand });
    return tags;
  }

  function clearTag(type, value) {
    if (type === 'year') state.years = state.years.filter(function (v) { return v !== value; });
    if (type === 'quarter') state.quarters = state.quarters.filter(function (v) { return v !== value; });
    if (type === 'seriesGroup') state.seriesGroups = state.seriesGroups.filter(function (v) { return v !== value; });
    if (type === 'customer') state.customers = state.customers.filter(function (v) { return v !== value; });
    if (type === 'brand') state.brand = null;
    notify();
  }

  return {
    onChange: onChange,
    setYears: setYears,
    setQuarters: setQuarters,
    setSeriesGroups: setSeriesGroups,
    setCustomers: setCustomers,
    setCustomer: setCustomer,
    setBrand: setBrand,
    reset: reset,
    getState: getState,
    getActiveFilterTags: getActiveFilterTags,
    clearTag: clearTag
  };
})();
