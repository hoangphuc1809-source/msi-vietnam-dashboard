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
  // series = Key Dealers (IHS, tracked dealers only). allCustomersSeries (optional)
  // = TOTAL Sell Out tren toan bo mang luoi khach hang (Weekly Sales Data) - them
  // duong thu 2 de so sanh, co tooltip gop ca 2.
  function renderMsiWeeklyTrend(canvasId, weeks, series, allCustomersSeries) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');
    var labels = weeks.map(function (w) { return window.MsiFormat.weekAxisLabel(w); });

    var datasets = [{
      label: 'Key Dealers (IHS)',
      data: series.map(function (d) { return d.value; }),
      borderColor: C.green,
      backgroundColor: hexToRgba(C.green, 0.08),
      borderWidth: 2.5,
      pointBackgroundColor: C.green,
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: 0.35,
      fill: true
    }];

    if (allCustomersSeries) {
      datasets.push({
        label: 'All Customers (Weekly Sales Data)',
        data: allCustomersSeries,
        borderColor: '#7C3AED',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 4],
        pointBackgroundColor: '#7C3AED',
        pointRadius: 2.5,
        pointHoverRadius: 5,
        tension: 0.35,
        fill: false
      });
    }

    charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 26 } },
        plugins: {
          legend: allCustomersSeries ? {
            display: true,
            position: 'top',
            labels: { boxWidth: 10, boxHeight: 10, font: { size: 10.5, weight: '600' }, color: C.textSecondary, usePointStyle: true, pointStyle: 'rectRounded' }
          } : { display: false },
          tooltip: {
            backgroundColor: '#0F172A',
            padding: 10,
            cornerRadius: 8,
            titleFont: { weight: '700' },
            mode: 'index',
            intersect: false
          },
          datalabels: false
        },
        interaction: { mode: 'index', intersect: false },
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
        var dataset = chart.data.datasets[0];
        if (!dataset) return;
        var meta = chart.getDatasetMeta(0);
        if (meta.hidden) return;
        meta.data.forEach(function (point, idx) {
          var value = dataset.data[idx];
          if (value === null || value === undefined) return;
          ctx.save();
          ctx.fillStyle = color;
          ctx.font = "700 11px 'IBM Plex Mono', monospace";
          ctx.textAlign = 'center';
          ctx.fillText(window.MsiFormat.number(value), point.x, point.y - 10);
          ctx.restore();
        });
      }
    };
  }

  // ===== 2. Key Dealers weekly volume (bar) + WoW% annotation (combo) =====
  function renderDealersWeeklyBar(canvasId, weeks, series, wowSeries) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');
    var labels = weeks.map(function (w) { return window.MsiFormat.weekAxisLabel(w); });

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
          ctx.font = "700 11px 'IBM Plex Mono', monospace";
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
            ctx.font = "700 10px 'IBM Plex Mono', monospace";
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
    var labels = weeks.map(function (w) { return window.MsiFormat.weekAxisLabel(w); });

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
  function renderHBarShare(canvasId, items, valueField, labelField, colorFn, onClickItem) {
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
        onClick: function (evt, elements) {
          if (onClickItem && elements && elements.length) {
            onClickItem(items[elements[0].index]);
          }
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
          ctx.font = "700 11px 'IBM Plex Mono', monospace";
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, bar.x + 6, bar.y);
          ctx.restore();
        });
      }
    };
  }

  // ===== 5. 100% Stacked bar: Brand mix per dealer =====
  function renderStackedShareByDealer(canvasId, dealerData, brands, onClickDealer) {
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
        onClick: function (evt, elements) {
          if (onClickDealer && elements && elements.length) {
            onClickDealer(dealerData[elements[0].index]);
          }
        },
        onHover: function (evt, elements) {
          evt.native.target.style.cursor = (onClickDealer && elements && elements.length) ? 'pointer' : 'default';
        },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 10, boxHeight: 10, font: { size: 11, weight: '600' }, color: C.textSecondary, usePointStyle: true, pointStyle: 'rectRounded' }
          },
          tooltip: {
            backgroundColor: '#0F172A', padding: 10, cornerRadius: 8,
            mode: 'index', intersect: false,
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

  // ===== 6. Quarterly trend line (NV Report - long-term MSI share) =====
  function renderWeeklyShareDualLine(canvasId, weekLabels, ihsSeries, nvSeries) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');
    var labels = weekLabels.map(function (w) { return window.MsiFormat.weekAxisLabel(w); });

    charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'MSI Share @ Key Dealers (IHS)',
            data: ihsSeries.map(function (v) { return v === null ? null : v * 100; }),
            borderColor: C.red,
            backgroundColor: 'rgba(204,0,0,0.06)',
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: C.red,
            tension: 0.25,
            fill: false
          },
          {
            label: 'MSI Share @ Whole Market (NV)',
            data: nvSeries.map(function (v) { return v === null ? null : v * 100; }),
            borderColor: '#2563EB',
            backgroundColor: 'rgba(37,99,235,0.06)',
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#2563EB',
            tension: 0.25,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 10, boxHeight: 10, font: { size: 10.5, weight: '600' }, color: C.textSecondary, usePointStyle: true, pointStyle: 'rectRounded' }
          },
          tooltip: {
            backgroundColor: '#0F172A', padding: 10, cornerRadius: 8, mode: 'index', intersect: false,
            callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + (ctx.parsed.y === null ? '-' : ctx.parsed.y.toFixed(1) + '%'); } }
          }
        },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false }, ticks: { color: C.textSecondary, font: { size: 9.5, weight: '600' } } },
          y: { grid: { color: '#F1F5F9' }, ticks: { color: C.textSecondary, font: { size: 10 }, callback: function (v) { return v + '%'; } } }
        }
      }
    });
  }

  function renderQuarterlyTrendLine(canvasId, rows) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');

    charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: rows.map(function (d) { return d.label; }),
        datasets: [{
          label: 'MSI Share',
          data: rows.map(function (d) { return d.msiShare === null ? null : d.msiShare * 100; }),
          borderColor: C.red,
          backgroundColor: 'rgba(204,0,0,0.08)',
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: C.red,
          tension: 0.25,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0F172A', padding: 10, cornerRadius: 8,
            callbacks: { label: function (ctx) { return 'MSI Share: ' + ctx.parsed.y.toFixed(1) + '%'; } }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: C.textSecondary, font: { size: 9.5, weight: '600' }, maxRotation: 45, minRotation: 45 } },
          y: { grid: { color: '#F1F5F9' }, ticks: { color: C.textSecondary, font: { size: 10 }, callback: function (v) { return v + '%'; } } }
        }
      }
    });
  }

  // ===== 7. GPU tier grouped bar: MSI mix vs Market mix =====
  function renderGpuTierGroupedBar(canvasId, rows) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');

    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: rows.map(function (d) { return d.gpu.replace('RTX ', ''); }),
        datasets: [
          {
            label: 'Whole Market',
            data: rows.map(function (d) { return d.marketShare * 100; }),
            backgroundColor: '#94A3B8',
            borderRadius: 3,
            maxBarThickness: 16
          },
          {
            label: 'MSI',
            data: rows.map(function (d) { return d.msiShare * 100; }),
            backgroundColor: C.red,
            borderRadius: 3,
            maxBarThickness: 16
          }
        ]
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
          x: { grid: { display: false }, ticks: { color: C.textSecondary, font: { size: 10, weight: '600' } } },
          y: { grid: { color: '#F1F5F9' }, ticks: { color: C.textSecondary, font: { size: 10 }, callback: function (v) { return v + '%'; } } }
        }
      }
    });
  }

  // ===== Mini dual-bar: Top-N entity, This Period (colored) vs Last Year (gray) =====
  // Dung cho scorecard card (Key Dealers / NV Report) - so sanh nhanh truc quan.
  function renderDualMiniBar(canvasId, items, valueField, refField, labelField, color) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');

    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: items.map(function (d) { return window.MsiFormat.truncate(String(d[labelField]), 14); }),
        datasets: [
          {
            label: 'Last Year',
            data: items.map(function (d) { return d[refField] || 0; }),
            backgroundColor: '#CBD5E1',
            borderRadius: 3,
            maxBarThickness: 9
          },
          {
            label: 'This Period',
            data: items.map(function (d) { return d[valueField] || 0; }),
            backgroundColor: color,
            borderRadius: 3,
            maxBarThickness: 9
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0F172A', padding: 8, cornerRadius: 6,
            titleFont: { size: 10 }, bodyFont: { size: 10 },
            callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + window.MsiFormat.number(ctx.parsed.x); } }
          }
        },
        scales: {
          x: { display: false, beginAtZero: true },
          y: { grid: { display: false }, ticks: { color: C.textSecondary, font: { size: 10, weight: '600' } } }
        }
      }
    });
  }

  return {
    renderMsiWeeklyTrend: renderMsiWeeklyTrend,
    renderDealersWeeklyBar: renderDealersWeeklyBar,
    renderMultiLineShare: renderMultiLineShare,
    renderHBarShare: renderHBarShare,
    renderStackedShareByDealer: renderStackedShareByDealer,
    renderQuarterlyTrendLine: renderQuarterlyTrendLine,
    renderWeeklyShareDualLine: renderWeeklyShareDualLine,
    renderGpuTierGroupedBar: renderGpuTierGroupedBar,
    renderDualMiniBar: renderDualMiniBar
  };
})();
