// MSI Vietnam Dashboard - Userbuy Tracking tab - Charts module (Chart.js)

window.MsiUserbuyCharts = (function () {
  'use strict';

  var C = window.MSI_CONFIG.COLORS;
  var fmt = window.MsiFormat;
  var WU = window.MsiWeekUtils;
  var charts = {};

  function destroyIfExists(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
      var el = document.getElementById(id);
      if (el) {
        el.removeAttribute('style');
        el.removeAttribute('width');
        el.removeAttribute('height');
      }
    }
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

  // Hoi quy tuyen tinh don gian (least squares) tren cac diem khong null, du
  // doan forecastN diem tiep theo. Dung cho "3w forecast linearity".
  function linearForecast(values, forecastN) {
    forecastN = forecastN || 3;
    var pts = [];
    values.forEach(function (v, i) { if (v !== null && v !== undefined) pts.push([i, v]); });
    if (pts.length < 2) {
      var last = pts.length ? pts[pts.length - 1][1] : 0;
      var flat = [];
      for (var k = 0; k < forecastN; k++) flat.push(Math.round(Math.max(0, last)));
      return flat;
    }
    var n = pts.length, sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    pts.forEach(function (p) { sumX += p[0]; sumY += p[1]; sumXY += p[0] * p[1]; sumXX += p[0] * p[0]; });
    var denom = (n * sumXX - sumX * sumX) || 1;
    var slope = (n * sumXY - sumX * sumY) / denom;
    var intercept = (sumY - slope * sumX) / n;
    var lastIndex = values.length - 1;
    var out = [];
    for (var i2 = 1; i2 <= forecastN; i2++) {
      out.push(Math.round(Math.max(0, slope * (lastIndex + i2) + intercept)));
    }
    return out;
  }

  // ===== 1. Tong Userbuy theo tuan - This Year vs Last Year + 3w forecast (linear) =====
  function renderWeeklyTotalChart(canvasId, weeks, thisYear, lastYear, forecastWeeks) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');
    var nHist = weeks.length;
    var forecast = linearForecast(thisYear, (forecastWeeks || []).length);
    var allLabels = weeks.concat(forecastWeeks || []).map(function (w) { return fmt.weekAxisLabel(w); });
    var thisYearFull = thisYear.concat(forecast);
    var lastYearFull = lastYear.concat((forecastWeeks || []).map(function () { return null; }));

    charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          {
            label: 'This period',
            data: thisYearFull,
            borderColor: C.accentMSI,
            backgroundColor: hexToRgba(C.accentMSI, 0.08),
            borderWidth: 2.5,
            pointRadius: function (c) { return c.dataIndex >= nHist ? 0 : 2.5; },
            pointHoverRadius: 5,
            pointBackgroundColor: C.accentMSI, tension: 0.35, fill: true,
            segment: {
              borderDash: function (c) { return c.p0DataIndex >= nHist - 1 ? [3, 5] : undefined; },
              borderColor: function (c) { return c.p0DataIndex >= nHist - 1 ? hexToRgba(C.accentMSI, 0.4) : C.accentMSI; }
            }
          },
          {
            label: 'Last Year',
            data: lastYearFull,
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
          tooltip: {
            backgroundColor: '#0F172A', padding: 10, cornerRadius: 8, mode: 'index', intersect: false,
            callbacks: {
              title: function (items) {
                var idx = items[0].dataIndex;
                return allLabels[idx] + (idx >= nHist ? ' (forecast)' : '');
              }
            }
          }
        },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false }, ticks: { color: C.textSecondary, font: { size: 10.5, weight: '600' } } },
          y: { beginAtZero: true, grace: '15%', ticks: { color: C.textSecondary } }
        }
      }
    });
  }

  // ===== 2. Multi-line chart voi 3w forecast (linear) - dung chung cho Series
  // Group / Segment / GPU / CPU Segment. seriesMap: { label: {qty, byWeek} }
  // Click vao legend de cross-filter (toggle).
  function renderMultiLineForecastChart(canvasId, weeks, seriesMap, opts) {
    opts = opts || {};
    var topN = opts.topN || 6;
    var forecastN = opts.forecastN || 0;
    var activeLabel = opts.activeLabel || null;
    var onLegendClick = opts.onLegendClick;
    var sgColors = { 'Gaming': C.gaming, 'Business& Productivity': C.bnp, 'Handheld': C.handheld };

    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');

    var labelsRanked = Object.keys(seriesMap).sort(function (a, b) { return (seriesMap[b].qty || 0) - (seriesMap[a].qty || 0); });
    var topLabels = labelsRanked.slice(0, topN);

    var nHist = weeks.length;
    var forecastWeeks = forecastN ? WU.getNextNWeekLabels(weeks[weeks.length - 1], forecastN) : [];
    var allLabels = weeks.concat(forecastWeeks).map(function (w) { return fmt.weekAxisLabel(w); });

    var datasets = topLabels.map(function (label, i) {
      var byWeek = seriesMap[label].byWeek || {};
      var hist = weeks.map(function (w) { return byWeek[w] || 0; });
      var forecast = forecastN ? linearForecast(hist, forecastN) : [];
      var color = sgColors[label] || colorAt(i);
      var isDim = activeLabel && activeLabel !== label;
      return {
        label: label,
        data: hist.concat(forecast),
        backgroundColor: 'transparent',
        borderWidth: isDim ? 1.5 : 2.5,
        borderColor: isDim ? hexToRgba(color, 0.35) : color,
        _baseColor: color, // Dung cho forecast segment color fade
        pointRadius: function (c) { return c.dataIndex >= nHist ? 0 : (isDim ? 1.5 : 2.5); },
        pointHoverRadius: 5,
        pointBackgroundColor: color,
        tension: 0.3,
        segment: forecastN ? {
          borderDash: function (c) { return c.p0DataIndex >= nHist - 1 ? [3, 5] : undefined; },
          borderColor: function (c) {
            if (c.p0DataIndex < nHist - 1) return undefined; // use dataset borderColor
            var ds = c.chart.data.datasets[c.datasetIndex];
            var base = ds._baseColor || ds.borderColor;
            return hexToRgba(typeof base === 'string' && base.startsWith('#') ? base : '#94A3B8', 0.4);
          }
        } : undefined
      };
    });

    charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels: allLabels, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true, position: 'top',
            labels: { boxWidth: 10, boxHeight: 10, font: { size: 10.5, weight: '600' }, usePointStyle: true, pointStyle: 'rectRounded' },
            onClick: function (evt, item) {
              if (onLegendClick) onLegendClick(item.text);
            }
          },
          tooltip: {
            backgroundColor: '#0F172A', padding: 10, cornerRadius: 8, mode: 'index', intersect: false,
            callbacks: {
              title: function (items) {
                var idx = items[0].dataIndex;
                return allLabels[idx] + (idx >= nHist ? ' (forecast)' : '');
              }
            }
          }
        },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false }, ticks: { color: C.textSecondary, font: { size: 10, weight: '600' }, maxRotation: 0, autoSkip: true } },
          y: { beginAtZero: true, grace: '10%', ticks: { color: C.textSecondary } }
        }
      }
    });
  }

  // ===== 3. Bar chart cong don (cumulative) - This period vs Last Year =====
  // Toi gian: KHONG truc X/Y, KHONG legend canvas (dung legend HTML rieng ben
  // ngoai) - chi con cot + tooltip khi hover, dung lam "sparkline" ben canh
  // con so Total Userbuy.
  function renderAccumulateBarChart(canvasId, weeks, thisYear, lastYear) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');
    function cumulate(arr) {
      var sum = 0;
      return arr.map(function (v) { sum += (v || 0); return sum; });
    }
    var labels = weeks.map(function (w) { return w; });
    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'This period', data: cumulate(thisYear), backgroundColor: C.accentMSI, borderRadius: 2, maxBarThickness: 14 },
          { label: 'Last Year', data: cumulate(lastYear), backgroundColor: '#CBD5E1', borderRadius: 2, maxBarThickness: 14 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0F172A', padding: 8, cornerRadius: 6, mode: 'index', intersect: false,
            titleFont: { size: 10.5 }, bodyFont: { size: 10.5 }
          }
        },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { display: false },
          y: { display: false, beginAtZero: true }
        }
      }
    });
  }

  // ===== 4. Donut chart - ty trong Userbuy theo Series Group =====
  function renderDonutChart(canvasId, items, onClickItem) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');
    var sgColors = { 'Gaming': C.gaming, 'Business& Productivity': C.bnp, 'Handheld': C.handheld };
    charts[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: items.map(function (d) { return d.label; }),
        datasets: [{
          data: items.map(function (d) { return d.value; }),
          backgroundColor: items.map(function (d, i) { return sgColors[d.label] || colorAt(i); }),
          borderColor: '#fff', borderWidth: 2, hoverOffset: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        onClick: function (evt, elements) {
          if (onClickItem && elements && elements.length) onClickItem(items[elements[0].index].label);
        },
        onHover: function (evt, elements) {
          evt.native.target.style.cursor = (elements && elements.length) ? 'pointer' : 'default';
        },
        plugins: {
          legend: { display: true, position: 'right', labels: { boxWidth: 10, boxHeight: 10, font: { size: 11, weight: '600' }, usePointStyle: true, pointStyle: 'circle' } },
          tooltip: {
            backgroundColor: '#0F172A', padding: 10, cornerRadius: 8,
            callbacks: {
              label: function (c) {
                var total = c.dataset.data.reduce(function (a, v) { return a + v; }, 0);
                var pct = total > 0 ? (c.raw / total * 100).toFixed(1) : '0.0';
                return c.label + ': ' + fmt.number(c.raw) + ' (' + pct + '%)';
              }
            }
          }
        }
      }
    });
  }

  // ===== 5. Horizontal bar generic (van giu lai cho cac noi khac co the can) =====
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
    renderMultiLineForecastChart: renderMultiLineForecastChart,
    renderAccumulateBarChart: renderAccumulateBarChart,
    renderDonutChart: renderDonutChart,
    renderDimensionBar: renderDimensionBar
  };
})();
