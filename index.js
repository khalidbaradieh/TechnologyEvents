import { FIREBASE_CONFIG, DB, VERSION } from '../../config.js';
import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, doc, onSnapshot, addDoc, serverTimestamp }
         from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const _fbApp = initializeApp(FIREBASE_CONFIG);
const _db    = getFirestore(_fbApp);

// ── in-memory Firebase cache (replaces localStorage reads for shared data) ──
let _fb = {
  news:     null,
  latest:   null,
  breaking: null,
  site:     null,
  cats:     null,
};


// ═══════════════════════════════════════════════════════════════
// GLOBAL ARTICLE STORE — safe click handling without JSON in HTML
// ═══════════════════════════════════════════════════════════════
window._store = {};

function _reg(n) { window._store[n.id] = n; return n; }

// Strip HTML tags (used for cards where excerpt should display as plain text,
// so rich formatting from the admin RTE doesn't render as literal "<b>..." characters).
function _stripTags(html) {
  if (!html) return '';
  // Handle both plain text (no tags) and HTML safely
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html);
  return (tmp.textContent || tmp.innerText || '').trim();
}

function openById(id) {
  const n = window._store[id];
  if (n) openArticle(n);
  else {
    const all = getNewsData();
    const found = all.find(x => String(x.id) === String(id));
    if (found) openArticle(found);
  }
}

// ═══════════════════════════════════════════════════════════════
// STATIC DEFAULT NEWS
// ═══════════════════════════════════════════════════════════════
const STATIC_NEWS = [
  {id:1,  title:'GPT-5 يُحقق أداءً يفوق البشر في 87% من الاختبارات', cat:'الذكاء الاصطناعي', author:'أحمد الرشيدي',    date:'٢٠٢٥/٠٤/٠٥', views:'٢٤,٥٠٠', status:'منشور', priority:'عاجل',  excerpt:'أعلنت شركة OpenAI عن إطلاق نموذجها الجديد GPT-5 الذي يمثل قفزة نوعية في معالجة اللغة الطبيعية.'},
  {id:2,  title:'كيف ستُعيد الروبوتات رسم ملامح سوق العمل العالمي',  cat:'الذكاء الاصطناعي', author:'د. سارة المنصوري', date:'٢٠٢٥/٠٤/٠٤', views:'١٨,٢٠٠', status:'منشور', priority:'مميز',  excerpt:'تقرير شامل حول تأثير الأتمتة والذكاء الاصطناعي على مئات الملايين من الوظائف.'},
  {id:3,  title:'ناسا تعلن اكتشاف مواد عضوية على سطح المريخ',        cat:'الفضاء والعلوم',   author:'خالد العتيبي',    date:'٢٠٢٥/٠٤/٠٤', views:'١٢,٧٠٠', status:'منشور', priority:'عادي',  excerpt:'اكتشاف يعيد رسم خارطة البحث عن الحياة في الفضاء الخارجي.'},
  {id:4,  title:'بطارية CATL توفر شحناً كاملاً في ٥ دقائق',          cat:'السيارات الكهربائية',author:'منى الزهراني',   date:'٢٠٢٥/٠٤/٠٣', views:'٩,٤٠٠',  status:'منشور', priority:'عادي',  excerpt:'تقنية ثورية تنهي أزمة شحن السيارات الكهربائية نهائياً.'},
  {id:5,  title:'هجوم إلكتروني ضخم يستهدف المصارف الأوروبية',        cat:'الأمن الرقمي',     author:'عمر الحسيني',    date:'٢٠٢٥/٠٤/٠٢', views:'٧,٨٠٠',  status:'منشور', priority:'عاجل',  excerpt:'موجة هجمات تستخدم أدوات ذكاء اصطناعي لتجاوز أنظمة الحماية.'},
  {id:6,  title:'آبل تختبر iPhone بشاشة قابلة للطي',                  cat:'الهواتف والأجهزة', author:'فيصل الدوسري',   date:'٢٠٢٥/٠٤/٠١', views:'٦,٢٠٠',  status:'منشور', priority:'عادي',  excerpt:'صور مسربة تكشف عن نموذج أولي من آيفون قابل للطي.'},
  {id:7,  title:'PlayStation 6 رسمياً بقدرات 8K',                     cat:'ألعاب الفيديو',    author:'نورة السبيعي',   date:'٢٠٢٥/٠٣/٣١', views:'٥,١٠٠',  status:'منشور', priority:'عادي',  excerpt:'سوني تعلن تفاصيل الجيل القادم من أقوى أجهزة الألعاب.'},
  {id:8,  title:'ذكاء اصطناعي يكتشف علاجاً لنوع نادر من السرطان',    cat:'التقنية الحيوية',  author:'رنا أبو عيشة',   date:'٢٠٢٥/٠٣/٣٠', views:'٤,٨٠٠',  status:'منشور', priority:'عادي',  excerpt:'DeepMind يقصّر عملية البحث الدوائي من سنوات إلى أيام.'},
  {id:9,  title:'SpaceX تطلق Starship في رحلة المدار الأرضي',         cat:'الفضاء والعلوم',   author:'خالد العتيبي',   date:'٢٠٢٥/٠٣/٢٩', views:'٣,٩٠٠',  status:'منشور', priority:'مميز',  excerpt:'الرحلة الخامسة للصاروخ العملاق نحو المدار.'},
  {id:10, trending:true, title:'سامسونج تكشف Galaxy S25 Ultra بكاميرا 200 ميجابيكسل',cat:'الهواتف والأجهزة',author:'فيصل الدوسري',   date:'٢٠٢٥/٠٣/٢٨', views:'٨,١٠٠',  status:'منشور', priority:'مميز',  excerpt:'الجيل الجديد بمزايا ذكاء اصطناعي متكاملة.'},
  {id:11, title:'تسلا تختبر روبوت Optimus في مصانعها',                 cat:'الروبوتات',        author:'منى الزهراني',   date:'٢٠٢٥/٠٣/٢٧', views:'٦,٣٠٠',  status:'منشور', priority:'عادي',  excerpt:'الروبوت المصمم للعمل جنباً إلى جنب مع الإنسان في الإنتاج.'},
  {id:12, title:'آبل تتجاوز تقييم 4 تريليون دولار للمرة الأولى',      cat:'الشركات والأعمال',author:'أحمد الرشيدي',   date:'٢٠٢٥/٠٣/٢٦', views:'١١,٠٠٠', status:'منشور', priority:'مميز',  excerpt:'الشركة تسجل رقماً قياسياً في تاريخ أسواق المال.'},
];

function getNewsData() {
  const data = (_fb.news && _fb.news.length > 0) ? _fb.news : STATIC_NEWS;
  // Overlay any local view counts accumulated from reader engagement
  return (typeof _mergeLocalViewCounts === 'function') ? _mergeLocalViewCounts(data) : data;
}

// ═══════════════════════════════════════════════════════════════
// CAT META
// ═══════════════════════════════════════════════════════════════
const CAT_META = {
  'الذكاء الاصطناعي':    {bg:'linear-gradient(135deg,#0d1b2a,#1b3a5e)', icon:'🤖', cls:'tag-blue'},
  'الهواتف والأجهزة':    {bg:'linear-gradient(135deg,#0a1a2a,#0d3a5c)', icon:'📱', cls:'tag-blue'},
  'الفضاء والعلوم':      {bg:'linear-gradient(135deg,#1a0533,#2d1060)', icon:'🚀', cls:'tag-purple'},
  'الأمن الرقمي':        {bg:'linear-gradient(135deg,#2a0a0a,#5c1515)', icon:'🛡️', cls:'tag-red'},
  'الشركات والأعمال':    {bg:'linear-gradient(135deg,#1a1a0a,#3d3a10)', icon:'💼', cls:'tag-gold'},
  'ألعاب الفيديو':       {bg:'linear-gradient(135deg,#1a1a0a,#3d3d10)', icon:'🎮', cls:'tag-gold'},
  'السيارات الكهربائية': {bg:'linear-gradient(135deg,#0a2a1a,#0d5c30)', icon:'🔋', cls:'tag-green'},
  'الروبوتات':           {bg:'linear-gradient(135deg,#0a2a1a,#0d5c30)', icon:'🦾', cls:'tag-green'},
  'التقنية الحيوية':     {bg:'linear-gradient(135deg,#1a0a2a,#3d1060)', icon:'🧬', cls:'tag-purple'},
};
function catMeta(cat) {
  return CAT_META[cat] || {bg:'linear-gradient(135deg,#1a1a2e,#16213e)', icon:'📰', cls:'tag-gold'};
}

// ═══════════════════════════════════════════════════════════════
// ARTICLE PAGE
// ═══════════════════════════════════════════════════════════════
function calcReadTime(text) {
  const words = (text||'').replace(/<[^>]+>/g,'').split(/\s+/).length;
  const mins  = Math.max(1, Math.ceil(words / 200));
  return mins + ' دقائق قراءة';
}

function openArticle(article) {
  if (!article) return;
  // Close all-news page if open
  const anp = document.getElementById('all-news-page');
  if (anp && anp.style.display !== 'none') { anp.style.display = 'none'; document.body.style.overflow = ''; }
  const m = catMeta(article.cat);
  document.getElementById('article-cat').textContent           = article.cat || '';
  document.getElementById('article-title').textContent         = article.title || '';
  // Summary/excerpt: render as HTML since admin supports rich formatting (bold, italic, color)
  const summEl = document.getElementById('article-summary');
  if (summEl) {
    const raw = article.excerpt || '';
    // Only show when there is actual content (strip tags to check for real text)
    const hasText = raw.replace(/<[^>]*>/g, '').trim().length > 0;
    if (hasText) {
      summEl.innerHTML = raw;
      summEl.style.display = '';
    } else {
      summEl.innerHTML = '';
      summEl.style.display = 'none';
    }
  }
  document.getElementById('article-topbar-title').textContent  = article.title || '';
  const readTime = calcReadTime((article.content||'') + (article.excerpt||''));
  const views    = article.views || '٠';
  const showAuthor = article.showAuthor !== false;
  const showDate   = article.showDate   !== false;
  const showViews  = article.showViews  !== false;
  document.getElementById('article-meta').innerHTML =
    `${showAuthor ? `<span>✍️ ${article.author||''}</span>` : ''}
     ${showDate   ? `<span>🕐 ${article.date||''}</span>`   : ''}
     ${showViews  ? `<span class="views-pill">👁 ${views}</span>` : ''}
     <span class="read-time">⏱ ${readTime}</span>`;
  const img = document.getElementById('article-hero-img');
  if (article.thumbnail) {
    img.style.background = 'none';
    img.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}" style="width:100%;height:100%;object-fit:cover">`;
  } else {
    img.style.background = m.bg;
    img.innerHTML = `<span style="font-size:80px">${m.icon}</span>`;
  }
  document.getElementById('article-body').innerHTML = buildArticleBody(article);
  // Show/hide comments section
  const commSec = document.getElementById('article-comments-section');
  if (commSec) {
    const globalOn = _commentsEnabled;
    const articleOn = article.commentsEnabled !== false;
    commSec.style.display = (globalOn && articleOn) ? 'block' : 'none';
    // Clear previous comments list
    const cList = document.getElementById('comments-list');
    if (cList) cList.innerHTML = '';
  }
  window._scrollPos = window.scrollY;
  window._currentArticle = article;
  // Give each article its own URL so users can copy + share it
  const _artHash = '#article-' + (article.id || Date.now());
  history.pushState({art:true, id:article.id}, '', location.pathname + _artHash);
  // Update dynamic SEO / OG tags so social shares show this article's info
  _updateArticleMetaTags(article);
  // Increment view counter (also saves back to Firebase)
  _incrementArticleViews(article);
  const page = document.getElementById('article-page');
  page.style.display = 'block';
  page.scrollTop = 0;
  document.body.style.overflow = 'hidden';
  // Show reading progress bar
  const prog = document.getElementById('reading-progress');
  if (prog) prog.style.display = 'block';
  page.addEventListener('scroll', _updateProgress, {passive:true});
  // Article ad banner — read directly from Firebase cache for reliability
  _applyAdBanner('article', (_fb.site && _fb.site.ad_article) || window._adArticleData);
  // Update bookmark button state
  _updateBookmarkBtn(article);
  // Footer pages (about us, company info, privacy, etc.) — hide interactions + related news
  const interactBar = document.getElementById('article-interactions');
  const suggestedWrap = document.getElementById('article-suggested');
  if (article.isFooterPage) {
    if (interactBar)   interactBar.style.display = 'none';
    if (suggestedWrap) suggestedWrap.style.display = 'none';
  } else {
    if (interactBar)   interactBar.style.display = '';
    // Apply admin's per-button interaction toggles (hide disabled buttons)
    _applyInteractionToggles();
    // Refresh like button (counter + liked-by-me state)
    _refreshLikeUI();
    // Render related-news cards (trending-style)
    renderSuggestedNews(article);
  }
}

// ─── DYNAMIC SEO / OPEN GRAPH TAGS ────────────────────────────────────
// Update meta tags when an article opens so WhatsApp/X/LinkedIn previews
// show the current article's title, excerpt, and hero image.
function _updateArticleMetaTags(article) {
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

// Reset meta tags to site defaults when leaving an article
function _resetArticleMetaTags() {
  const brand = (window._brandName || document.title || 'الأحداث التقنية').split(' — ')[0];
  const defaultDesc = 'منصة إخبارية عربية متخصصة في أحدث أخبار التكنولوجيا والذكاء الاصطناعي والابتكار الرقمي';
  document.title = brand;
  const set = (id, attr, val) => {
    const el = document.getElementById(id); if (el) el.setAttribute(attr, val);
  };
  set('meta-description', 'content', defaultDesc);
  set('og-type',          'content', 'website');
  set('og-title',         'content', brand);
  set('og-description',   'content', defaultDesc);
  set('og-image',         'content', '');
  set('tw-title',         'content', brand);
  set('tw-description',   'content', defaultDesc);
  set('tw-image',         'content', '');
}

// ─── ARTICLE VIEW COUNTER ────────────────────────────────────────────
// Increments `views` on the article and writes back to Firebase so the
// "🔥 trending" section's view-count fallback reflects real readership.
// Client-only counting — double-counts between devices are acceptable at this scale.
const _VIEWED_KEY = 'atq_viewed_articles';
function _incrementArticleViews(article) {
  if (!article || !article.id) return;
  try {
    // Optional: avoid double-counting within same session (comment out for total counts)
    const viewed = JSON.parse(sessionStorage.getItem(_VIEWED_KEY) || '[]');
    if (viewed.indexOf(String(article.id)) !== -1) return;
    viewed.push(String(article.id));
    sessionStorage.setItem(_VIEWED_KEY, JSON.stringify(viewed));
  } catch(_) {}
  // Parse current views (may be Arabic-Indic digits)
  const toWestern = s => String(s||'0').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const cur = parseInt(toWestern(article.views).replace(/[^\d]/g,'')) || 0;
  const next = cur + 1;
  // Format: keep thousands as k, millions as م
  let formatted;
  if (next >= 1000000)      formatted = (next/1000000).toFixed(1).replace('.0','') + 'م';
  else if (next >= 1000)    formatted = (next/1000).toFixed(1).replace('.0','') + 'ألف';
  else                      formatted = String(next);
  // Convert to Arabic-Indic digits for display
  const toArabic = s => String(s).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
  article.views = toArabic(formatted);
  article._viewsRaw = next;
  // Update visible views pill
  const viewsPill = document.querySelector('#article-meta .views-pill');
  if (viewsPill) viewsPill.textContent = '👁 ' + article.views;
  // Persist counts locally so trending section picks up real-world popularity.
  // (Firebase writes from the public site aren't available — admins publish only.)
  try {
    const counts = JSON.parse(localStorage.getItem('atq_view_counts') || '{}');
    counts[String(article.id)] = next;
    localStorage.setItem('atq_view_counts', JSON.stringify(counts));
  } catch(_) {}
}

// Apply accumulated view counts from localStorage on top of Firebase data
function _mergeLocalViewCounts(newsList) {
  if (!Array.isArray(newsList)) return newsList;
  let counts = {};
  try { counts = JSON.parse(localStorage.getItem('atq_view_counts') || '{}'); } catch(_) {}
  const toArabic = s => String(s).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
  const toWestern = s => String(s||'0').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  newsList.forEach(n => {
    if (!n || !n.id) return;
    const local = counts[String(n.id)];
    if (!local) return;
    const cur = parseInt(toWestern(n.views).replace(/[^\d]/g,'')) || 0;
    if (local > cur) {
      let f;
      if (local >= 1000000)   f = (local/1000000).toFixed(1).replace('.0','') + 'م';
      else if (local >= 1000) f = (local/1000).toFixed(1).replace('.0','') + 'ألف';
      else                    f = String(local);
      n.views = toArabic(f);
    }
  });
  return newsList;
}

function buildArticleBody(a) {
  if (a.content && a.content.trim() && a.content.trim() !== '<br>') return a.content;
  return `<p>${a.excerpt||a.title||''}</p>
    <p>تُعدّ هذه التطورات من أبرز ما شهده قطاع التكنولوجيا خلال الفترة الأخيرة، إذ تفتح آفاقاً جديدة أمام الباحثين والمطورين.</p>
    <h2>التفاصيل الكاملة</h2>
    <p>تشير التقارير إلى أن هذا الإنجاز جاء بعد شهور من العمل المتواصل مع استثمارات ضخمة في البنية التحتية.</p>
    <blockquote>"هذا التطور يمثل نقلة نوعية حقيقية في مسيرة الابتكار التقني."</blockquote>
    <p>ويرى المحللون أن التداعيات ستكون واسعة النطاق على مستوى الصناعة العالمية.</p>`;
}

function closeArticle() {
  const page = document.getElementById('article-page');
  if (page.style.display !== 'block') return;
  page.style.display = 'none';
  document.body.style.overflow = '';
  const prog = document.getElementById('reading-progress');
  if (prog) { prog.style.display='none'; prog.style.transform='scaleX(0)'; }
  page.removeEventListener('scroll', _updateProgress);
  history.replaceState(null, '', location.pathname);
  // Restore site-wide meta tags
  if (typeof _resetArticleMetaTags === 'function') _resetArticleMetaTags();
  window.scrollTo({top: window._scrollPos||0, behavior:'smooth'});
}

window.addEventListener('popstate', () => {
  const page = document.getElementById('article-page');
  if (page.style.display === 'block') {
    page.style.display = 'none';
    document.body.style.overflow = '';
    window.scrollTo({top: window._scrollPos||0, behavior:'smooth'});
  }
});

document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeArticle(); const anp = document.getElementById('all-news-page'); if(anp && anp.style.display!=='none') closeAllNewsPage(); } });

function shareArticle(platform) {
  const art = window._currentArticle || {};
  const title = encodeURIComponent(art.title || document.title);
  const url   = encodeURIComponent(location.href); // includes #article-{id} for direct sharing
  const urls  = {
    twitter:  `https://twitter.com/intent/tweet?text=${title}&url=${url}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    whatsapp: `https://wa.me/?text=${title}%20${url}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
  };
  if (platform === 'copy') {
    navigator.clipboard?.writeText(location.href).then(() => {
      const btn = document.getElementById('copy-link-btn');
      if(btn){ btn.textContent='✅ تم النسخ'; setTimeout(()=>btn.textContent='📎 نسخ الرابط',2000); }
    });
    return;
  }
  // "native" = general Share: use the OS share sheet when available, fall back to copy
  if (platform === 'native') {
    if (navigator.share) {
      navigator.share({ title: art.title || document.title, url: location.href }).catch(()=>{});
    } else {
      shareArticle('copy');
    }
    return;
  }
  if (urls[platform]) window.open(urls[platform],'_blank','noopener');
}

// ─── ARTICLE LIKES ─────────────────────────────────────────────────
// Like counts are stored locally (localStorage) per-article since the public
// site is read-only on Firebase. Each visitor can toggle their own like.
function _likeCountsMap() {
  try { return JSON.parse(localStorage.getItem('atq_likes') || '{}'); } catch(_) { return {}; }
}
function _likedByMe() {
  try { return JSON.parse(localStorage.getItem('atq_liked_by_me') || '{}'); } catch(_) { return {}; }
}
function _saveLikesMap(m)  { try { localStorage.setItem('atq_likes', JSON.stringify(m)); } catch(_){} }
function _saveLikedByMe(m) { try { localStorage.setItem('atq_liked_by_me', JSON.stringify(m)); } catch(_){} }

function _toArabicDigits(n) {
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}
function _fmtLikeCount(n) {
  if (n >= 1000000) return _toArabicDigits((n/1000000).toFixed(1).replace('.0','')) + 'م';
  if (n >= 1000)    return _toArabicDigits((n/1000).toFixed(1).replace('.0','')) + 'ألف';
  return _toArabicDigits(n);
}
function _refreshLikeUI() {
  const art = window._currentArticle;
  if (!art) return;
  const counts = _likeCountsMap();
  const mine   = _likedByMe();
  const n = counts[String(art.id)] || 0;
  const btn = document.getElementById('like-btn');
  const lc  = document.getElementById('like-count');
  if (lc)  lc.textContent = _fmtLikeCount(n);
  if (btn) btn.classList.toggle('liked', !!mine[String(art.id)]);
}
function toggleArticleLike() {
  const art = window._currentArticle;
  if (!art || !art.id) return;
  const key = String(art.id);
  const counts = _likeCountsMap();
  const mine   = _likedByMe();
  if (mine[key]) {
    counts[key] = Math.max(0, (counts[key] || 1) - 1);
    delete mine[key];
  } else {
    counts[key] = (counts[key] || 0) + 1;
    mine[key] = true;
  }
  _saveLikesMap(counts);
  _saveLikedByMe(mine);
  _refreshLikeUI();
}

// ─── APPLY ADMIN'S PER-BUTTON INTERACTION TOGGLES ──────────────────
function _applyInteractionToggles() {
  const bar = document.getElementById('article-interactions');
  if (!bar) return;
  const settings = (_fb && _fb.site && _fb.site.interactions) || {};
  const labels   = (_fb && _fb.site && _fb.site.interaction_labels) || {};
  bar.querySelectorAll('[data-int]').forEach(btn => {
    const key = btn.getAttribute('data-int');
    const enabled = settings[key] !== false; // default ON
    btn.style.display = enabled ? '' : 'none';
    // If admin customized the label/emoji for this button, apply it.
    // Preserve inner <span id="like-count"> for the like button by only replacing text nodes.
    const custom = labels[key];
    if (custom && typeof custom === 'string' && key !== 'like') {
      btn.textContent = custom;
    } else if (custom && key === 'like') {
      // Like button — keep the counter span
      const countHtml = document.getElementById('like-count')?.outerHTML || '<span id="like-count">٠</span>';
      btn.innerHTML = custom + ' ' + countHtml;
    }
  });
  // Related news toggle
  window._relatedEnabled = settings.related !== false;
  // Related news count (with default fallback)
  window._relatedCount = Number((_fb && _fb.site && _fb.site.related_count)) || 8;
}

function _updateProgress() {
  const page = document.getElementById('article-page');
  const prog = document.getElementById('reading-progress');
  if (!page || !prog) return;
  const max  = page.scrollHeight - page.clientHeight;
  const pct  = max > 0 ? page.scrollTop / max : 0;
  prog.style.transform = `scaleX(${pct})`;
}

// ═══════════════════════════════════════════════════════════════
// SCROLL TO TOP (works in main page, article overlay, AND all-news overlay)
// ═══════════════════════════════════════════════════════════════
const _scrollBtn = document.getElementById('scroll-top');

window.addEventListener('scroll', () => {
  // Only react to window scroll when no overlay is open
  const artOpen = document.getElementById('article-page').style.display === 'block';
  const anOpen  = document.getElementById('all-news-page')?.style.display === 'block';
  if (artOpen || anOpen) return;
  _scrollBtn.classList.toggle('visible', window.scrollY > 300);
});

document.getElementById('article-page').addEventListener('scroll', function() {
  _scrollBtn.classList.toggle('visible', this.scrollTop > 300);
});

// Also listen on the all-news overlay so the button appears while scrolling it
const _anPage = document.getElementById('all-news-page');
if (_anPage) {
  _anPage.addEventListener('scroll', function() {
    _scrollBtn.classList.toggle('visible', this.scrollTop > 300);
  });
}

function scrollToTop() {
  const art = document.getElementById('article-page');
  const an  = document.getElementById('all-news-page');
  if (art && art.style.display === 'block') { art.scrollTo({top:0, behavior:'smooth'}); return; }
  if (an  && an.style.display  === 'block') { an.scrollTo({top:0, behavior:'smooth'});  return; }
  window.scrollTo({top:0, behavior:'smooth'});
}

// ═══════════════════════════════════════════════════════════════
// BREAKING BAR
// ═══════════════════════════════════════════════════════════════
let _breakTimer = null;

function checkBreaking() {
  const _bs   = _fb.site || {};
  const isOn  = _bs.breaking_active === true || _bs.breaking_active === '1';
  const start = parseInt(_bs.breaking_start || '0');
  const dur   = parseInt(_bs.breaking_duration || '300');
  const bar   = document.getElementById('breaking-bar');

  if (!isOn || !start) { bar.classList.remove('visible'); clearTimeout(_breakTimer); return; }

  const elapsed = Math.floor((Date.now() - start) / 1000);
  if (elapsed >= dur) {
    bar.classList.remove('visible');
    // breaking expired — handled by admin panel
    return;
  }

  let data = _fb.breaking || [];
  const active = data.filter(b => b.active === true);
  if (!active.length) { bar.classList.remove('visible'); return; }

  // Each active breaking news gets its own row
  const breakingContainer = document.getElementById('breaking-text');
  breakingContainer.innerHTML = active.map(b => `
    <div class="breaking-row">
      <div class="breaking-label" style="flex-shrink:0">
        <div class="breaking-pulse"></div>
        عاجل
      </div>
      <div style="flex:1;color:white;font-size:14px;font-weight:700;padding:0 16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.text}</div>
    </div>`).join('');
  bar.classList.add('visible');

  clearTimeout(_breakTimer);
  _breakTimer = setTimeout(() => {
    bar.classList.remove('visible');
    localStorage.setItem('atq_breaking_active','0');
  }, (dur - elapsed) * 1000);
}

function closeBreaking() {
  document.getElementById('breaking-bar').classList.remove('visible');
  clearTimeout(_breakTimer);
  localStorage.setItem('atq_breaking_active','0');
  localStorage.removeItem('atq_breaking_start');
}

// ═══════════════════════════════════════════════════════════════
// SITE RENDER
// ═══════════════════════════════════════════════════════════════
function renderSite() {
  const all = getNewsData();
  all.forEach(n => _reg(n));               // register all in store

  // Latest ticker — RAF-based seamless scroll (Arabic: left → right)
  let latest = _fb.latest || [];
  const activeTicker = latest.filter(l => l.status === 'نشط');
  const tickerInner = document.querySelector('.ticker-inner');
  if (tickerInner && activeTicker.length > 0) {
    // Only rebuild + restart if content actually changed (prevents speed reset on every Firebase update)
    const newContent = activeTicker.map(l => l.text).join('|');
    if (newContent !== _tickerLastContent) {
      _tickerLastContent = newContent;
      // Build spans: if the ticker item text matches a published article title, make it clickable
      const pubIndex = {};
      all.filter(n => n.status === 'منشور').forEach(n => {
        if (n.title) pubIndex[n.title.trim()] = n.id;
      });
      const spanHtml = l => {
        const txt = (l.text || '').trim();
        const matchId = pubIndex[txt];
        if (matchId) {
          return `<span class="ticker-item-clickable" data-id="${matchId}" style="cursor:pointer">${l.text}</span>`;
        }
        return `<span>${l.text}</span>`;
      };
      tickerInner.innerHTML = [...activeTicker, ...activeTicker].map(spanHtml).join('');
      // Delegate clicks (works even though items move via transform)
      tickerInner.onclick = function(e) {
        const t = e.target.closest('.ticker-item-clickable');
        if (t && t.dataset.id) openById(Number(t.dataset.id));
      };
      _tickerPos = 0; // reset position only when content changes
      _startTickerRAF();
    }
  }

  checkBreaking();

  const pub = all.filter(n => n.status === 'منشور');
  if (!pub.length) {
    // No published news — ensure static cards still have onclick as fallback
    document.querySelectorAll('.news-card:not([data-bound]), .sidebar-card:not([data-bound])').forEach(card => {
      card.style.cursor = 'pointer';
      card.setAttribute('data-bound','1');
      const idx = parseInt(card.dataset.idx || '0');
      const staticPub = all.length ? all : STATIC_NEWS;
      card.addEventListener('click', () => { if(staticPub[idx]) openArticle(staticPub[idx]); });
    });
    return;
  }

  // ── PRIORITY LOGIC ──────────────────────────────────────────────
  // 1. عاجل            → always takes the hero spot (first عاجل found, newest first)
  // 2. مميز            → fills hero if no عاجل (latest مميز first), then fills sidebar
  // 3. ابرز المقالات   → reserved for wide featured card below hero
  // 4. trending        → shown in trending scroller (but also eligible for sidebar/grid)
  // 5. عادي            → fills remaining sidebar slots after مميز
  // Section filters — a single news item can appear in multiple sections via
  // the alsoBreaking/alsoFeatured/alsoHero flags in addition to its primary priority.
  const urgentNews  = pub.filter(n => n.priority === 'عاجل'  || n.alsoBreaking);
  const featNews    = pub.filter(n => n.priority === 'مميز'  || n.alsoFeatured);
  const heroCands   = pub.filter(n => n.priority === 'عاجل'  || n.alsoHero);
  const normalNews  = pub.filter(n => n.priority !== 'عاجل' && n.priority !== 'مميز' && n.priority !== 'ابرز المقالات');

  // Hero: عاجل or alsoHero-flagged first; then latest مميز; fallback to latest normal
  const hero = heroCands[0] || featNews[0] || pub[0];
  const heroEl = document.querySelector('.hero-main');
  if (heroEl) {
    const m = catMeta(hero.cat);
    heroEl.onclick = () => openArticle(hero);
    // Background image
    const heroImg = heroEl.querySelector('.hero-img');
    if (hero.thumbnail) {
      // Remove existing img if any, keep gfx overlay
      const existImg = heroImg.querySelector('img');
      if (existImg) existImg.remove();
      const img = document.createElement('img');
      img.src = hero.thumbnail; img.alt = hero.title;
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
      heroImg.insertBefore(img, heroImg.firstChild);
    } else {
      heroImg.style.background = m.bg;
      const existImg = heroImg.querySelector('img');
      if (existImg) existImg.remove();
    }
    // Top bar: category + urgent badge
    const catEl   = heroEl.querySelector('.hero-category');
    const badgeEl = heroEl.querySelector('.hero-badge');
    if (catEl)   catEl.textContent   = hero.cat;
    if (badgeEl) badgeEl.style.display = hero.priority === 'عاجل' ? 'block' : 'none';
    // Content
    const titleEl   = heroEl.querySelector('.hero-title');
    const excerptEl = heroEl.querySelector('.hero-excerpt');
    if (titleEl)   titleEl.textContent   = hero.title;
    if (excerptEl) excerptEl.textContent = _stripTags(hero.excerpt || '');
    const spans = heroEl.querySelectorAll('.hero-meta span');
    if (spans[0]) spans[0].textContent = '✍️ ' + (hero.author || '');
    if (spans[1]) spans[1].textContent = '🕐 ' + (hero.date   || '');
    // CTA button — open article on click
    const ctaEl = heroEl.querySelector('.hero-cta');
    if (ctaEl) ctaEl.onclick = (e) => { e.stopPropagation(); openArticle(hero); };
  }

  // Sidebar — configurable slots aligned to hero: مميز first (latest first), then normal news to fill
  const sideCount = Number(window._heroSideCount) || 4;
  const sideItemsFeat   = featNews.filter(n => n !== hero);
  const sideItemsNormal = normalNews.filter(n => n !== hero);
  const sideItems = [...sideItemsFeat, ...sideItemsNormal].slice(0, sideCount);
  const sidebar   = document.querySelector('.sidebar-stack');
  if (sidebar && sideItems.length) {
    const nums = ['١','٢','٣','٤','٥','٦'];
    sidebar.innerHTML = sideItems.map((n,i) => {
      _reg(n);
      const m = catMeta(n.cat);
      const thumbHtml = n.thumbnail
        ? `<div class="sidebar-thumb"><img src="${n.thumbnail}" alt="${n.title}" onerror="this.parentElement.style.background='${m.bg}';this.parentElement.innerHTML='<span style=font-size:22px>${m.icon}</span>'"></div>`
        : `<div class="sidebar-thumb" style="background:${m.bg}">${m.icon}</div>`;
      // Build category chip styling: colored variant uses the category's color for bg/border
      const sideCatColored = window._sidebarCatColored !== false;
      const sideCatShape   = window._sidebarCatShape || 'pill';
      const catColor = (window._catColors && window._catColors[n.cat]) || '#C9A84C';
      const catClasses = sideCatColored
        ? `sidebar-cat sidebar-cat-colored shape-${sideCatShape}`
        : 'sidebar-cat';
      const catStyle = sideCatColored
        ? `--sidebar-cat-bg:${catColor}22;--sidebar-cat-border:${catColor}55;color:${catColor}`
        : '';
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

  // Wide featured card (أبرز المقالات): priority 'ابرز المقالات' > pinned > first مميز not used as hero > none
  const featuredArt = pub.find(n => n.priority === 'ابرز المقالات' && n !== hero);
  const pinnedId  = _fb.site ? _fb.site.wide_pinned : null;
  const pinnedArt = pinnedId ? pub.find(n => String(n.id) === String(pinnedId)) : null;
  const feat      = featuredArt || pinnedArt || sideItemsFeat[0] || null;
  const wideCard  = document.querySelector('.wide-card');
  // Hide wide card if no featured article
  if (wideCard) wideCard.style.display = feat ? '' : 'none';
  if (wideCard && feat) {
    const m = catMeta(feat.cat);
    _reg(feat);
    wideCard.onclick = () => openArticle(feat);
    // Wide image: render real <img> when thumbnail available, else emoji on category gradient
    const wi = wideCard.querySelector('.wide-img');
    if (wi) {
      // Clear previous content
      wi.innerHTML = '';
      wi.style.background = m.bg;
      if (feat.thumbnail) {
        const img = document.createElement('img');
        img.src = feat.thumbnail;
        img.alt = feat.title || '';
        img.onerror = function() {
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
      if (we) we.textContent = _stripTags(feat.excerpt || '') || feat.title;
      const ms = wb.querySelectorAll('.hero-meta span');
      if (ms[0]) ms[0].textContent = '✍️ ' + (feat.author || '');
      if (ms[1]) ms[1].textContent = '🕐 ' + (feat.date || '');
    }
  }

  // Reset show-more state when data changes
  _updateShowMoreBtn();
  // Trending section
  renderTrending();

  // Grid: all remaining published news (not hero, not feat, not in sidebar), sorted by newest first.
  // Sort key: numeric id (which is Date.now() at creation) descending — newest at top.
  const sideSet = new Set(sideItems.map(n => n.id));
  const gridItems = pub
    .filter(n => n!==hero && n!==feat && !sideSet.has(n.id))
    .sort((a, b) => (Number(b.id)||0) - (Number(a.id)||0))
    .slice(0, 6);
  const grid = document.querySelector('.grid-section .news-grid');
  if (grid && gridItems.length) {
    grid.innerHTML = gridItems.map(n => {
      _reg(n);
      const m = catMeta(n.cat);
      const thumb = n.thumbnail
        ? `<img src="${n.thumbnail}" style="width:100%;height:100%;object-fit:cover" alt="">`
        : m.icon;
      const viewsNum = parseInt((n.views||'0').replace(/[^0-9]/g,''))||0;
      const isTrending = viewsNum > 5000;
      // Metadata visibility (undefined defaults to shown)
      const showAuthor = n.showAuthor !== false;
      const showDate   = n.showDate   !== false;
      const showViews  = n.showViews  !== false;
      return `<div class="news-card" onclick="openById(${n.id})">
        <div class="card-img"><div class="card-img-inner" style="background:${m.bg}">${thumb}</div></div>
        <div class="card-body">
          <div class="card-tags">
            <span class="tag ${m.cls}">${n.cat}</span>
            ${n.priority==='عاجل'?'<span class="tag tag-red">عاجل</span>':n.priority==='مميز'?'<span class="tag tag-gold">مميز</span>':''}
            ${isTrending?'<span class="trending-badge">🔥 رائج</span>':''}
          </div>
          <div class="card-title">${n.title}</div>
          <p class="card-excerpt">${_stripTags(n.excerpt||'')}</p>
          <div class="card-footer">
            ${showAuthor ? `<div class="card-author">
              <div class="author-avatar" style="background:rgba(201,168,76,0.15);color:var(--gold)">${n.author?n.author[0]:'م'}</div>
              <span class="card-author-name">${n.author||''}</span>
            </div>` : '<div></div>'}
            <div style="display:flex;align-items:center;gap:6px">
              ${showDate && n.date ? `<span class="card-time">${n.date}</span>` : ''}
              ${showViews && n.views ? `<span style="font-size:11px;color:var(--text-dim)">${showDate ? '· ' : ''}👁 ${n.views}</span>` : ''}
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
  }
}

// ═══════════════════════════════════════════════════════════════
// NAV + CATEGORY FILTER
// ═══════════════════════════════════════════════════════════════
function navFilter(cat, el) {
  // If an article overlay is open, close it first so the homepage is visible
  const art = document.getElementById('article-page');
  if (art && art.style.display === 'block') closeArticle();
  // If the all-news overlay is open, close that too
  const an = document.getElementById('all-news-page');
  if (an && an.style.display === 'block') closeAllNewsPage();
  document.querySelectorAll('#nav-links a').forEach(a => a.classList.remove('active'));
  if (el) el.classList.add('active');
  const pill = Array.from(document.querySelectorAll('.cat-pill'))
    .find(p => p.textContent.trim().includes(cat === 'الكل' ? 'الكل' : cat));
  filterByCat(cat, pill || null);
  window.scrollTo({top:0, behavior:'smooth'});
  return false;  // prevent default href
}

function filterByCat(cat, el) {
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
  // Scroll to top so results are immediately visible
  window.scrollTo({top: 0, behavior: 'smooth'});

  const all      = getNewsData();
  // Convert Arabic-Indic digits (٠-٩) to Western (0-9), normalize separators, strip whitespace
  const _normDate = s => String(s||'')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))  // Arabic→Western
    .replace(/[\-\.\u200F\u200E]/g, '/')                       // separators + RTL/LTR marks
    .replace(/\s+/g, '')
    .trim();
  // Build multiple possible "today" representations to match however it was stored
  const _today     = new Date();
  const todayAr    = _today.toLocaleDateString('ar-EG',{year:'numeric',month:'2-digit',day:'2-digit'});
  const todayEn    = _today.toLocaleDateString('en-GB',{year:'numeric',month:'2-digit',day:'2-digit'}); // dd/mm/yyyy
  const todayISO   = _today.toISOString().slice(0,10);  // yyyy-mm-dd
  const yyyy = _today.getFullYear(), mm = String(_today.getMonth()+1).padStart(2,'0'), dd = String(_today.getDate()).padStart(2,'0');
  const todayYMD   = `${yyyy}/${mm}/${dd}`;
  const todayDMY   = `${dd}/${mm}/${yyyy}`;
  const todayCandidates = new Set([
    _normDate(todayAr), _normDate(todayEn), _normDate(todayISO),
    _normDate(todayYMD), _normDate(todayDMY)
  ]);
  const filtered = all.filter(n => {
    if (n.status !== 'منشور') return false;
    if (cat === 'اليوم') {
      return todayCandidates.has(_normDate(n.date));
    }
    return n.cat === cat;
  });
  const grid     = document.getElementById('cat-filter-grid');
  const empty    = document.getElementById('cat-empty');

  if (!filtered.length) {
    grid.innerHTML = '';
    empty.textContent = cat === 'اليوم'
      ? 'لم يتم نشر أي أخبار اليوم حتى الآن — تحقق لاحقاً'
      : 'لا توجد أخبار في هذا القسم حالياً';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = filtered.map(n => {
    _reg(n);
    const m = catMeta(n.cat);
    const thumb = n.thumbnail
      ? `<img src="${n.thumbnail}" style="width:100%;height:100%;object-fit:cover" alt="">`
      : m.icon;
    return `<div class="news-card" onclick="openById(${n.id})">
      <div class="card-img"><div class="card-img-inner" style="background:${m.bg}">${thumb}</div></div>
      <div class="card-body">
        <div class="card-tags"><span class="tag ${m.cls}">${n.cat}</span></div>
        <div class="card-title">${n.title}</div>
        <p class="card-excerpt">${_stripTags(n.excerpt||'')}</p>
        <div class="card-footer">
          <div class="card-author">
            <div class="author-avatar" style="background:rgba(201,168,76,0.15);color:var(--gold)">${n.author?n.author[0]:'م'}</div>
            <span class="card-author-name">${n.author||''}</span>
          </div>
          <span class="card-time">${n.date||''}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function clearCatFilter() {
  // If the article page or all-news page is open, close them first
  const artPage = document.getElementById('article-page');
  if (artPage && artPage.style.display === 'block') {
    if (typeof closeArticle === 'function') closeArticle();
  }
  const anp = document.getElementById('all-news-page');
  if (anp && anp.style.display !== 'none' && anp.style.display !== '') {
    if (typeof closeAllNewsPage === 'function') closeAllNewsPage();
  }
  const heroEl  = document.getElementById('site-hero');
  const statsEl = document.getElementById('stats-bar');
  if (heroEl)  heroEl.style.display  = '';
  if (statsEl) statsEl.style.display = '';
  // Also clear search input
  const searchInput = document.querySelector('.search-box input');
  if (searchInput) searchInput.value = '';
  filterByCat('الكل', document.querySelector('.cat-pill'));
}

// ═══════════════════════════════════════════════════════════════
// LIVE SEARCH
// ═══════════════════════════════════════════════════════════════
function liveSearch(q) {
  const heroEl   = document.getElementById('site-hero');
  const statsEl  = document.getElementById('stats-bar');
  const filterSec= document.getElementById('cat-filter-section');
  const mainGrid = document.querySelector('.grid-section');

  if (!q.trim()) {
    filterSec.style.display = 'none';
    if (mainGrid) mainGrid.style.display = 'block';
    if (heroEl)   heroEl.style.display   = '';
    if (statsEl)  statsEl.style.display  = '';
    // Reset cat pill to "الكل"
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    const allPill = Array.from(document.querySelectorAll('.cat-pill')).find(p => p.textContent.trim().includes('الكل'));
    if (allPill) allPill.classList.add('active');
    return;
  }

  const all = getNewsData();
  const q2  = q.trim().toLowerCase();
  const results = all.filter(n =>
    n.status === 'منشور' &&
    (n.title.toLowerCase().includes(q2) || (n.excerpt||'').toLowerCase().includes(q2) ||
     n.cat.includes(q) || (n.author||'').includes(q))
  );

  if (mainGrid) mainGrid.style.display = 'none';
  if (heroEl)   heroEl.style.display   = 'none';
  if (statsEl)  statsEl.style.display  = 'none';
  filterSec.style.display = 'block';
  document.getElementById('cat-filter-title').textContent = '🔍 نتائج البحث: "' + q + '"';
  window.scrollTo({top: 0, behavior: 'smooth'});

  const grid  = document.getElementById('cat-filter-grid');
  const empty = document.getElementById('cat-empty');

  if (!results.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  grid.innerHTML = results.map(n => {
    _reg(n);
    const m = catMeta(n.cat);
    const thumb = n.thumbnail
      ? `<img src="${n.thumbnail}" style="width:100%;height:100%;object-fit:cover" alt="">`
      : m.icon;
    return `<div class="news-card" onclick="openById(${n.id})">
      <div class="card-img"><div class="card-img-inner" style="background:${m.bg}">${thumb}</div></div>
      <div class="card-body">
        <div class="card-tags"><span class="tag ${m.cls}">${n.cat}</span></div>
        <div class="card-title">${n.title}</div>
        <p class="card-excerpt">${_stripTags(n.excerpt||'')}</p>
        <div class="card-footer">
          <div class="card-author">
            <div class="author-avatar" style="background:rgba(201,168,76,0.15);color:var(--gold)">${n.author?n.author[0]:'م'}</div>
            <span class="card-author-name">${n.author||''}</span>
          </div>
          <span class="card-time">${n.date||''}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// THEME / LANGUAGE
// ═══════════════════════════════════════════════════════════════
function toggleTheme() {
  document.body.classList.toggle('light');
  const isLight = document.body.classList.contains('light');
  const btn = document.getElementById('theme-btn');
  if (btn) { btn.textContent = isLight ? '🌙 داكن' : '🌙 فاتح'; btn.classList.toggle('active', isLight); }
  localStorage.setItem('atq_theme', isLight ? 'light' : 'dark');
}

function toggleLang() {
  document.body.classList.toggle('english');
  const isEn = document.body.classList.contains('english');
  const btn = document.getElementById('lang-btn');
  if (btn) { btn.textContent = isEn ? 'ع' : 'EN'; btn.classList.toggle('active', isEn); }
  localStorage.setItem('atq_lang', isEn ? 'en' : 'ar');
}

// ═══════════════════════════════════════════════════════════════
// SITE BUTTONS VISIBILITY
// ═══════════════════════════════════════════════════════════════
function applySiteButtons(controls) {
  // Toggle visibility for each controllable element
  const visMap = {
    'search-box':     'search-box',
    'lang-btn':       'lang-btn',
    'theme-btn':      'theme-btn',
    'subscribe-btn':  'subscribe-btn',
    'stats-bar':      'stats-bar',
    'site-newsletter':'site-newsletter',
    'site-hero':      'site-hero',
    'scroll-top':     'scroll-top',
    'cats-strip':     'cats-strip',
    'site-ticker':    'site-ticker',
    'site-footer':    'site-footer',
    'breaking-bar-wrap': 'breaking-bar',
  };
  Object.entries(visMap).forEach(([key, elId]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    if (controls[key] === false) {
      el.style.display = 'none';
    } else if (controls[key] === true || controls[key] === undefined) {
      // Restore display — use '' so element uses its CSS default
      if (el.style.display === 'none') el.style.display = '';
    }
  });

  // Theme override from controls
  if (controls['force-theme'] === 'light' && !document.body.classList.contains('light')) {
    document.body.classList.add('light');
  } else if (controls['force-theme'] === 'dark' && document.body.classList.contains('light')) {
    document.body.classList.remove('light');
  }
}

// ═══════════════════════════════════════════════════════════════
// TICKER SPEED (live update from admin panel)
// ═══════════════════════════════════════════════════════════════
// ─── TICKER: RAF-BASED SEAMLESS SCROLL ──────────────────────────
// Speed = fixed pixels/second regardless of content width
// This prevents speed changing when content or Firebase updates occur
let _tickerRaf    = null;
let _tickerPos    = 0;
let _tickerPxSec  = 60;  // default: 60 px/second (comfortable reading)
let _tickerLastContent = ''; // track content to avoid needless restarts
let _newsOffset        = 6;   // extra news loaded by show-more button
let _commentsEnabled   = true; // global comments toggle from Firebase

function _startTickerRAF() {
  if (_tickerRaf) { cancelAnimationFrame(_tickerRaf); _tickerRaf = null; }
  const inner = document.querySelector('.ticker-inner');
  if (!inner) return;
  // Attach hover/touch pause handlers once (idempotent: re-attaching replaces prior ones)
  const track = inner.closest('.ticker-track') || inner.parentElement;
  if (track && !track._pauseBound) {
    track._pauseBound = true;
    track.addEventListener('mouseenter', () => { window._tickerPaused = true; });
    track.addEventListener('mouseleave', () => { window._tickerPaused = false; });
    track.addEventListener('touchstart', () => { window._tickerPaused = true; }, {passive:true});
    track.addEventListener('touchend',   () => { window._tickerPaused = false; });
  }
  // Double-rAF ensures layout is fully computed before measuring
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

function applyTickerSpeed(secs) {
  // secs from admin slider (10–200). Map to px/sec: fast(10s)→200px/s, slow(200s)→10px/s
  const s = parseInt(secs);
  if (!s || s <= 0) return;
  _tickerPxSec = Math.round(2000 / s); // secs=60→33px/s, secs=200→10px/s, secs=10→200px/s
  if (_tickerRaf) { cancelAnimationFrame(_tickerRaf); _tickerRaf = null; }
  _startTickerRAF();
}

// ─── FOOTER LINK OPENER ──────────────────────────────────────────
const _footerLinks = {};
function openFooterNewWin(id) {
  const url = _footerLinks[id];
  if (url && url !== '#' && (url.startsWith('http') || url.startsWith('/'))) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  // Look up the full item from cache (populated by _applyFooterCol)
  const cached = (window._footerItems && window._footerItems[id]) || null;
  let label, content, commentsEnabled = true;
  if (cached) {
    label           = cached.label || 'صفحة';
    content         = cached.content || `<p>محتوى صفحة <strong>${label}</strong> سيُضاف قريباً.</p>`;
    commentsEnabled = cached.commentsEnabled !== false; // default ON, OFF only when explicitly false
  } else {
    // Last-resort fallback for static/legacy links (flink-about, flink-team, etc.)
    const el = document.getElementById(id);
    label   = el ? el.textContent.trim() : id;
    content = `<p>محتوى صفحة <strong>${label}</strong> سيُضاف من لوحة التحكم في قسم إعدادات الفوتر.</p>`;
  }
  openArticle({
    cat: 'الموقع', title: label,
    author: 'الأحداث التقنية', date: '', views: '٠',
    excerpt: '',
    content: content,
    commentsEnabled: commentsEnabled,
    thumbnail: '',
    isFooterPage: true
  });
}
// Legacy: keep openFooterLink as alias
function openFooterLink(id) { openFooterNewWin(id); }

// ─── DYNAMIC SOCIAL MEDIA ────────────────────────────────────────
function _applySocialMedia(socials) {
  const container = document.getElementById('footer-socials-dynamic');
  if (!container) return;
  if (!socials || !socials.length) return;
  const html = socials.map(s => {
    if (!s.name && !s.icon) return '';
    const href   = s.url && s.url.startsWith('http') ? s.url : '#';
    const target = s.url && s.url.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
    const fs     = s.icon && s.icon.length > 2 ? '11px' : '14px';
    return `<a class="social-btn" href="${href}"${target} title="${s.name||''}" style="font-size:${fs}">${s.icon || '🔗'}</a>`;
  }).join('');
  if (html) container.innerHTML = html;
}

// ─── COMMENTS ────────────────────────────────────────────────────
function submitComment() {
  const inp = document.getElementById('comment-input');
  const list = document.getElementById('comments-list');
  if (!inp || !list || !inp.value.trim()) return;
  const div = document.createElement('div');
  div.style.cssText = 'background:var(--dark-3);border:1px solid var(--border-dim);border-radius:10px;padding:12px 16px';
  div.innerHTML = `<div style="font-size:12px;color:var(--text-dim);margin-bottom:6px">زائر · الآن</div><div style="font-size:14px;color:var(--text-muted)">${inp.value.trim()}</div>`;
  list.prepend(div);
  inp.value = '';
}

// ─── AD BANNERS ───────────────────────────────────────────────────
function _applyAdBanner(slot, data) {
  const wrap  = document.getElementById('ad-' + slot);
  const inner = document.getElementById('ad-' + slot + '-inner');
  if (!wrap || !inner) return;

  // Hide if not active
  if (!data || !data.active) {
    wrap.style.display = 'none';
    wrap.classList.remove('active');
    return;
  }

  // Show — works whether element has .ad-banner class or just inline display:none
  wrap.style.display = '';
  wrap.classList.add('active');
  // Apply custom dimensions
  if (data.width)  wrap.style.maxWidth = (data.width  === '100%' || data.width.endsWith('%'))  ? data.width  : data.width  + 'px';
  if (data.height && data.height !== 'auto') wrap.style.minHeight = data.height.endsWith('px') ? data.height : data.height + 'px';
  // Apply custom top/bottom spacing (reset to default when null/undefined so admin changes take effect)
  if (data.marginTop != null && !isNaN(data.marginTop)) {
    wrap.style.marginTop    = data.marginTop    + 'px';
    wrap.style.paddingTop   = '0';
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

  // Build content
  inner.innerHTML = '';
  if (data.videoUrl) {
    inner.innerHTML = '<video src="' + data.videoUrl + '" autoplay muted loop playsinline style="width:100%;max-height:250px;object-fit:cover;border-radius:inherit"></video>';
  } else if (data.imageUrl) {
    inner.innerHTML = '<img src="' + data.imageUrl + '" alt="" style="width:100%;max-height:250px;object-fit:cover">';
  } else if (data.html) {
    inner.innerHTML = data.html;
  } else if (data.text) {
    inner.innerHTML = '<div class="ad-banner-text" style="padding:16px;text-align:center;font-size:14px;color:var(--text)">' + data.text + '</div>';
  }

  // Click-through link
  if (data.linkUrl) {
    inner.style.cursor = 'pointer';
    inner.onclick = () => window.open(data.linkUrl, '_blank', 'noopener');
  } else {
    inner.style.cursor = '';
    inner.onclick = null;
  }
}

// ─── CUSTOM AD BANNERS ───────────────────────────────────────────
// Custom banners are user-added banners placed at any of several named
// locations. If a location already has a built-in banner, custom banners can
// either stack below (block layout) or sit beside (flex layout).
// Anchors: each slot resolves to an element or CSS selector where the banner(s) attach.
const _CUSTOM_BANNER_ANCHORS = {
  'top':            () => document.getElementById('ad-top'),
  'bottom':         () => document.getElementById('ad-bottom'),
  'grid':           () => document.getElementById('ad-grid'),
  'article':        () => document.getElementById('ad-article'),
  'allnews':        () => document.getElementById('ad-allnews'),
  'after-hero':     () => document.querySelector('.hero'),
  'after-featured': () => document.querySelector('.wide-card'),
  'footer-top':     () => document.querySelector('footer'),
};

// The <div class="ad-banner custom-banner-wrap" id="custom-banner-<slot>"> element
// is inserted once per slot, near the anchor. Custom banners go inside it.
function _ensureCustomSlotWrap(slot, anchor, mode) {
  const wrapId = 'custom-banner-wrap-' + slot;
  let wrap = document.getElementById(wrapId);
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = wrapId;
    wrap.className = 'ad-banner custom-banners-slot';
    wrap.style.maxWidth = '1280px';
    wrap.style.margin = '16px auto';
    wrap.style.padding = '0 2rem';
    // Anchors that ARE existing ad-banner elements: append AFTER them
    if (anchor && (anchor.id || '').startsWith('ad-')) {
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    } else if (anchor && anchor.tagName === 'FOOTER') {
      // footer-top: insert BEFORE the footer
      anchor.parentNode.insertBefore(wrap, anchor);
    } else if (anchor) {
      // For .hero / .wide-card: insert AFTER the element
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    } else {
      return null;
    }
  }
  // Switch layout between stacked (block) and side-by-side (flex row)
  if (mode === 'beside') {
    wrap.style.display = 'flex';
    wrap.style.flexWrap = 'wrap';
    wrap.style.gap = '12px';
  } else {
    wrap.style.display = 'block';
  }
  return wrap;
}

function _buildCustomBannerEl(b) {
  const el = document.createElement('div');
  el.className = 'ad-banner-inner custom-banner';
  el.style.borderRadius = '14px';
  el.style.overflow = 'hidden';
  el.style.border = '1px solid var(--border-dim)';
  el.style.background = 'var(--dark-3)';
  el.style.minHeight = '80px';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.position = 'relative';
  // Sizing
  if (b.width)  el.style.maxWidth = /%$/.test(String(b.width)) ? b.width : (b.width + 'px');
  if (b.height && !isNaN(b.height)) el.style.minHeight = b.height + 'px';
  el.style.flex = '1 1 auto';
  // Content (video > image > html > text)
  if (b.videoUrl) {
    el.innerHTML = `<video src="${b.videoUrl}" autoplay muted loop playsinline style="width:100%;max-height:250px;object-fit:cover"></video>`;
  } else if (b.imageUrl) {
    el.innerHTML = `<img src="${b.imageUrl}" alt="" style="width:100%;max-height:250px;object-fit:cover">`;
  } else if (b.html) {
    el.innerHTML = b.html;
  } else if (b.text) {
    el.innerHTML = `<div style="padding:16px;text-align:center;font-size:14px;color:var(--text)">${b.text}</div>`;
  }
  // Click-through link
  if (b.linkUrl) {
    el.style.cursor = 'pointer';
    el.onclick = () => window.open(b.linkUrl, '_blank', 'noopener');
  }
  return el;
}

function _applyCustomBanners(list) {
  if (!Array.isArray(list)) return;
  // Clear all previous custom banner wraps so we can re-render from scratch
  document.querySelectorAll('.custom-banners-slot').forEach(w => {
    Array.from(w.querySelectorAll('.custom-banner')).forEach(c => c.remove());
  });
  // Group active banners by slot
  const bySlot = {};
  list.filter(b => b && b.active !== false).forEach(b => {
    const s = b.slot || 'top';
    if (!bySlot[s]) bySlot[s] = [];
    bySlot[s].push(b);
  });
  // Render each slot's banners
  Object.entries(bySlot).forEach(([slot, banners]) => {
    const anchorFn = _CUSTOM_BANNER_ANCHORS[slot];
    if (!anchorFn) return;
    const anchor = anchorFn();
    if (!anchor) return;
    // Mode from the first banner in that slot wins; all banners in same slot share layout
    const mode = banners[0].stackMode || 'below';
    const wrap = _ensureCustomSlotWrap(slot, anchor, mode);
    if (!wrap) return;
    banners.forEach(b => {
      const el = _buildCustomBannerEl(b);
      wrap.appendChild(el);
    });
  });
}
// ─── DYNAMIC NAV MENU ────────────────────────────────────────────
function _closeMobileNav() {
  const links = document.getElementById('nav-links');
  if (links) links.classList.remove('mobile-open');
}

function _applyNavMenu(items) {
  const ul = document.getElementById('nav-links');
  if (!ul || !items || !items.length) return;
  ul.innerHTML = items.map((item, i) => {
    let onclick = '';
    if (item.type === 'home' || item.cat === 'الكل')
      onclick = "navFilter('الكل',this);return false;";
    else if (item.type === 'allnews')
      onclick = "openAllNewsPage();return false;";
    else if (item.type === 'url')
      onclick = "window.open('" + (item.cat||'#') + "','_blank','noopener');return false;";
    else
      onclick = "navFilter('" + (item.cat||item.label) + "',this);return false;";
    const isHome = item.type === 'home' || i === 0;
    const idAttr = isHome ? ' class="active" id="nav-all"'
                          : (item.type === 'allnews' ? ' id="nav-allnews"' : '');
    return '<li><a href="#"' + idAttr + ' onclick="_closeMobileNav();' + onclick + '">' + item.label + '</a></li>';
  }).join('');
  // Re-measure whether menu now overflows and collapse to hamburger if needed
  if (typeof _autoCollapseNav === 'function') setTimeout(_autoCollapseNav, 50);
}

// ─── LAYOUT SETTINGS — hero height + ad banner heights ────────────────
function _applyLayoutSettings(layout) {
  if (!layout) return;
  const root = document.documentElement;
  const px = v => (v == null || v === '' || isNaN(v)) ? null : (Number(v) + 'px');
  // Hero heights (single var drives both hero-main and sidebar-stack)
  const h = px(layout.heroHeight);
  if (h) root.style.setProperty('--hero-height', h);
  // Sidebar width
  const sw = px(layout.heroSideWidth);
  if (sw) root.style.setProperty('--hero-side-width', sw);
  // Sidebar thumbnail size
  const stz = px(layout.heroSideThumbSize);
  if (stz) root.style.setProperty('--sidebar-thumb-size', stz);
  else     root.style.setProperty('--sidebar-thumb-size', '88px');
  // Sidebar category chip settings (color + shape)
  if (layout.sidebarCatColored != null) window._sidebarCatColored = !!layout.sidebarCatColored;
  else                                   window._sidebarCatColored = true; // default ON
  window._sidebarCatShape = layout.sidebarCatShape || 'pill';
  // Ad banner heights
  const slots = ['top','bottom','grid','article','allnews'];
  slots.forEach(slot => {
    const key = 'ad' + slot.charAt(0).toUpperCase() + slot.slice(1) + 'Height';
    const val = px(layout[key]);
    if (val) root.style.setProperty('--ad-' + slot + '-height', val);
    else     root.style.setProperty('--ad-' + slot + '-height', 'auto');
  });
  // Sidebar count: store globally and trigger re-render if changed
  const newCount = Number(layout.heroSideCount) || 4;
  if (window._heroSideCount !== newCount) {
    window._heroSideCount = newCount;
    // Update sidebar grid rows to match count
    const stack = document.querySelector('.sidebar-stack');
    if (stack) stack.style.gridTemplateRows = 'repeat(' + newCount + ', 1fr)';
    // Trigger re-render so the slice picks up new count
    if (typeof renderSite === 'function') setTimeout(renderSite, 10);
  }
}

// ─── IDENTITY SETTINGS — logo icon/image, brand name ──────────────────
// ─── MAINTENANCE MODE ─────────────────────────────────────────────
// When active, hide all site content and show only the maintenance overlay +
// the Contact Us button. Snapshot listener calls this on every site-settings update.
function _applyMaintenance(m) {
  const overlay = document.getElementById('maintenance-overlay');
  const contactNav   = document.getElementById('contact-nav-btn');
  const contactFloat = document.getElementById('contact-us-btn');
  if (!overlay) return;
  const active = !!(m && m.active);
  if (active) {
    // Populate text + image
    const textEl = document.getElementById('maintenance-text');
    const imgEl  = document.getElementById('maintenance-image');
    if (textEl) textEl.textContent = (m.text || 'الموقع تحت الصيانة... نعود قريباً');
    if (imgEl) {
      if (m.image) { imgEl.src = m.image; imgEl.style.display = 'block'; }
      else         { imgEl.src = ''; imgEl.style.display = 'none'; }
    }
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    // Keep a contact button reachable — use the floating one (bottom-left)
    // which is visible on all screen sizes when we override its default display:none.
    if (contactFloat) {
      contactFloat.style.display = 'block';
      contactFloat.style.zIndex  = '9100'; // above overlay
    }
    // Hide nav-variant (it's part of the hidden nav)
    if (contactNav) contactNav.style.display = 'none';
  } else {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
    // Restore default visibility (CSS rules handle mobile/desktop choice)
    if (contactFloat) { contactFloat.style.display = ''; contactFloat.style.zIndex = ''; }
    if (contactNav)   { contactNav.style.display = ''; }
  }
}

function _applyIdentitySettings(identity) {  if (!identity) return;
  // Logo: image takes precedence over emoji/letter. Both nav + footer logos stay in sync.
  document.querySelectorAll('.nav-logo-icon').forEach(el => {
    if (identity.logoImage) {
      el.innerHTML = `<img src="${identity.logoImage}" alt="logo" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
      el.style.background = 'var(--dark-3)';
      el.style.color = '';
    } else if (identity.logoIcon) {
      el.innerHTML = '';
      el.textContent = identity.logoIcon;
      el.style.background = '';   // let the original CSS gold gradient take over
      el.style.color = '';
    }
  });
  // Brand name
  document.querySelectorAll('.nav-logo-text').forEach(el => {
    if (identity.brandName) el.textContent = identity.brandName;
  });
  // Document title + favicon
  if (identity.brandName) {
    document.title = identity.brandName;
    window._brandName = identity.brandName; // cache so article close can restore it
  }
  // Sync favicon with uploaded logo image (or regenerate SVG fallback with current letter)
  const fav = document.getElementById('site-favicon');
  if (fav) {
    if (identity.logoImage) {
      fav.setAttribute('type', _faviconMimeFromDataUrl(identity.logoImage));
      fav.setAttribute('href', identity.logoImage);
    } else {
      const letter = (identity.logoIcon || 'ت').replace(/[<>&"']/g, '');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="%23C9A84C"/><text x="16" y="22" font-family="Tajawal,sans-serif" font-size="18" font-weight="900" text-anchor="middle" fill="%230D0D0F">${letter}</text></svg>`;
      fav.setAttribute('type', 'image/svg+xml');
      fav.setAttribute('href', 'data:image/svg+xml,' + encodeURIComponent(svg).replace(/%2523/g,'%23'));
    }
  }
}
// Detect MIME type from data URL prefix so favicon gets correct type attr
function _faviconMimeFromDataUrl(dataUrl) {
  const m = /^data:(image\/[^;]+)/.exec(dataUrl || '');
  return m ? m[1] : 'image/png';
}

// ─── DYNAMIC CATS STRIP ──────────────────────────────────────────
const _catColors = {
  'الذكاء الاصطناعي':'#4A9EFF','الهواتف والأجهزة':'#3DDC84','الفضاء والعلوم':'#B090FF',
  'الأمن الرقمي':'#FF5252','الشركات والأعمال':'#FF9A3C','ألعاب الفيديو':'#F0C840',
  'السيارات الكهربائية':'#FF7070','الروبوتات':'#40C8F0','التقنية الحيوية':'#C875FF'
};
window._catColors = _catColors;
function _applyCatsStrip(cats) {
  const strip = document.getElementById('cats-strip');
  if (!strip) return;
  // Keep the first two pills (اليوم + الكل) static, update the rest
  const staticPills = strip.querySelectorAll('.cat-pill');
  // Remove existing dynamic pills (keep first 2)
  const pills = Array.from(staticPills);
  pills.slice(2).forEach(p => p.remove());
  // Add new category pills from Firebase
  cats.forEach(c => {
    // Skip if already present (first 2 static)
    const exists = Array.from(strip.querySelectorAll('.cat-pill'))
      .some(p => p.textContent.includes(c.name));
    if (exists) return;
    const color = c.color || _catColors[c.name] || 'var(--gold)';
    const pill = document.createElement('div');
    pill.className = 'cat-pill';
    pill.innerHTML = `<span class="dot" style="background:${color}"></span>${c.name}`;
    pill.onclick = () => filterByCat(c.name, pill);
    strip.appendChild(pill);
  });
  // Also update news add/edit form category select
  const catSel = document.getElementById && null; // index.html doesn't have this
}

// ═══════════════════════════════════════════════════════════════
// MANUAL REFRESH — call this when localStorage changed in SAME tab
function refreshFromStorage() {
  renderSite();
  checkBreaking();
}
// Also expose globally so admin panel can trigger it
window._siteRefresh = refreshFromStorage;

// ═══════════════════════════════════════════════════════════════
// STORAGE EVENT — live sync from admin panel (same browser)
// ═══════════════════════════════════════════════════════════════
window.addEventListener('storage', e => {
  switch(e.key) {
    // All shared data (news/latest/breaking/settings) now via Firebase onSnapshot.
    // Only user-private prefs kept in localStorage:
    case 'atq_theme':
    case 'atq_lang':
      // handled by toggleTheme / toggleLang directly
      break;
  }
});

// ═══════════════════════════════════════════════════════════════
// INIT — apply settings then render
// ═══════════════════════════════════════════════════════════════

// openArticleFromEl — called from hero-main onclick (overridden by renderSite but kept as fallback)
function openArticleFromEl(el) {
  const pub = getNewsData().filter(n => n.status === 'منشور');
  const article = pub.find(n => n.priority === 'عاجل') || pub[0];
  if (article) { openArticle(article); return; }
  // fallback: read from the element's DOM
  openArticle({
    cat:     el.querySelector('.hero-category')?.textContent || 'تقنية',
    title:   el.querySelector('.hero-title')?.textContent    || '',
    author:  (el.querySelectorAll('.hero-meta span')[0]?.textContent||'').replace('✍️ ',''),
    date:    '',
    views:   '٠',
    excerpt: el.querySelector('.hero-excerpt')?.textContent  || '',
  });
}

// openArticleFromWide — called from wide-card onclick (overridden by renderSite but kept as fallback)
function openArticleFromWide(el) {
  const pub  = getNewsData().filter(n => n.status === 'منشور');
  if (!pub.length) return;
  const pinnedId  = localStorage.getItem('atq_wide_pinned');
  const hero = pub.find(n => n.priority === 'عاجل') || pub[0];
  const feat = (pinnedId ? pub.find(n => String(n.id) === pinnedId) : null)
             || pub.find(n => n.priority === 'مميز' && n !== hero)
             || null;
  if (feat) { openArticle(feat); return; }
  openArticle({
    cat:     el.querySelector('.card-tags span')?.textContent  || 'تقنية',
    title:   el.querySelector('.wide-title')?.textContent      || '',
    author:  '',
    date:    '',
    views:   '٠',
    excerpt: el.querySelector('.wide-excerpt')?.textContent    || '',
  });
}

// ── STATIC CARD OPENERS (called from HTML onclick) ─────────────



// ═══════════════════════════════════════════════════════════════
// EVENT DELEGATION — catch ALL news-card and sidebar-card clicks
// This fires even for static HTML cards with no onclick attribute
// ═══════════════════════════════════════════════════════════════
document.addEventListener('click', function(e) {
  // Find closest clickable card
  const card = e.target.closest('.news-card, .sidebar-card, .wide-card, .hero-main');
  if (!card) return;

  // If card has inline onclick, let it run normally
  if (card.getAttribute('onclick')) return;

  // No onclick → figure out which article to open from position in DOM
  e.preventDefault();
  e.stopPropagation();

  const all = getNewsData();
  const pub = all.filter(n => n.status === 'منشور');
  if (!pub.length) return;

  if (card.classList.contains('hero-main')) {
    openArticleFromEl(card);
    return;
  }
  if (card.classList.contains('wide-card')) {
    openArticleFromWide(card);
    return;
  }
  if (card.classList.contains('sidebar-card')) {
    const cards = Array.from(document.querySelectorAll('.sidebar-card'));
    const idx   = cards.indexOf(card);
    // sidebar shows pub items excluding hero
    const hero  = pub.find(n => n.priority === 'عاجل') || pub[pub.length-1] || pub[0];
    const sideItems = pub.filter(n => n !== hero);
    if (sideItems[idx]) { openArticle(sideItems[idx]); return; }
    if (pub[idx])       { openArticle(pub[idx]); return; }
    openArticle(pub[0]);
    return;
  }
  if (card.classList.contains('news-card')) {
    const grid = card.closest('.news-grid');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll('.news-card'));
    const idx   = cards.indexOf(card);
    // grid shows pub items excluding hero and feat
    const hero = pub.find(n => n.priority === 'عاجل') || pub[pub.length-1] || pub[0];
    const pinnedId = localStorage.getItem('atq_wide_pinned');
    const feat = (pinnedId ? pub.find(n => String(n.id) === pinnedId) : null)
               || pub.find(n => n.priority === 'مميز' && n !== hero)
               || pub[1] || pub[0];
    const gridItems = pub.filter(n => n !== hero && n !== feat);
    if (gridItems[idx]) { openArticle(gridItems[idx]); return; }
    // Fallback: use STATIC_NEWS
    const staticPub = STATIC_NEWS.filter(n => n.status === 'منشور');
    if (staticPub[idx]) { openArticle(staticPub[idx]); return; }
    openArticle(pub[0]);
  }
}, true);  // capture phase so we catch everything

(function init() {
  // ── Detect article hash on load (for shared links / browser refresh) ──
  if (location.hash && location.hash.startsWith('#article-')) {
    const _hashId = location.hash.replace('#article-','').split('?')[0];
    if (_hashId) {
      window._pendingArticleId = _hashId;
      // Try to open immediately from static data (before Firebase loads)
      const staticFound = STATIC_NEWS.find(x => String(x.id) === String(_hashId));
      if (staticFound) setTimeout(() => openArticle(staticFound), 100);
    }
  }

  // Theme
  if (localStorage.getItem('atq_theme') === 'light') {
    document.body.classList.add('light');
    const btn = document.getElementById('theme-btn');
    if (btn) { btn.textContent = '🌙 داكن'; btn.classList.add('active'); }
  }
  // Language
  if (localStorage.getItem('atq_lang') === 'en') {
    document.body.classList.add('english');
    const langBtn = document.getElementById('lang-btn');
    if (langBtn) { langBtn.textContent = 'ع'; langBtn.classList.add('active'); }
  }
  // Site buttons applied via Firebase site-settings listener
  // Ticker / site title / subscribe text applied by Firebase site-settings listener

  // Render static demo cards immediately, Firebase will replace when ready
  renderSite();
  // Start ticker RAF
  _startTickerRAF();
  // Start Firebase real-time listeners
  startFirebaseListeners();

  // Poll breaking bar every 10s
  setInterval(checkBreaking, 10000);
  // Live updates handled by Firebase onSnapshot
})();


// ================================================================
// FIREBASE REAL-TIME LISTENERS
// Call once on page load. Each listener re-renders when data changes.
// ================================================================
function startFirebaseListeners() {

  // ── NEWS ───────────────────────────────────────────────────
  onSnapshot(collection(_db, DB.NEWS), snap => {
    const items = [];
    snap.forEach(d => {
      const data = d.data();
      if (!data || !data.title) return;          // skip corrupt docs
      if (!data.id) data.id = d.id;              // ensure id field
      items.push(data);
    });
    items.sort((a, b) => Number(b.id||0) - Number(a.id||0));
    _fb.news = items.length ? items : null;
    renderSite();
    // Restore pending article after refresh
    if (window._pendingArticleId) {
      const artToRestore = items.find(x => String(x.id) === String(window._pendingArticleId));
      if (artToRestore) {  setTimeout(() => openArticle(artToRestore), 200); }
    }
  }, err => { console.warn('[FB] news:', err); renderSite(); });

  // ── LATEST TICKER ──────────────────────────────────────────
  onSnapshot(doc(_db, DB.SETTINGS, DB.S.LATEST), snap => {
    _fb.latest = snap.exists() ? (snap.data().items || []) : [];
    renderSite();
  }, err => console.warn('[FB] latest:', err));

  // ── CATEGORIES ──────────────────────────────────────────────
  onSnapshot(doc(_db, DB.SETTINGS, DB.S.CATS), snap => {
    if (!snap.exists()) return;
    const items = snap.data().items || [];
    if (!items.length) return;
    _fb.cats = items;
    _applyCatsStrip(items);
  }, err => console.warn('[FB] cats:', err));

  // ── BREAKING NEWS ──────────────────────────────────────────
  onSnapshot(doc(_db, DB.SETTINGS, DB.S.BREAKING), snap => {
    _fb.breaking = snap.exists() ? (snap.data().items || []) : [];
    checkBreaking();
  }, err => console.warn('[FB] breaking:', err));

  // ── SITE SETTINGS ──────────────────────────────────────────
  // Handles: wide_pinned, site_buttons, ticker, title, subscribe,
  //          breaking_active, breaking_start, breaking_duration
  onSnapshot(doc(_db, DB.SETTINGS, DB.S.SITE), snap => {
    if (!snap.exists()) return;
    const s = snap.data();
    _fb.site = s;

    // Site appearance
    if (s.site_buttons)  applySiteButtons(s.site_buttons);
    if (s.site_title)    document.querySelectorAll('.nav-logo-text').forEach(el => el.textContent = s.site_title);
    if (s.subscribe_text) { const sb = document.getElementById('subscribe-btn'); if (sb) sb.textContent = s.subscribe_text; }

    // Ticker
    if (s.ticker_speed) {
      document.documentElement.style.setProperty('--ticker-speed', s.ticker_speed + 's');
      applyTickerSpeed(s.ticker_speed); // update RAF speed
    }
    const tk = document.querySelector('.ticker');
    if (tk) tk.style.display = s.ticker_visible === false ? 'none' : '';

    // Footer settings
    if (s.footer_desc)      { const el=document.getElementById('footer-desc'); if(el) el.textContent=s.footer_desc; }
    if (s.footer_copy)      { const el=document.getElementById('footer-copy'); if(el) el.textContent=s.footer_copy; }
    // Footer legacy social links
    const socMap = {footer_twitter:'footer-social-twitter',footer_linkedin:'footer-social-linkedin',footer_youtube:'footer-social-youtube',footer_instagram:'footer-social-instagram'};
    Object.entries(socMap).forEach(([k,id])=>{ if(s[k]){const el=document.getElementById(id);if(el)el.href=s[k]||'#';} });
    // Dynamic social media
    if (s.social_media && s.social_media.length) _applySocialMedia(s.social_media);
    // Footer link URLs
    ['ai','devices','space','security','gaming','about','team','ads','privacy','contact','newsletter','podcast','popular','archive','reports','terms','cookie','accessibility'].forEach(k => {
      if(s['flink-' + k]) _footerLinks['flink-' + k] = s['flink-' + k];
    });
    // Comments global toggle — store for use when articles open
    _commentsEnabled = s.comments_enabled !== false;
    // Stats bar
    if (s.stats_bar && s.stats_bar.length) {
      s.stats_bar.forEach((stat, i) => {
        const vi = document.getElementById('stat-val-'+(i+1));
        const li = document.getElementById('stat-lbl-'+(i+1));
        if (vi && stat.val) vi.textContent = stat.val;
        if (li && stat.lbl) li.textContent = stat.lbl;
      });
    }
    // Dynamic nav menu
    if (s.nav_menu && s.nav_menu.length) _applyNavMenu(s.nav_menu);
    // Maintenance mode — apply BEFORE other settings so if on, nothing else matters
    _applyMaintenance(s.maintenance);
    // Layout: hero height + logo (Identity section in admin)
    if (s.layout) _applyLayoutSettings(s.layout);
    if (s.identity) _applyIdentitySettings(s.identity);
    // Trending toggle
    window._trendingOff = s.trending_enabled === false;
    // Footer company links
    if (s.footer_company && s.footer_company.length) _applyFooterCol('footer-col-company', s.footer_company);
    // Footer more links
    if (s.footer_more && s.footer_more.length) _applyFooterCol('footer-col-more', s.footer_more);
    // Section + newsletter content
    if (s.section_title)    { const e=document.getElementById('section-title-el');  if(e) e.textContent=s.section_title; }
    if (s.newsletter_title) { const e=document.getElementById('newsletter-title-el'); if(e) e.textContent=s.newsletter_title; }
    if (s.newsletter_sub)   { const e=document.getElementById('newsletter-sub-el');   if(e) e.textContent=s.newsletter_sub; }
    // Ad banners
    _applyAdBanner('top',     s.ad_top);
    _applyAdBanner('bottom',  s.ad_bottom);
    _applyAdBanner('grid',    s.ad_grid);
    // Also apply the all-news banner so it's ready to show when user opens that page
    if (s.ad_allnews) {
      window._adAllnewsData = s.ad_allnews;
      _applyAdBanner('allnews', s.ad_allnews);
    }
    if (s.ad_article) window._adArticleData = s.ad_article;
    // Custom banners (user-added at arbitrary locations with stacking)
    if (s.custom_banners) _applyCustomBanners(s.custom_banners);
    // Article interactions (per-button toggles) — apply if an article is currently open
    if (document.getElementById('article-page')?.style.display === 'block') {
      _applyInteractionToggles();
      // Re-render related news too, in case count or toggle changed
      if (window._currentArticle) renderSuggestedNews(window._currentArticle);
    }

    // Breaking state changed → re-check
    checkBreaking();

    // Wide pinned changed → re-render
    renderSite();
  }, err => console.warn('[FB] site:', err));
}

// ─── NEWSLETTER SUBSCRIPTION ─────────────────────────────────────
async function subscribeNewsletter() {
  const inp = document.getElementById('nl-email-input');
  const btn = document.getElementById('nl-submit-btn');
  if (!inp || !inp.value.trim()) { inp && inp.focus(); return; }
  const email = inp.value.trim().toLowerCase();
  // Basic validation
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    inp.style.borderColor = 'var(--red)';
    setTimeout(() => inp.style.borderColor = '', 2000);
    return;
  }
  if (btn) { btn.textContent = '⏳ جاري...'; btn.disabled = true; }
  try {
    await addDoc(collection(_db, 'subscribers'), {
      email,
      subscribedAt: serverTimestamp(),
      source: 'newsletter'
    });
    inp.value = '';
    if (btn) { btn.textContent = '✅ تم الاشتراك!'; btn.style.background = 'var(--green)'; }
    setTimeout(() => {
      if (btn) { btn.textContent = 'اشترك الآن'; btn.style.background = ''; btn.disabled = false; }
    }, 3000);
  } catch(e) {
    console.error('Subscribe error:', e);
    if (btn) { btn.textContent = '⚠️ حدث خطأ'; btn.disabled = false; }
    setTimeout(() => { if (btn) btn.textContent = 'اشترك الآن'; }, 2000);
  }
}

// ─── CONTACT US MODAL ────────────────────────────────────────────
function openContactModal() {
  const m = document.getElementById('contact-modal');
  if (m) {
    m.style.display = 'flex';
    document.getElementById('contact-success').style.display = 'none';
    document.getElementById('contact-error').style.display = 'none';
    setTimeout(() => document.getElementById('cf-name')?.focus(), 60);
  }
}
function closeContactModal() {
  const m = document.getElementById('contact-modal');
  if (m) m.style.display = 'none';
}
async function submitContact() {
  const get = id => (document.getElementById(id)?.value || '').trim();
  const name    = get('cf-name');
  const email   = get('cf-email');
  const mobile  = get('cf-mobile');
  const subject = get('cf-subject');
  const message = get('cf-message');
  const errEl   = document.getElementById('contact-error');
  const okEl    = document.getElementById('contact-success');
  const showErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; okEl.style.display = 'none'; };
  // Validate required fields
  if (!name)    return showErr('⚠️ الرجاء إدخال الاسم');
  if (!email)   return showErr('⚠️ الرجاء إدخال البريد الإلكتروني');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr('⚠️ البريد الإلكتروني غير صالح');
  if (!message) return showErr('⚠️ الرجاء إدخال رسالتك');
  const btn = document.querySelector('.contact-submit-btn');
  if (btn) { btn.textContent = '⏳ جارٍ الإرسال...'; btn.disabled = true; }
  errEl.style.display = 'none';
  try {
    await addDoc(collection(_db, 'contact_messages'), {
      name, email, mobile, subject, message,
      read: false,
      createdAt: serverTimestamp(),
      userAgent: navigator.userAgent || '',
    });
    ['cf-name','cf-email','cf-mobile','cf-subject','cf-message'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    okEl.style.display = 'block';
    if (btn) { btn.textContent = 'إرسال الرسالة'; btn.disabled = false; }
    setTimeout(closeContactModal, 2500);
  } catch(e) {
    console.error('Contact submit error:', e);
    showErr('⚠️ حدث خطأ. الرجاء المحاولة مرة أخرى.');
    if (btn) { btn.textContent = 'إرسال الرسالة'; btn.disabled = false; }
  }
}
window.openContactModal  = openContactModal;
window.closeContactModal = closeContactModal;
window.submitContact     = submitContact;

// ─── SHOW MORE (main page — loads 6 more after main grid) ────────
function _updateShowMoreBtn() {
  const pub = getNewsData().filter(n => n.status === 'منشور');
  const hero = pub.find(n => n.priority==='عاجل') || pub[pub.length-1] || pub[0];
  const pinnedId = _fb.site ? _fb.site.wide_pinned : null;
  const feat = (pinnedId ? pub.find(n => String(n.id)===String(pinnedId)) : null)
             || pub.find(n => n.priority==='مميز' && n!==hero) || null;
  const pool = pub.filter(n => n!==hero && n!==feat);
  _newsOffset = 6;
  const smGrid = document.getElementById('show-more-grid');
  if (smGrid) smGrid.innerHTML = '';
  const wrap = document.getElementById('show-more-wrap');
  const btn  = document.getElementById('show-more-btn');
  if (wrap) wrap.style.display = pool.length > 6 ? 'block' : 'none';
  if (btn)  btn.style.display  = 'block';
}

function showMoreNews() {
  const pub = getNewsData().filter(n => n.status === 'منشور');
  const hero = pub.find(n => n.priority==='عاجل') || pub[pub.length-1] || pub[0];
  const pinnedId = _fb.site ? _fb.site.wide_pinned : null;
  const feat = (pinnedId ? pub.find(n => String(n.id)===String(pinnedId)) : null)
             || pub.find(n => n.priority==='مميز' && n!==hero) || null;
  const pool  = pub.filter(n => n!==hero && n!==feat);
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

// ─── FOOTER COLUMN RENDERER ──────────────────────────────────────────
// Store full footer item objects (keyed by footer-custom-ID) so openArticle
// can show the correct title, content, and respect commentsEnabled toggle.
window._footerItems = window._footerItems || {};

function _applyFooterCol(colId, items) {
  const ul = document.getElementById(colId);
  if (!ul || !items) return;
  // Derive a short column tag from the UL id (e.g., "footer-col-company" → "company")
  // so items in different columns never collide on the same ID.
  const colTag = colId.replace(/^footer-col-/,'') || 'col';
  ul.innerHTML = items.filter(i => i.active !== false).map(item => {
    const customKey = 'footer-custom-' + colTag + '-' + (item.id||0);
    // Cache the full item so openFooterNewWin can read label/content/commentsEnabled
    window._footerItems[customKey] = item;
    const onclick = item.url && item.url.startsWith('http')
      ? `window.open('${item.url}','_blank','noopener');return false`
      : item.url && item.url.startsWith('#filter:')
        ? `navFilter('${item.url.replace('#filter:','')}',null);window.scrollTo({top:0,behavior:'smooth'});return false`
        : `openFooterNewWin('${customKey}');return false`;
    if (item.url && item.url.startsWith('http')) {
      window._footerLinks[customKey] = item.url;
    }
    const icon = item.icon ? item.icon + ' ' : '';
    return `<li><a href="#" onclick="${onclick}">${icon}${item.label||''}</a></li>`;
  }).join('');
}

// Close mobile menu when a link is clicked
document.addEventListener('click', function(e) {
  const link = e.target.closest('#nav-links a');
  if (link) {
    const links = document.getElementById('nav-links');
    if (links && links.classList.contains('mobile-open')) {
      links.classList.remove('mobile-open');
      const bars = document.querySelectorAll('#nav-hamburger div');
      bars.forEach(b => { b.style.transform = ''; b.style.opacity = '1'; });
    }
  }
});


// ─── TRENDING NEWS ───────────────────────────────────────────────
function renderTrending() {
  const pub = getNewsData().filter(n => n.status === 'منشور');
  // Primary: explicit priority === 'trending' (from admin priority dropdown)
  // Legacy:  n.trending === true (old checkbox flag)
  let all = pub.filter(n => n.priority === 'trending' || n.trending === true || n.alsoTrending === true);
  // Sort newest-first (id = Date.now() timestamp at creation, so descending = newest first)
  all.sort((a, b) => (Number(b.id)||0) - (Number(a.id)||0));
  if (!all.length) {
    // Fallback: top 8 by view count from published news
    all = [...pub].sort((a,b) => {
      const av = parseInt((a.views||'0').replace(/[^0-9]/g,''))||0;
      const bv = parseInt((b.views||'0').replace(/[^0-9]/g,''))||0;
      return bv - av;
    }).slice(0, 8);
  }
  const section = document.getElementById('trending-section');
  const scroll  = document.getElementById('trending-scroll');
  if (!section || !scroll) return;
  const trendingOff = window._trendingOff === true;
  if (!all.length || trendingOff) { section.style.display = 'none'; return; }
  section.style.display = '';
  scroll.innerHTML = all.map(n => {
    _reg(n);
    const m = catMeta(n.cat);
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
  // RTL start: scroll to the rightmost edge so the newest (first) card is visible first
  // Use a tiny delay so browsers have laid out the container before we measure scrollWidth.
  setTimeout(() => {
    if (scroll) scroll.scrollLeft = scroll.scrollWidth;
    _renderScrollDots('trending-scroll', 'trending-dots');
  }, 30);
}
function scrollTrending(dir) {
  const s = document.getElementById('trending-scroll');
  if (s) s.scrollBy({left: dir * 220, behavior: 'smooth'});
}
window.scrollTrending = scrollTrending;

// ─── SCROLL POSITION DOTS (under trending + related scrollers) ─────
function _renderScrollDots(scrollId, dotsId) {
  const scroll = document.getElementById(scrollId);
  const dots   = document.getElementById(dotsId);
  if (!scroll || !dots) return;
  const update = () => {
    const cards   = scroll.children.length;
    if (cards === 0) { dots.innerHTML = ''; return; }
    // One dot per card up to 8 (more cards = grouped)
    const dotCount = Math.min(cards, 8);
    // Compute current dot from scroll position. RTL: scrollLeft becomes negative or odd —
    // use absolute scroll position normalized over scroll range.
    const range = scroll.scrollWidth - scroll.clientWidth;
    const pos   = Math.abs(scroll.scrollLeft);
    const ratio = range > 0 ? pos / range : 0;
    const active = Math.round(ratio * (dotCount - 1));
    let html = '';
    for (let i = 0; i < dotCount; i++) {
      html += `<div class="dot${i === active ? ' active' : ''}" data-idx="${i}"></div>`;
    }
    dots.innerHTML = html;
    // Click-to-jump
    dots.querySelectorAll('.dot').forEach(d => {
      d.onclick = () => {
        const i = Number(d.dataset.idx);
        const targetRatio = dotCount > 1 ? i / (dotCount - 1) : 0;
        scroll.scrollTo({ left: targetRatio * range * (scroll.scrollLeft < 0 ? -1 : 1), behavior: 'smooth' });
      };
    });
  };
  update();
  // Keep dots in sync as user scrolls
  if (!scroll._dotsBound) {
    scroll._dotsBound = true;
    scroll.addEventListener('scroll', () => {
      // Throttle via rAF
      if (scroll._dotsRaf) cancelAnimationFrame(scroll._dotsRaf);
      scroll._dotsRaf = requestAnimationFrame(update);
    }, { passive: true });
  }
}

// ─── BOOKMARKS ────────────────────────────────────────────────────────
function toggleBookmark() {
  const art = window._currentArticle;
  if (!art) return;
  try {
    let saved = JSON.parse(localStorage.getItem('atq_bookmarks') || '[]');
    const exists = saved.find(x => String(x.id) === String(art.id));
    const btn = document.getElementById('bookmark-btn');
    if (exists) {
      saved = saved.filter(x => String(x.id) !== String(art.id));
      if (btn) btn.textContent = '🔖 حفظ';
      showToast('تم إزالة الخبر من المحفوظات');
    } else {
      saved.unshift({id:art.id, title:art.title, cat:art.cat, date:art.date, thumbnail:art.thumbnail||''});
      if (saved.length > 50) saved = saved.slice(0, 50);
      if (btn) btn.textContent = '✅ محفوظ';
      showToast('✅ تم حفظ الخبر — اقرأه لاحقاً');
    }
    localStorage.setItem('atq_bookmarks', JSON.stringify(saved));
  } catch(_) {}
}
function _updateBookmarkBtn(article) {
  const btn = document.getElementById('bookmark-btn');
  if (!btn) return;
  try {
    const saved = JSON.parse(localStorage.getItem('atq_bookmarks') || '[]');
    btn.textContent = saved.find(x => String(x.id) === String(article.id)) ? '✅ محفوظ' : '🔖 حفظ';
  } catch(_) { btn.textContent = '🔖 حفظ'; }
}
function showToast(msg) {
  // simple toast if not already defined
  if (typeof window._showToast === 'function') { window._showToast(msg); return; }
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:28px;right:28px;background:var(--dark-3);border:1px solid var(--border);color:var(--text);padding:10px 20px;border-radius:10px;font-size:13px;z-index:9999;direction:rtl;font-family:inherit;box-shadow:0 4px 20px rgba(0,0,0,0.4)';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ─── MOBILE NAV ──────────────────────────────────────────────────────
function toggleMobileNav() {
  const links = document.getElementById('nav-links');
  const btn   = document.getElementById('nav-hamburger');
  if (!links) return;
  const open = links.classList.toggle('mobile-open');
  if (btn) btn.style.opacity = open ? '1' : '';
  // Close on outside click
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

// Mobile-only: expand the search icon into a full-width overlay on tap
function _toggleMobileSearch(ev) {
  // Only meaningful on small screens (where the icon-only style applies)
  if (window.innerWidth > 768) return;
  const box = document.getElementById('search-box');
  if (!box) return;
  const wasExpanded = box.classList.contains('mobile-expanded');
  if (wasExpanded) return; // let input take clicks when already expanded
  box.classList.add('mobile-expanded');
  const inp = box.querySelector('input');
  if (inp) setTimeout(() => inp.focus(), 50);
  // Close when tapping outside
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
window._toggleMobileSearch = _toggleMobileSearch;

// ─── AUTO-COLLAPSE NAV — switches to hamburger whenever the menu overflows ──────
// Runs on load, on window resize, and whenever nav menu items change.
function _autoCollapseNav() {
  const nav    = document.querySelector('nav');
  const logo   = nav ? nav.querySelector('.nav-logo') : null;
  const links  = document.getElementById('nav-links');
  const right  = nav ? nav.querySelector('.nav-right') : null;
  const hamb   = document.getElementById('nav-hamburger');
  if (!nav || !logo || !links || !right) return;

  // Temporarily force desktop mode to measure true widths
  const wasCollapsed = document.body.classList.contains('nav-collapsed');
  document.body.classList.remove('nav-collapsed');
  links.style.visibility = 'hidden';
  links.classList.remove('mobile-open');
  links.style.display = 'flex';

  // Measure
  const navW    = nav.clientWidth;
  const logoW   = logo.offsetWidth;
  const rightW  = right.offsetWidth;
  // Sum widths of each <li> inside links
  let linksW = 0;
  links.querySelectorAll('li').forEach(li => { linksW += li.offsetWidth; });
  // Add gap (approx) — 20px per gap between logo/links/right blocks + internal li gap
  const needed = logoW + linksW + rightW + 80;

  // Restore
  links.style.visibility = '';
  links.style.display = '';

  // Apply decision
  if (needed > navW) {
    document.body.classList.add('nav-collapsed');
  } else {
    document.body.classList.remove('nav-collapsed');
    // Ensure menu closes if it was open in mobile style
    links.classList.remove('mobile-open');
    if (hamb) hamb.style.opacity = '';
  }
  // No-op but avoid unused var
  void wasCollapsed;
}

// Run on load and resize (debounced)
(function() {
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

// ─── ALL NEWS FULL PAGE ────────────────────────────────────────────
function openAllNewsPage() {
  const page = document.getElementById('all-news-page');
  if (!page) return;
  // If an article overlay is open, close it first
  const art = document.getElementById('article-page');
  if (art && art.style.display === 'block') closeArticle();
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
  page.scrollTop = 0;
  document.body.style.overflow = 'hidden';
  document.querySelectorAll('#nav-links a').forEach(a => a.classList.remove('active'));
  const btn = document.getElementById('nav-allnews');
  if (btn) btn.classList.add('active');
  // Apply the all-news ad banner (admin-controlled)
  const adData = (_fb && _fb.site && _fb.site.ad_allnews) || window._adAllnewsData;
  if (adData && typeof _applyAdBanner === 'function') {
    _applyAdBanner('allnews', adData);
  }
}

function closeAllNewsPage() {
  const page = document.getElementById('all-news-page');
  if (!page) return;
  page.style.display = 'none';
  document.body.style.overflow = '';
  document.querySelectorAll('#nav-links a').forEach(a => a.classList.remove('active'));
  const na = document.getElementById('nav-all');
  if (na) na.classList.add('active');
}

function renderAllNewsPage() {
  const pub = getNewsData().filter(n => n.status === 'منشور');
  const q   = (document.getElementById('all-news-search')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('all-news-cat-filter')?.value || '';
  let filtered = [...pub].sort((a,b) => Number(b.id||0) - Number(a.id||0));
  if (q)   filtered = filtered.filter(n =>
    n.title.toLowerCase().includes(q) || (n.excerpt||'').toLowerCase().includes(q));
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
  if (!grid)  return;
  grid.innerHTML = filtered.map(n => _makeCard(n)).join('');
}

// Shared card builder used by show-more, all-news, and suggested
function _makeCard(n) {
  _reg(n);
  const m     = catMeta(n.cat);
  const thumb = n.thumbnail
    ? '<img src="' + n.thumbnail + '" style="width:100%;height:100%;object-fit:cover" alt="">'
    : m.icon;
  return '<div class="news-card" onclick="openById(' + n.id + ')">' +
    '<div class="card-img"><div class="card-img-inner" style="background:' + m.bg + '">' + thumb + '</div></div>' +
    '<div class="card-body">' +
      '<div class="card-tags"><span class="tag ' + m.cls + '">' + n.cat + '</span>' +
        (n.priority==='عاجل' ? '<span class="tag tag-red">عاجل</span>' : '') +
      '</div>' +
      '<div class="card-title">' + n.title + '</div>' +
      '<p class="card-excerpt">' + _stripTags(n.excerpt||'') + '</p>' +
      '<div class="card-footer">' +
        '<div class="card-author">' +
          '<div class="author-avatar" style="background:rgba(201,168,76,0.15);color:var(--gold)">' +
            (n.author ? n.author[0] : 'م') + '</div>' +
          '<span class="card-author-name">' + (n.author||'') + '</span>' +
        '</div>' +
        '<span class="card-time">' + (n.date||'') + '</span>' +
      '</div>' +
    '</div></div>';
}


// ─── SUGGESTED / RELATED NEWS ────────────────────────────────────
function renderSuggestedNews(article) {
  const wrap   = document.getElementById('article-suggested');
  const scroll = document.getElementById('suggested-scroll');
  if (!wrap || !scroll) return;
  // Admin-disabled? hide the section entirely
  if (window._relatedEnabled === false) { wrap.style.display = 'none'; return; }
  const pub = getNewsData().filter(n => n.status === 'منشور' && String(n.id) !== String(article.id));
  // Prioritize same category, then latest overall
  const sameCat = pub.filter(n => n.cat === article.cat);
  const others  = pub.filter(n => n.cat !== article.cat);
  const count   = Math.max(1, Math.min(20, Number(window._relatedCount) || 8));
  const pool    = [...sameCat, ...others].slice(0, count);
  if (!pool.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  scroll.innerHTML = pool.map(n => {
    _reg(n);
    const m = catMeta(n.cat);
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
    scroll.scrollLeft = scroll.scrollWidth; // RTL start
    _renderScrollDots('suggested-scroll', 'suggested-dots');
  }, 30);
}

// ================================================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE (required for type="module")
// ================================================================
window.clearCatFilter      = clearCatFilter;
window.openFooterLink      = openFooterLink;
window.openAllNewsPage     = openAllNewsPage;
window.toggleMobileNav     = toggleMobileNav;
window.toggleBookmark      = toggleBookmark;
window.showMoreNews        = showMoreNews;
window.subscribeNewsletter = subscribeNewsletter;
window.renderSuggestedNews = renderSuggestedNews;

// ── Smooth image loading ────────────────────────────────────────
document.addEventListener('load', function(e) {
  if (e.target.tagName === 'IMG') e.target.classList.add('loaded');
}, true);
// Mark already-loaded images
document.querySelectorAll('img').forEach(img => {
  if (img.complete) img.classList.add('loaded');
});
window.closeAllNewsPage    = closeAllNewsPage;
window.renderAllNewsPage   = renderAllNewsPage;
window.openFooterNewWin    = openFooterNewWin;
window.submitComment       = submitComment;
window.closeArticle        = closeArticle;
window.closeBreaking       = closeBreaking;
window.filterByCat         = filterByCat;
window.liveSearch          = liveSearch;
window.navFilter           = navFilter;
window.openArticleFromEl   = openArticleFromEl;
window.openArticleFromWide = openArticleFromWide;
window.openById            = openById;
window.openArticle         = openArticle;
window.scrollToTop         = scrollToTop;
window.shareArticle        = shareArticle;
window.toggleArticleLike   = toggleArticleLike;
window.toggleLang          = toggleLang;
window.toggleTheme         = toggleTheme;
// CRITICAL: called from inline onclick="_closeMobileNav();navFilter(...)" on every nav link.
// Without this, the entire onclick chain throws ReferenceError and the menu appears dead.
window._closeMobileNav     = _closeMobileNav;


