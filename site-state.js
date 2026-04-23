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
// Exported as a mutable object so all modules share the same reference.
// main.js writes to _fb.*; other modules read from it.
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
 * @param {{ id: number|string, [key: string]: any }} n
 * @returns {typeof n}
 */
export function _reg(n) {
  window._store[n.id] = n;
  return n;
}

// Static fallback: empty — all content comes from Firebase onSnapshot.
// Array kept only for backward-compat with deep-link hash code.
export const STATIC_NEWS = [];

/**
 * Get current published+view-merged news array.
 * Returns [] until Firebase fires the first onSnapshot.
 * @returns {Object[]}
 */
export function getNewsData() {
  const data = (_fb.news && _fb.news.length > 0) ? _fb.news : [];
  return _mergeLocalViewCounts(data);
}

/**
 * Overlay locally-accumulated view counts on top of Firebase data.
 * This lets the trending section reflect real readership without Firebase writes
 * from the public site.
 * @param {Object[]} newsList
 * @returns {Object[]}
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
// On VERSION change wipe stale content caches (NOT user prefs / bookmarks).
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

// ── Read-through cache — warm _fb from localStorage on page load ──
// Lets renderSite() fire at 0ms on repeat visits before Firebase responds.
// Firebase then silently refreshes with fresh data (~300-800ms later).
(function _warmCacheFromStorage() {
  try {
    const cn = getCachedNews();
    const cl = getCachedLatest();
    const cs = getCachedSite();
    const cb = getCachedBreaking();
    if (cn && Array.isArray(cn) && cn.length)         _fb.news     = cn;
    if (cl && Array.isArray(cl))                       _fb.latest   = cl;
    if (cs && cs && typeof cs === 'object')            _fb.site     = cs;
    if (cb && Array.isArray(cb))                       _fb.breaking = cb;
  } catch (_) { /* silent */ }
})();
