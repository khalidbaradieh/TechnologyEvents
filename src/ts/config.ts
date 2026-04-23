// ================================================================
// config.js  —  الإعدادات المركزية
// غيّر هذا الملف فقط إذا أردت تغيير قاعدة البيانات أو خدمة الاستضافة
// ================================================================

// ── إعدادات Firebase ─────────────────────────────────────────
export const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const _firebaseKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const _firebaseMissing = _firebaseKeys.filter(k => !FIREBASE_CONFIG[k]);
if (_firebaseMissing.length) {
  console.error('[Firebase] Missing config keys:', _firebaseMissing.join(', '), '→ check Vercel env vars or local .env files');
}

// ── مسارات Firestore ──────────────────────────────────────────
// news/{articleId}          ← مقال واحد لكل وثيقة
// settings/latest           ← { items: [...] }
// settings/breaking         ← { items: [...] }
// settings/cats             ← { items: [...] }
// settings/site             ← { wide_pinned, site_buttons, ticker_speed,
//                                ticker_visible, site_title, subscribe_text,
//                                breaking_active, breaking_start, breaking_duration }
export const DB = {
  NEWS:     'news',
  SETTINGS: 'settings',
  users:    'users',
  rbac:     'rbac',
  news:     'news',
  activity: 'activity',
  S: {
    LATEST:   'latest',
    BREAKING: 'breaking',
    CATS:     'cats',
    SITE:     'site',
  }
};

// ── رقم الإصدار (زِد هذا الرقم عند كل نشر لمسح الكاش) ──────
export const VERSION = "2.1.0";

// ── مفاتيح localStorage (مركزية لمنع الأخطاء المتناثرة) ─────
export const STORE = {
  NEWS:        'atq_news',
  LATEST:      'atq_latest',
  BREAKING:    'atq_breaking',
  CATS:        'atq_cats',
  RBAC_USER:   'atq_rbac_user',
  RBAC_ROLES:  'atq_rbac_roles',
  EDITORS:     'atq_editors',
  PW:          'atq_user_passwords',
  SITE_BTN:    'atq_site_buttons',
  TICKER_SPD:  'atq_ticker_speed',
  TICKER_VIS:  'atq_ticker_visible',
  SITE_TITLE:  'atq_site_title',
  SUB_TEXT:    'atq_subscribe_text',
  WIDE_PIN:    'atq_wide_pinned',
  THEME:       'atq_theme',
  ADMIN_THEME: 'atq_admin_theme',
  VERSION:     'atq_version',
};
