// ================================================================
// assets/js/site-ticker.js — Ticker RAF animation
// Constant-speed seamless scroll independent of content width.
// Called by news-render.js when Firebase data or settings change.
// ================================================================

import { _reg } from '/assets/js/site-state.js';

// ── Module state ─────────────────────────────────────────────────
let _tickerRaf         = null;
let _tickerPos         = 0;
let _tickerPxSec       = 60;   // default: 60 px/second (comfortable reading)
let _tickerLastContent = '';   // track content to avoid needless RAF restarts

/**
 * Start (or restart) the ticker RAF loop.
 * Safe to call multiple times — cancels any existing loop first.
 * @internal
 */
export function _startTickerRAF() {
  if (_tickerRaf) { cancelAnimationFrame(_tickerRaf); _tickerRaf = null; }
  const inner = document.querySelector('.ticker-inner');
  if (!inner) return;

  // Attach hover/touch pause handlers once (idempotent via _pauseBound flag)
  const track = inner.closest('.ticker-track') || inner.parentElement;
  if (track && !track._pauseBound) {
    track._pauseBound = true;
    track.addEventListener('mouseenter', () => { window._tickerPaused = true;  });
    track.addEventListener('mouseleave', () => { window._tickerPaused = false; });
    track.addEventListener('touchstart', () => { window._tickerPaused = true;  }, { passive: true });
    track.addEventListener('touchend',   () => { window._tickerPaused = false; });
  }

  // Double-rAF ensures layout is fully computed before measuring scrollWidth
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const halfW = inner.scrollWidth / 2;
    if (halfW <= 0) return;
    const pxPerFrame = _tickerPxSec / 60; // constant speed regardless of content length
    function step() {
      if (!window._tickerPaused) {
        _tickerPos += pxPerFrame;
        if (_tickerPos >= halfW) _tickerPos -= halfW; // seamless wrap
        inner.style.transform = 'translateX(' + _tickerPos + 'px)';
      }
      _tickerRaf = requestAnimationFrame(step);
    }
    _tickerRaf = requestAnimationFrame(step);
  }));
}

/**
 * Apply a new speed (from admin panel or Firebase site settings).
 * Restarts the RAF loop at the new speed.
 * @param {number|string} secs — admin slider value (10–200). Lower = faster.
 */
export function applyTickerSpeed(secs) {
  const s = parseInt(secs);
  if (!s || s <= 0) return;
  // Map: secs=60→33 px/s, secs=200→10 px/s, secs=10→200 px/s
  _tickerPxSec = Math.round(2000 / s);
  if (_tickerRaf) { cancelAnimationFrame(_tickerRaf); _tickerRaf = null; }
  _startTickerRAF();
}

/**
 * Rebuild the ticker inner HTML and (re)start the RAF loop — only if content changed.
 * This is the primary API called by news-render.js on every renderSite().
 *
 * @param {{ text: string, status: string }[]} activeTicker  — filtered latest items with status='نشط'
 * @param {Record<string, number>}             pubIndex      — title → article id, for clickable items
 * @param {(id: number) => void}               openById      — callback to open an article by id
 */
export function updateTicker(activeTicker, pubIndex, openById) {
  if (!activeTicker || !activeTicker.length) return;

  const newContent = activeTicker.map(l => l.text).join('|');
  if (newContent === _tickerLastContent) return; // no change — skip rebuild
  _tickerLastContent = newContent;

  const tickerInner = document.querySelector('.ticker-inner');
  if (!tickerInner) return;

  // Build spans: make items clickable when they match a published article title
  const spanHtml = l => {
    const txt     = (l.text || '').trim();
    const matchId = pubIndex[txt];
    if (matchId) {
      return `<span class="ticker-item-clickable" data-id="${matchId}" style="cursor:pointer">${l.text}</span>`;
    }
    return `<span>${l.text}</span>`;
  };

  // Duplicate content for seamless loop (left half + right half are identical)
  tickerInner.innerHTML = [...activeTicker, ...activeTicker].map(spanHtml).join('');

  // Delegate click events (works even while items move via transform)
  tickerInner.onclick = function (e) {
    const t = e.target.closest('.ticker-item-clickable');
    if (t && t.dataset.id) openById(Number(t.dataset.id));
  };

  _tickerPos = 0; // reset position only when content changes
  _startTickerRAF();
}
