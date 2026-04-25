// ================================================================
// assets/js/site-ads.js — Ad banner management
// Handles the 5 built-in ad slots (top, bottom, grid, article, allnews)
// and admin-defined custom banners with arbitrary page placement.
// ================================================================

// ── Slot → DOM anchor lookup ──────────────────────────────────────
// Keys match exactly the slot values saved by admin's _CUSTOM_BANNER_LOCATIONS
const _CUSTOM_BANNER_ANCHORS = {
  'top':            () => document.getElementById('ad-top'),
  'bottom':         () => document.getElementById('ad-bottom'),
  'grid':           () => document.getElementById('ad-grid'),
  'article':        () => document.getElementById('ad-article'),
  'allnews':        () => document.getElementById('ad-allnews'),
  'after-hero':     () => document.getElementById('site-hero'),
  'after-featured': () => document.getElementById('wide-card-el') || document.querySelector('.wide-card'),
  'footer-top':     () => document.querySelector('footer'),  // admin label value
  'before-footer':  () => document.querySelector('footer'),  // alias
};

/**
 * Apply a built-in ad banner to one of the 5 named slots.
 * Hides the slot element when data is empty or inactive.
 */
export function _applyAdBanner(slot, data) {
  const wrap  = document.getElementById('ad-' + slot);
  const inner = document.getElementById('ad-' + slot + '-inner');
  if (!wrap || !inner) return;

  if (!data || !data.active) {
    wrap.style.display = 'none';
    wrap.classList.remove('active');
    return;
  }

  wrap.style.display = 'block';
  wrap.classList.add('active');

  if (data.width) {
    wrap.style.maxWidth = (/%$/.test(String(data.width))) ? data.width : data.width + 'px';
  }
  if (data.height && data.height !== 'auto') {
    wrap.style.minHeight = String(data.height).endsWith('px') ? data.height : data.height + 'px';
  }
  if (data.marginTop    != null && !isNaN(data.marginTop))    { wrap.style.marginTop    = data.marginTop + 'px'; }
  if (data.marginBottom != null && !isNaN(data.marginBottom)) { wrap.style.marginBottom = data.marginBottom + 'px'; }

  inner.innerHTML = '';
  if (data.videoUrl) {
    inner.innerHTML = `<video src="${data.videoUrl}" autoplay muted loop playsinline
      style="width:100%;max-height:250px;object-fit:cover;border-radius:inherit"></video>`;
  } else if (data.imageUrl) {
    inner.innerHTML = `<img src="${data.imageUrl}" alt=""
      style="width:100%;max-height:250px;object-fit:cover">`;
  } else if (data.html) {
    inner.innerHTML = data.html;
  } else if (data.text) {
    inner.innerHTML = `<div class="ad-banner-text"
      style="padding:16px;text-align:center;font-size:14px;color:var(--text)">${data.text}</div>`;
  }

  if (data.linkUrl) {
    inner.style.cursor = 'pointer';
    inner.onclick = () => window.open(data.linkUrl, '_blank', 'noopener');
  } else {
    inner.style.cursor = '';
    inner.onclick = null;
  }
}

/**
 * Apply custom admin-defined banners (بانرات مخصصة إضافية).
 *
 * ROOT CAUSE FIX: .ad-banner has display:none in CSS by default.
 * Custom banner wrappers use inline display:block so CSS default doesn't hide them.
 * Missing slot keys (after-featured, footer-top) added to anchors map.
 */
export function _applyCustomBanners(banners) {
  if (!Array.isArray(banners)) return;

  // Remove all previous custom wrappers so we re-render from scratch on every call
  document.querySelectorAll('.custom-banner-wrap').forEach(el => el.remove());

  // Group active banners by slot
  const bySlot = {};
  banners
    .filter(b => b && b.active !== false)
    .forEach(b => {
      const s = b.slot || b.location || 'top';
      if (!bySlot[s]) bySlot[s] = [];
      bySlot[s].push(b);
    });

  Object.entries(bySlot).forEach(([slot, slotBanners]) => {
    const anchorFn = _CUSTOM_BANNER_ANCHORS[slot];
    if (!anchorFn) {
      console.warn('[Ads] Unknown custom banner slot:', slot);
      return;
    }
    const anchor = anchorFn();
    if (!anchor) {
      console.warn('[Ads] Anchor element not found for slot:', slot);
      return;
    }

    // One wrapper per slot — holds all banners for that slot
    const wrap = document.createElement('div');
    wrap.className = 'custom-banner-wrap';

    // KEY FIX: use inline display:block — do NOT use .ad-banner class
    // because .ad-banner { display:none } in CSS and only shows with .active class
    const stackMode = slotBanners[0]?.stackMode || 'below';
    wrap.style.cssText = [
      'max-width:1280px',
      'margin:16px auto',
      'padding:0 2rem',
      stackMode === 'beside'
        ? 'display:flex;flex-wrap:wrap;gap:12px'
        : 'display:block',
    ].join(';');

    // Build and append each banner element
    slotBanners.forEach(b => {
      const el = document.createElement('div');
      el.className = 'ad-banner-inner';
      el.style.cssText = [
        'border-radius:14px',
        'overflow:hidden',
        'border:1px solid var(--border-dim)',
        'background:var(--dark-3)',
        'min-height:80px',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'position:relative',
        'flex:1 1 auto',
        'margin-bottom:8px',
      ].join(';');

      if (b.width)  el.style.maxWidth  = /%$/.test(String(b.width))  ? b.width  : b.width  + 'px';
      if (b.height && !isNaN(Number(b.height))) el.style.minHeight = b.height + 'px';

      if (b.videoUrl) {
        el.innerHTML = `<video src="${b.videoUrl}" autoplay muted loop playsinline
          style="width:100%;max-height:250px;object-fit:cover"></video>`;
      } else if (b.imageUrl) {
        el.innerHTML = `<img src="${b.imageUrl}" alt=""
          style="width:100%;max-height:250px;object-fit:cover">`;
      } else if (b.html) {
        el.innerHTML = b.html;
      } else if (b.text) {
        el.innerHTML = `<div style="padding:16px;text-align:center;font-size:14px;color:var(--text)">${b.text}</div>`;
      } else {
        // Banner active but no content yet — show placeholder so admin knows it's working
        el.innerHTML = `<div style="padding:16px;text-align:center;font-size:12px;color:var(--text-dim)">
          إعلان نشط — أضف صورة أو نصاً من لوحة التحكم</div>`;
      }

      if (b.linkUrl) {
        el.style.cursor = 'pointer';
        el.onclick = () => window.open(b.linkUrl, '_blank', 'noopener');
      }

      wrap.appendChild(el);
    });

    // Insert the wrapper in the correct position relative to anchor
    if (anchor.tagName === 'FOOTER') {
      // footer-top / before-footer: insert immediately before the footer
      anchor.parentNode.insertBefore(wrap, anchor);
    } else {
      // All other slots: insert immediately after the anchor element
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    }
  });
}
