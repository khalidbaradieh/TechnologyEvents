// ================================================================
// config.js  —  الإعدادات المركزية
// غيّر هذا الملف فقط إذا أردت تغيير قاعدة البيانات أو خدمة الاستضافة
// ================================================================

// ── إعدادات Firebase ─────────────────────────────────────────
export const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCk8Nz0oFiChOegbsmYNAQ8IjfFAXbnuPE",
  authDomain:        "techevents-9c954.firebaseapp.com",
  projectId:         "techevents-9c954",
  storageBucket:     "techevents-9c954.firebasestorage.app",
  messagingSenderId: "997467885128",
  appId:             "1:997467885128:web:7d8cbe10285bf1ecbdd27d",
  measurementId:     "G-VP1W0TTKZ4"
};

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
  S: {
    LATEST:   'latest',
    BREAKING: 'breaking',
    CATS:     'cats',
    SITE:     'site',
  }
};

// ── رقم الإصدار (زِد هذا الرقم عند كل نشر لمسح الكاش) ──────
export const VERSION = "2.0.0";
