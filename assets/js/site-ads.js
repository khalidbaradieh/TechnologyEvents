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
 * These are separate from the 5 built-in slots.
 * @param {Object[]} banners
 */
export function _applyCustomBanners(banners) {
  if (!Array.isArray(banners)) return;
  // Clean up previous custom banners
  document.querySelectorAll('.custom-ad-injected').forEach(el => el.remove());

  banners.filter(b => b && b.active).forEach(b => {
    const anchorFn = _CUSTOM_BANNER_ANCHORS[b.location];
    const anchor   = anchorFn ? anchorFn() : null;
    if (!anchor) return;

    const wrap = document.createElement('div');
    wrap.className = 'ad-banner active custom-ad-injected';
    wrap.style.cssText = 'max-width:1280px;margin:0 auto;padding:0 2rem 16px';

    const inner = document.createElement('div');
    inner.className = 'ad-banner-inner';
    if (b.height && b.height !== 'auto') inner.style.minHeight = b.height;

    if (b.videoUrl) {
      inner.innerHTML = `<video src="${b.videoUrl}" autoplay muted loop playsinline
        style="width:100%;max-height:250px;object-fit:cover;border-radius:inherit"></video>`;
    } else if (b.imageUrl) {
      inner.innerHTML = `<img src="${b.imageUrl}" alt=""
        style="width:100%;max-height:250px;object-fit:cover">`;
    } else if (b.html) {
      inner.innerHTML = b.html;
    } else if (b.text) {
      inner.innerHTML = `<div class="ad-banner-text">${b.text}</div>`;
    }

    if (b.linkUrl) {
      inner.style.cursor = 'pointer';
      inner.onclick = () => window.open(b.linkUrl, '_blank', 'noopener');
    }

    wrap.appendChild(inner);
    if (b.position === 'before') {
      anchor.parentNode.insertBefore(wrap, anchor);
    } else {
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    }
  });
}
