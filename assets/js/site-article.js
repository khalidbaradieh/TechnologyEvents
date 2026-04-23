// ================================================================
// assets/js/site-article.js — Article overlay open/close/interact
// Handles: openArticle, closeArticle, share, likes, views, bookmarks,
//          SEO meta tags, reading progress, comments, related news.
// ================================================================

import { _fb, _reg, getNewsData }  from '/assets/js/site-state.js';
import { catMeta }                  from '/assets/js/site-cats.js';
import { _applyAdBanner }           from '/assets/js/site-ads.js';
import { calcReadTime, showToast,
         toArabicDigits, parseCount,
         formatCount }              from '/modules/helpers.js';
import { getBookmarks, saveBookmarks,
         getLikeCounts, saveLikeCounts,
         getLikedByMe,  saveLikedByMe } from '/modules/storage.js';

// Session-level set of already-viewed article IDs (prevents double-counting per session)
const _VIEWED_KEY = 'atq_viewed_articles';

// ─── READING PROGRESS ────────────────────────────────────────────
export function _updateProgress() {
  const page = document.getElementById('article-page');
  const prog = document.getElementById('reading-progress');
  if (!page || !prog) return;
  const max = page.scrollHeight - page.clientHeight;
  const pct = max > 0 ? page.scrollTop / max : 0;
  prog.style.transform = `scaleX(${pct})`;
}

// ─── VIEW COUNTER ────────────────────────────────────────────────
export function _incrementArticleViews(article) {
  if (!article || !article.id) return;
  try {
    const viewed = JSON.parse(sessionStorage.getItem(_VIEWED_KEY) || '[]');
    if (viewed.indexOf(String(article.id)) !== -1) return;
    viewed.push(String(article.id));
    sessionStorage.setItem(_VIEWED_KEY, JSON.stringify(viewed));
  } catch (_) { /* silent */ }

  const cur  = parseCount(article.views);
  const next = cur + 1;
  article.views    = toArabicDigits(formatCount(next));
  article._viewsRaw = next;

  // Update visible views pill in the article page
  const viewsPill = document.querySelector('#article-meta .views-pill');
  if (viewsPill) viewsPill.textContent = '👁 ' + article.views;

  // Persist locally so trending section reflects real readership
  try {
    const counts = JSON.parse(localStorage.getItem('atq_view_counts') || '{}');
    counts[String(article.id)] = next;
    localStorage.setItem('atq_view_counts', JSON.stringify(counts));
  } catch (_) { /* silent */ }
}

// ─── SEO / OPEN GRAPH META ────────────────────────────────────────
export function _updateArticleMetaTags(article) {
  if (!article) return;
  const brand = document.title.split(' — ')[0] || 'الأحداث التقنية';
  const title = article.title ? `${article.title} — ${brand}` : brand;
  const desc  = (article.excerpt || article.title || '').substring(0, 200);
  const img   = article.thumbnail || '';
  document.title = title;
  const set = (id, attr, val) => {
    const el = document.getElementById(id);
    if (el && val != null) el.setAttribute(attr, val);
  };
  set('meta-description', 'content', desc);
  set('og-type',          'content', 'article');
  set('og-title',         'content', title);
  set('og-description',   'content', desc);
  set('og-image',         'content', img);
  set('tw-title',         'content', title);
  set('tw-description',   'content', desc);
  set('tw-image',         'content', img);
}

export function _resetArticleMetaTags() {
  const brand       = (window._brandName || document.title || 'الأحداث التقنية').split(' — ')[0];
  const defaultDesc = 'منصة إخبارية عربية متخصصة في أحدث أخبار التكنولوجيا والذكاء الاصطناعي والابتكار الرقمي';
  document.title = brand;
  const set = (id, attr, val) => { const el = document.getElementById(id); if (el) el.setAttribute(attr, val); };
  set('meta-description', 'content', defaultDesc);
  set('og-type',          'content', 'website');
  set('og-title',         'content', brand);
  set('og-description',   'content', defaultDesc);
  set('og-image',         'content', '');
  set('tw-title',         'content', brand);
  set('tw-description',   'content', defaultDesc);
  set('tw-image',         'content', '');
}

// ─── INTERACTION TOGGLES ──────────────────────────────────────────
export function _applyInteractionToggles() {
  const bar = document.getElementById('article-interactions');
  if (!bar) return;
  const settings = (_fb && _fb.site && _fb.site.interactions)        || {};
  const labels   = (_fb && _fb.site && _fb.site.interaction_labels)  || {};
  bar.querySelectorAll('[data-int]').forEach(btn => {
    const key     = btn.getAttribute('data-int');
    const enabled = settings[key] !== false; // default ON
    btn.style.display = enabled ? '' : 'none';
    const custom = labels[key];
    if (custom && typeof custom === 'string' && key !== 'like') {
      btn.textContent = custom;
    } else if (custom && key === 'like') {
      const countHtml = document.getElementById('like-count')?.outerHTML || '<span id="like-count">٠</span>';
      btn.innerHTML = custom + ' ' + countHtml;
    }
  });
  window._relatedEnabled = settings.related !== false;
  window._relatedCount   = Number((_fb && _fb.site && _fb.site.related_count)) || 8;
}

// ─── ARTICLE BODY BUILDER ─────────────────────────────────────────
export function buildArticleBody(a) {
  if (a.content && a.content.trim() && a.content.trim() !== '<br>') return a.content;
  return `<p>${a.excerpt || a.title || ''}</p>
    <p>تُعدّ هذه التطورات من أبرز ما شهده قطاع التكنولوجيا خلال الفترة الأخيرة، إذ تفتح آفاقاً جديدة أمام الباحثين والمطورين.</p>
    <h2>التفاصيل الكاملة</h2>
    <p>تشير التقارير إلى أن هذا الإنجاز جاء بعد شهور من العمل المتواصل مع استثمارات ضخمة في البنية التحتية.</p>
    <blockquote>"هذا التطور يمثل نقلة نوعية حقيقية في مسيرة الابتكار التقني."</blockquote>
    <p>ويرى المحللون أن التداعيات ستكون واسعة النطاق على مستوى الصناعة العالمية.</p>`;
}

// ─── OPEN ARTICLE ─────────────────────────────────────────────────
export function openArticle(article) {
  if (!article) return;
  // Close all-news page if open
  const anp = document.getElementById('all-news-page');
  if (anp && anp.style.display !== 'none') {
    anp.style.display = 'none';
    document.body.style.overflow = '';
  }

  const m = catMeta(article.cat);
  document.getElementById('article-cat').textContent          = article.cat || '';
  document.getElementById('article-title').textContent        = article.title || '';
  document.getElementById('article-topbar-title').textContent = article.title || '';

  // Summary/excerpt — rendered as HTML (admin supports rich formatting)
  const summEl = document.getElementById('article-summary');
  if (summEl) {
    const raw     = article.excerpt || '';
    const hasText = raw.replace(/<[^>]*>/g, '').trim().length > 0;
    if (hasText) {
      summEl.innerHTML   = raw;
      summEl.style.display = '';
    } else {
      summEl.innerHTML   = '';
      summEl.style.display = 'none';
    }
  }

  const readTime  = calcReadTime((article.content || '') + (article.excerpt || ''));
  const views     = article.views || '٠';
  const showAuthor = article.showAuthor !== false;
  const showDate   = article.showDate   !== false;
  const showViews  = article.showViews  !== false;

  document.getElementById('article-meta').innerHTML =
    `${showAuthor ? `<span>✍️ ${article.author || ''}</span>` : ''}
     ${showDate   ? `<span>🕐 ${article.date   || ''}</span>` : ''}
     ${showViews  ? `<span class="views-pill">👁 ${views}</span>` : ''}
     <span class="read-time">⏱ ${readTime}</span>`;

  // Hero image
  const img = document.getElementById('article-hero-img');
  if (article.thumbnail) {
    img.style.background = 'none';
    img.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"
      style="width:100%;height:100%;object-fit:cover">`;
  } else {
    img.style.background = m.bg;
    img.innerHTML = `<span style="font-size:80px">${m.icon}</span>`;
  }

  document.getElementById('article-body').innerHTML = buildArticleBody(article);

  // Comments section
  const commSec = document.getElementById('article-comments-section');
  if (commSec) {
    const globalOn  = window._commentsEnabled !== false;
    const articleOn = article.commentsEnabled !== false;
    commSec.style.display = (globalOn && articleOn) ? 'block' : 'none';
    const cList = document.getElementById('comments-list');
    if (cList) cList.innerHTML = '';
  }

  window._scrollPos     = window.scrollY;
  window._currentArticle = article;

  // URL hash for direct sharing
  const _artHash = '#article-' + (article.id || Date.now());
  history.pushState({ art: true, id: article.id }, '', location.pathname + _artHash);

  _updateArticleMetaTags(article);
  _incrementArticleViews(article);

  const page = document.getElementById('article-page');
  page.style.display = 'block';
  page.scrollTop     = 0;
  document.body.style.overflow = 'hidden';

  // Reading progress bar
  const prog = document.getElementById('reading-progress');
  if (prog) prog.style.display = 'block';
  page.addEventListener('scroll', _updateProgress, { passive: true });

  // Article inline ad
  _applyAdBanner('article', (_fb.site && _fb.site.ad_article) || window._adArticleData);

  _updateBookmarkBtn(article);

  // Footer pages: hide interactions + related news
  const interactBar   = document.getElementById('article-interactions');
  const suggestedWrap = document.getElementById('article-suggested');
  if (article.isFooterPage) {
    if (interactBar)   interactBar.style.display   = 'none';
    if (suggestedWrap) suggestedWrap.style.display = 'none';
  } else {
    if (interactBar) interactBar.style.display = '';
    _applyInteractionToggles();
    _refreshLikeUI();
    renderSuggestedNews(article);
  }
}

// ─── CLOSE ARTICLE ────────────────────────────────────────────────
export function closeArticle() {
  const page = document.getElementById('article-page');
  if (!page || page.style.display !== 'block') return;
  page.style.display = 'none';
  document.body.style.overflow = '';
  const prog = document.getElementById('reading-progress');
  if (prog) { prog.style.display = 'none'; prog.style.transform = 'scaleX(0)'; }
  page.removeEventListener('scroll', _updateProgress);
  history.replaceState(null, '', location.pathname);
  _resetArticleMetaTags();
  window.scrollTo({ top: window._scrollPos || 0, behavior: 'smooth' });
}

// ─── OPEN BY ID (from any card onclick) ──────────────────────────
export function openById(id) {
  const n = window._store[id];
  if (n) { openArticle(n); return; }
  const all   = getNewsData();
  const found = all.find(x => String(x.id) === String(id));
  if (found) openArticle(found);
}

// ─── OPEN FROM HERO / WIDE CARD (fallbacks before Firebase loads) ──
export function openArticleFromEl(el) {
  const pub     = getNewsData().filter(n => n.status === 'منشور');
  const article = pub.find(n => n.priority === 'عاجل') || pub[0];
  if (article) { openArticle(article); return; }
  openArticle({
    cat:     el.querySelector('.hero-category')?.textContent || 'تقنية',
    title:   el.querySelector('.hero-title')?.textContent    || '',
    author:  (el.querySelectorAll('.hero-meta span')[0]?.textContent || '').replace('✍️ ', ''),
    date: '', views: '٠',
    excerpt: el.querySelector('.hero-excerpt')?.textContent  || '',
  });
}

export function openArticleFromWide(el) {
  const pub      = getNewsData().filter(n => n.status === 'منشور');
  if (!pub.length) return;
  const pinnedId = (_fb.site && _fb.site.wide_pinned) || localStorage.getItem('atq_wide_pinned');
  const hero     = pub.find(n => n.priority === 'عاجل') || pub[0];
  const feat     = (pinnedId ? pub.find(n => String(n.id) === pinnedId) : null)
                || pub.find(n => n.priority === 'مميز' && n !== hero)
                || null;
  if (feat) { openArticle(feat); return; }
  openArticle({
    cat:     el.querySelector('.card-tags span')?.textContent  || 'تقنية',
    title:   el.querySelector('.wide-title')?.textContent      || '',
    author: '', date: '', views: '٠',
    excerpt: el.querySelector('.wide-excerpt')?.textContent    || '',
  });
}

// ─── SHARE ───────────────────────────────────────────────────────
export function shareArticle(platform) {
  const art   = window._currentArticle || {};
  const title = encodeURIComponent(art.title || document.title);
  const url   = encodeURIComponent(location.href);
  const urls  = {
    twitter:  `https://twitter.com/intent/tweet?text=${title}&url=${url}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    whatsapp: `https://wa.me/?text=${title}%20${url}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
  };
  if (platform === 'copy') {
    navigator.clipboard?.writeText(location.href).then(() => {
      const btn = document.getElementById('copy-link-btn');
      if (btn) { btn.textContent = '✅ تم النسخ'; setTimeout(() => btn.textContent = '📎 نسخ الرابط', 2000); }
    });
    return;
  }
  if (platform === 'native') {
    if (navigator.share) {
      navigator.share({ title: art.title || document.title, url: location.href }).catch(() => {});
    } else {
      shareArticle('copy');
    }
    return;
  }
  if (urls[platform]) window.open(urls[platform], '_blank', 'noopener');
}

// ─── LIKES ────────────────────────────────────────────────────────
function _refreshLikeUI() {
  const art = window._currentArticle;
  if (!art) return;
  const counts = getLikeCounts();
  const mine   = getLikedByMe();
  const n   = counts[String(art.id)] || 0;
  const btn = document.getElementById('like-btn');
  const lc  = document.getElementById('like-count');
  if (lc)  lc.textContent = toArabicDigits(formatCount(n) || '0');
  if (btn) btn.classList.toggle('liked', !!mine[String(art.id)]);
}

export function toggleArticleLike() {
  const art = window._currentArticle;
  if (!art || !art.id) return;
  const key    = String(art.id);
  const counts = getLikeCounts();
  const mine   = getLikedByMe();
  if (mine[key]) {
    counts[key] = Math.max(0, (counts[key] || 1) - 1);
    delete mine[key];
  } else {
    counts[key] = (counts[key] || 0) + 1;
    mine[key]   = true;
  }
  saveLikeCounts(counts);
  saveLikedByMe(mine);
  _refreshLikeUI();
}

// ─── BOOKMARKS ────────────────────────────────────────────────────
export function _updateBookmarkBtn(article) {
  const btn = document.getElementById('bookmark-btn');
  if (!btn) return;
  const saved = getBookmarks();
  btn.textContent = saved.find(x => String(x.id) === String(article.id)) ? '✅ محفوظ' : '🔖 حفظ';
}

export function toggleBookmark() {
  const art = window._currentArticle;
  if (!art) return;
  let saved   = getBookmarks();
  const exists = saved.find(x => String(x.id) === String(art.id));
  const btn    = document.getElementById('bookmark-btn');
  if (exists) {
    saved = saved.filter(x => String(x.id) !== String(art.id));
    if (btn) btn.textContent = '🔖 حفظ';
    showToast('تم إزالة الخبر من المحفوظات');
  } else {
    saved.unshift({ id: art.id, title: art.title, cat: art.cat, date: art.date, thumbnail: art.thumbnail || '' });
    if (saved.length > 50) saved = saved.slice(0, 50);
    if (btn) btn.textContent = '✅ محفوظ';
    showToast('✅ تم حفظ الخبر — اقرأه لاحقاً');
  }
  saveBookmarks(saved);
}

// ─── COMMENTS ────────────────────────────────────────────────────
export function submitComment() {
  const inp  = document.getElementById('comment-input');
  const list = document.getElementById('comments-list');
  if (!inp || !list || !inp.value.trim()) return;
  const div = document.createElement('div');
  div.style.cssText = 'background:var(--dark-3);border:1px solid var(--border-dim);border-radius:10px;padding:12px 16px';
  div.innerHTML = `<div style="font-size:12px;color:var(--text-dim);margin-bottom:6px">زائر · الآن</div>
    <div style="font-size:14px;color:var(--text-muted)">${inp.value.trim()}</div>`;
  list.prepend(div);
  inp.value = '';
}

// ─── RELATED NEWS ─────────────────────────────────────────────────
export function renderSuggestedNews(article) {
  const wrap   = document.getElementById('article-suggested');
  const scroll = document.getElementById('suggested-scroll');
  if (!wrap || !scroll) return;
  if (window._relatedEnabled === false) { wrap.style.display = 'none'; return; }
  const pub      = getNewsData().filter(n => n.status === 'منشور' && String(n.id) !== String(article.id));
  const sameCat  = pub.filter(n => n.cat === article.cat);
  const others   = pub.filter(n => n.cat !== article.cat);
  const count    = Math.max(1, Math.min(20, Number(window._relatedCount) || 8));
  const pool     = [...sameCat, ...others].slice(0, count);
  if (!pool.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  scroll.innerHTML = pool.map(n => {
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
    scroll.scrollLeft = scroll.scrollWidth; // RTL: start at rightmost
    if (typeof window._renderScrollDots === 'function') window._renderScrollDots('suggested-scroll', 'suggested-dots');
  }, 30);
}
