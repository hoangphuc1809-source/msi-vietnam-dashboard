// MSI Vietnam - IHS Market Share Dashboard
// Apps Script Web App - Data Bridge (file: DashboardAPI.gs)
//
// Reads data from sheet "RAW - IHS" and returns JSON for the static dashboard
// hosted on GitHub Pages. This file does NOT touch the existing Code.gs sync engine.
//
// DEPLOY STEPS:
// 1. Deploy > New deployment > Type: Web app, Execute as: Me, Who has access: Anyone
// 2. Copy the /exec URL into docs/js/config.js (APPS_SCRIPT_URL)
// 3. After editing this file, create a NEW deployment version for changes to go live.

var SHEET_RAW_IHS = 'RAW - IHS';
var CACHE_SECONDS = 300;

function doGet(e) {
try {
var action = (e && e.parameter && e.parameter.action) || 'ihs';
var payload;
if (action === 'ihs') {
payload = getIhsData_();
} else if (action === 'ping') {
payload = { ok: true, time: new Date().toISOString() };
} else {
payload = { error: 'Unknown action: ' + action };
}
return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
} catch (err) {
return ContentService.createTextOutput(JSON.stringify({ error: String(err), stack: err.stack })).setMimeType(ContentService.MimeType.JSON);
}
}

function getIhsData_() {
var cache = CacheService.getScriptCache();
var cached = cache.get('ihs_data_v1');
if (cached) {
return JSON.parse(cached);
}
var ss = SpreadsheetApp.getActiveSpreadsheet();
var sheet = ss.getSheetByName(SHEET_RAW_IHS);
if (!sheet) throw new Error('Sheet not found: ' + SHEET_RAW_IHS);
var lastRow = sheet.getLastRow();
var lastCol = sheet.getLastColumn();
if (lastRow < 2) return { rows: [], meta: {} };
var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
var rows = [];
var minWeek = null;
var maxWeek = null;
var customersSet = {};
var brandsSet = {};
var seriesGroupSet = {};
for (var i = 0; i < values.length; i++) {
var r = values[i];
var year = r[0];
var quarter = r[1];
var week = r[2];
var customer = r[3];
var seriesGroup = r[4];
var brand = r[5];
var numbers = r[6];
var ttlVolume = r[7];
var brandsShared = r[8];
var brandsVolume = r[9];
var lastYear = r[10];
var lastWk = r[11];
var last2Wk = r[12];
var last3Wk = r[13];
var salesRep = r[16];
var channelType = r[17];
if (!year && !customer && !brand) continue;
var isTotal = typeof brand === 'string' && brand.toString().trim().toUpperCase().indexOf('TTL') === 0;
var row = {
y: String(year || ''),
q: String(quarter || ''),
w: String(week || ''),
cust: String(customer || ''),
sg: String(seriesGroup || ''),
brand: String(brand || ''),
share: toNumber_(numbers),
ttlVol: toNumber_(ttlVolume),
brandShare: parsePercent_(brandsShared),
brandVol: toNumber_(brandsVolume),
lastYear: toNumber_(lastYear),
lastWk: toNumber_(lastWk),
last2Wk: toNumber_(last2Wk),
last3Wk: toNumber_(last3Wk),
rep: String(salesRep || ''),
channel: String(channelType || ''),
isTotal: isTotal
};
rows.push(row);
if (row.w) {
if (minWeek === null || row.w < minWeek) minWeek = row.w;
if (maxWeek === null || row.w > maxWeek) maxWeek = row.w;
}
if (row.cust) customersSet[row.cust] = true;
if (row.brand && !isTotal) brandsSet[row.brand] = true;
if (row.sg) seriesGroupSet[row.sg] = true;
}
var result = {
rows: rows,
meta: {
generatedAt: new Date().toISOString(),
rowCount: rows.length,
minWeek: minWeek,
maxWeek: maxWeek,
customers: Object.keys(customersSet).sort(),
brands: Object.keys(brandsSet).sort(),
seriesGroups: Object.keys(seriesGroupSet).sort()
}
};
try {
var json = JSON.stringify(result);
if (json.length < 95000) {
cache.put('ihs_data_v1', json, CACHE_SECONDS);
}
} catch (e) {
}
return result;
}

function toNumber_(v) {
if (v === '' || v === null || v === undefined) return 0;
if (typeof v === 'number') return v;
var n = parseFloat(String(v).replace(/,/g, ''));
return isNaN(n) ? 0 : n;
}

function parsePercent_(v) {
if (v === '' || v === null || v === undefined) return 0;
if (typeof v === 'number') {
return v;
}
var s = String(v).trim();
if (s.indexOf('%') === s.length - 1) {
var n = parseFloat(s.replace('%', ''));
return isNaN(n) ? 0 : n / 100;
}
var n2 = parseFloat(s);
return isNaN(n2) ? 0 : n2;
}

function testGetIhsData() {
var data = getIhsData_();
Logger.log('Row count: ' + data.rows.length);
Logger.log('Meta: ' + JSON.stringify(data.meta));
Logger.log('Sample row: ' + JSON.stringify(data.rows[0]));
}
