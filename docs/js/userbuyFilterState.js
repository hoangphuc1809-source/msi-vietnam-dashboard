// MSI Vietnam Dashboard - Userbuy Tracking tab - independent filter state
// RIENG voi MsiFilterState (Market Overall) - khong dung chung Year/Quarter/...
// theo dung yeu cau cua Phuc cho tab nay.

window.MsiUserbuyFilterState = (function () {
  'use strict';

  function getCurrentYearQuarter_() {
    var today = new Date();
    var y = String(today.getFullYear());
    var q = 'Q' + (Math.floor(today.getMonth() / 3) + 1);
    return { year: y, quarter: q };
  }

  function defaultState_() {
    var cur = getCurrentYearQuarter_();
    return {
      years: [cur.year],
      quarters: [cur.quarter],
      seriesGroups: [],
      highEndOnly: false,
      series50Only: false,
      model: null,       // marketing_sku dang chon (search by Model)
      segment: null,      // click-to-filter: SEGMENT1
      gpu: null,           // click-to-filter: GPU
      cpu: null,           // click-to-filter: CPU Segment
      disty: null,         // click-to-filter: Disty
      dealer: null,        // click-to-filter: Customer/Dealer
      searchQuery: ''       // global search bar
    };
  }

  var state = defaultState_();
  var listeners = [];

  function onChange(fn) { listeners.push(fn); }
  function notify() {
    listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { console.error('userbuy filter listener error', e); }
    });
  }

  function setYears(arr) { state.years = (arr || []).slice(); notify(); }
  function setQuarters(arr) { state.quarters = (arr || []).slice(); notify(); }
  function setSeriesGroups(arr) { state.seriesGroups = (arr || []).slice(); notify(); }

  function setHighEndOnly(v) { state.highEndOnly = !!v; notify(); }
  function setSeries50Only(v) { state.series50Only = !!v; notify(); }
  function setModel(model) { state.model = model || null; notify(); }

  function toggleField_(field, value) {
    state[field] = (state[field] === value) ? null : value;
    notify();
  }
  function setSegment(v) { toggleField_('segment', v); }
  function setGpu(v) { toggleField_('gpu', v); }
  function setCpu(v) { toggleField_('cpu', v); }
  function setDisty(v) { toggleField_('disty', v); }
  function setDealer(v) { toggleField_('dealer', v); }
  function setSearchQuery(q) { state.searchQuery = q || ''; notify(); }

  function reset() { state = defaultState_(); notify(); }

  function getState() {
    return {
      years: state.years.slice(),
      quarters: state.quarters.slice(),
      seriesGroups: state.seriesGroups.slice(),
      highEndOnly: state.highEndOnly,
      series50Only: state.series50Only,
      model: state.model,
      segment: state.segment,
      gpu: state.gpu,
      cpu: state.cpu,
      disty: state.disty,
      dealer: state.dealer,
      searchQuery: state.searchQuery
    };
  }

  function getActiveFilterTags() {
    var tags = [];
    state.years.forEach(function (y) { tags.push({ type: 'year', label: y, value: y }); });
    state.quarters.forEach(function (q) { tags.push({ type: 'quarter', label: q, value: q }); });
    state.seriesGroups.forEach(function (sg) { tags.push({ type: 'seriesGroup', label: sg, value: sg }); });
    if (state.highEndOnly) tags.push({ type: 'highEndOnly', label: 'High-End only', value: true });
    if (state.series50Only) tags.push({ type: 'series50Only', label: 'Series 50 GPU', value: true });
    if (state.model) tags.push({ type: 'model', label: state.model, value: state.model });
    if (state.segment) tags.push({ type: 'segment', label: state.segment, value: state.segment });
    if (state.gpu) tags.push({ type: 'gpu', label: state.gpu, value: state.gpu });
    if (state.cpu) tags.push({ type: 'cpu', label: state.cpu, value: state.cpu });
    if (state.disty) tags.push({ type: 'disty', label: state.disty, value: state.disty });
    if (state.dealer) tags.push({ type: 'dealer', label: state.dealer, value: state.dealer });
    return tags;
  }

  function clearTag(type) {
    if (type === 'year') state.years = [];
    if (type === 'quarter') state.quarters = [];
    if (type === 'seriesGroup') state.seriesGroups = [];
    if (type === 'highEndOnly') state.highEndOnly = false;
    if (type === 'series50Only') state.series50Only = false;
    if (type === 'model') state.model = null;
    if (type === 'segment') state.segment = null;
    if (type === 'gpu') state.gpu = null;
    if (type === 'cpu') state.cpu = null;
    if (type === 'disty') state.disty = null;
    if (type === 'dealer') state.dealer = null;
    notify();
  }

  return {
    onChange: onChange,
    setYears: setYears,
    setQuarters: setQuarters,
    setSeriesGroups: setSeriesGroups,
    setHighEndOnly: setHighEndOnly,
    setSeries50Only: setSeries50Only,
    setModel: setModel,
    setSegment: setSegment,
    setGpu: setGpu,
    setCpu: setCpu,
    setDisty: setDisty,
    setDealer: setDealer,
    setSearchQuery: setSearchQuery,
    reset: reset,
    getState: getState,
    getActiveFilterTags: getActiveFilterTags,
    clearTag: clearTag
  };
})();
