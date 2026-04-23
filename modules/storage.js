// ================================================================
// modules/storage.js — Typed localStorage wrappers
// Uses keys from config.js STORE map so key names are never duplicated.
// ================================================================

import { STORE }   from '/config.js';
import { jsonParse, lsGet, lsSet, lsRemove } from '/modules/helpers.js';

// ── Bookmarks ────────────────────────────────────────────────────
/** @returns {{ id:number|string, title:string, cat:string, date:string, thumbnail:string }[]} */
export function getBookmarks()          { return jsonParse(lsGet('atq_bookmarks'), []); }
export function saveBookmarks(list)     { lsSet('atq_bookmarks', JSON.stringify(list)); }

// ── View counts (client-side, per-article) ────────────────────
/** @returns {Record<string, number>} */
export function getViewCounts()         { return jsonParse(lsGet('atq_view_counts'), {}); }
export function saveViewCounts(counts)  { lsSet('atq_view_counts', JSON.stringify(counts)); }

// ── Like counts (client-side, per-article) ────────────────────
/** @returns {Record<string, number>} */
export function getLikeCounts()         { return jsonParse(lsGet('atq_likes'), {}); }
export function saveLikeCounts(m)       { lsSet('atq_likes', JSON.stringify(m)); }

/** @returns {Record<string, true>} */
export function getLikedByMe()          { return jsonParse(lsGet('atq_liked_by_me'), {}); }
export function saveLikedByMe(m)        { lsSet('atq_liked_by_me', JSON.stringify(m)); }

// ── RBAC session ─────────────────────────────────────────────
export function getRbacSession()        { return jsonParse(lsGet(STORE.RBAC_USER), null); }
export function saveRbacSession(obj)    { lsSet(STORE.RBAC_USER, JSON.stringify(obj)); }
export function clearRbacSession()      { lsRemove(STORE.RBAC_USER); }

// ── User preferences ─────────────────────────────────────────
export function getTheme()              { return lsGet(STORE.THEME); }
export function setTheme(val)           { lsSet(STORE.THEME, val); }
export function getLang()               { return lsGet('atq_lang'); }
export function setLang(val)            { lsSet('atq_lang', val); }

// ── Content caches (filled by Firebase onSnapshot, cleared on version bump) ──
export function getCachedNews()         { return jsonParse(lsGet('atq_cache_news'), null); }
export function getCachedLatest()       { return jsonParse(lsGet('atq_cache_latest'), null); }
export function getCachedSite()         { return jsonParse(lsGet('atq_cache_site'), null); }
export function getCachedBreaking()     { return jsonParse(lsGet('atq_cache_breaking'), null); }
export function setCachedNews(data)     { lsSet('atq_cache_news', JSON.stringify(data)); }
export function setCachedLatest(data)   { lsSet('atq_cache_latest', JSON.stringify(data)); }
export function setCachedSite(data)     { lsSet('atq_cache_site', JSON.stringify(data)); }
export function setCachedBreaking(data) { lsSet('atq_cache_breaking', JSON.stringify(data)); }
