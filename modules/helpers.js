// ================================================================
// modules/helpers.js — Pure utility functions (no DOM, no Firebase)
// Shared across all page-level JS modules.
// ================================================================

/**
 * Strip HTML tags from a string, returning plain text.
 * Used on card excerpts so rich formatting doesn't leak as literal tags.
 * @param {string} html
 * @returns {string}
 */
export function stripTags(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html);
  return (tmp.textContent || tmp.innerText || '').trim();
}

/**
 * Convert Western (ASCII) digits 0-9 to Arabic-Indic ٠-٩.
 * @param {string|number} n
 * @returns {string}
 */
export function toArabicDigits(n) {
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

/**
 * Convert Arabic-Indic digits ٠-٩ to Western (ASCII) digits 0-9.
 * @param {string|number} s
 * @returns {string}
 */
export function toWesternDigits(s) {
  return String(s || '0').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/**
 * Format a number using Arabic compact notation (k → ألف, M → م).
 * Returns Arabic-Indic digits.
 * @param {number} n
 * @returns {string}
 */
export function formatCount(n) {
  if (n >= 1_000_000) return toArabicDigits((n / 1_000_000).toFixed(1).replace('.0', '')) + 'م';
  if (n >= 1_000)     return toArabicDigits((n / 1_000).toFixed(1).replace('.0', '')) + 'ألف';
  return toArabicDigits(n);
}

/**
 * Parse an Arabic-Indic or Western digit string to an integer.
 * @param {string|number} s
 * @returns {number}
 */
export function parseCount(s) {
  return parseInt(toWesternDigits(s).replace(/[^\d]/g, '')) || 0;
}

/**
 * Estimate reading time in Arabic.
 * @param {string} text — raw text or HTML
 * @returns {string}  e.g. "٤ دقائق قراءة"
 */
export function calcReadTime(text) {
  const words = (text || '').replace(/<[^>]+>/g, '').split(/\s+/).length;
  const mins  = Math.max(1, Math.ceil(words / 200));
  return toArabicDigits(mins) + ' دقائق قراءة';
}

/**
 * Debounce: returns a function that delays execution until after `delay` ms
 * have elapsed since the last call.
 * @param {Function} fn
 * @param {number} delay  ms
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

/**
 * Show a brief toast notification.
 * Safe to call from any module — creates/removes its own DOM node.
 * @param {string} msg
 * @param {number} [duration=2500]
 */
export function showToast(msg, duration = 2500) {
  // Delegate to window._showToast if overridden (admin uses its own toast)
  if (typeof window._showToast === 'function') { window._showToast(msg); return; }
  const t = document.createElement('div');
  t.style.cssText = [
    'position:fixed', 'bottom:28px', 'right:28px',
    'background:var(--dark-3,#1C1C22)', 'border:1px solid var(--border,rgba(201,168,76,.15))',
    'color:var(--text,#F0EDE6)', 'padding:10px 20px', 'border-radius:10px',
    'font-size:13px', 'z-index:9999', 'direction:rtl', 'font-family:inherit',
    'box-shadow:0 4px 20px rgba(0,0,0,.4)',
  ].join(';');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

/**
 * Safely read a value from localStorage (returns null on error / not set).
 * @param {string} key
 * @returns {string|null}
 */
export function lsGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}

/**
 * Safely write a value to localStorage (silent on quota / private-mode errors).
 * @param {string} key
 * @param {string} value
 */
export function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch (_) { /* silent */ }
}

/**
 * Safely remove a key from localStorage.
 * @param {string} key
 */
export function lsRemove(key) {
  try { localStorage.removeItem(key); } catch (_) { /* silent */ }
}

/**
 * Safely JSON.parse; returns fallback on error.
 * @param {string|null} str
 * @param {*} fallback
 * @returns {*}
 */
export function jsonParse(str, fallback = null) {
  try { return str ? JSON.parse(str) : fallback; } catch (_) { return fallback; }
}
