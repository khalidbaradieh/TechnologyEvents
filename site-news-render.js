// ================================================================
// assets/js/site-news-render.js — News rendering & data display
// renderSite, renderTrending, _makeCard, show-more, all-news page,
// category filter, scroll-dots, stats bar, cats strip.
// ================================================================

import { _fb, _reg, getNewsData, STATIC_NEWS } from '/assets/js/site-state.js';
import { catMeta, catColors }                   from '/assets/js/site-cats.js';
import { stripTags }                            from '/modules/helpers.js';
import { updateTicker }                         from '/assets/js/site-ticker.js';
import { checkBreaking }                        from '/assets/js/site-breaking.js';

// show-more offset — resets to 6 whenever renderSite() runs
let _newsOffset = 6;

// ── SHARED CARD BUILDER ───────────────────────────────────────────
/**
 * Build a news-card HTML string.  Used by show-more, all-news, category filter,
 * and search results.  onclick calls window.openById which main.js exposes.
 * @param {{ id:*, cat:string, title:string, excerpt:string,
 *           author:string, date:string, views?:string,
 *           thumbnail?:string, priority?:string }} n
 * @returns {string}
 */
export function _makeCard(n) {
  _reg(n);
  const m     = catMeta(n.cat);
  const thumb = n.thumbnail
    ? '<img src="' + n.thumbnail + '" style="width:100%;height:100%;object-fit:cover" alt="">'
    : m.icon;
  return '<div class="news-card" onclick="openById(' + n.id + ')">' +
    '<div class="card-img"><div class="card-img-inner" style="background:' + m.bg + '">' + thumb + '</div></div>' +
    '<div class="card-body">' +
      '<div class="card-tags"><span class="tag ' + m.cls + '">' + n.cat + '</span>' +
        (n.priority === 'عاجل' ? '<span class="tag tag-red">عاجل</span>' : '') +
      '</div>' +
      '<div class="card-title">' + n.title + '</div>' +
      '<p class="card-excerpt">' + stripTags(n.excerpt || '') + '</p>' +
      '<div class="card-footer">' +
        '<div class="card-author">' +
          '<div class="author-avatar" style="background:rgba(201,168,76,0.15);color:var(--gold)">' +
            (n.author ? n.author[0] : 'م') + '</div>' +
          '<span class="card-author-name">' + (n.author || '') + '</span>' +
        '</div>' +
        '<span class="card-time">' + (n.date || '') + '</span>' +
      '</div>' +
    '</div></div>';
}

// ── SCROLL POSITION DOTS ──────────────────────────────────────────
export function _renderScrollDots(scrollId, dotsId) {
  const scroll = document.getElementById(scrollId);
  const dots   = document.getElementById(dotsId);
  if (!scroll || !dots) return;

  const update = () => {
    const cards = scroll.children.length;
    if (cards === 0) { dots.innerHTML = ''; return; }
    const dotCount = Math.min(cards, 8);
    const range  = scroll.scrollWidth - scroll.clientWidth;
    const pos    = Math.abs(scroll.scrollLeft);
    const ratio  = range > 0 ? pos / range : 0;
    const active = Math.round(ratio * (dotCount - 1));
    let html = '';
    for (let i = 0; i < dotCount; i++) {
      html += `<div class="dot${i === active ? ' active' : ''}" data-idx="${i}"></div>`;
    }
    dots.innerHTML = html;
    dots.querySelectorAll('.dot').forEach(d => {
      d.onclick = () => {
        const i = Number(d.dataset.idx);
        const targetRatio = dotCount > 1 ? i / (dotCount - 1) : 0;
        scroll.scrollTo({ left: targetRatio * range * (scroll.scrollLeft < 0 ? -1 : 1), behavior: 'smooth' });
      };
    });
  };
  update();
  if (!scroll._dotsBound) {
    scroll._dotsBound = true;
    scroll.addEventListener('scroll', () => {
      if (scroll._dotsRaf) cancelAnimationFrame(scroll._dotsRaf);
      scroll._dotsRaf = requestAnimationFrame(update);
    }, { passive: true });
  }
}

// ── RENDER TRENDING SECTION ───────────────────────────────────────
export function renderTrending() {
  const pub = getNewsData().filter(n => n.status === 'منشور');
  let all   = pub.filter(n => n.priority === 'trending' || n.trending === true || n.alsoTrending === true);
  all.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  if (!all.length) {
    all = [...pub].sort((a, b) => {
      const av = parseInt((a.views || '0').replace(/[^0-9]/g, '')) || 0;
      const bv = parseInt((b.views || '0').replace(/[^0-9]/g, '')) || 0;
      return bv - av;
    }).slice(0, 8);
  }
  const section = document.getElementById('trending-section');
  const scroll  = document.getElementById('trending-scroll');
  if (!section || !scroll) return;
  if (!all.length || window._trendingOff === true) { section.style.display = 'none'; return; }
  section.style.display = '';
  scroll.innerHTML = all.map(n => {
    _reg(n);
    const m  = catMeta(n.cat);
    const bg = n.thumbnail
      ? `<img class="trending-card-bg" src="${n.thumbnail}" alt="">`
      : `<div class="trending-card-bg" style="background:${m.bg};display:flex;align-items:center;justify-content:center;font-size:60px">${m.icon}</div>`;
    return `<div class="trending-card" onclick="openById(${n.id})">
      ${bg}
      <div class="trending-card-overlay">
        <div class="trending-card-cat">${n.cat}</div>
        <div class="trending-card-title">${n.title}</div>
      </div>
    </div>`;
  }).join('');
  setTimeout(() => {
    if (scroll) scroll.scrollLeft = scroll.scrollWidth; // RTL start: rightmost first
    _renderScrollDots('trending-scroll', 'trending-dots');
  }, 30);
}

export function scrollTrending(dir) {
  const s = document.getElementById('trending-scroll');
  if (s) s.scrollBy({ left: dir * 220, behavior: 'smooth' });
}

// ── SHOW-MORE (main page) ─────────────────────────────────────────
export function _updateShowMoreBtn() {
  const pub      = getNewsData().filter(n => n.status === 'منشور');
  const hero     = pub.find(n => n.priority === 'عاجل') || pub[pub.length - 1] || pub[0];
  const pinnedId = _fb.site ? _fb.site.wide_pinned : null;
  const feat     = (pinnedId ? pub.find(n => String(n.id) === String(pinnedId)) : null)
                || pub.find(n => n.priority === 'مميز' && n !== hero) || null;
  const pool     = pub.filter(n => n !== hero && n !== feat);
  _newsOffset = 6;
  const smGrid = document.getElementById('show-more-grid');
  if (smGrid) smGrid.innerHTML = '';
  const wrap = document.getElementById('show-more-wrap');
  const btn  = document.getElementById('show-more-btn');
  if (wrap) wrap.style.display = pool.length > 6 ? 'block' : 'none';
  if (btn)  btn.style.display  = 'block';
}

export function showMoreNews() {
  const pub      = getNewsData().filter(n => n.status === 'منشور');
  const hero     = pub.find(n => n.priority === 'عاجل') || pub[pub.length - 1] || pub[0];
  const pinnedId = _fb.site ? _fb.site.wide_pinned : null;
  const feat     = (pinnedId ? pub.find(n => String(n.id) === String(pinnedId)) : null)
                || pub.find(n => n.priority === 'مميز' && n !== hero) || null;
  const pool  = pub.filter(n => n !== hero && n !== feat);
  const batch = pool.slice(_newsOffset, _newsOffset + 6);
  _newsOffset += 6;
  const grid = document.getElementById('show-more-grid');
  if (!grid || !batch.length) return;
  grid.innerHTML += batch.map(n => _makeCard(n)).join('');
  const wrap = document.getElementById('show-more-wrap');
  const btn  = document.getElementById('show-more-btn');
  if (wrap) wrap.style.display = 'block';
  if (pool.length <= _newsOffset && btn) btn.style.display = 'none';
}

// ── ALL-NEWS OVERLAY PAGE ─────────────────────────────────────────
export function openAllNewsPage() {
  const page = document.getElementById('all-news-page');
  if (!page) return;
  // Close article overlay first if open
  const art = document.getElementById('article-page');
  if (art && art.style.display === 'block') {
    if (typeof window.closeArticle === 'function') window.closeArticle();
  }
  // Populate category filter
  const pub  = getNewsData().filter(n => n.status === 'منشور');
  const cats = [...new Set(pub.map(n => n.cat))].sort();
  const sel  = document.getElementById('all-news-cat-filter');
  if (sel) {
    sel.innerHTML = '<option value="">كل الأقسام</option>' +
      cats.map(c => '<option value="' + c + '">' + c + '</option>').join('');
  }
  renderAllNewsPage();
  page.style.display = 'block';
  page.scrollTop     = 0;
  document.body.style.overflow = 'hidden';
  document.querySelectorAll('#nav-links a').forEach(a => a.classList.remove('active'));
  const btn = document.getElementById('nav-allnews');
  if (btn) btn.classList.add('active');
  // Apply all-news ad banner (admin-controlled)
  const adData = (_fb && _fb.site && _fb.site.ad_allnews) || window._adAllnewsData;
  if (adData && typeof window._applyAdBanner === 'function') {
    window._applyAdBanner('allnews', adData);
  }
}

export function closeAllNewsPage() {
  const page = document.getElementById('all-news-page');
  if (!page) return;
  page.style.display = 'none';
  document.body.style.overflow = '';
  document.querySelectorAll('#nav-links a').forEach(a => a.classList.remove('active'));
  const na = document.getElementById('nav-all');
  if (na) na.classList.add('active');
}

export function renderAllNewsPage() {
  const pub = getNewsData().filter(n => n.status === 'منشور');
  const q   = (document.getElementById('all-news-search')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('all-news-cat-filter')?.value || '';
  let filtered = [...pub].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  if (q)   filtered = filtered.filter(n => n.title.toLowerCase().includes(q) || (n.excerpt || '').toLowerCase().includes(q));
  if (cat) filtered = filtered.filter(n => n.cat === cat);
  const cnt   = document.getElementById('all-news-count');
  const grid  = document.getElementById('all-news-grid');
  const empty = document.getElementById('all-news-empty');
  if (cnt) cnt.textContent = '(' + filtered.length + ' خبر)';
  if (!filtered.length) {
    if (grid)  grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (grid)  grid.innerHTML = filtered.map(n => _makeCard(n)).join('');
}

// ── CATEGORY FILTER & SEARCH ──────────────────────────────────────
export function filterByCat(cat, el) {
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');

  const filterSec = document.getElementById('cat-filter-section');
  const mainGrid  = document.querySelector('.grid-section');
  const heroEl    = document.getElementById('site-hero');
  const statsEl   = document.getElementById('stats-bar');

  if (cat === 'الكل') {
    filterSec.style.display = 'none';
    if (mainGrid) mainGrid.style.display = 'block';
    if (heroEl)   heroEl.style.display   = '';
    if (statsEl)  statsEl.style.display  = '';
    return;
  }

  if (mainGrid) mainGrid.style.display = 'none';
  if (heroEl)   heroEl.style.display   = 'none';
  if (statsEl)  statsEl.style.display  = 'none';
  filterSec.style.display = 'block';
  document.getElementById('cat-filter-title').textContent = cat === 'اليوم' ? '📅 أخبار اليوم' : 'أخبار ' + cat;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const all = getNewsData();
  const _normDate = s => String(s || '')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\-\.\u200F\u200E]/g, '/')
    .replace(/\s+/g, '').trim();
  const _today        = new Date();
  const todayAr       = _today.toLocaleDateString('ar-EG',  { year: 'numeric', month: '2-digit', day: '2-digit' });
  const todayEn       = _today.toLocaleDateString('en-GB',  { year: 'numeric', month: '2-digit', day: '2-digit' });
  const todayISO      = _today.toISOString().slice(0, 10);
  const yyyy = _today.getFullYear(), mm = String(_today.getMonth() + 1).padStart(2, '0'), dd = String(_today.getDate()).padStart(2, '0');
  const todayCandidates = new Set([
    _normDate(todayAr), _normDate(todayEn), _normDate(todayISO),
    _normDate(`${yyyy}/${mm}/${dd}`), _normDate(`${dd}/${mm}/${yyyy}`),
  ]);

  const filtered = all.filter(n => {
    if (n.status !== 'منشور') return false;
    if (cat === 'اليوم') return todayCandidates.has(_normDate(n.date));
    return n.cat === cat;
  });

  const grid  = document.getElementById('cat-filter-grid');
  const empty = document.getElementById('cat-empty');

  if (!filtered.length) {
    if (grid) grid.innerHTML = '';
    if (empty) {
      empty.textContent = cat === 'اليوم'
        ? 'لم يتم نشر أي أخبار اليوم حتى الآن — تحقق لاحقاً'
        : 'لا توجد أخبار في هذا القسم حالياً';
      empty.style.display = 'block';
    }
    return;
  }
  if (empty) empty.style.display = 'none';
  if (grid) grid.innerHTML = filtered.map(n => {
    _reg(n);
    const m     = catMeta(n.cat);
    const thumb = n.thumbnail
      ? `<img src="${n.thumbnail}" style="width:100%;height:100%;object-fit:cover" alt="">`
      : m.icon;
    return `<div class="news-card" onclick="openById(${n.id})">
      <div class="card-img"><div class="card-img-inner" style="background:${m.bg}">${thumb}</div></div>
      <div class="card-body">
        <div class="card-tags"><span class="tag ${m.cls}">${n.cat}</span></div>
        <div class="card-title">${n.title}</div>
        <p class="card-excerpt">${stripTags(n.excerpt || '')}</p>
        <div class="card-footer">
          <div class="card-author">
            <div class="author-avatar" style="background:rgba(201,168,76,0.15);color:var(--gold)">${n.author ? n.author[0] : 'م'}</div>
            <span class="card-author-name">${n.author || ''}</span>
          </div>
          <span class="card-time">${n.date || ''}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

export function navFilter(cat, el) {
  const art = document.getElementById('article-page');
  if (art && art.style.display === 'block') {
    if (typeof window.closeArticle === 'function') window.closeArticle();
  }
  const an = document.getElementById('all-news-page');
  if (an && an.style.display === 'block') closeAllNewsPage();
  document.querySelectorAll('#nav-links a').forEach(a => a.classList.remove('active'));
  if (el) el.classList.add('active');
  const pill = Array.from(document.querySelectorAll('.cat-pill'))
    .find(p => p.textContent.trim().includes(cat === 'الكل' ? 'الكل' : cat));
  filterByCat(cat, pill || null);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  return false;
}

export function clearCatFilter() {
  const artPage = document.getElementById('article-page');
  if (artPage && artPage.style.display === 'block') {
    if (typeof window.closeArticle === 'function') window.closeArticle();
  }
  const anp = document.getElementById('all-news-page');
  if (anp && anp.style.display !== 'none' && anp.style.display !== '') closeAllNewsPage();
  const heroEl  = document.getElementById('site-hero');
  const statsEl = document.getElementById('stats-bar');
  if (heroEl)  heroEl.style.display  = '';
  if (statsEl) statsEl.style.display = '';
  const searchInput = document.querySelector('.search-box input');
  if (searchInput) searchInput.value = '';
  filterByCat('الكل', document.querySelector('.cat-pill'));
}

export function liveSearch(q) {
  const heroEl    = document.getElementById('site-hero');
  const statsEl   = document.getElementById('stats-bar');
  const filterSec = document.getElementById('cat-filter-section');
  const mainGrid  = document.querySelector('.grid-section');

  if (!q.trim()) {
    filterSec.style.display = 'none';
    if (mainGrid) mainGrid.style.display = 'block';
    if (heroEl)   heroEl.style.display   = '';
    if (statsEl)  statsEl.style.display  = '';
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    const allPill = Array.from(document.querySelectorAll('.cat-pill')).find(p => p.textContent.trim().includes('الكل'));
    if (allPill) allPill.classList.add('active');
    return;
  }

  const all  = getNewsData();
  const q2   = q.trim().toLowerCase();
  const results = all.filter(n =>
    n.status === 'منشور' &&
    (n.title.toLowerCase().includes(q2) || (n.excerpt || '').toLowerCase().includes(q2) ||
     n.cat.includes(q) || (n.author || '').includes(q))
  );

  if (mainGrid) mainGrid.style.display = 'none';
  if (heroEl)   heroEl.style.display   = 'none';
  if (statsEl)  statsEl.style.display  = 'none';
  filterSec.style.display = 'block';
  document.getElementById('cat-filter-title').textContent = '🔍 نتائج البحث: "' + q + '"';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const grid  = document.getElementById('cat-filter-grid');
  const empty = document.getElementById('cat-empty');

  if (!results.length) { if (grid) grid.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
  if (empty) empty.style.display = 'none';
  if (grid) grid.innerHTML = results.map(n => {
    _reg(n);
    const m     = catMeta(n.cat);
    const thumb = n.thumbnail
      ? `<img src="${n.thumbnail}" style="width:100%;height:100%;object-fit:cover" alt="">`
      : m.icon;
    return `<div class="news-card" onclick="openById(${n.id})">
      <div class="card-img"><div class="card-img-inner" style="background:${m.bg}">${thumb}</div></div>
      <div class="card-body">
        <div class="card-tags"><span class="tag ${m.cls}">${n.cat}</span></div>
        <div class="card-title">${n.title}</div>
        <p class="card-excerpt">${stripTags(n.excerpt || '')}</p>
        <div class="card-footer">
          <div class="card-author">
            <div class="author-avatar" style="background:rgba(201,168,76,0.15);color:var(--gold)">${n.author ? n.author[0] : 'م'}</div>
            <span class="card-author-name">${n.author || ''}</span>
          </div>
          <span class="card-time">${n.date || ''}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── CATS STRIP (dynamic update from Firebase) ─────────────────────
const _localCatColors = {
  'الذكاء الاصطناعي': '#4A9EFF', 'الهواتف والأجهزة': '#3DDC84', 'الفضاء والعلوم': '#B090FF',
  'الأمن الرقمي': '#FF5252', 'الشركات والأعمال': '#FF9A3C', 'ألعاب الفيديو': '#F0C840',
  'السيارات الكهربائية': '#FF7070', 'الروبوتات': '#40C8F0', 'التقنية الحيوية': '#C875FF',
};
window._catColors = _localCatColors;

export function _applyCatsStrip(cats) {
  const strip = document.getElementById('cats-strip');
  if (!strip) return;
  // Remove dynamic pills (keep first 2 static: اليوم + الكل)
  Array.from(strip.querySelectorAll('.cat-pill')).slice(2).forEach(p => p.remove());
  cats.forEach(c => {
    const exists = Array.from(strip.querySelectorAll('.cat-pill')).some(p => p.textContent.includes(c.name));
    if (exists) return;
    const color = c.color || _localCatColors[c.name] || 'var(--gold)';
    const pill  = document.createElement('div');
    pill.className = 'cat-pill';
    pill.innerHTML = `<span class="dot" style="background:${color}"></span>${c.name}`;
    pill.onclick = () => filterByCat(c.name, pill);
    strip.appendChild(pill);
  });
}

// ── MAIN RENDER (called by Firebase onSnapshot) ───────────────────
export function renderSite() {
  const all = getNewsData();
  all.forEach(n => _reg(n));

  // Strip skeleton states on first real-data render
  if (all.length > 0) {
    const heroEl = document.querySelector('.hero-main.loading');
    if (heroEl) { heroEl.classList.remove('loading'); heroEl.classList.add('loaded'); }
    const mainGrid = document.getElementById('main-news-grid');
    if (mainGrid) mainGrid.querySelectorAll('.news-card[style*="pointer-events:none"]').forEach(c => c.remove());
    const wideEl = document.getElementById('wide-card-el');
    if (wideEl && wideEl.style.display === 'none') wideEl.style.display = '';
    document.querySelectorAll('.sidebar-card[style*="pointer-events:none"]').forEach(c => c.remove());
  }

  // Ticker
  const latest      = _fb.latest || [];
  const activeTicker = latest.filter(l => l.status === 'نشط');
  if (activeTicker.length > 0) {
    const pubIndex = {};
    all.filter(n => n.status === 'منشور').forEach(n => { if (n.title) pubIndex[n.title.trim()] = n.id; });
    updateTicker(activeTicker, pubIndex, id => {
      if (typeof window.openById === 'function') window.openById(id);
    });
  }

  checkBreaking();

  const pub = all.filter(n => n.status === 'منشور');
  if (!pub.length) {
    document.querySelectorAll('.news-card:not([data-bound]), .sidebar-card:not([data-bound])').forEach(card => {
      card.style.cursor = 'pointer';
      card.setAttribute('data-bound', '1');
      const idx       = parseInt(card.dataset.idx || '0');
      const staticPub = all.length ? all : STATIC_NEWS;
      card.addEventListener('click', () => {
        if (staticPub[idx] && typeof window.openArticle === 'function') window.openArticle(staticPub[idx]);
      });
    });
    return;
  }

  // Priority logic
  const heroCands      = pub.filter(n => n.priority === 'عاجل'  || n.alsoHero);
  const featNews       = pub.filter(n => n.priority === 'مميز'  || n.alsoFeatured);
  const hero           = heroCands[0] || featNews[0] || pub[0];

  // Hero element
  const heroEl = document.querySelector('.hero-main');
  if (heroEl) {
    const m = catMeta(hero.cat);
    heroEl.onclick = () => { if (typeof window.openArticle === 'function') window.openArticle(hero); };
    heroEl.classList.remove('loading');
    heroEl.classList.add('loaded');
    const skelSpan = heroEl.querySelector('.skel-hero-img');
    if (skelSpan) skelSpan.remove();
    const heroImg = heroEl.querySelector('.hero-img');
    if (heroImg) {
      if (hero.thumbnail) {
        const existImg = heroImg.querySelector('img');
        if (existImg) existImg.remove();
        const img = document.createElement('img');
        img.src   = hero.thumbnail; img.alt = hero.title;
        img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
        heroImg.insertBefore(img, heroImg.firstChild);
      } else {
        heroImg.style.background = m.bg;
        const existImg = heroImg.querySelector('img');
        if (existImg) existImg.remove();
      }
    }
    const catEl   = heroEl.querySelector('.hero-category');
    const badgeEl = heroEl.querySelector('.hero-badge');
    if (catEl)   catEl.textContent      = hero.cat;
    if (badgeEl) badgeEl.style.display  = hero.priority === 'عاجل' ? 'block' : 'none';
    const titleEl   = heroEl.querySelector('.hero-title');
    const excerptEl = heroEl.querySelector('.hero-excerpt');
    if (titleEl)   titleEl.textContent   = hero.title;
    if (excerptEl) excerptEl.textContent = stripTags(hero.excerpt || '');
    const spans = heroEl.querySelectorAll('.hero-meta span');
    if (spans[0]) spans[0].textContent = '✍️ ' + (hero.author || '');
    if (spans[1]) spans[1].textContent = '🕐 ' + (hero.date   || '');
    const ctaEl = heroEl.querySelector('.hero-cta');
    if (ctaEl) ctaEl.onclick = e => { e.stopPropagation(); if (typeof window.openArticle === 'function') window.openArticle(hero); };
  }

  // Sidebar
  const sideCount      = Number(window._heroSideCount) || 4;
  const sideItemsFeat  = featNews.filter(n => n !== hero);
  const normalNews     = pub.filter(n => n.priority !== 'عاجل' && n.priority !== 'مميز' && n.priority !== 'ابرز المقالات');
  const sideItemsNorm  = normalNews.filter(n => n !== hero);
  const sideItems      = [...sideItemsFeat, ...sideItemsNorm].slice(0, sideCount);
  const sidebar        = document.querySelector('.sidebar-stack');
  if (sidebar && sideItems.length) {
    const nums = ['١', '٢', '٣', '٤', '٥', '٦'];
    sidebar.innerHTML = sideItems.map((n, i) => {
      _reg(n);
      const m = catMeta(n.cat);
      const thumbHtml = n.thumbnail
        ? `<div class="sidebar-thumb"><img src="${n.thumbnail}" alt="${n.title}" onerror="this.parentElement.style.background='${m.bg}';this.parentElement.innerHTML='<span style=font-size:22px>${m.icon}</span>'"></div>`
        : `<div class="sidebar-thumb" style="background:${m.bg}">${m.icon}</div>`;
      const sideCatColored = window._sidebarCatColored !== false;
      const sideCatShape   = window._sidebarCatShape || 'pill';
      const catColor = (window._catColors && window._catColors[n.cat]) || '#C9A84C';
      const catClasses = sideCatColored ? `sidebar-cat sidebar-cat-colored shape-${sideCatShape}` : 'sidebar-cat';
      const catStyle   = sideCatColored ? `--sidebar-cat-bg:${catColor}22;--sidebar-cat-border:${catColor}55;color:${catColor}` : '';
      return `<div class="sidebar-card" onclick="openById(${n.id})" style="cursor:pointer">
        <div class="sidebar-num">${nums[i]}</div>
        ${thumbHtml}
        <div class="sidebar-card-content">
          <div class="${catClasses}" style="${catStyle}">${n.cat}</div>
          <div class="sidebar-title">${n.title}</div>
          <div class="sidebar-time">${n.date}</div>
        </div>
      </div>`;
    }).join('');
  }

  // Wide featured card
  const featuredArt = pub.find(n => n.priority === 'ابرز المقالات' && n !== hero);
  const pinnedId    = _fb.site ? _fb.site.wide_pinned : null;
  const pinnedArt   = pinnedId ? pub.find(n => String(n.id) === String(pinnedId)) : null;
  const feat        = featuredArt || pinnedArt || sideItemsFeat[0] || null;
  const wideCard    = document.getElementById('wide-card-el') || document.querySelector('.wide-card');
  if (wideCard) wideCard.style.display = feat ? '' : 'none';
  if (wideCard && feat) {
    const m = catMeta(feat.cat);
    _reg(feat);
    wideCard.onclick = () => { if (typeof window.openArticle === 'function') window.openArticle(feat); };
    const wi = wideCard.querySelector('.wide-img');
    if (wi) {
      wi.innerHTML = '';
      wi.style.background = m.bg;
      if (feat.thumbnail) {
        const img = document.createElement('img');
        img.src = feat.thumbnail; img.alt = feat.title || '';
        img.onerror = function () {
          img.remove();
          wi.innerHTML = `<div class="wide-img-emoji" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:80px;z-index:1">${m.icon}</div>`;
        };
        wi.appendChild(img);
      } else {
        wi.innerHTML = `<div class="wide-img-emoji" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:80px;z-index:1">${m.icon}</div>`;
      }
    }
    const wb = wideCard.querySelector('.wide-body');
    if (wb) {
      const tags = wb.querySelector('.card-tags');
      if (tags) tags.innerHTML = `<span class="tag ${m.cls}">${feat.cat}</span>`;
      const wt = wb.querySelector('.wide-title');
      if (wt) wt.textContent = feat.title;
      const we = wb.querySelector('.wide-excerpt');
      if (we) we.textContent = stripTags(feat.excerpt || '') || feat.title;
      const ms = wb.querySelectorAll('.hero-meta span');
      if (ms[0]) ms[0].textContent = '✍️ ' + (feat.author || '');
      if (ms[1]) ms[1].textContent = '🕐 ' + (feat.date   || '');
    }
  }

  _updateShowMoreBtn();
  renderTrending();

  // Main grid (remaining published, sorted newest-first, max 6)
  const sideSet   = new Set(sideItems.map(n => n.id));
  const gridItems = pub
    .filter(n => n !== hero && n !== feat && !sideSet.has(n.id))
    .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))
    .slice(0, 6);
  const grid = document.getElementById('main-news-grid') || document.querySelector('.grid-section .news-grid');
  if (grid && gridItems.length) {
    grid.innerHTML = gridItems.map(n => {
      _reg(n);
      const m     = catMeta(n.cat);
      const thumb = n.thumbnail
        ? `<img src="${n.thumbnail}" style="width:100%;height:100%;object-fit:cover" alt="">`
        : m.icon;
      const viewsNum  = parseInt((n.views || '0').replace(/[^0-9]/g, '')) || 0;
      const isTrending = viewsNum > 5000;
      const showAuthor = n.showAuthor !== false;
      const showDate   = n.showDate   !== false;
      const showViews  = n.showViews  !== false;
      return `<div class="news-card" onclick="openById(${n.id})">
        <div class="card-img"><div class="card-img-inner" style="background:${m.bg}">${thumb}</div></div>
        <div class="card-body">
          <div class="card-tags">
            <span class="tag ${m.cls}">${n.cat}</span>
            ${n.priority === 'عاجل' ? '<span class="tag tag-red">عاجل</span>' : n.priority === 'مميز' ? '<span class="tag tag-gold">مميز</span>' : ''}
            ${isTrending ? '<span class="trending-badge">🔥 رائج</span>' : ''}
          </div>
          <div class="card-title">${n.title}</div>
          <p class="card-excerpt">${stripTags(n.excerpt || '')}</p>
          <div class="card-footer">
            ${showAuthor ? `<div class="card-author">
              <div class="author-avatar" style="background:rgba(201,168,76,0.15);color:var(--gold)">${n.author ? n.author[0] : 'م'}</div>
              <span class="card-author-name">${n.author || ''}</span>
            </div>` : '<div></div>'}
            <div style="display:flex;align-items:center;gap:6px">
              ${showDate && n.date   ? `<span class="card-time">${n.date}</span>` : ''}
              ${showViews && n.views ? `<span style="font-size:11px;color:var(--text-dim)">${showDate ? '· ' : ''}👁 ${n.views}</span>` : ''}
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
  }
}
