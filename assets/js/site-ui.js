// ================================================================
// assets/js/site-ui.js — UI controls & site-settings application
// theme toggle, lang toggle, mobile nav, scroll-to-top,
// contact modal, newsletter, footer links, nav menu, layout,
// identity, maintenance, social media, site buttons.
// ================================================================

import { _fb }                         from '/assets/js/site-state.js';
import { _applyAdBanner,
         _applyCustomBanners }          from '/assets/js/site-ads.js';
import { applyTickerSpeed }             from '/assets/js/site-ticker.js';
import { _applyInteractionToggles }     from '/assets/js/site-article.js';
import { getNewsData }                  from '/assets/js/site-state.js';
import { db }                           from '/modules/firebase.js';
import { collection, addDoc,
         serverTimestamp }              from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ─── THEME / LANGUAGE ────────────────────────────────────────────
export function toggleTheme() {
  document.body.classList.toggle('light');
  const isLight = document.body.classList.contains('light');
  const btn = document.getElementById('theme-btn');
  if (btn) { btn.textContent = isLight ? '🌙 داكن' : '🌙 فاتح'; btn.classList.toggle('active', isLight); }
  try { localStorage.setItem('atq_theme', isLight ? 'light' : 'dark'); } catch (_) { /* silent */ }
}

export function toggleLang() {
  document.body.classList.toggle('english');
  const isEn = document.body.classList.contains('english');
  const btn  = document.getElementById('lang-btn');
  if (btn) { btn.textContent = isEn ? 'ع' : 'EN'; btn.classList.toggle('active', isEn); }
  try { localStorage.setItem('atq_lang', isEn ? 'en' : 'ar'); } catch (_) { /* silent */ }
}

// ─── SITE BUTTONS VISIBILITY ─────────────────────────────────────
export function applySiteButtons(controls) {
  const visMap = {
    'search-box':        'search-box',
    'lang-btn':          'lang-btn',
    'theme-btn':         'theme-btn',
    'subscribe-btn':     'subscribe-btn',
    'stats-bar':         'stats-bar',
    'site-newsletter':   'site-newsletter',
    'site-hero':         'site-hero',
    'scroll-top':        'scroll-top',
    'cats-strip':        'cats-strip',
    'site-ticker':       'site-ticker',
    'site-footer':       'site-footer',
    'breaking-bar-wrap': 'breaking-bar',
  };
  Object.entries(visMap).forEach(([key, elId]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    if (controls[key] === false) {
      el.style.display = 'none';
    } else if (controls[key] === true || controls[key] === undefined) {
      if (el.style.display === 'none') el.style.display = '';
    }
  });
  if (controls['force-theme'] === 'light' && !document.body.classList.contains('light')) {
    document.body.classList.add('light');
  } else if (controls['force-theme'] === 'dark' && document.body.classList.contains('light')) {
    document.body.classList.remove('light');
  }
}

// ─── LAYOUT SETTINGS — hero/ad dimensions ───────────────────────
export function _applyLayoutSettings(layout) {
  if (!layout) return;
  const root = document.documentElement;
  const px = v => (v == null || v === '' || isNaN(v)) ? null : (Number(v) + 'px');
  const h  = px(layout.heroHeight);      if (h)  root.style.setProperty('--hero-height', h);
  const sw = px(layout.heroSideWidth);   if (sw) root.style.setProperty('--hero-side-width', sw);
  const stz = px(layout.heroSideThumbSize);
  root.style.setProperty('--sidebar-thumb-size', stz || '88px');
  if (layout.sidebarCatColored != null) window._sidebarCatColored = !!layout.sidebarCatColored;
  else                                   window._sidebarCatColored = true;
  window._sidebarCatShape = layout.sidebarCatShape || 'pill';
  ['top', 'bottom', 'grid', 'article', 'allnews'].forEach(slot => {
    const key = 'ad' + slot.charAt(0).toUpperCase() + slot.slice(1) + 'Height';
    const val = px(layout[key]);
    root.style.setProperty('--ad-' + slot + '-height', val || 'auto');
  });
  const newCount = Number(layout.heroSideCount) || 4;
  if (window._heroSideCount !== newCount) {
    window._heroSideCount = newCount;
    const stack = document.querySelector('.sidebar-stack');
    if (stack) stack.style.gridTemplateRows = 'repeat(' + newCount + ', 1fr)';
    if (typeof window.renderSite === 'function') setTimeout(window.renderSite, 10);
  }
}

// ─── IDENTITY — logo, brand name, favicon ───────────────────────
function _faviconMimeFromDataUrl(dataUrl) {
  const m = /^data:(image\/[^;]+)/.exec(dataUrl || '');
  return m ? m[1] : 'image/png';
}

export function _applyIdentitySettings(identity) {
  if (!identity) return;
  document.querySelectorAll('.nav-logo-icon').forEach(el => {
    if (identity.logoImage) {
      el.innerHTML = `<img src="${identity.logoImage}" alt="logo" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
      el.style.background = 'var(--dark-3)';
      el.style.color = '';
    } else if (identity.logoIcon) {
      el.innerHTML    = '';
      el.textContent  = identity.logoIcon;
      el.style.background = '';
      el.style.color      = '';
    }
  });
  document.querySelectorAll('.nav-logo-text').forEach(el => {
    if (identity.brandName) el.textContent = identity.brandName;
  });
  if (identity.brandName) {
    document.title       = identity.brandName;
    window._brandName    = identity.brandName;
  }
  const fav = document.getElementById('site-favicon');
  if (fav) {
    if (identity.logoImage) {
      fav.setAttribute('type', _faviconMimeFromDataUrl(identity.logoImage));
      fav.setAttribute('href', identity.logoImage);
    } else {
      const letter = (identity.logoIcon || 'ت').replace(/[<>&"']/g, '');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="%23C9A84C"/><text x="16" y="22" font-family="Tajawal,sans-serif" font-size="18" font-weight="900" text-anchor="middle" fill="%230D0D0F">${letter}</text></svg>`;
      fav.setAttribute('type', 'image/svg+xml');
      fav.setAttribute('href', 'data:image/svg+xml,' + encodeURIComponent(svg).replace(/%2523/g, '%23'));
    }
  }
}

// ─── MAINTENANCE MODE ─────────────────────────────────────────────
export function _applyMaintenance(m) {
  const overlay      = document.getElementById('maintenance-overlay');
  const contactNav   = document.getElementById('contact-nav-btn');
  const contactFloat = document.getElementById('contact-us-btn');
  if (!overlay) return;
  const active = !!(m && m.active);
  if (active) {
    const textEl = document.getElementById('maintenance-text');
    const imgEl  = document.getElementById('maintenance-image');
    if (textEl) textEl.textContent = m.text || 'الموقع تحت الصيانة... نعود قريباً';
    if (imgEl) {
      if (m.image) { imgEl.src = m.image; imgEl.style.display = 'block'; }
      else         { imgEl.src = '';      imgEl.style.display = 'none';  }
    }
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    if (contactFloat) {
      contactFloat.style.display    = 'flex';
      contactFloat.style.alignItems = 'center';
      contactFloat.style.gap        = '6px';
      contactFloat.style.zIndex     = '9100';
    }
    if (contactNav) contactNav.style.display = 'none';
  } else {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
    if (contactFloat) { contactFloat.style.display = ''; contactFloat.style.zIndex = ''; }
    if (contactNav)   { contactNav.style.display = ''; }
  }
}

// ─── DYNAMIC NAV MENU ─────────────────────────────────────────────
export function _closeMobileNav() {
  const links = document.getElementById('nav-links');
  if (links) links.classList.remove('mobile-open');
}

export function _applyNavMenu(items) {
  const ul = document.getElementById('nav-links');
  if (!ul || !items || !items.length) return;
  ul.innerHTML = items.map((item, i) => {
    let onclick = '';
    if      (item.type === 'home' || item.cat === 'الكل') onclick = "navFilter('الكل',this);return false;";
    else if (item.type === 'allnews')                      onclick = "openAllNewsPage();return false;";
    else if (item.type === 'url')                          onclick = "window.open('" + (item.cat || '#') + "','_blank','noopener');return false;";
    else                                                   onclick = "navFilter('" + (item.cat || item.label) + "',this);return false;";
    const isHome  = item.type === 'home' || i === 0;
    const idAttr  = isHome ? ' class="active" id="nav-all"'
                           : (item.type === 'allnews' ? ' id="nav-allnews"' : '');
    return '<li><a href="#"' + idAttr + ' onclick="_closeMobileNav();' + onclick + '">' + item.label + '</a></li>';
  }).join('');
  const contactLi = document.createElement('li');
  contactLi.className = 'nav-mobile-contact';
  contactLi.innerHTML = '<a href="#" onclick="_closeMobileNav();openContactModal();return false;" style="color:var(--gold) !important">✉️ تواصل معنا</a>';
  ul.appendChild(contactLi);
  if (typeof window._autoCollapseNav === 'function') setTimeout(window._autoCollapseNav, 50);
}

// ─── SOCIAL MEDIA ─────────────────────────────────────────────────
export function _applySocialMedia(socials) {
  const container = document.getElementById('footer-socials-dynamic');
  if (!container || !socials || !socials.length) return;
  const html = socials.map(s => {
    if (!s.name && !s.icon) return '';
    const href   = s.url && s.url.startsWith('http') ? s.url : '#';
    const target = s.url && s.url.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
    const fs     = s.icon && s.icon.length > 2 ? '11px' : '14px';
    return `<a class="social-btn" href="${href}"${target} title="${s.name || ''}" style="font-size:${fs}">${s.icon || '🔗'}</a>`;
  }).join('');
  if (html) container.innerHTML = html;
}

// ─── FOOTER COLUMN RENDERER ──────────────────────────────────────
const _footerLinks = {};
window._footerItems = window._footerItems || {};
// Expose to main.js for settings onSnapshot
window._footerLinks = _footerLinks;

export function _applyFooterCol(colId, items) {
  const ul = document.getElementById(colId);
  if (!ul || !items) return;
  const colTag = colId.replace(/^footer-col-/, '') || 'col';
  ul.innerHTML = items.filter(i => i.active !== false).map(item => {
    const customKey = 'footer-custom-' + colTag + '-' + (item.id || 0);
    window._footerItems[customKey] = item;
    let onclick;
    if (item.url && item.url.startsWith('http')) {
      window._footerLinks[customKey] = item.url;
      onclick = `window.open('${item.url}','_blank','noopener');return false`;
    } else if (item.url && item.url.startsWith('#filter:')) {
      onclick = `navFilter('${item.url.replace('#filter:', '')}',null);window.scrollTo({top:0,behavior:'smooth'});return false`;
    } else {
      onclick = `openFooterNewWin('${customKey}');return false`;
    }
    const icon = item.icon ? item.icon + ' ' : '';
    return `<li><a href="#" onclick="${onclick}">${icon}${item.label || ''}</a></li>`;
  }).join('');
}

export function openFooterNewWin(id) {
  const url = _footerLinks[id];
  if (url && url !== '#' && (url.startsWith('http') || url.startsWith('/'))) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  const cached = (window._footerItems && window._footerItems[id]) || null;
  let label, content, commentsEnabled = true;
  if (cached) {
    label           = cached.label || 'صفحة';
    content         = cached.content || `<p>محتوى صفحة <strong>${label}</strong> سيُضاف قريباً.</p>`;
    commentsEnabled = cached.commentsEnabled !== false;
  } else {
    const el = document.getElementById(id);
    label   = el ? el.textContent.trim() : id;
    content = `<p>محتوى صفحة <strong>${label}</strong> سيُضاف من لوحة التحكم في قسم إعدادات الفوتر.</p>`;
  }
  if (typeof window.openArticle === 'function') {
    window.openArticle({
      cat: 'الموقع', title: label,
      author: 'الأحداث التقنية', date: '', views: '٠',
      excerpt: '', content, commentsEnabled, thumbnail: '', isFooterPage: true,
    });
  }
}

export function openFooterLink(id) { openFooterNewWin(id); }

// ─── MOBILE NAV ───────────────────────────────────────────────────
export function toggleMobileNav() {
  const links = document.getElementById('nav-links');
  const btn   = document.getElementById('nav-hamburger');
  if (!links) return;
  const open = links.classList.toggle('mobile-open');
  if (btn) btn.style.opacity = open ? '1' : '';
  if (open) {
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!links.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
          links.classList.remove('mobile-open');
          document.removeEventListener('click', handler);
        }
      });
    }, 10);
  }
}

export function _toggleMobileSearch(ev) {
  if (window.innerWidth > 768) return;
  const box = document.getElementById('search-box');
  if (!box) return;
  if (box.classList.contains('mobile-expanded')) return;
  box.classList.add('mobile-expanded');
  const inp = box.querySelector('input');
  if (inp) setTimeout(() => inp.focus(), 50);
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!box.contains(e.target)) {
        box.classList.remove('mobile-expanded');
        if (inp) inp.value = '';
        document.removeEventListener('click', handler);
      }
    });
  }, 10);
  if (ev) ev.stopPropagation();
}

export function _autoCollapseNav() {
  const nav   = document.querySelector('nav');
  const logo  = nav ? nav.querySelector('.nav-logo') : null;
  const links = document.getElementById('nav-links');
  const right = nav ? nav.querySelector('.nav-right') : null;
  const hamb  = document.getElementById('nav-hamburger');
  if (!nav || !logo || !links || !right) return;
  document.body.classList.remove('nav-collapsed');
  links.style.visibility = 'hidden';
  links.classList.remove('mobile-open');
  links.style.display = 'flex';
  const navW  = nav.clientWidth;
  const logoW = logo.offsetWidth;
  const rightW = right.offsetWidth;
  let linksW = 0;
  links.querySelectorAll('li').forEach(li => { linksW += li.offsetWidth; });
  const needed = logoW + linksW + rightW + 80;
  links.style.visibility = '';
  links.style.display    = '';
  if (needed > navW) {
    document.body.classList.add('nav-collapsed');
  } else {
    document.body.classList.remove('nav-collapsed');
    links.classList.remove('mobile-open');
    if (hamb) hamb.style.opacity = '';
  }
}

// ─── SCROLL TO TOP ────────────────────────────────────────────────
const _scrollBtn = document.getElementById('scroll-top');

window.addEventListener('scroll', () => {
  const artOpen = document.getElementById('article-page')?.style.display === 'block';
  const anOpen  = document.getElementById('all-news-page')?.style.display === 'block';
  if (artOpen || anOpen) return;
  if (_scrollBtn) _scrollBtn.classList.toggle('visible', window.scrollY > 300);
});

document.getElementById('article-page')?.addEventListener('scroll', function () {
  if (_scrollBtn) _scrollBtn.classList.toggle('visible', this.scrollTop > 300);
});

document.getElementById('all-news-page')?.addEventListener('scroll', function () {
  if (_scrollBtn) _scrollBtn.classList.toggle('visible', this.scrollTop > 300);
});

export function scrollToTop() {
  const art = document.getElementById('article-page');
  const an  = document.getElementById('all-news-page');
  if (art && art.style.display === 'block') { art.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (an  && an.style.display  === 'block') { an.scrollTo({ top: 0, behavior: 'smooth' });  return; }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── AUTO-COLLAPSE NAV on load + resize ──────────────────────────
(function () {
  let t;
  const schedule = () => { clearTimeout(t); t = setTimeout(_autoCollapseNav, 80); };
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(_autoCollapseNav, 50);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(_autoCollapseNav, 50));
  }
  window.addEventListener('load',   () => setTimeout(_autoCollapseNav, 100));
  window.addEventListener('resize', schedule);
})();

// ─── NEWSLETTER SUBSCRIPTION ─────────────────────────────────────
export async function subscribeNewsletter() {
  const inp = document.getElementById('nl-email-input');
  const btn = document.getElementById('nl-submit-btn');
  if (!inp || !inp.value.trim()) { inp && inp.focus(); return; }
  const email = inp.value.trim().toLowerCase();
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    inp.style.borderColor = 'var(--red)';
    setTimeout(() => { inp.style.borderColor = ''; }, 2000);
    return;
  }
  if (btn) { btn.textContent = '⏳ جاري...'; btn.disabled = true; }
  try {
    await addDoc(collection(db, 'subscribers'), {
      email, subscribedAt: serverTimestamp(), source: 'newsletter',
    });
    inp.value = '';
    if (btn) { btn.textContent = '✅ تم الاشتراك!'; btn.style.background = 'var(--green)'; }
    setTimeout(() => {
      if (btn) { btn.textContent = 'اشترك الآن'; btn.style.background = ''; btn.disabled = false; }
    }, 3000);
  } catch (e) {
    console.error('Subscribe error:', e);
    if (btn) { btn.textContent = '⚠️ حدث خطأ'; btn.disabled = false; }
    setTimeout(() => { if (btn) btn.textContent = 'اشترك الآن'; }, 2000);
  }
}

// ─── CONTACT MODAL ────────────────────────────────────────────────
export function openContactModal() {
  const m = document.getElementById('contact-modal');
  if (m) {
    m.style.display = 'flex';
    document.getElementById('contact-success')?.style.setProperty('display', 'none');
    document.getElementById('contact-error')?.style.setProperty('display', 'none');
    setTimeout(() => document.getElementById('cf-name')?.focus(), 60);
  }
}

export function closeContactModal() {
  const m = document.getElementById('contact-modal');
  if (m) m.style.display = 'none';
}

export async function submitContact() {
  const get = id => (document.getElementById(id)?.value || '').trim();
  const name    = get('cf-name');
  const email   = get('cf-email');
  const mobile  = get('cf-mobile');
  const subject = get('cf-subject');
  const message = get('cf-message');
  const errEl   = document.getElementById('contact-error');
  const okEl    = document.getElementById('contact-success');
  const showErr = msg => {
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    if (okEl)  { okEl.style.display = 'none'; }
  };
  if (!name)    return showErr('⚠️ الرجاء إدخال الاسم');
  if (!email)   return showErr('⚠️ الرجاء إدخال البريد الإلكتروني');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr('⚠️ البريد الإلكتروني غير صالح');
  if (!message) return showErr('⚠️ الرجاء إدخال رسالتك');
  const btn = document.querySelector('.contact-submit-btn');
  if (btn) { btn.textContent = '⏳ جارٍ الإرسال...'; btn.disabled = true; }
  if (errEl) errEl.style.display = 'none';
  try {
    await addDoc(collection(db, 'contact_messages'), {
      name, email, mobile, subject, message,
      read: false, createdAt: serverTimestamp(), userAgent: navigator.userAgent || '',
    });
    ['cf-name', 'cf-email', 'cf-mobile', 'cf-subject', 'cf-message'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    if (okEl) okEl.style.display = 'block';
    if (btn) { btn.textContent = 'إرسال الرسالة'; btn.disabled = false; }
    setTimeout(closeContactModal, 2500);
  } catch (e) {
    console.error('Contact submit error:', e);
    showErr('⚠️ حدث خطأ. الرجاء المحاولة مرة أخرى.');
    if (btn) { btn.textContent = 'إرسال الرسالة'; btn.disabled = false; }
  }
}

// ─── KEYBOARD SHORTCUTS ──────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (typeof window.closeArticle === 'function') window.closeArticle();
    const anp = document.getElementById('all-news-page');
    if (anp && anp.style.display !== 'none') {
      if (typeof window.closeAllNewsPage === 'function') window.closeAllNewsPage();
    }
  }
});

// ─── POPSTATE (browser back button) ──────────────────────────────
window.addEventListener('popstate', () => {
  const page = document.getElementById('article-page');
  if (page && page.style.display === 'block') {
    page.style.display = 'none';
    document.body.style.overflow = '';
    window.scrollTo({ top: window._scrollPos || 0, behavior: 'smooth' });
  }
});

// ─── EVENT DELEGATION — card clicks without inline onclick ───────
document.addEventListener('click', function (e) {
  const card = e.target.closest('.news-card, .sidebar-card, .wide-card, .hero-main');
  if (!card) return;
  if (card.getAttribute('onclick')) return; // let inline handler run
  e.preventDefault(); e.stopPropagation();
  const all = getNewsData();
  const pub = all.filter(n => n.status === 'منشور');
  if (!pub.length) return;
  const openArt = n => { if (typeof window.openArticle === 'function') window.openArticle(n); };
  if (card.classList.contains('hero-main'))  { if (typeof window.openArticleFromEl   === 'function') window.openArticleFromEl(card);  return; }
  if (card.classList.contains('wide-card'))  { if (typeof window.openArticleFromWide === 'function') window.openArticleFromWide(card); return; }
  if (card.classList.contains('sidebar-card')) {
    const cards    = Array.from(document.querySelectorAll('.sidebar-card'));
    const idx      = cards.indexOf(card);
    const hero     = pub.find(n => n.priority === 'عاجل') || pub[pub.length - 1] || pub[0];
    const sideItems = pub.filter(n => n !== hero);
    openArt(sideItems[idx] || pub[idx] || pub[0]);
    return;
  }
  if (card.classList.contains('news-card')) {
    const grid  = card.closest('.news-grid');
    if (!grid) return;
    const cards     = Array.from(grid.querySelectorAll('.news-card'));
    const idx       = cards.indexOf(card);
    const hero      = pub.find(n => n.priority === 'عاجل') || pub[pub.length - 1] || pub[0];
    const pinnedId  = _fb.site ? _fb.site.wide_pinned : null;
    const feat      = (pinnedId ? pub.find(n => String(n.id) === String(pinnedId)) : null)
                   || pub.find(n => n.priority === 'مميز' && n !== hero) || pub[1] || pub[0];
    const gridItems = pub.filter(n => n !== hero && n !== feat);
    openArt(gridItems[idx] || pub[0]);
  }
}, true); // capture phase

// ─── MOBILE MENU — close on nav link click ───────────────────────
document.addEventListener('click', function (e) {
  const link = e.target.closest('#nav-links a');
  if (link) {
    const links = document.getElementById('nav-links');
    if (links && links.classList.contains('mobile-open')) {
      links.classList.remove('mobile-open');
    }
  }
});

// ─── SMOOTH IMAGE LOADING ────────────────────────────────────────
document.addEventListener('load', function (e) {
  if (e.target.tagName === 'IMG') e.target.classList.add('loaded');
}, true);
document.querySelectorAll('img').forEach(img => {
  if (img.complete) img.classList.add('loaded');
});
