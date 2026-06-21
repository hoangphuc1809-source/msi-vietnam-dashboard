// MSI Vietnam Dashboard - Shared week/quarter utilities
// Tach rieng tu logic da co trong app.js (Market Overall) de tab Userbuy
// Tracking dung lai DUNG 1 cong thuc, khong copy/paste lech va khong dong
// vao app.js dang on dinh.

window.MsiWeekUtils = (function () {
  'use strict';

  // Date -> 'YYYYWNN' (ISO week)
  function isoWeekLabel(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNum = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dayNum + 3);
    var firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    var firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
    var weekNum = 1 + Math.round((d - firstThursday) / (7 * 24 * 3600 * 1000));
    return d.getUTCFullYear() + 'W' + (weekNum < 10 ? '0' + weekNum : weekNum);
  }

  // 'YYYYWNN' -> Date cua Thu Nam trong tuan ISO do (quy doi an toan qua ranh gioi nam)
  function weekLabelToThursday(weekLabel) {
    var m = String(weekLabel || '').match(/^(\d{4})W(\d{2})$/);
    if (!m) return new Date();
    var year = parseInt(m[1], 10);
    var week = parseInt(m[2], 10);
    var jan4 = new Date(Date.UTC(year, 0, 4));
    var jan4DayNum = (jan4.getUTCDay() + 6) % 7;
    var week1Monday = new Date(jan4.getTime() - jan4DayNum * 24 * 3600 * 1000);
    return new Date(week1Monday.getTime() + ((week - 1) * 7 + 3) * 24 * 3600 * 1000);
  }

  // N tuan rolling KET THUC tai anchorWeek (bao gom anchorWeek)
  function getRollingNWeekLabels(anchorWeek, n) {
    n = n || 13;
    var anchorDate = weekLabelToThursday(anchorWeek);
    var labels = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(anchorDate.getTime() - i * 7 * 24 * 3600 * 1000);
      labels.push(isoWeekLabel(d));
    }
    return labels;
  }

  function getCurrentYearQuarter() {
    var today = new Date();
    var y = today.getFullYear();
    var q = Math.floor(today.getMonth() / 3) + 1;
    return { year: String(y), quarter: 'Q' + q, month: today.getMonth() + 1 };
  }

  function monthLabel(n) {
    return 'M' + (n < 10 ? '0' + n : n);
  }

  // Thang cuoi cung cua 1 Quarter ('Q1'->M03, 'Q2'->M06, 'Q3'->M09, 'Q4'->M12)
  function lastMonthOfQuarter(quarter) {
    var map = { Q1: 3, Q2: 6, Q3: 9, Q4: 12 };
    return monthLabel(map[quarter] || 12);
  }

  // So sanh selYears/selQuarters voi nam/quy hien tai. Tra ve true neu lua chon
  // (hoac khong chon gi) trung khop voi ky HIEN TAI.
  function isCurrentPeriod(selYears, selQuarters) {
    var current = getCurrentYearQuarter();
    var ok = true;
    if (selYears && selYears.length && selYears.indexOf(current.year) === -1) ok = false;
    if (selQuarters && selQuarters.length && selQuarters.indexOf(current.quarter) === -1) ok = false;
    return ok;
  }

  // Tuan neo cho cac tinh toan "rolling" - theo DUNG dropdown Year/Quarter dang
  // chon (giong logic Market Overall): ky hien tai -> today-1 tuan; ky qua khu ->
  // tuan cuoi cung co du lieu trong ky do (can truyen ham lay danh sach tuan).
  function getRollingAnchorWeek(selYears, selQuarters, getWeeksForFiltersFn) {
    if (isCurrentPeriod(selYears, selQuarters)) {
      return isoWeekLabel(new Date(Date.now() - 7 * 24 * 3600 * 1000));
    }
    var current = getCurrentYearQuarter();
    var refYear = (selYears && selYears.length) ? selYears[selYears.length - 1] : current.year;
    var filterObj = { year: [refYear] };
    if (selQuarters && selQuarters.length) filterObj.quarter = [selQuarters[selQuarters.length - 1]];
    var weeks = getWeeksForFiltersFn ? getWeeksForFiltersFn(filterObj) : [];
    if (!weeks.length) return isoWeekLabel(new Date(Date.now() - 7 * 24 * 3600 * 1000));
    return weeks[weeks.length - 1];
  }

  // ===== Inventory Snapshot Rule =====
  // Xac dinh THANG (cho Disty Monthly INV) va TUAN (cho Dealer On Hand + trung
  // binh User Buy) dung de chup snapshot ton kho, theo dung filter Year/Quarter
  // dang chon tren dropdown:
  // - Quarter HIEN TAI (vd Q2 Y2026)  -> Thang hien tai (M06), tuan hien tai
  // - Quarter QUA KHU (vd Q4 Y2025)   -> Thang cuoi quy do (M12 cho Q4...), tuan
  //   cuoi cung co du lieu trong quy do
  // - All quarters, nam HIEN TAI       -> Thang hien tai - 1, tuan hien tai - 1
  // - All quarters, nam QUA KHU        -> M12 (thang cuoi nam), tuan cuoi nam do
  function getInventorySnapshotPeriod(selYears, selQuarters, getWeeksForFiltersFn) {
    var current = getCurrentYearQuarter();
    var refYear = (selYears && selYears.length) ? selYears[selYears.length - 1] : current.year;
    var refQuarter = (selQuarters && selQuarters.length) ? selQuarters[selQuarters.length - 1] : null;
    var isCurYear = (refYear === current.year);

    if (refQuarter) {
      var isCurQuarter = isCurYear && refQuarter === current.quarter;
      if (isCurQuarter) {
        return {
          year: refYear,
          month: monthLabel(current.month),
          week: isoWeekLabel(new Date())
        };
      }
      var lastMonth = lastMonthOfQuarter(refQuarter);
      var filterObj = { year: [refYear], quarter: [refQuarter] };
      var weeks = getWeeksForFiltersFn ? getWeeksForFiltersFn(filterObj) : [];
      var week = weeks.length ? weeks[weeks.length - 1] : null;
      return { year: refYear, month: lastMonth, week: week };
    }

    // All quarters
    if (isCurYear) {
      var prevMonthNum = current.month - 1 < 1 ? 1 : current.month - 1;
      return {
        year: refYear,
        month: monthLabel(prevMonthNum),
        week: isoWeekLabel(new Date(Date.now() - 7 * 24 * 3600 * 1000))
      };
    }
    var filterObjY = { year: [refYear] };
    var weeksY = getWeeksForFiltersFn ? getWeeksForFiltersFn(filterObjY) : [];
    var weekY = weeksY.length ? weeksY[weeksY.length - 1] : null;
    return { year: refYear, month: 'M12', week: weekY };
  }

  // N tuan TIEP THEO sau anchorWeek (khong bao gom anchorWeek) - dung cho truc
  // thoi gian cua phan forecast
  function getNextNWeekLabels(anchorWeek, n) {
    n = n || 3;
    var anchorDate = weekLabelToThursday(anchorWeek);
    var labels = [];
    for (var i = 1; i <= n; i++) {
      var d = new Date(anchorDate.getTime() + i * 7 * 24 * 3600 * 1000);
      labels.push(isoWeekLabel(d));
    }
    return labels;
  }

  return {
    isoWeekLabel: isoWeekLabel,
    weekLabelToThursday: weekLabelToThursday,
    getRollingNWeekLabels: getRollingNWeekLabels,
    getNextNWeekLabels: getNextNWeekLabels,
    getCurrentYearQuarter: getCurrentYearQuarter,
    isCurrentPeriod: isCurrentPeriod,
    getRollingAnchorWeek: getRollingAnchorWeek,
    getInventorySnapshotPeriod: getInventorySnapshotPeriod,
    lastMonthOfQuarter: lastMonthOfQuarter,
    monthLabel: monthLabel
  };
})();
