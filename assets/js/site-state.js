// ================================================================
// assets/js/site-state.js — Shared in-memory Firebase data cache
// All modules import _fb and getNewsData from here.
// main.js mutates _fb.* when onSnapshot fires; exports are live references.
// ================================================================

import { VERSION, STORE } from '/config.js';
import {
  getViewCounts, saveViewCounts,
  getCachedNews, getCachedLatest, getCachedSite, getCachedBreaking,
} from '/modules/storage.js';
import { parseCount, toArabicDigits, formatCount, lsRemove } from '/modules/helpers.js';

// ── In-memory Firebase data cache ────────────────────────────────
export const _fb = {
  news:     null,
  latest:   null,
  breaking: null,
  site:     null,
  cats:     null,
};

// ── Global article store — safe click handling without JSON in HTML ──
window._store = window._store || {};

/**
 * Register an article in the global store and return it.
 */
export function _reg(n) {
  window._store[n.id] = n;
  return n;
}

export const STATIC_NEWS = [];

// ── Status normalization ──────────────────────────────────────────
// Statuses that the public site treats as "published" / visible.
// 'مجدول - تم النشر' is set by the admin scheduler after auto-publish.
// 'مجدول' past its scheduledAt time is also treated as published here,
// covering the case where admin.html was closed when the time arrived.
const _PUBLISHED_STATUSES = new Set(['منشور', 'مجدول - تم النشر']);

/**
 * Normalize a raw news array from Firebase for public-site rendering.
 * Returns a NEW array (no mutation of _fb.news) with:
 *  - 'مجدول - تم النشر'  → treated as منشور
 *  - 'مجدول' past time   → treated as منشور (client-side fallback)
 *  - everything else      → status unchanged
 */
function _normalizeStatuses(rawList) {
  if (!Array.isArray(rawList)) return [];
  const now = Date.now();
  return rawList.map(n => {
    if (!n) return n;

    // Already normalized this tick — return as-is
    if (_PUBLISHED_STATUSES.has(n.status)) return n;

    // 'مجدول - تم النشر': admin scheduler already ran — just map to منشور for public display
    if (n.status === 'مجدول - تم النشر') {
      return { ...n, status: 'منشور' };
    }

    // 'مجدول' with a past scheduledAt: admin tab wasn't open — publish client-side
    if (n.status === 'مجدول' && n.scheduledAt) {
      const t = new Date(n.scheduledAt).getTime();
      if (!isNaN(t) && t <= now) {
        return { ...n, status: 'منشور' };
      }
    }

    return n;
  });
}

/**
 * Get current published+view-merged news array for the public site.
 * Handles status normalization so every caller automatically sees
 * scheduled articles that have reached their publish time.
 * @returns {Object[]}
 */
export function getNewsData() {
  const raw = (_fb.news && _fb.news.length > 0) ? _fb.news : [];
  const normalized = _normalizeStatuses(raw);
  return _mergeLocalViewCounts(normalized);
}

/**
 * Overlay locally-accumulated view counts on top of Firebase data.
 */
export function _mergeLocalViewCounts(newsList) {
  if (!Array.isArray(newsList)) return newsList;
  const counts = getViewCounts();
  newsList.forEach(n => {
    if (!n || !n.id) return;
    const local = counts[String(n.id)];
    if (!local) return;
    const cur = parseCount(n.views);
    if (local > cur) n.views = toArabicDigits(formatCount(local));
  });
  return newsList;
}

// ── Version-based cache busting ─────────────────────────────────
(function _bustUserCacheIfNeeded() {
  try {
    const prev = localStorage.getItem(STORE.VERSION);
    if (prev !== VERSION) {
      [
        'atq_view_counts', 'atq_viewed_articles',
        'atq_breaking_active', 'atq_breaking_start',
        'atq_cache_news', 'atq_cache_latest',
        'atq_cache_breaking', 'atq_cache_site',
      ].forEach(k => lsRemove(k));
      localStorage.setItem(STORE.VERSION, VERSION);
      console.info('[Site] Cache busted → v' + VERSION);
    }
  } catch (_) { /* silent */ }
})();

// ── Warm cache from localStorage on page load ────────────────────
(function _warmCacheFromStorage() {
  try {
    const cn = getCachedNews();
    const cl = getCachedLatest();
    const cs = getCachedSite();
    const cb = getCachedBreaking();
    if (cn && Array.isArray(cn) && cn.length)  _fb.news     = cn;
    if (cl && Array.isArray(cl))               _fb.latest   = cl;
    if (cs && typeof cs === 'object')           _fb.site     = cs;
    if (cb && Array.isArray(cb))               _fb.breaking = cb;
  } catch (_) { /* silent */ }
})();
