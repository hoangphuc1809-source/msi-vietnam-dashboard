/**
 * MSI Vietnam - IHS Market Share Dashboard
 * Apps Script Web App - Data Bridge
 *
 * Đọc dữ liệu từ sheet "RAW - IHS" (gid theo SPREADSHEET_ID bên dưới)
 * và trả về JSON gọn nhẹ, đã được pre-aggregate một phần để giảm tải cho client.
 *
 * CÁCH DEPLOY:
 * 1. Mở Google Sheet > Extensions > Apps Script
 * 2. Xoá nội dung mặc định, dán toàn bộ file này vào
 * 3. Deploy > New deployment > Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy URL deployment (dạng https://script.google.com/macros/s/XXXX/exec)
 * 5. Dán URL đó vào biến APPS_SCRIPT_URL trong file docs/js/config.js của dashboard
 *
 * Mỗi khi sửa code này, phải tạo "New deployment" mới (hoặc Manage deployments > Edit > New version)
 * để thay đổi có hiệu lực trên URL /exec.
 */

// ============ CONFIG ============
const SHEET_RAW_IHS = 'RAW - IHS';
const CACHE_SECONDS = 300; // cache 5 phút để giảm tải khi nhiều người cùng mở dashboard

// ============ ENTRY POINT ============
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'ihs';
    let payload;

    if (action === 'ihs') {
      payload = getIhsData_();
    } else if (action === 'ping') {
      payload = { ok: true, time: new Date().toISOString() };
    } else {
      payload = { error: 'Unknown action: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: String(err), stack: err.stack }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============ CORE: RAW - IHS ============
/**
 * Cấu trúc sheet RAW - IHS (cột A->R):
 * Year | Quarter | Week | Customer | Series Group | Brands | Numbers (%share decimal)
 * | TTL Volume (chỉ điền ở dòng TTL) | Brands Shared (% text, mọi dòng) | Brands Volume (số tuyệt đối, mọi dòng)
 * | Last Year | Last Wk | Last 2 Wk | Last 3 Wk | MSI (last wk) | MSI Volume | Sales Rep | Channel Type
 *
 * Mỗi block = 1 Series Group tại 1 Customer/Week, gồm N dòng brand + 1 dòng "TTL <SeriesGroup>"
 */
function getIhsData_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('ihs_data_v1');
  if (cached) {
    return JSON.parse(cached);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RAW_IHS);
  if (!sheet) throw new Error('Sheet not found: ' + SHEET_RAW_IHS);

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { rows: [], meta: {} };

  // Đọc toàn bộ dữ liệu 1 lần (nhanh hơn nhiều so với đọc từng ô)
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const rows = [];
  let minWeek = null, maxWeek = null;
  const customersSet = {};
  const brandsSet = {};
  const seriesGroupSet = {};

  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    const year = r[0];          // A
    const quarter = r[1];       // B
    const week = r[2];          // C  (vd '2026W21')
    const customer = r[3];      // D
    const seriesGroup = r[4];   // E
    const brand = r[5];         // F
    const numbers = r[6];       // G  % share (decimal)
    const ttlVolume = r[7];     // H  chỉ có ở dòng TTL
    const brandsShared = r[8];  // I  % (có thể là text "36.0%" hoặc number)
    const brandsVolume = r[9];  // J  volume tuyệt đối
    const lastYear = r[10];     // K
    const lastWk = r[11];       // L
    const last2Wk = r[12];      // M
    const last3Wk = r[13];      // N
    // O, P (MSI last wk / MSI Volume) bỏ qua vì redundant với brand='MSI' + brandsVolume
    const salesRep = r[16];     // Q
    const channelType = r[17];  // R

    // Bỏ dòng hoàn toàn trống
    if (!year && !customer && !brand) continue;

    const isTotal = typeof brand === 'string' && brand.toString().trim().toUpperCase().indexOf('TTL') === 0;

    const row = {
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

  const result = {
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

  // Cache giới hạn 100KB/key trong Apps Script -> nếu data lớn, bỏ qua cache để tránh lỗi
  try {
    const json = JSON.stringify(result);
    if (json.length < 95000) {
      cache.put('ihs_data_v1', json, CACHE_SECONDS);
    }
  } catch (e) {
    // ignore cache errors, vẫn trả dữ liệu bình thường
  }

  return result;
}

// ============ HELPERS ============
function toNumber_(v) {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function parsePercent_(v) {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') {
    // Google Sheets percent format trả về dạng decimal (0.36) khi đọc qua getValues()
    return v;
  }
  const s = String(v).trim();
  if (s.endsWith('%')) {
    const n = parseFloat(s.replace('%', ''));
    return isNaN(n) ? 0 : n / 100;
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Hàm test thủ công trong Apps Script editor (Run > testGetIhsData)
 * để xem output trước khi deploy.
 */
function testGetIhsData() {
  const data = getIhsData_();
  Logger.log('Row count: ' + data.rows.length);
  Logger.log('Meta: ' + JSON.stringify(data.meta));
  Logger.log('Sample row: ' + JSON.stringify(data.rows[0]));
}
