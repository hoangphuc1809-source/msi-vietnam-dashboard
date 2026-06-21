// MSI Vietnam Dashboard - Userbuy Tracking tab - Charts module (Chart.js)

window.MsiUserbuyCharts = (function () {
  'use strict';

  var C = window.MSI_CONFIG.COLORS;
  var fmt = window.MsiFormat;
  var charts = {};

  function destroyIfExists(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  }

  function hexToRgba(hex, alpha) {
    var h = hex.replace('#', '');
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  var PALETTE = ['#CC0000', '#0E4D99', '#D97706', '#059669', '#7C3AED', '#0D9488', '#F97316', '#64748B', '#84CC16', '#2563EB'];
  function colorAt(i) { return PALETTE[i % PALETTE.length]; }

  // ===== 1. Tong Userbuy theo tuan - This Year vs Last Year =====
  function renderWeeklyTotalChart(canvasId, weeks, thisYear, lastYear) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');
    var labels = weeks.map(function (w) { return fmt.weekAxisLabel(w); });
    charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'This period',
            data: thisYear,
            borderColor: C.accentMSI,
            backgroundColor: hexToRgba(C.accentMSI, 0.08),
            borderWidth: 2.5, pointRadius: 2.5, pointHoverRadius: 5,
            pointBackgroundColor: C.accentMSI, tension: 0.35, fill: true
          },
          {
            label: 'Last Year',
            data: lastYear,
            borderColor: '#94A3B8',
            backgroundColor: 'transparent',
            borderWidth: 2, borderDash: [5, 4], pointRadius: 2, pointHoverRadius: 4,
            pointBackgroundColor: '#94A3B8', tension: 0.35, fill: false
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { boxWidth: 10, boxHeight: 10, font: { size: 10.5, weight: '600' }, usePointStyle: true, pointStyle: 'rectRounded' } },
          tooltip: { backgroundColor: '#0F172A', padding: 10, cornerRadius: 8, mode: 'index', intersect: false }
        },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false }, ticks: { color: C.textSecondary, font: { size: 10.5, weight: '600' } } },
          y: { beginAtZero: true, grace: '15%', ticks: { color: C.textSecondary } }
        }
      }
    });
  }

  // ===== 2. Userbuy theo Series Group (stacked bar theo tuan) =====
  function renderSeriesGroupStackedChart(canvasId, weeks, sgMap) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');
    var sgColors = { 'Gaming': C.gaming, 'Business& Productivity': C.bnp, 'Handheld': C.handheld };
    var labels = weeks.map(function (w) { return fmt.weekAxisLabel(w); });
    var datasets = Object.keys(sgMap).map(function (sg, i) {
      return {
        label: sg,
        data: weeks.map(function (w) { return (sgMap[sg].byWeek && sgMap[sg].byWeek[w]) || 0; }),
        backgroundColor: sgColors[sg] || colorAt(i),
        borderRadius: 3, maxBarThickness: 22
      };
    });
    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { boxWidth: 10, boxHeight: 10, font: { size: 10.5, weight: '600' }, usePointStyle: true, pointStyle: 'rectRounded' } },
          tooltip: { backgroundColor: '#0F172A', padding: 10, cornerRadius: 8, mode: 'index', intersect: false }
        },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: C.textSecondary, font: { size: 10, weight: '600' } } },
          y: { stacked: true, beginAtZero: true, ticks: { color: C.textSecondary } }
        }
      }
    });
  }

  // ===== 3. Horizontal bar generic - dung cho Segment / GPU / CPU breakdown =====
  // items: [{label, value}], sorted ben ngoai truoc khi truyen vao
  function renderDimensionBar(canvasId, items, onClickItem, activeLabel) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');
    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: items.map(function (d) { return d.label; }),
        datasets: [{
          data: items.map(function (d) { return d.value; }),
          backgroundColor: items.map(function (d, i) { return (activeLabel && activeLabel === d.label) ? C.accentMSI : colorAt(i); }),
          borderRadius: 4, maxBarThickness: 18
        }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        layout: { padding: { right: 55 } },
        onClick: function (evt, elements) {
          if (onClickItem && elements && elements.length) onClickItem(items[elements[0].index].label);
        },
        onHover: function (evt, elements) {
          evt.native.target.style.cursor = (onClickItem && elements && elements.length) ? 'pointer' : 'default';
        },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#0F172A', padding: 10, cornerRadius: 8 }
        },
        scales: {
          x: { display: false, beginAtZero: true },
          y: { grid: { display: false }, ticks: { color: C.textPrimary, font: { size: 11.5, weight: '600' } } }
        }
      },
      plugins: [dimBarValuePlugin_()]
    });
  }

  function dimBarValuePlugin_() {
    return {
      id: 'dimBarValue',
      afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx;
        var meta = chart.getDatasetMeta(0);
        meta.data.forEach(function (bar, idx) {
          var value = chart.data.datasets[0].data[idx];
          ctx.save();
          ctx.fillStyle = '#0F172A';
          ctx.font = "700 11px 'IBM Plex Mono', monospace";
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(fmt.number(value), bar.x + 6, bar.y);
          ctx.restore();
        });
      }
    };
  }

  return {
    renderWeeklyTotalChart: renderWeeklyTotalChart,
    renderSeriesGroupStackedChart: renderSeriesGroupStackedChart,
    renderDimensionBar: renderDimensionBar
  };
})();
