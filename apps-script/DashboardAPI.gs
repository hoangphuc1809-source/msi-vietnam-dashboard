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

// ===== Userbuy Tracking tab (NEW) =====
// "Userbuy data" + "Disty Monthly INV" nam CHUNG spreadsheet voi RAW - IHS
// (1tb7jA...) - khong can openById rieng. Thu nhieu ten tab vi viet hoa/khong
// dau cach co the khac nhau giua cac lan tao/sua sheet.
var SHEET_USERBUY_CANDIDATES = ['Userbuy data', 'UserBuy Data', 'Userbuy Data', 'UserBuy data'];
var SHEET_DISTY_INV_CANDIDATES = ['Disty Monthly INV', 'Disty Monthly INV.csv'];
var SHEET_MONTHLY_SALES_CANDIDATES = ['Monthly Sales data', 'Monthly Sales Data', 'Monthly Sales data.csv'];
var CACHE_SECONDS_USERBUY = 1800; // 30 phut
var CACHE_SECONDS_DISTY_INV = 1800; // 30 phut
var CACHE_SECONDS_MONTHLY_SALES = 1800; // 30 phut

// SEGMENT1 duoc coi la High-End (theo MSI dashboard project - final ver)
var HIGH_END_SEGMENTS = { 'Titan': true, 'Raider': true, 'Vector': true, 'Stealth': true };

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
} else if (action === 'userbuy') {
payload = getUserbuyData_();
} else if (action === 'distyinv') {
payload = getDistyInvData_();
} else if (action === 'monthlysales') {
payload = getMonthlySalesData_();
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

// Tim sheet trong 1 spreadsheet theo danh sach ten ung vien (thu lan luot).
function findSheetByCandidates_(ss, candidates) {
for (var i = 0; i < candidates.length; i++) {
var sheet = ss.getSheetByName(candidates[i]);
if (sheet) return sheet;
}
return null;
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
// G=SEGMENT1 H=High End I=Color J=Keyboard K=Platform L=Gen M=CPU Segment
// N=CPU Series O=CPU P=GPU Q=Mem R=HDD S=PanelSize T=Disty U=SRP
// V=Price Segment W=Customer Number X=Customer Y=Channel Type Z=Sell In
// AA=Sell Out AB=On Hand AC=Province AD=VN Region AE=Sales Rep AF=Status
// AG=GPU Vendor
// Gop san theo (Week, Series Group) de payload nho gon cho Market Overall -
// khong gui tung dong SKU/Customer ve client (tranh vuot gioi han 95KB cache).
// NEW: cung gop them theo (Week, Customer), (Week, Disty), (Week, SEGMENT1) va
// (Week, GPU) trong CUNG 1 lan doc sheet (tranh doc lai sheet ngoai 12MB nhieu
// lan) de phuc vu tab Userbuy Tracking - cac bang Dealers/Disty/Segment/GPU can
// Sell Out + Revenue (SRP*SellOut) + On Hand (snapshot, cong don theo tung SKU
// trong CUNG 1 tuan la dung vi On Hand la ton kho tai thoi diem do, khong phai
// dong chay nhu Sell Out).
function getWeeklySelloutData_() {
var cache = CacheService.getScriptCache();
var cached = cache.get('sellout_data_v3');
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
if (lastRow < 2) return { rows: [], byDealer: [], byDisty: [], bySegment: [], byGpu: [], byModel: [], byDealerModel: [], byDistyModel: [], meta: {} };
var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
var aggSg = {}; // key 'week|sg' -> sum sellOut (Market Overall - khong doi)
var aggDealer = {}; // key 'week|customer' -> {sellOut, sellIn, onHand, rev}
var aggDisty = {}; // key 'week|disty' -> {sellOut, onHand, rev}
var aggSegment = {}; // key 'week|segment1' -> {onHand}
var aggGpu = {}; // key 'week|gpu' -> {onHand}
var aggModel = {}; // key 'week|marketing_sku' -> {onHand} (cho Model Detail table)
var aggDealerModel = {}; // key 'week|customer|sku' -> sellOut (cross-filter sell out theo model)
var aggDistyModel = {};  // key 'week|disty|sku'    -> sellOut (cross-filter sell out theo model)
var dealerChannel = {}; // customer -> channelType (gan nhat thay duoc)
for (var i = 0; i < values.length; i++) {
var r = values[i];
var week = r[3];
if (!week) continue;
var sku = r[4] || '';
var sg = r[5] || 'Unknown';
var segment1 = r[6] || 'Unknown';
var gpu = r[15] || 'Unknown';
var disty = r[19] || 'Unknown';
var srp = toNumber_(r[20]);
var customer = r[23] || 'Unknown';
var channelType = r[24] || '';
var sellIn = toNumber_(r[25]);
var sellOut = toNumber_(r[26]);
var onHand = toNumber_(r[27]);
var rev = srp * sellOut;

var keySg = week + '|' + sg;
aggSg[keySg] = (aggSg[keySg] || 0) + sellOut;

var keyDealer = week + '|' + customer;
if (!aggDealer[keyDealer]) aggDealer[keyDealer] = { sellOut: 0, sellIn: 0, onHand: 0, rev: 0 };
aggDealer[keyDealer].sellOut += sellOut;
aggDealer[keyDealer].sellIn += sellIn;
aggDealer[keyDealer].onHand += onHand;
aggDealer[keyDealer].rev += rev;
if (channelType) dealerChannel[customer] = channelType;

var keyDisty = week + '|' + disty;
if (!aggDisty[keyDisty]) aggDisty[keyDisty] = { sellOut: 0, onHand: 0, rev: 0 };
aggDisty[keyDisty].sellOut += sellOut;
aggDisty[keyDisty].onHand += onHand;
aggDisty[keyDisty].rev += rev;

var keySeg = week + '|' + segment1;
aggSegment[keySeg] = (aggSegment[keySeg] || 0) + onHand;

var keyGpu = week + '|' + gpu;
aggGpu[keyGpu] = (aggGpu[keyGpu] || 0) + onHand;

if (sku) {
var keyModel = week + '|' + sku;
aggModel[keyModel] = (aggModel[keyModel] || 0) + onHand;
// byDealerModel va byDistyModel cho cross-filter sell out theo model
if (customer && customer !== 'Unknown' && sellOut > 0) {
var keyDM = week + '|' + customer + '|' + sku;
aggDealerModel[keyDM] = (aggDealerModel[keyDM] || 0) + sellOut;
}
if (disty && disty !== 'Unknown' && sellOut > 0) {
var keyDisM = week + '|' + disty + '|' + sku;
aggDistyModel[keyDisM] = (aggDistyModel[keyDisM] || 0) + sellOut;
}
}
}
var rows = [];
for (var key in aggSg) {
var parts = key.split('|');
rows.push({ w: parts[0], sg: parts[1], sellOut: round2_(aggSg[key]) });
}
var byDealer = [];
for (var key2 in aggDealer) {
var parts2 = key2.split('|');
var a = aggDealer[key2];
byDealer.push({ w: parts2[0], cust: parts2[1], channel: dealerChannel[parts2[1]] || '', sellOut: round2_(a.sellOut), sellIn: round2_(a.sellIn), onHand: round2_(a.onHand), rev: round2_(a.rev) });
}
var byDisty = [];
for (var key3 in aggDisty) {
var parts3 = key3.split('|');
var d = aggDisty[key3];
byDisty.push({ w: parts3[0], disty: parts3[1], sellOut: round2_(d.sellOut), onHand: round2_(d.onHand), rev: round2_(d.rev) });
}
var bySegment = [];
for (var key4 in aggSegment) {
var parts4 = key4.split('|');
bySegment.push({ w: parts4[0], segment: parts4[1], onHand: round2_(aggSegment[key4]) });
}
var byGpu = [];
for (var key5 in aggGpu) {
var parts5 = key5.split('|');
byGpu.push({ w: parts5[0], gpu: parts5[1], onHand: round2_(aggGpu[key5]) });
}
var byModel = [];
for (var key6 in aggModel) {
var parts6 = key6.split('|');
byModel.push({ w: parts6[0], sku: parts6[1], onHand: round2_(aggModel[key6]) });
}
var byDealerModel = [];
for (var keyDM2 in aggDealerModel) {
var pDM = keyDM2.split('|');
byDealerModel.push({ w: pDM[0], cust: pDM[1], sku: pDM[2], sellOut: round2_(aggDealerModel[keyDM2]) });
}
var byDistyModel = [];
for (var keyDisM2 in aggDistyModel) {
var pDis = keyDisM2.split('|');
byDistyModel.push({ w: pDis[0], disty: pDis[1], sku: pDis[2], sellOut: round2_(aggDistyModel[keyDisM2]) });
}
var result = {
rows: rows,
byDealer: byDealer,
byDisty: byDisty,
bySegment: bySegment,
byGpu: byGpu,
byModel: byModel,
byDealerModel: byDealerModel,
byDistyModel: byDistyModel,
meta: {
generatedAt: new Date().toISOString(),
source: sheet.getName() + ' (live, external spreadsheet)',
rowCount: rows.length,
dealerRowCount: byDealer.length,
distyRowCount: byDisty.length,
segmentRowCount: bySegment.length,
gpuRowCount: byGpu.length,
modelRowCount: byModel.length,
dealerModelRowCount: byDealerModel.length,
distyModelRowCount: byDistyModel.length
}
};
try {
var json = JSON.stringify(result);
if (json.length < 950000) {
cache.put('sellout_data_v4', json, CACHE_SECONDS_SELLOUT);
}
} catch (e) {
}
return result;
}

// Doc tab "Userbuy data" (CUNG spreadsheet voi RAW - IHS) - chi so HOAT DONG
// cua khach hang cuoi tren he thong rieng cua MSI, KHONG gan vao Dealer nao
// (khac voi Sell Out cua Weekly Sales Data, von la sell-out CUA Dealer).
// Cot: A=Year B=Quarter C=Month D=Week E=Date F=marketing_sku G=Series Group
// H=SEGMENT1 I=CPU Segment J=CPU Series K=CPU L=GPU M=Mem N=Disty O=SRP
// P=Price Segment Q=Status R=User Buy S=UserBuy (Rev)
// De payload gon: tach thanh skus (thuoc tinh tinh theo tung SKU, lay tu dong
// GAN NHAT theo Date) + facts (Week x SKU, cong don User Buy/Rev tu cac dong
// theo Ngay trong cung 1 tuan).
function getUserbuyData_() {
var cache = CacheService.getScriptCache();
var cached = cache.get('userbuy_data_v1');
if (cached) {
return JSON.parse(cached);
}
var ss = SpreadsheetApp.getActiveSpreadsheet();
var sheet = findSheetByCandidates_(ss, SHEET_USERBUY_CANDIDATES);
if (!sheet) throw new Error('Khong tim thay sheet Userbuy data. Da thu: ' + SHEET_USERBUY_CANDIDATES.join(', ') + '. Kiem tra lai ten tab va sua bien SHEET_USERBUY_CANDIDATES.');
var lastRow = sheet.getLastRow();
var lastCol = sheet.getLastColumn();
if (lastRow < 2) return { skus: [], facts: [], meta: {} };
var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
var skuMap = {}; // sku -> { ...attrs, lastDate }
var factMap = {}; // 'week|sku' -> { qty, rev }
for (var i = 0; i < values.length; i++) {
var r = values[i];
var week = r[3];
var sku = r[5];
if (!week || !sku) continue;
var dateVal = r[4];
var sg = normSeriesGroup_(r[6] || '');
var seg1 = r[7] || '';
var cpuSeg = r[8] || '';
var cpuSeries = r[9] || '';
var cpu = r[10] || '';
var gpu = r[11] || '';
var mem = r[12] || '';
var disty = r[13] || '';
var srp = toNumber_(r[14]);
var priceSeg = r[15] || '';
var status = r[16] || '';
var qty = toNumber_(r[17]);
var rev = toNumber_(r[18]);

var dateMs = (dateVal instanceof Date) ? dateVal.getTime() : 0;
var existing = skuMap[sku];
if (!existing || dateMs >= existing._lastDateMs) {
skuMap[sku] = {
sku: sku, sg: String(sg), seg1: String(seg1), cpuSeg: String(cpuSeg),
cpuSeries: String(cpuSeries), cpu: String(cpu), gpu: String(gpu), mem: String(mem),
disty: String(disty), srp: srp, priceSeg: String(priceSeg), status: String(status),
highEnd: !!HIGH_END_SEGMENTS[String(seg1)],
_lastDateMs: dateMs
};
}

var fKey = week + '|' + sku;
if (!factMap[fKey]) factMap[fKey] = { qty: 0, rev: 0 };
factMap[fKey].qty += qty;
factMap[fKey].rev += rev;
}
var skus = [];
for (var s in skuMap) {
var sk = skuMap[s];
delete sk._lastDateMs;
skus.push(sk);
}
var facts = [];
for (var fk in factMap) {
var fparts = fk.split('|');
facts.push({ w: fparts[0], sku: fparts[1], qty: round2_(factMap[fk].qty), rev: round2_(factMap[fk].rev) });
}
var result = {
skus: skus,
facts: facts,
meta: {
generatedAt: new Date().toISOString(),
source: sheet.getName() + ' (live)',
skuCount: skus.length,
factCount: facts.length
}
};
try {
var json = JSON.stringify(result);
if (json.length < 950000) {
cache.put('userbuy_data_v1', json, CACHE_SECONDS_USERBUY);
}
} catch (e) {
}
return result;
}

// Doc tab "Disty Monthly INV" (CUNG spreadsheet voi RAW - IHS) - ton kho tai
// kho cua Nha Phan Phoi (NPP/Disty), gop theo THANG (khac Userbuy/Weekly Sales
// la gop theo TUAN). File nho (~vai tram KB) nen tra ve FULL rows, khong can
// gop them.
// Cot: A=Year B=Quarter C=Month D=marketing_sku E=Series Group F=SEGMENT1
// G=High End H=Gen I=CPU Segment J=GPU K=Disty L=SRP M=Price Segment
// N=Status O=GPU Vendor P=Shipment Q=Sell in R=On Hand
function getDistyInvData_() {
var cache = CacheService.getScriptCache();
var cached = cache.get('disty_inv_data_v1');
if (cached) {
return JSON.parse(cached);
}
var ss = SpreadsheetApp.getActiveSpreadsheet();
var sheet = findSheetByCandidates_(ss, SHEET_DISTY_INV_CANDIDATES);
if (!sheet) throw new Error('Khong tim thay sheet Disty Monthly INV. Da thu: ' + SHEET_DISTY_INV_CANDIDATES.join(', ') + '. Kiem tra lai ten tab va sua bien SHEET_DISTY_INV_CANDIDATES.');
var lastRow = sheet.getLastRow();
var lastCol = sheet.getLastColumn();
if (lastRow < 2) return { rows: [], meta: {} };
var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
var rows = [];
for (var i = 0; i < values.length; i++) {
var r = values[i];
var month = r[2];
var sku = r[3];
if (!month || !sku) continue;
rows.push({
y: String(r[0] || ''), q: String(r[1] || ''), m: String(month),
sku: String(sku), sg: normSeriesGroup_(r[4] || ''), seg1: String(r[5] || ''),
highEnd: String(r[6] || '').toLowerCase() === 'yes',
gen: String(r[7] || ''), cpuSeg: String(r[8] || ''), gpu: String(r[9] || ''),
disty: String(r[10] || ''), srp: toNumber_(r[11]), priceSeg: String(r[12] || ''),
status: String(r[13] || ''), gpuVendor: String(r[14] || ''),
shipment: toNumber_(r[15]), sellIn: toNumber_(r[16]), onHand: toNumber_(r[17])
});
}
var result = {
rows: rows,
meta: {
generatedAt: new Date().toISOString(),
source: sheet.getName() + ' (live)',
rowCount: rows.length
}
};
try {
var json = JSON.stringify(result);
if (json.length < 950000) {
cache.put('disty_inv_data_v1', json, CACHE_SECONDS_DISTY_INV);
}
} catch (e) {
}
return result;
}

// Doc tab "Monthly Sales data" (CUNG spreadsheet voi RAW - IHS) - day la ban
// MONTHLY (khac Weekly Sales Data la theo TUAN) cua Sell In/Sell Out/On Hand
// THEO TUNG DEALER. Dung de tinh "Dealers SOH" (KPI scorecard) - On Hand cong
// don TREN TOAN BO mang luoi dealer, theo Year/Quarter/Month.
// Cot: A=Year B=Quarter C=Month D=Customer Number E=Customer F=Sales Rep
// G=Channel Type H=marketing_sku I=Series Group J=SEGMENT1 K=Gen L=CPU Segment
// M=CPU Series N=CPU O=GPU P=Mem Q=Disty R=SRP S=Price Segment T=Status
// U=Quarter Sales Rep V=Sell In W=Sell Out X=On hand (...con nhieu cot khac,
// khong can cho muc dich nay)
// Gop theo (Year, Month, marketing_sku) - cong don On Hand tren TAT CA Customer
// (dealer) tai thoi diem do la dung vi On Hand la ton kho snapshot, khong phai
// dong chay. Tach skuMeta + facts giong Userbuy data de payload gon.
function getMonthlySalesData_() {
var cache = CacheService.getScriptCache();
var cached = cache.get('monthly_sales_data_v3');
if (cached) {
return JSON.parse(cached);
}
var ss = SpreadsheetApp.getActiveSpreadsheet();
var sheet = findSheetByCandidates_(ss, SHEET_MONTHLY_SALES_CANDIDATES);
if (!sheet) throw new Error('Khong tim thay sheet Monthly Sales data. Da thu: ' + SHEET_MONTHLY_SALES_CANDIDATES.join(', ') + '. Kiem tra lai ten tab va sua bien SHEET_MONTHLY_SALES_CANDIDATES.');
var lastRow = sheet.getLastRow();
var lastCol = sheet.getLastColumn();
if (lastRow < 2) return { skus: [], facts: [], byDealer: [], byDealerSkus: {}, byDealerModelOnHand: {}, meta: {} };
var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
var skuMap = {};
var factMap = {}; // 'year|month|sku' -> onHand (cong don tat ca Customer)
var dealerMap = {}; // 'year|month|customer' -> onHand (cong don tat ca SKU)
var dealerSkuSet = {}; // customer -> { sku: true } - de xay dung cross-filter Dealer -> Model Detail
var dealerModelOnHandMap = {}; // 'customer||sku||y||m' -> onHand (Dealers table ONHAND theo model)
for (var i = 0; i < values.length; i++) {
var r = values[i];
var year = r[0];
var month = r[2];
var customer = r[4];
var sku = r[7];
if (!year || !month || !sku) continue;
var sg = normSeriesGroup_(r[8] || '');
var seg1 = r[9] || '';
var cpuSeg = r[11] || '';
var gpu = r[14] || '';
var disty = r[16] || '';
var status = r[19] || '';
var onHand = toNumber_(r[23]);

skuMap[sku] = {
sku: sku, sg: String(sg), seg1: String(seg1), cpuSeg: String(cpuSeg),
gpu: String(gpu), disty: String(disty), status: String(status),
highEnd: !!HIGH_END_SEGMENTS[String(seg1)]
};

var key = String(year).replace(/^Y/, '') + '|' + String(month) + '|' + sku;
factMap[key] = (factMap[key] || 0) + onHand;

if (customer) {
var dKey = String(year).replace(/^Y/, '') + '|' + String(month) + '|' + customer;
dealerMap[dKey] = (dealerMap[dKey] || 0) + onHand;
// Track which SKUs this dealer has carried (co onHand bat ky thoi diem nao)
if (!dealerSkuSet[customer]) dealerSkuSet[customer] = {};
dealerSkuSet[customer][sku] = true;
// byDealerModelOnHand: per-dealer per-model per-month OnHand (Dealers table cross-filter)
if (onHand > 0) {
var normY = String(year).replace(/^Y/, '');
var keyDMH = customer + '||' + sku + '||' + normY + '||' + String(month);
dealerModelOnHandMap[keyDMH] = (dealerModelOnHandMap[keyDMH] || 0) + onHand;
}
}
}
var skus = [];
for (var s in skuMap) skus.push(skuMap[s]);
var facts = [];
for (var fk in factMap) {
var parts = fk.split('|');
facts.push({ y: parts[0], m: parts[1], sku: parts[2], onHand: round2_(factMap[fk]) });
}
var byDealer = [];
for (var dk in dealerMap) {
var dParts = dk.split('|');
byDealer.push({ y: dParts[0], m: dParts[1], cust: dParts[2], onHand: round2_(dealerMap[dk]) });
}
// byDealerSkus: { 'CellPhones': ['Katana 15 B12V', 'Titan GT77', ...], ... }
// Dung cho cross-filter: khi click Dealers table -> Model Detail chi hien thi
// cac model ma dealer do co inventory trong Monthly Sales data.
var byDealerSkus = {};
for (var c in dealerSkuSet) {
byDealerSkus[c] = Object.keys(dealerSkuSet[c]).sort();
}
// byDealerModelOnHand: {'cust||sku||y||m': onHand} - tra ve only non-zero
// Dung cho Dealers table OnHand theo model (cross-filter)
var byDealerModelOnHand = {};
for (var keyDMH2 in dealerModelOnHandMap) {
if (dealerModelOnHandMap[keyDMH2] > 0) byDealerModelOnHand[keyDMH2] = round2_(dealerModelOnHandMap[keyDMH2]);
}
var result = {
skus: skus,
facts: facts,
byDealer: byDealer,
byDealerSkus: byDealerSkus,
byDealerModelOnHand: byDealerModelOnHand,
meta: {
generatedAt: new Date().toISOString(),
source: sheet.getName() + ' (live)',
skuCount: skus.length,
factCount: facts.length,
dealerCount: byDealer.length
}
};
try {
var json = JSON.stringify(result);
if (json.length < 950000) {
cache.put('monthly_sales_data_v3', json, CACHE_SECONDS_MONTHLY_SALES);
}
} catch (e) {
}
return result;
}

function round2_(n) {
return Math.round(n * 100) / 100;
}

// Chuan hoa Series Group - sua loi cooking data khien "Business & Productivity"
// (co cach truoc &) va "Business& Productivity" (khong cach) bi tach thanh 2
// gia tri khac nhau trong khi thuc chat la 1. Canonical = "Business& Productivity"
// (khop voi quy uoc da dung san trong config.js/userbuyCharts.js).
function normSeriesGroup_(sg) {
var s = String(sg || '').trim();
if (/^Business\s*&\s*Productivity$/i.test(s)) return 'Business& Productivity';
return s;
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
Logger.log('byDealer rows: ' + data.byDealer.length);
Logger.log('byDisty rows: ' + data.byDisty.length);
Logger.log('bySegment rows: ' + data.bySegment.length);
Logger.log('byGpu rows: ' + data.byGpu.length);
Logger.log('Meta: ' + JSON.stringify(data.meta));
Logger.log('Sample row: ' + JSON.stringify(data.rows[0]));
Logger.log('Sample byDealer: ' + JSON.stringify(data.byDealer[0]));
Logger.log('Sample byDisty: ' + JSON.stringify(data.byDisty[0]));
Logger.log('Sample bySegment: ' + JSON.stringify(data.bySegment[0]));
Logger.log('Sample byGpu: ' + JSON.stringify(data.byGpu[0]));
}

function testGetUserbuyData() {
var data = getUserbuyData_();
Logger.log('SKU count: ' + data.skus.length);
Logger.log('Fact count: ' + data.facts.length);
Logger.log('Meta: ' + JSON.stringify(data.meta));
Logger.log('Sample sku: ' + JSON.stringify(data.skus[0]));
Logger.log('Sample fact: ' + JSON.stringify(data.facts[0]));
}

function testGetDistyInvData() {
var data = getDistyInvData_();
Logger.log('Row count: ' + data.rows.length);
Logger.log('Meta: ' + JSON.stringify(data.meta));
Logger.log('Sample row: ' + JSON.stringify(data.rows[0]));
}

function testGetMonthlySalesData() {
var data = getMonthlySalesData_();
Logger.log('SKU count: ' + data.skus.length);
Logger.log('Fact count: ' + data.facts.length);
Logger.log('Dealer count: ' + data.byDealer.length);
Logger.log('Meta: ' + JSON.stringify(data.meta));
Logger.log('Sample sku: ' + JSON.stringify(data.skus[0]));
Logger.log('Sample fact: ' + JSON.stringify(data.facts[0]));
Logger.log('Sample dealer: ' + JSON.stringify(data.byDealer[0]));
}



