// ================================================================
// assets/js/site-breaking.js — Breaking news bar logic
// Reads from _fb.site (settings) and _fb.breaking (items).
// Renders each active breaking item as a separate row with countdown.
// ================================================================

import { _fb } from '/assets/js/site-state.js';

let _breakTimer = null;

/**
 * Check the breaking news settings and show/hide the bar accordingly.
 * Should be called whenever _fb.site or _fb.breaking changes (via renderSite or onSnapshot).
 */
export function checkBreaking() {
  const _bs  = _fb.site || {};
  const isOn  = _bs.breaking_active === true || _bs.breaking_active === '1';
  const start = parseInt(_bs.breaking_start  || '0');
  const dur   = parseInt(_bs.breaking_duration || '300');
  const bar   = document.getElementById('breaking-bar');
  if (!bar) return;

  if (!isOn || !start) {
    bar.classList.remove('visible');
    clearTimeout(_breakTimer);
    return;
  }

  const elapsed = Math.floor((Date.now() - start) / 1000);
  if (elapsed >= dur) {
    bar.classList.remove('visible');
    return;
  }

  // Combine explicit breaking items + news flagged as alsoBreaking/عاجل
  const active = (_fb.breaking || []).filter(b => b.active === true);
  // Fix 1: priority='عاجل' is a homepage/card badge — it does NOT auto-inject into
  // شريط الأخبار العاجلة. That strip is managed independently via the Breaking News panel.
  // Only alsoBreaking flag (set explicitly by editor) adds to the bar.
  const alsoBreakingItems = (_fb.news || [])
    .filter(n => n.status === 'منشور' && n.alsoBreaking === true)
    .map(n => ({ active: true, text: n.title }));
  const allActive = [...active, ...alsoBreakingItems];

  if (!allActive.length) {
    bar.classList.remove('visible');
    return;
  }

  const breakingContainer = document.getElementById('breaking-text');
  if (breakingContainer) {
    breakingContainer.innerHTML = allActive.map(b => `
      <div class="breaking-row">
        <div class="breaking-label" style="flex-shrink:0">
          <div class="breaking-pulse"></div>
          عاجل
        </div>
        <div style="flex:1;color:white;font-size:14px;font-weight:700;padding:0 16px;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.text}</div>
      </div>`).join('');
  }

  bar.classList.add('visible');

  clearTimeout(_breakTimer);
  _breakTimer = setTimeout(() => {
    bar.classList.remove('visible');
    try { localStorage.setItem('atq_breaking_active', '0'); } catch (_) { /* silent */ }
  }, (dur - elapsed) * 1000);
}

/**
 * Manually close the breaking bar (user clicks ✕).
 * Records the dismissal in localStorage so it doesn't reappear this session.
 */
export function closeBreaking() {
  const bar = document.getElementById('breaking-bar');
  if (bar) bar.classList.remove('visible');
  clearTimeout(_breakTimer);
  try {
    localStorage.setItem('atq_breaking_active', '0');
    localStorage.removeItem('atq_breaking_start');
  } catch (_) { /* silent */ }
}
