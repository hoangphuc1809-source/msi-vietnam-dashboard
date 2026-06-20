// MSI Vietnam Dashboard - Format utilities

window.MsiFormat = (function () {
  'use strict';

  // '2026W21' -> 'W21' (strip year, theo quy tac hien thi trong Technical Notes)
  function weekShort(w) {
    if (!w) return '';
    return w.replace(/^\d{4}/, '');
  }

  // '2026W21' -> { year: '2026', label: 'W21' } de ve truc X 2 dong (Year tren, Week duoi)
  function weekParts(w) {
    if (!w) return { year: '', label: '' };
    var m = w.match(/^(\d{4})(W\d+)$/);
    if (!m) return { year: '', label: w };
    return { year: m[1], label: m[2] };
  }

  // '2026W21' -> ['2026', 'W21'] - dung truc tiep lam label cho Chart.js de
  // render truc X 2 dong (Year tren, Week duoi) theo dung quy tac dinh dang
  // thoi gian: KHONG bao gio gop "2026W21" tren 1 dong truc X.
  function weekAxisLabel(w) {
    var p = weekParts(w);
    return [p.year, p.label];
  }

  // Format hien thi mot dong (cho bang/text, KHONG dung cho truc X chart):
  // week giu nguyen "2026W21", quarter/month co dau cach "2026 Q2" / "2026 M05"
  function quarterLabel(year, quarter) {
    var y = String(year || '').replace(/^Y/, '');
    var q = String(quarter || '');
    return y && q ? y + ' ' + q : (y || q);
  }

  function monthLabel(year, month) {
    var y = String(year || '').replace(/^Y/, '');
    var m = String(month || '');
    if (m && !/^M/.test(m)) m = 'M' + (m.length === 1 ? '0' + m : m);
    return y && m ? y + ' ' + m : (y || m);
  }

  // ['2026','Q2'] - cho truc X 2 dong cua chart theo quarter
  function quarterAxisLabel(year, quarter) {
    return [String(year || '').replace(/^Y/, ''), String(quarter || '')];
  }

  function monthAxisLabel(year, month) {
    var m = String(month || '');
    if (m && !/^M/.test(m)) m = 'M' + (m.length === 1 ? '0' + m : m);
    return [String(year || '').replace(/^Y/, ''), m];
  }

  function number(n) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return Math.round(n).toLocaleString('en-US');
  }

  function percent(n, digits) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    digits = digits === undefined ? 1 : digits;
    return (n * 100).toFixed(digits) + '%';
  }

  function percentSigned(n, digits) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    digits = digits === undefined ? 0 : digits;
    var v = n * 100;
    var sign = v > 0 ? '+' : '';
    return sign + v.toFixed(digits) + '%';
  }

  function truncate(str, len) {
    if (!str) return '';
    if (str.length <= len) return str;
    return str.slice(0, len - 1) + '\u2026';
  }

  return {
    weekShort: weekShort,
    weekParts: weekParts,
    weekAxisLabel: weekAxisLabel,
    quarterLabel: quarterLabel,
    monthLabel: monthLabel,
    quarterAxisLabel: quarterAxisLabel,
    monthAxisLabel: monthAxisLabel,
    number: number,
    percent: percent,
    percentSigned: percentSigned,
    truncate: truncate
  };
})();
