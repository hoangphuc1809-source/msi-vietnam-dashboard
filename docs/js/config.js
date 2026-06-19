// MSI Vietnam Dashboard - Configuration
// Cap nhat APPS_SCRIPT_URL moi khi deploy lai Apps Script (xem apps-script/DEPLOYMENT_INFO.md)

window.MSI_CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwA403Z2FAYM_qyq0sGNqTfWuRiJc9rhSrb7RoZRFKzYD45YWFBF1y08L3Y_H3iQmC3/exec',

  // Auto-refresh interval (ms) - keo lai du lieu tu Google Sheet
  REFRESH_INTERVAL_MS: 5 * 60 * 1000, // 5 phut

  // ===== COLOR SYSTEM (theo dung MSI_Dashboard_Technical_Notes & MSI_dashboard_project) =====
  COLORS: {
    // Base / Light mode
    bg: '#F0F2F7',
    card: '#FFFFFF',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    accentMSI: '#CC0000',
    border: '#E2E8F0',

    // Semantic
    green: '#059669',
    greenBg: '#ECFDF5',
    yellow: '#D97706',
    yellowBg: '#FFFBEB',
    red: '#CC0000',
    redBg: '#FFF0F0',
    blue: '#0E4D99',
    blueBg: '#EFF6FF',

    // Series Group
    gaming: '#DC2626',
    bnp: '#1D4ED8',
    handheld: '#7C3AED',
    seriesOthers: '#64748B',

    // Distributors
    dgw: '#F97316',
    vsc: '#1E3A8A',
    spc: '#92400E',
    psd: '#1E3A8A',
    synnex: '#16A34A', // theo yeu cau: Synnex mau xanh la cay
    distyOthers: '#64748B',

    // Metric roles
    sellIn: '#1D4ED8',
    sellOut: '#059669',
    inventory: '#64748B',
    forecast: '#7C3AED',

    // Competitor brand colors (cho IHS market share charts)
    brand: {
      'MSI': '#DC2626',
      'Asus': '#0D9488',     // Cyan/Teal
      'Lenovo': '#F97316',   // Cam
      'Acer': '#84CC16',     // Olive/Lime
      'HP': '#2563EB',       // Xanh duong
      'Dell': '#0EA5E9',     // xanh duong nhat (Dell khong nam trong list goc, dung tong mau gan HP nhung phan biet)
      'Giga': '#94A3B8',     // Xam nhat
      'Others': '#CBD5E1'
    }
  }
};
