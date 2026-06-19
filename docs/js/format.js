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
    number: number,
    percent: percent,
    percentSigned: percentSigned,
    truncate: truncate
  };
})();
