# MSI Dashboard - Deployment Info

## Apps Script Web App
- Spreadsheet: Data Analysic - Calculated (1tb7jA_0GEpqJfw-Tl3UKIprPkWJq-dI3j2Ke1aqnrTQ)
- Apps Script file added: DashboardAPI.gs (does not touch existing Code.gs sync engine)
- Deployment: Web app, Execute as: Me, Who has access: Anyone
- Deployed: Jun 19, 2026, Version 1
- Updated: Jun 20, 2026 - added action=nv (RAW - NV Report) - REQUIRES NEW DEPLOYMENT VERSION (see below)

## Web App URL (production)
https://script.google.com/macros/s/AKfycbwA403Z2FAYM_qyq0sGNqTfWuRiJc9rhSrb7RoZRFKzYD45YWFBF1y08L3Y_H3iQmC3/exec

## Endpoints
- ?action=ping  -> {ok:true, time:...}
- ?action=ihs   -> {rows:[...], meta:{...}}  (default if no action param)
- ?action=nv    -> {brandRows:[...], gpuRows:[...], meta:{...}}  (NEW Jun 20 - chua deploy)

## Verified output (as of last deploy, action=ihs)
- rowCount: 9183
- minWeek: 2024W04, maxWeek: 2026W24
- customers: AN PHAT, CELLPHONES, FPT RETAIL JSC, GEARVN, Hoang Ha Mobile, Mobile World, NGUYEN KIM, PHI LONG, PHONG VU
- brands: Acer, Asus, Dell, HP, Lenovo, MSI, Others
- seriesGroups: Business& Productivity, Gaming

## action=nv (NEW - chua co tren live URL, can deploy)
- Doc tab "RAW - NV Report 1" (hoac "RAW - NV Report" - code tu thu ca 2 ten, xem
  bien SHEET_RAW_NV_CANDIDATES trong DashboardAPI.gs neu can sua)
- Tach thanh brandRows (Report by = 'By Brands') va gpuRows (Report by = 'by GPUs')
- Da test logic parse bang cach gia lap getValues() tu file CSV export thuc te
  (raw_nv_report.csv, 3234 dong: 1078 brandRows + 2156 gpuRows) - khop 100% voi
  ban tinh tay bang Python, khong co sai lech nao tren cac field client thuc su dung.
- Client (docs/js/nvData.js) UU TIEN goi action=nv; neu chua deploy hoac loi se
  TU DONG fallback ve static snapshot (docs/data/nv-report.json, cap nhat 15/6) -
  nghia la dashboard van chay binh thuong ngay ca khi BAN CHUA tao deployment moi,
  va se tu chuyen sang live data ngay khi deploy xong, khong can sua gi them.

## CACH DEPLOY ACTION=NV (lan nay can lam de co live data):
1. Mo Apps Script editor (script.google.com) cua project gan voi spreadsheet
   "Data Analysic - Calculated"
2. Mo file DashboardAPI.gs, COPY TOAN BO noi dung file apps-script/DashboardAPI.gs
   trong repo nay, PASTE DE GHI DE noi dung cu
3. Luu (Ctrl+S)
4. (Tuy chon nhung nen lam) Chay ham testGetNvReportData() 1 lan trong editor de
   kiem tra: neu bao loi "Khong tim thay sheet NV Report", mo sheet that ra xem
   ten tab chinh xac la gi, sua bien SHEET_RAW_NV_CANDIDATES o dau file cho khop
5. Deploy > Manage deployments > bam icon but chi (Edit) > Version: New version
   > Deploy
   (QUAN TRONG: phai tao New version, sua code roi luu thoi KHONG du de len live)
6. URL /exec giu nguyen, khong can sua docs/js/config.js

## IMPORTANT - keeping this alive
- Caching: 5 min server-side cache cho IHS (CACHE_SECONDS), 30 min cho NV Report
  (CACHE_SECONDS_NV) vi NV it bien dong hon trong ngay
- Neu ban edit DashboardAPI.gs trong tuong lai, LUON phai tao NEW deployment version
  (Deploy > Manage deployments > Edit (pencil) > New version > Deploy)
  neu khong thay doi se khong len live tren URL /exec

## action=sellout (NEW Jun 20 - chua co tren live URL, can deploy)
- Doc tab "Weekly Sales Data" tu spreadsheet RIENG (18_tzWNt7-Y1fV6ak7-bnw7kWLskSKTDi5x0F90gZo-w),
  KHONG phai spreadsheet chinh (1tb7jA...) - dung SpreadsheetApp.openById() de
  mo cheo. Tai khoan chay Apps Script can co quyen doc spreadsheet nay.
- Gop san theo (Week, Series Group), tra ve payload nho (vai chuc KB)
- Dung cho duong "All Customers" tren chart "MSI - weekly S/O (Market)" -
  so sanh Sell Out toan bo mang luoi dealer (~109 customers) vs chi Key Dealers (IHS)
- Client (docs/js/salesData.js) cung uu tien live, fallback ve
  docs/data/weekly-sellout.json neu chua deploy - giong nguyen tac voi action=nv
- Cach deploy: GIONG HET cach deploy action=nv o tren (paste DashboardAPI.gs
  moi, chay thu testGetWeeklySelloutData() de kiem tra, roi tao New version)

## Userbuy Tracking tab (NEW Jun 21) - 3 endpoint moi/mo rong, can deploy 1 lan

Tab moi `docs/userbuy.html` (nav rieng, link tu Market Overall). Can MOT lan
deploy DashboardAPI.gs phien ban moi nhat de tat ca live - lam dung 6 buoc
"CACH DEPLOY ACTION=NV" o tren (paste de ghi de DashboardAPI.gs, Deploy >
Manage deployments > New version). Sau khi deploy, chay thu trong Apps Script
editor de kiem tra ten tab dung:
- `testGetUserbuyData()` - neu loi "Khong tim thay sheet Userbuy data", mo
  spreadsheet "Data Analysic - Calculated" xem ten tab CHINH XAC la gi, sua
  bien `SHEET_USERBUY_CANDIDATES` dau file cho khop.
- `testGetDistyInvData()` - tuong tu, sua `SHEET_DISTY_INV_CANDIDATES` neu can.
- `testGetWeeklySelloutData()` - kiem tra co them `byDealer`/`byDisty`/
  `bySegment`/`byGpu`/`byModel` (khong chi `rows` nhu truoc).

### action=userbuy (MOI)
- Doc tab "Userbuy data" (CUNG spreadsheet voi RAW - IHS, khong can openById
  rieng). Tach payload thanh `skus` (thuoc tinh SKU, 1 dong/SKU) + `facts`
  (Week x SKU, da cong don User Buy/Rev) de payload gon hon nhieu so voi gui
  tung dong theo Ngay.
- Client: `docs/js/userbuyData.js`. Fallback: `docs/data/userbuy.json`.

### action=distyinv (MOI)
- Doc tab "Disty Monthly INV" (cung spreadsheet). Gop theo THANG (khac cac
  endpoint khac la theo TUAN). File nho nen tra ve full rows, khong gop them.
- Client: `docs/js/distyInvData.js`. Fallback: `docs/data/disty-inv.json`.

### action=sellout (MO RONG)
- Van tra ve `rows` (Week, Series Group) nhu cu - Market Overall (salesData.js)
  khong bi anh huong.
- THEM 4 mang moi tu CUNG 1 lan doc sheet 12MB (khong doc lai nhieu lan):
  `byDealer` (Week, Customer), `byDisty` (Week, Disty - co them On Hand),
  `bySegment` (Week, SEGMENT1 - chi co On Hand), `byGpu` (Week, GPU - chi co
  On Hand), `byModel` (Week, marketing_sku - chi co On Hand, cho bang Model
  Detail cua tab Userbuy Tracking).
- Client doc them: `docs/js/dealerSelloutData.js`. Fallback:
  `docs/data/weekly-sellout-detail.json`.

### Luu y ve static fallback snapshot
- `userbuy.json` va `disty-inv.json`: build tu FULL data thuc te (qua Google
  Drive), nen ngay ca khi CHUA deploy, 2 nguon nay van chuan/day du.
- `weekly-sellout-detail.json`: CHI co du lieu 2025W01-2025W07 (gioi han tai
  file CSV goc >10MB khong tai duoc full). Dealers/Disty table se trong neu
  dang xem nam/quy khac ngoai khoang nay - se TU DONG day du ngay khi Apps
  Script duoc deploy (khong can sua code).

### Gia dinh can xac nhan lai voi Phuc (xem tin nhan tom tat trong chat)
- WOI cua bang Dealers dung trung binh SELL OUT 4 tuan (khong phai Userbuy,
  vi Userbuy khong gan duoc vao Dealer) - co the can dieu chinh neu Phuc muon
  logic khac.

## action=monthlysales (NEW Jun 21) - cho KPI "Dealers SOH"
- Doc tab "Monthly Sales data" (CUNG spreadsheet voi RAW - IHS / Userbuy data /
  Disty Monthly INV - khong can openById rieng).
- Cot quan trong: H=marketing_sku, X=On hand (cot 24, dung de tinh Dealers SOH).
  Day la ban MONTHLY cua Sell In/Sell Out/On Hand THEO TUNG DEALER (khac Weekly
  Sales Data la theo TUAN va theo TOAN BO mang luoi ~109 dealer).
- Gop theo (Year, Month, marketing_sku), cong don On Hand tren TAT CA Customer/
  Dealer (vi On Hand la snapshot ton kho tai 1 thoi diem, cong don nhieu dealer
  la dung).
- Dung CUNG "Inventory Snapshot Rule" (thang nao) voi Disty SOH de 2 con so
  cong lai (WOI blended) duoc dong nhat ve mat thoi gian.
- Test: `testGetMonthlySalesData()`. Neu loi "Khong tim thay sheet Monthly Sales
  data", sua bien `SHEET_MONTHLY_SALES_CANDIDATES`.
- Client: `docs/js/monthlySalesData.js`. Fallback: `docs/data/monthly-sales.json`
  (CHI co Y2024 Q1 M01-M02, gioi han tai file goc >10MB - se tu day du khi deploy).
