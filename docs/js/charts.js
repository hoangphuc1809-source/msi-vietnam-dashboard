// MSI Vietnam Dashboard - Charts module (Chart.js)

window.MsiCharts = (function () {
  'use strict';

  var C = window.MSI_CONFIG.COLORS;
  var charts = {}; // id -> Chart instance

  function destroyIfExists(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  function hexToRgba(hex, alpha) {
    var h = hex.replace('#', '');
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // ===== 1. MSI Weekly Sell-Out trend (line, area, value labels) =====
  function renderMsiWeeklyTrend(canvasId, weeks, series) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');
    var labels = weeks.map(function (w) { return window.MsiFormat.weekShort(w); });

    charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: series.map(function (d) { return d.value; }),
          borderColor: C.green,
          backgroundColor: hexToRgba(C.green, 0.08),
          borderWidth: 2.5,
          pointBackgroundColor: C.green,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.35,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 26 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0F172A',
            padding: 10,
            cornerRadius: 8,
            titleFont: { weight: '700' }
          },
          datalabels: false
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: C.textSecondary, font: { size: 11, weight: '600' } }
          },
          y: {
            display: false,
            beginAtZero: true,
            grace: '20%'
          }
        }
      },
      plugins: [valueLabelPlugin(C.green)]
    });
  }

  // value labels above each point (giong anh mau: so hien thi tren tung diem)
  function valueLabelPlugin(color) {
    return {
      id: 'valueLabel-' + color,
      afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx;
        chart.data.datasets.forEach(function (dataset, i) {
          var meta = chart.getDatasetMeta(i);
          if (meta.hidden) return;
          meta.data.forEach(function (point, idx) {
            var value = dataset.data[idx];
            if (value === null || value === undefined) return;
            ctx.save();
            ctx.fillStyle = color;
            ctx.font = '700 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(window.MsiFormat.number(value), point.x, point.y - 10);
            ctx.restore();
          });
        });
      }
    };
  }

  // ===== 2. Key Dealers weekly volume (bar) + WoW% annotation (combo) =====
  function renderDealersWeeklyBar(canvasId, weeks, series, wowSeries) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');
    var labels = weeks.map(function (w) { return window.MsiFormat.weekShort(w); });

    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: series.map(function (d) { return d.value; }),
          backgroundColor: C.dgw, // cam, giong anh mau
          borderRadius: 4,
          maxBarThickness: 38
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 34 } },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#0F172A', padding: 10, cornerRadius: 8 }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: C.textSecondary, font: { size: 11, weight: '600' } } },
          y: { display: false, beginAtZero: true, grace: '15%' }
        }
      },
      plugins: [barValueAndWowPlugin(wowSeries)]
    });
  }

  function barValueAndWowPlugin(wowSeries) {
    return {
      id: 'barValueWow',
      afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx;
        var meta = chart.getDatasetMeta(0);
        meta.data.forEach(function (bar, idx) {
          var value = chart.data.datasets[0].data[idx];
          ctx.save();
          ctx.fillStyle = '#0F172A';
          ctx.font = '700 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(window.MsiFormat.number(value), bar.x, bar.y - 22);
          ctx.restore();

          var wow = wowSeries && wowSeries[idx];
          if (wow !== null && wow !== undefined && !isNaN(wow)) {
            var label = window.MsiFormat.percentSigned(wow, 1);
            var isUp = wow >= 0;
            ctx.save();
            ctx.fillStyle = isUp ? '#DC2626' : '#DC2626'; // theo anh mau badge do cho ca tang/giam (canh bao biendong)
            var w = ctx.measureText(label).width + 12;
            ctx.fillRect(bar.x - w / 2, bar.y - 16, w, 14);
            ctx.fillStyle = '#fff';
            ctx.font = '700 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(label, bar.x, bar.y - 6);
            ctx.restore();
          }
        });
      }
    };
  }

  // ===== 3. Multi-line market share trend (Key Dealers - Volume by brand, top-right anh mau 2) =====
  function renderMultiLineShare(canvasId, weeks, brandSeriesMap) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');
    var labels = weeks.map(function (w) { return window.MsiFormat.weekShort(w); });

    var datasets = Object.keys(brandSeriesMap).map(function (brand) {
      var color = C.brand[brand] || '#94A3B8';
      return {
        label: brand,
        data: brandSeriesMap[brand],
        borderColor: color,
        backgroundColor: color,
        borderWidth: brand === 'MSI' ? 3 : 2,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        tension: 0.3,
        fill: false
      };
    });

    charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }, // custom legend ben ngoai
          tooltip: { backgroundColor: '#0F172A', padding: 10, cornerRadius: 8, mode: 'index', intersect: false }
        },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false }, ticks: { color: C.textSecondary, font: { size: 10, weight: '600' } } },
          y: {
            position: 'right',
            grid: { color: '#F1F5F9' },
            ticks: {
              color: C.textSecondary,
              font: { size: 10 },
              callback: function (v) { return (v * 100).toFixed(0) + '%'; }
            }
          }
        }
      }
    });
  }

  // ===== 4. Horizontal bar: Brand share % (Key Dealers - Brand shared) =====
  function renderHBarShare(canvasId, items, valueField, labelField, colorFn) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');

    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: items.map(function (d) { return d[labelField]; }),
        datasets: [{
          data: items.map(function (d) { return d[valueField]; }),
          backgroundColor: items.map(function (d, i) { return colorFn(d, i); }),
          borderRadius: 4,
          maxBarThickness: 18
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 50 } },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#0F172A', padding: 10, cornerRadius: 8 }
        },
        scales: {
          x: { display: false, beginAtZero: true },
          y: { grid: { display: false }, ticks: { color: C.textPrimary, font: { size: 12, weight: '600' } } }
        }
      },
      plugins: [hBarValuePlugin(valueField)]
    });
  }

  function hBarValuePlugin(valueField) {
    return {
      id: 'hBarValue-' + valueField,
      afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx;
        var meta = chart.getDatasetMeta(0);
        meta.data.forEach(function (bar, idx) {
          var value = chart.data.datasets[0].data[idx];
          var label = valueField === 'shared' ? window.MsiFormat.percent(value, 1) : window.MsiFormat.number(value);
          ctx.save();
          ctx.fillStyle = '#0F172A';
          ctx.font = '700 11px Inter, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, bar.x + 6, bar.y);
          ctx.restore();
        });
      }
    };
  }

  // ===== 5. 100% Stacked bar: Brand mix per dealer =====
  function renderStackedShareByDealer(canvasId, dealerData, brands) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');

    var datasets = brands.map(function (brand) {
      var color = C.brand[brand] || '#94A3B8';
      return {
        label: brand,
        data: dealerData.map(function (d) { return (d.shares[brand] || 0) * 100; }),
        backgroundColor: color,
        stack: 's1'
      };
    });

    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dealerData.map(function (d) { return window.MsiFormat.truncate(d.customer, 14); }),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 10, boxHeight: 10, font: { size: 11, weight: '600' }, color: C.textSecondary, usePointStyle: true, pointStyle: 'rectRounded' }
          },
          tooltip: {
            backgroundColor: '#0F172A', padding: 10, cornerRadius: 8,
            callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(1) + '%'; } }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: C.textSecondary, font: { size: 10, weight: '600' } } },
          y: { stacked: true, max: 100, ticks: { color: C.textSecondary, font: { size: 10 }, callback: function (v) { return v + '%'; } }, grid: { color: '#F1F5F9' } }
        }
      }
    });
  }

  return {
    renderMsiWeeklyTrend: renderMsiWeeklyTrend,
    renderDealersWeeklyBar: renderDealersWeeklyBar,
    renderMultiLineShare: renderMultiLineShare,
    renderHBarShare: renderHBarShare,
    renderStackedShareByDealer: renderStackedShareByDealer
  };
})();
