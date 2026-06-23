// MSI Vietnam Dashboard - Userbuy Tracking tab - App orchestration

(function () {
  'use strict';

  var FS = window.MsiUserbuyFilterState;
  var UB = window.MsiUserbuyData;
  var DI = window.MsiDistyInvData;
  var DS = window.MsiDealerSelloutData;
  var MS = window.MsiMonthlySalesData;
  var WU = window.MsiWeekUtils;
  var CH = window.MsiUserbuyCharts;
  var TB = window.MsiUserbuyTables;
  var fmt = window.MsiFormat;

  var yearTs, quarterTs, seriesGroupTs;

  function init() {
    bindHeaderControls();
    FS.onChange(function (state) {
      syncControlsFromState(state);
      renderAll(state);
    });
    loadData(true);
  }
  async function loadData(isFirstLoad) {
    // Static-first loading:
    // fetchData(callback) trả về ngay sau khi static/localStorage sẵn sàng (~10-100ms).
    // GAS fetch chạy background, callback() sẽ trigger re-render khi có live data.
    document.getElementById('refreshBtn').classList.add('loading');

    function onModuleLiveReady() {
      // Được gọi khi 1 module nhận được GAS data mới → re-render im lặng
      // Nếu Year TomSelect đang trống (init lúc cache rỗng) → refresh options
      if (yearTs && yearTs.options && Object.keys(yearTs.options).length === 0) {
        var freshYears = UB.getYears();
        if (freshYears.length > 0) {
          freshYears.forEach(function (y) { yearTs.addOption({ value: y, text: y }); });
          yearTs.refreshOptions(false);
        }
      }
      if (seriesGroupTs && seriesGroupTs.options && Object.keys(seriesGroupTs.options).length === 0) {
        UB.getSeriesGroups().forEach(function (sg) { seriesGroupTs.addOption({ value: sg, text: sg }); });
        seriesGroupTs.refreshOptions(false);
      }
      updateMetaInfo();
      renderAll(FS.getState());
    }

    try {
      // Promise.all resolve sau khi cả 4 module có static/cached data (~10-100ms)
      await Promise.all([
        UB.fetchData(onModuleLiveReady),
        DI.fetchData(onModuleLiveReady),
        DS.fetchData(onModuleLiveReady),
        MS.fetchData(onModuleLiveReady)
      ]);
      // Render ngay với static/cached data
      hideError();
      updateMetaInfo();
      if (isFirstLoad) initSelects();
      renderAll(FS.getState());
    } catch (err) {
      console.error('[loadData]', err);
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
    });
    document.getElementById('refreshBtn').addEventListener('click', function () {
      // Clear localStorage cache de force re-fetch moi nhat tu GAS
      UB.clearCache();
      DI.clearCache();
      DS.clearCache();
      MS.clearCache();
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
      results.push({ type: 'Model', label: s.sku, sub: s.seg1 + ' &middot; ' + s.gpu, action: function () { FS.setModel(s.sku); } });
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
    seriesGroupTs = new TomSelect('#seriesGroupSelect', {
      options: UB.getSeriesGroups().map(function (sg) { return { value: sg, text: sg }; }),
      items: FS.getState().seriesGroups,
      plugins: ['remove_button'],
      placeholder: 'All Series Group',
      onChange: function (vals) { FS.setSeriesGroups(vals.slice()); }
    });
  }

  function syncControlsFromState(state) {
    if (yearTs) { yearTs.clear(true); state.years.forEach(function (y) { yearTs.addItem(y, true); }); }
    if (quarterTs) { quarterTs.clear(true); state.quarters.forEach(function (q) { quarterTs.addItem(q, true); }); }
    if (seriesGroupTs) { seriesGroupTs.clear(true); state.seriesGroups.forEach(function (sg) { seriesGroupTs.addItem(sg, true); }); }
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
      segment: state.segment, gpu: state.gpu, cpu: state.cpu, disty: state.disty,
      dealer: state.dealer  // cross-filter Dealers table -> Model Detail
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
  function avgSellOut4wkForDealer_(dealer, snapshotWeek, ubSkuSet) {
    if (!snapshotWeek) return 0;
    var weeks4 = WU.getRollingNWeekLabels(snapshotWeek, 4);
    var weekSet = {}; weeks4.forEach(function (w) { weekSet[w] = true; });
    var sum = 0;
    if (ubSkuSet && DS.hasByDealerModel()) {
      // Model filter active: use per-model sell out
      DS.getByDealerModel().forEach(function (r) {
        if (r.cust === dealer && weekSet[r.w] && ubSkuSet[r.sku]) sum += (r.sellOut || 0);
      });
    } else {
      DS.getByDealer().forEach(function (r) {
        if (r.cust === dealer && weekSet[r.w]) sum += (r.sellOut || 0);
      });
    }
    return sum / 4;
  }

  function avgSellOut4wkForDisty_(disty, snapshotWeek, ubSkuSet) {
    if (!snapshotWeek) return 0;
    var weeks4 = WU.getRollingNWeekLabels(snapshotWeek, 4);
    var weekSet = {}; weeks4.forEach(function (w) { weekSet[w] = true; });
    var sum = 0;
    if (ubSkuSet && DS.hasByDistyModel()) {
      DS.getByDistyModel().forEach(function (r) {
        if (r.disty === disty && weekSet[r.w] && ubSkuSet[r.sku]) sum += (r.sellOut || 0);
      });
    } else {
      DS.getByDisty().forEach(function (r) {
        if (r.disty === disty && weekSet[r.w]) sum += (r.sellOut || 0);
      });
    }
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
    // Re-read TB trong truong hop co race condition khi module loads
    if (!TB) TB = window.MsiUserbuyTables;
    if (!TB) { console.warn('[renderAll] MsiUserbuyTables chua san sang'); return; }
    // Chi can UB loaded la co the render snapshot + tables (DS/MS co the chua co)
    if (!UB.isLoaded()) return;

    var ubFilters = ubBaseFilters_(state);
    var periodWeeks = UB.getWeeksForState(ubFilters);
    if (!periodWeeks.length) periodWeeks = UB.getWeeksForState({ years: state.years, quarters: state.quarters });
    var last3 = getLast3WeekLabels_(periodWeeks);
    var snapshotWeek = periodWeeks.length ? periodWeeks[periodWeeks.length - 1] : WU.isoWeekLabel(new Date());

    var snap = WU.getInventorySnapshotPeriod(state.years, state.quarters, function (filterObj) {
      return UB.getWeeksForState({ years: filterObj.year, quarters: filterObj.quarter || [] });
    });

    renderSnapshotZone_(state, ubFilters, periodWeeks, snapshotWeek, snap);
    renderWeeklyTrend_(state, ubFilters);
    renderSeriesGroupChart_(state, ubFilters, periodWeeks);
    renderDimensionCharts_(state, ubFilters, periodWeeks);
    renderSegmentTable_(state, ubFilters, periodWeeks, last3, snap);
    renderGpuTable_(state, ubFilters, periodWeeks, last3, snap);
    renderDealersTable_(state, ubFilters, periodWeeks, last3, snap);
    renderDistyTable_(state, ubFilters, periodWeeks, last3, snap);
    renderModelDetailTable_(state, ubFilters, snap);
    renderEarlyWarning_(state, ubFilters, snap);
  }

  // Tong + YoY cho 1 bo dim filter rieng (de chong len ubFilters), tinh tren
  // dung danh sach 'weeks' truyen vao (khong phu thuoc Year/Quarter dropdown)
  function sumAndYoy_(baseFilters, overrides, weeks) {
    var f = cloneState_(baseFilters);
    Object.keys(overrides || {}).forEach(function (k) { f[k] = overrides[k]; });
    f.years = []; f.quarters = [];
    var thisQty = 0;
    UB.weeklySeries(f, weeks).forEach(function (s) { thisQty += (s.qty || 0); });
    var priorWeeks = weeks.map(function (w) { return (parseInt(w.slice(0, 4), 10) - 1) + w.slice(4); });
    var lastQty = 0;
    UB.weeklySeries(f, priorWeeks).forEach(function (s) { lastQty += (s.qty || 0); });
    var yoy = lastQty > 0 ? (thisQty - lastQty) / lastQty : null;
    return { qty: round2_(thisQty), lastQty: round2_(lastQty), yoy: yoy };
  }

  function yoyHtml_(yoy) {
    if (yoy === null || yoy === undefined) return '<span class="yoy-badge flat">YoY -</span>';
    var cls = yoy >= 0 ? 'up' : 'down';
    var arrow = yoy >= 0 ? '\u25B2' : '\u25BC';
    return '<span class="yoy-badge ' + cls + '">' + arrow + ' YoY ' + fmt.percentSigned(yoy, 0).replace(/^[+-]/, '') + '</span>';
  }

  // Tinh Top 10 model theo Userbuy cho 1 segment cu the trong period.
  // Tra ve [{sku, shortLabel, qty, pct}] - pct = qty / totalQty (toan bo period).
  // Cross-filter: dung ubFilters hien tai (year/quarter/gpu/cpu/disty...) tru segment.
  // seriesGroupName = 'Gaming' hoac 'Business& Productivity'
  // Gaming la sg (Series Group), KHONG phai seg1 (seg1 = Katana/Modern/Cyborg...)
  function computeTop10_(ubFilters, seriesGroupName, totalQty) {
    var segFilters = cloneState_(ubFilters);
    segFilters.seriesGroups = [seriesGroupName]; // override sang SG nay
    segFilters.model = null; // top10 hien tat ca model trong SG nay
    var skuTotals = {};
    UB.applyFilters(segFilters).forEach(function (f) {
      skuTotals[f.sku] = (skuTotals[f.sku] || 0) + (f.qty || 0);
    });
    return Object.keys(skuTotals)
      .map(function (sku) { return { sku: sku, qty: skuTotals[sku] }; })
      .filter(function (x) { return x.qty > 0; })
      .sort(function (a, b) { return b.qty - a.qty; })
      .slice(0, 10)
      .map(function (x) {
        // Rut gon label: bo phan "Katana 15 " o dau neu qua dai
        var label = x.sku;
        var pct = totalQty > 0 ? (x.qty / totalQty * 100) : 0;
        return { sku: x.sku, label: label, qty: x.qty, pct: pct };
      });
  }

  // Render danh sach Top10 vao 1 container (Gaming hoac B&P)
  // Items: [{sku, label, qty, pct}], maxPct: max % trong list (de scale bar)
  // onClickModel: callback khi click ten model -> cross-filter
  function renderTop10List_(containerId, items, maxPct) {
    var el = document.getElementById(containerId);
    if (!el) return;
    if (!items.length) { el.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;padding:8px 0;">No data</div>'; return; }
    var html = '';
    items.forEach(function (item, i) {
      var barW = maxPct > 0 ? Math.round(item.pct / maxPct * 100) : 0;
      var shortLabel = item.label.length > 22 ? item.label.slice(0, 20) + '...' : item.label;
      html += '<div class="top10-item" data-sku="' + escapeHtml(item.sku) + '" title="' + escapeHtml(item.label) + ' — ' + item.qty + ' units (' + item.pct.toFixed(1) + '%)">' +
        '<span class="top10-rank">' + (i + 1) + '</span>' +
        '<span class="top10-label">' + escapeHtml(shortLabel) + '</span>' +
        '<div class="top10-bar-track"><div class="top10-bar-fill" style="width:' + barW + '%"></div></div>' +
        '<span class="top10-pct">' + item.pct.toFixed(1) + '%</span>' +
        '</div>';
    });
    el.innerHTML = html;
    // Click model -> cross-filter model
    el.querySelectorAll('.top10-item[data-sku]').forEach(function (row) {
      row.addEventListener('click', function () {
        var sku = row.getAttribute('data-sku');
        var cur = FS.getState().model;
        FS.setModel(cur === sku ? null : sku);
      });
    });
  }

  function renderSnapshotZone_(state, ubFilters, periodWeeks, snapshotWeek, snap) {
    var w13 = periodWeeks.length > 13 ? periodWeeks.slice(periodWeeks.length - 13) : periodWeeks;

    // --- Total Userbuy hero + accumulate chart ---
    var total = sumAndYoy_(ubFilters, {}, w13);
    document.getElementById('kpiTotalNumber').textContent = fmt.number(total.qty);
    document.getElementById('kpiTotalYoy').innerHTML = yoyHtml_(total.yoy);

    var thisYearSeries = UB.weeklySeries(ubFilters, w13).map(function (s) { return s.qty || 0; });
    var priorWeeks = w13.map(function (w) { return (parseInt(w.slice(0, 4), 10) - 1) + w.slice(4); });
    var priorFilters = cloneState_(ubFilters); priorFilters.years = []; priorFilters.quarters = [];
    var lastYearSeries = UB.weeklySeries(priorFilters, priorWeeks).map(function (s) { return s.qty || 0; });
    CH.renderAccumulateBarChart('accumulateChart', w13, thisYearSeries, lastYearSeries);

    // --- Donut: ty trong theo Series Group ---
    var sgGroups = UB.groupBy(ubFilters, 'sg');
    var donutItems = Object.keys(sgGroups).map(function (k) { return { label: k, value: round2_(sgGroups[k].qty) }; })
      .sort(function (a, b) { return b.value - a.value; });
    CH.renderDonutChart('seriesGroupDonutChart', donutItems, function (label) {
      var s = FS.getState();
      var idx = s.seriesGroups.indexOf(label);
      var next = s.seriesGroups.slice();
      if (idx === -1) next.push(label); else next.splice(idx, 1);
      FS.setSeriesGroups(next);
    });

    // --- Top 10 Gaming + Top 10 B&P score cards ---
    var totalQty = total.qty || 0;
    var gamingTop10 = computeTop10_(ubFilters, 'Gaming', totalQty);
    var bnpTop10   = computeTop10_(ubFilters, 'Business& Productivity', totalQty);
    var gamingMaxPct = gamingTop10.length ? gamingTop10[0].pct : 0;
    var bnpMaxPct   = bnpTop10.length   ? bnpTop10[0].pct   : 0;
    renderTop10List_('top10GamingList', gamingTop10, gamingMaxPct);
    renderTop10List_('top10BnpList',   bnpTop10,   bnpMaxPct);

    // --- KPI tiles: Gaming / B&P / Handheld / Series50 / HighEnd / Disty SOH / Dealers SOH / WOI ---
    var gaming = sumAndYoy_(ubFilters, { seriesGroups: ['Gaming'] }, w13);
    var bnp = sumAndYoy_(ubFilters, { seriesGroups: ['Business& Productivity'] }, w13);
    var handheld = sumAndYoy_(ubFilters, { seriesGroups: ['Handheld'] }, w13);
    var series50 = sumAndYoy_(ubFilters, { series50Only: true }, w13);
    var highEnd = sumAndYoy_(ubFilters, { highEndOnly: true }, w13);

    var distySoh = snap.month ? DI.onHandAtMonth(snap.year, snap.month, ubFilters) : 0;
    var dealersSoh = snap.month ? MS.onHandAtMonth(snap.year, snap.month, ubFilters) : 0;
    var avgDemand = avgUserbuy4wk_(ubFilters, snapshotWeek);
    var overallWoi = computeWoi_(distySoh + dealersSoh, avgDemand);

    var tiles = [
      { label: 'Gaming', value: gaming.qty, yoy: gaming.yoy },
      { label: 'Business & Productivity', value: bnp.qty, yoy: bnp.yoy },
      { label: 'Handheld', value: handheld.qty, yoy: handheld.yoy },
      { label: 'Series 50 GPU', value: series50.qty, yoy: series50.yoy },
      { label: 'High-End', value: highEnd.qty, yoy: highEnd.yoy },
      { label: 'Disty SOH', value: distySoh, yoy: null, isStock: true },
      { label: 'Dealers SOH', value: dealersSoh, yoy: null, isStock: true },
      { label: 'WOI (blended)', value: overallWoi, yoy: null, isWoi: true }
    ];
    var gridEl = document.getElementById('kpiTileGrid');
    gridEl.innerHTML = tiles.map(function (t) {
      var valueText = t.isWoi ? (t.value === null ? '-' : t.value.toFixed(1) + 'w') : fmt.number(t.value);
      var sub = t.isStock || t.isWoi ? '<span class="val-flat">snapshot</span>' : yoyHtml_(t.yoy);
      return '<div class="kpi-tile"><div class="kpi-tile-label">' + escapeHtml(t.label) + '</div>' +
        '<div class="kpi-tile-value">' + valueText + '</div>' +
        '<div class="kpi-tile-yoy">' + sub + '</div></div>';
    }).join('');
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

    var forecastWeeks = WU.getNextNWeekLabels(weeks13[weeks13.length - 1], 3);
    CH.renderWeeklyTotalChart('weeklyTotalChart', weeks13, thisYearSeries, lastYearSeries, forecastWeeks);
  }

  function renderSeriesGroupChart_(state, ubFilters, weeks) {
    var w13 = weeks.length > 13 ? weeks.slice(weeks.length - 13) : weeks;
    var sgMap = {};
    UB.getSeriesGroups().forEach(function (sg) {
      var f = cloneState_(ubFilters); f.seriesGroups = [sg];
      sgMap[sg] = UB.groupBy(f, 'sg')[sg] || { qty: 0, rev: 0, byWeek: {} };
    });
    CH.renderMultiLineForecastChart('seriesGroupChart', w13, sgMap, {
      topN: 6, forecastN: 0, activeLabel: state.seriesGroups.length === 1 ? state.seriesGroups[0] : null,
      onLegendClick: function (sg) {
        var s = FS.getState();
        var idx = s.seriesGroups.indexOf(sg);
        var next = s.seriesGroups.slice();
        if (idx === -1) next.push(sg); else next.splice(idx, 1);
        FS.setSeriesGroups(next);
      }
    });
  }

  function renderDimensionCharts_(state, ubFilters, weeks) {
    var w13 = weeks.length > 13 ? weeks.slice(weeks.length - 13) : weeks;
    CH.renderMultiLineForecastChart('segmentBarChart', w13, UB.groupBy(ubFilters, 'seg1'), {
      topN: 6, forecastN: 3, activeLabel: state.segment, onLegendClick: function (v) { FS.setSegment(v); }
    });
    CH.renderMultiLineForecastChart('gpuBarChart', w13, UB.groupBy(ubFilters, 'gpu'), {
      topN: 6, forecastN: 3, activeLabel: state.gpu, onLegendClick: function (v) { FS.setGpu(v); }
    });
    CH.renderMultiLineForecastChart('cpuBarChart', w13, UB.groupBy(ubFilters, 'cpuSeg'), {
      topN: 6, forecastN: 3, activeLabel: state.cpu, onLegendClick: function (v) { FS.setCpu(v); }
    });
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
        woi: computeWoi_(totalOnHand, avgDemand), avgDemand: avgDemand, isEOL: false
      });
    });
    rows.sort(function (a, b) { return b.qty - a.qty; });
    return rows;
  }

  function renderSegmentTable_(state, ubFilters, periodWeeks, last3, snap) {
    var groups = UB.groupBy(ubFilters, 'seg1');
    var rows = buildMetricRows_(groups, last3,
      function (seg) { var f = cloneState_(ubFilters); f.segment = seg; return f; },
      function (seg) { if (!snap.month) return 0; var f = cloneState_(ubFilters); f.segment = seg; return MS.onHandAtMonth(snap.year, snap.month, f); },
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
      function (gpu) { if (!snap.month) return 0; var f = cloneState_(ubFilters); f.gpu = gpu; return MS.onHandAtMonth(snap.year, snap.month, f); },
      null
    );
    TB.renderMetricTable('gpuTable', {
      rows: rows, dimLabel: 'GPU', metricLabel: 'Userbuy', weekLabels: last3.map(weekLabelOrFallback_),
      activeValue: state.gpu, onRowClick: function (key) { FS.setGpu(key); }
    });
  }

  // Build tap hop SKU tu ubFilters (dung cho filter sell out theo model trong DS)
  // Tra ve null khi khong co dim filter active (show all models)
  function buildUbSkuSet_(ubFilters) {
    var hasDimFilter = !!(ubFilters.model || ubFilters.segment || ubFilters.gpu || ubFilters.cpu || ubFilters.disty);
    if (!hasDimFilter) return null;
    var set = {};
    UB.getSkus().filter(function (sk) {
      if (ubFilters.seriesGroups && ubFilters.seriesGroups.length && ubFilters.seriesGroups.indexOf(sk.sg) === -1) return false;
      if (ubFilters.highEndOnly && !sk.highEnd) return false;
      if (ubFilters.series50Only && !UB.isSeries50(sk.gpu)) return false;
      if (ubFilters.model && sk.sku !== ubFilters.model) return false;
      if (ubFilters.segment && sk.seg1 !== ubFilters.segment) return false;
      if (ubFilters.gpu && sk.gpu !== ubFilters.gpu) return false;
      if (ubFilters.cpu && sk.cpuSeg !== ubFilters.cpu) return false;
      if (ubFilters.disty && sk.disty !== ubFilters.disty) return false;
      return true;
    }).forEach(function (sk) { set[sk.sku] = true; });
    return Object.keys(set).length ? set : null;
  }

  // ===== Cross-filter helpers cho Dealers & Disty tables =====
  // Tra ve tap hop Disty can hien thi khi model/segment/gpu/cpu filter dang active.
  // Dua tren sk.disty trong UB SKU metadata - khong can them data moi tu GAS.
  // Tra ve null = khong filter (hien tat ca disty). Tra ve {} = khong match disty nao.
  // NOTE: khong filter theo ubFilters.disty (do la "self-filter" cua Disty table - chi highlight row).
  function getRelevantDistiesSet_(ubFilters) {
    var hasDimFilter = !!(ubFilters.model || ubFilters.segment || ubFilters.gpu || ubFilters.cpu);
    if (!hasDimFilter) return null; // khong co dim filter -> hien tat ca disty
    var matchingSkus = UB.getSkus().filter(function (sk) {
      if (ubFilters.seriesGroups && ubFilters.seriesGroups.length && ubFilters.seriesGroups.indexOf(sk.sg) === -1) return false;
      if (ubFilters.highEndOnly && !sk.highEnd) return false;
      if (ubFilters.series50Only && !UB.isSeries50(sk.gpu)) return false;
      if (ubFilters.model && sk.sku !== ubFilters.model) return false;
      if (ubFilters.segment && sk.seg1 !== ubFilters.segment) return false;
      if (ubFilters.gpu && sk.gpu !== ubFilters.gpu) return false;
      if (ubFilters.cpu && sk.cpuSeg !== ubFilters.cpu) return false;
      return true; // NOTE: khong filter theo disty o day
    });
    var distySet = {};
    matchingSkus.forEach(function (sk) { if (sk.disty) distySet[sk.disty] = true; });
    return distySet;
  }

  // Tra ve tap hop Dealer can hien thi khi model/segment/gpu/cpu/disty filter active.
  // Dua tren byDealerSkus (GAS v4+) de tim dealer nao co hang cac SKU phu hop.
  // Tra ve null = khong filter (fallback khi chua co data, hoac khong co dim filter).
  function getRelevantDealersSet_(ubFilters) {
    var hasDimFilter = !!(ubFilters.model || ubFilters.segment || ubFilters.gpu || ubFilters.cpu || ubFilters.disty);
    if (!hasDimFilter) return null; // khong co cross-filter -> hien tat ca dealer
    if (!MS.hasDealerSkus()) return null; // chua co byDealerSkus data -> fallback show all
    var matchingSkus = UB.getSkus().filter(function (sk) {
      if (ubFilters.seriesGroups && ubFilters.seriesGroups.length && ubFilters.seriesGroups.indexOf(sk.sg) === -1) return false;
      if (ubFilters.highEndOnly && !sk.highEnd) return false;
      if (ubFilters.series50Only && !UB.isSeries50(sk.gpu)) return false;
      if (ubFilters.model && sk.sku !== ubFilters.model) return false;
      if (ubFilters.segment && sk.seg1 !== ubFilters.segment) return false;
      if (ubFilters.gpu && sk.gpu !== ubFilters.gpu) return false;
      if (ubFilters.cpu && sk.cpuSeg !== ubFilters.cpu) return false;
      if (ubFilters.disty && sk.disty !== ubFilters.disty) return false;
      return true;
    });
    var dealerSet = {};
    matchingSkus.forEach(function (sk) {
      MS.getDealersForSku(sk.sku).forEach(function (d) { dealerSet[d] = true; });
    });
    return dealerSet;
  }

  function renderDealersTable_(state, ubFilters, periodWeeks, last3, snap) {
    var weekSet = {}; periodWeeks.forEach(function (w) { weekSet[w] = true; });
    // Cross-filter: chi hien thi dealers co hang cac SKU phu hop voi filter hien tai
    var relevantDealers = getRelevantDealersSet_(ubFilters);
    // Build SKU set de filter sell out theo model/segment/gpu/cpu/disty
    // Neu co byDealerModel data (GAS v4+): dung per-model sell out → con so chinh xac
    // Neu chua co: fallback sang byDealer aggregate (con so tong tat ca model)
    var ubSkuSet = buildUbSkuSet_(ubFilters);
    var groups = {};
    if (ubSkuSet && DS.hasByDealerModel()) {
      // Per-model sell out: chi tinh sell out cho cac SKU phu hop filter
      DS.getByDealerModel().forEach(function (r) {
        if (!weekSet[r.w]) return;
        if (relevantDealers !== null && !relevantDealers[r.cust]) return;
        if (!ubSkuSet[r.sku]) return; // filter by matching SKUs
        if (!groups[r.cust]) groups[r.cust] = { qty: 0, rev: 0, byWeek: {} };
        groups[r.cust].qty += r.sellOut;
        groups[r.cust].byWeek[r.w] = (groups[r.cust].byWeek[r.w] || 0) + r.sellOut;
      });
    } else {
      // Fallback: aggregate per dealer (tat ca model)
      DS.getByDealer().forEach(function (r) {
        if (!weekSet[r.w]) return;
        if (relevantDealers !== null && !relevantDealers[r.cust]) return;
        if (!groups[r.cust]) groups[r.cust] = { qty: 0, rev: 0, byWeek: {} };
        groups[r.cust].qty += r.sellOut;
        groups[r.cust].rev += r.rev;
        groups[r.cust].byWeek[r.w] = (groups[r.cust].byWeek[r.w] || 0) + r.sellOut;
      });
    }
    var rows = buildMetricRows_(groups, last3,
      function () { return null; }, // demand cho dealer dung rieng avgSellOut4wk_ ben duoi, khong dung avgUserbuy4wk_
      function (dealer) {
        if (!snap.month) return 0;
        if (ubSkuSet) {
          // Model/segment filter active: sum per-model onHand for this dealer
          var total = 0;
          Object.keys(ubSkuSet).forEach(function (sku) {
            total += MS.dealerModelOnHandAtMonth(dealer, sku, snap.year, snap.month);
          });
          // Fallback: neu byDealerModelOnHand chua co data (GAS chua deploy v6)
          // dung total dealer onHand (toan bo model) thay vi 0
          return total > 0 ? total : MS.dealerOnHandAtMonth(dealer, snap.year, snap.month);
        }
        return MS.dealerOnHandAtMonth(dealer, snap.year, snap.month);
      },
      null
    );
    // Ghi de WOI: dung avg Sell Out 4 tuan rieng cho Dealer (co filter theo model neu co data)
    rows.forEach(function (r) {
      var avgDemand = avgSellOut4wkForDealer_(r.key, last3[2], ubSkuSet);
      r.avgDemand = avgDemand;
      r.woi = computeWoi_(r.onHand, avgDemand);
    });
    TB.renderMetricTable('dealersTable', {
      rows: rows, dimLabel: 'Dealers', metricLabel: 'Sell Out', weekLabels: last3.map(weekLabelOrFallback_),
      activeValue: state.dealer, onRowClick: function (key) { FS.setDealer(key); },
      emptyMessage: 'Chưa có dữ liệu Weekly Sales Data cho giai đoạn đang chọn. ' +
        'Bản static hiện tại chỉ có 2025W01-W07 (giới hạn tải file). Bảng sẽ tự đầy đủ ngay khi Apps Script được deploy (xem DEPLOYMENT_INFO.md) - không cần sửa filter.'
    });
  }

  function renderDistyTable_(state, ubFilters, periodWeeks, last3, snap) {
    var weekSet = {}; periodWeeks.forEach(function (w) { weekSet[w] = true; });
    // Cross-filter: chi hien thi disty phan phoi cac SKU phu hop voi filter hien tai
    var relevantDisties = getRelevantDistiesSet_(ubFilters);
    var ubSkuSet = buildUbSkuSet_(ubFilters);
    var groups = {};
    if (ubSkuSet && DS.hasByDistyModel()) {
      // Per-model sell out: chi tinh sell out cua cac SKU phu hop filter
      DS.getByDistyModel().forEach(function (r) {
        if (!weekSet[r.w]) return;
        if (relevantDisties !== null && !relevantDisties[r.disty]) return;
        if (!ubSkuSet[r.sku]) return;
        if (!groups[r.disty]) groups[r.disty] = { qty: 0, rev: 0, byWeek: {} };
        groups[r.disty].qty += r.sellOut;
        groups[r.disty].byWeek[r.w] = (groups[r.disty].byWeek[r.w] || 0) + r.sellOut;
      });
    } else {
      DS.getByDisty().forEach(function (r) {
        if (!weekSet[r.w]) return;
        if (relevantDisties !== null && !relevantDisties[r.disty]) return;
        if (!groups[r.disty]) groups[r.disty] = { qty: 0, rev: 0, byWeek: {} };
        groups[r.disty].qty += r.sellOut;
        groups[r.disty].rev += r.rev;
        groups[r.disty].byWeek[r.w] = (groups[r.disty].byWeek[r.w] || 0) + r.sellOut;
      });
    }
    var distyOnHandMap = snap.month ? DI.onHandByDistyAtMonth(snap.year, snap.month, ubFilters) : {};
    var rows = buildMetricRows_(groups, last3,
      function (disty) { var f = cloneState_(ubFilters); f.disty = disty; return f; },
      function (disty) { if (!snap.month) return 0; var f = cloneState_(ubFilters); f.disty = disty; return MS.onHandAtMonth(snap.year, snap.month, f); },
      function (disty) { return distyOnHandMap[disty] || 0; }
    );
    // Ghi de WOI cho Disty: dung avg Sell Out 4 tuan co filter theo model neu co data
    rows.forEach(function (r) {
      var avgDemand = avgSellOut4wkForDisty_(r.key, last3[2], ubSkuSet);
      if (avgDemand > 0) {
        var totalOnHand = (r.onHand || 0) + (r.distyOnHand || 0);
        r.woi = computeWoi_(totalOnHand, avgDemand);
      }
    });
    TB.renderMetricTable('distyTable', {
      rows: rows, dimLabel: 'Disty', metricLabel: 'Sell Out', weekLabels: last3.map(weekLabelOrFallback_),
      activeValue: state.disty, onRowClick: function (key) { FS.setDisty(key); }, showDistyOnHand: true,
      emptyMessage: 'Chưa có dữ liệu Weekly Sales Data cho giai đoạn đang chọn. ' +
        'Bản static hiện tại chỉ có 2025W01-W07 (giới hạn tải file). Bảng sẽ tự đầy đủ ngay khi Apps Script được deploy (xem DEPLOYMENT_INFO.md) - không cần sửa filter.'
    });
  }

  function renderModelDetailTable_(state, ubFilters, snap) {
    var anchor = snap.week || WU.isoWeekLabel(new Date());
    var weeks13 = WU.getRollingNWeekLabels(anchor, 13);

    // Cross-filter Dealers -> Model Detail:
    // Khi 1 dealer duoc chon, xay dung tap cac SKU ma dealer do co inventory
    // (tu byDealerSkus trong Monthly Sales data). Neu dealer chua co data
    // (fallback hoac GAS cu chua deploy v2), bo qua bo loc nay de tranh mat data.
    var dealerSkuSet = null;
    if (ubFilters.dealer) {
      var dSkus = MS.getDealerSkus(ubFilters.dealer);
      if (dSkus.length > 0) {
        dealerSkuSet = {};
        dSkus.forEach(function (s) { dealerSkuSet[s] = true; });
      }
    }

    var skus = UB.getSkus().filter(function (sk) {
      if (ubFilters.seriesGroups.length && ubFilters.seriesGroups.indexOf(sk.sg) === -1) return false;
      if (ubFilters.highEndOnly && !sk.highEnd) return false;
      if (ubFilters.series50Only && !UB.isSeries50(sk.gpu)) return false;
      if (ubFilters.model && sk.sku !== ubFilters.model) return false;
      if (ubFilters.segment && sk.seg1 !== ubFilters.segment) return false;
      if (ubFilters.gpu && sk.gpu !== ubFilters.gpu) return false;
      if (ubFilters.cpu && sk.cpuSeg !== ubFilters.cpu) return false;
      if (ubFilters.disty && sk.disty !== ubFilters.disty) return false;
      // Neu dealer duoc chon va co byDealerSkus data: chi hien thi SKU dealer nay co hang
      if (dealerSkuSet && !dealerSkuSet[sk.sku]) return false;
      return true;
    });
    // Gioi han so dong hien thi (sap theo Total 13w giam dan) de tranh render qua nang
    var rows = skus.map(function (sk) {
      var series = UB.weeklySeries({ model: sk.sku, years: [], quarters: [] }, weeks13).map(function (s) { return s.qty || 0; });
      var total13 = series.reduce(function (a, v) { return a + v; }, 0);
      var onHand = snap.month ? MS.onHandAtMonth(snap.year, snap.month, { model: sk.sku }) : 0;
      var distyOnHand = DI.onHandAtMonth(snap.year, snap.month, { model: sk.sku });
      var avgDemand = total13 / 13 >= 0 ? (series.slice(-4).reduce(function (a, v) { return a + v; }, 0) / 4) : 0;
      return {
        sku: sk.sku, segment: sk.seg1, last13: series, total13: round2_(total13),
        onHand: round2_(onHand), distyOnHand: round2_(distyOnHand),
        woi: computeWoi_(onHand + distyOnHand, avgDemand), isEOL: String(sk.status).toUpperCase() === 'EOL'
      };
    }).filter(function (r) { return r.total13 > 0; })
      .sort(function (a, b) { return b.total13 - a.total13; }).slice(0, 60);

    TB.renderModelDetailTable('modelDetailTable', rows, weeks13, {
      activeValue: state.model,
      onRowClick: function (sku) {
        var s = FS.getState();
        FS.setModel(s.model === sku ? null : sku);
      }
    });
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
      var onHand = snap.month ? MS.onHandAtMonth(snap.year, snap.month, { model: sk.sku }) : 0;
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






