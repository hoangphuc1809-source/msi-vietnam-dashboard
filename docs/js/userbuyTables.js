// MSI Vietnam Dashboard - Userbuy Tracking tab - Tables module

window.MsiUserbuyTables = (function () {
  'use strict';

  var fmt = window.MsiFormat;

  function yoyClass(v) {
    if (v === null || v === undefined) return 'val-flat';
    return v >= 0 ? 'val-up' : 'val-down';
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, '&quot;');
  }

  // WOI Status: <=12 Optimal (xanh), 12-20 Monitor (vang), >20 Overstock (do),
  // EOL -> Skip (xam). woi = null/undefined -> '-'
  function woiBadge(woi, isEOL) {
    if (isEOL) return '<span class="woi-badge woi-skip" title="EOL - bo qua">Skip (EOL)</span>';
    if (woi === null || woi === undefined || isNaN(woi)) return '<span class="woi-badge woi-flat">-</span>';
    var cls, label;
    if (woi <= 12) { cls = 'woi-optimal'; label = 'Optimal'; }
    else if (woi <= 20) { cls = 'woi-monitor'; label = 'Monitor'; }
    else { cls = 'woi-overstock'; label = 'Overstock'; }
    return '<span class="woi-badge ' + cls + '">' + woi.toFixed(1) + 'w &middot; ' + label + '</span>';
  }

  // rows: [{label, qty, rev, share, last3:[v,v,v], wow, onHand, woi, isEOL, isActive}]
  // qtyLabel/lastLabel cho tieu de cot dau ('Userbuy' hoac 'Sell Out')
  function renderMetricTable(containerId, opts) {
    var rows = opts.rows || [];
    var el = document.getElementById(containerId);

    if (!rows.length && opts.emptyMessage) {
      el.innerHTML = '<div class="table-empty-state">' +
        '<div class="table-empty-icon">&#9888;</div>' +
        '<div class="table-empty-text">' + opts.emptyMessage + '</div>' +
        '</div>';
      return;
    }

    var grandQty = rows.reduce(function (a, r) { return a + (r.qty || 0); }, 0);
    var wl = opts.weekLabels || [];
    var h3 = wl[0] || '3wk ago', h2 = wl[1] || '2wk ago', h1 = wl[2] || 'Last Wk';

    var html = '<table class="data-table">';
    html += '<thead><tr>' +
      '<th>' + escapeAttr(opts.dimLabel) + '</th><th>Share</th>' +
      '<th>Total ' + escapeAttr(opts.metricLabel) + '</th><th>ASP</th>' +
      '<th>' + escapeAttr(h3) + '</th><th>' + escapeAttr(h2) + '</th><th>' + escapeAttr(h1) + '</th>' +
      '<th>WoW</th><th>Onhand</th>' + (opts.showDistyOnHand ? '<th>Disty Onhand</th>' : '') + '<th>WOI</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (r) {
      var isActive = opts.activeValue === r.key;
      var asp = (r.qty > 0) ? (r.rev / r.qty) : null;
      html += '<tr class="' + (isActive ? 'row-active' : '') + '" data-key="' + escapeAttr(r.key) + '">' +
        '<td title="' + escapeAttr(r.label) + '">' + fmt.truncate(r.label, 20) + '</td>' +
        '<td>' + fmt.percent(r.share, 1) + '</td>' +
        '<td>' + fmt.number(r.qty) + '</td>' +
        '<td>' + (asp === null ? '-' : Math.round(asp).toLocaleString('en-US')) + '</td>' +
        '<td>' + fmt.number(r.last3[0]) + '</td>' +
        '<td>' + fmt.number(r.last3[1]) + '</td>' +
        '<td>' + fmt.number(r.last3[2]) + '</td>' +
        '<td class="' + yoyClass(r.wow) + '">' + fmt.percentSigned(r.wow, 0) + '</td>' +
        '<td>' + fmt.number(r.onHand) + '</td>' +
        (opts.showDistyOnHand ? '<td>' + fmt.number(r.distyOnHand) + '</td>' : '') +
        '<td>' + woiBadge(r.woi, r.isEOL) + '</td>' +
        '</tr>';
    });

    html += '<tr class="total-row">' +
      '<td>Grand total</td><td>100%</td>' +
      '<td>' + fmt.number(grandQty) + '</td><td>-</td>' +
      '<td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>' +
      (opts.showDistyOnHand ? '<td>-</td>' : '') + '<td>-</td>' +
      '</tr>';
    html += '</tbody></table>';
    el.innerHTML = html;

    if (opts.onRowClick) {
      el.querySelectorAll('tbody tr[data-key]').forEach(function (tr) {
        tr.addEventListener('click', function () { opts.onRowClick(tr.getAttribute('data-key')); });
      });
    }
  }

  function numOrBlank_(v) {
    if (v === null || v === undefined || v === 0) return '';
    return fmt.number(v);
  }

  // So sanh voi tuan truoc TRONG CUNG 1 dong (so thuc, khong phai chuoi da
  // blank-hoa) - tang: xanh la nhe, giam: do nhe, bang nhau/tuan dau: trung lap
  function weekTrendClass_(curr, prev) {
    if (prev === null || prev === undefined) return '';
    var c = curr || 0, p = prev || 0;
    if (c > p) return 'wk-up';
    if (c < p) return 'wk-down';
    return '';
  }

  // rows: [{sku, segment, last13:[...13 gia tri...], total13, onHand, distyOnHand, woi, isEOL}]
  // weekLabels13: 13 nhan tuan ('2026W22', '2026W23', ...) lam header cot
  function renderModelDetailTable(containerId, rows, weekLabels13) {
    var el = document.getElementById(containerId);
    var html = '<table class="data-table model-detail-table">';
    html += '<thead><tr><th class="model-col-sticky">Model</th>';
    weekLabels13.forEach(function (w) { html += '<th>' + escapeAttr(w) + '</th>'; });
    html += '<th>Total (13w)</th><th>Onhand</th><th>Disty Onhand</th><th>WOI</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr>' +
        '<td class="model-col-sticky" title="' + escapeAttr(r.sku) + '"><div class="model-name-full">' + escapeAttr(r.sku) + '</div><div class="model-sub">' + escapeAttr(r.segment) + '</div></td>';
      r.last13.forEach(function (v, i) {
        var cls = weekTrendClass_(v, i > 0 ? r.last13[i - 1] : null);
        html += '<td class="' + cls + '">' + numOrBlank_(v) + '</td>';
      });
      html += '<td><b>' + numOrBlank_(r.total13) + '</b></td>' +
        '<td>' + numOrBlank_(r.onHand) + '</td>' +
        '<td>' + numOrBlank_(r.distyOnHand) + '</td>' +
        '<td>' + woiBadge(r.woi, r.isEOL) + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  // Alerts: OOS (Out of Stock) + Slow Moving / Overstock - y tuong tu draft cu cua Phuc
  function renderEarlyWarningPanel(containerId, data) {
    var el = document.getElementById(containerId);
    function oosItem(r) {
      return '<li><span class="alert-name">' + escapeAttr(r.label) + '</span>' +
        '<span class="alert-metric val-down">Disty: ' + fmt.number(r.distyOnHand) + ' &middot; Dealer: ' + fmt.number(r.onHand) + '</span></li>';
    }
    function slowItem(r) {
      return '<li><span class="alert-name">' + escapeAttr(r.label) + '</span>' +
        '<span class="alert-metric val-flat">' + r.woi.toFixed(1) + 'w &middot; Userbuy ' + fmt.percentSigned(r.trend3w, 0) + ' (3wk)</span></li>';
    }
    function section(title, hint, items, renderFn, emptyMsg) {
      var body = items.length
        ? '<ul class="alert-list">' + items.map(renderFn).join('') + '</ul>'
        : '<div class="alert-empty">' + emptyMsg + '</div>';
      return '<div class="alert-col">' + '<h4>' + title + '<span class="alert-hint">' + hint + '</span></h4>' + body + '</div>';
    }
    var html = '<div class="alerts-grid">' +
      section('\ud83d\udd34 Out of Stock Risk', 'Disty + Dealer onhand tien ve 0', data.oos, oosItem, 'Khong co model nao bao dong') +
      section('\ud83d\udfe1 Overstock / Slow Moving', 'WOI cao & Userbuy giam 3 tuan lien tiep', data.slowMoving, slowItem, 'Khong co model nao bi nghen') +
      '</div>';
    el.innerHTML = html;
  }

  return {
    woiBadge: woiBadge,
    renderMetricTable: renderMetricTable,
    renderModelDetailTable: renderModelDetailTable,
    renderEarlyWarningPanel: renderEarlyWarningPanel
  };
})();
