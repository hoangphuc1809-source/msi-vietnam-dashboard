// MSI Vietnam Dashboard - Global filter state
// Quan ly trang thai filter dung chung cho toan bo dashboard (click-to-filter)

window.MsiFilterState = (function () {
  'use strict';

  var state = {
    seriesGroup: null,  // 'Gaming' | 'Business& Productivity' | null (= All)
    customer: null,      // ten dealer hoac null
    brand: null,          // ten brand hoac null (khi click vao 1 brand trong legend/bar)
    weeksBack: 11          // so tuan hien thi tren trend chart (mac dinh 11 tuan giong anh mau)
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

  function setSeriesGroup(sg) {
    state.seriesGroup = (state.seriesGroup === sg) ? null : sg;
    notify();
  }

  function setCustomer(cust) {
    state.customer = (state.customer === cust) ? null : cust;
    notify();
  }

  function setBrand(brand) {
    state.brand = (state.brand === brand) ? null : brand;
    notify();
  }

  function reset() {
    state = { seriesGroup: null, customer: null, brand: null, weeksBack: state.weeksBack };
    notify();
  }

  function getState() {
    return Object.assign({}, state);
  }

  function getActiveFilterTags() {
    var tags = [];
    if (state.seriesGroup) tags.push({ type: 'seriesGroup', label: state.seriesGroup, value: state.seriesGroup });
    if (state.customer) tags.push({ type: 'customer', label: state.customer, value: state.customer });
    if (state.brand) tags.push({ type: 'brand', label: state.brand, value: state.brand });
    return tags;
  }

  function clearTag(type) {
    if (type === 'seriesGroup') state.seriesGroup = null;
    if (type === 'customer') state.customer = null;
    if (type === 'brand') state.brand = null;
    notify();
  }

  return {
    onChange: onChange,
    setSeriesGroup: setSeriesGroup,
    setCustomer: setCustomer,
    setBrand: setBrand,
    reset: reset,
    getState: getState,
    getActiveFilterTags: getActiveFilterTags,
    clearTag: clearTag
  };
})();
