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
  // refField (optional): field name for last year value -> enables overlap + rich tooltip
  function renderHBarShare(canvasId, items, valueField, labelField, colorFn, onClickItem, refField) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');
    var hasRef = !!refField && items.some(function(d) { return d[refField] > 0; });

    // Plugin: ve Last Year bar (gray, full height) + This Year bar (color, overlap 50% len tren)
    var overlapPlugin = {
      id: 'hBarOverlay-' + canvasId,
      afterDraw: function(chart) {
        if (!hasRef) return;
        var meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data.length) return;
        var xScale = chart.scales.x;
        var c = chart.ctx;
        var barH = meta.data[0] ? meta.data[0].height : 16;
        var halfH = barH / 2;

        c.save();
        c.beginPath();
        c.rect(chart.chartArea.left, chart.chartArea.top,
          chart.chartArea.right - chart.chartArea.left,
          chart.chartArea.bottom - chart.chartArea.top);
        c.clip();

        items.forEach(function(d, i) {
          var bar = meta.data[i];
          if (!bar) return;
          var lyVal = d[refField] || 0;
          var tyVal = d[valueField] || 0;
          var x0 = xScale.getPixelForValue(0);
          var xLy = xScale.getPixelForValue(lyVal);
          var xTy = xScale.getPixelForValue(tyVal);
          var barCenterY = bar.y;
          var r = 3;

          // Last Year bar: full height (barH), center at barCenterY
          var lyW = Math.max(0, xLy - x0);
          var lyTop = barCenterY - halfH;
          c.fillStyle = '#CBD5E1';
          _roundRect(c, x0, lyTop, lyW, barH, r);
          c.fill();

          // This Year bar: full height (barH), shifted up 50% (overlap 50%)
          var tyW = Math.max(0, xTy - x0);
          var tyTop = barCenterY - halfH - halfH * 0.5;
          c.fillStyle = colorFn(d, i);
          _roundRect(c, x0, tyTop, tyW, barH, r);
          c.fill();
        });
        c.restore();
      }
    };

    // Plugin: label value (This Year) sau bar
    var labelPlugin = hBarValuePlugin(valueField);

    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: items.map(function (d) { return d[labelField]; }),
        datasets: [{
          data: items.map(function (d) { return d[valueField]; }),
          // Bars duoc ve boi plugin overlay -> dataset nay transparent (chi dung de xScale + click work)
          backgroundColor: hasRef
            ? items.map(function() { return 'transparent'; })
            : items.map(function (d, i) { return colorFn(d, i); }),
          borderColor: 'transparent',
          borderRadius: 4,
          maxBarThickness: 18
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 55 } },
        onClick: function (evt, elements) {
          if (onClickItem && elements && elements.length) {
            onClickItem(items[elements[0].index]);
          }
        },
        onHover: function (evt, elements) {
          evt.native.target.style.cursor = (onClickItem && elements && elements.length) ? 'pointer' : 'default';
        },
        interaction: { mode: 'y', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: hasRef ? {
            enabled: false,
            external: function(context) {
              var tooltipModel = context.tooltip;
              var canvasEl = context.chart.canvas;
              var tooltipEl = canvasEl._hbarTooltip;
              if (!tooltipEl) {
                tooltipEl = document.createElement('div');
                tooltipEl.style.cssText = 'position:absolute;background:#0F172A;color:#fff;padding:8px 12px;border-radius:6px;font-size:11px;pointer-events:none;white-space:nowrap;z-index:999;transition:opacity 0.1s;';
                canvasEl.parentElement.style.position = 'relative';
                canvasEl.parentElement.appendChild(tooltipEl);
                canvasEl._hbarTooltip = tooltipEl;
              }
              if (tooltipModel.opacity === 0) {
                tooltipEl.style.opacity = '0';
                return;
              }
              var idx = tooltipModel.dataPoints && tooltipModel.dataPoints[0]
                ? tooltipModel.dataPoints[0].dataIndex : -1;
              if (idx < 0 || idx >= items.length) { tooltipEl.style.opacity = '0'; return; }
              var d = items[idx];
              var tyVal = d[valueField] || 0;
              var lyVal = d[refField] || 0;
              var yoy = lyVal > 0 ? (tyVal - lyVal) / lyVal : null;
              var fmt = window.MsiFormat;
              var yoyStr = yoy === null ? '-' : (yoy >= 0 ? '+' : '') + (yoy * 100).toFixed(1) + '%';
              var yoyColor = yoy === null ? '#94A3B8' : yoy >= 0 ? '#22C55E' : '#EF4444';
              tooltipEl.innerHTML =
                '<div style="font-weight:700;margin-bottom:4px">' + String(d[labelField]) + '</div>' +
                '<div>This Year&nbsp;: ' + fmt.number(tyVal) + '</div>' +
                '<div>Last Year&nbsp;&nbsp;: ' + fmt.number(lyVal) + '</div>' +
                '<div>YoY&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: <span style="color:' + yoyColor + ';font-weight:700">' + yoyStr + '</span></div>';
              var pos = canvasEl.getBoundingClientRect();
              var canvasParent = canvasEl.parentElement.getBoundingClientRect();
              tooltipEl.style.opacity = '1';
              tooltipEl.style.left = (tooltipModel.caretX + pos.left - canvasParent.left + 10) + 'px';
              tooltipEl.style.top  = (tooltipModel.caretY + pos.top  - canvasParent.top  - 20) + 'px';
            }
          } : { backgroundColor: '#0F172A', padding: 10, cornerRadius: 8 }
        },
        scales: {
          x: { display: false, beginAtZero: true },
          y: { grid: { display: false }, ticks: { color: C.textPrimary, font: { size: 12, weight: '600' } } }
        }
      },
      plugins: hasRef ? [overlapPlugin, labelPlugin] : [labelPlugin]
    });
  }

  // Helper: rounded rect path
  function _roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    if (w <= 0 || h <= 0) { ctx.beginPath(); return; }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
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

    // GPU labels: ensure "RTX " prefix is present (data field already has it,
    // but normalise in case some rows use short form like "3050" only)
    var gpuLabel = function (gpu) {
      return /^RTX /i.test(gpu) ? gpu : 'RTX ' + gpu;
    };

    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: rows.map(function (d) { return gpuLabel(d.gpu); }),
        datasets: [
          {
            label: 'Nvidia',
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

  // ===== Scorecard horizontal bar: Top-N brand, This Period (solid color) + LY (light bg) =====
  // Matches the "Key Dealers - Volume" chart style: single solid bar + value label on the right.
  // LY duoc the hien bang nen track (lighter color, chiều rộng = LY value).
  function renderScorecardHBar(canvasId, items, valueField, refField, labelField, color) {
    destroyIfExists(canvasId);
    var ctx = document.getElementById(canvasId).getContext('2d');

    var itemsSnap = items;
    var vField = valueField;
    var rField = refField;
    var lField = labelField;
    var barColor = color;

    // Compute alpha color for LY track
    function hexToRgba(hex, alpha) {
      var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      return 'rgba('+r+','+g+','+b+','+alpha+')';
    }
    var lyColor = hexToRgba(barColor, 0.15);

    // Max value across both TY and LY for x-scale
    var maxVal = Math.max.apply(null, itemsSnap.map(function(d) {
      return Math.max(d[vField]||0, d[rField]||0);
    }));
    if (!maxVal) maxVal = 1;

    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: itemsSnap.map(function(d) { return String(d[lField]); }),
        datasets: [
          {
            label: 'Last Year',
            data: itemsSnap.map(function(d) { return d[rField] || 0; }),
            backgroundColor: lyColor,
            borderRadius: 4,
            barThickness: 18
          },
          {
            label: 'This Period',
            data: itemsSnap.map(function(d) { return d[vField] || 0; }),
            backgroundColor: barColor,
            borderRadius: 4,
            barThickness: 11
          }
        ]
      },
      plugins: [{
        id: 'hBarValueLabels',
        afterDraw: function(chart) {
          var meta = chart.getDatasetMeta(1); // This Period dataset
          if (!meta || !meta.data || !meta.data.length) return;
          var canvasCtx = chart.ctx;
          canvasCtx.save();
          canvasCtx.font = '700 10px var(--font-mono, monospace)';
          canvasCtx.fillStyle = C.textSecondary;
          canvasCtx.textAlign = 'left';
          canvasCtx.textBaseline = 'middle';
          var xScale = chart.scales.x;
          itemsSnap.forEach(function(d, i) {
            var bar = meta.data[i];
            if (!bar) return;
            var val = d[vField] || 0;
            var x1 = xScale.getPixelForValue(val);
            var centerY = bar.y;
            var labelText = window.MsiFormat ? window.MsiFormat.number(val) : val.toLocaleString();
            canvasCtx.fillText(labelText, x1 + 5, centerY);
          });
          canvasCtx.restore();
        }
      }],
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 52 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0F172A', padding: 10, cornerRadius: 6,
            titleFont: { size: 11, weight: '700' }, bodyFont: { size: 10 },
            mode: 'index',
            intersect: false,
            callbacks: {
              title: function(ctxArr) {
                var idx = ctxArr[0].dataIndex;
                return String(itemsSnap[idx][lField]);
              },
              label: function() { return ''; },
              afterBody: function(ctxArr) {
                var idx = ctxArr[0].dataIndex;
                var d = itemsSnap[idx];
                var thisY = d[vField] || 0;
                var lastY = d[rField] || 0;
                var yoy = lastY > 0 ? (thisY - lastY) / lastY : null;
                var fmt = window.MsiFormat;
                var yoyStr = yoy === null ? '-' : (yoy >= 0 ? '+' : '') + (yoy * 100).toFixed(1) + '%';
                return [
                  'This Year : ' + (fmt ? fmt.number(thisY) : thisY),
                  'Last Year  : ' + (fmt ? fmt.number(lastY) : lastY),
                  'YoY           : ' + yoyStr
                ];
              }
            }
          }
        },
        scales: {
          x: {
            display: false,
            beginAtZero: true,
            max: maxVal * 1.25,
            stacked: false
          },
          y: {
            grid: { display: false },
            ticks: {
              color: C.textSecondary,
              font: { size: 10, weight: '600' },
              padding: 4
            },
            stacked: false
          }
        }
      }
    });
  }

  return {
    renderMsiWeeklyTrend  return {
    renderMsiWeeklyTrend: renderMsiWeeklyTrend,
    renderDealersWeeklyBar: renderDealersWeeklyBar,
    renderMultiLineShare: renderMultiLineShare,
    renderHBarShare: renderHBarShare,
    renderStackedShareByDealer: renderStackedShareByDealer,
    renderQuarterlyTrendLine: renderQuarterlyTrendLine,
    renderWeeklyShareDualLine: renderWeeklyShareDualLine,
    renderGpuTierGroupedBar: renderGpuTierGroupedBar,
    renderDualMiniBar: renderScorecardHBar,
    renderScorecardHBar: renderScorecardHBar
  };
})();




