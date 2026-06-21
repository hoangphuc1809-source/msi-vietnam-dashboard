// MSI Vietnam Dashboard - Userbuy Tracking tab - App orchestration

(function () {
  'use strict';

  var FS = window.MsiUserbuyFilterState;
  var UB = window.MsiUserbuyData;
  var DI = window.MsiDistyInvData;
  var DS = window.MsiDealerSelloutData;
  var WU = window.MsiWeekUtils;
  var CH = window.MsiUserbuyCharts;
  var TB = window.MsiUserbuyTables;
  var fmt = window.MsiFormat;

  var yearTs, quarterTs, modelTs;

  function init() {
    bindHeaderControls();
    FS.onChange(function (state) {
      syncControlsFromState(state);
      renderAll(state);
    });
    loadData(true);
  }

  async function loadData(isFirstLoad) {
    try {
      document.getElementById('refreshBtn').classList.add('loading');
      await Promise.all([UB.fetchData(), DI.fetchData(), DS.fetchData()]);
      hideError();
      updateMetaInfo();
      if (isFirstLoad) initSelects();
      renderAll(FS.getState());
    } catch (err) {
      console.error(err);
      showError('Khong tai duoc du lieu: ' + err.message);
    } finally {
      document.getElementById('refreshBtn').classList.remove('loading');
    }
  }

  function showError(msg) {
    var el = document.getElementById('errorBanner');
    el.textContent = msg;
    el.classList.add('show');
  }
  function hideError() {
    document.getElementById('errorBanner').classList.remove('show');
  }

  function updateMetaInfo() {
    var ubMeta = UB.getMeta();
    var t = ubMeta.generatedAt ? new Date(ubMeta.generatedAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';
    document.getElementById('lastUpdated').textContent = t ? ('Updated ' + t) : 'Live';
  }

  function bindHeaderControls() {
    document.getElementById('resetFilterBtn').addEventListener('click', function () {
      FS.reset();
      if (modelTs) modelTs.clear(true);
    });
    document.getElementById('refreshBtn').addEventListener('click', function () {
      loadData(false);
    });
    document.getElementById('highEndPillBtn').addEventListener('click', function () {
      var s = FS.getState();
      FS.setHighEndOnly(!s.highEndOnly);
    });
    document.getElementById('series50PillBtn').addEventListener('click', function () {
      var s = FS.getState();
      FS.setSeries50Only(!s.series50Only);
    });

    var searchInput = document.getElementById('globalSearchInput');
    var searchResults = document.getElementById('globalSearchResults');
    var searchDebounce = null;
    searchInput.addEventListener('input', function () {
      var q = searchInput.value;
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(function () { renderGlobalSearch_(q, searchResults); }, 150);
    });
    document.addEventListener('click', function (e) {
      if (!searchResults.contains(e.target) && e.target !== searchInput) searchResults.innerHTML = '';
    });
  }

  // Search "anything": Model / Segment / GPU / CPU / Disty / Dealer - tra ve danh
  // sach goi y, click vao se set filter tuong ung (cross-filter)
  function renderGlobalSearch_(query, container) {
    query = String(query || '').trim();
    if (query.length < 2) { container.innerHTML = ''; return; }
    var ql = query.toLowerCase();
    var results = [];

    UB.searchModels(query, 8).forEach(function (s) {
      results.push({ type: 'Model', label: s.sku, sub: s.seg1 + ' &middot; ' + s.gpu, action: function () { FS.setModel(s.sku); if (modelTs) modelTs.setValue(s.sku, true); } });
    });
    UB.getSegments().forEach(function (s) {
      if (s.toLowerCase().indexOf(ql) !== -1 && results.length < 14) results.push({ type: 'Segment', label: s, sub: '', action: function () { FS.setSegment(s); } });
    });
    UB.getGpus().forEach(function (s) {
      if (s.toLowerCase().indexOf(ql) !== -1 && results.length < 14) results.push({ type: 'GPU', label: s, sub: '', action: function () { FS.setGpu(s); } });
    });
    UB.getCpuSegments().forEach(function (s) {
      if (s.toLowerCase().indexOf(ql) !== -1 && results.length < 14) results.push({ type: 'CPU', label: s, sub: '', action: function () { FS.setCpu(s); } });
    });
    UB.getDistys().forEach(function (s) {
      if (s.toLowerCase().indexOf(ql) !== -1 && results.length < 14) results.push({ type: 'Disty', label: s, sub: '', action: function () { FS.setDisty(s); } });
    });
    DS.getDealers().forEach(function (s) {
      if (s.toLowerCase().indexOf(ql) !== -1 && results.length < 14) results.push({ type: 'Dealer', label: s, sub: '', action: function () { FS.setDealer(s); } });
    });

    if (!results.length) { container.innerHTML = '<div class="global-search-result-item">No matches</div>'; return; }
    container.innerHTML = results.map(function (r, i) {
      return '<div class="global-search-result-item" data-idx="' + i + '"><span>' + escapeHtml(r.label) + '</span><span class="gsr-meta">' + r.type + (r.sub ? ' &middot; ' + r.sub : '') + '</span></div>';
    }).join('');
    container.querySelectorAll('[data-idx]').forEach(function (el) {
      el.addEventListener('click', function () {
        results[parseInt(el.getAttribute('data-idx'), 10)].action();
        container.innerHTML = '';
        document.getElementById('globalSearchInput').value = '';
      });
    });
  }

  function initSelects() {
    var years = UB.getYears();
    var quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    var models = UB.getSkus().slice().sort(function (a, b) { return a.sku.localeCompare(b.sku); });

    yearTs = new TomSelect('#yearSelect', {
      options: years.map(function (y) { return { value: y, text: y }; }),
      items: FS.getState().years,
      plugins: ['remove_button'],
      onChange: function (vals) { FS.setYears(vals.slice()); }
    });
    quarterTs = new TomSelect('#quarterSelect', {
      options: quarters.map(function (q) { return { value: q, text: q }; }),
      items: FS.getState().quarters,
      plugins: ['remove_button'],
      onChange: function (vals) { FS.setQuarters(vals.slice()); }
    });
    modelTs = new TomSelect('#modelSelect', {
      options: models.map(function (m) { return { value: m.sku, text: m.sku + ' (' + m.seg1 + ')' }; }),
      maxOptions: 800,
      placeholder: 'Search model...',
      onChange: function (val) { FS.setModel(val || null); }
    });

    renderSeriesGroupPills_();
  }

  function renderSeriesGroupPills_() {
    var sgs = UB.getSeriesGroups();
    var el = document.getElementById('seriesGroupPills');
    el.innerHTML = sgs.map(function (sg) {
      return '<button class="pill-btn" data-sg="' + escapeHtmlAttr(sg) + '">' + escapeHtml(sg) + '</button>';
    }).join('');
    el.querySelectorAll('[data-sg]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sg = btn.getAttribute('data-sg');
        var s = FS.getState();
        var idx = s.seriesGroups.indexOf(sg);
        var next = s.seriesGroups.slice();
        if (idx === -1) next.push(sg); else next.splice(idx, 1);
        FS.setSeriesGroups(next);
      });
    });
  }

  function syncControlsFromState(state) {
    if (yearTs) { yearTs.clear(true); state.years.forEach(function (y) { yearTs.addItem(y, true); }); }
    if (quarterTs) { quarterTs.clear(true); state.quarters.forEach(function (q) { quarterTs.addItem(q, true); }); }
    document.querySelectorAll('#seriesGroupPills [data-sg]').forEach(function (btn) {
      btn.classList.toggle('active', state.seriesGroups.indexOf(btn.getAttribute('data-sg')) !== -1);
    });
    document.getElementById('highEndPillBtn').classList.toggle('active', !!state.highEndOnly);
    document.getElementById('series50PillBtn').classList.toggle('active', !!state.series50Only);
    renderFilterTags_(state);
  }

  function renderFilterTags_(state) {
    var tags = FS.getActiveFilterTags();
    var el = document.getElementById('filterTags');
    el.innerHTML = tags.map(function (t) {
      return '<span class="filter-tag">' + escapeHtml(t.label) + '<button data-type="' + t.type + '">&times;</button></span>';
    }).join('');
    el.querySelectorAll('button[data-type]').forEach(function (b) {
      b.addEventListener('click', function () { FS.clearTag(b.getAttribute('data-type')); });
    });
  }

  // ===== Core compute helpers =====

  function cloneState_(state) {
    if (!state) return {};
    return JSON.parse(JSON.stringify(state));
  }

  function ubBaseFilters_(state) {
    return {
      years: state.years, quarters: state.quarters, seriesGroups: state.seriesGroups,
      highEndOnly: state.highEndOnly, series50Only: state.series50Only, model: state.model,
      segment: state.segment, gpu: state.gpu, cpu: state.cpu, disty: state.disty
    };
  }

  // Trung binh Userbuy 4 tuan KET THUC tai snapshotWeek, theo 1 bo dim filter rieng
  // (khong phu thuoc Year/Quarter dropdown - luon lay dung 4 tuan gan snapshot nhat)
  function avgUserbuy4wk_(dimFilters, snapshotWeek) {
    if (!snapshotWeek) return 0;
    var weeks4 = WU.getRollingNWeekLabels(snapshotWeek, 4);
    var f = cloneState_(dimFilters);
    f.years = []; f.quarters = [];
    var series = UB.weeklySeries(f, weeks4);
    var sum = 0;
    series.forEach(function (s) { sum += (s.qty || 0); });
    return sum / 4;
  }

  // Trung binh Sell Out 4 tuan KET THUC tai snapshotWeek cho 1 Dealer (dung cho
  // WOI bang Dealers - Userbuy khong gan duoc vao Dealer nen dung Sell Out lam
  // proxy nhu cau o cap do dealer)
  function avgSellOut4wkForDealer_(dealer, snapshotWeek) {
    if (!snapshotWeek) return 0;
    var weeks4 = WU.getRollingNWeekLabels(snapshotWeek, 4);
    var weekSet = {}; weeks4.forEach(function (w) { weekSet[w] = true; });
    var sum = 0;
    DS.getByDealer().forEach(function (r) {
      if (r.cust === dealer && weekSet[r.w]) sum += (r.sellOut || 0);
    });
    return sum / 4;
  }

  function computeWoi_(onHand, avgDemand) {
    if (!avgDemand || avgDemand <= 0) return null;
    return onHand / avgDemand;
  }

  function getLast3WeekLabels_(weeks) {
    var n = weeks.length;
    return [weeks[n - 3] || null, weeks[n - 2] || null, weeks[n - 1] || null];
  }

  // ===== Render orchestration =====

  function renderAll(state) {
    if (!UB.isLoaded() || !DI.isLoaded() || !DS.isLoaded()) return;

    var ubFilters = ubBaseFilters_(state);
    var periodWeeks = UB.getWeeksForState(ubFilters);
    if (!periodWeeks.length) periodWeeks = UB.getWeeksForState({ years: state.years, quarters: state.quarters });
    var last3 = getLast3WeekLabels_(periodWeeks);
    var snapshotWeek = periodWeeks.length ? periodWeeks[periodWeeks.length - 1] : WU.isoWeekLabel(new Date());

    var snap = WU.getInventorySnapshotPeriod(state.years, state.quarters, function (filterObj) {
      return UB.getWeeksForState({ years: filterObj.year, quarters: filterObj.quarter || [] });
    });

    renderWeeklyTrend_(state, ubFilters);
    renderSeriesGroupChart_(state, ubFilters, periodWeeks);
    renderDimensionCharts_(state, ubFilters);
    renderSegmentTable_(state, ubFilters, periodWeeks, last3, snap);
    renderGpuTable_(state, ubFilters, periodWeeks, last3, snap);
    renderDealersTable_(state, periodWeeks, last3, snap);
    renderDistyTable_(state, ubFilters, periodWeeks, last3, snap);
    renderModelDetailTable_(state, ubFilters, snap);
    renderEarlyWarning_(state, ubFilters, snap);
  }

  function renderWeeklyTrend_(state, ubFilters) {
    var anchor = WU.getRollingAnchorWeek(state.years, state.quarters, function (filterObj) {
      return UB.getWeeksForState({ years: filterObj.year, quarters: filterObj.quarter || [] });
    });
    var weeks13 = WU.getRollingNWeekLabels(anchor, 13);
    var thisYearSeries = UB.weeklySeries(ubFilters, weeks13).map(function (s) { return s.qty; });

    var priorWeeks = weeks13.map(function (w) { return (parseInt(w.slice(0, 4), 10) - 1) + w.slice(4); });
    var priorFilters = cloneState_(ubFilters); priorFilters.years = []; priorFilters.quarters = [];
    var lastYearSeries = UB.weeklySeries(priorFilters, priorWeeks).map(function (s) { return s.qty; });

    CH.renderWeeklyTotalChart('weeklyTotalChart', weeks13, thisYearSeries, lastYearSeries);
  }

  function renderSeriesGroupChart_(state, ubFilters, weeks) {
    var w13 = weeks.length > 13 ? weeks.slice(weeks.length - 13) : weeks;
    var sgMap = {};
    UB.getSeriesGroups().forEach(function (sg) {
      var f = cloneState_(ubFilters); f.seriesGroups = [sg];
      sgMap[sg] = UB.groupBy(f, 'sg')[sg] || { qty: 0, rev: 0, byWeek: {} };
    });
    CH.renderSeriesGroupStackedChart('seriesGroupChart', w13, sgMap);
  }

  function renderDimensionCharts_(state, ubFilters) {
    function topItems(field, limit) {
      var groups = UB.groupBy(ubFilters, field);
      var items = Object.keys(groups).map(function (k) { return { label: k, value: round2_(groups[k].qty) }; });
      items.sort(function (a, b) { return b.value - a.value; });
      return items.slice(0, limit || 10);
    }
    CH.renderDimensionBar('segmentBarChart', topItems('seg1', 12), function (label) { FS.setSegment(label); }, state.segment);
    CH.renderDimensionBar('gpuBarChart', topItems('gpu', 12), function (label) { FS.setGpu(label); }, state.gpu);
    CH.renderDimensionBar('cpuBarChart', topItems('cpuSeg', 10), function (label) { FS.setCpu(label); }, state.cpu);
  }

  function buildMetricRows_(groups, last3Weeks, dimFilterBuilder, onHandFn, distyOnHandFn) {
    var grandQty = 0;
    Object.keys(groups).forEach(function (k) { grandQty += groups[k].qty; });
    var rows = [];
    Object.keys(groups).forEach(function (key) {
      var g = groups[key];
      var l3 = last3Weeks.map(function (w) { return w ? (g.byWeek[w] || 0) : null; });
      var wow = (l3[2] !== null && l3[1]) ? (l3[2] - l3[1]) / l3[1] : null;
      var snapshotWeek = last3Weeks[2];
      var dimFilters = dimFilterBuilder(key);
      var avgDemand = dimFilters ? avgUserbuy4wk_(dimFilters, snapshotWeek) : 0;
      var onHand = onHandFn ? onHandFn(key, snapshotWeek) : 0;
      var distyOnHand = distyOnHandFn ? distyOnHandFn(key, snapshotWeek) : null;
      var totalOnHand = (distyOnHandFn ? (onHand + (distyOnHand || 0)) : onHand);
      rows.push({
        key: key, label: key, qty: round2_(g.qty), rev: g.rev,
        share: grandQty > 0 ? g.qty / grandQty : 0,
        last3: l3, wow: wow, onHand: round2_(onHand),
        distyOnHand: distyOnHand !== null ? round2_(distyOnHand) : null,
        woi: computeWoi_(totalOnHand, avgDemand), isEOL: false
      });
    });
    rows.sort(function (a, b) { return b.qty - a.qty; });
    return rows;
  }

  function renderSegmentTable_(state, ubFilters, periodWeeks, last3, snap) {
    var groups = UB.groupBy(ubFilters, 'seg1');
    var rows = buildMetricRows_(groups, last3,
      function (seg) { var f = cloneState_(ubFilters); f.segment = seg; return f; },
      function (seg, w) { return DS.segmentOnHandAtWeek(seg, w); },
      null
    );
    TB.renderMetricTable('segmentTable', {
      rows: rows, dimLabel: 'Segment', metricLabel: 'Userbuy', weekLabels: last3.map(weekLabelOrFallback_),
      activeValue: state.segment, onRowClick: function (key) { FS.setSegment(key); }
    });
  }

  function renderGpuTable_(state, ubFilters, periodWeeks, last3, snap) {
    var groups = UB.groupBy(ubFilters, 'gpu');
    var rows = buildMetricRows_(groups, last3,
      function (gpu) { var f = cloneState_(ubFilters); f.gpu = gpu; return f; },
      function (gpu, w) { return DS.gpuOnHandAtWeek(gpu, w); },
      null
    );
    TB.renderMetricTable('gpuTable', {
      rows: rows, dimLabel: 'GPU', metricLabel: 'Userbuy', weekLabels: last3.map(weekLabelOrFallback_),
      activeValue: state.gpu, onRowClick: function (key) { FS.setGpu(key); }
    });
  }

  function renderDealersTable_(state, periodWeeks, last3, snap) {
    var weekSet = {}; periodWeeks.forEach(function (w) { weekSet[w] = true; });
    var groups = {};
    DS.getByDealer().forEach(function (r) {
      if (!weekSet[r.w]) return;
      if (!groups[r.cust]) groups[r.cust] = { qty: 0, rev: 0, byWeek: {} };
      groups[r.cust].qty += r.sellOut;
      groups[r.cust].rev += r.rev;
      groups[r.cust].byWeek[r.w] = (groups[r.cust].byWeek[r.w] || 0) + r.sellOut;
    });
    var rows = buildMetricRows_(groups, last3,
      function () { return null; }, // demand cho dealer dung rieng avgSellOut4wk_ ben duoi, khong dung avgUserbuy4wk_
      function (dealer, w) { return DS.dealerOnHandAtWeek(dealer, w); },
      null
    );
    // Ghi de WOI: dung avg Sell Out 4 tuan rieng cho Dealer (xem ghi chu avgSellOut4wkForDealer_)
    rows.forEach(function (r) {
      var avgDemand = avgSellOut4wkForDealer_(r.key, last3[2]);
      r.woi = computeWoi_(r.onHand, avgDemand);
    });
    TB.renderMetricTable('dealersTable', {
      rows: rows, dimLabel: 'Dealers', metricLabel: 'Sell Out', weekLabels: last3.map(weekLabelOrFallback_),
      activeValue: state.dealer, onRowClick: function (key) { FS.setDealer(key); }
    });
  }

  function renderDistyTable_(state, ubFilters, periodWeeks, last3, snap) {
    var weekSet = {}; periodWeeks.forEach(function (w) { weekSet[w] = true; });
    var groups = {};
    DS.getByDisty().forEach(function (r) {
      if (!weekSet[r.w]) return;
      if (!groups[r.disty]) groups[r.disty] = { qty: 0, rev: 0, byWeek: {} };
      groups[r.disty].qty += r.sellOut;
      groups[r.disty].rev += r.rev;
      groups[r.disty].byWeek[r.w] = (groups[r.disty].byWeek[r.w] || 0) + r.sellOut;
    });
    var distyOnHandMap = snap.month ? DI.onHandByDistyAtMonth(snap.year, snap.month, ubFilters) : {};
    var rows = buildMetricRows_(groups, last3,
      function (disty) { var f = cloneState_(ubFilters); f.disty = disty; return f; },
      function (disty, w) { return DS.distyOnHandAtWeek(disty, w); },
      function (disty) { return distyOnHandMap[disty] || 0; }
    );
    TB.renderMetricTable('distyTable', {
      rows: rows, dimLabel: 'Disty', metricLabel: 'Sell Out', weekLabels: last3.map(weekLabelOrFallback_),
      activeValue: state.disty, onRowClick: function (key) { FS.setDisty(key); }, showDistyOnHand: true
    });
  }

  function renderModelDetailTable_(state, ubFilters, snap) {
    var anchor = snap.week || WU.isoWeekLabel(new Date());
    var weeks13 = WU.getRollingNWeekLabels(anchor, 13);
    var skus = UB.getSkus().filter(function (sk) {
      if (ubFilters.seriesGroups.length && ubFilters.seriesGroups.indexOf(sk.sg) === -1) return false;
      if (ubFilters.highEndOnly && !sk.highEnd) return false;
      if (ubFilters.series50Only && !UB.isSeries50(sk.gpu)) return false;
      if (ubFilters.model && sk.sku !== ubFilters.model) return false;
      if (ubFilters.segment && sk.seg1 !== ubFilters.segment) return false;
      if (ubFilters.gpu && sk.gpu !== ubFilters.gpu) return false;
      if (ubFilters.cpu && sk.cpuSeg !== ubFilters.cpu) return false;
      if (ubFilters.disty && sk.disty !== ubFilters.disty) return false;
      return true;
    });
    // Gioi han so dong hien thi (sap theo Total 13w giam dan) de tranh render qua nang
    var rows = skus.map(function (sk) {
      var series = UB.weeklySeries({ model: sk.sku, years: [], quarters: [] }, weeks13).map(function (s) { return s.qty || 0; });
      var total13 = series.reduce(function (a, v) { return a + v; }, 0);
      var onHand = DS.modelOnHandAtWeek(sk.sku, anchor);
      var distyOnHand = DI.onHandAtMonth(snap.year, snap.month, { model: sk.sku });
      var avgDemand = total13 / 13 >= 0 ? (series.slice(-4).reduce(function (a, v) { return a + v; }, 0) / 4) : 0;
      return {
        sku: sk.sku, segment: sk.seg1, last13: series, total13: round2_(total13),
        onHand: round2_(onHand), distyOnHand: round2_(distyOnHand),
        woi: computeWoi_(onHand + distyOnHand, avgDemand), isEOL: String(sk.status).toUpperCase() === 'EOL'
      };
    }).sort(function (a, b) { return b.total13 - a.total13; }).slice(0, 60);

    TB.renderModelDetailTable('modelDetailTable', rows, weeks13);
  }

  function renderEarlyWarning_(state, ubFilters, snap) {
    var anchor = snap.week || WU.isoWeekLabel(new Date());
    var weeks4 = WU.getRollingNWeekLabels(anchor, 4);
    var oos = [];
    var slowMoving = [];
    var skus = UB.getSkus().filter(function (sk) { return String(sk.status).toUpperCase() !== 'EOL'; });

    skus.forEach(function (sk) {
      var series = UB.weeklySeries({ model: sk.sku, years: [], quarters: [] }, weeks4).map(function (s) { return s.qty || 0; });
      var avg4 = series.reduce(function (a, v) { return a + v; }, 0) / 4;
      if (avg4 < 1) return; // bo qua model qua it nhu cau, khong co y nghia canh bao
      var onHand = DS.modelOnHandAtWeek(sk.sku, anchor);
      var distyOnHand = DI.onHandAtMonth(snap.year, snap.month, { model: sk.sku });

      if (distyOnHand <= 0 && onHand < avg4 * 0.5) {
        oos.push({ label: sk.sku, onHand: onHand, distyOnHand: distyOnHand });
      }
      var totalOnHand = onHand + distyOnHand;
      var woi = computeWoi_(totalOnHand, avg4);
      if (woi !== null && woi > 20 && series.length === 4 && series[3] < series[2] && series[2] < series[1]) {
        var trend3w = series[1] > 0 ? (series[3] - series[1]) / series[1] : null;
        slowMoving.push({ label: sk.sku, woi: woi, trend3w: trend3w });
      }
    });
    oos.sort(function (a, b) { return a.onHand - b.onHand; });
    slowMoving.sort(function (a, b) { return b.woi - a.woi; });
    TB.renderEarlyWarningPanel('earlyWarningPanel', { oos: oos.slice(0, 8), slowMoving: slowMoving.slice(0, 8) });
  }

  function weekLabelOrFallback_(w) { return w || '-'; }
  function round2_(n) { return Math.round((n || 0) * 100) / 100; }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escapeHtmlAttr(s) { return escapeHtml(s); }

  document.addEventListener('DOMContentLoaded', init);
})();
