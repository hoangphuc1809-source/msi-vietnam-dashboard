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

// Ten tab co the la 'RAW - NV Report 1' (theo Links.csv) hoac 'RAW - NV Report'
// (it sheet duoc dat ten khac nhau giua cac lan tao). Thu lan luot, neu khong
// thay cai nao thi bao loi ro rang de de sua.
var SHEET_RAW_NV_CANDIDATES = ['RAW - NV Report 1', 'RAW - NV Report', 'RAW - NV Report1'];
var CACHE_SECONDS_NV = 1800; // 30 phut

// "Weekly Sales Data" KHONG nam trong spreadsheet nay (1tb7jA...) ma o 1
// spreadsheet rieng (theo Links.csv) - phai mo cheo bang openById. Tai khoan
// chay Apps Script ("Execute as: Me") can co quyen doc spreadsheet nay.
var EXTERNAL_SALES_SS_ID = '18_tzWNt7-Y1fV6ak7-bnw7kWLskSKTDi5x0F90gZo-w';
var SHEET_WEEKLY_SALES_CANDIDATES = ['Weekly Sales Data'];
var CACHE_SECONDS_SELLOUT = 1800; // 30 phut

function doGet(e) {
try {
var action = (e && e.parameter && e.parameter.action) || 'ihs';
var payload;
if (action === 'ihs') {
payload = getIhsData_();
} else if (action === 'nv') {
payload = getNvReportData_();
} else if (action === 'sellout') {
payload = getWeeklySelloutData_();
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

function findNvSheet_(ss) {
for (var i = 0; i < SHEET_RAW_NV_CANDIDATES.length; i++) {
var sheet = ss.getSheetByName(SHEET_RAW_NV_CANDIDATES[i]);
if (sheet) return sheet;
}
return null;
}

// Doc tab "RAW - NV Report 1": bao cao sell-out toan thi truong Gaming (tat ca
// brand, khong chia theo dealer), gom 2 loai dong phan biet boi cot "Report by":
// 'By Brands' (volume tung brand theo tuan) va 'by GPUs' (volume + share theo
// tung tier GPU, cot UserBuy la volume rieng cua MSI cho tier do).
// Cot: A=Year B=Quarter C=Week D=Item E=Reference# F=Brands G=GPU H=Volume
// I=Report by J=Series Group K=Last Year L=Last Wk M=Last 2 Wk N=Last 3 Wk
// O=Last 4 Wk P=MSI Volume Q=UserBuy
function getNvReportData_() {
var cache = CacheService.getScriptCache();
var cached = cache.get('nv_data_v1');
if (cached) {
return JSON.parse(cached);
}
var ss = SpreadsheetApp.getActiveSpreadsheet();
var sheet = findNvSheet_(ss);
if (!sheet) throw new Error('Khong tim thay sheet NV Report. Da thu: ' + SHEET_RAW_NV_CANDIDATES.join(', ') + '. Kiem tra lai ten tab va sua bien SHEET_RAW_NV_CANDIDATES.');
var lastRow = sheet.getLastRow();
var lastCol = sheet.getLastColumn();
if (lastRow < 2) return { brandRows: [], gpuRows: [], meta: {} };
var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
var brandRows = [];
var gpuRows = [];
for (var i = 0; i < values.length; i++) {
var r = values[i];
var year = r[0];
var quarter = r[1];
var week = r[2];
var item = r[3];
var brand = r[5];
var gpu = r[6];
var volume = r[7];
var reportBy = r[8];
var lastYear = r[10];
var userBuy = r[16];
if (!year && !item) continue;
if (reportBy === 'By Brands') {
brandRows.push({
y: String(year || ''),
q: String(quarter || ''),
w: String(week || ''),
brand: String(brand || ''),
vol: toNumber_(volume),
lastYear: toNumber_(lastYear)
});
} else if (reportBy === 'by GPUs') {
gpuRows.push({
y: String(year || ''),
q: String(quarter || ''),
w: String(week || ''),
gpu: String(gpu || ''),
vol: toNumber_(volume),
lastYear: toNumber_(lastYear),
msiVol: toNumber_(userBuy)
});
}
}
var result = {
brandRows: brandRows,
gpuRows: gpuRows,
meta: {
generatedAt: new Date().toISOString(),
source: sheet.getName() + ' (live)',
brandRowCount: brandRows.length,
gpuRowCount: gpuRows.length
}
};
try {
var json = JSON.stringify(result);
if (json.length < 95000) {
cache.put('nv_data_v1', json, CACHE_SECONDS_NV);
}
} catch (e) {
}
return result;
}

// Doc tab "Weekly Sales Data" tu spreadsheet NGOAI (khac voi spreadsheet
// chinh ma script nay dang bound vao) - day la Sell Out cua MSI tren TOAN BO
// mang luoi khach hang/dealer (~109 customers trong snapshot test), khac voi
// RAW - IHS chi co ~9 "Key Dealers" duoc track rieng.
// Cot: A=Year B=Quarter C=Month D=Week E=marketing_sku F=Series Group
// G=SEGMENT1 ... W=Customer Number X=Customer Y=Channel Type Z=Sell In
// AA=Sell Out AB=On Hand ...
// Gop san theo (Week, Series Group) de payload nho gon - khong gui tung dong
// SKU/Customer ve client (tranh vuot gioi han 95KB cache va cham client).
function getWeeklySelloutData_() {
var cache = CacheService.getScriptCache();
var cached = cache.get('sellout_data_v1');
if (cached) {
return JSON.parse(cached);
}
var extSs = SpreadsheetApp.openById(EXTERNAL_SALES_SS_ID);
var sheet = null;
for (var i = 0; i < SHEET_WEEKLY_SALES_CANDIDATES.length; i++) {
sheet = extSs.getSheetByName(SHEET_WEEKLY_SALES_CANDIDATES[i]);
if (sheet) break;
}
if (!sheet) throw new Error('Khong tim thay sheet Weekly Sales Data trong spreadsheet nguon. Da thu: ' + SHEET_WEEKLY_SALES_CANDIDATES.join(', '));
var lastRow = sheet.getLastRow();
var lastCol = sheet.getLastColumn();
if (lastRow < 2) return { rows: [], meta: {} };
var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
var agg = {}; // key 'week|sg' -> sum
for (var i = 0; i < values.length; i++) {
var r = values[i];
var week = r[3];
if (!week) continue;
var sg = r[5] || 'Unknown';
var sellOut = toNumber_(r[26]);
var key = week + '|' + sg;
agg[key] = (agg[key] || 0) + sellOut;
}
var rows = [];
for (var key in agg) {
var parts = key.split('|');
rows.push({ w: parts[0], sg: parts[1], sellOut: Math.round(agg[key] * 100) / 100 });
}
var result = {
rows: rows,
meta: {
generatedAt: new Date().toISOString(),
source: sheet.getName() + ' (live, external spreadsheet)',
rowCount: rows.length
}
};
try {
var json = JSON.stringify(result);
if (json.length < 95000) {
cache.put('sellout_data_v1', json, CACHE_SECONDS_SELLOUT);
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

function testGetNvReportData() {
var data = getNvReportData_();
Logger.log('Brand rows: ' + data.brandRows.length);
Logger.log('GPU rows: ' + data.gpuRows.length);
Logger.log('Meta: ' + JSON.stringify(data.meta));
Logger.log('Sample brand row: ' + JSON.stringify(data.brandRows[0]));
Logger.log('Sample gpu row: ' + JSON.stringify(data.gpuRows[0]));
}

function testGetWeeklySelloutData() {
var data = getWeeklySelloutData_();
Logger.log('Rows: ' + data.rows.length);
Logger.log('Meta: ' + JSON.stringify(data.meta));
Logger.log('Sample row: ' + JSON.stringify(data.rows[0]));
}
