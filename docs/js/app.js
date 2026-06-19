// MSI Vietnam Dashboard - Main App Orchestrator

(function () {
  'use strict';

  var D = window.MsiData;
  var F = window.MsiFilterState;
  var Charts = window.MsiCharts;
  var Tables = window.MsiTables;
  var fmt = window.MsiFormat;

  var refreshTimer = null;
  var ts = { year: null, quarter: null, seriesGroup: null, dealers: null };
  var selectsReady = false;

  var SG_LABEL = { 'Gaming': 'Gaming', 'Business& Productivity': 'B&P', 'Handheld': 'Handheld' };

  function init() {
    bindHeaderControls();
    F.onChange(renderAll);
    loadData(true);

    if (window.MSI_CONFIG.REFRESH_INTERVAL_MS > 0) {
      refreshTimer = setInterval(function () { loadData(false); }, window.MSI_CONFIG.REFRESH_INTERVAL_MS);
    }
  }

  function bindHeaderControls() {
    document.getElementById('resetFilterBtn').addEventListener('click', function () {
      F.reset();
      if (selectsReady) {
        ts.year.clear(true);
        ts.quarter.clear(true);
        ts.seriesGroup.clear(true);
        ts.dealers.clear(true);
      }
    });
    document.getElementById('refreshBtn').addEventListener('click', function () {
      loadData(false);
    });
  }

  // ===== Filter dropdowns (Tom Select) =====
  function initSelects() {
    var meta = D.getMeta();
    var years = D.getYears();
    var quarters = D.getQuarters();
    var seriesGroups = (meta.seriesGroups && meta.seriesGroups.length) ? meta.seriesGroups : ['Gaming', 'Business& Productivity', 'Handheld'];
    var customers = meta.customers || [];

    fillNativeOptions('yearSelect', years, function (y) { return y; });
    fillNativeOptions('quarterSelect', quarters, function (q) { return q; });
    fillNativeOptions('seriesGroupSelect', seriesGroups, function (sg) { return SG_LABEL[sg] || sg; });
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
    ts.seriesGroup = new TomSelect('#seriesGroupSelect', tsConfig({
      placeholder: 'All Series',
      onChange: function (vals) { F.setSeriesGroups(vals); }
    }));
    ts.dealers = new TomSelect('#dealersSelect', tsConfig({
      placeholder: 'All Dealers',
      onChange: function (vals) { F.setCustomers(vals); }
    }));

    selectsReady = true;
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

  // Dong bo lai UI cua 4 dropdown theo state hien tai (vd khi xoa 1 filter-tag)
  function syncSelectsFromState(state) {
    if (!selectsReady) return;
    ts.year.setValue(state.years, true);
    ts.quarter.setValue(state.quarters, true);
    ts.seriesGroup.setValue(state.seriesGroups, true);
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
      errBanner.textContent = 'Khong the tai du lieu tu Google Sheet: ' + err.message + '. Dang hien thi du lieu cu (neu co).';
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
      el.textContent = 'Cap nhat: ' + d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
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
    syncSelectsFromState(state);
    renderFilterTags(state);
    renderTicker(state);
    renderMsiTrendSection(state);
    renderDealersWeeklySection(state);
    renderMultiLineSection(state);
    renderBrandSharedSection(state);
    renderBrandVolumeSection(state);
    renderDealersVolumeSection(state);
    renderStackedMixSection(state);
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
    var weeks = D.getWeeks();
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
    var html = '<span class="filter-tags-label">Dang loc:</span>';
    tags.forEach(function (t) {
      var label = t.type === 'seriesGroup' ? (SG_LABEL[t.label] || t.label) : t.label;
      html += '<span class="filter-tag">' + escapeHtml(label) +
        '<button data-clear-type="' + t.type + '" data-clear-value="' + escapeHtmlAttr(t.value) + '" aria-label="Bo loc">\u00d7</button></span>';
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

  function renderMsiTrendSection(state) {
    var weeks = D.getLastNWeeks(state.weeksBack);
    var filters = baseFilters(state);
    var series = D.msiWeeklyVolume(filters, weeks);
    Charts.renderMsiWeeklyTrend('msiTrendChart', weeks, series);

    var titleEl = document.getElementById('msiTrendTitle');
    var label = dealersLabel(state, null);
    titleEl.textContent = label ? ('MSI - weekly S/O @ ' + label) : 'MSI - weekly S/O (Market)';
  }

  function renderDealersWeeklySection(state) {
    var weeks = D.getLastNWeeks(state.weeksBack);
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
    var weeks = D.getLastNWeeks(state.weeksBack);
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
    var filters = baseFilters(state);
    var rows = D.brandsTable(filters);
    var C = window.MSI_CONFIG.COLORS.brand;
    Charts.renderHBarShare('brandSharedChart', rows, 'shared', 'brand', function (d) {
      return C[d.brand] || '#94A3B8';
    });
  }

  function renderBrandVolumeSection(state) {
    var filters = baseFilters(state);
    var rows = D.brandsTable(filters);
    var C = window.MSI_CONFIG.COLORS.brand;
    Charts.renderHBarShare('brandVolumeChart', rows, 'volume', 'brand', function (d) {
      return C[d.brand] || '#94A3B8';
    });
  }

  function renderDealersVolumeSection(state) {
    var filters = Object.assign({}, baseFilters(state), { brand: state.brand });
    var rows = D.dealersCapacityTable(filters).slice(0, 8);
    Charts.renderHBarShare('dealersVolumeChart', rows, 'capacity', 'customer', function () {
      return window.MSI_CONFIG.COLORS.dgw;
    });
  }

  function renderStackedMixSection(state) {
    var filters = baseFilters(state);
    var dealerData = D.dealerBrandShareMatrix(filters).slice(0, 8);
    var brands = D.getMeta().brands || [];
    Charts.renderStackedShareByDealer('stackedMixChart', dealerData, brands);
  }

  function renderCapacityTableSection(state) {
    var filters = Object.assign({}, baseFilters(state), { brand: state.brand });
    var rows = D.dealersCapacityTable(filters);
    var highlighted = state.customers.length === 1 ? state.customers[0] : null;
    Tables.renderDealersCapacityTable('dealersCapacityTable', rows, highlighted, function (cust) {
      F.setCustomer(cust);
    });
  }

  function renderBrandsTableSection(state) {
    var filters = baseFilters(state);
    var rows = D.brandsTable(filters);
    Tables.renderBrandsTable('brandsTable', rows, state.brand, function (brand) {
      F.setBrand(brand);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escapeHtmlAttr(s) { return escapeHtml(s); }

  document.addEventListener('DOMContentLoaded', init);
})();
