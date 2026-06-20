// MSI Vietnam Dashboard - Tables module

window.MsiTables = (function () {
  'use strict';

  var fmt = window.MsiFormat;

  function yoyClass(v) {
    if (v === null || v === undefined) return 'val-flat';
    return v >= 0 ? 'val-up' : 'val-down';
  }

  function renderDealersCapacityTable(containerId, rows, activeCustomer, onRowClick) {
    var el = document.getElementById(containerId);
    var grandTotal = rows.reduce(function (a, r) { return a + r.capacity; }, 0);
    var grand3 = rows.reduce(function (a, r) { return a + (r.last3Wk || 0); }, 0);
    var grand2 = rows.reduce(function (a, r) { return a + (r.last2Wk || 0); }, 0);
    var grand1 = rows.reduce(function (a, r) { return a + (r.lastWk || 0); }, 0);

    var html = '<table class="data-table">';
    html += '<thead><tr>' +
      '<th>Dealers Capacity</th><th>Capacity</th><th>YoY</th><th>MSI share</th>' +
      '<th>Last 3 Wk</th><th>Last 2 Wk</th><th>Last Wk</th><th>WoW</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (r) {
      var isActive = activeCustomer === r.customer;
      html += '<tr class="' + (isActive ? 'row-active' : '') + '" data-customer="' + escapeAttr(r.customer) + '">' +
        '<td title="' + escapeAttr(r.customer) + '">' + fmt.truncate(r.customer, 18) + '</td>' +
        '<td>' + fmt.number(r.capacity) + '</td>' +
        '<td class="' + yoyClass(r.yoy) + '">' + fmt.percentSigned(r.yoy, 1) + '</td>' +
        '<td>' + fmt.percent(r.msiShare, 1) + '</td>' +
        '<td>' + fmt.number(r.last3Wk) + '</td>' +
        '<td>' + fmt.number(r.last2Wk) + '</td>' +
        '<td>' + fmt.number(r.lastWk) + '</td>' +
        '<td class="' + yoyClass(r.wow) + '">' + fmt.percentSigned(r.wow, 0) + '</td>' +
        '</tr>';
    });

    html += '<tr class="total-row">' +
      '<td>Grand total</td>' +
      '<td>' + fmt.number(grandTotal) + '</td>' +
      '<td>-</td><td>-</td>' +
      '<td>' + fmt.number(grand3) + '</td>' +
      '<td>' + fmt.number(grand2) + '</td>' +
      '<td>' + fmt.number(grand1) + '</td>' +
      '<td>-</td>' +
      '</tr>';

    html += '</tbody></table>';
    el.innerHTML = html;

    if (onRowClick) {
      el.querySelectorAll('tbody tr[data-customer]').forEach(function (tr) {
        tr.addEventListener('click', function () {
          onRowClick(tr.getAttribute('data-customer'));
        });
      });
    }
  }

  function renderBrandsTable(containerId, rows, activeBrand, onRowClick) {
    var el = document.getElementById(containerId);
    var grandTotal = rows.reduce(function (a, r) { return a + r.volume; }, 0);
    var grandShared = rows.reduce(function (a, r) { return a + r.shared; }, 0);
    var grand3 = rows.reduce(function (a, r) { return a + (r.last3Wk || 0); }, 0);
    var grand2 = rows.reduce(function (a, r) { return a + (r.last2Wk || 0); }, 0);
    var grand1 = rows.reduce(function (a, r) { return a + (r.lastWk || 0); }, 0);

    var html = '<table class="data-table">';
    html += '<thead><tr>' +
      '<th>Brands</th><th>Volume</th><th>Shared</th><th>YoY</th>' +
      '<th>Last 3 Wk</th><th>Last 2 Wk</th><th>Last Wk</th><th>WoW</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (r) {
      var isActive = activeBrand === r.brand;
      var isMsi = r.brand === 'MSI';
      html += '<tr class="' + (isActive ? 'row-active' : '') + '" data-brand="' + escapeAttr(r.brand) + '" style="' + (isMsi ? 'font-weight:800;' : '') + '">' +
        '<td title="' + escapeAttr(r.brand) + '">' + r.brand + '</td>' +
        '<td>' + fmt.number(r.volume) + '</td>' +
        '<td>' + fmt.percent(r.shared, 1) + '</td>' +
        '<td class="' + yoyClass(r.yoy) + '">' + fmt.percentSigned(r.yoy, 1) + '</td>' +
        '<td>' + fmt.number(r.last3Wk) + '</td>' +
        '<td>' + fmt.number(r.last2Wk) + '</td>' +
        '<td>' + fmt.number(r.lastWk) + '</td>' +
        '<td class="' + yoyClass(r.wow) + '">' + fmt.percentSigned(r.wow, 0) + '</td>' +
        '</tr>';
    });

    html += '<tr class="total-row">' +
      '<td>Grand total</td>' +
      '<td>' + fmt.number(grandTotal) + '</td>' +
      '<td>' + fmt.percent(grandShared, 1) + '</td><td>-</td>' +
      '<td>' + fmt.number(grand3) + '</td>' +
      '<td>' + fmt.number(grand2) + '</td>' +
      '<td>' + fmt.number(grand1) + '</td>' +
      '<td>-</td>' +
      '</tr>';

    html += '</tbody></table>';
    el.innerHTML = html;

    if (onRowClick) {
      el.querySelectorAll('tbody tr[data-brand]').forEach(function (tr) {
        tr.addEventListener('click', function () {
          onRowClick(tr.getAttribute('data-brand'));
        });
      });
    }
  }

  function renderChannelScorecard(containerId, rows, activeChannel, onRowClick) {
    var el = document.getElementById(containerId);
    var grandCap = rows.reduce(function (a, r) { return a + r.capacity; }, 0);
    var grandMsi = rows.reduce(function (a, r) { return a + r.msiCapacity; }, 0);

    var html = '<table class="data-table">';
    html += '<thead><tr>' +
      '<th>Channel Type</th><th>TTL Volume</th><th>MSI Share</th><th>This Wk</th><th>WoW</th><th>YoY</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (r) {
      var isActive = activeChannel === r.channel;
      html += '<tr class="' + (isActive ? 'row-active' : '') + '" data-channel="' + escapeAttr(r.channel) + '">' +
        '<td title="' + escapeAttr(r.channel) + '">' + fmt.truncate(r.channel, 20) + '</td>' +
        '<td>' + fmt.number(r.capacity) + '</td>' +
        '<td>' + fmt.percent(r.msiShareOverall, 1) + '</td>' +
        '<td>' + fmt.percent(r.shareThisWeek, 1) + '</td>' +
        '<td class="' + yoyClass(r.shareWow) + '">' + (r.shareWow === null ? '-' : (r.shareWow >= 0 ? '+' : '') + (r.shareWow * 100).toFixed(1) + 'pp') + '</td>' +
        '<td class="' + yoyClass(r.yoy) + '">' + fmt.percentSigned(r.yoy, 1) + '</td>' +
        '</tr>';
    });

    html += '<tr class="total-row">' +
      '<td>Grand total</td>' +
      '<td>' + fmt.number(grandCap) + '</td>' +
      '<td>' + fmt.percent(grandCap > 0 ? grandMsi / grandCap : null, 1) + '</td>' +
      '<td>-</td><td>-</td><td>-</td>' +
      '</tr>';

    html += '</tbody></table>';
    el.innerHTML = html;

    if (onRowClick) {
      el.querySelectorAll('tbody tr[data-channel]').forEach(function (tr) {
        tr.addEventListener('click', function () {
          onRowClick(tr.getAttribute('data-channel'));
        });
      });
    }
  }

  function renderBrandYoyLeaderboard(containerId, rows) {
    var el = document.getElementById(containerId);
    var sorted = rows.filter(function (r) { return r.yoy !== null && r.yoy !== undefined; })
      .slice().sort(function (a, b) { return b.yoy - a.yoy; });
    var maxAbs = sorted.reduce(function (m, r) { return Math.max(m, Math.abs(r.yoy)); }, 0.01);
    var C = window.MSI_CONFIG.COLORS.brand;

    var html = '<div class="yoy-leaderboard">';
    sorted.forEach(function (r) {
      var pct = Math.min(100, (Math.abs(r.yoy) / maxAbs) * 100);
      var isPos = r.yoy >= 0;
      var color = C[r.brand] || '#94A3B8';
      html += '<div class="yoy-row">' +
        '<div class="yoy-label">' + r.brand + '</div>' +
        '<div class="yoy-track">' +
        '<div class="yoy-half-neg">' + (isPos ? '' : '<div class="yoy-bar" style="width:' + pct + '%;background:' + color + '"></div>') + '</div>' +
        '<div class="yoy-half-pos">' + (isPos ? '<div class="yoy-bar" style="width:' + pct + '%;background:' + color + '"></div>' : '') + '</div>' +
        '</div>' +
        '<div class="yoy-value ' + (isPos ? 'val-up' : 'val-down') + '">' + fmt.percentSigned(r.yoy, 0) + '</div>' +
        '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  function renderAlertsPanel(containerId, data) {
    var el = document.getElementById(containerId);

    function moverItem(r) {
      var cls = r.wow >= 0 ? 'val-up' : 'val-down';
      var icon = r.wow >= 0 ? '\u25b2' : '\u25bc';
      return '<li><span class="alert-name">' + escapeAttr(r.customer) + '</span>' +
        '<span class="alert-metric ' + cls + '">' + icon + ' ' + fmt.percentSigned(r.wow, 0) + ' WoW</span></li>';
    }
    function whitespaceItem(r) {
      return '<li><span class="alert-name">' + escapeAttr(r.customer) + '</span>' +
        '<span class="alert-metric val-flat">' + fmt.percent(r.share, 1) + ' <span class="alert-sub">(avg ' + fmt.percent(r.avgShare, 1) + ')</span></span></li>';
    }
    function volatilityItem(r) {
      return '<li><span class="alert-name">' + escapeAttr(r.customer) + '</span>' +
        '<span class="alert-metric val-flat">\u00b1' + (r.stdev * 100).toFixed(1) + 'pp</span></li>';
    }

    function section(title, hint, items, renderFn, emptyMsg) {
      var body = items.length
        ? '<ul class="alert-list">' + items.map(renderFn).join('') + '</ul>'
        : '<div class="alert-empty">' + emptyMsg + '</div>';
      return '<div class="alert-col">' +
        '<h4>' + title + '<span class="alert-hint">' + hint + '</span></h4>' +
        body + '</div>';
    }

    var html = '<div class="alerts-grid">' +
      section('\ud83d\udcca Top Movers', 'Strongest WoW moves', data.topMovers, moverItem, 'No notable movement') +
      section('\ud83c\udfaf Whitespace', 'High capacity, below-avg share', data.whitespace, whitespaceItem, 'No notable opportunities') +
      section('\u26a1 Unusual Volatility', '8-week share std. deviation', data.volatility, volatilityItem, 'No volatile dealers') +
      '</div>';
    el.innerHTML = html;
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, '&quot;');
  }

  return {
    renderDealersCapacityTable: renderDealersCapacityTable,
    renderBrandsTable: renderBrandsTable,
    renderChannelScorecard: renderChannelScorecard,
    renderBrandYoyLeaderboard: renderBrandYoyLeaderboard,
    renderAlertsPanel: renderAlertsPanel
  };
})();
