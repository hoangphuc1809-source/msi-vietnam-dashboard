# MSI Dashboard - Deployment Info

## Apps Script Web App
- Spreadsheet: Data Analysic - Calculated (1tb7jA_0GEpqJfw-Tl3UKIprPkWJq-dI3j2Ke1aqnrTQ)
- Apps Script file added: DashboardAPI.gs (does not touch existing Code.gs sync engine)
- Deployment: Web app, Execute as: Me, Who has access: Anyone
- Deployed: Jun 19, 2026, Version 1

## Web App URL (production)
https://script.google.com/macros/s/AKfycbwA403Z2FAYM_qyq0sGNqTfWuRiJc9rhSrb7RoZRFKzYD45YWFBF1y08L3Y_H3iQmC3/exec

## Endpoints
- ?action=ping  -> {ok:true, time:...}
- ?action=ihs   -> {rows:[...], meta:{...}}  (default if no action param)

## Verified output (as of deploy)
- rowCount: 9183
- minWeek: 2024W04, maxWeek: 2026W24
- customers: AN PHAT, CELLPHONES, FPT RETAIL JSC, GEARVN, Hoang Ha Mobile, Mobile World, NGUYEN KIM, PHI LONG, PHONG VU
- brands: Acer, Asus, Dell, HP, Lenovo, MSI, Others
- seriesGroups: Business& Productivity, Gaming

## IMPORTANT - keeping this alive
- Caching: 5 min server-side cache (CacheService) to reduce load
- If you edit DashboardAPI.gs in the future, you MUST create a NEW deployment version
  (Deploy > Manage deployments > Edit (pencil) > New version > Deploy)
  otherwise changes won't reflect on the /exec URL.
