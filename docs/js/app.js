// MSI Vietnam Dashboard - Main App Orchestrator

(function () {
  'use strict';

  var D = window.MsiData;
  var F = window.MsiFilterState;
  var Charts = window.MsiCharts;
  var Tables = window.MsiTables;

  var refreshTimer = null;

  function init() {
    bindHeaderControls();
    F.onChange(renderAll);
    loadData(true);

    if (window.MSI_CONFIG.REFRESH_INTERVAL_MS > 0) {
      refreshTimer = setInterval(function () { loadData(false); }, window.MSI_CONFIG.REFRESH_INTERVAL_MS);
    }
  }

  function bindHeaderControls() {
    document.querySelectorAll('.chip[data-sg]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        F.setSeriesGroup(chip.getAttribute('data-sg'));
      });
    });
    document.getElementById('resetFilterBtn').addEventListener('click', function () {
      F.reset();
    });
    document.getElementById('refreshBtn').addEventListener('click', function () {
      loadData(false);
    });
  }

  async function loadData(isFirstLoad) {
    var btn = document.getElementById('refreshBtn');
    var errBanner = document.getElementById('errorBanner');
    btn.classList.add('loading');
    try {
      await D.fetchData();
      errBanner.classList.remove('show');
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

  function renderAll() {
    var state = F.getState();
    renderChips(state);
    renderFilterTags(state);
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

  function renderChips(state) {
    document.querySelectorAll('.chip[data-sg]').forEach(function (chip) {
      var sg = chip.getAttribute('data-sg');
      chip.classList.toggle('active', state.seriesGroup === sg);
    });
  }

  function renderFilterTags(state) {
    var el = document.getElementById('filterTags');
    var tags = F.getActiveFilterTags();
    if (!tags.length) { el.innerHTML = ''; return; }
    var html = '<span class="filter-tags-label">Dang loc:</span>';
    tags.forEach(function (t) {
      html += '<span class="filter-tag">' + escapeHtml(t.label) +
        '<button data-clear="' + t.type + '" aria-label="Bo loc">\u00d7</button></span>';
    });
    el.innerHTML = html;
    el.querySelectorAll('button[data-clear]').forEach(function (b) {
      b.addEventListener('click', function () { F.clearTag(b.getAttribute('data-clear')); });
    });
  }

  function renderMsiTrendSection(state) {
    var weeks = D.getLastNWeeks(state.weeksBack);
    var filters = { seriesGroup: state.seriesGroup, customer: state.customer };
    var series = D.msiWeeklyVolume(filters, weeks);
    Charts.renderMsiWeeklyTrend('msiTrendChart', weeks, series);

    var titleEl = document.getElementById('msiTrendTitle');
    titleEl.textContent = state.customer ? ('MSI - weekly S/O @ ' + state.customer) : 'MSI - weekly S/O (Market)';
  }

  function renderDealersWeeklySection(state) {
    var weeks = D.getLastNWeeks(state.weeksBack);
    var filters = { seriesGroup: state.seriesGroup, customer: state.customer };

    var targetCustomers = state.customer ? [state.customer] : (D.getMeta().customers || []);
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
    document.getElementById('dealersWeeklyTitle').textContent = state.customer ? (state.customer + ' - weekly S/O') : 'Key Dealers - weekly S/O';
  }

  function renderMultiLineSection(state) {
    var weeks = D.getLastNWeeks(state.weeksBack);
    var filters = { seriesGroup: state.seriesGroup, customer: state.customer };
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
    var filters = { seriesGroup: state.seriesGroup, customer: state.customer };
    var rows = D.brandsTable(filters);
    var C = window.MSI_CONFIG.COLORS.brand;
    Charts.renderHBarShare('brandSharedChart', rows, 'shared', 'brand', function (d) {
      return C[d.brand] || '#94A3B8';
    });
  }

  function renderBrandVolumeSection(state) {
    var filters = { seriesGroup: state.seriesGroup, customer: state.customer };
    var rows = D.brandsTable(filters);
    var C = window.MSI_CONFIG.COLORS.brand;
    Charts.renderHBarShare('brandVolumeChart', rows, 'volume', 'brand', function (d) {
      return C[d.brand] || '#94A3B8';
    });
  }

  function renderDealersVolumeSection(state) {
    var filters = { seriesGroup: state.seriesGroup, brand: state.brand };
    var rows = D.dealersCapacityTable(filters).slice(0, 8);
    Charts.renderHBarShare('dealersVolumeChart', rows, 'capacity', 'customer', function () {
      return window.MSI_CONFIG.COLORS.dgw;
    });
  }

  function renderStackedMixSection(state) {
    var filters = { seriesGroup: state.seriesGroup };
    var dealerData = D.dealerBrandShareMatrix(filters).slice(0, 8);
    var brands = D.getMeta().brands || [];
    Charts.renderStackedShareByDealer('stackedMixChart', dealerData, brands);
  }

  function renderCapacityTableSection(state) {
    var filters = { seriesGroup: state.seriesGroup, brand: state.brand };
    var rows = D.dealersCapacityTable(filters);
    Tables.renderDealersCapacityTable('dealersCapacityTable', rows, state.customer, function (cust) {
      F.setCustomer(cust);
    });
  }

  function renderBrandsTableSection(state) {
    var filters = { seriesGroup: state.seriesGroup, customer: state.customer };
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
