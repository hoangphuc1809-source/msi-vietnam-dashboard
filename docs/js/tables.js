// MSI Vietnam Dashboard - Tables module

window.MsiTables = (function () {
  'use strict';

  var fmt = window.MsiFormat;

  function yoyClass(v) {
    if (v === null || v === undefined) return 'val-flat';
    return v >= 0 ? 'val-up' : 'val-down';
  }

  function renderDealersCapacityTable(containerId, rows, activeCustomer, onRowClick, weekLabels, activeBrand) {
    var el = document.getElementById(containerId);
    // Cross-filter: khi co brand dang duoc chon o noi khac (vd click "Asus" tren
    // bang Brands), cot chinh doi sang hien volume RIENG cua brand do tai tung
    // dealer (selectedBrandVolume) thay vi luon hien TTL capacity khong doi.
    var showingBrand = !!activeBrand;
    var capField = showingBrand ? 'selectedBrandVolume' : 'capacity';
    var capHeader = showingBrand ? (activeBrand + ' Volume') : 'Capacity';
    var grandTotal = rows.reduce(function (a, r) { return a + (r[capField] || 0); }, 0);
    var has3 = rows.some(function (r) { return r.last3Wk !== null && r.last3Wk !== undefined; });
    var has2 = rows.some(function (r) { return r.last2Wk !== null && r.last2Wk !== undefined; });
    var has1 = rows.some(function (r) { return r.lastWk !== null && r.lastWk !== undefined; });
    var grand3 = has3 ? rows.reduce(function (a, r) { return a + (r.last3Wk || 0); }, 0) : null;
    var grand2 = has2 ? rows.reduce(function (a, r) { return a + (r.last2Wk || 0); }, 0) : null;
    var grand1 = has1 ? rows.reduce(function (a, r) { return a + (r.lastWk || 0); }, 0) : null;
    var wl = weekLabels || [];
    var h3 = wl[0] || 'Last 3 Wk', h2 = wl[1] || 'Last 2 Wk', h1 = wl[2] || 'Last Wk';

    var html = '<table class="data-table">';
    html += '<thead><tr>' +
      '<th>Dealers Capacity</th><th>' + escapeAttr(capHeader) + '</th><th>YoY</th><th>MSI share</th>' +
      '<th>' + escapeAttr(h3) + '</th><th>' + escapeAttr(h2) + '</th><th>' + escapeAttr(h1) + '</th><th>WoW</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (r) {
      var isActive = activeCustomer === r.customer;
      html += '<tr class="' + (isActive ? 'row-active' : '') + '" data-customer="' + escapeAttr(r.customer) + '">' +
        '<td title="' + escapeAttr(r.customer) + '">' + fmt.truncate(r.customer, 18) + '</td>' +
        '<td>' + fmt.number(r[capField]) + '</td>' +
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

  function renderBrandsTable(containerId, rows, activeBrand, onRowClick, weekLabels) {
    var el = document.getElementById(containerId);
    var grandTotal = rows.reduce(function (a, r) { return a + r.volume; }, 0);
    var grandShared = rows.reduce(function (a, r) { return a + r.shared; }, 0);
    var has3 = rows.some(function (r) { return r.last3Wk !== null && r.last3Wk !== undefined; });
    var has2 = rows.some(function (r) { return r.last2Wk !== null && r.last2Wk !== undefined; });
    var has1 = rows.some(function (r) { return r.lastWk !== null && r.lastWk !== undefined; });
    var grand3 = has3 ? rows.reduce(function (a, r) { return a + (r.last3Wk || 0); }, 0) : null;
    var grand2 = has2 ? rows.reduce(function (a, r) { return a + (r.last2Wk || 0); }, 0) : null;
    var grand1 = has1 ? rows.reduce(function (a, r) { return a + (r.lastWk || 0); }, 0) : null;
    var wl = weekLabels || [];
    var h3 = wl[0] || 'Last 3 Wk', h2 = wl[1] || 'Last 2 Wk', h1 = wl[2] || 'Last Wk';

    var html = '<table class="data-table">';
    html += '<thead><tr>' +
      '<th>Brands</th><th>Volume</th><th>Shared</th><th>YoY</th>' +
      '<th>' + escapeAttr(h3) + '</th><th>' + escapeAttr(h2) + '</th><th>' + escapeAttr(h1) + '</th><th>WoW</th>' +
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

  function renderChannelScorecard(containerId, rows, activeChannel, onRowClick, activeBrand) {
    var el = document.getElementById(containerId);
    // Cross-filter: khi co brand dang duoc chon o noi khac (vd click "Asus" tren
    // bang Brands), cot chinh doi sang hien volume RIENG cua brand do theo tung
    // channel, giong cach Dealers Capacity table da lam.
    var showingBrand = !!activeBrand;
    var capField = showingBrand ? 'selectedBrandVolume' : 'capacity';
    var capHeader = showingBrand ? (activeBrand + ' Volume') : 'TTL Volume';
    var grandCap = rows.reduce(function (a, r) { return a + (r[capField] || 0); }, 0);
    var grandMsi = rows.reduce(function (a, r) { return a + r.msiCapacity; }, 0);

    var html = '<table class="data-table">';
    html += '<thead><tr>' +
      '<th>Channel Type</th><th>' + escapeAttr(capHeader) + '</th><th>MSI Share</th><th>This Wk</th><th>WoW</th><th>YoY</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (r) {
      var isActive = activeChannel === r.channel;
      html += '<tr class="' + (isActive ? 'row-active' : '') + '" data-channel="' + escapeAttr(r.channel) + '">' +
        '<td title="' + escapeAttr(r.channel) + '">' + fmt.truncate(r.channel, 20) + '</td>' +
        '<td>' + fmt.number(r[capField]) + '</td>' +
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

  // Short display names for KA dealers in table header
  var KA_DEALER_SHORT = {
    'Mobile World':   'MBW',
    'FPT RETAIL JSC': 'FPT',
    'CELLPHONES':     'CPS',
    'PHONG VU':       'PV'
  };

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

    // Zone 4: KA Channel Share table (IHS KA dealers vs NV Report total, Gaming)
    function kaShareZone(ka) {
      var title = '\ud83d\udccb KA Channel Share';
      var hint = 'IHS Key Dealers vs NV Report (Gaming)';
      if (!ka || !ka.rows || !ka.rows.length) {
        var msg = ka === null ? 'Loading NV Report\u2026' : 'No data for selected period';
        return '<div class="alert-col">' +
          '<h4>' + title + '<span class="alert-hint">' + hint + '</span></h4>' +
          '<div class="alert-empty">' + msg + '</div></div>';
      }
      var dealers = ka.dealers;

      // Step 1: Merge 'Giga' + 'Others' → single 'Others' row
      var othersAccum = null;
      var displayRows = [];
      ka.rows.forEach(function (r) {
        if (r.brand === 'Giga' || r.brand === 'Others') {
          if (!othersAccum) {
            othersAccum = { brand: 'Others', dealerVols: {}, kaTotal: 0, nvTotal: 0, kaShare: null };
            dealers.forEach(function (d) { othersAccum.dealerVols[d] = 0; });
          }
          dealers.forEach(function (d) { othersAccum.dealerVols[d] += (r.dealerVols[d] || 0); });
          othersAccum.kaTotal += r.kaTotal;
          othersAccum.nvTotal += r.nvTotal;
        } else {
          displayRows.push(r);
        }
      });
      if (othersAccum) {
        othersAccum.kaShare = othersAccum.nvTotal > 0 ? othersAccum.kaTotal / othersAccum.nvTotal : null;
        displayRows.push(othersAccum);
      }

      // Step 2: Grand Total
      var grandDealerVols = {};
      dealers.forEach(function (d) { grandDealerVols[d] = 0; });
      var grandNvTotal = 0, grandKaTotal = 0;
      displayRows.forEach(function (r) {
        dealers.forEach(function (d) { grandDealerVols[d] += (r.dealerVols[d] || 0); });
        grandNvTotal += r.nvTotal;
        grandKaTotal += r.kaTotal;
      });
      var grandKaShare   = grandNvTotal > 0 ? grandKaTotal / grandNvTotal : null;
      var grandRestShare = grandKaShare !== null ? (1 - grandKaShare) : null;

      // Step 3: Build table
      var theadCells = dealers.map(function (d) {
        var short = KA_DEALER_SHORT[d] || d;
        return '<th title="' + escapeAttr(d) + '">' +
          '<span class="ka-badge">KA</span>' +
          '<span class="th-dealer-name">' + short + '</span></th>';
      }).join('');
      var thead = '<thead><tr>' +
        '<th style="text-align:left">Brand</th>' +
        theadCells +
        '<th style="color:#2563EB;font-weight:700">Nvidia</th>' +
        '<th>KA%</th>' +
        '<th>Rest channel</th>' +
        '</tr></thead>';

      var tbody = displayRows.map(function (r) {
        var dealerCells = dealers.map(function (d) {
          var v = r.dealerVols[d] || 0;
          return '<td>' + (v > 0 ? fmt.number(v) : '<span style="color:#CBD5E1">\u2013</span>') + '</td>';
        }).join('');
        var shareClass = 'ka-share-pct' +
          (r.kaShare === null ? '' : r.kaShare >= 0.7 ? ' val-up' : r.kaShare < 0.4 ? ' val-down' : '');
        var restShare = r.kaShare !== null ? (1 - r.kaShare) : null;
        return '<tr>' +
          '<td>' + escapeAttr(r.brand) + '</td>' +
          dealerCells +
          '<td class="ka-nv-vol">' + (r.nvTotal > 0 ? fmt.number(r.nvTotal) : '\u2013') + '</td>' +
          '<td class="' + shareClass + '">' + (r.kaShare !== null ? fmt.percent(r.kaShare, 0) : '\u2013') + '</td>' +
          '<td class="ka-rest-pct">' + (restShare !== null ? fmt.percent(restShare, 0) : '\u2013') + '</td>' +
          '</tr>';
      }).join('');

      // Grand Total row (tfoot)
      var grandDealerCells = dealers.map(function (d) {
        var v = grandDealerVols[d] || 0;
        return '<td>' + (v > 0 ? fmt.number(v) : '\u2013') + '</td>';
      }).join('');
      var tfoot = '<tfoot><tr class="ka-grand-total">' +
        '<td>Grand Total</td>' +
        grandDealerCells +
        '<td class="ka-nv-vol">' + (grandNvTotal > 0 ? fmt.number(grandNvTotal) : '\u2013') + '</td>' +
        '<td class="ka-share-pct">' + (grandKaShare !== null ? fmt.percent(grandKaShare, 0) : '\u2013') + '</td>' +
        '<td class="ka-rest-pct">' + (grandRestShare !== null ? fmt.percent(grandRestShare, 0) : '\u2013') + '</td>' +
        '</tr></tfoot>';

      return '<div class="alert-col">' +
        '<h4>' + title + '<span class="alert-hint">' + hint + '</span></h4>' +
        '<div style="overflow-x:auto">' +
        '<table class="ka-share-table">' + thead + '<tbody>' + tbody + '</tbody>' + tfoot + '</table>' +
        '</div></div>';
    }

    var html = '<div class="alerts-grid">' +
      section('\ud83d\udcca Top Movers', 'Strongest WoW moves', data.topMovers, moverItem, 'No notable movement') +
      section('\ud83c\udfaf Whitespace', 'High capacity, below-avg share', data.whitespace, whitespaceItem, 'No notable opportunities') +
      section('\u26a1 Unusual Volatility', '8-week share std. deviation', data.volatility, volatilityItem, 'No volatile dealers') +
      kaShareZone(data.kaShare !== undefined ? data.kaShare : null) +
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

