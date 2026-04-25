// ================================================================
// assets/js/main.js — Public site (index.html) entry point
// Initialises Firebase, sets up onSnapshot listeners,
// bootstraps the page, and exposes all functions to global scope.
//
// Import order matters for TDZ safety:
//   1. Pure data / state (no DOM)
//   2. Pure utilities
//   3. Feature modules (may touch DOM)
//   4. Entry-point wiring (this file)
// ================================================================

// ── Firebase imports ──────────────────────────────────────────────
import { db } from '/modules/firebase.js';
import {
  collection, doc, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Config ───────────────────────────────────────────────────────
import { DB } from '/config.js';

// ── Shared state (must import before feature modules) ────────────
import { _fb } from '/assets/js/site-state.js';

// ── Feature modules ───────────────────────────────────────────────
import { renderSite, renderAllNewsPage, renderTrending,
         openAllNewsPage, closeAllNewsPage,
         filterByCat, navFilter, clearCatFilter, liveSearch,
         showMoreNews, _renderScrollDots, scrollSuggested,
         _applyCatsStrip }                      from '/assets/js/site-news-render.js';
import { openArticle, closeArticle, openById,
         openArticleFromEl, openArticleFromWide,
         shareArticle, toggleArticleLike,
         toggleBookmark, submitComment,
         renderSuggestedNews,
         loadLikeCountForArticle }              from '/assets/js/site-article.js';
import { scrollTrending }                       from '/assets/js/site-news-render.js';
import { checkBreaking, closeBreaking }         from '/assets/js/site-breaking.js';
import { _startTickerRAF, applyTickerSpeed }    from '/assets/js/site-ticker.js';
import { _applyAdBanner, _applyCustomBanners }  from '/assets/js/site-ads.js';
import {
  toggleTheme, toggleLang, applySiteButtons,
  scrollToTop, toggleMobileNav, _closeMobileNav,
  _toggleMobileSearch, _autoCollapseNav,
  openContactModal, closeContactModal, submitContact,
  subscribeNewsletter, openFooterLink, openFooterNewWin,
  _applyNavMenu, _applySocialMedia, _applyFooterCol,
  _applyLayoutSettings, _applyIdentitySettings,
  _applyMaintenance,
}                                               from '/assets/js/site-ui.js';
import {
  _applyInteractionToggles,
}                                               from '/assets/js/site-article.js';

// ── Render debounce ───────────────────────────────────────────────
// Collapses rapid onSnapshot bursts (load-time) into one render call.
let _renderTimer = null;
function _scheduleRender() {
  clearTimeout(_renderTimer);
  _renderTimer = setTimeout(renderSite, 16);
}

// ─────────────────────────────────────────────────────────────────
// FIREBASE REAL-TIME LISTENERS
// Called once on page load. Each listener re-renders on data change.
// ─────────────────────────────────────────────────────────────────
function startFirebaseListeners() {

  // ── NEWS ────────────────────────────────────────────────────────
  onSnapshot(collection(db, DB.NEWS), snap => {
    const items = [];
    snap.forEach(d => {
      const data = d.data();
      if (!data || !data.title) return;
      if (!data.id) data.id = d.id;
      items.push(data);
    });
    items.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    _fb.news = items.length ? items : null;
    if (items.length) {
      try { localStorage.setItem('atq_cache_news', JSON.stringify(items.slice(0, 50))); } catch (_) { /* silent */ }
    }
    _scheduleRender();
    // Restore pending deep-link article after refresh
    if (window._pendingArticleId) {
      const art = items.find(x => String(x.id) === String(window._pendingArticleId));
      if (art) { setTimeout(() => openArticle(art), 200); }
    }
  }, err => { console.warn('[FB] news:', err); _scheduleRender(); });

  // ── LATEST TICKER ───────────────────────────────────────────────
  onSnapshot(doc(db, DB.SETTINGS, DB.S.LATEST), snap => {
    _fb.latest = snap.exists() ? (snap.data().items || []) : [];
    try { localStorage.setItem('atq_cache_latest', JSON.stringify(_fb.latest)); } catch (_) { /* silent */ }
    _scheduleRender();
  }, err => console.warn('[FB] latest:', err));

  // ── CATEGORIES ──────────────────────────────────────────────────
  onSnapshot(doc(db, DB.SETTINGS, DB.S.CATS), snap => {
    if (!snap.exists()) return;
    const items = snap.data().items || [];
    if (!items.length) return;
    _fb.cats = items;
    _applyCatsStrip(items);
  }, err => console.warn('[FB] cats:', err));

  // ── BREAKING NEWS ───────────────────────────────────────────────
  onSnapshot(doc(db, DB.SETTINGS, DB.S.BREAKING), snap => {
    _fb.breaking = snap.exists() ? (snap.data().items || []) : [];
    try { localStorage.setItem('atq_cache_breaking', JSON.stringify(_fb.breaking)); } catch (_) { /* silent */ }
    checkBreaking();
  }, err => console.warn('[FB] breaking:', err));

  // ── SITE SETTINGS ───────────────────────────────────────────────
  onSnapshot(doc(db, DB.SETTINGS, DB.S.SITE), snap => {
    if (!snap.exists()) return;
    const s = snap.data();
    _fb.site = s;

    // Cache (skip large base64 logos to avoid localStorage quota)
    try {
      const cacheable = Object.assign({}, s);
      if (cacheable.identity && cacheable.identity.logoImage && cacheable.identity.logoImage.length > 2000) {
        cacheable.identity = Object.assign({}, cacheable.identity, { logoImage: '' });
      }
      localStorage.setItem('atq_cache_site', JSON.stringify(cacheable));
    } catch (_) { /* silent */ }

    // Site appearance
    if (s.site_buttons)   applySiteButtons(s.site_buttons);
    if (s.site_title)     document.querySelectorAll('.nav-logo-text').forEach(el => el.textContent = s.site_title);
    if (s.subscribe_text) { const sb = document.getElementById('subscribe-btn'); if (sb) sb.textContent = s.subscribe_text; }

    // Ticker
    if (s.ticker_speed) {
      document.documentElement.style.setProperty('--ticker-speed', s.ticker_speed + 's');
      applyTickerSpeed(s.ticker_speed);
    }
    const tk = document.querySelector('.ticker');
    if (tk) tk.style.display = s.ticker_visible === false ? 'none' : '';

    // Footer
    if (s.footer_desc) { const el = document.getElementById('footer-desc'); if (el) el.textContent = s.footer_desc; }
    if (s.footer_copy) { const el = document.getElementById('footer-copy'); if (el) el.textContent = s.footer_copy; }

    // Legacy social link shortcuts
    const socMap = {
      footer_twitter: 'footer-social-twitter', footer_linkedin: 'footer-social-linkedin',
      footer_youtube: 'footer-social-youtube',  footer_instagram: 'footer-social-instagram',
    };
    Object.entries(socMap).forEach(([k, id]) => {
      if (s[k]) { const el = document.getElementById(id); if (el) el.href = s[k] || '#'; }
    });
    if (s.social_media && s.social_media.length) _applySocialMedia(s.social_media);

    // Legacy footer link URL cache
    const flinks = window._footerLinks || {};
    ['ai','devices','space','security','gaming','about','team','ads','privacy','contact',
     'newsletter','podcast','popular','archive','reports','terms','cookie','accessibility']
      .forEach(k => { if (s['flink-' + k]) flinks['flink-' + k] = s['flink-' + k]; });

    // Comments global toggle
    window._commentsEnabled = s.comments_enabled !== false;

    // Stats bar
    if (s.stats_bar && s.stats_bar.length) {
      s.stats_bar.forEach((stat, i) => {
        const vi = document.getElementById('stat-val-' + (i + 1));
        const li = document.getElementById('stat-lbl-' + (i + 1));
        if (vi && stat.val) vi.textContent = stat.val;
        if (li && stat.lbl) li.textContent = stat.lbl;
      });
    }

    // Dynamic nav, layout, identity, maintenance
    if (s.nav_menu && s.nav_menu.length) _applyNavMenu(s.nav_menu);
    _applyMaintenance(s.maintenance);
    if (s.layout)   _applyLayoutSettings(s.layout);
    if (s.identity) _applyIdentitySettings(s.identity);

    // Trending toggle
    window._trendingOff = s.trending_enabled === false;

    // Footer columns
    if (s.footer_company && s.footer_company.length) _applyFooterCol('footer-col-company', s.footer_company);
    if (s.footer_more    && s.footer_more.length)    _applyFooterCol('footer-col-more',    s.footer_more);

    // Section / newsletter text
    if (s.section_title)    { const e = document.getElementById('section-title-el');   if (e) e.textContent = s.section_title; }
    if (s.newsletter_title) { const e = document.getElementById('newsletter-title-el'); if (e) e.textContent = s.newsletter_title; }
    if (s.newsletter_sub)   { const e = document.getElementById('newsletter-sub-el');   if (e) e.textContent = s.newsletter_sub; }

    // Ad banners
    _applyAdBanner('top',    s.ad_top);
    _applyAdBanner('bottom', s.ad_bottom);
    _applyAdBanner('grid',   s.ad_grid);
    if (s.ad_allnews) { window._adAllnewsData = s.ad_allnews; _applyAdBanner('allnews', s.ad_allnews); }
    if (s.ad_article) window._adArticleData = s.ad_article;
    if (s.custom_banners) _applyCustomBanners(s.custom_banners);

    // If an article is open, refresh its interaction buttons + related news
    if (document.getElementById('article-page')?.style.display === 'block') {
      _applyInteractionToggles();
      if (window._currentArticle) renderSuggestedNews(window._currentArticle);
    }

    checkBreaking();
    _scheduleRender();
  }, err => console.warn('[FB] site:', err));
}

// ─────────────────────────────────────────────────────────────────
// PAGE INIT
// ─────────────────────────────────────────────────────────────────
(function init() {
  // Detect article hash for direct/shared links
  if (location.hash && location.hash.startsWith('#article-')) {
    const _hashId = location.hash.replace('#article-', '').split('?')[0];
    if (_hashId) window._pendingArticleId = _hashId;
  }

  // Apply saved user preferences immediately (no flash)
  if (localStorage.getItem('atq_theme') === 'light') {
    document.body.classList.add('light');
    const btn = document.getElementById('theme-btn');
    if (btn) { btn.textContent = '🌙 داكن'; btn.classList.add('active'); }
  }
  if (localStorage.getItem('atq_lang') === 'en') {
    document.body.classList.add('english');
    const langBtn = document.getElementById('lang-btn');
    if (langBtn) { langBtn.textContent = 'ع'; langBtn.classList.add('active'); }
  }

  // Instant render from localStorage cache (repeat visits only — first visit shows skeletons)
  if (_fb.news && _fb.news.length > 0) {
    const heroEl = document.querySelector('.hero-main');
    if (heroEl) { heroEl.classList.remove('loading'); heroEl.classList.add('loaded'); }
    renderSite();
    if (_fb.site) {
      const s = _fb.site;
      if (s.site_buttons) applySiteButtons(s.site_buttons);
      if (s.site_title)   document.querySelectorAll('.nav-logo-text').forEach(el => el.textContent = s.site_title);
      if (s.ticker_speed) { document.documentElement.style.setProperty('--ticker-speed', s.ticker_speed + 's'); applyTickerSpeed(s.ticker_speed); }
      if (s.ticker_visible === false) { const tk = document.querySelector('.ticker'); if (tk) tk.style.display = 'none'; }
      if (s.identity) _applyIdentitySettings(s.identity);
      if (s.layout)   _applyLayoutSettings(s.layout);
      if (s.nav_menu && s.nav_menu.length) _applyNavMenu(s.nav_menu);
      _applyMaintenance(s.maintenance);
    }
    if (_fb.breaking) checkBreaking();
    if (window._pendingArticleId && _fb.news) {
      const cached = _fb.news.find(x => String(x.id) === String(window._pendingArticleId));
      if (cached) setTimeout(() => openArticle(cached), 80);
    }
  }

  // Start ticker RAF (uses cache or waits for Firebase)
  _startTickerRAF();

  // Start Firebase real-time listeners
  startFirebaseListeners();

  // Safety timeout: if Firebase is slow (bad network / offline), render what we have
  setTimeout(() => {
    if (!_fb.news) { console.info('[Site] Firebase timeout — rendering with empty data'); renderSite(); }
  }, 3000);

  // Poll breaking bar every 10 s
  setInterval(checkBreaking, 10_000);
})();

// ─────────────────────────────────────────────────────────────────
// STORAGE EVENT — live sync (same browser, different tab)
// ─────────────────────────────────────────────────────────────────
window.addEventListener('storage', e => {
  // All shared data now via Firebase. Only user prefs in localStorage.
  void e; // no-op for now; kept for future use
});

// Manual refresh — can be triggered externally (e.g. admin panel)
window._siteRefresh = function () { renderSite(); checkBreaking(); };

// ================================================================
// GLOBAL SCOPE EXPOSURES
// ALL functions called from inline onclick= attributes or external
// scripts MUST be on window because <script type="module"> is scoped.
// ================================================================
window.clearCatFilter       = clearCatFilter;
window.closeAllNewsPage     = closeAllNewsPage;
window.closeArticle         = closeArticle;
window.closeBreaking        = closeBreaking;
window.closeContactModal    = closeContactModal;
window.filterByCat          = filterByCat;
window.liveSearch           = liveSearch;
window.navFilter            = navFilter;
window.openAllNewsPage      = openAllNewsPage;
window.openArticle          = openArticle;
window.openArticleFromEl    = openArticleFromEl;
window.openArticleFromWide  = openArticleFromWide;
window.openById             = openById;
window.openContactModal     = openContactModal;
window.openFooterLink       = openFooterLink;
window.openFooterNewWin     = openFooterNewWin;
window.renderAllNewsPage    = renderAllNewsPage;
window.renderSite           = renderSite;
window.renderSuggestedNews  = renderSuggestedNews;
window.scrollToTop          = scrollToTop;
window.scrollTrending       = scrollTrending;
window.shareArticle         = shareArticle;
window.showMoreNews         = showMoreNews;
window.submitComment        = submitComment;
window.submitContact        = submitContact;
window.subscribeNewsletter  = subscribeNewsletter;
window.toggleArticleLike    = toggleArticleLike;
window.loadLikeCountForArticle = loadLikeCountForArticle;
window.toggleBookmark       = toggleBookmark;
window.toggleLang           = toggleLang;
window.toggleMobileNav      = toggleMobileNav;
window.toggleTheme          = toggleTheme;

// CRITICAL: called from every nav link onclick="_closeMobileNav();navFilter(...)"
window._closeMobileNav      = _closeMobileNav;
window._toggleMobileSearch  = _toggleMobileSearch;
window._autoCollapseNav     = _autoCollapseNav;
window._renderScrollDots    = _renderScrollDots;
window.scrollSuggested      = scrollSuggested; // Fix 7: related news arrows
window._applyAdBanner       = _applyAdBanner;
