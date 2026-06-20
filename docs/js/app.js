// MSI Vietnam Dashboard - Main App Orchestrator

(function () {
  'use strict';

  var D = window.MsiData;
  var NV = window.MsiNvData;
  var SD = window.MsiSalesData;
  var F = window.MsiFilterState;
  var Charts = window.MsiCharts;
  var Tables = window.MsiTables;
  var fmt = window.MsiFormat;

  var refreshTimer = null;
  var ts = { year: null, quarter: null, dealers: null };
  var selectsReady = false;
  var nvReady = false;
  var sdReady = false;

  var SG_LABEL = { 'Gaming': 'Gaming', 'Business& Productivity': 'B&P', 'Handheld': 'Handheld' };

  function init() {
    bindHeaderControls();
    F.onChange(renderAll);
    loadData(true);
    loadNvData();
    loadSalesData();

    if (window.MSI_CONFIG.REFRESH_INTERVAL_MS > 0) {
      refreshTimer = setInterval(function () { loadData(false); }, window.MSI_CONFIG.REFRESH_INTERVAL_MS);
    }
  }

  // NV Report la static snapshot (xem ghi chu trong nv-report.json) - load 1 lan,
  // khong can refresh dinh ky nhu IHS.
  async function loadNvData() {
    try {
      await NV.fetchData();
      nvReady = true;
      renderAll();
    } catch (err) {
      console.error('Load NV Report failed', err);
    }
  }

  // Weekly Sales Data (Sell Out toan bo khach hang) - cung la static snapshot
  // (xem ghi chu trong weekly-sellout.json), load 1 lan.
  async function loadSalesData() {
    try {
      await SD.fetchData();
      sdReady = true;
      renderAll();
    } catch (err) {
      console.error('Load Weekly Sales Data failed', err);
    }
  }

  function bindHeaderControls() {
    document.getElementById('resetFilterBtn').addEventListener('click', function () {
      F.reset();
      // Year/Quarter KHONG clear() vi sau reset chung se duoc set lai ve
      // nam/quy hien tai (xem filterState.js defaultState_()) - clear() o day
      // se xoa mat gia tri mac dinh do ngay sau khi vua duoc set.
      // Dealers van clear binh thuong (mac dinh la rong/All).
      if (selectsReady) {
        ts.dealers.clear(true);
      }
    });
    document.getElementById('refreshBtn').addEventListener('click', function () {
      loadData(false);
    });
  }

  // ===== Filter dropdowns (Tom Select) + Series Group pill buttons =====
  function initSelects() {
    var meta = D.getMeta();
    var years = D.getYears();
    var quarters = D.getQuarters();
    var customers = meta.customers || [];

    fillNativeOptions('yearSelect', years, function (y) { return y; });
    fillNativeOptions('quarterSelect', quarters, function (q) { return q; });
    fillNativeOptions('dealersSelect', customers, function (c) { return c; });

    function tsConfig(extra) {
      return Object.assign({
        plugins: ['remove_button'],
        maxOptions: null,
        onChange: function () {}
      }, extra);
    }

    ts.year = new TomSelect('#yearSelect', tsConfig({
      placeholder: 'All Years',
      onChange: function (vals) { F.setYears(vals); }
    }));
    ts.quarter = new TomSelect('#quarterSelect', tsConfig({
      placeholder: 'All Quarters',
      onChange: function (vals) { F.setQuarters(vals); }
    }));
    ts.dealers = new TomSelect('#dealersSelect', tsConfig({
      placeholder: 'All Dealers',
      onChange: function (vals) { F.setCustomers(vals); }
    }));

    renderSeriesGroupPills();
    selectsReady = true;
  }

  // Series Group la nut pill bam truc tiep (toggle), khong dung Tom Select -
  // it option (2-3), nut bam de scan/cham hon dropdown, va khong gap rui ro
  // reentrancy nhu Tom Select.
  function renderSeriesGroupPills() {
    var container = document.getElementById('seriesGroupPills');
    if (!container) return;
    var meta = D.getMeta();
    var groups = (meta.seriesGroups && meta.seriesGroups.length) ? meta.seriesGroups : ['Gaming', 'Business& Productivity', 'Handheld'];

    container.innerHTML = groups.map(function (sg) {
      return '<button type="button" class="pill-btn" data-sg="' + escapeHtmlAttr(sg) + '">' + (SG_LABEL[sg] || sg) + '</button>';
    }).join('');

    container.querySelectorAll('.pill-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sg = btn.getAttribute('data-sg');
        var current = F.getState().seriesGroups;
        var idx = current.indexOf(sg);
        if (idx === -1) current.push(sg); else current.splice(idx, 1);
        F.setSeriesGroups(current);
      });
    });
  }

  function syncSeriesGroupPills(state) {
    var container = document.getElementById('seriesGroupPills');
    if (!container) return;
    container.querySelectorAll('.pill-btn').forEach(function (btn) {
      var active = state.seriesGroups.indexOf(btn.getAttribute('data-sg')) !== -1;
      btn.classList.toggle('active', active);
    });
  }

  function fillNativeOptions(selectId, values, labelFn) {
    var el = document.getElementById(selectId);
    el.innerHTML = '';
    values.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v;
      opt.textContent = labelFn(v);
      el.appendChild(opt);
    });
  }

  // Dong bo lai UI cua Year/Quarter/Dealers (Tom Select) + Series Group (pills)
  // theo state hien tai (vd khi xoa 1 filter-tag, hoac sau khi reset)
  function syncSelectsFromState(state) {
    syncSeriesGroupPills(state);
    if (!selectsReady) return;
    ts.year.setValue(state.years, true);
    ts.quarter.setValue(state.quarters, true);
    ts.dealers.setValue(state.customers, true);
  }

  async function loadData(isFirstLoad) {
    var btn = document.getElementById('refreshBtn');
    var errBanner = document.getElementById('errorBanner');
    btn.classList.add('loading');
    try {
      await D.fetchData();
      errBanner.classList.remove('show');
      if (!selectsReady) initSelects();
      updateMetaInfo();
      renderAll();
    } catch (err) {
      console.error('Load data failed', err);
      errBanner.textContent = 'Could not load data from Google Sheet: ' + err.message + '. Showing cached data (if available).';
      errBanner.classList.add('show');
      if (isFirstLoad) renderAll();
    } finally {
      btn.classList.remove('loading');
    }
  }

  function updateMetaInfo() {
    var meta = D.getMeta();
    var el = document.getElementById('lastUpdated');
    if (meta.generatedAt) {
      var d = new Date(meta.generatedAt);
      el.textContent = 'Updated: ' + d.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  }

  // Bo loc co so dung chung cho moi section (Year / Quarter / Series Group / Dealers)
  function baseFilters(state) {
    return {
      seriesGroup: state.seriesGroups,
      customer: state.customers,
      year: state.years,
      quarter: state.quarters
    };
  }

  function renderAll() {
    var state = F.getState();
    // Defer ra tick sau: tranh goi setValue() len chinh Tom Select instance
    // dang con trong qua trinh xu ly onChange cua no (reentrancy) - day la
    // nguyen nhan khien item vua chon bi "bien mat" khoi control.
    setTimeout(function () { syncSelectsFromState(state); }, 0);
    renderFilterTags(state);
    renderTicker(state);
    renderKeyDealersScorecardSection(state);
    if (nvReady) {
      renderNvScorecardSection(state);
    }
    renderMsiTrendSection(state);
    renderDealersWeeklySection(state);
    renderMultiLineSection(state);
    renderBrandSharedSection(state);
    renderBrandVolumeSection(state);
    renderDealersVolumeSection(state);
    renderStackedMixSection(state);
    renderChannelScorecardSection(state);
    renderBrandYoySection(state);
    renderAlertsPanelSection(state);
    if (nvReady) {
      renderMarketRealityCheckSection(state);
      renderGpuTierMixSection(state);
    }
    renderCapacityTableSection(state);
    renderBrandsTableSection(state);
  }

  // ===== Market Pulse ticker (signature element) =====
  function sumField(rows, field) {
    return rows.reduce(function (acc, r) { return acc + (r[field] || 0); }, 0);
  }

  function renderTicker(state) {
    var el = document.getElementById('marketPulseInner');
    if (!el) return;
    var filters = baseFilters(state);
    var weeks = D.getWeeksForFilters(filters);
    if (!weeks.length) { el.innerHTML = ''; return; }
    var lastWeek = weeks[weeks.length - 1];
    var prevWeek = weeks.length > 1 ? weeks[weeks.length - 2] : null;

    var msiRows = D.applyFilters(Object.assign({}, filters, { brand: 'MSI' })).filter(function (r) { return !r.isTotal; });
    var totalRows = D.applyFilters(filters).filter(function (r) { return r.isTotal; });

    var msiThisWk = sumField(msiRows.filter(function (r) { return r.w === lastWeek; }), 'brandVol');
    var totalThisWk = sumField(totalRows.filter(function (r) { return r.w === lastWeek; }), 'ttlVol');
    var shareThisWk = totalThisWk > 0 ? msiThisWk / totalThisWk : null;

    var msiPrevWk = prevWeek ? sumField(msiRows.filter(function (r) { return r.w === prevWeek; }), 'brandVol') : null;
    var totalPrevWk = prevWeek ? sumField(totalRows.filter(function (r) { return r.w === prevWeek; }), 'ttlVol') : null;
    var sharePrevWk = (totalPrevWk && totalPrevWk > 0) ? msiPrevWk / totalPrevWk : null;
    var shareDeltaPP = (shareThisWk !== null && sharePrevWk !== null) ? (shareThisWk - sharePrevWk) * 100 : null;

    var msiLastYear = sumField(msiRows.filter(function (r) { return r.w === lastWeek; }), 'lastYear');
    var msiYoy = msiLastYear > 0 ? (msiThisWk - msiLastYear) / msiLastYear : null;

    var capTable = D.dealersCapacityTable(filters);
    var movers = capTable.filter(function (r) { return r.wow !== null && isFinite(r.wow); })
      .sort(function (a, b) { return Math.abs(b.wow) - Math.abs(a.wow); });
    var topMover = movers[0];

    var items = [];
    items.push(tickerItem('MSI SHARE · ' + fmt.weekShort(lastWeek), fmt.percent(shareThisWk, 1), null));
    items.push(tickerItem('SHARE Δ WoW', (shareDeltaPP === null ? '-' : (shareDeltaPP >= 0 ? '+' : '') + shareDeltaPP.toFixed(1) + 'pp'), shareDeltaPP));
    items.push(tickerItem('MSI VOLUME Δ YoY', fmt.percentSigned(msiYoy, 1), msiYoy));
    if (topMover) {
      items.push(tickerItem('TOP MOVER · ' + fmt.truncate(topMover.customer, 16), fmt.percentSigned(topMover.wow, 0) + ' WoW', topMover.wow));
    }

    el.innerHTML = items.join('');
  }

  function tickerItem(label, value, deltaSign) {
    var cls = 'tk-flat';
    if (deltaSign !== null && deltaSign !== undefined && isFinite(deltaSign)) {
      cls = deltaSign >= 0 ? 'tk-up' : 'tk-down';
    }
    return '<span class="tk-item">' +
      '<span class="tk-label">' + escapeHtml(label) + '</span>' +
      '<span class="tk-value ' + cls + '">' + escapeHtml(value) + '</span>' +
      '</span>';
  }

  function renderFilterTags(state) {
    var el = document.getElementById('filterTags');
    var tags = F.getActiveFilterTags();
    if (!tags.length) { el.innerHTML = ''; return; }
    var html = '<span class="filter-tags-label">Filters:</span>';
    tags.forEach(function (t) {
      var label = t.type === 'seriesGroup' ? (SG_LABEL[t.label] || t.label) : t.label;
      html += '<span class="filter-tag">' + escapeHtml(label) +
        '<button data-clear-type="' + t.type + '" data-clear-value="' + escapeHtmlAttr(t.value) + '" aria-label="Remove filter">\u00d7</button></span>';
    });
    el.innerHTML = html;
    el.querySelectorAll('button[data-clear-type]').forEach(function (b) {
      b.addEventListener('click', function () {
        F.clearTag(b.getAttribute('data-clear-type'), b.getAttribute('data-clear-value'));
      });
    });
  }

  function dealersLabel(state, fallback) {
    if (!state.customers.length) return fallback;
    if (state.customers.length === 1) return state.customers[0];
    return state.customers.length + ' dealers';
  }

  // ===== Snapshot scorecards: Key Dealers (IHS) vs Whole Market (NV Report) =====
  // Theo mau report cu cua Phuc: so to + YoY + mini bar so sanh Top-N (This Period
  // vs Last Year) + bang brand breakdown + footer Last Week/WoW.
  function renderKeyDealersScorecardSection(state) {
    var filters = baseFilters(state);
    var recentWeeks = getRollingNWeekLabels_(getRollingAnchorWeek_(state), 3);
    var rows = D.brandsTable(filters, recentWeeks);
    var grandTotal = rows.reduce(function (a, r) { return a + r.volume; }, 0);
    var grandLastYear = rows.reduce(function (a, r) { return a + (r.lastYearVol || 0); }, 0);
    var yoy = grandLastYear > 0 ? (grandTotal - grandLastYear) / grandLastYear : null;

    document.getElementById('kdScorecardNumber').textContent = fmt.number(grandTotal);
    var yoyEl = document.getElementById('kdScorecardYoy');
    yoyEl.textContent = (yoy === null ? '-' : (yoy >= 0 ? '\u25b2 ' : '\u25bc ') + Math.abs(yoy * 100).toFixed(1) + '% YoY');
    yoyEl.className = 'scorecard-yoy ' + (yoy === null ? '' : (yoy >= 0 ? 'val-up' : 'val-down'));

    var top = rows.slice().sort(function (a, b) { return b.volume - a.volume; }).slice(0, 6);
    Charts.renderDualMiniBar('kdMiniChart', top, 'volume', 'lastYearVol', 'brand', '#F97316');

    Tables.renderBrandsTable('kdScorecardTable', rows, state.brand, function (brand) { F.setBrand(brand); }, recentWeeks);

    var anyLastWkData = rows.some(function (r) { return r.lastWk !== null; });
    var grandLastWk = rows.reduce(function (a, r) { return a + (r.lastWk || 0); }, 0);
    var grandLast2Wk = rows.reduce(function (a, r) { return a + (r.last2Wk || 0); }, 0);
    var grandWow = (anyLastWkData && grandLastWk > 0 && grandLast2Wk > 0) ? (grandLastWk - grandLast2Wk) / grandLast2Wk : null;
    var lastWkLabel = recentWeeks[2] || 'Last week';

    document.getElementById('kdScorecardFooter').innerHTML =
      escapeHtml(lastWkLabel) + ': <b>' + (anyLastWkData ? fmt.number(grandLastWk) : '-') + '</b> &nbsp;\u00b7&nbsp; WoW: <b class="' +
      (grandWow === null ? '' : (grandWow >= 0 ? 'val-up' : 'val-down')) + '">' + fmt.percentSigned(grandWow, 1) + '</b>';
  }

  function renderNvScorecardSection(state) {
    var scopeWeeks = NV.getWeeksForYearQuarter(state.years, state.quarters);
    var recentWeeks = getRollingNWeekLabels_(getRollingAnchorWeek_(state), 3);
    var rows = NV.brandSummaryTable(scopeWeeks, recentWeeks);
    var grandTotal = rows.reduce(function (a, r) { return a + r.volume; }, 0);
    var grandLastYear = rows.reduce(function (a, r) { return a + (r.lastYearVol || 0); }, 0);
    var yoy = grandLastYear > 0 ? (grandTotal - grandLastYear) / grandLastYear : null;

    document.getElementById('nvScorecardNumber').textContent = fmt.number(grandTotal);
    var yoyEl = document.getElementById('nvScorecardYoy');
    yoyEl.textContent = (yoy === null ? '-' : (yoy >= 0 ? '\u25b2 ' : '\u25bc ') + Math.abs(yoy * 100).toFixed(1) + '% YoY');
    yoyEl.className = 'scorecard-yoy ' + (yoy === null ? '' : (yoy >= 0 ? 'val-up' : 'val-down'));

    var top = rows.slice().sort(function (a, b) { return b.volume - a.volume; }).slice(0, 6);
    Charts.renderDualMiniBar('nvMiniChart', top, 'volume', 'lastYearVol', 'brand', '#2563EB');

    Tables.renderBrandsTable('nvScorecardTable', rows, state.brand, function (brand) { F.setBrand(brand); }, recentWeeks);

    // NV thuong cap nhat tre hon IHS - tuan gan nhat (recentWeeks[2]) co the chua
    // co du lieu, luc do moi brand.lastWk se la null. Phan biet ro "chua co du
    // lieu" (hien "-") voi "that su bang 0".
    var anyLastWkData = rows.some(function (r) { return r.lastWk !== null; });
    var grandLastWk = rows.reduce(function (a, r) { return a + (r.lastWk || 0); }, 0);
    var grandLast2Wk = rows.reduce(function (a, r) { return a + (r.last2Wk || 0); }, 0);
    var grandWow = (anyLastWkData && grandLastWk > 0 && grandLast2Wk > 0) ? (grandLastWk - grandLast2Wk) / grandLast2Wk : null;
    var lastWkLabel = recentWeeks[2] || 'Last week';

    document.getElementById('nvScorecardFooter').innerHTML =
      escapeHtml(lastWkLabel) + ': <b>' + (anyLastWkData ? fmt.number(grandLastWk) : '-') + '</b> &nbsp;\u00b7&nbsp; WoW: <b class="' +
      (grandWow === null ? '' : (grandWow >= 0 ? 'val-up' : 'val-down')) + '">' + fmt.percentSigned(grandWow, 1) + '</b>';
  }


  function renderMsiTrendSection(state) {
    var weeks = D.getLastNWeeksForFilters(baseFilters(state), state.weeksBack);
    var filters = baseFilters(state);
    var series = D.msiWeeklyVolume(filters, weeks);

    // Duong "All Customers" chi co y nghia khi dang xem TOAN BO mang luoi (khong
    // loc theo 1 vai Dealers cu the, vi Weekly Sales Data khong co dimension
    // "Key Dealers"). Van ton trong Series Group filter (Gaming/B&P/Handheld).
    var allCustomersSeries = null;
    if (sdReady && !state.customers.length) {
      allCustomersSeries = SD.weeklyTotal(weeks, state.seriesGroups);
    }

    Charts.renderMsiWeeklyTrend('msiTrendChart', weeks, series, allCustomersSeries);

    var titleEl = document.getElementById('msiTrendTitle');
    var label = dealersLabel(state, null);
    titleEl.textContent = label ? ('MSI - weekly S/O @ ' + label) : 'MSI - weekly S/O (Market)';
  }

  function renderDealersWeeklySection(state) {
    var weeks = D.getLastNWeeksForFilters(baseFilters(state), state.weeksBack);
    var filters = baseFilters(state);

    var targetCustomers = state.customers.length ? state.customers : (D.getMeta().customers || []);
    var byWeek = {};
    weeks.forEach(function (w) { byWeek[w] = 0; });

    targetCustomers.forEach(function (cust) {
      var s = D.dealerWeeklyVolume(cust, filters, weeks);
      s.forEach(function (d) { byWeek[d.week] += d.value; });
    });

    var series = weeks.map(function (w) { return { week: w, value: byWeek[w] }; });
    var wowSeries = series.map(function (d, idx) {
      if (idx === 0) return null;
      var prev = series[idx - 1].value;
      if (!prev) return null;
      return (d.value - prev) / prev;
    });

    Charts.renderDealersWeeklyBar('dealersWeeklyChart', weeks, series, wowSeries);
    var label = dealersLabel(state, null);
    document.getElementById('dealersWeeklyTitle').textContent = label ? (label + ' - weekly S/O') : 'Key Dealers - weekly S/O';
  }

  function renderMultiLineSection(state) {
    var weeks = D.getLastNWeeksForFilters(baseFilters(state), state.weeksBack);
    var filters = baseFilters(state);
    var brands = D.getMeta().brands || [];
    var map = {};

    brands.forEach(function (brand) {
      var f = Object.assign({}, filters, { brand: brand });
      var rows = D.applyFilters(f).filter(function (r) { return !r.isTotal; });
      var byWeek = {};
      rows.forEach(function (r) { byWeek[r.w] = (byWeek[r.w] || 0) + (r.brandVol || 0); });
      map[brand] = weeks.map(function (w) { return byWeek[w] || 0; });
    });

    var totalRows = D.applyFilters(filters).filter(function (r) { return r.isTotal; });
    var totalByWeek = {};
    totalRows.forEach(function (r) { totalByWeek[r.w] = (totalByWeek[r.w] || 0) + (r.ttlVol || 0); });

    var shareMap = {};
    Object.keys(map).forEach(function (brand) {
      shareMap[brand] = map[brand].map(function (vol, idx) {
        var tot = totalByWeek[weeks[idx]] || 0;
        return tot > 0 ? vol / tot : 0;
      });
    });

    Charts.renderMultiLineShare('multiLineChart', weeks, shareMap);
    renderCustomLegend('multiLineLegend', brands, state.brand);
  }

  function renderCustomLegend(containerId, brands, activeBrand) {
    var el = document.getElementById(containerId);
    var C = window.MSI_CONFIG.COLORS.brand;
    var html = '';
    brands.forEach(function (brand) {
      var color = C[brand] || '#94A3B8';
      var dim = activeBrand && activeBrand !== brand;
      html += '<span class="legend-item' + (dim ? ' dim' : '') + '" data-brand="' + escapeHtmlAttr(brand) + '">' +
        '<span class="legend-swatch" style="background:' + color + '"></span>' + brand + '</span>';
    });
    el.innerHTML = html;
    el.querySelectorAll('.legend-item').forEach(function (item) {
      item.addEventListener('click', function () {
        F.setBrand(item.getAttribute('data-brand'));
      });
    });
  }

  function renderBrandSharedSection(state) {
    var filters = Object.assign({}, baseFilters(state), { channel: state.channel });
    var rows = D.brandsTable(filters);
    var C = window.MSI_CONFIG.COLORS.brand;
    Charts.renderHBarShare('brandSharedChart', rows, 'shared', 'brand', function (d) {
      return C[d.brand] || '#94A3B8';
    }, function (d) { F.setBrand(d.brand); });
  }

  function renderBrandVolumeSection(state) {
    var filters = Object.assign({}, baseFilters(state), { channel: state.channel });
    var rows = D.brandsTable(filters);
    var C = window.MSI_CONFIG.COLORS.brand;
    Charts.renderHBarShare('brandVolumeChart', rows, 'volume', 'brand', function (d) {
      return C[d.brand] || '#94A3B8';
    }, function (d) { F.setBrand(d.brand); });
  }

  function renderDealersVolumeSection(state) {
    var filters = Object.assign({}, baseFilters(state), { brand: state.brand, channel: state.channel });
    var rows = D.dealersCapacityTable(filters).slice(0, 8);
    var valueField = state.brand ? 'selectedBrandVolume' : 'capacity';
    Charts.renderHBarShare('dealersVolumeChart', rows, valueField, 'customer', function () {
      return window.MSI_CONFIG.COLORS.dgw;
    }, function (d) { F.setCustomer(d.customer); });
  }

  function renderStackedMixSection(state) {
    var filters = Object.assign({}, baseFilters(state), { brand: state.brand, channel: state.channel });
    var dealerData = D.dealerBrandShareMatrix(filters).slice(0, 8);
    var brands = D.getMeta().brands || [];
    Charts.renderStackedShareByDealer('stackedMixChart', dealerData, brands, function (d) { F.setCustomer(d.customer); });
  }

  function renderCapacityTableSection(state) {
    var filters = Object.assign({}, baseFilters(state), { brand: state.brand, channel: state.channel });
    var recentWeeks = getRollingNWeekLabels_(getRollingAnchorWeek_(state), 3);
    var rows = D.dealersCapacityTable(filters, recentWeeks);
    var highlighted = state.customers.length === 1 ? state.customers[0] : null;
    Tables.renderDealersCapacityTable('dealersCapacityTable', rows, highlighted, function (cust) {
      F.setCustomer(cust);
    }, recentWeeks, state.brand);
  }

  function renderBrandsTableSection(state) {
    var filters = Object.assign({}, baseFilters(state), { channel: state.channel });
    var recentWeeks = getRollingNWeekLabels_(getRollingAnchorWeek_(state), 3);
    var rows = D.brandsTable(filters, recentWeeks);
    Tables.renderBrandsTable('brandsTable', rows, state.brand, function (brand) {
      F.setBrand(brand);
    }, recentWeeks);
  }

  function renderChannelScorecardSection(state) {
    var filters = Object.assign({}, baseFilters(state), { brand: state.brand });
    var rows = D.channelTypeScorecard(filters);
    Tables.renderChannelScorecard('channelScorecardTable', rows, state.channel, function (channel) {
      F.setChannel(channel);
    }, state.brand);
  }

  function renderBrandYoySection(state) {
    var filters = Object.assign({}, baseFilters(state), { channel: state.channel });
    var rows = D.brandsTable(filters);
    Tables.renderBrandYoyLeaderboard('brandYoyChart', rows);
  }

  function renderAlertsPanelSection(state) {
    var filters = Object.assign({}, baseFilters(state), { brand: state.brand, channel: state.channel });
    var capRows = D.dealersCapacityTable(filters);
    var topMovers = capRows.filter(function (r) { return r.wow !== null && isFinite(r.wow); })
      .slice().sort(function (a, b) { return Math.abs(b.wow) - Math.abs(a.wow); }).slice(0, 5);

    var alertFilters = Object.assign({}, baseFilters(state), { channel: state.channel });
    var whitespace = D.whitespaceList(alertFilters).slice(0, 5);
    var volatility = D.volatilityFlags(alertFilters, state.weeksBack).slice(0, 5);

    Tables.renderAlertsPanel('alertsPanel', {
      topMovers: topMovers,
      whitespace: whitespace,
      volatility: volatility
    });
  }

  // "Market Reality Check": so sanh MSI Share o Key Dealers (IHS) vs toan thi truong
  // (NV Report). So sanh tren CUNG mot tap hop tuan (giao giua 2 nguon) de cong bang -
  // NV Report la snapshot tinh nen co the cham hon IHS vai tuan.
  // Tinh nhan ISO-8601 week ('YYYYWNN') cho 1 ngay bat ky - khop voi cach data
  // dang dung (da verify: hom nay 20/6/2026 = W25, tuan truoc = W24 = dung maxWeek
  // hien co trong IHS).
  function isoWeekLabel_(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNum = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dayNum + 3);
    var firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    var firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
    var weekNum = 1 + Math.round((d - firstThursday) / (7 * 24 * 3600 * 1000));
    return d.getUTCFullYear() + 'W' + (weekNum < 10 ? '0' + weekNum : weekNum);
  }

  // 'YYYYWNN' -> Date cua ngay Thu Nam trong tuan ISO do (luon xac dinh duy nhat,
  // dung de quy doi nguoc tu nhan tuan ve ngay thuc, tranh cong/tru truc tiep tren
  // so thu tu tuan vi de loi khi vat qua ranh gioi nam).
  function weekLabelToThursday_(weekLabel) {
    var m = String(weekLabel || '').match(/^(\d{4})W(\d{2})$/);
    if (!m) return new Date();
    var year = parseInt(m[1], 10);
    var week = parseInt(m[2], 10);
    var jan4 = new Date(Date.UTC(year, 0, 4));
    var jan4DayNum = (jan4.getUTCDay() + 6) % 7;
    var week1Monday = new Date(jan4.getTime() - jan4DayNum * 24 * 3600 * 1000);
    return new Date(week1Monday.getTime() + ((week - 1) * 7 + 3) * 24 * 3600 * 1000);
  }

  // N tuan rolling KET THUC tai anchorWeek (bao gom anchorWeek). Dung quy doi ve
  // ngay thuc (Thu Nam cua tuan ISO) roi tru lui theo ngay, tranh loi cong/tru
  // truc tiep tren so tuan khi vat qua ranh gioi nam.
  function getRollingNWeekLabels_(anchorWeek, n) {
    n = n || 13;
    var anchorDate = weekLabelToThursday_(anchorWeek);
    var labels = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(anchorDate.getTime() - i * 7 * 24 * 3600 * 1000);
      labels.push(isoWeekLabel_(d));
    }
    return labels;
  }

  function getCurrentYearQuarter_() {
    var today = new Date();
    var y = today.getFullYear();
    var q = Math.floor(today.getMonth() / 3) + 1;
    return { year: String(y), quarter: 'Q' + q };
  }

  // Tuan neo cho moi tinh toan "rolling": theo DUNG dropdown filter Year/Quarter
  // dang chon - khong phai luon cung today-1.
  // - Khong chon gi, hoac chon dung Year/Quarter HIEN TAI -> neo o tuan truoc
  //   (today - 1 tuan), vi du hom nay dang trong Q2 nam nay thi van la today-1.
  // - Chon Year/Quarter KHAC (qua khu) -> neo o tuan CUOI CUNG cua Quarter/Year
  //   do (lay tu chinh data IHS, vi dropdown Year/Quarter von duoc sinh ra tu
  //   data IHS nen luon co du lieu cho lua chon nguoi dung co the chon).
  function getRollingAnchorWeek_(state) {
    var current = getCurrentYearQuarter_();
    var selYears = (state && state.years) || [];
    var selQuarters = (state && state.quarters) || [];

    var isCurrentPeriod = true;
    if (selYears.length && selYears.indexOf(current.year) === -1) isCurrentPeriod = false;
    if (selQuarters.length && selQuarters.indexOf(current.quarter) === -1) isCurrentPeriod = false;

    if (isCurrentPeriod) {
      return isoWeekLabel_(new Date(Date.now() - 7 * 24 * 3600 * 1000));
    }

    var refYear = selYears.length ? selYears[selYears.length - 1] : current.year;
    var filterObj = { year: [refYear] };
    if (selQuarters.length) filterObj.quarter = [selQuarters[selQuarters.length - 1]];

    var weeks = D.getWeeksForFilters(filterObj);
    if (!weeks.length) {
      return isoWeekLabel_(new Date(Date.now() - 7 * 24 * 3600 * 1000));
    }
    return weeks[weeks.length - 1];
  }

  // "Market Reality Check": so sanh MSI Share o Key Dealers (IHS, Gaming only)
  // vs toan thi truong (NV Report - ban than NV chi report Gaming, khong ap dung
  // cho cac dong san pham khac). Ca 2 phia deu gop tren CUNG 1 khung 13 tuan
  // rolling co dinh (neo theo dropdown Year/Quarter filter - xem getRollingAnchorWeek_),
  // khong phai "giao nhau giua 2 nguon" nhu truoc - de khung thoi gian on dinh,
  // khong troi theo data.
  function renderMarketRealityCheckSection(state) {
    var anchor = getRollingAnchorWeek_(state);
    var window13 = getRollingNWeekLabels_(anchor, 13);
    var windowSet = {};
    window13.forEach(function (w) { windowSet[w] = true; });

    var el = document.getElementById('realityCheckStats');

    var ihsTotalRows = D.applyFilters({ seriesGroup: ['Gaming'] }).filter(function (r) { return r.isTotal && windowSet[r.w]; });
    var ihsMsiRows = D.applyFilters({ seriesGroup: ['Gaming'], brand: 'MSI' }).filter(function (r) { return !r.isTotal && windowSet[r.w]; });
    var ihsTotal = ihsTotalRows.reduce(function (a, r) { return a + (r.ttlVol || 0); }, 0);
    var ihsMsi = ihsMsiRows.reduce(function (a, r) { return a + (r.brandVol || 0); }, 0);
    var ihsShare = ihsTotal > 0 ? ihsMsi / ihsTotal : null;

    var nvAll = NV.weeklyMsiShare();
    var nvFiltered = nvAll.filter(function (d) { return windowSet[d.week]; });
    var nvTotal = nvFiltered.reduce(function (a, d) { return a + d.total; }, 0);
    var nvMsi = nvFiltered.reduce(function (a, d) { return a + d.msi; }, 0);
    var nvShare = nvTotal > 0 ? nvMsi / nvTotal : null;

    var gap = nvTotal - ihsTotal;
    var gapPct = nvTotal > 0 ? gap / nvTotal : null;

    var weekRangeLabel = fmt.weekShort(window13[0]) + '\u2013' + fmt.weekShort(window13[window13.length - 1]);

    el.innerHTML =
      '<div class="rc-stat"><div class="rc-label">MSI Share @ Key Dealers (IHS, Gaming)</div><div class="rc-value">' + fmt.percent(ihsShare, 1) + '</div></div>' +
      '<div class="rc-stat"><div class="rc-label">MSI Share @ Whole Market (NV, Gaming)</div><div class="rc-value">' + fmt.percent(nvShare, 1) + '</div></div>' +
      '<div class="rc-stat"><div class="rc-label">Coverage Gap</div><div class="rc-value">' + fmt.number(gap) + ' <span class="rc-sub">(' + fmt.percent(gapPct, 0) + ')</span></div></div>' +
      '<div class="rc-stat"><div class="rc-label">Window (13w rolling)</div><div class="rc-value rc-value-sm">' + weekRangeLabel + '</div></div>';

    // 2 duong: MSI share @ Key Dealers (IHS) va MSI share @ Whole Market (NV),
    // moi tuan 1 diem trong cung khung 13w rolling - thay cho chart quy dai han.
    var ihsByWeekTotal = {}, ihsByWeekMsi = {};
    ihsTotalRows.forEach(function (r) { ihsByWeekTotal[r.w] = (ihsByWeekTotal[r.w] || 0) + (r.ttlVol || 0); });
    ihsMsiRows.forEach(function (r) { ihsByWeekMsi[r.w] = (ihsByWeekMsi[r.w] || 0) + (r.brandVol || 0); });
    var ihsWeeklySeries = window13.map(function (w) {
      var tot = ihsByWeekTotal[w] || 0;
      var msi = ihsByWeekMsi[w] || 0;
      return tot > 0 ? msi / tot : null;
    });

    var nvByWeek = {};
    nvFiltered.forEach(function (d) { nvByWeek[d.week] = d.share; });
    var nvWeeklySeries = window13.map(function (w) { return nvByWeek[w] !== undefined ? nvByWeek[w] : null; });

    Charts.renderWeeklyShareDualLine('weeklyShareTrendChart', window13, ihsWeeklySeries, nvWeeklySeries);
  }

  function renderGpuTierMixSection(state) {
    var gpuWeeks = NV.getGpuWeeks();
    if (!gpuWeeks.length) return;
    var anchor = getRollingAnchorWeek_(state);

    // NV report co the cham hon IHS vai tuan, nen tuan neo tinh theo dropdown
    // filter chua chac da co san trong NV - fallback ve tuan gan nhat <= anchor
    // ma NV thuc su co du lieu.
    var targetWeek = gpuWeeks.indexOf(anchor) !== -1 ? anchor : null;
    if (!targetWeek) {
      for (var i = gpuWeeks.length - 1; i >= 0; i--) {
        if (gpuWeeks[i] <= anchor) { targetWeek = gpuWeeks[i]; break; }
      }
      if (!targetWeek) targetWeek = gpuWeeks[gpuWeeks.length - 1];
    }

    var rows = NV.gpuTierComparison([targetWeek]);
    Charts.renderGpuTierGroupedBar('gpuTierChart', rows);

    var hintEl = document.getElementById('gpuTierHint');
    if (hintEl) {
      hintEl.textContent = targetWeek === anchor
        ? fmt.weekShort(targetWeek)
        : fmt.weekShort(targetWeek) + ' (closest available to ' + fmt.weekShort(anchor) + ')';
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escapeHtmlAttr(s) { return escapeHtml(s); }

  document.addEventListener('DOMContentLoaded', init);
})();
