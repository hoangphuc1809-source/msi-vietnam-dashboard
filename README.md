# MSI Vietnam - Market Overall Dashboard (IHS Share Tracking)

Dashboard theo doi xu huong ban hang va thi phan MSI so voi cac doi thu canh tranh
(Asus, Lenovo, Acer, HP, Dell, Giga...) tai cac Key Dealers, dua tren du lieu IHS.

## Kien truc
- **Data source**: Google Sheet "RAW - IHS", duoc doc qua Google Apps Script Web App
  (file `apps-script/DashboardAPI.gs`) tra ve JSON.
- **Frontend**: HTML/CSS/JS thuan (khong build step), host tinh tren GitHub Pages,
  fetch du lieu truc tiep tu Apps Script moi 5 phut.
- **Tat ca chart/bang deu ho tro click-to-filter**: click vao Series Group (Gaming/B&P/Handheld),
  vao 1 dealer trong bang "Dealers Capacity", hoac vao 1 brand trong legend/bang "Brands"
  se loc toan bo dashboard theo lua chon do.

## Cau truc thu muc
```
apps-script/        Code Apps Script can dan vao Extensions > Apps Script cua Google Sheet
docs/                Toan bo dashboard tinh, duoc GitHub Pages serve truc tiep
  index.html
  css/dashboard.css
  js/
    config.js        URL Apps Script + bang mau (color system)
    format.js         Tien ich dinh dang so/tuan/%
    filterState.js    Quan ly trang thai filter toan cuc (click-to-filter)
    data.js            Fetch + tinh toan tu du lieu RAW - IHS
    charts.js          Render cac chart (Chart.js)
    tables.js           Render cac bang du lieu
    app.js               Ket noi tat ca lai (orchestrator)
  assets/msi-logo.png
```

## Cap nhat du lieu / Apps Script
Du lieu tu dong refresh moi 5 phut tu Google Sheet (khong can thao tac gi).

Neu can sua logic doc du lieu (vi du them sheet moi), sua file
`apps-script/DashboardAPI.gs`, dan lai vao Apps Script editor cua Google Sheet,
roi tao **New deployment version** (Deploy > Manage deployments > Edit > New version)
de thay doi co hieu luc tren URL /exec dang dung.

## Setup GitHub Pages
Settings > Pages > Source: Deploy from branch > Branch: main > Folder: /docs
