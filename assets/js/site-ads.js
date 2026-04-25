// ================================================================
// assets/js/site-ads.js — Ad banner management
// Handles all five ad slots (top, bottom, grid, article, allnews)
// plus admin-defined custom banners with arbitrary placement.
// ================================================================

/** Slot names to anchor element / selector functions */
const _CUSTOM_BANNER_ANCHORS = {
  'top':     () => document.getElementById('ad-top'),
  'bottom':  () => document.getElementById('ad-bottom'),
  'grid':    () => document.getElementById('ad-grid'),
  'article': () => document.getElementById('ad-article'),
  'allnews': () => document.getElementById('ad-allnews'),
  'after-hero':     () => document.getElementById('site-hero'),
  'after-trending': () => document.getElementById('trending-section'),
  'after-cats':     () => document.querySelector('.cats-strip'),
  'before-footer':  () => document.querySelector('footer'),
};

/**
 * Apply an ad banner to a named slot.
 * Safely hides the slot when data is empty/inactive.
 *
 * @param {'top'|'bottom'|'grid'|'article'|'allnews'} slot
 * @param {{ active:boolean, imageUrl?:string, videoUrl?:string, html?:string, text?:string,
 *            linkUrl?:string, width?:string, height?:string,
 *            marginTop?:number, marginBottom?:number }|null|undefined} data
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

  wrap.style.display = '';
  wrap.classList.add('active');

  // Custom dimensions
  if (data.width) {
    wrap.style.maxWidth = (data.width === '100%' || data.width.endsWith('%'))
      ? data.width
      : data.width + 'px';
  }
  if (data.height && data.height !== 'auto') {
    wrap.style.minHeight = data.height.endsWith('px') ? data.height : data.height + 'px';
  }

  // Custom spacing
  if (data.marginTop != null && !isNaN(data.marginTop)) {
    wrap.style.marginTop  = data.marginTop + 'px';
    wrap.style.paddingTop = '0';
  } else {
    wrap.style.marginTop  = '';
    wrap.style.paddingTop = '';
  }
  if (data.marginBottom != null && !isNaN(data.marginBottom)) {
    wrap.style.marginBottom  = data.marginBottom + 'px';
    wrap.style.paddingBottom = '0';
  } else {
    wrap.style.marginBottom  = '';
    wrap.style.paddingBottom = '';
  }

  // Build inner content
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

  // Click-through
  if (data.linkUrl) {
    inner.style.cursor = 'pointer';
    inner.onclick = () => window.open(data.linkUrl, '_blank', 'noopener');
  } else {
    inner.style.cursor = '';
    inner.onclick = null;
  }
}

/**
 * Apply custom admin-defined banners to the page.
 * Fix 2: Uses b.slot (not b.location), correct active check, proper wrap management.
 * @param {Object[]} banners
 */
export function _applyCustomBanners(banners) {
  if (!Array.isArray(banners)) return;

  // Clear previous custom slot wraps cleanly
  document.querySelectorAll('.custom-banners-slot').forEach(w => {
    Array.from(w.querySelectorAll('.custom-banner')).forEach(c => c.remove());
  });

  // Group active banners by slot
  const bySlot = {};
  banners.filter(b => b && b.active !== false).forEach(b => {
    const s = b.slot || b.location || 'top'; // support both field names
    if (!bySlot[s]) bySlot[s] = [];
    bySlot[s].push(b);
  });

  Object.entries(bySlot).forEach(([slot, slotBanners]) => {
    const anchorFn = _CUSTOM_BANNER_ANCHORS[slot];
    if (!anchorFn) return;
    const anchor = anchorFn();
    if (!anchor) return;

    // Ensure wrapper div exists once per slot
    const wrapId = 'custom-banner-wrap-' + slot;
    let wrap = document.getElementById(wrapId);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = wrapId;
      wrap.className = 'ad-banner custom-banners-slot';
      wrap.style.cssText = 'max-width:1280px;margin:16px auto;padding:0 2rem';
      const mode = slotBanners[0]?.stackMode || 'below';
      if (mode === 'beside') {
        wrap.style.display = 'flex';
        wrap.style.flexWrap = 'wrap';
        wrap.style.gap = '12px';
      }
      // Insert after anchor (for ad-* elements), before footer
      if (anchor.tagName === 'FOOTER') {
        anchor.parentNode.insertBefore(wrap, anchor);
      } else {
        anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
      }
    }

    // Build and append each banner
    slotBanners.forEach(b => {
      const el = document.createElement('div');
      el.className = 'ad-banner-inner custom-banner';
      Object.assign(el.style, {
        borderRadius: '14px', overflow: 'hidden',
        border: '1px solid var(--border-dim)',
        background: 'var(--dark-3)', minHeight: '80px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', position: 'relative',
        flex: '1 1 auto', marginBottom: '8px',
      });
      if (b.width)  el.style.maxWidth  = /%$/.test(String(b.width)) ? b.width : b.width + 'px';
      if (b.height && !isNaN(b.height)) el.style.minHeight = b.height + 'px';

      if (b.videoUrl) {
        el.innerHTML = `<video src="${b.videoUrl}" autoplay muted loop playsinline style="width:100%;max-height:250px;object-fit:cover"></video>`;
      } else if (b.imageUrl) {
        el.innerHTML = `<img src="${b.imageUrl}" alt="" style="width:100%;max-height:250px;object-fit:cover">`;
      } else if (b.html) {
        el.innerHTML = b.html;
      } else if (b.text) {
        el.innerHTML = `<div style="padding:16px;text-align:center;font-size:14px;color:var(--text)">${b.text}</div>`;
      }
      if (b.linkUrl) {
        el.style.cursor = 'pointer';
        el.onclick = () => window.open(b.linkUrl, '_blank', 'noopener');
      }
      wrap.appendChild(el);
    });
  });
}
