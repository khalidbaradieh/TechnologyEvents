// ================================================================
// assets/js/site-sections.js — Public site custom sections renderer
// Reads custom_sections from Firebase and inserts section blocks
// into the page at the correct location (after-hero, after-trending, etc.)
// Called from main.js when settings.custom_sections changes.
// ================================================================

import { _fb, _reg, getNewsData } from '/assets/js/site-state.js';
import { catMeta }                 from '/assets/js/site-cats.js';

// ── Location anchor map (mirrors admin-sections.js locations) ────
const _SECTION_ANCHORS = {
  'after-hero':     () => document.getElementById('site-hero'),
  'after-trending': () => document.getElementById('trending-section'),
  'after-grid':     () => document.querySelector('.grid-section'),
  'before-footer':  () => document.querySelector('footer'),
  'sidebar':        () => document.querySelector('.sidebar-stack'),
};

// Track injected wrappers so we can clean up on re-render
const _injectedWrappers = new Map(); // sectionId → DOM element

/**
 * Render all active custom sections on the public site.
 * Called from main.js whenever _fb.site.custom_sections changes.
 * @param {Object[]} sections
 */
export function renderCustomSections(sections) {
  if (!Array.isArray(sections)) return;

  // Remove previous wrappers that are no longer in the list
  const currentIds = new Set(sections.map(s => s.id));
  _injectedWrappers.forEach((wrap, id) => {
    if (!currentIds.has(id)) { wrap.remove(); _injectedWrappers.delete(id); }
  });

  const allNews = getNewsData();
  const pub     = allNews.filter(n => n.status === 'منشور');

  sections.filter(s => s.active).forEach(s => {
    _renderOneSection(s, pub);
  });

  // Hide (don't remove) wrappers for inactive sections
  sections.filter(s => !s.active).forEach(s => {
    const wrap = _injectedWrappers.get(s.id);
    if (wrap) wrap.style.display = 'none';
  });
}

/**
 * Render / refresh one section block.
 * @param {Object} s — section definition
 * @param {Object[]} pub — all published news
 */
function _renderOneSection(s, pub) {
  // Filter news belonging to this section
  const flag = s.newsFlag || ('section_' + s.id);
  let items  = pub.filter(n => n[flag] === true);

  // Sort
  if (s.sort === 'views') {
    items.sort((a, b) => {
      const av = parseInt((a.views || '0').replace(/[^0-9]/g, '')) || 0;
      const bv = parseInt((b.views || '0').replace(/[^0-9]/g, '')) || 0;
      return bv - av;
    });
  } else if (s.sort !== 'manual') {
    // newest first
    items.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  }

  const maxItems = Math.max(1, Math.min(20, Number(s.maxItems) || 8));
  items = items.slice(0, maxItems);

  if (!items.length) {
    // Hide section if no articles assigned to it
    const existing = _injectedWrappers.get(s.id);
    if (existing) existing.style.display = 'none';
    return;
  }

  // Build or reuse wrapper
  let wrap = _injectedWrappers.get(s.id);
  if (!wrap) {
    wrap = document.createElement('section');
    wrap.className     = 'custom-news-section';
    wrap.dataset.sectionId = s.id;
    _injectedWrappers.set(s.id, wrap);

    // Insert at correct location
    const anchorFn = _SECTION_ANCHORS[s.location] || _SECTION_ANCHORS['after-grid'];
    const anchor   = anchorFn ? anchorFn() : null;
    if (!anchor) {
      document.body.appendChild(wrap);
    } else if (s.location === 'before-footer') {
      anchor.parentNode.insertBefore(wrap, anchor);
    } else if (s.location === 'sidebar') {
      anchor.appendChild(wrap);
    } else {
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    }
  }

  wrap.style.display   = '';
  wrap.style.cssText  += ';max-width:1280px;margin:0 auto;padding:0 2rem 24px;';

  // Build inner HTML
  wrap.innerHTML = _buildSectionHTML(s, items);

  // Ensure openById is available for onclick handlers
  wrap.querySelectorAll('[data-id]').forEach(el => {
    el.onclick = () => {
      const id = Number(el.dataset.id);
      if (typeof window.openById === 'function') window.openById(id);
    };
  });
}

/**
 * Build the section HTML based on its layout type.
 */
function _buildSectionHTML(s, items) {
  const color = s.color || '#C9A84C';
  const header = s.showTitle !== false ? `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="display:block;width:4px;height:22px;background:${color};border-radius:2px"></span>
        <span style="font-size:18px">${s.icon || '📋'}</span>
        <h2 style="font-size:18px;font-weight:800;color:var(--text);margin:0">${s.name}</h2>
      </div>
      ${s.description ? `<span style="font-size:12px;color:var(--text-dim)">${s.description}</span>` : ''}
    </div>` : '';

  let body = '';

  if (s.layout === 'scroll') {
    // Horizontal scroll strip (same as trending)
    body = `
      <div style="display:flex;gap:14px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none;-webkit-overflow-scrolling:touch">
        ${items.map(n => { _reg(n); const m = catMeta(n.cat);
          const bg = n.thumbnail
            ? `<img class="trending-card-bg" src="${n.thumbnail}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`
            : `<div class="trending-card-bg" style="background:${m.bg};display:flex;align-items:center;justify-content:center;font-size:60px">${m.icon}</div>`;
          return `<div class="trending-card" data-id="${n.id}" style="cursor:pointer;flex-shrink:0">
            ${bg}
            <div class="trending-card-overlay">
              <div class="trending-card-cat" style="color:${color}">${n.cat}</div>
              <div class="trending-card-title">${n.title}</div>
            </div>
          </div>`;
        }).join('')}
      </div>`;

  } else if (s.layout === 'grid') {
    body = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px">
      ${items.map(n => { _reg(n); const m = catMeta(n.cat);
        const thumb = n.thumbnail
          ? `<img src="${n.thumbnail}" style="width:100%;height:100%;object-fit:cover" alt="">`
          : m.icon;
        return `<div class="news-card" data-id="${n.id}" style="cursor:pointer">
          <div class="card-img"><div class="card-img-inner" style="background:${m.bg}">${thumb}</div></div>
          <div class="card-body">
            <div class="card-tags"><span class="tag" style="background:${color}22;color:${color};border:1px solid ${color}44">${n.cat}</span></div>
            <div class="card-title">${n.title}</div>
            <div class="card-footer">
              <span class="card-time">${n.date || ''}</span>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  } else if (s.layout === 'list') {
    body = `<div style="display:flex;flex-direction:column;gap:12px">
      ${items.map((n, i) => { _reg(n); const m = catMeta(n.cat);
        return `<div data-id="${n.id}" style="cursor:pointer;display:flex;gap:14px;align-items:center;padding:12px;background:var(--dark-3);border-radius:12px;border:1px solid var(--border-dim);transition:.15s">
          <div style="font-size:20px;font-weight:800;color:${color};opacity:.4;min-width:28px">${i + 1}</div>
          ${n.thumbnail
            ? `<img src="${n.thumbnail}" alt="" style="width:64px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0">`
            : `<div style="width:64px;height:56px;border-radius:8px;background:${m.bg};display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">${m.icon}</div>`}
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;color:var(--text);line-height:1.4;margin-bottom:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${n.title}</div>
            <div style="font-size:11px;color:var(--text-dim)">${n.cat} · ${n.date || ''}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  } else if (s.layout === 'featured') {
    const hero = items[0];
    const rest = items.slice(1, 4);
    _reg(hero);
    const m = catMeta(hero.cat);
    body = `<div style="display:grid;grid-template-columns:1fr 280px;gap:16px">
      <div data-id="${hero.id}" style="cursor:pointer;border-radius:16px;overflow:hidden;position:relative;min-height:280px;background:${m.bg}">
        ${hero.thumbnail ? `<img src="${hero.thumbnail}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : ''}
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.8),transparent)"></div>
        <div style="position:absolute;bottom:0;left:0;right:0;padding:20px">
          <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${color}22;color:${color};border:1px solid ${color}44;margin-bottom:8px;display:inline-block">${hero.cat}</span>
          <div style="font-size:17px;font-weight:800;color:white;line-height:1.4">${hero.title}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${rest.map(n => { _reg(n); const nm = catMeta(n.cat);
          return `<div data-id="${n.id}" style="cursor:pointer;display:flex;gap:10px;align-items:center;padding:10px;background:var(--dark-3);border-radius:10px">
            ${n.thumbnail
              ? `<img src="${n.thumbnail}" alt="" style="width:52px;height:44px;object-fit:cover;border-radius:6px;flex-shrink:0">`
              : `<div style="width:52px;height:44px;border-radius:6px;background:${nm.bg};display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${nm.icon}</div>`}
            <div style="flex:1;font-size:12px;font-weight:600;color:var(--text);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${n.title}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  return `<div style="padding:24px 0 8px">${header}${body}</div>`;
}

/**
 * Remove all injected section wrappers (called on full page re-init).
 */
export function clearAllCustomSections() {
  _injectedWrappers.forEach(wrap => wrap.remove());
  _injectedWrappers.clear();
}
