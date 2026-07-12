// ╔═══════════════════════════════════════════════════════════════╗
// ║  PATCH cho DashboardAPI.gs — Thêm endpoint action=target    ║
// ║  Paste TOÀN BỘ file này vào CUỐI DashboardAPI.gs hiện tại   ║
// ║  (trước dòng cuối cùng nếu có)                               ║
// ╚═══════════════════════════════════════════════════════════════╝
//
// SAU KHI PASTE xong, sửa function doGet():
//   Thêm dòng này VÀO GIỮA chuỗi if/else if, trước dòng "} else {"
//
//   } else if (action === 'target') {
//     payload = getDealersTargetData_();
//
// Sau đó: Deploy → New deployment → Web app → Execute as Me → Anyone
// Copy URL mới vào config.js (hoặc giữ URL cũ nếu dùng "Manage deployments")

var SHEET_DEALERS_TARGET_CANDIDATES = ['Dealers Target'];
var CACHE_SECONDS_TARGET = 1800;

function getDealersTargetData_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('dealers_target_data_v2');
  if (cached) {
    return JSON.parse(cached);
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // ── 1. Read Dealers Target tab ──
  // Cols: A=Year B=Quarter C=CustomersID D=Customer E=ChannelType
  //       F=Province G=VNRegion H=SalesRep I=SeriesGroup J=Target
  var tgtSheet = findSheetByCandidates_(ss, SHEET_DEALERS_TARGET_CANDIDATES);
  if (!tgtSheet) throw new Error('Sheet not found: Dealers Target');
  var tgtLast = tgtSheet.getLastRow();
  var tgtVals = tgtLast < 2 ? [] : tgtSheet.getRange(2, 1, tgtLast - 1, 10).getValues();
  
  var targets = [];
  for (var i = 0; i < tgtVals.length; i++) {
    var r = tgtVals[i];
    var y = String(r[0] || '').replace(/^Y/, '');
    var q = String(r[1] || '');
    var cust = String(r[3] || '').trim();
    var sg = normSeriesGroup_(r[8] || '');
    var tgt = toNumber_(r[9]);
    if (!y || !q || !cust || !sg) continue;
    targets.push({
      y: y, q: q, cust: cust, sg: sg, target: tgt,
      channel: String(r[4] || ''), region: String(r[6] || ''),
      rep: String(r[7] || '')
    });
  }
  
  // ── 2. Read Monthly Sales Data (Sell In / Sell Out / OnHand) ──
  // Cols: A=Year(0) B=Quarter(1) C=Month(2) D=CustNum(3) E=Customer(4)
  //       F=SalesRep(5) G=ChannelType(6) H=marketing_sku(7) I=SeriesGroup(8)
  //       J=SEGMENT1(9) ... Q=Disty(16) ... V=SellIn(21) W=SellOut(22) X=OnHand(23)
  var msSheet = findSheetByCandidates_(ss, SHEET_MONTHLY_SALES_CANDIDATES);
  if (!msSheet) throw new Error('Sheet not found: Monthly Sales Data');
  var msLast = msSheet.getLastRow();
  var msLastCol = msSheet.getLastColumn();
  var msVals = msLast < 2 ? [] : msSheet.getRange(2, 1, msLast - 1, Math.min(msLastCol, 24)).getValues();
  
  // Aggregate by Year/Quarter/Customer/SeriesGroup
  var actMap = {};   // 'y|q|cust|sg' -> {sellIn, sellOut, lastMonth}
  var ohMap = {};    // 'y|q|cust|sg|month' -> onHand sum
  var distyMap = {}; // 'y|q|sg|disty' -> {sellIn, sellOut}
  
  for (var j = 0; j < msVals.length; j++) {
    var m = msVals[j];
    var ay = String(m[0] || '').replace(/^Y/, '');
    var aq = String(m[1] || '');
    var aMonth = String(m[2] || '');
    var aCust = String(m[4] || '').trim();
    var aSg = normSeriesGroup_(m[8] || '');
    var aDisty = String(m[16] || '').trim();
    var aSellIn = toNumber_(m[21]);
    var aSellOut = toNumber_(m[22]);
    var aOnHand = toNumber_(m[23]);
    if (!ay || !aq || !aCust) continue;
    
    // ── Actuals by Customer ──
    var key = ay + '|' + aq + '|' + aCust + '|' + aSg;
    if (!actMap[key]) {
      actMap[key] = { sellIn: 0, sellOut: 0, lastMonth: '' };
    }
    var entry = actMap[key];
    entry.sellIn += aSellIn;
    entry.sellOut += aSellOut;
    if (aMonth > entry.lastMonth) entry.lastMonth = aMonth;
    
    // OnHand per month (sum across SKUs within that month)
    var ohKey = key + '|' + aMonth;
    ohMap[ohKey] = (ohMap[ohKey] || 0) + aOnHand;
    
    // ── Actuals by Distributor ──
    if (aDisty) {
      var dKey = ay + '|' + aq + '|' + aSg + '|' + aDisty;
      if (!distyMap[dKey]) distyMap[dKey] = { sellIn: 0, sellOut: 0 };
      distyMap[dKey].sellIn += aSellIn;
      distyMap[dKey].sellOut += aSellOut;
    }
  }
  
  // Build actuals array (onHand = latest month's total)
  var actuals = [];
  for (var ak in actMap) {
    var parts = ak.split('|');
    var a = actMap[ak];
    var latestOh = ohMap[ak + '|' + a.lastMonth] || 0;
    actuals.push({
      y: parts[0], q: parts[1], cust: parts[2], sg: parts[3],
      sellIn: round2_(a.sellIn), sellOut: round2_(a.sellOut),
      onHand: round2_(latestOh)
    });
  }
  
  // Build disty actuals array
  var distyActuals = [];
  for (var dk in distyMap) {
    var dParts = dk.split('|');
    var d = distyMap[dk];
    distyActuals.push({
      y: dParts[0], q: dParts[1], sg: dParts[2], disty: dParts[3],
      sellIn: round2_(d.sellIn), sellOut: round2_(d.sellOut)
    });
  }
  
  var result = {
    targets: targets,
    actuals: actuals,
    distyActuals: distyActuals,
    meta: {
      generatedAt: new Date().toISOString(),
      targetRows: targets.length,
      actualRows: actuals.length,
      distyRows: distyActuals.length
    }
  };
  
  // Cache (may exceed 100KB limit — split if needed)
  try {
    var json = JSON.stringify(result);
    if (json.length < 95000) {
      cache.put('dealers_target_data_v2', json, CACHE_SECONDS_TARGET);
    } else {
      // Split into chunks for CacheService (100KB per key limit)
      var chunks = [];
      for (var ci = 0; ci < json.length; ci += 90000) {
        chunks.push(json.substring(ci, ci + 90000));
      }
      var keys = {};
      for (var ck = 0; ck < chunks.length; ck++) {
        keys['dealers_target_chunk_' + ck] = chunks[ck];
      }
      keys['dealers_target_data_v2'] = JSON.stringify({ chunked: true, count: chunks.length });
      cache.putAll(keys, CACHE_SECONDS_TARGET);
    }
  } catch (e) {
    // Cache write failed — OK, will just re-compute next time
  }
  return result;
}

// Test function — run manually to verify
function testGetDealersTargetData() {
  var data = getDealersTargetData_();
  Logger.log('Targets: ' + data.targets.length);
  Logger.log('Actuals: ' + data.actuals.length);
  Logger.log('Disty actuals: ' + data.distyActuals.length);
  Logger.log('Meta: ' + JSON.stringify(data.meta));
  if (data.targets.length > 0) Logger.log('Sample target: ' + JSON.stringify(data.targets[0]));
  if (data.actuals.length > 0) Logger.log('Sample actual: ' + JSON.stringify(data.actuals[0]));
}
