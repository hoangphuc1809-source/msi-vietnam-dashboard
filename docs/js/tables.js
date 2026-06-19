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

  function escapeAttr(s) {
    return String(s).replace(/"/g, '&quot;');
  }

  return {
    renderDealersCapacityTable: renderDealersCapacityTable,
    renderBrandsTable: renderBrandsTable
  };
})();
