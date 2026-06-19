// MSI Vietnam Dashboard - Global filter state
// Quan ly trang thai filter dung chung cho toan bo dashboard (dropdown multi-select + click-to-filter)

window.MsiFilterState = (function () {
  'use strict';

  var state = {
    years: [],         // array of 'Y2026'... ; rong = All
    quarters: [],       // array of 'Q1'... ; rong = All
    seriesGroups: [],   // array of 'Gaming' | 'Business& Productivity' | 'Handheld' ; rong = All
    customers: [],       // array ten dealer (Dealers dropdown, multi-select) ; rong = All
    brand: null,          // single - click-to-filter tu legend/bar (giu nguyen UX cu)
    weeksBack: 11           // so tuan hien thi tren trend chart
  };

  var listeners = [];

  function onChange(fn) {
    listeners.push(fn);
  }

  function notify() {
    listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { console.error('filter listener error', e); }
    });
  }

  function setYears(arr) { state.years = arr || []; notify(); }
  function setQuarters(arr) { state.quarters = arr || []; notify(); }
  function setSeriesGroups(arr) { state.seriesGroups = arr || []; notify(); }
  function setCustomers(arr) { state.customers = arr || []; notify(); }

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
    state = { years: [], quarters: [], seriesGroups: [], customers: [], brand: null, weeksBack: state.weeksBack };
    notify();
  }

  function getState() {
    return Object.assign({}, state);
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
