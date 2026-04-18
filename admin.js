import { FIREBASE_CONFIG, DB, VERSION } from '../../config.js';
import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, onSnapshot, query, orderBy }
         from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const _fbApp = initializeApp(FIREBASE_CONFIG);
const _db    = getFirestore(_fbApp);

// ── Low-level Firebase helpers ────────────────────────────────

// Save one news article doc: news/{id}
async function _fbSetNews(item) {
  try {
    const d = JSON.parse(JSON.stringify(item)); // strip undefined values
    if (!d.id) return;
    await setDoc(doc(_db, DB.NEWS, String(d.id)), d);
  } catch(e) { console.warn('[FB] setNews:', e); }
}

// Delete one news article doc: news/{id}
async function _fbDelNews(id) {
  try { await deleteDoc(doc(_db, DB.NEWS, String(id))); }
  catch(e) { console.warn('[FB] delNews:', e); }
}

// Save a settings document: settings/{key}
async function _fbSetSetting(key, data) {
  try { await setDoc(doc(_db, DB.SETTINGS, key), data); }
  catch(e) { console.warn('[FB] setSetting', key, e); }
}

// Read a settings document
async function _fbGetSetting(key) {
  try {
    const snap = await getDoc(doc(_db, DB.SETTINGS, key));
    return snap.exists() ? snap.data() : null;
  } catch(e) { console.warn('[FB] getSetting', key, e); return null; }
}

// Early load of the login-screen customization (so placeholder text on the
// login screen reflects the admin's saved content even before they log in).
(async () => {
  try {
    const site = await _fbGetSetting(DB.S.SITE);
    if (site && site.login_screen) {
      _siteSettingsCache = _siteSettingsCache || {};
      _siteSettingsCache.login_screen = site.login_screen;
      // Apply after DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => applyLoginScreenFromCache());
      } else {
        applyLoginScreenFromCache();
      }
    }
  } catch(_) { /* silent — login screen just uses defaults */ }
})();

// Save the site settings doc (wide_pinned, site_buttons, ticker, etc.)
// Merges with existing to avoid overwriting unrelated fields
let _siteSettingsCache = {};
async function _fbUpdateSite(updates) {
  Object.assign(_siteSettingsCache, updates);
  await _fbSetSetting(DB.S.SITE, _siteSettingsCache);
}


// ═══════════════════════════════════════════════════════════════
// DATA & LOCALSTORAGE
// ═══════════════════════════════════════════════════════════════
const DEF_NEWS = [
  {id:1,  title:'GPT-5 يُحقق أداءً يفوق البشر في 87% من الاختبارات', cat:'الذكاء الاصطناعي', author:'أحمد الرشيدي',    date:'٢٠٢٥/٠٤/٠٥', views:'٢٤,٥٠٠', status:'منشور', priority:'عاجل',  excerpt:'أعلنت شركة OpenAI عن إطلاق نموذجها الجديد GPT-5.'},
  {id:2,  title:'كيف ستُعيد الروبوتات رسم ملامح سوق العمل العالمي',  cat:'الذكاء الاصطناعي', author:'د. سارة المنصوري', date:'٢٠٢٥/٠٤/٠٤', views:'١٨,٢٠٠', status:'منشور', priority:'مميز',  excerpt:'تقرير حول تأثير الأتمتة والذكاء الاصطناعي على الوظائف.'},
  {id:3,  title:'ناسا تعلن اكتشاف مواد عضوية على سطح المريخ',        cat:'الفضاء والعلوم',    author:'خالد العتيبي',    date:'٢٠٢٥/٠٤/٠٤', views:'١٢,٧٠٠', status:'منشور', priority:'عادي',  excerpt:'اكتشاف يعيد رسم خارطة البحث عن الحياة في الفضاء.'},
  {id:4,  title:'بطارية CATL توفر شحناً كاملاً في ٥ دقائق',          cat:'السيارات الكهربائية',author:'منى الزهراني',   date:'٢٠٢٥/٠٤/٠٣', views:'٩,٤٠٠',  status:'منشور', priority:'عادي',  excerpt:'تقنية ثورية تنهي أزمة شحن السيارات الكهربائية.'},
  {id:5,  title:'هجوم إلكتروني ضخم يستهدف المصارف الأوروبية',        cat:'الأمن الرقمي',      author:'عمر الحسيني',    date:'٢٠٢٥/٠٤/٠٢', views:'٧,٨٠٠',  status:'منشور', priority:'عاجل',  excerpt:'موجة هجمات تستخدم أدوات ذكاء اصطناعي.'},
  {id:6,  title:'آبل تختبر iPhone بشاشة قابلة للطي',                  cat:'الهواتف والأجهزة',  author:'فيصل الدوسري',   date:'٢٠٢٥/٠٤/٠١', views:'٦,٢٠٠',  status:'مسودة',  priority:'عادي',  excerpt:'صور مسربة تكشف عن نموذج أولي.'},
  {id:7,  title:'PlayStation 6 رسمياً بقدرات 8K',                     cat:'ألعاب الفيديو',     author:'نورة السبيعي',   date:'٢٠٢٥/٠٣/٣١', views:'٥,١٠٠',  status:'مؤرشف',  priority:'عادي',  excerpt:'سوني تعلن تفاصيل الجيل القادم.'},
];
const DEF_LATEST = [
  {id:1, text:'جوجل تطلق Gemini 2.0 بقدرات متطورة',              status:'نشط'},
  {id:2, text:'آبل تؤكد موعد مؤتمر WWDC 2025 في يونيو المقبل',   status:'نشط'},
  {id:3, text:'سام ألتمان يكشف خطط GPT-5',                        status:'نشط'},
  {id:4, text:'تسلا تختبر روبوت Optimus في مصانعها',               status:'نشط'},
  {id:5, text:'مايكروسوفت تستثمر 80 مليار دولار في الذكاء الاصطناعي', status:'نشط'},
];
const DEF_BREAKING = [
  {id:1, text:'جوجل تطلق Gemini 2.0 بقدرات متطورة في التفكير متعدد الخطوات', active:false},
  {id:2, text:'آبل تؤكد موعد مؤتمر WWDC 2025 في يونيو المقبل',              active:false},
];

let newsData     = [];
let latestData   = [];
let breakingData = [];
let catsData = [
  {id:1,name:'الذكاء الاصطناعي', slug:'ai',       icon:'🤖',color:'#4A9EFF',desc:'أخبار الذكاء الاصطناعي',articles:82},
  {id:2,name:'الهواتف والأجهزة', slug:'devices',  icon:'📱',color:'#3DDC84',desc:'أحدث الهواتف والأجهزة',articles:54},
  {id:3,name:'الفضاء والعلوم',   slug:'space',    icon:'🚀',color:'#A078FF',desc:'اكتشافات الفضاء',articles:38},
  {id:4,name:'الأمن الرقمي',     slug:'security', icon:'🛡️',color:'#FF5252',desc:'الأمن السيبراني',articles:31},
  {id:5,name:'الشركات والأعمال', slug:'business', icon:'💼',color:'#C9A84C',desc:'أخبار الشركات',articles:47},
  {id:6,name:'ألعاب الفيديو',    slug:'gaming',   icon:'🎮',color:'#FF9A3C',desc:'صناعة الألعاب',articles:29},
  {id:7,name:'السيارات الكهربائية',slug:'ev',     icon:'🔋',color:'#40C8F0',desc:'السيارات الكهربائية',articles:22},
  {id:8,name:'الروبوتات',        slug:'robots',   icon:'🦾',color:'#3DDC84',desc:'الروبوتات والأتمتة',articles:17},
  {id:9,name:'التقنية الحيوية',  slug:'biotech',  icon:'🧬',color:'#A078FF',desc:'التقنية الحيوية',articles:14},
];
let editorsData = [
  {id:1,name:'أحمد الرشيدي',    user:'ahmed.r',  pass:'editor123', email:'ahmed@alahdat.tech',  role:'مدير', dept:'كل الأقسام',         articles:89,color:'#C9A84C',canAddNews:true,active:true},
  {id:2,name:'د. سارة المنصوري',user:'sara.m',   pass:'editor456', email:'sara@alahdat.tech',   role:'محرر', dept:'الذكاء الاصطناعي',    articles:63,color:'#4A9EFF',canAddNews:true,active:true},
  {id:3,name:'خالد العتيبي',     user:'khalid.a', email:'khalid@alahdat.tech', role:'محرر', dept:'الفضاء والعلوم',      articles:41,color:'#A078FF'},
  {id:4,name:'منى الزهراني',     user:'mona.z',   email:'mona@alahdat.tech',   role:'كاتب', dept:'السيارات الكهربائية', articles:28,color:'#3DDC84'},
  {id:5,name:'عمر الحسيني',      user:'omar.h',   email:'omar@alahdat.tech',   role:'محرر', dept:'الأمن الرقمي',        articles:35,color:'#FF5252'},
  {id:6,name:'فيصل الدوسري',     user:'faisal.d', email:'faisal@alahdat.tech', role:'كاتب', dept:'الهواتف والأجهزة',    articles:19,color:'#FF9A3C'},
];

let _delTarget = null;
let _delType   = null;
let _selColor  = '#4A9EFF';
let _curUser   = {name:'المدير العام', avatar:'أ'};

function saveAll() {
  // 1. localStorage (instant, keeps admin UI fast)
  localStorage.setItem('atq_news',     JSON.stringify(newsData));
  localStorage.setItem('atq_latest',   JSON.stringify(latestData));
  localStorage.setItem('atq_breaking', JSON.stringify(breakingData));
  localStorage.setItem('atq_cats',     JSON.stringify(catsData));
  // 2. Firestore (async background — index.html reads from here)
  _fbSetSetting(DB.S.LATEST,   { items: latestData });
  _fbSetSetting(DB.S.BREAKING, { items: breakingData });
  _fbSetSetting(DB.S.CATS,     { items: catsData });
  // Note: individual news docs saved via _fbSetNews() in saveNews() etc.
}

function loadAll() {
  // Load from localStorage immediately (fast, for UI)
  try { newsData     = JSON.parse(localStorage.getItem('atq_news'))     || DEF_NEWS;    } catch(e) { newsData     = DEF_NEWS;    }
  try { latestData   = JSON.parse(localStorage.getItem('atq_latest'))   || DEF_LATEST;  } catch(e) { latestData   = DEF_LATEST;  }
  try { breakingData = JSON.parse(localStorage.getItem('atq_breaking')) || DEF_BREAKING;} catch(e) { breakingData = DEF_BREAKING;}
  try { const sc = JSON.parse(localStorage.getItem('atq_cats')); if(sc&&sc.length) catsData = sc; } catch(e) {}
  // Then refresh from Firestore (authoritative source)
  _loadAllFromFirestore();
}

async function _loadAllFromFirestore() {
  try {
    // Load news collection
    const newsSnap = await getDocs(collection(_db, DB.NEWS));
    const fbNews = [];
    newsSnap.forEach(d => { const data = d.data(); if (data && data.title) fbNews.push(data); });
    fbNews.sort((a,b) => Number(b.id||0) - Number(a.id||0));
    if (fbNews.length) {
      newsData = fbNews;
      localStorage.setItem('atq_news', JSON.stringify(newsData));
    } else if (newsData.length && newsData !== DEF_NEWS) {
      // Firestore empty but localStorage has real data → push it up
      newsData.forEach(item => _fbSetNews(item));
    }

    // Load settings
    const [fbLatest, fbBreaking, fbCats, fbSite] = await Promise.all([
      _fbGetSetting(DB.S.LATEST),
      _fbGetSetting(DB.S.BREAKING),
      _fbGetSetting(DB.S.CATS),
      _fbGetSetting(DB.S.SITE),
    ]);

    if (fbLatest?.items)   { latestData   = fbLatest.items;   localStorage.setItem('atq_latest',   JSON.stringify(latestData)); }
    else if (latestData.length)  _fbSetSetting(DB.S.LATEST,   { items: latestData });

    if (fbBreaking?.items) { breakingData = fbBreaking.items; localStorage.setItem('atq_breaking', JSON.stringify(breakingData)); }
    else if (breakingData.length) _fbSetSetting(DB.S.BREAKING, { items: breakingData });

    if (fbCats?.items)     { catsData     = fbCats.items;     localStorage.setItem('atq_cats',     JSON.stringify(catsData)); }
    else if (catsData.length)    _fbSetSetting(DB.S.CATS,     { items: catsData });

    // Restore site settings cache
    if (fbSite) {
      _siteSettingsCache = fbSite;
      // Re-apply site settings to admin UI
      if (fbSite.wide_pinned) localStorage.setItem('atq_wide_pinned', String(fbSite.wide_pinned));
      if (fbSite.site_buttons) localStorage.setItem('atq_site_buttons', JSON.stringify(fbSite.site_buttons));
      if (fbSite.ticker_speed) localStorage.setItem('atq_ticker_speed', String(fbSite.ticker_speed));
      if (fbSite.ticker_visible !== undefined) localStorage.setItem('atq_ticker_visible', fbSite.ticker_visible ? '1' : '0');
      if (fbSite.site_title)    localStorage.setItem('atq_site_title', fbSite.site_title);
      if (fbSite.subscribe_text) localStorage.setItem('atq_subscribe_text', fbSite.subscribe_text);
    } else {
      // Push current localStorage site settings to Firestore
      _syncSiteSettingsToFirestore();
    }

    // Refresh admin UI with latest data
    renderNewsTable(newsData);
    renderCats(); renderLatest(); renderBreaking();
    refreshAuthorSelect(); buildChart(); loadPageControls();
  } catch(e) { console.warn('[FB] loadAll error:', e); }
}

function _syncSiteSettingsToFirestore() {
  const s = {};
  const wb = localStorage.getItem('atq_wide_pinned');  if (wb) s.wide_pinned = wb;
  const sb = localStorage.getItem('atq_site_buttons'); if (sb) try { s.site_buttons = JSON.parse(sb); } catch(_) {}
  const ts = localStorage.getItem('atq_ticker_speed'); if (ts) s.ticker_speed = Number(ts);
  const tv = localStorage.getItem('atq_ticker_visible'); s.ticker_visible = tv !== '0';
  const st = localStorage.getItem('atq_site_title');    if (st) s.site_title = st;
  const su = localStorage.getItem('atq_subscribe_text'); if (su) s.subscribe_text = su;
  if (Object.keys(s).length) { _siteSettingsCache = {..._siteSettingsCache, ...s}; _fbSetSetting(DB.S.SITE, _siteSettingsCache); }
}

// ─── LOGIN ────────────────────────────────────────────────────
const USERS = {admin:'admin123', editor:'editor456'};

function _getPasswords() {
  // Start with default admin users
  let passwords = {...USERS};
  // Merge stored overrides (password changes)
  try {
    const stored = JSON.parse(localStorage.getItem('atq_user_passwords'));
    if (stored && typeof stored === 'object') passwords = {...passwords, ...stored};
  } catch(_) {}
  // Add ALL active editors with credentials from editorsData
  if (typeof editorsData !== 'undefined') {
    editorsData.forEach(e => {
      if (e.active !== false && e.user && e.pass) {
        passwords[e.user] = e.pass;
      }
    });
  }
  return passwords;
}

function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  const passwords = _getPasswords();
  if (passwords[u] && passwords[u] === p) {
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    // Determine role — admin user is always مدير; other users inherit from editorsData
    let role = 'مدير';
    let displayName = 'المدير العام';
    if (u !== 'admin') {
      const ed = (typeof editorsData !== 'undefined')
        ? editorsData.find(e => e.user === u)
        : null;
      if (ed) {
        role = ed.role || 'محرر';
        displayName = ed.name || u;
      } else {
        role = 'محرر';
        displayName = 'محرر';
      }
    }
    _curUser = {name: displayName, avatar: u[0].toUpperCase(), role: role, username: u};
    document.getElementById('sidebar-name').textContent   = _curUser.name;
    document.getElementById('sidebar-avatar').textContent = _curUser.avatar;
    // Show role in sidebar user card (if a slot exists)
    const roleBadge = document.getElementById('sidebar-role');
    if (roleBadge) roleBadge.textContent = role;
    initDashboard();
    applyRolePermissions();
    // Re-apply once Firebase async loads have settled (editorsData may refresh)
    setTimeout(applyRolePermissions, 400);
    setTimeout(applyRolePermissions, 1500);
    // Re-apply per-editor section filter (allowedCats) after async editorsData load
    const _refreshEditorScope = () => {
      if (typeof refreshNewsCatDropdown === 'function') refreshNewsCatDropdown();
      if (typeof newsData !== 'undefined' && typeof renderNewsTable === 'function') renderNewsTable(newsData);
    };
    _refreshEditorScope();
    setTimeout(_refreshEditorScope, 500);
    setTimeout(_refreshEditorScope, 1600);
  } else {
    document.getElementById('login-error').style.display = 'block';
    document.getElementById('login-pass').value = '';
  }
}
document.getElementById('login-pass').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
document.getElementById('login-user').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });

function doLogout() {
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  ['login-user','login-pass'].forEach(id => document.getElementById(id).value = '');
  // Restore all sidebar items so next login sees everything before filtering
  document.querySelectorAll('.sidebar-nav .nav-item, .sidebar-nav .nav-section-title, .sidebar-nav .divider').forEach(el => {
    el.style.display = '';
  });
}

// ─── ROLE-BASED PERMISSIONS ───────────────────────────────────────
// Pages each role can access (page IDs used by showPage()).
// مدير  = full access (everything)
// محرر  = content + analytics + site content (no user management, no global settings)
// كاتب  = only own content (news + analytics of own work)
const ROLE_PERMS = {
  'مدير': null, // null = access to everything (no filtering)
  'محرر': [
    'overview','news','categories','latest','breaking',
    'pagecontrols','general-settings','footer-control','ads-manager','nav-links-manager','identity',
    'analytics','subscribers','inbox'
  ],
  'كاتب': [
    'overview','news','analytics'
  ],
};

// Maps page IDs to their sidebar nav onclick signature so we can find the <a>
function applyRolePermissions() {
  const role = _curUser && _curUser.role ? _curUser.role : 'مدير';
  const allowed = ROLE_PERMS[role];
  // Always reset first (in case of re-apply)
  document.querySelectorAll('.sidebar-nav .nav-item, .sidebar-nav .nav-section-title, .sidebar-nav .divider').forEach(el => {
    el.style.display = '';
  });
  if (!allowed) return; // مدير — show everything
  // Hide nav items whose target page is NOT in the allowed list
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(a => {
    const oc = a.getAttribute('onclick') || '';
    // Extract page id from onclick="showPage('pageid', this)"
    const m = oc.match(/showPage\('([^']+)'/);
    if (!m) return; // window.open links etc. — leave alone
    const pageId = m[1];
    if (allowed.indexOf(pageId) === -1) {
      a.style.display = 'none';
    }
  });
  // Hide section titles whose following nav-items are all hidden
  document.querySelectorAll('.sidebar-nav .nav-section-title').forEach(title => {
    let next = title.nextElementSibling;
    let anyVisible = false;
    while (next && !next.classList.contains('nav-section-title') && !next.classList.contains('divider')) {
      if (next.classList.contains('nav-item') && next.style.display !== 'none') {
        anyVisible = true; break;
      }
      next = next.nextElementSibling;
    }
    if (!anyVisible) title.style.display = 'none';
  });
  // Hide "إضافة سريعة" and "خبر جديد" quick-add buttons for كاتب who has limited access?
  // (كاتب still has 'news' in allowed list so they can add news — keep buttons.)
  // Also redirect if user is currently on a forbidden page
  const activePage = document.querySelector('.page.active');
  if (activePage) {
    const activeId = activePage.id.replace(/^page-/, '');
    if (allowed.indexOf(activeId) === -1) {
      // Jump them back to overview
      const overviewItem = document.querySelector('.sidebar-nav .nav-item[onclick*="overview"]');
      if (overviewItem && typeof showPage === 'function') showPage('overview', overviewItem);
    }
  }
}

// Returns the array of category names the current user is allowed to access,
// or null if the user has unrestricted access (مدير, or no allowedCats set, or no logged-in user).
function _currentAllowedCats() {
  if (!_curUser || !_curUser.username) return null;       // not logged in (admin shell)
  if (_curUser.role === 'مدير') return null;              // admins see all
  if (_curUser.username === 'admin') return null;
  if (typeof editorsData === 'undefined' || !editorsData) return null;
  const ed = editorsData.find(e => e.user === _curUser.username);
  if (!ed) return null;
  if (!Array.isArray(ed.allowedCats) || !ed.allowedCats.length) return null; // empty = all
  return ed.allowedCats;
}

// Block showPage navigation for disallowed pages even via direct JS call
const _origShowPageRBAC = window.showPage;
// We wrap showPage after it's defined below — patched via a wrapper later in this script.

// ─── INIT ─────────────────────────────────────────────────────
function initDashboard() {
  loadAll();
  _syncEditorPasswords();
  refreshNewsCatDropdown(); // sync editor passwords on every login
  renderCats();
  renderEditors();
  renderLatest();
  renderBreaking();
  renderNewsTable(newsData);  // after latest/breaking loaded so badges show
  buildChart();
  refreshAuthorSelect();
  loadPageControls();
  loadAdBanners();
  loadStatsBar();
  renderNavMenuEditor();
  _startInboxListener();  // live unread-count badge
  if (localStorage.getItem('atq_admin_theme') === 'light') {
    document.body.classList.add('light');
    const btn = document.getElementById('admin-theme-btn');
    if (btn) btn.textContent = '🌙 داكن';
  }
}

// ─── NAV ──────────────────────────────────────────────────────
const PAGE_TITLES = {
  overview:     ['نظرة عامة',              'مرحباً بك في لوحة تحكم الأحداث التقنية'],
  news:         ['إدارة الأخبار',           'إضافة وتعديل وحذف الأخبار'],
  categories:   ['الأقسام والتصنيفات',      'إدارة أقسام الموقع'],
  latest:       ['شريط آخر الأخبار',        'النصوص التي تظهر في الشريط الذهبي'],
  breaking:     ['شريط الأخبار العاجلة',    'الشريط الأحمر — تفعيل وإيقاف'],
  'ai-news':    ['أخبار الذكاء الاصطناعي','أخبار مقترحة يومياً — راجعها وانشرها بنقرة واحدة'],
  'fetch-news':  ['استيراد أخبار من الإنترنت','ابحث عن أخبار تقنية حديثة واستوردها بتفاصيلها الكاملة'],
  pagecontrols: ['تحكم في الصفحة',          'تفعيل وإيقاف عناصر الصفحة الرئيسية'],
  'general-settings': ['إعدادات عامة',       'التعليقات وأزرار التفاعل مع المقالات'],
  identity:     ['الهوية والتخطيط',          'الشعار، اسم الموقع، القائمة الرئيسية، وأبعاد الخبر الرئيسي'],
  editors:      ['إدارة المحررين',           'إضافة وإدارة فريق التحرير'],
  settings:     ['إعدادات الموقع',           'الإعدادات العامة وكلمة المرور'],
  'footer-control':    ['إدارة الفوتر',           'تحكم كامل في عناصر الفوتر'],
  'ads-manager':       ['إدارة الإعلانات',        'تفعيل وتخصيص جميع البانرات الإعلانية'],
  'nav-links-manager': ['روابط القائمة الرئيسية', 'إدارة روابط شريط التنقل العلوي'],
  analytics:    ['إحصائيات المحتوى',       'تحليل أداء الأخبار والمحررين والمشتركين'],
  subscribers:  ['المشتركون',                 'قائمة بريد المشتركين في النشرة الإخبارية'],
  inbox:        ['صندوق الرسائل',              'رسائل الزوار من نموذج تواصل معنا'],
};

function showPage(id, el) {
  // Role-based access check — block navigation to forbidden pages
  if (_curUser && _curUser.role) {
    const allowed = ROLE_PERMS[_curUser.role];
    if (allowed && allowed.indexOf(id) === -1) {
      if (typeof showToast === 'function') showToast('🚫 ليس لديك صلاحية الوصول إلى هذه الصفحة');
      return;
    }
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('active');
  if (el) el.classList.add('active');
  const t = PAGE_TITLES[id] || [id, ''];
  document.getElementById('topbar-title').textContent = t[0];
  document.getElementById('topbar-sub').textContent   = t[1];
  // If navigating to news page, show the main sub-tab by default
  if (id === 'news') showNewsSubTab('main');
  if (id === 'subscribers') loadSubscribers();
  if (id === 'analytics') loadAnalytics();
  if (id === 'footer-control') { renderFooterColEditor('company'); renderFooterColEditor('more'); renderSocialMedia(); loadPageControls(); }
  if (id === 'ads-manager') { renderAdsManager(); loadLayoutSettings(); }
  if (id === 'nav-links-manager') renderNavMenuEditor();
  if (id === 'general-settings') { loadInteractionToggles(); loadCommentsControl(); }
  if (id === 'identity') { loadIdentitySettings(); loadLayoutSettings(); loadMaintenance(); }
  if (id === 'inbox') { loadInboxMessages(); loadInboxForwarding(); }
}

function showNewsSubTab(tab) {
  // Ensure page-news is active
  const newsPage = document.getElementById('page-news');
  if (newsPage && !newsPage.classList.contains('active')) {
    showPage('news', document.querySelector('.nav-item[onclick*="news"]'));
  }
  // Hide all sub-sections
  ['main','ai-news','fetch-news'].forEach(t => {
    const el = document.getElementById('news-sub-' + t);
    if (el) el.style.display = 'none';
    const btn = document.getElementById('ntab-' + t);
    if (btn) { btn.className = 'btn-secondary'; btn.style.fontSize='13px'; btn.style.padding='7px 16px'; }
  });
  // Show requested
  const sub = document.getElementById('news-sub-' + tab);
  if (sub) sub.style.display = 'block';
  const btn = document.getElementById('ntab-' + tab);
  if (btn) { btn.className = 'btn-primary'; btn.style.fontSize='13px'; btn.style.padding='7px 16px'; }
  // Load content if needed
  if (tab === 'ai-news') { renderAINews(); }
  if (tab === 'fetch-news') { loadFetchedNews(); renderFetchedNews(); }
}

// ─── NEWS TABLE ───────────────────────────────────────────────
function renderNewsTable(data) {
  const tbody = document.getElementById('news-tbody');
  // If logged-in editor has restricted cats, filter to only their allowed sections
  const allowed = _currentAllowedCats();
  if (allowed) {
    data = data.filter(n => allowed.indexOf(n.cat) !== -1);
  }
  document.getElementById('news-count').textContent = `(${data.length} أخبار)`;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon">📭</div><p>لا توجد أخبار</p></div></td></tr>`;
    return;
  }
  const latestTitles   = new Set(latestData.map(l=>l.text));
  const breakingTitles = new Set(breakingData.map(b=>b.text));
  const pinnedId = localStorage.getItem('atq_wide_pinned');

  // Group news by week
  function getWeekLabel(dateStr) {
    if (!dateStr) return 'بدون تاريخ';
    // Try to parse date - handle Arabic numerals
    const normalized = dateStr.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    const d = new Date(normalized.replace(/\//g,'-'));
    if (isNaN(d)) return dateStr.substring(0, 10) || 'هذا الأسبوع';
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays < 7)  return 'هذا الأسبوع 📅';
    if (diffDays < 14) return 'الأسبوع الماضي 📅';
    if (diffDays < 21) return 'منذ أسبوعين 📅';
    if (diffDays < 30) return 'منذ 3 أسابيع 📅';
    const mo = d.toLocaleDateString('ar-EG', {month:'long', year:'numeric'});
    return mo + ' 📅';
  }
  const grouped = {};
  data.forEach(n => {
    const wk = getWeekLabel(n.date);
    if (!grouped[wk]) grouped[wk] = [];
    grouped[wk].push(n);
  });

  let html = '';
  Object.entries(grouped).forEach(([week, items]) => {
    html += `<tr><td colspan="7" style="background:rgba(201,168,76,0.06);padding:8px 20px;font-size:12px;font-weight:700;color:var(--gold);letter-spacing:0.5px;border-bottom:1px solid var(--border-dim)">${week} — ${items.length} أخبار</td></tr>`;
    html += items.map(n => {
    const badge = n.priority==='عاجل'
      ? '<span style="color:var(--red);font-size:10px;margin-left:4px">● عاجل</span>'
      : n.priority==='مميز'
      ? '<span style="color:var(--gold);font-size:10px;margin-left:4px">★ مميز</span>' : '';
    const statusCls = n.status==='منشور' ? 'badge-published' : n.status==='مسودة' ? 'badge-draft' : 'badge-archived';
    const inLatest   = latestTitles.has(n.title);
    const inBreaking = breakingTitles.has(n.title);
    const isPinned   = String(n.id) === pinnedId;

    const latestBtn = inLatest
      ? `<button class="btn-view" onclick="removeFromLatestByTitle(${n.id})" style="background:rgba(201,168,76,0.15);color:var(--gold);border-color:rgba(201,168,76,0.4);font-size:11px" title="موجود في الشريط — اضغط للإزالة">📰 ✓ آخر</button>`
      : `<button class="btn-view" onclick="addNewsToLatest(${n.id})" style="background:rgba(201,168,76,0.07);color:var(--gold);border-color:rgba(201,168,76,0.2);font-size:11px">📰 آخر</button>`;

    const breakBtn = inBreaking
      ? `<button class="btn-view" onclick="removeFromBreakingByTitle(${n.id})" style="background:rgba(255,82,82,0.15);color:#FF7070;border-color:rgba(255,82,82,0.4);font-size:11px" title="موجود في العاجل — اضغط للإزالة">⚡ ✓ عاجل</button>`
      : `<button class="btn-view" onclick="addNewsToBreaking(${n.id})" style="background:rgba(255,82,82,0.07);color:#FF7070;border-color:rgba(255,82,82,0.2);font-size:11px">⚡ عاجل</button>`;

    const pinBtn = isPinned
      ? `<button class="btn-view" onclick="unpinWide()" style="background:rgba(74,158,255,0.15);color:#6BB5FF;border-color:rgba(74,158,255,0.4);font-size:11px" title="مثبت في البانر — اضغط لإلغاء التثبيت">📌 ✓ بانر</button>`
      : `<button class="btn-view" onclick="pinToWide(${n.id})" style="background:rgba(74,158,255,0.07);color:#6BB5FF;border-color:rgba(74,158,255,0.2);font-size:11px" title="تثبيت كخبر رئيسي في البانر">📌 بانر</button>`;

    const commentBtn = n.commentsEnabled === false
      ? `<button class="btn-view" onclick="toggleNewsComments(${n.id})" style="font-size:11px;background:rgba(255,82,82,0.08);color:#FF7070;border-color:rgba(255,82,82,0.2)" title="تعليقات مغلقة">💬✗</button>`
      : `<button class="btn-view" onclick="toggleNewsComments(${n.id})" style="font-size:11px;background:rgba(61,220,132,0.08);color:#3DDC84;border-color:rgba(61,220,132,0.2)" title="تعليقات مفعّلة">💬✓</button>`;
    return `<tr>
      <td class="td-title">${badge}${n.title}</td>
      <td>${n.cat}</td>
      <td>${n.author}</td>
      <td style="color:var(--text-dim)">${n.date}</td>
      <td>${n.views||'٠'}</td>
      <td><span class="badge ${statusCls}">${n.status}</span></td>
      <td>
        <div class="actions" style="flex-wrap:nowrap;gap:3px">
          <button class="btn-edit" onclick="editNews(${n.id})" style="font-size:11px">✏️ تعديل</button>
          ${latestBtn}${breakBtn}${pinBtn}${commentBtn}
          <button class="btn-del" onclick="askDelete('news',${n.id},'الخبر')" style="font-size:11px">🗑 حذف</button>
        </div>
      </td>
    </tr>`;
  }).join('');
    html += '</tr>';
  });
  tbody.innerHTML = html;
}

function filterNews(q) {
  // Read search input
  const search = (typeof q === 'string' ? q : document.querySelector('#news-sub-main .search-input')?.value || '').toLowerCase().trim();
  // Read category dropdown  
  const catSel = document.querySelector('#news-sub-main .filter-select');
  const cat = catSel ? catSel.value : '';
  // Read status dropdown
  const statSelAll = document.querySelectorAll('#news-sub-main .filter-select');
  const stat = statSelAll[1] ? statSelAll[1].value : '';

  let filtered = newsData;
  if (search) filtered = filtered.filter(n => n.title.toLowerCase().includes(search)||n.cat.includes(search)||n.author.toLowerCase().includes(search));
  if (cat && cat !== '' && cat !== 'كل الأقسام') filtered = filtered.filter(n => n.cat === cat);
  if (stat && stat !== 'كل الحالات') filtered = filtered.filter(n => n.status === stat);
  renderNewsTable(filtered);
}

function resetNewsForm() {
  ['n-title','n-excerpt','n-content','n-thumbnail','n-photo-url'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value='';
  });
  excerptSetContent('');
  document.getElementById('n-thumb-preview').innerHTML = '🖼';
  const catEl = document.getElementById('n-cat'); if(catEl) catEl.value='';
  const ncEl2 = document.getElementById('n-nav-cat'); if(ncEl2) ncEl2.value='';
  const trEl2 = document.getElementById('n-trending'); if(trEl2) trEl2.checked=false;
  const stEl  = document.getElementById('n-status'); if(stEl) stEl.value='منشور';
  const prEl  = document.getElementById('n-priority'); if(prEl) prEl.value='عادي';
  // Reset "also in" section checkboxes (extra sections feature)
  ['n-also-trending','n-also-featured','n-also-breaking','n-also-hero'].forEach(id => {
    const el = document.getElementById(id); if (el) el.checked = false;
  });
  // Reset metadata-visibility toggles to "show all" defaults
  ['n-show-author','n-show-date','n-show-views'].forEach(id => {
    const el = document.getElementById(id); if (el) el.checked = true;
  });
  document.getElementById('news-edit-id').value = '';
  document.getElementById('news-modal-title').textContent = 'إضافة خبر جديد';
  rteSetContent('');
  const saveBtn = document.querySelector('#news-modal .modal-foot .btn-primary');
  if (saveBtn) {
    saveBtn.onclick = function() { saveNews(); };
    saveBtn.removeAttribute('data-ai-id');
    saveBtn.removeAttribute('data-fetch-id');
  }
}

function saveNews() {
  const title = document.getElementById('n-title').value.trim();
  const cat   = document.getElementById('n-cat').value;
  if (!title || !cat) { showToast('⚠️ الرجاء تعبئة العنوان والقسم'); return; }
  const eid = document.getElementById('news-edit-id').value;
  const priority = document.getElementById('n-priority').value;
  const chk = id => { const el = document.getElementById(id); return !!(el && el.checked); };
  const obj = {
    title, cat,
    author:    document.getElementById('n-author').value,
    date:      new Date().toLocaleDateString('ar-EG',{year:'numeric',month:'2-digit',day:'2-digit'}),
    views:     '٠',
    status:    document.getElementById('n-status').value,
    priority:  priority,
    excerpt:   excerptGetContent(),
    content:   rteGetContent(),
    thumbnail: document.getElementById('n-thumbnail').value,
    navCat:    document.getElementById('n-nav-cat')?.value || '',
    // Back-compat boolean flags (legacy code paths rely on these)
    trending: priority === 'trending' || chk('n-also-trending'),
    featured: priority === 'ابرز المقالات' || chk('n-also-featured'),
    // Extra "also show in" flags (new): let one news appear in multiple sections
    alsoTrending: chk('n-also-trending'),
    alsoFeatured: chk('n-also-featured'),
    alsoBreaking: chk('n-also-breaking'),
    alsoHero:     chk('n-also-hero'),
    // Metadata visibility toggles (hide specific meta pills on card + article)
    showAuthor:   chk('n-show-author'),
    showDate:     chk('n-show-date'),
    showViews:    chk('n-show-views'),
  };
  if (eid) {
    const idx = newsData.findIndex(n => n.id == eid);
    if (idx !== -1) {
      // Preserve the original publish-date when editing — don't stamp today's date on top
      obj.date = newsData[idx].date || obj.date;
      // Preserve accumulated view count
      obj.views = newsData[idx].views || obj.views;
      newsData[idx] = {...newsData[idx], ...obj}; obj.id = newsData[idx].id;
    }
    _fbSetNews(newsData[newsData.findIndex(n => n.id == obj.id || n.id == eid)]);
    showToast('✅ تم تحديث الخبر');
  } else {
    obj.id = Date.now();
    newsData.unshift(obj);
    _fbSetNews(obj);
    showToast('✅ تم إضافة الخبر');
  }
  renderNewsTable(newsData);
  saveAll();
  closeModal('news-modal');
}

function toggleNewsComments(id) {
  const n = newsData.find(x => x.id === id);
  if (!n) return;
  n.commentsEnabled = n.commentsEnabled === false ? true : false;
  _fbSetNews(n);
  saveAll();
  renderNewsTable(newsData);
  showToast(n.commentsEnabled !== false ? '💬 تعليقات مفعّلة' : '💬 تعليقات مغلقة');
}

function editNews(id) {
  const n = newsData.find(x => x.id === id);
  if (!n) return;
  document.getElementById('news-edit-id').value  = id;
  document.getElementById('n-title').value       = n.title;
  const catEl = document.getElementById('n-cat'); if(catEl) catEl.value = n.cat;
  document.getElementById('n-author').value      = n.author;
  document.getElementById('n-status').value      = n.status;
  document.getElementById('n-priority').value    = n.priority;
  document.getElementById('n-excerpt').value     = n.excerpt || '';
  excerptSetContent(n.excerpt || '');
  rteSetContent(n.content || '');
  document.getElementById('n-thumbnail').value   = n.thumbnail || '';
  const ncEl = document.getElementById('n-nav-cat'); if(ncEl) ncEl.value = n.navCat || '';
  document.getElementById('n-photo-url').value   = n.thumbnail || '';
  const prev = document.getElementById('n-thumb-preview');
  if (n.thumbnail) prev.innerHTML = `<img src="${n.thumbnail}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`;
  else prev.innerHTML = '🖼';
  // Load "also in" flags
  const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
  setChk('n-also-trending', n.alsoTrending);
  setChk('n-also-featured', n.alsoFeatured);
  setChk('n-also-breaking', n.alsoBreaking);
  setChk('n-also-hero',     n.alsoHero);
  // Load metadata-visibility flags (undefined defaults to true = shown)
  setChk('n-show-author', n.showAuthor !== false);
  setChk('n-show-date',   n.showDate   !== false);
  setChk('n-show-views',  n.showViews  !== false);
  document.getElementById('news-modal-title').textContent = 'تعديل الخبر';
  openModal('news-modal');
}

function addNewsToLatest(id) {
  const n = newsData.find(x=>x.id===id); if(!n) return;
  addToLatest(n.title);
}
function addNewsToBreaking(id) {
  const n = newsData.find(x=>x.id===id); if(!n) return;
  addToBreaking(n.title);
}

// ─── PHOTO / THUMBNAIL ────────────────────────────────────────
function previewNewsThumb(input) {
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('n-thumbnail').value = e.target.result;
    document.getElementById('n-thumb-preview').innerHTML =
      `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`;
  };
  reader.readAsDataURL(file);
}
function previewNewsThumbUrl(url) {
  document.getElementById('n-thumbnail').value = url;
  if (!url) { document.getElementById('n-thumb-preview').innerHTML='🖼'; return; }
  document.getElementById('n-thumb-preview').innerHTML =
    `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:10px" onerror="this.parentElement.textContent='🖼'">`;
}

// ─── CATS ─────────────────────────────────────────────────────
function refreshNewsCatDropdown() {
  const sel = document.getElementById('n-cat');
  if (!sel) return;
  const cur = sel.value;
  // Build from catsData first, then fallback defaults
  const defaults = ['الذكاء الاصطناعي','الهواتف والأجهزة','الفضاء والعلوم',
    'الأمن الرقمي','الشركات والأعمال','ألعاب الفيديو','السيارات الكهربائية','الروبوتات','التقنية الحيوية'];
  let cats = (catsData && catsData.length)
    ? catsData.map(c => c.name || c.label || c)
    : defaults;
  // Restrict to current editor's allowed cats (if any)
  const allowed = _currentAllowedCats();
  if (allowed) cats = cats.filter(c => allowed.indexOf(c) !== -1);
  sel.innerHTML = '<option value="">اختر القسم *</option>' +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
  if (cur) sel.value = cur;
  // Also update n-nav-cat
  const navSel = document.getElementById('n-nav-cat');
  if (navSel) {
    const navCur = navSel.value;
    navSel.innerHTML = '<option value="">لا يظهر في القائمة بشكل خاص</option>' +
      '<option value="الرئيسية">الرئيسية</option>' +
      cats.map(c => `<option value="${c}">${c}</option>`).join('');
    if (navCur) navSel.value = navCur;
  }
}

function renderCats() {
  refreshNewsCatDropdown(); // sync news modal dropdown with current categories
  document.getElementById('cats-grid').innerHTML = catsData.map(c => `
    <div class="cat-card">
      <div style="position:absolute;top:0;right:0;width:4px;height:100%;background:${c.color};border-radius:0 14px 14px 0"></div>
      <div class="cat-card-header">
        <div class="cat-icon" style="background:${c.color}22">${c.icon}</div>
        <div><div class="cat-name">${c.name}</div><div class="cat-slug">/${c.slug}</div></div>
      </div>
      <div class="cat-stats"><div class="cat-stat"><strong>${c.articles}</strong> مقال</div></div>
      <div class="cat-actions">
        <button class="btn-edit" onclick="editCat(${c.id})">✏️ تعديل</button>
        <button class="btn-del"  onclick="askDelete('cat',${c.id},'${c.name}')">🗑 حذف</button>
      </div>
    </div>`).join('');
}

function saveCat() {
  const name = document.getElementById('c-name').value.trim();
  if (!name) { showToast('⚠️ أدخل اسم القسم'); return; }
  catsData.push({
    id:Date.now(), name, articles:0,
    slug:document.getElementById('c-slug').value||name,
    icon:document.getElementById('c-icon').value||'📁',
    color:_selColor,
    desc:document.getElementById('c-desc').value,
  });
  renderCats(); saveAll();
  refreshCatDropdowns(); // update news form dropdowns
  closeModal('cat-modal');
  showToast('✅ تم إضافة القسم — سيظهر على الموقع فوراً');
  resetCatModal();
}

function refreshCatDropdowns() {
  // Update category dropdowns in news modal + filter
  const catSelectors = ['n-cat', 'n-cat'];
  const allCatNames = catsData.map(c => c.name);
  document.querySelectorAll('select#n-cat, select.filter-select').forEach(sel => {
    if (sel.id === 'n-cat') {
      const cur = sel.value;
      sel.innerHTML = '<option value="">اختر القسم</option>' +
        allCatNames.map(n => `<option${cur===n?' selected':''}>${n}</option>`).join('');
    } else if (sel.options[1] && allCatNames.includes(sel.options[1].text)) {
      // Category filter select - rebuild
      const cur = sel.value;
      if (!sel.classList.contains('no-cat-update')) {
        // Only update first filter-select (categories), not status one
        sel.innerHTML = '<option value="">كل الأقسام</option>' +
          allCatNames.map(n => `<option${cur===n?' selected':''}>${n}</option>`).join('');
        sel.classList.add('no-cat-update'); // prevent double update
      }
    }
  });
}

function editCat(id) {
  const c = catsData.find(x=>x.id===id); if(!c) return;
  document.getElementById('c-name').value  = c.name;
  document.getElementById('c-slug').value  = c.slug;
  document.getElementById('c-icon').value  = c.icon;
  document.getElementById('c-desc').value  = c.desc||'';
  _selColor = c.color;
  document.querySelector('#cat-modal .modal-title').textContent = 'تعديل القسم';
  const btn = document.querySelector('#cat-modal .modal-foot .btn-primary');
  btn.textContent = 'حفظ التعديلات';
  btn.onclick = () => doEditCat(id);
  openModal('cat-modal');
}
function doEditCat(id) {
  const name = document.getElementById('c-name').value.trim();
  if (!name) { showToast('⚠️ أدخل اسم القسم'); return; }
  const idx = catsData.findIndex(c=>c.id===id);
  catsData[idx] = {...catsData[idx], name,
    slug:document.getElementById('c-slug').value||name,
    icon:document.getElementById('c-icon').value||'📁',
    color:_selColor,
    desc:document.getElementById('c-desc').value,
  };
  renderCats(); saveAll();
  refreshCatDropdowns();
  closeModal('cat-modal');
  showToast('✅ تم تحديث القسم — سيظهر على الموقع فوراً');
  resetCatModal();
}
function resetCatModal() {
  ['c-name','c-slug','c-icon','c-desc'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.querySelector('#cat-modal .modal-title').textContent = 'إضافة قسم جديد';
  const btn = document.querySelector('#cat-modal .modal-foot .btn-primary');
  btn.textContent = 'إضافة القسم'; btn.onclick = saveCat;
}
function selectColor(el, color) {
  document.querySelectorAll('.color-opt').forEach(e => e.style.borderColor='transparent');
  el.style.borderColor = 'white';
  _selColor = color;
  document.getElementById('c-color').value = color;
}

// ─── LATEST TICKER ────────────────────────────────────────────
function renderLatest() {
  const tb = document.getElementById('latest-tbody');
  const active = latestData.filter(l=>l.status==='نشط');
  document.getElementById('latest-count').textContent = `${latestData.length} نص — ${active.length} نشط`;
  tb.innerHTML = latestData.map(l => `
    <tr>
      <td class="td-title">${l.text}</td>
      <td><span class="badge ${l.status==='نشط'?'badge-published':'badge-archived'}">${l.status==='نشط'?'نشط':'متوقف'}</span></td>
      <td>
        <div class="actions" style="justify-content:flex-start;flex-wrap:nowrap;gap:4px">
          <button class="${l.status==='نشط'?'btn-del':'btn-view'}"
            style="font-size:11px;padding:4px 8px;${l.status==='نشط'?'background:rgba(255,82,82,0.1);color:#FF7070;border-color:rgba(255,82,82,0.3)':'background:rgba(61,220,132,0.1);color:#3DDC84;border-color:rgba(61,220,132,0.3)'}"
            onclick="toggleLatest(${l.id})">${l.status==='نشط'?'⏸ إيقاف':'▶ تفعيل'}</button>
          <button class="btn-edit" style="font-size:11px;padding:4px 8px" onclick="editLatest(${l.id})">✏️ تعديل</button>
          <button class="btn-view" style="font-size:11px;padding:4px 8px;background:rgba(255,82,82,0.08);color:#FF7070;border-color:rgba(255,82,82,0.2)" onclick="addToBreakingById(${l.id})">⚡ عاجل</button>
          <button class="btn-del" style="font-size:11px;padding:4px 8px" onclick="askDelete('latest',${l.id},'النص')">🗑 حذف</button>
        </div>
      </td>
    </tr>`).join('') ||
    `<tr><td colspan="3"><div class="empty-state"><div class="icon">🗞️</div><p>لا توجد نصوص بعد</p></div></td></tr>`;
  document.getElementById('latest-preview').textContent = active.map(l=>l.text).join('  ◆  ') || 'لا توجد نصوص نشطة';
}

function toggleLatest(id) {
  const l = latestData.find(x=>x.id===id); if(!l) return;
  l.status = l.status==='نشط'?'متوقف':'نشط';
  renderLatest(); saveAll(); renderNewsTable(newsData);
  showToast(l.status==='نشط'?'✅ تم التفعيل':'⏸ تم الإيقاف');
}
function editLatest(id) {
  const l = latestData.find(x=>x.id===id); if(!l) return;
  document.getElementById('l-edit-id').value = id;
  document.getElementById('l-text').value    = l.text;
  document.getElementById('l-status').value  = l.status;
  document.querySelector('#latest-modal .modal-title').textContent = 'تعديل نص الشريط';
  openModal('latest-modal');
}
function saveLatest() {
  const text = document.getElementById('l-text').value.trim();
  if (!text) { showToast('⚠️ أدخل نص الخبر'); return; }
  const eid = document.getElementById('l-edit-id').value;
  if (eid) {
    const idx = latestData.findIndex(l=>l.id==eid);
    if (idx!==-1) { latestData[idx].text=text; latestData[idx].status=document.getElementById('l-status').value; }
    showToast('✅ تم التحديث');
  } else {
    latestData.push({id:Date.now(), text, status:document.getElementById('l-status').value});
    showToast('✅ تم الإضافة');
  }
  renderLatest(); saveAll(); renderNewsTable(newsData);
  closeModal('latest-modal');
  document.getElementById('l-text').value='';
  document.getElementById('l-edit-id').value='';
  document.querySelector('#latest-modal .modal-title').textContent='📰 إضافة نص لشريط آخر الأخبار';
}
function removeFromLatestByTitle(newsId) {
  const n = newsData.find(x=>x.id===newsId); if(!n) return;
  latestData = latestData.filter(l => l.text !== n.title);
  renderLatest(); renderNewsTable(newsData); saveAll();
  showToast('📰 تم إزالة الخبر من شريط آخر الأخبار');
}

function removeFromBreakingByTitle(newsId) {
  const n = newsData.find(x=>x.id===newsId); if(!n) return;
  breakingData = breakingData.filter(b => b.text !== n.title);
  renderBreaking(); renderNewsTable(newsData); saveAll();
  showToast('⚡ تم إزالة الخبر من الشريط العاجل');
}

function pinToWide(id) {
  localStorage.setItem('atq_wide_pinned', String(id));
  _fbUpdateSite({ wide_pinned: String(id) });
  renderNewsTable(newsData);
  showToast('📌 تم تثبيت الخبر في البانر الرئيسي');
}

function unpinWide() {
  localStorage.removeItem('atq_wide_pinned');
  _fbUpdateSite({ wide_pinned: null });
  renderNewsTable(newsData);
  showToast('📌 تم إلغاء التثبيت — سيظهر الخبر المميز الافتراضي');
}

function addToBreakingById(id) {
  const l = latestData.find(x=>x.id===id); if(!l) return;
  addToBreaking(l.text);
}
function addToLatestById(id) {
  const b = breakingData.find(x=>x.id===id); if(!b) return;
  addToLatest(b.text);
}
function addToLatest(text) {
  if (latestData.find(l=>l.text===text)) { showToast('⚠️ النص موجود بالفعل'); return; }
  latestData.push({id:Date.now(), text, status:'نشط'});
  renderLatest(); saveAll(); renderNewsTable(newsData);
  showToast('📰 تم الإضافة لشريط آخر الأخبار');
}

// ─── BREAKING NEWS ────────────────────────────────────────────
function renderBreaking() {
  const tb = document.getElementById('breaking-tbody');
  tb.innerHTML = breakingData.map(b => `
    <tr>
      <td class="td-title">${b.text}</td>
      <td><span class="badge ${b.active?'badge-published':'badge-draft'}">${b.active?'نشط':'في القائمة'}</span></td>
      <td>
        <div class="actions" style="justify-content:flex-start;flex-wrap:nowrap;gap:4px">
          <button class="${b.active?'btn-del':'btn-view'}"
            style="font-size:11px;padding:4px 8px;${b.active?'background:rgba(255,82,82,0.1);color:#FF7070;border-color:rgba(255,82,82,0.3)':'background:rgba(61,220,132,0.1);color:#3DDC84;border-color:rgba(61,220,132,0.3)'}"
            onclick="toggleBreakingItem(${b.id})">${b.active?'⏸ إيقاف':'▶ تفعيل'}</button>
          <button class="btn-edit" style="font-size:11px;padding:4px 8px" onclick="editBreaking(${b.id})">✏️ تعديل</button>
          <button class="btn-view" style="font-size:11px;padding:4px 8px;background:rgba(201,168,76,0.08);color:var(--gold);border-color:rgba(201,168,76,0.2)" onclick="addToLatestById(${b.id})">📰 آخر</button>
          <button class="btn-del" style="font-size:11px;padding:4px 8px" onclick="askDelete('breaking',${b.id},'الخبر العاجل')">🗑 حذف</button>
        </div>
      </td>
    </tr>`).join('') ||
    `<tr><td colspan="3"><div class="empty-state"><div class="icon">⚡</div><p>لا توجد أخبار عاجلة بعد</p></div></td></tr>`;

  const activeB = breakingData.filter(b=>b.active);
  document.getElementById('breaking-preview').textContent =
    activeB.map(b=>b.text).join('  ◆  ') || 'لا توجد أخبار نشطة';

  const isOn = localStorage.getItem('atq_breaking_active') === '1';
  const tog  = document.getElementById('breaking-master-toggle');
  if (tog) tog.checked = isOn;
  document.getElementById('breaking-status-text').textContent = isOn ? '🔴 نشط على الموقع' : 'متوقف';
  const badge = document.getElementById('breaking-nav-badge');
  if (badge) badge.style.display = (isOn && activeB.length>0) ? 'inline' : 'none';
}

function toggleBreakingItem(id) {
  const b = breakingData.find(x=>x.id===id); if(!b) return;
  b.active = !b.active;
  renderBreaking(); saveAll(); renderNewsTable(newsData);
  showToast(b.active?'🔴 تم تفعيل الخبر العاجل':'⏸ تم إيقاف الخبر');
}
function editBreaking(id) {
  const b = breakingData.find(x=>x.id===id); if(!b) return;
  document.getElementById('b-edit-id').value = id;
  document.getElementById('b-text').value    = b.text;
  document.querySelector('#breaking-modal .modal-title').textContent = 'تعديل الخبر العاجل';
  openModal('breaking-modal');
}
function saveBreaking() {
  const text = document.getElementById('b-text').value.trim();
  if (!text) { showToast('⚠️ أدخل نص الخبر'); return; }
  const eid = document.getElementById('b-edit-id').value;
  if (eid) {
    const idx = breakingData.findIndex(b=>b.id==eid);
    if (idx!==-1) breakingData[idx].text = text;
    showToast('✅ تم التحديث');
  } else {
    breakingData.push({id:Date.now(), text, active:false});
    showToast('✅ تم الإضافة');
  }
  renderBreaking(); saveAll(); renderNewsTable(newsData);
  closeModal('breaking-modal');
  document.getElementById('b-text').value='';
  document.getElementById('b-edit-id').value='';
  document.querySelector('#breaking-modal .modal-title').textContent='⚡ إضافة خبر عاجل';
}
function addToBreaking(text) {
  if (breakingData.find(b=>b.text===text)) { showToast('⚠️ الخبر موجود بالفعل'); return; }
  breakingData.push({id:Date.now(), text, active:true});
  renderBreaking(); saveAll(); renderNewsTable(newsData);
  showToast('⚡ تم الإضافة للشريط العاجل');
}

function toggleBreakingMaster() {
  const isOn = document.getElementById('breaking-master-toggle').checked;
  localStorage.setItem('atq_breaking_active', isOn?'1':'0');
  const bStart = isOn ? Date.now() : null;
  if (isOn) localStorage.setItem('atq_breaking_start', String(bStart));
  else      localStorage.removeItem('atq_breaking_start');
  _fbUpdateSite({ breaking_active: isOn, breaking_start: bStart ? String(bStart) : null });
  document.getElementById('breaking-status-text').textContent = isOn ? '🔴 نشط على الموقع' : 'متوقف';
  const activeB = breakingData.filter(b=>b.active);
  const badge = document.getElementById('breaking-nav-badge');
  if (badge) badge.style.display = (isOn && activeB.length>0) ? 'inline' : 'none';
  saveAll();
  showToast(isOn?'🔴 تم تفعيل الشريط العاجل على الموقع':'⏸ تم إيقاف الشريط العاجل');
}
function saveDuration() {
  const val  = parseInt(document.getElementById('breaking-duration-val').value) || 5;
  const unit = parseInt(document.getElementById('breaking-duration-unit').value) || 60;
  const secs = val * unit;
  localStorage.setItem('atq_breaking_duration', secs);
  _fbUpdateSite({ breaking_duration: secs });
  const label = unit===3600?'ساعة':unit===60?'دقيقة':'ثانية';
  document.getElementById('breaking-duration-hint').textContent = `سيختفي بعد ${val} ${label} من التفعيل`;
  showToast(`✅ تم حفظ المدة: ${val} ${label}`);
}

// ─── EDITORS ──────────────────────────────────────────────────
function renderEditors() {
  const roleClass = r => r==='مدير'?'badge-admin':r==='محرر'?'badge-editor':'badge-writer';
  document.getElementById('editors-grid').innerHTML = editorsData.map(e => `
    <div class="editor-card" style="position:relative;${e.active===false?'opacity:.55':''}">
      <div style="position:absolute;top:10px;left:10px;display:flex;gap:6px;align-items:center">
        <label class="toggle-switch" title="${e.active===false?'غير نشط':'نشط'}">
          <input type="checkbox" ${e.active!==false?'checked':''} onchange="toggleEditorActive(${e.id},this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="editor-avatar" style="background:${e.color}22;color:${e.color}">${e.name[0]}</div>
      <div class="editor-name">${e.name}</div>
      <div class="editor-email" style="font-family:monospace;font-size:11px;margin-bottom:2px">👤 ${e.user||'—'}</div>
      <div class="editor-email">${e.email}</div>
      <div style="margin:6px 0;display:flex;gap:6px;flex-wrap:wrap;justify-content:center">
        <span class="badge ${roleClass(e.role)}">${e.role}</span>
        <span class="badge" style="background:${e.canAddNews!==false?'rgba(61,220,132,.15)':'rgba(255,82,82,.15)'};color:${e.canAddNews!==false?'var(--green)':'var(--red)'};border:1px solid ${e.canAddNews!==false?'rgba(61,220,132,.3)':'rgba(255,82,82,.3)'}">
          ${e.canAddNews!==false?'✅ يضيف أخبار':'🚫 لا يضيف'}
        </span>
      </div>
      <div class="editor-stats">
        <div class="editor-stat"><strong>${e.articles||0}</strong> مقال</div>
        <div class="editor-stat"><strong>${e.dept||'—'}</strong></div>
      </div>
      <div class="actions" style="justify-content:center;margin-top:8px">
        <button class="btn-edit" onclick="editEditor(${e.id})" style="font-size:12px">✏️ تعديل</button>
        <button class="btn-secondary" onclick="toggleEditorNewsAccess(${e.id})" style="font-size:11px;padding:5px 10px">
          ${e.canAddNews!==false?'🚫 إيقاف':'✅ تفعيل'} الأخبار
        </button>
        <button class="btn-del" onclick="askDelete('editor',${e.id},'${e.name}')" style="font-size:12px">🗑 حذف</button>
      </div>
    </div>`).join('');
}

function resetEditorForm() {
  ['e-name','e-user','e-email','e-pass'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  const cn=document.getElementById('e-can-news'); if(cn) cn.checked=true;
  const ac=document.getElementById('e-active'); if(ac) ac.checked=true;
  document.getElementById('e-edit-id').value='';
  document.getElementById('editor-modal-title').textContent='إضافة محرر جديد';
  // Rebuild allowed-cats checkbox list (none checked = all allowed)
  _renderEditorCatsList([]);
}

// Render the per-editor cats checkbox list inside the editor modal.
// `allowed` is an array of cat names to pre-check; empty = none pre-checked = all allowed.
function _renderEditorCatsList(allowed) {
  const list = document.getElementById('e-cats-list');
  if (!list) return;
  const cats = (typeof catsData !== 'undefined' && catsData && catsData.length)
    ? catsData
    : [];
  if (!cats.length) {
    list.innerHTML = '<div style="font-size:11px;color:var(--text-dim);grid-column:1/-1">لا توجد أقسام معرفة بعد. أضف أقساماً من صفحة "الأقسام والتصنيفات" أولاً.</div>';
    return;
  }
  const set = new Set(allowed || []);
  list.innerHTML = cats.map(c => {
    const name = c.name || c;
    const checked = set.has(name) ? 'checked' : '';
    return '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-muted);padding:4px 6px;border-radius:6px" onmouseover="this.style.background=\'var(--dark-4)\'" onmouseout="this.style.background=\'\'">' +
      '<input type="checkbox" value="' + name.replace(/"/g,'&quot;') + '" ' + checked + ' style="width:14px;height:14px;flex-shrink:0">' +
      '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + name + '</span>' +
      '</label>';
  }).join('');
}


// ─── ANALYTICS ────────────────────────────────────────────────
function loadAnalytics() {
  const pub = newsData.filter(n => n.status === 'منشور');
  document.getElementById('an-total-news').textContent = newsData.length;
  document.getElementById('an-pub-news').textContent   = pub.length;
  document.getElementById('an-editors').textContent    = editorsData.length;

  // Subscriber count
  const subBadge = document.getElementById('subscribers-count-badge');
  document.getElementById('an-subs').textContent = subBadge?.textContent || '—';

  // Top news by views
  const sorted = [...newsData].sort((a,b) => {
    const av = parseInt((a.views||'0').replace(/[^0-9]/g,''))||0;
    const bv = parseInt((b.views||'0').replace(/[^0-9]/g,''))||0;
    return bv - av;
  }).slice(0, 8);
  document.getElementById('an-top-news').innerHTML = sorted.map((n,i) =>
    `<tr><td>${i+1}</td><td class="td-title">${n.title}</td><td>${n.cat}</td><td>${n.views||'٠'}</td></tr>`
  ).join('');

  // Editors table
  document.getElementById('an-editors-table').innerHTML = editorsData.map(e =>
    `<tr>
      <td><strong>${e.name}</strong><br><span style="font-size:11px;color:var(--text-dim)">${e.user||''}</span></td>
      <td>${e.articles||0}</td>
      <td><span class="badge ${e.role==='مدير'?'badge-admin':e.role==='محرر'?'badge-editor':'badge-writer'}">${e.role}</span></td>
      <td><span style="color:${e.active!==false?'var(--green)':'var(--red)'}">${e.active!==false?'✅ نشط':'🚫 موقوف'}</span></td>
    </tr>`
  ).join('');

  // Cats chart
  const catCounts = {};
  newsData.forEach(n => { catCounts[n.cat] = (catCounts[n.cat]||0) + 1; });
  const total = newsData.length || 1;
  document.getElementById('an-cats-chart').innerHTML = Object.entries(catCounts)
    .sort((a,b) => b[1]-a[1])
    .map(([cat, cnt]) => {
      const pct = Math.round(cnt/total*100);
      return `<div style="flex:1;min-width:160px">
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px">${cat}</div>
        <div style="background:var(--dark-3);border-radius:6px;height:8px;overflow:hidden">
          <div style="height:100%;background:var(--gold);width:${pct}%;border-radius:6px;transition:.5s"></div>
        </div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:4px">${cnt} خبر (${pct}%)</div>
      </div>`;
    }).join('');
}

function toggleEditorActive(id, active) {
  const e = editorsData.find(x => x.id===id);
  if (!e) return;
  e.active = active;
  saveAll();
  renderEditors();
  // Update login passwords
  const passwords = _getPasswords();
  if (!active) {
    delete passwords[e.user];
  } else if (e.user && e.pass) {
    passwords[e.user] = e.pass;
  }
  localStorage.setItem('atq_user_passwords', JSON.stringify(passwords));
  showToast(active ? '✅ تم تفعيل المحرر' : '🚫 تم إيقاف وصول المحرر');
}

function toggleEditorNewsAccess(id) {
  const e = editorsData.find(x => x.id===id);
  if (!e) return;
  e.canAddNews = e.canAddNews === false ? true : false;
  saveAll();
  renderEditors();
  showToast(e.canAddNews ? '✅ تم تفعيل إضافة الأخبار' : '🚫 تم إيقاف إضافة الأخبار');
}

function saveEditor() {
  const name  = document.getElementById('e-name').value.trim();
  const email = document.getElementById('e-email').value.trim();
  if (!name||!email) { showToast('⚠️ أدخل الاسم والبريد'); return; }
  const eid       = document.getElementById('e-edit-id').value;
  const passVal   = document.getElementById('e-pass')?.value || '';
  const canNews   = document.getElementById('e-can-news')?.checked !== false;
  const isActive  = document.getElementById('e-active')?.checked !== false;
  const colors    = ['#C9A84C','#4A9EFF','#A078FF','#3DDC84','#FF5252','#FF9A3C','#40C8F0'];
  // Read allowed cats from the checkbox list
  const allowedCats = Array.from(document.querySelectorAll('#e-cats-list input:checked'))
    .map(c => c.value);
  const obj = {
    name, email,
    user:         document.getElementById('e-user').value.trim(),
    role:         document.getElementById('e-role').value,
    dept:         document.getElementById('e-dept').value,
    canAddNews:   canNews,
    active:       isActive,
    color:        colors[Math.floor(Math.random()*colors.length)],
    allowedCats:  allowedCats,
  };
  if (passVal) obj.pass = passVal;

  if (eid) {
    const idx = editorsData.findIndex(e=>e.id==eid);
    if (idx !== -1) {
      // Keep existing color and articles count; keep existing pass if no new one entered
      obj.color    = editorsData[idx].color;
      obj.articles = editorsData[idx].articles || 0;
      if (!passVal) obj.pass = editorsData[idx].pass || '';
      editorsData[idx] = {...editorsData[idx], ...obj};
    }
    showToast('✅ تم تحديث بيانات المحرر');
  } else {
    obj.id = Date.now();
    obj.articles = 0;
    if (!obj.color) obj.color = colors[Math.floor(Math.random()*colors.length)];
    editorsData.push(obj);
    showToast('✅ تم إضافة المحرر');
  }

  // Persist ALL editor passwords to localStorage so doLogin() can find them
  _syncEditorPasswords();

  saveAll();
  renderEditors();
  refreshAuthorSelect();
  closeModal('editor-modal');
}

function _syncEditorPasswords() {
  // Build password map from all active editors and save to localStorage
  const stored = {};
  editorsData.forEach(e => {
    if (e.user && e.pass && e.active !== false) {
      stored[e.user] = e.pass;
    }
  });
  localStorage.setItem('atq_user_passwords', JSON.stringify(stored));
}

function editEditor(id) {
  const e = editorsData.find(x=>x.id===id); if(!e) return;
  document.getElementById('e-edit-id').value  = id;
  document.getElementById('e-name').value     = e.name;
  document.getElementById('e-user').value     = e.user;
  document.getElementById('e-email').value    = e.email;
  document.getElementById('e-role').value     = e.role;
  document.getElementById('e-dept').value     = e.dept;
  const passEl = document.getElementById('e-pass');
  if (passEl) passEl.value = '';  // don't show existing password
  const canEl = document.getElementById('e-can-add-news');
  const canEl2 = document.getElementById('e-can-news'); if (canEl2) canEl2.checked = e.canAddNews !== false;
  const actEl = document.getElementById('e-active'); if (actEl) actEl.checked = e.active !== false;
  const activeEl = document.getElementById('e-active');
  if (activeEl) activeEl.checked = e.active !== false;
  // Render allowed-cats checkboxes with this editor's saved selection
  _renderEditorCatsList(Array.isArray(e.allowedCats) ? e.allowedCats : []);
  document.getElementById('editor-modal-title').textContent = 'تعديل بيانات المحرر';
  openModal('editor-modal');
}

function refreshAuthorSelect() {
  const sel = document.getElementById('n-author'); if(!sel) return;
  const cur = sel.value;
  // Include all editors (active or not) in the list for assignment
  sel.innerHTML = '<option value="">اختر المحرر</option>' +
    editorsData.map(e=>`<option value="${e.name}">${e.name}${e.active===false?' (موقوف)':''}</option>`).join('');
  if (cur) sel.value = cur;
}

// ─── DELETE ───────────────────────────────────────────────────
function askDelete(type, id, label) {
  _delTarget=id; _delType=type;
  document.getElementById('del-msg').textContent = `سيتم حذف "${label}" نهائياً ولا يمكن التراجع.`;
  openModal('del-modal');
}
function confirmDelete() {
  if (_delType==='news')    { newsData    =newsData.filter(n=>n.id!==_delTarget); renderNewsTable(newsData); _fbDelNews(_delTarget); }
  if (_delType==='cat')     { catsData    =catsData.filter(c=>c.id!==_delTarget); renderCats(); }
  if (_delType==='editor')  { editorsData =editorsData.filter(e=>e.id!==_delTarget); renderEditors(); refreshAuthorSelect(); }
  if (_delType==='latest')  { latestData  =latestData.filter(l=>l.id!==_delTarget); renderLatest(); }
  if (_delType==='breaking'){ breakingData=breakingData.filter(b=>b.id!==_delTarget); renderBreaking(); }
  saveAll(); closeModal('del-modal'); showToast('🗑️ تم الحذف');
}

// ─── PAGE CONTROLS ────────────────────────────────────────────
function savePageControl(key, value) {
  // Ticker visibility is a separate key (not in atq_site_buttons)
  if (key === 'ticker-on') {
    localStorage.setItem('atq_ticker_visible', value ? '1' : '0');
    _fbUpdateSite({ ticker_visible: value });
    showToast(value ? '✅ الشريط ظاهر' : '👁 الشريط مخفي');
    return;
  }
  // All other controls stored in atq_site_buttons object
  const controls = JSON.parse(localStorage.getItem('atq_site_buttons') || '{}');
  const idMap = {
    'search':      'search-box',
    'lang':        'lang-btn',
    'theme':       'theme-btn',
    'subscribe':   'subscribe-btn',
    'statsbar':    'stats-bar',
    'newsletter':  'site-newsletter',
    'hero':        'site-hero',
    'scrolltop':   'scroll-top',
    'cats':        'cats-strip',
    'ticker-bar':  'site-ticker',
    'footer':      'site-footer',
    'breaking-bar':'breaking-bar-wrap',
  };
  const siteId = idMap[key];
  if (siteId) {
    controls[siteId] = value;
    localStorage.setItem('atq_site_buttons', JSON.stringify(controls));
  }
  if (key === 'force-theme') {
    controls['force-theme'] = value;
    localStorage.setItem('atq_site_buttons', JSON.stringify(controls));
  }
  _fbUpdateSite({ site_buttons: controls });
  showToast(value ? '✅ تم التفعيل' : '⏸ تم الإيقاف');
}

function saveTrendingToggle(enabled) {
  _fbUpdateSite({ trending_enabled: enabled });
  showToast(enabled ? '🔥 قسم التداول مفعّل' : '⏸ قسم التداول مخفي');
}
window.saveTrendingToggle = saveTrendingToggle;

function updateTickerSpeed(val) {
  // Slider 1=slowest(200s) → 100=fastest(10s), linear interpolation
  const v = parseInt(val) || 35;
  const actual = Math.round(210 - 2 * v); // val=1→208, val=100→10
  _fbUpdateSite({ ticker_speed: actual });
  const lbl = document.getElementById('speed-label');
  if (lbl) lbl.textContent = actual + 'ث';
  localStorage.setItem('atq_ticker_speed', actual);
  showToast('✅ سرعة الشريط: ' + actual + ' ثانية');
}

function saveSiteAppearance() {
  const title     = document.getElementById('ctrl-site-title')?.value;
  const sub       = document.getElementById('ctrl-subscribe-text')?.value;
  const sectTitle = document.getElementById('ctrl-section-title')?.value;
  const nlTitle   = document.getElementById('ctrl-newsletter-title')?.value;
  const nlSub     = document.getElementById('ctrl-newsletter-sub')?.value;
  if (title) localStorage.setItem('atq_site_title', title);
  if (sub)   localStorage.setItem('atq_subscribe_text', sub);
  const updates = {};
  if (title)     updates.site_title       = title;
  if (sub)       updates.subscribe_text   = sub;
  if (sectTitle) updates.section_title    = sectTitle;
  if (nlTitle)   updates.newsletter_title = nlTitle;
  if (nlSub)     updates.newsletter_sub   = nlSub;
  if (Object.keys(updates).length) _fbUpdateSite(updates);
  showToast('✅ تم حفظ المظهر');
}


function saveDurationFromCtrl() {
  const val  = parseInt(document.getElementById('breaking-duration-val-ctrl').value) || 5;
  const unit = parseInt(document.getElementById('breaking-duration-unit-ctrl').value) || 60;
  const secs = val * unit;
  localStorage.setItem('atq_breaking_duration', secs);
  const label = unit===3600?'ساعة':unit===60?'دقيقة':'ثانية';
  showToast('✅ مدة الشريط العاجل: ' + val + ' ' + label);
}

function setSiteTheme(theme) {
  localStorage.setItem('atq_theme', theme);
  const ctrl = JSON.parse(localStorage.getItem('atq_site_buttons') || '{}');
  ctrl['force-theme'] = theme;
  localStorage.setItem('atq_site_buttons', JSON.stringify(ctrl));
  _fbUpdateSite({ site_buttons: ctrl });
  showToast(theme === 'light' ? '☀️ السمة الفاتحة مفعّلة' : '🌙 السمة الداكنة مفعّلة');
}

function setSiteLang(lang) {
  localStorage.setItem('atq_lang', lang);
  showToast(lang === 'ar' ? 'ع تم تعيين العربية كلغة افتراضية' : 'EN Set to English by default');
}


function resetAllControls() {
  if (!confirm('هل تريد إعادة ضبط جميع إعدادات الصفحة للافتراضية؟')) return;
  localStorage.removeItem('atq_site_buttons');
  localStorage.removeItem('atq_ticker_visible');
  localStorage.removeItem('atq_ticker_speed');
  localStorage.removeItem('atq_site_title');
  localStorage.removeItem('atq_subscribe_text');
  localStorage.removeItem('atq_theme');
  localStorage.removeItem('atq_lang');
  loadPageControls();
  showToast('✅ تم إعادة ضبط جميع الإعدادات');
}

function syncBreakingShortcut(val) {
  const tog = document.getElementById('breaking-master-toggle');
  if (tog) { tog.checked = val; toggleBreakingMaster(); }
}

function loadPageControls() {
  const controls = JSON.parse(localStorage.getItem('atq_site_buttons')||'{}');
  const map = {
    'ctrl-search':    'search-box',
    'ctrl-lang':      'lang-btn',
    'ctrl-theme':     'theme-btn',
    'ctrl-subscribe': 'subscribe-btn',
    'ctrl-statsbar':  'stats-bar',
    'ctrl-newsletter':'site-newsletter',
    'ctrl-hero':      'site-hero',
    'ctrl-scrolltop': 'scroll-top',
    'ctrl-cats':      'cats-strip',
  };
  Object.entries(map).forEach(([ctrlId, siteId]) => {
    const el = document.getElementById(ctrlId);
    if (el) el.checked = controls[siteId] !== false;
  });
  const speed = localStorage.getItem('atq_ticker_speed') || '20';
  const spEl  = document.getElementById('ctrl-ticker-speed');
  const spLbl = document.getElementById('speed-label');
  if (spEl)  spEl.value = Math.round((210 - parseInt(speed)) / 2); // invert back
  if (spLbl) spLbl.textContent = speed + 'ث';
  const tickOn = document.getElementById('ctrl-ticker-on');
  if (tickOn) tickOn.checked = localStorage.getItem('atq_ticker_visible') !== '0';
  // Breaking toggle is on the breaking news page, not here
  // New controls
  ['ctrl-ticker-bar','ctrl-footer','ctrl-breaking-bar-ctrl'].forEach(ctrlId => {
    const key = { 'ctrl-ticker-bar':'site-ticker', 'ctrl-footer':'site-footer', 'ctrl-breaking-bar-ctrl':'breaking-bar-wrap' }[ctrlId];
    const el = document.getElementById(ctrlId);
    if (el && key) el.checked = controls[key] !== false;
  });
  // Site appearance inputs
  // Footer / site settings cache — must be declared FIRST
  const footerData = _siteSettingsCache || {};

  const titleEl = document.getElementById('ctrl-site-title');
  const subEl   = document.getElementById('ctrl-subscribe-text');
  if (titleEl) titleEl.value = localStorage.getItem('atq_site_title') || 'الأحداث التقنية';
  if (subEl)   subEl.value   = localStorage.getItem('atq_subscribe_text') || 'اشترك مجاناً';
  const sectEl = document.getElementById('ctrl-section-title');
  const nlTEl  = document.getElementById('ctrl-newsletter-title');
  const nlSEl  = document.getElementById('ctrl-newsletter-sub');
  if (sectEl) sectEl.value = footerData.section_title    || '';
  if (nlTEl)  nlTEl.value  = footerData.newsletter_title || '';
  if (nlSEl)  nlSEl.value  = footerData.newsletter_sub   || '';

  // Footer fields — load from cache or localStorage
  const fd = document.getElementById('ctrl-footer-desc');
  const fc = document.getElementById('ctrl-footer-copy');
  const ftw= document.getElementById('ctrl-footer-twitter');
  const fli= document.getElementById('ctrl-footer-linkedin');
  const fyt= document.getElementById('ctrl-footer-youtube');
  const fig= document.getElementById('ctrl-footer-instagram');
  if (fd)  fd.value  = footerData.footer_desc      || localStorage.getItem('atq_footer_desc')      || '';
  if (fc)  fc.value  = footerData.footer_copy      || localStorage.getItem('atq_footer_copy')      || '© ٢٠٢٥ الأحداث التقنية · جميع الحقوق محفوظة';
  if (ftw) ftw.value = footerData.footer_twitter   || localStorage.getItem('atq_footer_twitter')   || '';
  if (fli) fli.value = footerData.footer_linkedin  || localStorage.getItem('atq_footer_linkedin')  || '';
  if (fyt) fyt.value = footerData.footer_youtube   || localStorage.getItem('atq_footer_youtube')   || '';
  if (fig) fig.value = footerData.footer_instagram || localStorage.getItem('atq_footer_instagram') || '';
  // Load footer link URLs
  const flinkIds = ['ai','devices','space','security','gaming','about','team','ads','privacy','contact','newsletter','podcast','popular','archive','reports'];
  flinkIds.forEach(k => {
    const el = document.getElementById('flink-' + k + '-url');
    if (el) el.value = footerData['flink-' + k] || '';
  });
  // Load ad banners
  loadAdBanners();
  // Render social media manager
  renderSocialMedia();
  // Load stats bar values
  loadStatsBar();
  // Render nav menu editor
  renderNavMenuEditor();
  // Load login-screen customization fields
  loadLoginScreenControls();
  // Load article interaction toggles
  loadInteractionToggles();
}

// ─── LOGIN SCREEN CUSTOMIZATION ───────────────────────────────────
const _LOGIN_DEFAULTS = {
  icon:       'ت',
  brand:      'الأحداث التقنية',
  title:      'تسجيل الدخول إلى لوحة التحكم',
  userLabel:  'اسم المستخدم',
  passLabel:  'كلمة المرور',
  button:     'دخول إلى لوحة التحكم',
  error:      '❌ اسم المستخدم أو كلمة المرور غير صحيحة',
  hint:       'بيانات الدخول التجريبية: admin / admin123'
};

function loadLoginScreenControls() {
  const s = (_siteSettingsCache && _siteSettingsCache.login_screen) || {};
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('ctrl-login-icon',       s.icon       || _LOGIN_DEFAULTS.icon);
  set('ctrl-login-brand',      s.brand      || _LOGIN_DEFAULTS.brand);
  set('ctrl-login-title',      s.title      || _LOGIN_DEFAULTS.title);
  set('ctrl-login-user-label', s.userLabel  || _LOGIN_DEFAULTS.userLabel);
  set('ctrl-login-pass-label', s.passLabel  || _LOGIN_DEFAULTS.passLabel);
  set('ctrl-login-button',     s.button     || _LOGIN_DEFAULTS.button);
  set('ctrl-login-error',      s.error      || _LOGIN_DEFAULTS.error);
  set('ctrl-login-hint',       s.hint !== undefined ? s.hint : _LOGIN_DEFAULTS.hint);
}

function saveLoginScreen() {
  const get = id => (document.getElementById(id)?.value || '');
  const payload = {
    icon:      get('ctrl-login-icon')       || _LOGIN_DEFAULTS.icon,
    brand:     get('ctrl-login-brand')      || _LOGIN_DEFAULTS.brand,
    title:     get('ctrl-login-title')      || _LOGIN_DEFAULTS.title,
    userLabel: get('ctrl-login-user-label') || _LOGIN_DEFAULTS.userLabel,
    passLabel: get('ctrl-login-pass-label') || _LOGIN_DEFAULTS.passLabel,
    button:    get('ctrl-login-button')     || _LOGIN_DEFAULTS.button,
    error:     get('ctrl-login-error')      || _LOGIN_DEFAULTS.error,
    hint:      get('ctrl-login-hint'),  // empty allowed → hides hint
  };
  if (!_siteSettingsCache) _siteSettingsCache = {};
  _siteSettingsCache.login_screen = payload;
  _fbUpdateSite({ login_screen: payload });
  // Debounced toast
  if (!window._loginScrToast) window._loginScrToast = null;
  clearTimeout(window._loginScrToast);
  window._loginScrToast = setTimeout(() => showToast('✅ تم حفظ شاشة تسجيل الدخول'), 900);
}

// Apply the stored login-screen content BEFORE any login attempt
// (runs at startup when _siteSettingsCache is first populated by Firebase).
function applyLoginScreenFromCache() {
  const s = (_siteSettingsCache && _siteSettingsCache.login_screen) || {};
  const setText = (id, txt) => { const el = document.getElementById(id); if (el && txt) el.textContent = txt; };
  setText('login-logo-icon',   s.icon);
  setText('login-logo-text',   s.brand);
  setText('login-title-text',  s.title);
  setText('login-user-label',  s.userLabel);
  setText('login-pass-label',  s.passLabel);
  setText('login-button-text', s.button);
  setText('login-error',       s.error);
  const hintEl = document.getElementById('login-hint-text');
  if (hintEl) {
    if (s.hint === '' || s.hint === null) { hintEl.style.display = 'none'; }
    else if (s.hint) { hintEl.textContent = s.hint; hintEl.style.display = ''; }
  }
}

function saveFooterSettings() {
  const desc      = document.getElementById('ctrl-footer-desc')?.value      || '';
  const copy      = document.getElementById('ctrl-footer-copy')?.value      || '';
  const twitter   = document.getElementById('ctrl-footer-twitter')?.value   || '';
  const linkedin  = document.getElementById('ctrl-footer-linkedin')?.value  || '';
  const youtube   = document.getElementById('ctrl-footer-youtube')?.value   || '';
  const instagram = document.getElementById('ctrl-footer-instagram')?.value || '';

  // Cache locally
  localStorage.setItem('atq_footer_desc',      desc);
  localStorage.setItem('atq_footer_copy',       copy);
  localStorage.setItem('atq_footer_twitter',    twitter);
  localStorage.setItem('atq_footer_linkedin',   linkedin);
  localStorage.setItem('atq_footer_youtube',    youtube);
  localStorage.setItem('atq_footer_instagram',  instagram);

  // Push to Firebase so index.html picks it up instantly
  _fbUpdateSite({ footer_desc: desc, footer_copy: copy,
    footer_twitter: twitter, footer_linkedin: linkedin,
    footer_youtube: youtube, footer_instagram: instagram });

  showToast('✅ تم حفظ إعدادات الفوتر');
}

// ─── API KEY MANAGEMENT ────────────────────────────────────────
function _getApiKeys() {
  try { return JSON.parse(localStorage.getItem('atq_api_keys')) || []; }
  catch(_) { return []; }
}
function _saveApiKeys(keys) { localStorage.setItem('atq_api_keys', JSON.stringify(keys)); }
function _getActiveApiKey() {
  const keys = _getApiKeys();
  const active = keys.find(k => k.active && k.key);
  return active ? active.key : '';
}

function renderApiKeysList() {
  const keys = _getApiKeys();
  const list = document.getElementById('api-keys-list');
  if (!list) return;
  if (!keys.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--text-dim);padding:8px 0">لا توجد مفاتيح مضافة</div>';
    _updateApiStatus();
    return;
  }
  list.innerHTML = keys.map((k, i) => `
    <div style="display:flex;gap:8px;align-items:center;background:var(--dark-3);border-radius:10px;padding:10px 12px">
      <div style="flex:1">
        <div style="font-size:11px;color:var(--text-dim);margin-bottom:4px">${k.label || 'Anthropic API'} ${k.active?'<span style=color:var(--green)>● نشط</span>':''}</div>
        <input type="password" value="${k.key}" onchange="updateApiKey(${i},'key',this.value)"
          style="background:none;border:none;outline:none;color:var(--text);font-family:monospace;font-size:12px;width:100%;border-bottom:1px solid var(--border-dim);padding-bottom:2px">
      </div>
      <input type="text" value="${k.label||''}" placeholder="اسم المفتاح" onchange="updateApiKey(${i},'label',this.value)"
        style="width:100px;background:var(--dark-4);border:1px solid var(--border-dim);border-radius:6px;padding:4px 8px;font-family:inherit;font-size:11px;color:var(--text);outline:none">
      <label class="toggle-switch" style="flex-shrink:0"><input type="checkbox" ${k.active?'checked':''} onchange="setActiveApiKey(${i},this.checked)"><span class="toggle-slider"></span></label>
      <button onclick="deleteApiKey(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:0 4px" title="حذف">×</button>
    </div>`).join('');
  _updateApiStatus();
}

function addApiKeyRow() {
  const keys = _getApiKeys();
  keys.push({key:'', label:'Anthropic API', active: keys.length === 0});
  _saveApiKeys(keys);
  renderApiKeysList();
}
function deleteApiKey(i) {
  const keys = _getApiKeys();
  keys.splice(i, 1);
  _saveApiKeys(keys);
  renderApiKeysList();
}
function updateApiKey(i, field, val) {
  const keys = _getApiKeys();
  if (keys[i]) keys[i][field] = val;
  _saveApiKeys(keys);
  _updateApiStatus();
}
function setActiveApiKey(i, active) {
  const keys = _getApiKeys();
  keys.forEach((k,j) => k.active = (j === i && active));
  _saveApiKeys(keys);
  renderApiKeysList();
}
function toggleApiKeysPanel() {
  const panel = document.getElementById('api-keys-panel');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  if (!open) renderApiKeysList();
  const btn = document.getElementById('api-keys-toggle');
  if (btn) btn.textContent = open ? '⚙️ إدارة المفاتيح' : '✕ إغلاق';
}
function _updateApiStatus() {
  const active = _getActiveApiKey();
  const ind = document.getElementById('api-status-indicator');
  const txt = document.getElementById('api-status-text');
  if (ind) ind.style.background = active ? 'var(--green)' : 'var(--text-dim)';
  if (txt) txt.textContent = active ? `✅ مفتاح API نشط (${active.substring(0,10)}...)` : 'لم يتم تعيين مفتاح API بعد — الاستيراد غير متاح';
}
async function testApiKey() {
  const key = _getActiveApiKey();
  if (!key) { showToast('⚠️ أضف مفتاحاً أولاً'); return; }
  showToast('🔌 جاري اختبار الاتصال...');
  try {
    const r = await fetch('/api/anthropic', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
      body: JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:10,messages:[{role:'user',content:'hi'}]})
    });
    const d = await r.json();
    if (d.content) showToast('✅ مفتاح API يعمل بنجاح');
    else showToast('❌ خطأ: ' + (d.error?.message || 'رد غير متوقع'));
  } catch(e) { showToast('❌ فشل الاتصال: ' + e.message); }
}


// ─── DYNAMIC SOCIAL MEDIA MANAGER ────────────────────────────────
function _getSocialMedia() {
  const SOCIAL_DEFAULTS = [
    {name:'تويتر/X',  icon:'𝕏',  url:''},
    {name:'لينكدإن',  icon:'in', url:''},
    {name:'يوتيوب',   icon:'▶',  url:''},
    {name:'إنستغرام', icon:'📷', url:''},
    {name:'فيسبوك',   icon:'f',  url:''},
    {name:'تيك توك',  icon:'♪',  url:''},
  ];
  const saved = _siteSettingsCache && _siteSettingsCache.social_media;
  if (!saved || !saved.length) return SOCIAL_DEFAULTS;
  // Merge: ensure new defaults (Facebook, TikTok) always present
  const savedNames = new Set(saved.map(s => s.name));
  const missing = SOCIAL_DEFAULTS.filter(d => !savedNames.has(d.name));
  return [...saved, ...missing];
}

function renderSocialMedia() {
  const list = document.getElementById('social-media-list');
  if (!list) return;
  const socials = _getSocialMedia();
  list.innerHTML = socials.map((s,i) => `
    <div style="display:flex;gap:8px;align-items:center;background:var(--dark-3);border-radius:8px;padding:8px 10px">
      <input type="text" value="${s.icon||''}" oninput="updateSocialMedia(${i},'icon',this.value)"
        style="width:40px;text-align:center;background:none;border:1px solid var(--border-dim);border-radius:6px;padding:4px;font-size:14px;color:var(--text);outline:none" placeholder="أيقونة">
      <input type="text" value="${s.name||''}" oninput="updateSocialMedia(${i},'name',this.value)"
        style="width:90px;background:none;border:1px solid var(--border-dim);border-radius:6px;padding:4px 8px;font-size:11px;color:var(--text);font-family:inherit;outline:none" placeholder="الاسم">
      <input type="text" value="${s.url||''}" oninput="updateSocialMedia(${i},'url',this.value)"
        style="flex:1;background:none;border:1px solid var(--border-dim);border-radius:6px;padding:4px 8px;font-size:11px;color:var(--text);font-family:inherit;outline:none" placeholder="https://...">
      <button onclick="deleteSocialMedia(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:0 4px">×</button>
    </div>`).join('') || '<div style="font-size:12px;color:var(--text-dim);padding:8px">لا توجد حسابات. أضف بالزر أعلاه.</div>';
}

function addSocialMedia() {
  const socials = _getSocialMedia();
  socials.push({name:'', icon:'🔗', url:''});
  _siteSettingsCache.social_media = socials;
  renderSocialMedia();
  _saveSocialMedia(socials);
}
function deleteSocialMedia(i) {
  const socials = _getSocialMedia();
  socials.splice(i,1);
  _siteSettingsCache.social_media = socials;
  renderSocialMedia();
  _saveSocialMedia(socials);
}
function updateSocialMedia(i, field, val) {
  const socials = _getSocialMedia();
  if (socials[i]) socials[i][field] = val;
  if (!_siteSettingsCache) _siteSettingsCache = {};
  _siteSettingsCache.social_media = [...socials];
  // Debounce: wait 800ms after last keystroke before saving
  clearTimeout(window._socTimer);
  window._socTimer = setTimeout(() => {
    _saveSocialMedia(socials);
    renderSocialMedia();
  }, 800);
}
function _saveSocialMedia(socials) {
  _fbUpdateSite({ social_media: socials });
  showToast('✅ تم حفظ حسابات التواصل');
}

function saveFooterLinks() {
  const ids = ['ai','devices','space','security','gaming','about','team','ads','privacy','contact','newsletter','podcast','popular','archive','reports'];
  const updates = {};
  ids.forEach(k => {
    const el = document.getElementById('flink-' + k + '-url');
    if (el && el.value) updates['flink-' + k] = el.value;
  });
  if (Object.keys(updates).length) _fbUpdateSite(updates);
}


// ─── DISABLE/ENABLE ALL COMMENTS ─────────────────────────────────
function disableAllComments() {
  if (!confirm('إيقاف التعليقات من جميع الأخبار؟')) return;
  newsData.forEach(n => { n.commentsEnabled = false; _fbSetNews(n); });
  saveAll(); renderNewsTable(newsData);
  showToast('🚫 تم إيقاف التعليقات من جميع الأخبار');
}
function enableAllComments() {
  newsData.forEach(n => { n.commentsEnabled = true; _fbSetNews(n); });
  saveAll(); renderNewsTable(newsData);
  showToast('✅ تم تفعيل التعليقات لجميع الأخبار');
}

// ─── STATS BAR ────────────────────────────────────────────────────
function saveStatsBar() {
  const stats = [];
  for (let i=1; i<=4; i++) {
    const val = document.getElementById('stat-val-'+i)?.value || '';
    const lbl = document.getElementById('stat-lbl-'+i)?.value || '';
    stats.push({val, lbl});
  }
  _fbUpdateSite({ stats_bar: stats });
  showToast('✅ تم حفظ الإحصائيات');
}
function loadStatsBar() {
  const stats = _siteSettingsCache?.stats_bar;
  if (!stats || !stats.length) return;
  stats.forEach((s, i) => {
    const vi = document.getElementById('stat-val-'+(i+1));
    const li = document.getElementById('stat-lbl-'+(i+1));
    if (vi) vi.value = s.val || '';
    if (li) li.value = s.lbl || '';
  });
}

// ─── NAV MENU EDITOR ──────────────────────────────────────────────
const _defaultNavItems = [
  {label:'الرئيسية', cat:'الكل', type:'home'},
  {label:'الذكاء الاصطناعي', cat:'الذكاء الاصطناعي', type:'cat'},
  {label:'الهواتف والأجهزة', cat:'الهواتف والأجهزة', type:'cat'},
  {label:'الفضاء والعلوم', cat:'الفضاء والعلوم', type:'cat'},
  {label:'الأمن الرقمي', cat:'الأمن الرقمي', type:'cat'},
  {label:'الشركات والأعمال', cat:'الشركات والأعمال', type:'cat'},
];

function _getNavItems() {
  return _siteSettingsCache?.nav_menu || _defaultNavItems;
}

function renderNavMenuEditor() {
  const items = _getNavItems();
  const html = items.map((item, i) => `
    <div style="display:flex;gap:8px;align-items:center;background:var(--dark-3);border-radius:8px;padding:8px 10px">
      <span style="font-size:12px;color:var(--text-dim);min-width:20px;text-align:center">${i+1}</span>
      <input type="text" value="${item.label||''}" onchange="updateNavItem(${i},'label',this.value)"
        style="flex:1;background:none;border:none;border-bottom:1px solid var(--border-dim);padding:4px 6px;font-family:inherit;font-size:13px;color:var(--text);outline:none" placeholder="اسم الرابط">
      <select onchange="updateNavItem(${i},'type',this.value)"
        style="background:var(--dark-4);border:1px solid var(--border-dim);border-radius:6px;padding:4px 6px;font-family:inherit;font-size:11px;color:var(--text);outline:none">
        <option value="home" ${item.type==='home'?'selected':''}>الرئيسية</option>
        <option value="cat"  ${item.type==='cat'?'selected':''}>قسم</option>
        <option value="url"  ${item.type==='url'?'selected':''}>رابط خارجي</option>
        <option value="allnews" ${item.type==='allnews'?'selected':''}>كل الأخبار</option>
      </select>
      <input type="text" value="${item.cat||item.url||''}" onchange="updateNavItem(${i},'cat',this.value)"
        style="width:130px;background:none;border:1px solid var(--border-dim);border-radius:6px;padding:4px 8px;font-family:inherit;font-size:11px;color:var(--text);outline:none" placeholder="اسم القسم / رابط">
      <button onclick="deleteNavItem(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:0 4px">×</button>
    </div>`).join('') || '<div style="color:var(--text-dim);font-size:13px;padding:8px">لا توجد روابط — أضف بالزر أعلاه.</div>';
  // Render into both legacy and new identity-page containers
  const editor = document.getElementById('nav-menu-editor');
  if (editor) editor.innerHTML = html;
  const idNav = document.getElementById('id-nav-menu-list');
  if (idNav) idNav.innerHTML = html;
}
// Alias used when the identity page opens
function renderIdentityNavMenu() { renderNavMenuEditor(); }

function addNavMenuItem() {
  const items = _getNavItems();
  items.push({label:'رابط جديد', cat:'', type:'cat'});
  if (!_siteSettingsCache) _siteSettingsCache = {};
  _siteSettingsCache.nav_menu = items;
  renderNavMenuEditor();
}
function deleteNavItem(i) {
  const items = _getNavItems();
  items.splice(i,1);
  if (!_siteSettingsCache) _siteSettingsCache = {};
  _siteSettingsCache.nav_menu = items;
  renderNavMenuEditor();
}
function updateNavItem(i, field, val) {
  const items = _getNavItems();
  if (items[i]) items[i][field] = val;
  if (!_siteSettingsCache) _siteSettingsCache = {};
  _siteSettingsCache.nav_menu = items;
}
function saveNavMenu() {
  const items = _getNavItems();
  _fbUpdateSite({ nav_menu: items });
  showToast('✅ تم حفظ القائمة — ستظهر على الموقع فوراً');
}
function resetNavMenu() {
  if (!_siteSettingsCache) _siteSettingsCache = {};
  _siteSettingsCache.nav_menu = _defaultNavItems;
  _fbUpdateSite({ nav_menu: _defaultNavItems });
  renderNavMenuEditor();
  showToast('↺ تم إعادة ضبط القائمة');
}


// ─── IDENTITY SETTINGS (logo + brand name) ─────────────────────────
const _IDENTITY_DEFAULTS = { logoIcon: 'ت', brandName: 'الأحداث التقنية', logoImage: '' };

function loadIdentitySettings() {
  const id = (_siteSettingsCache && _siteSettingsCache.identity) || {};
  const iconEl  = document.getElementById('id-logo-icon');
  const brandEl = document.getElementById('id-brand-name');
  const imgEl   = document.getElementById('id-logo-image');
  if (iconEl)  iconEl.value  = id.logoIcon  || _IDENTITY_DEFAULTS.logoIcon;
  if (brandEl) brandEl.value = id.brandName || _IDENTITY_DEFAULTS.brandName;
  if (imgEl)   imgEl.value   = id.logoImage || '';
  _refreshIdentityPreview();
}

function _refreshIdentityPreview() {
  const iconEl   = document.getElementById('id-logo-icon');
  const brandEl  = document.getElementById('id-brand-name');
  const imgEl    = document.getElementById('id-logo-image');
  const previewI = document.getElementById('id-preview-icon');
  const previewB = document.getElementById('id-preview-brand');
  const uploadP  = document.getElementById('id-logo-img-preview');
  const hasImage = imgEl && imgEl.value;
  // Main preview (right of "معاينة" label) — show image if present, else emoji/letter
  if (previewI) {
    if (hasImage) {
      previewI.innerHTML = `<img src="${imgEl.value}" alt="logo" style="width:100%;height:100%;object-fit:cover">`;
      previewI.style.background = 'var(--dark-3)';
    } else {
      previewI.innerHTML = '';
      previewI.textContent = (iconEl && iconEl.value) || _IDENTITY_DEFAULTS.logoIcon;
      previewI.style.background = 'linear-gradient(135deg,var(--gold),#a07020)';
    }
  }
  if (brandEl && previewB) previewB.textContent = brandEl.value || _IDENTITY_DEFAULTS.brandName;
  // File-input preview box
  if (uploadP) {
    if (hasImage) {
      uploadP.innerHTML = `<img src="${imgEl.value}" alt="logo" style="width:100%;height:100%;object-fit:cover">`;
    } else {
      uploadP.innerHTML = '🖼';
    }
  }
}

function saveIdentitySettings() {
  _refreshIdentityPreview();
  const payload = {
    logoIcon:  document.getElementById('id-logo-icon')?.value  || _IDENTITY_DEFAULTS.logoIcon,
    brandName: document.getElementById('id-brand-name')?.value || _IDENTITY_DEFAULTS.brandName,
    logoImage: document.getElementById('id-logo-image')?.value || '',
  };
  if (!_siteSettingsCache) _siteSettingsCache = {};
  _siteSettingsCache.identity = payload;
  _fbUpdateSite({ identity: payload });
  // Debounced toast
  if (!window._idToastTimer) window._idToastTimer = null;
  clearTimeout(window._idToastTimer);
  window._idToastTimer = setTimeout(() => showToast('✅ تم حفظ الهوية'), 900);
}

function restoreIdentityDefaults() {
  const iconEl  = document.getElementById('id-logo-icon');
  const brandEl = document.getElementById('id-brand-name');
  const imgEl   = document.getElementById('id-logo-image');
  if (iconEl)  iconEl.value  = _IDENTITY_DEFAULTS.logoIcon;
  if (brandEl) brandEl.value = _IDENTITY_DEFAULTS.brandName;
  if (imgEl)   imgEl.value   = '';
  saveIdentitySettings();
  showToast('↺ تم استعادة الهوية الافتراضية');
}

// Handle file upload: read image → base64 data URL → save to Firebase
function uploadLogoImage(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  // Size guard: 500 KB max
  if (file.size > 500 * 1024) {
    showToast('⚠️ الصورة كبيرة جداً — الحد الأقصى 500 KB. استخدم صورة أصغر أو اضغطها أولاً.');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const hiddenEl = document.getElementById('id-logo-image');
    if (hiddenEl) hiddenEl.value = dataUrl;
    saveIdentitySettings();
    showToast('✅ تم رفع الشعار');
  };
  reader.onerror = () => showToast('⚠️ فشل قراءة الصورة');
  reader.readAsDataURL(file);
  input.value = ''; // allow re-uploading the same file
}

function removeLogoImage() {
  const hiddenEl = document.getElementById('id-logo-image');
  if (hiddenEl) hiddenEl.value = '';
  saveIdentitySettings();
  showToast('🗑 تم إزالة الشعار — سيتم استخدام الأيقونة البديلة');
}

// ─── LAYOUT SETTINGS (hero height + ad banner heights) ─────────────
const _LAYOUT_DEFAULTS = {
  heroHeight:      500,
  heroSideHeight:  500,
  heroSideCount:   4,
  heroSideWidth:   340,
  heroSideThumbSize: 88,
  sidebarCatColored: true,
  sidebarCatShape:   'pill',
  adTopHeight:     null,
  adBottomHeight:  null,
  adGridHeight:    null,
  adArticleHeight: null,
  adAllnewsHeight: null,
};

function loadLayoutSettings() {
  const l = (_siteSettingsCache && _siteSettingsCache.layout) || {};
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = (v == null ? '' : v); };
  set('id-hero-main-h',      l.heroHeight     != null ? l.heroHeight     : _LAYOUT_DEFAULTS.heroHeight);
  set('id-hero-side-h',      l.heroSideHeight != null ? l.heroSideHeight : _LAYOUT_DEFAULTS.heroSideHeight);
  set('id-hero-side-count',  l.heroSideCount  != null ? l.heroSideCount  : _LAYOUT_DEFAULTS.heroSideCount);
  set('id-hero-side-w',      l.heroSideWidth  != null ? l.heroSideWidth  : _LAYOUT_DEFAULTS.heroSideWidth);
  set('id-hero-side-thumb',  l.heroSideThumbSize != null ? l.heroSideThumbSize : _LAYOUT_DEFAULTS.heroSideThumbSize);
  // Sidebar category chip
  const colEl = document.getElementById('id-sidebar-cat-colored');
  if (colEl) colEl.checked = (l.sidebarCatColored !== false);
  const shape = l.sidebarCatShape || _LAYOUT_DEFAULTS.sidebarCatShape;
  const shapeEl = document.querySelector(`input[name="id-sidebar-cat-shape"][value="${shape}"]`);
  if (shapeEl) shapeEl.checked = true;
  set('id-ad-top-h',      l.adTopHeight);
  set('id-ad-bottom-h',   l.adBottomHeight);
  set('id-ad-grid-h',     l.adGridHeight);
  set('id-ad-article-h',  l.adArticleHeight);
  set('id-ad-allnews-h',  l.adAllnewsHeight);
}

function saveLayoutSettings() {
  const num = id => {
    const v = document.getElementById(id)?.value;
    if (v === '' || v == null) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  };
  const clamp = (v, min, max, def) => {
    if (v == null) return def;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  };
  const payload = {
    heroHeight:      num('id-hero-main-h')  ?? _LAYOUT_DEFAULTS.heroHeight,
    heroSideHeight:  num('id-hero-side-h')  ?? num('id-hero-main-h') ?? _LAYOUT_DEFAULTS.heroSideHeight,
    heroSideCount:   clamp(num('id-hero-side-count'), 1, 6, _LAYOUT_DEFAULTS.heroSideCount),
    heroSideWidth:   clamp(num('id-hero-side-w'),   240, 500, _LAYOUT_DEFAULTS.heroSideWidth),
    heroSideThumbSize: clamp(num('id-hero-side-thumb'), 48, 140, _LAYOUT_DEFAULTS.heroSideThumbSize),
    sidebarCatColored: !!(document.getElementById('id-sidebar-cat-colored')?.checked),
    sidebarCatShape:   (document.querySelector('input[name="id-sidebar-cat-shape"]:checked')?.value) || _LAYOUT_DEFAULTS.sidebarCatShape,
    adTopHeight:     num('id-ad-top-h'),
    adBottomHeight:  num('id-ad-bottom-h'),
    adGridHeight:    num('id-ad-grid-h'),
    adArticleHeight: num('id-ad-article-h'),
    adAllnewsHeight: num('id-ad-allnews-h'),
  };
  if (!_siteSettingsCache) _siteSettingsCache = {};
  _siteSettingsCache.layout = payload;
  _fbUpdateSite({ layout: payload });
  if (!window._layoutToastTimer) window._layoutToastTimer = null;
  clearTimeout(window._layoutToastTimer);
  window._layoutToastTimer = setTimeout(() => showToast('✅ تم حفظ التخطيط'), 900);
}

function alignHeroHeights() {
  const mainEl = document.getElementById('id-hero-main-h');
  const sideEl = document.getElementById('id-hero-side-h');
  if (!mainEl || !sideEl) return;
  const targetH = Number(mainEl.value) || _LAYOUT_DEFAULTS.heroHeight;
  mainEl.value = targetH;
  sideEl.value = targetH;
  saveLayoutSettings();
  showToast('⇅ تمت المحاذاة — الشريط الجانبي يطابق الخبر الرئيسي الآن');
}

function restoreHeroDefaults() {
  const mainEl  = document.getElementById('id-hero-main-h');
  const sideEl  = document.getElementById('id-hero-side-h');
  const countEl = document.getElementById('id-hero-side-count');
  const widthEl = document.getElementById('id-hero-side-w');
  const thumbEl = document.getElementById('id-hero-side-thumb');
  if (mainEl)  mainEl.value  = _LAYOUT_DEFAULTS.heroHeight;
  if (sideEl)  sideEl.value  = _LAYOUT_DEFAULTS.heroSideHeight;
  if (countEl) countEl.value = _LAYOUT_DEFAULTS.heroSideCount;
  if (widthEl) widthEl.value = _LAYOUT_DEFAULTS.heroSideWidth;
  if (thumbEl) thumbEl.value = _LAYOUT_DEFAULTS.heroSideThumbSize;
  saveLayoutSettings();
  showToast('↺ تم استعادة تخطيط Hero الافتراضي');
}

// ─── MAINTENANCE MODE ─────────────────────────────────────────────
const _MAINT_DEFAULTS = {
  active: false,
  text:   'الموقع تحت الصيانة... نعود قريباً',
  image:  '',
};
function loadMaintenance() {
  const m = (_siteSettingsCache && _siteSettingsCache.maintenance) || {};
  const activeEl = document.getElementById('maint-active');
  const textEl   = document.getElementById('maint-text');
  const prevEl   = document.getElementById('maint-image-preview');
  if (activeEl) activeEl.checked = !!m.active;
  if (textEl)   textEl.value     = m.text != null ? m.text : _MAINT_DEFAULTS.text;
  if (prevEl) {
    if (m.image) {
      prevEl.style.backgroundImage = `url("${m.image}")`;
      prevEl.textContent = '';
    } else {
      prevEl.style.backgroundImage = '';
      prevEl.textContent = '🛠️';
    }
  }
}
function saveMaintenance() {
  const activeEl = document.getElementById('maint-active');
  const textEl   = document.getElementById('maint-text');
  const prev     = (_siteSettingsCache && _siteSettingsCache.maintenance) || {};
  const payload = {
    active: !!(activeEl && activeEl.checked),
    text:   (textEl && textEl.value != null) ? textEl.value : _MAINT_DEFAULTS.text,
    image:  prev.image || '',  // image is only updated via handleMaintImageUpload/clearMaintImage
  };
  if (!_siteSettingsCache) _siteSettingsCache = {};
  _siteSettingsCache.maintenance = payload;
  clearTimeout(window._maintSaveTimer);
  window._maintSaveTimer = setTimeout(() => {
    _fbUpdateSite({ maintenance: payload });
    showToast(payload.active ? '🛠️ وضع الصيانة مفعَّل' : '✅ تم الحفظ');
  }, 600);
}
function handleMaintImageUpload(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 500 * 1024) {
    alert('⚠️ حجم الصورة أكبر من 500KB. الرجاء اختيار صورة أصغر.');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    const prevEl = document.getElementById('maint-image-preview');
    if (prevEl) { prevEl.style.backgroundImage = `url("${dataUrl}")`; prevEl.textContent = ''; }
    if (!_siteSettingsCache) _siteSettingsCache = {};
    if (!_siteSettingsCache.maintenance) _siteSettingsCache.maintenance = {};
    _siteSettingsCache.maintenance.image = dataUrl;
    saveMaintenance();
  };
  reader.readAsDataURL(file);
}
function clearMaintImage() {
  const prevEl = document.getElementById('maint-image-preview');
  if (prevEl) { prevEl.style.backgroundImage = ''; prevEl.textContent = '🛠️'; }
  const inputEl = document.getElementById('maint-image-input');
  if (inputEl) inputEl.value = '';
  if (!_siteSettingsCache) _siteSettingsCache = {};
  if (!_siteSettingsCache.maintenance) _siteSettingsCache.maintenance = {};
  _siteSettingsCache.maintenance.image = '';
  saveMaintenance();
}
function restoreMaintDefaults() {
  if (!confirm('هل تريد إعادة ضبط نص وصورة الصيانة إلى القيم الافتراضية؟')) return;
  const activeEl = document.getElementById('maint-active');
  const textEl   = document.getElementById('maint-text');
  if (textEl)   textEl.value = _MAINT_DEFAULTS.text;
  if (activeEl) activeEl.checked = false;
  clearMaintImage(); // resets image + triggers save
  showToast('↺ تم استعادة القيم الافتراضية');
}
window.saveMaintenance        = saveMaintenance;
window.handleMaintImageUpload = handleMaintImageUpload;
window.clearMaintImage        = clearMaintImage;
window.restoreMaintDefaults   = restoreMaintDefaults;
window.loadMaintenance        = loadMaintenance;

function restoreAdHeightDefaults() {
  ['id-ad-top-h','id-ad-bottom-h','id-ad-grid-h','id-ad-article-h','id-ad-allnews-h'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  saveLayoutSettings();
  showToast('↺ تم إعادة ضبط ارتفاعات البانرات');
}


// ─── SUBSCRIBERS ─────────────────────────────────────────────────
let _subscribersData = [];


// ─── EMAIL SUBSCRIBERS ────────────────────────────────────────
let _selectedSubs = new Set();

function toggleAllSubs(checked) {
  _selectedSubs = checked ? new Set(_subscribersData.map(s => s.email)) : new Set();
  document.querySelectorAll('.sub-check').forEach(cb => cb.checked = checked);
}
function toggleSubSelect(email, checked) {
  if (checked) _selectedSubs.add(email);
  else _selectedSubs.delete(email);
}
function openEmailModal() {
  const targets = _selectedSubs.size > 0 ? [..._selectedSubs] : _subscribersData.map(s => s.email);
  const info = document.getElementById('email-recipients-info');
  if (info) info.textContent = targets.length + ' مشترك' + (_selectedSubs.size > 0 ? ' (محدد)' : ' (الكل)');
  openModal('email-modal');
}
function sendEmailToSubs() {
  const subject = document.getElementById('email-subject')?.value.trim();
  const body    = document.getElementById('email-body')?.value.trim();
  if (!subject || !body) { showToast('⚠️ أدخل الموضوع والرسالة'); return; }
  const targets = _selectedSubs.size > 0 ? [..._selectedSubs] : _subscribersData.map(s => s.email);
  if (!targets.length) { showToast('⚠️ لا يوجد مشتركون'); return; }
  // Open mailto with BCC for privacy
  const bcc   = targets.slice(0, 50).join(','); // browser limit ~50
  const mailto = `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailto);
  if (targets.length > 50) showToast(`⚠️ تم فتح أول 50 مستقبل من ${targets.length}. أرسل دفعات متعددة.`);
  closeModal('email-modal');
}

async function loadSubscribers() {
  const tbody = document.getElementById('sub-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px"><div class="ai-spinner"></div></td></tr>';
  try {
    const snap = await getDocs(collection(_db, 'subscribers'));
    _subscribersData = [];
    snap.forEach(d => {
      const data = d.data();
      _subscribersData.push({ id: d.id, email: data.email || '', source: data.source || 'newsletter',
        date: data.subscribedAt ? new Date(data.subscribedAt.seconds * 1000).toLocaleDateString('ar-EG') : '—' });
    });
    _subscribersData.sort((a,b) => b.id.localeCompare(a.id)); // newest first
    renderSubscribersTable(_subscribersData);
    // Update badge
    const badge = document.getElementById('subscribers-count-badge');
    if (badge && _subscribersData.length > 0) {
      badge.textContent = _subscribersData.length;
      badge.style.display = 'inline';
    }
    const total = document.getElementById('sub-total');
    if (total) total.textContent = _subscribersData.length + ' مشترك';
  } catch(e) {
    console.error('Load subscribers error:', e);
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--red)">⚠️ خطأ في تحميل البيانات: ' + e.message + '</td></tr>';
  }
}

// ─── INBOX (Contact Us messages) ────────────────────────────────
let _inboxData = [];
let _inboxUnsub = null;

// Start a snapshot listener for live unread-count badge (called once at init)
function _startInboxListener() {
  if (_inboxUnsub) return; // already listening
  try {
    _inboxUnsub = onSnapshot(collection(_db, 'contact_messages'), snap => {
      let unread = 0;
      snap.forEach(d => { if (d.data().read === false) unread++; });
      const badge = document.getElementById('inbox-unread-badge');
      if (badge) {
        if (unread > 0) {
          badge.textContent = String(unread);
          badge.style.display = 'inline';
        } else {
          badge.style.display = 'none';
        }
      }
    }, err => console.warn('[FB] inbox listener:', err));
  } catch(e) { console.warn('[FB] inbox listener init:', e); }
}

async function loadInboxMessages() {
  const host = document.getElementById('inbox-list');
  if (!host) return;
  host.innerHTML = '<div style="text-align:center;padding:20px"><div class="ai-spinner"></div></div>';
  try {
    const snap = await getDocs(collection(_db, 'contact_messages'));
    _inboxData = [];
    snap.forEach(d => {
      const data = d.data();
      _inboxData.push({
        id: d.id,
        name: data.name || '',
        email: data.email || '',
        mobile: data.mobile || '',
        subject: data.subject || '',
        message: data.message || '',
        read: data.read === true,
        createdAt: data.createdAt ? data.createdAt.seconds * 1000 : 0,
      });
    });
    _inboxData.sort((a, b) => b.createdAt - a.createdAt); // newest first
    _renderInbox();
  } catch(e) {
    console.error('Load inbox error:', e);
    host.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red)">⚠️ خطأ: ' + e.message + '</div>';
  }
}

function _renderInbox() {
  const host = document.getElementById('inbox-list');
  const label = document.getElementById('inbox-count-label');
  if (!host) return;
  if (label) {
    const unread = _inboxData.filter(m => !m.read).length;
    label.textContent = `${_inboxData.length} رسالة${unread ? ` (${unread} غير مقروءة)` : ''}`;
  }
  if (!_inboxData.length) {
    host.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim)"><div style="font-size:32px;margin-bottom:8px">📭</div>لا توجد رسائل بعد</div>';
    return;
  }
  host.innerHTML = _inboxData.map(m => {
    const dateStr = m.createdAt
      ? new Date(m.createdAt).toLocaleString('ar-EG', { dateStyle:'medium', timeStyle:'short' })
      : '—';
    const unreadBadge = !m.read
      ? '<span style="background:var(--red);color:white;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:0.5px">جديد</span>'
      : '';
    const safe = s => String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const mobileRow = m.mobile
      ? `<div style="font-size:12px;color:var(--text-dim)">📞 <a href="tel:${safe(m.mobile)}" style="color:var(--accent);text-decoration:none">${safe(m.mobile)}</a></div>`
      : '';
    const subjectRow = m.subject
      ? `<div style="font-size:13px;font-weight:600;color:var(--text);margin:6px 0">${safe(m.subject)}</div>`
      : '';
    return `
    <div style="background:${m.read?'var(--dark-3)':'rgba(255,82,82,0.04)'};border:1px solid ${m.read?'var(--border-dim)':'rgba(255,82,82,0.2)'};border-radius:10px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
            <span style="font-size:14px;font-weight:700;color:var(--text)">${safe(m.name)}</span>
            ${unreadBadge}
          </div>
          <div style="font-size:12px;color:var(--text-dim)">📧 <a href="mailto:${safe(m.email)}${m.subject?'?subject='+encodeURIComponent('رد: '+m.subject):''}" style="color:var(--accent);text-decoration:none">${safe(m.email)}</a></div>
          ${mobileRow}
        </div>
        <div style="font-size:11px;color:var(--text-dim);white-space:nowrap">${dateStr}</div>
      </div>
      ${subjectRow}
      <div style="font-size:13px;color:var(--text-muted);line-height:1.6;white-space:pre-wrap;background:var(--dark-4);border-radius:8px;padding:10px 12px;margin:8px 0">${safe(m.message)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${!m.read
          ? `<button class="btn-secondary" onclick="markMessageRead('${m.id}', true)" style="font-size:11px;padding:5px 12px">✓ وسم كمقروء</button>`
          : `<button class="btn-secondary" onclick="markMessageRead('${m.id}', false)" style="font-size:11px;padding:5px 12px">↺ وسم كغير مقروء</button>`}
        <a href="mailto:${safe(m.email)}?subject=${encodeURIComponent('رد: '+(m.subject||'رسالتك'))}" class="btn-secondary" style="font-size:11px;padding:5px 12px;text-decoration:none;display:inline-flex;align-items:center;gap:4px">✉️ رد</a>
        <button onclick="forwardInboxMessage('${m.id}')" class="btn-secondary" style="font-size:11px;padding:5px 12px">↗ تحويل</button>
        <button onclick="deleteInboxMessage('${m.id}')" class="btn-secondary" style="font-size:11px;padding:5px 12px;color:var(--red);border-color:rgba(255,82,82,0.3);margin-right:auto">🗑 حذف</button>
      </div>
    </div>`;
  }).join('');
}

async function markMessageRead(id, read) {
  try {
    await updateDoc(doc(_db, 'contact_messages', id), { read: !!read });
    const m = _inboxData.find(x => x.id === id);
    if (m) m.read = !!read;
    _renderInbox();
    showToast(read ? '✓ تم وسم الرسالة كمقروءة' : '↺ تم وسمها كغير مقروءة');
  } catch(e) { console.error(e); showToast('⚠️ خطأ: ' + e.message); }
}

async function deleteInboxMessage(id) {
  if (!confirm('هل تريد حذف هذه الرسالة نهائياً؟')) return;
  try {
    await deleteDoc(doc(_db, 'contact_messages', id));
    _inboxData = _inboxData.filter(m => m.id !== id);
    _renderInbox();
    showToast('🗑 تم الحذف');
  } catch(e) { console.error(e); showToast('⚠️ خطأ: ' + e.message); }
}

function forwardInboxMessage(id) {
  const m = _inboxData.find(x => x.id === id);
  if (!m) return;
  const fwdEmail = (_siteSettingsCache && _siteSettingsCache.inbox_forward_email) || '';
  if (!fwdEmail) {
    showToast('⚠️ لم يتم ضبط بريد التحويل في أعلى الصفحة');
    return;
  }
  const subject = encodeURIComponent('تحويل: ' + (m.subject || 'رسالة من موقع الأحداث التقنية'));
  const body = encodeURIComponent(
    `رسالة مُحوَّلة من موقع الأحداث التقنية\n\n` +
    `من: ${m.name}\n` +
    `البريد: ${m.email}\n` +
    (m.mobile ? `الهاتف: ${m.mobile}\n` : '') +
    (m.subject ? `الموضوع: ${m.subject}\n` : '') +
    `التاريخ: ${new Date(m.createdAt).toLocaleString('ar-EG')}\n\n` +
    `----- الرسالة -----\n${m.message}\n`
  );
  window.location.href = `mailto:${fwdEmail}?subject=${subject}&body=${body}`;
}

function loadInboxForwarding() {
  const active = !!(_siteSettingsCache && _siteSettingsCache.inbox_forward_active);
  const email  = (_siteSettingsCache && _siteSettingsCache.inbox_forward_email) || '';
  const activeEl = document.getElementById('inbox-fwd-active');
  const emailEl  = document.getElementById('inbox-fwd-email');
  if (activeEl) {
    activeEl.checked = active;
    _updateInboxFwdSwitchColor(active);
  }
  if (emailEl) emailEl.value = email;
}

function _updateInboxFwdSwitchColor(on) {
  const slider = document.querySelector('#inbox-fwd-active + span');
  if (!slider) return;
  slider.style.background = on ? 'var(--green)' : 'var(--dark-4)';
  const knob = slider.querySelector('span');
  if (knob) knob.style.right = on ? '22px' : '3px';
}

function saveInboxForwarding() {
  const active = !!(document.getElementById('inbox-fwd-active')?.checked);
  const email  = (document.getElementById('inbox-fwd-email')?.value || '').trim();
  _updateInboxFwdSwitchColor(active);
  if (!_siteSettingsCache) _siteSettingsCache = {};
  _siteSettingsCache.inbox_forward_active = active;
  _siteSettingsCache.inbox_forward_email  = email;
  clearTimeout(window._inboxFwdTimer);
  window._inboxFwdTimer = setTimeout(() => {
    _fbUpdateSite({ inbox_forward_active: active, inbox_forward_email: email });
    showToast('✅ تم حفظ إعدادات التحويل');
  }, 700);
}

function openInboxFwdInfo() {
  alert('كيف يعمل تحويل الرسائل:\n\n' +
    '• عند تفعيل هذا الخيار وإدخال بريدك، يظهر زر «↗ تحويل» في كل رسالة.\n' +
    '• عند النقر على «تحويل»، يُفتح برنامج البريد لديك مع نص الرسالة جاهزاً للإرسال إلى بريدك.\n' +
    '• هذه طريقة يدوية — للإرسال التلقائي عبر SMTP تحتاج ربطاً بخدمة مثل SendGrid أو Firebase Functions.');
}

window.loadInboxMessages    = loadInboxMessages;
window.markMessageRead      = markMessageRead;
window.deleteInboxMessage   = deleteInboxMessage;
window.forwardInboxMessage  = forwardInboxMessage;
window.loadInboxForwarding  = loadInboxForwarding;
window.saveInboxForwarding  = saveInboxForwarding;
window.openInboxFwdInfo     = openInboxFwdInfo;

function renderSubscribersTable(data) {
  const tbody = document.getElementById('sub-tbody');
  const lbl   = document.getElementById('sub-count-label');
  if (lbl) lbl.textContent = '(' + data.length + ')';
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-dim)"><div style="font-size:32px;margin-bottom:8px">📭</div>لا يوجد مشتركون حتى الآن</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(s => `
    <tr>
      <td><input type="checkbox" class="sub-check" ${_selectedSubs.has(s.email)?'checked':''} onchange="toggleSubSelect('${s.email}',this.checked)" style="cursor:pointer"></td>
      <td style="font-family:monospace;font-size:13px">${s.email}</td>
      <td>${s.date}</td>
      <td><span class="badge badge-published">${s.source}</span></td>
      <td><button class="btn-del" onclick="deleteSubscriber('${s.id}')" style="font-size:11px">🗑 حذف</button></td>
    </tr>`).join('');
}

function filterSubscribers(q) {
  const v = q.toLowerCase().trim();
  renderSubscribersTable(v ? _subscribersData.filter(s => s.email.includes(v)) : _subscribersData);
}

async function deleteSubscriber(id) {
  if (!confirm('حذف هذا المشترك نهائياً؟')) return;
  try {
    await deleteDoc(doc(_db, 'subscribers', id));
    _subscribersData = _subscribersData.filter(s => s.id !== id);
    renderSubscribersTable(_subscribersData);
    const total = document.getElementById('sub-total');
    if (total) total.textContent = _subscribersData.length + ' مشترك';
    showToast('✅ تم حذف المشترك');
  } catch(e) { showToast('⚠️ خطأ: ' + e.message); }
}

function exportSubscribers() {
  if (!_subscribersData.length) { showToast('⚠️ لا توجد بيانات للتصدير'); return; }
  const csv = 'البريد الإلكتروني,تاريخ الاشتراك,المصدر\n' +
    _subscribersData.map(s => `"${s.email}","${s.date}","${s.source}"`).join('\n');
  const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'subscribers_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('✅ تم تصدير ' + _subscribersData.length + ' مشترك');
}


// ─── FOOTER COLUMN EDITOR ─────────────────────────────────────────
const _defaultFooterCompany = [
  {id:1, label:'من نحن',           icon:'',  url:'', active:true, content:'', commentsEnabled:false},
  {id:2, label:'فريق التحرير',     icon:'',  url:'', active:true, content:'', commentsEnabled:false},
  {id:3, label:'اعلن معنا',        icon:'',  url:'', active:true, content:'', commentsEnabled:false},
  {id:4, label:'سياسة الخصوصية',  icon:'',  url:'', active:true, content:'', commentsEnabled:false},
  {id:5, label:'تواصل معنا',       icon:'',  url:'', active:true},
];
const _defaultFooterMore = [
  {id:1, label:'النشرة البريدية',  icon:'📧', url:'', active:true},
  {id:2, label:'خلاصة RSS',        icon:'📡', url:'/rss.xml', active:true},
  {id:3, label:'خريطة الموقع',     icon:'🗺️', url:'/sitemap.xml', active:true},
  {id:4, label:'شروط الاستخدام',   icon:'📋', url:'', active:true},
  {id:5, label:'سياسة الكوكيز',    icon:'🍪', url:'', active:true},
  {id:6, label:'إمكانية الوصول',   icon:'♿', url:'', active:true},
];

function _getFooterCol(col) {
  if (col === 'company') return _siteSettingsCache.footer_company || JSON.parse(JSON.stringify(_defaultFooterCompany));
  return _siteSettingsCache.footer_more || JSON.parse(JSON.stringify(_defaultFooterMore));
}

function renderFooterColEditor(col) {
  const editorId = col === 'company' ? 'footer-company-editor' : 'footer-more-editor';
  const el = document.getElementById(editorId);
  if (!el) return;
  const items = _getFooterCol(col);
  el.innerHTML = items.map((item, i) => `
    <details style="background:var(--dark-3);border-radius:10px;margin-bottom:6px;border:1px solid var(--border-dim)">
      <summary style="padding:10px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;list-style:none;user-select:none">
        <label class="toggle-switch" style="flex-shrink:0" onclick="event.stopPropagation()">
          <input type="checkbox" ${item.active!==false?'checked':''} onchange="updateFooterLink('${col}',${i},'active',this.checked)">
          <span class="toggle-slider"></span>
        </label>
        <span style="font-size:16px">${item.icon||'🔗'}</span>
        <span style="flex:1;font-size:13px;font-weight:600;color:var(--text)">${item.label||'رابط'}</span>
        <span style="font-size:11px;color:var(--text-dim)">تفاصيل ▾</span>
        <button onclick="event.stopPropagation();deleteFooterLink('${col}',${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:0 4px">×</button>
      </summary>
      <div style="padding:12px;border-top:1px solid var(--border-dim);display:flex;flex-direction:column;gap:10px">
        <div style="display:grid;grid-template-columns:60px 1fr 1fr;gap:8px">
          <div>
            <div style="font-size:10px;color:var(--text-dim);margin-bottom:3px">أيقونة</div>
            <input type="text" value="${item.icon||''}" placeholder="🔗" oninput="updateFooterLink('${col}',${i},'icon',this.value)"
              style="width:100%;background:var(--dark-4);border:1px solid var(--border-dim);border-radius:6px;padding:5px;text-align:center;font-size:16px;color:var(--text);outline:none">
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-dim);margin-bottom:3px">الاسم *</div>
            <input type="text" value="${item.label||''}" placeholder="اسم الرابط" oninput="updateFooterLink('${col}',${i},'label',this.value)"
              style="width:100%;background:var(--dark-4);border:1px solid var(--border-dim);border-radius:6px;padding:5px 8px;font-family:inherit;font-size:13px;color:var(--text);outline:none">
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-dim);margin-bottom:3px">رابط خارجي (اختياري)</div>
            <input type="text" value="${item.url||''}" placeholder="https://..." oninput="updateFooterLink('${col}',${i},'url',this.value)"
              style="width:100%;background:var(--dark-4);border:1px solid var(--border-dim);border-radius:6px;padding:5px 8px;font-family:inherit;font-size:12px;color:var(--text);outline:none">
          </div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-dim);margin-bottom:4px">المحتوى (يظهر عند فتح الرابط داخل الموقع)</div>
          <!-- Mini RTE toolbar -->
          <div style="background:var(--dark-4);border:1px solid var(--border-dim);border-bottom:none;border-radius:8px 8px 0 0;padding:6px 8px;display:flex;gap:4px;flex-wrap:wrap;align-items:center">
            <button type="button" class="rte-btn" title="عريض" onclick="footerRteCmd('${col}',${i},'bold')"><b>B</b></button>
            <button type="button" class="rte-btn" title="مائل" onclick="footerRteCmd('${col}',${i},'italic')"><i>I</i></button>
            <button type="button" class="rte-btn" title="تسطير" onclick="footerRteCmd('${col}',${i},'underline')"><u>U</u></button>
            <div style="width:1px;height:18px;background:var(--border-dim);margin:0 3px"></div>
            <select class="rte-select" title="حجم الخط" onchange="footerRteCmd('${col}',${i},'fontSize',this.value);this.value=''">
              <option value="">حجم</option>
              <option value="1">صغير جداً</option><option value="2">صغير</option>
              <option value="3">عادي</option><option value="4">كبير</option>
              <option value="5">كبير جداً</option><option value="6">ضخم</option>
            </select>
            <select class="rte-select" title="نوع الخط" onchange="footerRteCmd('${col}',${i},'fontName',this.value);this.value=''">
              <option value="">نوع الخط</option>
              <option value="Tajawal">Tajawal</option>
              <option value="Cairo">Cairo</option>
              <option value="Amiri">Amiri</option>
              <option value="Noto Kufi Arabic">Kufi</option>
              <option value="Arial">Arial</option>
              <option value="Georgia">Georgia</option>
            </select>
            <select class="rte-select" title="لون النص" onchange="footerRteCmd('${col}',${i},'foreColor',this.value);this.value=''">
              <option value="">لون</option>
              <option value="#F0EDE6">أبيض</option><option value="#C9A84C">ذهبي</option>
              <option value="#4A9EFF">أزرق</option><option value="#3DDC84">أخضر</option>
              <option value="#FF5252">أحمر</option><option value="#A078FF">بنفسجي</option>
              <option value="#FF9A3C">برتقالي</option>
            </select>
            <div style="width:1px;height:18px;background:var(--border-dim);margin:0 3px"></div>
            <button type="button" class="rte-btn" title="قائمة نقطية" onclick="footerRteCmd('${col}',${i},'insertUnorderedList')">≡</button>
            <button type="button" class="rte-btn" title="قائمة مرقمة" onclick="footerRteCmd('${col}',${i},'insertOrderedList')">1.</button>
          </div>
          <div contenteditable="true"
            id="footer-content-${col}-${i}"
            oninput="updateFooterLink('${col}',${i},'content',this.innerHTML)"
            style="width:100%;min-height:100px;background:var(--dark-4);border:1px solid var(--border-dim);border-top:none;border-radius:0 0 8px 8px;padding:10px;font-family:inherit;font-size:13px;color:var(--text);outline:none;direction:rtl;line-height:1.6">${item.content||''}</div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text-muted)">
          <input type="checkbox" ${item.commentsEnabled?'checked':''} onchange="updateFooterLink('${col}',${i},'commentsEnabled',this.checked)">
          تفعيل التعليقات على هذه الصفحة
        </label>
        <button onclick="saveFooterCol('${col}')" class="btn-primary" style="font-size:12px;align-self:flex-end">💾 حفظ</button>
      </div>
    </details>`).join('');
}

function addFooterLink(col) {
  const items = _getFooterCol(col);
  items.push({id: Date.now(), label:'رابط جديد', icon:'', url:'', active:true});
  _cacheFooterCol(col, items);
  renderFooterColEditor(col);
}
function deleteFooterLink(col, i) {
  const items = _getFooterCol(col);
  items.splice(i, 1);
  _cacheFooterCol(col, items);
  renderFooterColEditor(col);
}
function updateFooterLink(col, i, field, val) {
  const items = _getFooterCol(col);
  if (items[i]) items[i][field] = val;
  _cacheFooterCol(col, items);
  // Auto-save immediately for toggles (no need to click save button)
  if (field === 'active' || field === 'commentsEnabled') {
    const key = col === 'company' ? 'footer_company' : 'footer_more';
    _fbUpdateSite({[key]: items});
    showToast(field === 'active'
      ? (val ? '✅ تم تفعيل الرابط' : '⏸ تم إيقاف الرابط')
      : (val ? '💬 تعليقات مفعّلة' : '💬 تعليقات مغلقة'));
    return;
  }
  // Debounce auto-save for text inputs (icon/label/url/content/descStyle) so user doesn't need to click save
  if (!window._footerSaveTimer) window._footerSaveTimer = {};
  clearTimeout(window._footerSaveTimer[col]);
  window._footerSaveTimer[col] = setTimeout(() => {
    const key = col === 'company' ? 'footer_company' : 'footer_more';
    _fbUpdateSite({[key]: items});
  }, 800);
}
function _cacheFooterCol(col, items) {
  if (!_siteSettingsCache) _siteSettingsCache = {};
  _siteSettingsCache[col === 'company' ? 'footer_company' : 'footer_more'] = items;
}
function footerRteCmd(col, i, cmd, val) {
  const editor = document.getElementById('footer-content-' + col + '-' + i);
  if (!editor) return;
  editor.focus();
  try { document.execCommand(cmd, false, val || null); } catch(_) {}
  // Persist the new content
  updateFooterLink(col, i, 'content', editor.innerHTML);
}
function saveFooterCol(col) {
  const items = _getFooterCol(col);
  const key   = col === 'company' ? 'footer_company' : 'footer_more';
  _fbUpdateSite({[key]: items});
  showToast('✅ تم حفظ الروابط');
}

// Load footer editors when page opens
const _origShowPage = window.showPage || function(){};
// Patched in showPage below

// ─── ADS MANAGER ──────────────────────────────────────────────────
const ADS_CONFIG = [
  {slot:'top',     label:'📢 بانر أعلى الأخبار الرئيسية',  desc:'يظهر بين شريط الأخبار والهيرو'},
  {slot:'bottom',  label:'📢 بانر أسفل الأخبار الرئيسية',  desc:'يظهر أسفل قسم الهيرو'},
  {slot:'article', label:'📰 بانر داخل الخبر',              desc:'يظهر بين محتوى الخبر والأخبار المقترحة'},
  {slot:'grid',    label:'📋 بانر داخل قائمة الأخبار',      desc:'يظهر بعد كل 6 بطاقات في القائمة الرئيسية'},
  {slot:'allnews', label:'🗞️ بانر في صفحة كل الأخبار',     desc:'يظهر في أعلى صفحة جميع الأخبار'},
];

function renderAdsManager() {
  const container = document.getElementById('ads-manager-list');
  if (!container) return;
  container.innerHTML = ADS_CONFIG.map(cfg => {
    const slot = cfg.slot;
    const d = _siteSettingsCache && _siteSettingsCache['ad_'+slot] || {};
    return `
    <div class="card">
      <div class="card-head">
        <div>
          <div class="card-head-title">${cfg.label}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${cfg.desc}</div>
        </div>
        <label class="toggle-switch"><input type="checkbox" id="ad-${slot}-active" ${d.active?'checked':''} onchange="saveAdBanner('${slot}')"><span class="toggle-slider"></span></label>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:10px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group" style="margin:0">
            <label class="form-label" style="font-size:11px">العرض (px أو %)</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input class="form-input" id="ad-${slot}-width" value="${d.width||'100%'}" placeholder="100%" oninput="saveAdBanner('${slot}')" style="font-size:12px">
              <button onclick="document.getElementById('ad-${slot}-width').value='100%';saveAdBanner('${slot}')" title="القيمة الافتراضية" style="background:none;border:1px solid var(--border-dim);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:10px;color:var(--text-dim);white-space:nowrap">افتراضي</button>
            </div>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label" style="font-size:11px">الارتفاع (px أو auto)</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input class="form-input" id="ad-${slot}-height" value="${d.height||'auto'}" placeholder="auto" oninput="saveAdBanner('${slot}')" style="font-size:12px">
              <button onclick="document.getElementById('ad-${slot}-height').value='auto';saveAdBanner('${slot}')" title="القيمة الافتراضية" style="background:none;border:1px solid var(--border-dim);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:10px;color:var(--text-dim);white-space:nowrap">افتراضي</button>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group" style="margin:0">
            <label class="form-label" style="font-size:11px">المسافة من الأعلى (px)</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input class="form-input" id="ad-${slot}-mtop" type="number" min="0" value="${d.marginTop!==undefined?d.marginTop:''}" placeholder="0" oninput="saveAdBanner('${slot}')" style="font-size:12px">
              <button onclick="document.getElementById('ad-${slot}-mtop').value='';saveAdBanner('${slot}')" title="القيمة الافتراضية" style="background:none;border:1px solid var(--border-dim);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:10px;color:var(--text-dim);white-space:nowrap">افتراضي</button>
            </div>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label" style="font-size:11px">المسافة من الأسفل (px)</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input class="form-input" id="ad-${slot}-mbot" type="number" min="0" value="${d.marginBottom!==undefined?d.marginBottom:''}" placeholder="0" oninput="saveAdBanner('${slot}')" style="font-size:12px">
              <button onclick="document.getElementById('ad-${slot}-mbot').value='';saveAdBanner('${slot}')" title="القيمة الافتراضية" style="background:none;border:1px solid var(--border-dim);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:10px;color:var(--text-dim);white-space:nowrap">افتراضي</button>
            </div>
          </div>
        </div>
        <div class="form-group" style="margin:0"><label class="form-label" style="font-size:11px">نص الإعلان</label><textarea class="form-textarea" id="ad-${slot}-text" style="min-height:50px" placeholder="نص البانر..." oninput="saveAdBanner('${slot}')">${d.text||''}</textarea></div>
        <div class="form-group" style="margin:0"><label class="form-label" style="font-size:11px">رابط صورة / GIF</label><input class="form-input" id="ad-${slot}-image" value="${d.imageUrl||''}" placeholder="https://..." oninput="saveAdBanner('${slot}')" style="font-size:12px"></div>
        <div class="form-group" style="margin:0"><label class="form-label" style="font-size:11px">رابط فيديو (mp4)</label><input class="form-input" id="ad-${slot}-video" value="${d.videoUrl||''}" placeholder="https://...mp4" oninput="saveAdBanner('${slot}')" style="font-size:12px"></div>
        <div class="form-group" style="margin:0"><label class="form-label" style="font-size:11px">رابط الإعلان</label><input class="form-input" id="ad-${slot}-link" value="${d.linkUrl||''}" placeholder="https://..." oninput="saveAdBanner('${slot}')" style="font-size:12px"></div>
        <div class="form-group" style="margin:0"><label class="form-label" style="font-size:11px">HTML مخصص</label><textarea class="form-textarea" id="ad-${slot}-html" style="min-height:50px;font-size:11px;font-family:monospace" placeholder="<div>...</div>" oninput="saveAdBanner('${slot}')">${d.html||''}</textarea></div>
        <div style="background:var(--dark-3);border-radius:8px;min-height:44px;padding:8px;display:flex;align-items:center;justify-content:center" id="ad-${slot}-preview">
          <span style="font-size:11px;color:var(--text-dim)">معاينة البانر</span>
        </div>
      </div>
    </div>`;
  }).join('');
  // Load preview for each
  ADS_CONFIG.forEach(cfg => { try { saveAdBanner(cfg.slot); } catch(_) {} });
}

// ─── EDITOR ACCESS CONTROL ────────────────────────────────────────
function saveEditor_OLD_REPLACED() { // replaced by new version above
  const name_x = 'x';
  const pass = document.getElementById('e-pass')?.value;
  const obj  = {
    name, user,
    email:      document.getElementById('e-email').value,
    role:       document.getElementById('e-role').value,
    dept:       document.getElementById('e-dept').value,
    canAddNews: document.getElementById('e-can-add-news')?.checked !== false,
    active:     document.getElementById('e-active')?.checked !== false,
    color:      '#' + Math.floor(Math.random()*0xFFFFFF).toString(16).padStart(6,'0'),
    articles:   0,
  };
  if (pass) obj.pass = pass;
  if (eid) {
    const idx = editorsData.findIndex(e => e.id == eid);
    if (idx !== -1) {
      obj.id = editorsData[idx].id;
      obj.articles = editorsData[idx].articles || 0;
      obj.color    = editorsData[idx].color;
      if (!pass) obj.pass = editorsData[idx].pass; // keep existing password
      editorsData[idx] = obj;
    }
    showToast('✅ تم تحديث بيانات المحرر');
  } else {
    obj.id = Date.now();
    editorsData.push(obj);
    showToast('✅ تم إضافة المحرر');
    // Save password for login
    if (pass) {
      const passwords = _getPasswords();
      passwords[user] = pass;
      localStorage.setItem('atq_user_passwords', JSON.stringify(passwords));
    }
  }
  renderEditors(); refreshAuthorSelect(); saveAll();
  closeModal('editor-modal');
}


function saveCommentsControl(enabled) {
  _fbUpdateSite({ comments_enabled: enabled });
  showToast(enabled ? '💬 تعليقات مفعّلة للموقع' : '💬 تعليقات موقوفة للموقع');
}
function loadCommentsControl() {
  const el = document.getElementById('ctrl-comments-global');
  if (el) el.checked = !(_siteSettingsCache && _siteSettingsCache.comments_enabled === false);
}
window.loadCommentsControl = loadCommentsControl;

// ─── ARTICLE INTERACTIONS (like/share/facebook/...) ────────────────
const _INTERACTION_KEYS = ['share','facebook','twitter','whatsapp','copy','print','bookmark','like','related'];
const _INTERACTION_DEFAULTS = {
  share:    { label: '🔗 مشاركة',    desc: 'زر مشاركة عام (قائمة النظام)' },
  facebook: { label: '📘 Facebook',  desc: 'مشاركة على فيسبوك' },
  twitter:  { label: '𝕏 X',         desc: 'مشاركة على X (تويتر)' },
  whatsapp: { label: '💬 WhatsApp',  desc: 'مشاركة على واتساب' },
  copy:     { label: '📎 نسخ الرابط', desc: 'نسخ رابط الخبر' },
  print:    { label: '🖨️ طباعة',     desc: 'طباعة المقال' },
  bookmark: { label: '🔖 حفظ',       desc: 'حفظ للقراءة لاحقاً' },
  like:     { label: '👍 إعجاب',     desc: 'زر الإعجاب مع العداد' },
  related:  { label: '📰 أخبار ذات صلة', desc: 'قسم الأخبار المقترحة أسفل المقال' },
};

function _renderInteractionsEditor() {
  const host = document.getElementById('interactions-editor');
  if (!host) return;
  const s      = (_siteSettingsCache && _siteSettingsCache.interactions) || {};
  const labels = (_siteSettingsCache && _siteSettingsCache.interaction_labels) || {};
  // The `related` key is a section toggle with its own count, rendered below, not here
  const buttonKeys = _INTERACTION_KEYS.filter(k => k !== 'related');
  host.innerHTML = buttonKeys.map(k => {
    const def = _INTERACTION_DEFAULTS[k];
    const active = (s[k] !== false);
    const customLabel = (labels[k] != null ? labels[k] : def.label);
    return `
    <div style="display:grid;grid-template-columns:auto 1fr 1.5fr;gap:10px;align-items:center;background:var(--dark-3);padding:10px 14px;border-radius:8px;border:1px solid var(--border-dim)">
      <label class="toggle-switch" style="position:relative;display:inline-block;width:44px;height:22px;flex-shrink:0;cursor:pointer">
        <input type="checkbox" ${active?'checked':''} onchange="updateInteractionToggle('${k}', this.checked)" style="opacity:0;width:0;height:0">
        <span style="position:absolute;cursor:pointer;inset:0;background:${active?'var(--green)':'var(--dark-4)'};border-radius:22px;transition:.3s">
          <span style="position:absolute;height:16px;width:16px;right:${active?'22px':'3px'};bottom:3px;background:white;border-radius:50%;transition:.3s"></span>
        </span>
      </label>
      <div style="font-size:12px;color:var(--text-dim)">${def.desc}</div>
      <input class="form-input" style="font-size:13px;padding:6px 10px" placeholder="${def.label}" value="${(customLabel||'').replace(/"/g,'&quot;')}" oninput="updateInteractionLabel('${k}', this.value)">
    </div>`;
  }).join('');
}

function updateInteractionToggle(key, enabled) {
  if (!_siteSettingsCache) _siteSettingsCache = {};
  if (!_siteSettingsCache.interactions) _siteSettingsCache.interactions = {};
  _siteSettingsCache.interactions[key] = !!enabled;
  _fbUpdateSite({ interactions: _siteSettingsCache.interactions });
  _renderInteractionsEditor(); // refresh to update switch color
  clearTimeout(window._intTogToast);
  window._intTogToast = setTimeout(() => showToast('✅ تم الحفظ'), 400);
}

function updateInteractionLabel(key, val) {
  if (!_siteSettingsCache) _siteSettingsCache = {};
  if (!_siteSettingsCache.interaction_labels) _siteSettingsCache.interaction_labels = {};
  _siteSettingsCache.interaction_labels[key] = val;
  clearTimeout(window._intLabelTimer);
  window._intLabelTimer = setTimeout(() => {
    _fbUpdateSite({ interaction_labels: _siteSettingsCache.interaction_labels });
    showToast('✅ تم الحفظ');
  }, 700);
}

function saveInteractionToggles() {
  // Also called when the related-count input or related-toggle checkbox changes.
  if (!_siteSettingsCache) _siteSettingsCache = {};
  if (!_siteSettingsCache.interactions) _siteSettingsCache.interactions = {};
  const relEl = document.getElementById('ctrl-int-related');
  if (relEl) _siteSettingsCache.interactions.related = !!relEl.checked;
  const countEl = document.getElementById('ctrl-related-count');
  const countV  = Number(countEl?.value) || 8;
  _fbUpdateSite({
    interactions: _siteSettingsCache.interactions,
    related_count: Math.max(1, Math.min(20, countV)),
  });
  clearTimeout(window._intTogToast);
  window._intTogToast = setTimeout(() => showToast('✅ تم الحفظ'), 500);
}

function loadInteractionToggles() {
  _renderInteractionsEditor();
  const s = (_siteSettingsCache && _siteSettingsCache.interactions) || {};
  const relEl = document.getElementById('ctrl-int-related');
  if (relEl) relEl.checked = (s.related !== false);
  const countEl = document.getElementById('ctrl-related-count');
  if (countEl) countEl.value = (_siteSettingsCache && _siteSettingsCache.related_count) || 8;
}

function restoreInteractionDefaults() {
  if (!confirm('هل تريد إعادة ضبط كل أزرار التفاعل إلى القيم الافتراضية؟')) return;
  if (!_siteSettingsCache) _siteSettingsCache = {};
  _siteSettingsCache.interactions       = {};
  _siteSettingsCache.interaction_labels = {};
  _siteSettingsCache.related_count      = 8;
  _fbUpdateSite({
    interactions:       {},
    interaction_labels: {},
    related_count:      8,
  });
  loadInteractionToggles();
  showToast('↺ تم إعادة الضبط');
}

window.saveInteractionToggles     = saveInteractionToggles;
window.loadInteractionToggles     = loadInteractionToggles;
window.updateInteractionToggle    = updateInteractionToggle;
window.updateInteractionLabel     = updateInteractionLabel;
window.restoreInteractionDefaults = restoreInteractionDefaults;

function saveAdBanner(slot) {
  const active   = document.getElementById('ad-' + slot + '-active')?.checked || false;
  const text     = document.getElementById('ad-' + slot + '-text')?.value || '';
  const imageUrl = document.getElementById('ad-' + slot + '-image')?.value || '';
  const videoUrl = document.getElementById('ad-' + slot + '-video')?.value || '';
  const html     = document.getElementById('ad-' + slot + '-html')?.value || '';
  const linkUrl  = document.getElementById('ad-' + slot + '-link')?.value || '';
  const width    = document.getElementById('ad-' + slot + '-width')?.value  || '100%';
  const height   = document.getElementById('ad-' + slot + '-height')?.value || 'auto';
  const mTopRaw  = document.getElementById('ad-' + slot + '-mtop')?.value;
  const mBotRaw  = document.getElementById('ad-' + slot + '-mbot')?.value;
  const marginTop    = (mTopRaw === '' || mTopRaw == null) ? null : Number(mTopRaw);
  const marginBottom = (mBotRaw === '' || mBotRaw == null) ? null : Number(mBotRaw);

  const data = { active, text, imageUrl, videoUrl, html, linkUrl, width, height, marginTop, marginBottom };
  const key  = 'ad_' + slot;
  if (!_siteSettingsCache) _siteSettingsCache = {};
  _siteSettingsCache[key] = data;
  _fbUpdateSite({ [key]: data });

  // Live preview
  const prev = document.getElementById('ad-' + slot + '-preview');
  if (prev) {
    if (!active) { prev.innerHTML = '<span style="color:var(--text-dim);font-size:12px">البانر مخفي</span>'; return; }
    if (videoUrl) prev.innerHTML = `<video src="${videoUrl}" muted autoplay loop style="max-height:80px;border-radius:6px"></video>`;
    else if (imageUrl) prev.innerHTML = `<img src="${imageUrl}" style="max-height:80px;border-radius:6px;max-width:100%">`;
    else if (html) prev.innerHTML = html;
    else if (text) prev.innerHTML = `<span style="font-size:13px;color:var(--text)">${text}</span>`;
    else prev.innerHTML = '<span style="color:var(--text-dim);font-size:12px">معاينة البانر</span>';
  }
  // Debounce toast to avoid spam while typing
  if (!window._adBannerToastTimer) window._adBannerToastTimer = {};
  clearTimeout(window._adBannerToastTimer[slot]);
  window._adBannerToastTimer[slot] = setTimeout(() => showToast('✅ تم حفظ البانر'), 900);
}

function loadAdBanners() {
  if (!_siteSettingsCache) return;
  ['top','bottom','article','grid','allnews'].forEach(slot => {
    const d = _siteSettingsCache['ad_' + slot];
    if (!d) return;
    const activeEl = document.getElementById('ad-' + slot + '-active');
    const textEl   = document.getElementById('ad-' + slot + '-text');
    const imgEl    = document.getElementById('ad-' + slot + '-image');
    const vidEl    = document.getElementById('ad-' + slot + '-video');
    const htmlEl   = document.getElementById('ad-' + slot + '-html');
    const linkEl   = document.getElementById('ad-' + slot + '-link');
    const wEl      = document.getElementById('ad-' + slot + '-width');
    const hEl      = document.getElementById('ad-' + slot + '-height');
    const mtEl     = document.getElementById('ad-' + slot + '-mtop');
    const mbEl     = document.getElementById('ad-' + slot + '-mbot');
    if (activeEl) activeEl.checked = d.active || false;
    if (textEl)   textEl.value   = d.text     || '';
    if (imgEl)    imgEl.value    = d.imageUrl  || '';
    if (vidEl)    vidEl.value    = d.videoUrl  || '';
    if (htmlEl)   htmlEl.value   = d.html      || '';
    if (linkEl)   linkEl.value   = d.linkUrl   || '';
    if (wEl)      wEl.value      = d.width     || '100%';
    if (hEl)      hEl.value      = d.height    || 'auto';
    if (mtEl)     mtEl.value     = (d.marginTop    != null ? d.marginTop    : '');
    if (mbEl)     mbEl.value     = (d.marginBottom != null ? d.marginBottom : '');
    saveAdBanner(slot); // refresh preview
  });
  // Comments
  const commEl = document.getElementById('ctrl-comments-global');
  if (commEl) commEl.checked = _siteSettingsCache.comments_enabled !== false;
  // Also render custom banners list
  renderCustomBanners();
}

// ─── CUSTOM AD BANNERS ────────────────────────────────────────────
// Users can add extra banners at any location. Data model:
//   { id, slot: 'top'|'bottom'|'grid'|'article'|'allnews'|'after-hero'|'after-featured'|'footer-top',
//     stackMode: 'below'|'beside', active, text, imageUrl, videoUrl, html, linkUrl,
//     width, height, marginTop, marginBottom }
const _CUSTOM_BANNER_LOCATIONS = [
  { value:'top',            label:'أعلى الصفحة (فوق الخبر الرئيسي)' },
  { value:'after-hero',     label:'بعد الخبر الرئيسي' },
  { value:'after-featured', label:'بعد أبرز المقالات' },
  { value:'grid',           label:'داخل شبكة الأخبار' },
  { value:'bottom',         label:'أسفل الأخبار (قبل التذييل)' },
  { value:'article',        label:'داخل صفحة الخبر' },
  { value:'allnews',        label:'في صفحة كل الأخبار' },
  { value:'footer-top',     label:'فوق التذييل مباشرة' },
];

function _getCustomBanners() {
  if (!_siteSettingsCache) _siteSettingsCache = {};
  return _siteSettingsCache.custom_banners || [];
}

function _saveCustomBanners(list) {
  if (!_siteSettingsCache) _siteSettingsCache = {};
  _siteSettingsCache.custom_banners = list;
  _fbUpdateSite({ custom_banners: list });
}

function renderCustomBanners() {
  const cont = document.getElementById('custom-banners-list');
  if (!cont) return;
  const list = _getCustomBanners();
  if (!list.length) {
    cont.innerHTML = '<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:24px">لا توجد بانرات مخصصة بعد. اضغط «إضافة بانر» لإنشاء واحد.</div>';
    return;
  }
  cont.innerHTML = list.map((b, i) => {
    const locOptions = _CUSTOM_BANNER_LOCATIONS.map(o =>
      `<option value="${o.value}" ${b.slot===o.value?'selected':''}>${o.label}</option>`
    ).join('');
    return `
    <div class="card" style="border:1px solid var(--border-dim);margin:0">
      <div style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-dim);gap:12px">
        <div style="display:flex;align-items:center;gap:10px;flex:1">
          <label class="switch" style="position:relative;display:inline-block;width:44px;height:22px;flex-shrink:0">
            <input type="checkbox" ${b.active?'checked':''} onchange="updateCustomBanner(${i},'active',this.checked)" style="opacity:0;width:0;height:0">
            <span style="position:absolute;cursor:pointer;inset:0;background:${b.active?'var(--green)':'var(--dark-4)'};border-radius:22px;transition:.3s">
              <span style="position:absolute;content:'';height:16px;width:16px;right:${b.active?'22px':'3px'};bottom:3px;background:white;border-radius:50%;transition:.3s"></span>
            </span>
          </label>
          <div style="font-size:13px;font-weight:600;color:var(--text)">بانر مخصص #${i+1}</div>
          <div style="font-size:11px;color:var(--text-dim)">${_CUSTOM_BANNER_LOCATIONS.find(o=>o.value===b.slot)?.label || ''}</div>
        </div>
        <button onclick="deleteCustomBanner(${i})" title="حذف" style="background:none;border:1px solid rgba(255,82,82,.3);color:var(--red);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px">🗑 حذف</button>
      </div>
      <div style="padding:14px 16px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group" style="margin:0">
          <label class="form-label">الموقع في الصفحة</label>
          <select class="form-select" onchange="updateCustomBanner(${i},'slot',this.value)">${locOptions}</select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">عند وجود بانر في نفس الموقع</label>
          <select class="form-select" onchange="updateCustomBanner(${i},'stackMode',this.value)">
            <option value="below" ${b.stackMode==='below'?'selected':''}>تحت البانر الموجود</option>
            <option value="beside" ${b.stackMode==='beside'?'selected':''}>بجانب البانر الموجود</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;grid-column:1/-1">
          <label class="form-label">رابط صورة البانر (URL)</label>
          <input class="form-input" value="${(b.imageUrl||'').replace(/"/g,'&quot;')}" oninput="updateCustomBanner(${i},'imageUrl',this.value)" placeholder="https://example.com/banner.jpg">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">رابط الفيديو (MP4 اختياري)</label>
          <input class="form-input" value="${(b.videoUrl||'').replace(/"/g,'&quot;')}" oninput="updateCustomBanner(${i},'videoUrl',this.value)" placeholder="https://example.com/ad.mp4">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">الرابط عند النقر</label>
          <input class="form-input" value="${(b.linkUrl||'').replace(/"/g,'&quot;')}" oninput="updateCustomBanner(${i},'linkUrl',this.value)" placeholder="https://advertiser.com">
        </div>
        <div class="form-group" style="margin:0;grid-column:1/-1">
          <label class="form-label">نص بديل / HTML مخصص (عند عدم وجود صورة)</label>
          <input class="form-input" value="${(b.text||'').replace(/"/g,'&quot;')}" oninput="updateCustomBanner(${i},'text',this.value)" placeholder="إعلانك هنا...">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">العرض (px أو %)</label>
          <input class="form-input" value="${b.width||'100%'}" oninput="updateCustomBanner(${i},'width',this.value)" placeholder="100%">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">الارتفاع (px)</label>
          <input class="form-input" type="number" value="${b.height||''}" oninput="updateCustomBanner(${i},'height',this.value)" placeholder="تلقائي">
        </div>
      </div>
    </div>`;
  }).join('');
}

function addCustomBanner() {
  const list = _getCustomBanners();
  list.push({
    id: Date.now(),
    slot: 'top',
    stackMode: 'below',
    active: true,
    text: '',
    imageUrl: '',
    videoUrl: '',
    linkUrl: '',
    width: '100%',
    height: '',
  });
  _saveCustomBanners(list);
  renderCustomBanners();
  showToast('✅ تم إضافة بانر جديد — عدّل التفاصيل أدناه');
}

function updateCustomBanner(idx, field, val) {
  const list = _getCustomBanners();
  if (!list[idx]) return;
  list[idx][field] = val;
  _saveCustomBanners(list);
  // Debounced toast for text/URL fields; immediate for toggles/selects
  if (field === 'active' || field === 'slot' || field === 'stackMode') {
    renderCustomBanners(); // re-render so the color swatch / location label updates
    showToast('✅ تم الحفظ');
  } else {
    clearTimeout(window._customBanTimer);
    window._customBanTimer = setTimeout(() => showToast('✅ تم الحفظ'), 800);
  }
}

function deleteCustomBanner(idx) {
  if (!confirm('هل تريد حذف هذا البانر؟')) return;
  const list = _getCustomBanners();
  list.splice(idx, 1);
  _saveCustomBanners(list);
  renderCustomBanners();
  showToast('🗑 تم الحذف');
}


// ─── ADMIN LIGHT THEME ────────────────────────────────────────
function toggleAdminTheme() {
  document.body.classList.toggle('light');
  const isLight = document.body.classList.contains('light');
  const btn = document.getElementById('admin-theme-btn');
  if (btn) btn.textContent = isLight ? '🌙 داكن' : '🌙 فاتح';
  localStorage.setItem('atq_admin_theme', isLight?'light':'dark');
}

// ─── MODALS ───────────────────────────────────────────────────
function openModal(id)  { const el=document.getElementById(id); if(el) el.classList.add('open'); }
function closeModal(id) { const el=document.getElementById(id); if(el) el.classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target===m) m.classList.remove('open'); });
});

// ─── TOAST ────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── CHART ────────────────────────────────────────────────────
function buildChart() {
  const days = ['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
  const vals = [42000,58000,51000,73000,67000,86000,61000];
  const max  = Math.max(...vals);
  const area = document.getElementById('chart-area');
  if (!area) return;
  area.innerHTML = days.map((d,i) => {
    const h = Math.round((vals[i]/max)*120);
    return `<div class="bar-wrap">
      <div class="bar" style="height:${h}px;background:${i===5?'var(--gold)':'rgba(201,168,76,0.25)'}"></div>
      <span class="bar-lbl">${d}</span>
    </div>`;
  }).join('');
}

// ─── PASSWORD STRENGTH ────────────────────────────────────────
function checkPw(v) {
  const bar = document.getElementById('pw-bar'); if(!bar) return;
  const s = v.length>10&&/[A-Z]/.test(v)&&/[0-9]/.test(v)?3:v.length>6?2:v.length>0?1:0;
  bar.style.background = ['transparent','#FF5252','#FF9A3C','#3DDC84'][s];
  bar.style.width      = ['0%','33%','66%','100%'][s];
  bar.style.height     = v.length > 0 ? '4px' : '0';
  bar.style.borderRadius = '2px';
  bar.style.marginTop  = '6px';
  bar.style.transition = 'all 0.3s';
}

// ─── CHANGE ADMIN PASSWORD ────────────────────────────────────
function changeAdminPassword() {
  const errEl  = document.getElementById('pw-change-error');
  const okEl   = document.getElementById('pw-change-success');
  const hide   = el => { if(el) el.style.display='none'; };
  const show   = (el, msg) => { if(el){ el.textContent=msg; el.style.display='block'; } };

  hide(errEl); hide(okEl);

  const current = document.getElementById('pw-current')?.value || '';
  const newPw   = document.getElementById('pw-new')?.value || '';
  const confirm = document.getElementById('pw-confirm')?.value || '';

  // Load current stored passwords (may have been updated before)
  const stored = JSON.parse(localStorage.getItem('atq_user_passwords') || 'null') || USERS;

  // Determine which user is logged in
  const loginUser = document.getElementById('sidebar-name')?.textContent === 'المدير العام' ? 'admin' : 'editor';

  if (!current) { show(errEl, '⚠️ أدخل كلمة المرور الحالية'); return; }
  if (stored[loginUser] !== current) { show(errEl, '❌ كلمة المرور الحالية غير صحيحة'); return; }
  if (newPw.length < 6) { show(errEl, '⚠️ كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل'); return; }
  if (newPw !== confirm) { show(errEl, '❌ كلمة المرور الجديدة غير متطابقة'); return; }

  // Update stored passwords
  const updated = {...stored, [loginUser]: newPw};
  localStorage.setItem('atq_user_passwords', JSON.stringify(updated));

  // Clear fields
  ['pw-current','pw-new','pw-confirm'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  const bar = document.getElementById('pw-bar');
  if (bar) { bar.style.width='0'; bar.style.height='0'; }

  show(okEl, '✅ تم تحديث كلمة المرور بنجاح! استخدمها في تسجيل الدخول القادم.');
  showToast('✅ تم تحديث كلمة المرور');
}

// ─── RICH TEXT EDITOR ─────────────────────────────────────────
function rteCmd(cmd, val) {
  document.getElementById('rte-editor').focus();
  document.execCommand(cmd, false, val||null);
}
function rteGetContent() { return document.getElementById('rte-editor')?.innerHTML || ''; }
function rteSetContent(v) { const el=document.getElementById('rte-editor'); if(el) el.innerHTML=v; }

// ─── Excerpt (ملخص الخبر) mini RTE ─────────────────────────────
function excerptRteCmd(cmd, val) {
  const ed = document.getElementById('n-excerpt-editor');
  if (ed) ed.focus();
  document.execCommand(cmd, false, val || null);
}
function excerptGetContent() { return document.getElementById('n-excerpt-editor')?.innerHTML || ''; }
function excerptSetContent(v) {
  const ed = document.getElementById('n-excerpt-editor');
  if (ed) ed.innerHTML = v || '';
}
window.excerptRteCmd = excerptRteCmd;
function rteInsertLink() {
  const url=prompt('أدخل رابط URL:'); if(url) rteCmd('createLink',url);
}
function rteInsertImage() { document.getElementById('rte-img-input')?.click(); }
function rteHandleImage(input) {
  const file=input.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=e=>{ document.getElementById('rte-editor').focus(); document.execCommand('insertImage',false,e.target.result); };
  r.readAsDataURL(file); input.value='';
}
function rteInsertVideo() {
  const url=prompt('رابط يوتيوب:'); if(!url) return;
  const m=url.match(/(?:v=|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if(!m){showToast('⚠️ رابط غير صحيح');return;}
  document.getElementById('rte-editor').focus();
  document.execCommand('insertHTML',false,
    `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:10px;margin:12px 0">
      <iframe src="https://www.youtube.com/embed/${m[1]}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;border-radius:10px" allowfullscreen></iframe>
    </div>`);
}

function rteInsertChart() {
  const types = {1:'أعمدة',2:'دائري',3:'خطي'};
  const t = prompt('نوع الرسم البياني:\n1. أعمدة\n2. دائري\n3. خطي\nأدخل رقماً:');
  if (!t || !types[t]) return;
  const id = 'chart_' + Date.now();
  // Simple SVG bar chart placeholder
  const chartHtml = `<div style="background:var(--dark-4);border:1px solid var(--border-dim);border-radius:10px;padding:20px;margin:12px 0;text-align:center;min-height:120px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px">
    <div style="font-size:28px">📊</div>
    <div style="font-size:13px;color:var(--text-muted)">رسم بياني من نوع: ${types[t]}</div>
    <div style="font-size:11px;color:var(--text-dim)">[سيظهر الرسم البياني هنا عند النشر]</div>
  </div>`;
  document.getElementById('rte-editor').focus();
  document.execCommand('insertHTML', false, chartHtml);
}

function rteInsertDivider() {
  document.getElementById('rte-editor').focus();
  document.execCommand('insertHTML',false,'<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:16px 0">');
}
// ─── AI NEWS GENERATION ───────────────────────────────────────
let aiNewsData = [];

function toggleAIContent(id) {
  var el  = document.getElementById('ai-full-' + id);
  var btn = document.getElementById('ai-expand-' + id);
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    if (btn) btn.textContent = '📖 إخفاء المحتوى';
  } else {
    el.style.display = 'none';
    if (btn) btn.textContent = '📖 عرض المحتوى الكامل';
  }
}

function loadAINews() {
  try { aiNewsData = JSON.parse(localStorage.getItem('atq_ai_news')) || []; } catch(e) { aiNewsData = []; }
}
function saveAINews() { localStorage.setItem('atq_ai_news', JSON.stringify(aiNewsData)); }

function renderAINews() {
  loadAINews();
  const list   = document.getElementById('ai-news-list');
  const empty  = document.getElementById('ai-empty-state');
  const pCount = document.getElementById('ai-pending-count');
  const aCount = document.getElementById('ai-approved-count');
  const rCount = document.getElementById('ai-rejected-count');
  const badge  = document.getElementById('ai-pending-badge');

  const pending  = aiNewsData.filter(n=>n.aiStatus==='pending');
  const approved = aiNewsData.filter(n=>n.aiStatus==='approved');
  const rejected = aiNewsData.filter(n=>n.aiStatus==='rejected');

  if(pCount)  pCount.textContent  = pending.length;
  if(aCount)  aCount.textContent  = approved.length;
  if(rCount)  rCount.textContent  = rejected.length;
  if(badge)   badge.style.display = pending.length > 0 ? 'inline' : 'none';

  const showItems = aiNewsData.filter(n=>n.aiStatus!=='rejected' || n._showRejected);
  if (!showItems.length) { if(list) list.innerHTML=''; if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display='none';
  if(!list) return;

  list.innerHTML = aiNewsData.map(n => {
    const cls      = n.aiStatus==='approved'?'approved':n.aiStatus==='rejected'?'rejected':'';
    const badgeCls = 'ai-badge-' + n.aiStatus;
    const badgeTxt = n.aiStatus==='pending'?'⏳ بانتظار الموافقة':n.aiStatus==='approved'?'✅ تمت الموافقة':'🗑 مرفوض';
    const hasContent = n.content && n.content.trim().length > 20;
    return '<div class="ai-card ' + cls + '" id="aicard-' + n.id + '">' +
      '<div class="ai-card-head">' +
        '<span class="ai-badge ' + badgeCls + '">' + badgeTxt + '</span>' +
        '<div style="flex:1">' +
          '<div class="ai-card-title">' + n.title + '</div>' +
          '<div class="ai-card-meta">' +
            '<span>📁 ' + n.cat + '</span>' +
            '<span>📅 ' + n.date + '</span>' +
            '<span>✍️ ' + (n.author||'فريق التحرير') + '</span>' +
            '<span style="opacity:0.4;font-size:10px">🤖 AI</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ai-card-body">' + (n.excerpt||'') + '</div>' +
      (hasContent ? (
        '<div class="ai-card-full-content" id="ai-full-' + n.id + '" style="display:none;padding:0 20px 16px;border-top:1px solid var(--border-dim);margin-top:8px">' +
          '<div style="font-size:13px;line-height:1.9;color:var(--text-muted)">' + n.content + '</div>' +
        '</div>' +
        '<div style="padding:0 20px 10px">' +
          '<button onclick="toggleAIContent(' + n.id + ')" id="ai-expand-' + n.id + '" class="btn-secondary" style="font-size:12px;padding:5px 14px">📖 عرض المحتوى الكامل</button>' +
        '</div>'
      ) : '') +
      '<div class="ai-card-foot">' +
        (n.aiStatus==='pending' ?
          '<button class="btn-approve" onclick="approveAI(' + n.id + ')">✅ موافقة ونشر</button>' +
          '<button class="btn-approve" style="background:rgba(74,158,255,0.1);color:#6BB5FF;border-color:rgba(74,158,255,0.25)" onclick="editAIandApprove(' + n.id + ')">✏️ تعديل ونشر</button>' +
          '<button class="btn-reject" onclick="rejectAI(' + n.id + ')">🗑 رفض</button>'
        : n.aiStatus==='approved' ?
          '<span style="font-size:12px;color:var(--green)">✅ تم نشره في الأخبار</span>' +
          '<button class="btn-secondary" style="font-size:12px;padding:5px 12px" onclick="undoApproveAI(' + n.id + ')">↩ إلغاء النشر</button>' +
          ('<button class="btn-view" style="font-size:12px;padding:5px 12px;background:rgba(74,158,255,0.1);color:#6BB5FF;border-color:rgba(74,158,255,0.25)" onclick="' + (String(n.id) === localStorage.getItem('atq_wide_pinned') ? 'unpinWide()' : 'pinToWide(' + n.id + ')') + '">' + (String(n.id) === localStorage.getItem('atq_wide_pinned') ? '📌 مثبت في البانر' : '📌 تثبيت في البانر') + '</button>')
        :
          '<span style="font-size:12px;color:var(--text-dim)">تم رفض هذا الخبر</span>' +
          '<button class="btn-secondary" style="font-size:12px;padding:5px 12px;margin-right:auto" onclick="restoreAI(' + n.id + ')">↩ استعادة</button>'
        ) +
      '</div>' +
    '</div>';
  }).join('');
}

const AI_TOPICS = [
  {cat:'الذكاء الاصطناعي',    topics:['نموذج لغوي جديد','تطبيق رؤية حاسوبية','اختراق في معالجة اللغة','روبوت ذكي جديد','نظام توصية متقدم']},
  {cat:'الهواتف والأجهزة',    topics:['هاتف ذكي جديد','ساعة ذكية متطورة','سماعات لاسلكية','شاشة قابلة للطي','بطارية ثورية']},
  {cat:'الفضاء والعلوم',      topics:['مهمة فضائية','اكتشاف كوكب جديد','صاروخ قابل للإعادة','مركبة مريخية','تلسكوب متطور']},
  {cat:'الأمن الرقمي',        topics:['ثغرة أمنية خطيرة','هجوم إلكتروني','تشفير كمي','أداة حماية جديدة','اختراق بيانات']},
  {cat:'الشركات والأعمال',    topics:['استثمار تقني ضخم','اندماج شركتين','إطلاق منتج جديد','نمو قياسي','صفقة استحواذ']},
  {cat:'السيارات الكهربائية', topics:['سيارة كهربائية جديدة','شبكة شحن متطورة','بطارية صلبة الحالة','سيارة ذاتية القيادة','توربوشارج سريع']},
  {cat:'الروبوتات',            topics:['روبوت جراحي','روبوت صناعي','روبوت منزلي','ذراع آلية','روبوت استكشافي']},
  {cat:'ألعاب الفيديو',       topics:['إطلاق لعبة جديدة','منصة ألعاب سحابية','نظارة واقع افتراضي','بطولة عالمية','محرك رسوميات جديد']},
];

const COMPANIES = ['غوغل','آبل','مايكروسوفت','أمازون','ميتا','تسلا','سامسونج','نفيديا','OpenAI','DeepMind','Anthropic','باحثون يابانيون','جامعة MIT','مركز أبحاث أوروبي'];
const ACTIONS   = ['تُطلق','تعلن عن','تكشف','تطور','تختبر','تستعرض','تُقدّم','تُوقّع على'];
const IMPACTS   = ['في خطوة تُعدّ الأبرز هذا العام','مما يمثل قفزة نوعية في المجال','في إنجاز يُعيد رسم خارطة الصناعة','بتمويل يتجاوز مليار دولار','بعد سنوات من البحث والتطوير'];

function genTitle(topic, company, action) {
  return `${company} ${action} ${topic} ${IMPACTS[Math.floor(Math.random()*IMPACTS.length)]}`;
}
function genExcerpt(title, cat) {
  const bodies = [
    `أعلنت ${title.split(' ')[0]} عن إنجاز جديد في مجال ${cat}، يمثل هذا التطور نقلة نوعية في القطاع وسيكون له تأثير واسع على المستخدمين والشركات على حد سواء خلال الفترة القادمة.`,
    `كشفت المصادر المطلعة عن تفاصيل مثيرة تتعلق بـ${cat}، حيث يُتوقع أن تُحدث هذه التطورات ثورة في طريقة تعامل الناس مع التكنولوجيا في حياتهم اليومية.`,
    `تشير أحدث التقارير إلى تقدم ملحوظ في مجال ${cat}، وسط توقعات بأن تنعكس نتائج هذه التطورات على المنافسة السوقية وتوجهات الصناعة العالمية.`,
  ];
  return bodies[Math.floor(Math.random()*bodies.length)];
}


const SECTION_HEADERS = ['أبرز التفاصيل','ماذا يعني هذا؟','ردود الفعل','التوقعات المستقبلية','الخلاصة'];

function genRichContent(title, cat, excerpt, company, topic) {
  var para1 = excerpt || title;
  var para2 = 'يأتي هذا التطور في سياق سباق محموم تشهده صناعة ' + cat + ' على مستوى العالم، إذ تتنافس كبرى الشركات على تحقيق اختراقات تقنية تُعزّز مكانتها في سوق بات يُقدَّر بأكثر من تريليون دولار. وتتصدّر ' + company + ' هذا المشهد بعد سلسلة من الاستثمارات الضخمة التي ضختها في بنيتها البحثية والتطويرية خلال السنوات الأخيرة.';
  var para3 = 'على الصعيد التقني، تكشف المعطيات المتوفرة أن ' + topic + ' تمثّل نقلةً نوعيةً حقيقية قياساً بما كان متاحاً من حلول سابقة. وقد تمكّن الباحثون من تجاوز عقبات ظلّت تُعيق التقدم في هذا المجال لسنوات، مما أفضى إلى منتج يُلبّي احتياجات المستخدمين بكفاءة غير مسبوقة.';
  var allQuotes = [
    '"ما حقّقناه اليوم لم يكن ممكناً قبل عامين — إنه نتاج سنوات من البحث المتواصل"',
    '"هذا التطور يُعيد تعريف ما يمكن أن تفعله التكنولوجيا لصالح الإنسان"',
    '"نحن أمام فجر حقيقي في عالم ' + cat + ' — الأفضل لا يزال قادماً"'
  ];
  var quote = allQuotes[Math.floor(Math.random() * allQuotes.length)];
  var para4 = 'وقد أثار الإعلان ردود فعل واسعة في الأوساط التقنية والأكاديمية، حيث أشاد كثير من الخبراء بما وصفوه قفزةً حقيقيةً إلى الأمام، في حين سارعت شركات منافسة إلى إعلان خططها للرد. وتُشير التقارير إلى أن عدة مؤسسات بحثية دولية بارزة تعكف حالياً على دراسة الانعكاسات العلمية والعملية لهذا التطور.';
  var para5 = 'على صعيد التأثيرات المتوقعة، يرى المحللون أن ' + topic + ' ستُحدث تحولاً ملموساً في قطاعات التعليم والصحة والصناعة على المدى المتوسط. وتتوقع تقديرات صادرة عن مؤسسات متخصصة أن يمتد تبنّي هذه التقنية ليشمل أكثر من 40 دولة بحلول نهاية العقد الحالي.';
  var para6 = 'وفي ضوء هذه التطورات، يبدو جلياً أن وتيرة الابتكار في قطاع ' + cat + ' لن تتراجع في المدى المنظور. ويُوصي الخبراء المستثمرين والمؤسسات والأفراد على حدٍّ سواء بمتابعة هذا الملف عن كثب، إذ قد يكون ما نشهده اليوم مجرد البداية لثورة تقنية ستُغيّر كثيراً من المفاهيم السائدة.';

  return '<p>' + para1 + '</p>' +
    '<h2>أبرز التفاصيل</h2>' +
    '<p>' + para2 + '</p>' +
    '<p>' + para3 + '</p>' +
    '<blockquote>' + quote + '</blockquote>' +
    '<h2>ردود الفعل والتداعيات</h2>' +
    '<p>' + para4 + '</p>' +
    '<h2>التأثيرات المتوقعة</h2>' +
    '<p>' + para5 + '</p>' +
    '<h2>الخلاصة</h2>' +
    '<p>' + para6 + '</p>';
}

function generateAINews() {
  const list = document.getElementById('ai-news-list');
  if(list) list.innerHTML = `<div class="ai-generating"><div class="ai-spinner"></div><div style="font-size:14px;font-weight:600">🤖 جاري توليد الأخبار بالذكاء الاصطناعي...</div></div>`;
  document.getElementById('ai-empty-state').style.display = 'none';

  setTimeout(() => {
    loadAINews();
    const count = 5 + Math.floor(Math.random()*4);  // 5–8 news items
    const today = new Date().toLocaleDateString('ar-EG',{year:'numeric',month:'2-digit',day:'2-digit'});
    const newItems = [];
    const usedTopics = new Set();

    for (let i=0; i<count; i++) {
      const topicGroup = AI_TOPICS[Math.floor(Math.random()*AI_TOPICS.length)];
      const topic   = topicGroup.topics[Math.floor(Math.random()*topicGroup.topics.length)];
      if (usedTopics.has(topic)) continue;
      usedTopics.add(topic);
      const company = COMPANIES[Math.floor(Math.random()*COMPANIES.length)];
      const action  = ACTIONS[Math.floor(Math.random()*ACTIONS.length)];
      const title   = genTitle(topic, company, action);
      const excerpt = genExcerpt(title, topicGroup.cat);
      newItems.push({
        id:          Date.now() + i,
        title,
        cat:         topicGroup.cat,
        excerpt,
        content:     genRichContent(title, topicGroup.cat, excerpt, company, topic),
        date:        today,
        author:      'فريق التحرير',
        views:       '٠',
        status:      'مسودة',
        priority:    'عادي',
        aiStatus:    'pending',
        aiGenerated: true,
      });
    }

    aiNewsData = [...newItems, ...aiNewsData.filter(n=>n.aiStatus!=='pending')];
    saveAINews();
    renderAINews();
    showToast(`🤖 تم توليد ${newItems.length} أخبار جديدة — راجعها وانشرها`);
  }, 1800);
}

function approveAI(id) {
  const n = aiNewsData.find(x=>x.id===id); if(!n) return;
  n.aiStatus = 'approved';
  n.status   = 'منشور';
  n.priority = n.priority || 'عادي';
  // Hide AI origin: show as فريق التحرير
  if (!n.author || n.author === 'الذكاء الاصطناعي') n.author = 'فريق التحرير';
  // Add to main newsData
  if (!newsData.find(x=>x.id===id)) {
    // Build clean article object without AI-internal fields
    const clean = {
      id:        n.id,
      title:     n.title,
      cat:       n.cat,
      excerpt:   n.excerpt,
      content:   n.content || '',
      date:      n.date,
      author:    n.author,
      views:     '٠',
      status:    'منشور',
      priority:  n.priority,
      thumbnail: n.thumbnail || '',
    };
    newsData.unshift(clean);
    _fbSetNews(clean);
    saveAll();
    renderNewsTable(newsData);
  }
  saveAINews(); renderAINews();
  showToast('✅ تم نشر الخبر في الموقع');
}

function editAIandApprove(id) {
  const n = aiNewsData.find(x=>x.id===id); if(!n) return;
  // Populate news modal with all AI-generated content
  document.getElementById('news-edit-id').value = '';   // treat as new
  document.getElementById('n-title').value    = n.title;
  const catEl = document.getElementById('n-cat'); if(catEl) catEl.value = n.cat;
  document.getElementById('n-status').value   = 'منشور';
  document.getElementById('n-priority').value = n.priority || 'عادي';
  document.getElementById('n-excerpt').value  = n.excerpt || '';
  excerptSetContent(n.excerpt || '');
  // Load the full AI content into the editor so user can edit it
  rteSetContent(n.content || n.excerpt || '');
  document.getElementById('n-thumbnail').value = n.thumbnail || '';
  if (n.thumbnail) {
    document.getElementById('n-thumb-preview').innerHTML = `<img src="${n.thumbnail}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`;
  } else {
    document.getElementById('n-thumb-preview').innerHTML = '🖼';
  }
  document.getElementById('news-modal-title').textContent = '✏️ تعديل خبر الذكاء الاصطناعي قبل النشر';
  // Mark for rejection after edit
  n._editApprove = true;
  openModal('news-modal');
  // Override save to also approve
  const origSave = document.querySelector('#news-modal .modal-foot .btn-primary');
  origSave.setAttribute('data-ai-id', id);
  origSave.onclick = () => {
    saveNews();
    // Mark this AI news as approved
    const nn = aiNewsData.find(x=>x.id===id);
    if (nn) { nn.aiStatus = 'approved'; nn.status = 'منشور'; }
    saveAINews(); renderAINews();
    closeModal('news-modal');
    showToast('✅ تم تعديل الخبر ونشره');
  };
}

function rejectAI(id) {
  const n = aiNewsData.find(x=>x.id===id); if(!n) return;
  n.aiStatus = 'rejected';
  saveAINews(); renderAINews();
  showToast('🗑 تم رفض الخبر');
}

function undoApproveAI(id) {
  const n = aiNewsData.find(x=>x.id===id); if(!n) return;
  n.aiStatus = 'pending';
  n.status   = 'مسودة';
  // Remove from main newsData so it disappears from website
  newsData = newsData.filter(x => x.id !== id);
  _fbDelNews(id);
  saveAll();
  saveAINews(); // saves aiStatus back to pending
  renderNewsTable(newsData);
  renderAINews();
  showToast('↩ تم إلغاء النشر — الخبر أُزيل من الموقع');
}

function restoreAI(id) {
  const n = aiNewsData.find(x=>x.id===id); if(!n) return;
  n.aiStatus = 'pending';
  saveAINews(); renderAINews();
  showToast('↩ تم استعادة الخبر');
}

function approveAllAI() {
  loadAINews();
  const pending = aiNewsData.filter(n=>n.aiStatus==='pending');
  if (!pending.length) { showToast('⚠️ لا توجد أخبار بانتظار الموافقة'); return; }
  pending.forEach(n => {
    n.aiStatus = 'approved';
    n.status   = 'منشور';
    n.priority = n.priority || 'عادي';
    if (!n.author || n.author === 'الذكاء الاصطناعي') n.author = 'فريق التحرير';
    if (!newsData.find(x=>x.id===n.id)) {
      newsData.unshift({
        id:n.id, title:n.title, cat:n.cat, excerpt:n.excerpt,
        content:n.content||'', date:n.date, author:n.author,
        views:'٠', status:'منشور', priority:n.priority, thumbnail:n.thumbnail||''
      });
    }
  });
  saveAll(); saveAINews();
  renderNewsTable(newsData); renderAINews();
  showToast(`✅ تم نشر ${pending.length} خبر دفعة واحدة`);
}

// ═══════════════════════════════════════════════════════════════
// FETCH NEWS FROM INTERNET (via Anthropic API with web search)
// ═══════════════════════════════════════════════════════════════
let fetchedNewsData = [];

function loadFetchedNews() {
  try { fetchedNewsData = JSON.parse(localStorage.getItem('atq_fetched_news')) || []; } catch(e) { fetchedNewsData = []; }
}
function saveFetchedNews() { localStorage.setItem('atq_fetched_news', JSON.stringify(fetchedNewsData)); }

function renderFetchedNews() {
  loadFetchedNews();
  var list  = document.getElementById('fetch-news-list');
  var empty = document.getElementById('fetch-news-empty');
  var stats = document.getElementById('fetch-news-stats');

  var pending  = fetchedNewsData.filter(function(n){ return n.fetchStatus === 'pending'; });
  var approved = fetchedNewsData.filter(function(n){ return n.fetchStatus === 'approved'; });
  if (stats) stats.textContent = pending.length + ' بانتظار الموافقة — ' + approved.length + ' منشور';

  var badge = document.getElementById('fetch-pending-badge');
  if (badge) badge.style.display = pending.length > 0 ? 'inline' : 'none';

  if (!fetchedNewsData.length) {
    if (list) list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (!list) return;

  list.innerHTML = fetchedNewsData.map(function(n) {
    var isPinned = String(n.id) === localStorage.getItem('atq_wide_pinned');
    var foot = '';
    if (n.fetchStatus === 'pending') {
      foot = '<button class="btn-approve" onclick="approveFetched(' + n.id + ')">✅ نشر</button>' +
             '<button class="btn-approve" style="background:rgba(74,158,255,0.1);color:#6BB5FF;border-color:rgba(74,158,255,0.25)" onclick="editFetchedAndApprove(' + n.id + ')">✏️ تعديل ونشر</button>' +
             '<button class="btn-reject" onclick="rejectFetched(' + n.id + ')">🗑 رفض</button>';
    } else if (n.fetchStatus === 'approved') {
      foot = '<span style="font-size:12px;color:var(--green)">✅ منشور</span>' +
             '<button class="btn-secondary" style="font-size:12px;padding:5px 12px" onclick="undoFetched(' + n.id + ')">↩ إلغاء</button>' +
             '<button class="btn-view" style="font-size:12px;padding:5px 12px;background:rgba(74,158,255,0.1);color:#6BB5FF;border-color:rgba(74,158,255,0.25)" onclick="' + (isPinned ? 'unpinWide()' : 'pinToWide(' + n.id + ')') + '">' + (isPinned ? '📌 مثبت' : '📌 بانر') + '</button>';
    } else {
      foot = '<span style="font-size:12px;color:var(--text-dim)">مرفوض</span>' +
             '<button class="btn-secondary" style="font-size:12px;padding:5px 12px" onclick="restoreFetched(' + n.id + ')">↩ استعادة</button>';
    }

    var cls = n.fetchStatus==='approved'?'approved':n.fetchStatus==='rejected'?'rejected':'';
    var hasContent = n.content && n.content.length > 20;

    return '<div class="ai-card ' + cls + '" id="fetchcard-' + n.id + '">' +
      '<div class="ai-card-head">' +
        '<span class="ai-badge ' + (n.fetchStatus==='pending'?'ai-badge-pending':n.fetchStatus==='approved'?'ai-badge-approved':'ai-badge-rejected') + '">' +
          (n.fetchStatus==='pending'?'⏳ جديد':n.fetchStatus==='approved'?'✅ منشور':'🗑 مرفوض') +
        '</span>' +
        '<div style="flex:1">' +
          '<div class="ai-card-title">' + n.title + '</div>' +
          '<div class="ai-card-meta">' +
            '<span>📁 ' + n.cat + '</span>' +
            '<span>📅 ' + n.date + '</span>' +
            (n.source ? '<span>🌐 ' + n.source + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ai-card-body">' + (n.excerpt||'') + '</div>' +
      (hasContent ?
        '<div class="ai-card-full-content" id="fetch-full-' + n.id + '" style="display:none;padding:0 20px 16px;border-top:1px solid var(--border-dim);margin-top:8px">' +
          '<div style="font-size:13px;line-height:1.9;color:var(--text-muted)">' + n.content + '</div>' +
        '</div>' +
        '<div style="padding:0 20px 10px">' +
          '<button onclick="toggleFetchContent(' + n.id + ')" id="fetch-expand-' + n.id + '" class="btn-secondary" style="font-size:12px;padding:5px 14px">📖 عرض المحتوى</button>' +
        '</div>'
      : '') +
      '<div class="ai-card-foot">' + foot + '</div>' +
    '</div>';
  }).join('');
}

function toggleFetchContent(id) {
  var el = document.getElementById('fetch-full-' + id);
  var btn = document.getElementById('fetch-expand-' + id);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
  if (btn) btn.textContent = el.style.display === 'block' ? '📖 إخفاء' : '📖 عرض المحتوى';
}

async function searchInternetNews() {
  var query = document.getElementById('fetch-query').value.trim();
  if (!query) { showToast('⚠️ أدخل موضوع البحث'); return; }

  var btn = document.getElementById('fetch-search-btn');
  var list = document.getElementById('fetch-news-list');
  var empty = document.getElementById('fetch-news-empty');

  btn.disabled = true;
  btn.textContent = '⏳ جاري البحث...';
  if (list) list.innerHTML = '<div class="ai-generating"><div class="ai-spinner"></div><div style="font-size:14px;font-weight:600">🔍 جاري البحث في الإنترنت عن: ' + query + '</div></div>';
  if (empty) empty.style.display = 'none';

  var today = new Date().toLocaleDateString('ar-EG',{year:'numeric',month:'2-digit',day:'2-digit'});

  var systemPrompt = 'أنت محرر صحفي متخصص في أخبار التكنولوجيا. مهمتك البحث عن آخر الأخبار التقنية وكتابتها بأسلوب صحفي عربي احترافي. يجب أن تكتب الأخبار كأنها مكتوبة بشكل أصلي من قِبل محررين متخصصين، ولا تذكر أنها مولّدة بالذكاء الاصطناعي. الكاتب دائماً هو "فريق التحرير".';

  var userPrompt = 'ابحث في الإنترنت عن آخر الأخبار التقنية المتعلقة بـ: "' + query + '"\n\n' +
    'اعثر على 3 أخبار حديثة ومختلفة، ولكل خبر أنشئ المحتوى التالي:\n' +
    '1. عنوان جذاب باللغة العربية\n' +
    '2. قسم من: [الذكاء الاصطناعي، الهواتف والأجهزة، الفضاء والعلوم، الأمن الرقمي، الشركات والأعمال، السيارات الكهربائية، الروبوتات، ألعاب الفيديو]\n' +
    '3. ملخص (2-3 جمل)\n' +
    '4. محتوى كامل (4-6 فقرات صحفية: مقدمة، تفاصيل، ردود الفعل، التأثيرات المستقبلية)\n' +
    '5. اسم المصدر الأصلي\n\n' +
    'أجب بصيغة JSON فقط بدون أي نص إضافي:\n' +
    '{"news": [{"title":"...","cat":"...","excerpt":"...","content":"<p>...</p>","source":"..."}]}'

  // Get active API key
  var activeKey = _getActiveApiKey();
  if (!activeKey) {
    if (list) list.innerHTML = '';
    if (empty) { empty.style.display = 'block'; empty.querySelector && (empty.innerHTML = '<div style="font-size:40px;margin-bottom:12px">🔑</div><div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">مفتاح API مطلوب</div><div style="font-size:13px;color:var(--text-muted)">أضف مفتاح API من أيقونة الإعدادات أعلاه للبدء في الاستيراد</div>'); }
    btn.disabled = false; btn.textContent = '🔍 بحث';
    showToast('⚠️ أضف مفتاح Anthropic API أولاً من إعدادات API');
    return;
  }

  try {
    var response = await fetch('/api/anthropic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': activeKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-1'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    var data = await response.json();
    // Extract text from response (may include tool_use blocks)
    var fullText = (data.content || [])
      .filter(function(b){ return b.type === 'text'; })
      .map(function(b){ return b.text; })
      .join('');

    // Parse JSON from response
    var jsonMatch = fullText.match(/\{[\s\S]*"news"[\s\S]*\}/);
    if (!jsonMatch) throw new Error('لم يتم العثور على JSON في الرد');
    var parsed = JSON.parse(jsonMatch[0]);
    var items = parsed.news || [];
    if (!items.length) throw new Error('لم يتم العثور على أخبار');

    loadFetchedNews();
    items.forEach(function(item, i) {
      fetchedNewsData.unshift({
        id:          Date.now() + i,
        title:       item.title   || '',
        cat:         item.cat     || 'الذكاء الاصطناعي',
        excerpt:     item.excerpt || '',
        content:     item.content || '',
        source:      item.source  || '',
        date:        today,
        author:      'فريق التحرير',
        views:       '٠',
        status:      'مسودة',
        priority:    'عادي',
        thumbnail:   '',
        fetchStatus: 'pending',
      });
    });
    saveFetchedNews();
    renderFetchedNews();
    showToast('✅ تم العثور على ' + items.length + ' أخبار جديدة');

  } catch(err) {
    console.error('Fetch news error:', err);
    if (list) list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    showToast('⚠️ خطأ في البحث: ' + err.message);
  }

  btn.disabled = false;
  btn.textContent = '🔍 بحث';
}

function approveFetched(id) {
  var n = fetchedNewsData.find(function(x){ return x.id===id; });
  if (!n) return;
  n.fetchStatus = 'approved';
  n.status      = 'منشور';
  if (!newsData.find(function(x){ return x.id===id; })) {
    newsData.unshift({
      id:n.id, title:n.title, cat:n.cat, excerpt:n.excerpt,
      content:n.content, date:n.date, author:n.author,
      views:'٠', status:'منشور', priority:n.priority, thumbnail:n.thumbnail||''
    });
    saveAll();
    renderNewsTable(newsData);
  }
  saveFetchedNews(); renderFetchedNews();
  showToast('✅ تم نشر الخبر');
}

function editFetchedAndApprove(id) {
  var n = fetchedNewsData.find(function(x){ return x.id===id; });
  if (!n) return;
  document.getElementById('news-edit-id').value  = '';
  document.getElementById('n-title').value       = n.title;
  var catEl = document.getElementById('n-cat'); if(catEl) catEl.value = n.cat;
  document.getElementById('n-status').value      = 'منشور';
  document.getElementById('n-priority').value    = 'عادي';
  document.getElementById('n-excerpt').value     = n.excerpt || '';
  excerptSetContent(n.excerpt || '');
  rteSetContent(n.content || '');
  document.getElementById('n-thumbnail').value   = '';
  document.getElementById('n-thumb-preview').innerHTML = '🖼';
  document.getElementById('news-modal-title').textContent = 'تعديل ونشر — ' + n.title.substring(0,30);
  var saveBtn = document.querySelector('#news-modal .modal-foot .btn-primary');
  if (saveBtn) {
    saveBtn.setAttribute('data-fetch-id', id);
    saveBtn.onclick = function() {
      saveNews();
      n.fetchStatus = 'approved';
      n.status = 'منشور';
      saveFetchedNews(); renderFetchedNews();
      closeModal('news-modal');
    };
  }
  openModal('news-modal');
}

function rejectFetched(id) {
  var n = fetchedNewsData.find(function(x){ return x.id===id; });
  if (!n) return;
  n.fetchStatus = 'rejected';
  saveFetchedNews(); renderFetchedNews();
  showToast('🗑 تم رفض الخبر');
}

function undoFetched(id) {
  var n = fetchedNewsData.find(function(x){ return x.id===id; });
  if (!n) return;
  n.fetchStatus = 'pending';
  n.status = 'مسودة';
  newsData = newsData.filter(function(x){ return x.id !== id; });
  _fbDelNews(id);
  saveAll(); saveFetchedNews();
  renderNewsTable(newsData); renderFetchedNews();
  showToast('↩ تم إلغاء النشر — الخبر أُزيل من الموقع');
}

function approveAllFetched() {
  loadFetchedNews();
  var pending = fetchedNewsData.filter(function(n){ return n.fetchStatus === 'pending'; });
  if (!pending.length) { showToast('⚠️ لا توجد أخبار بانتظار الموافقة'); return; }
  pending.forEach(function(n) {
    n.fetchStatus = 'approved';
    n.status = 'منشور';
    if (!newsData.find(function(x){ return x.id === n.id; })) {
      newsData.unshift({
        id:n.id, title:n.title, cat:n.cat, excerpt:n.excerpt,
        content:n.content, date:n.date, author:n.author,
        views:'٠', status:'منشور', priority:n.priority, thumbnail:n.thumbnail||''
      });
    }
  });
  saveAll(); saveFetchedNews();
  renderNewsTable(newsData); renderFetchedNews();
  showToast('✅ تم نشر ' + pending.length + ' خبر');
}

function restoreFetched(id) {
  var n = fetchedNewsData.find(function(x){ return x.id===id; });
  if (!n) return;
  n.fetchStatus = 'pending';
  saveFetchedNews(); renderFetchedNews();
  showToast('↩ تم استعادة الخبر');
}


// AI news loaded via showPage patch below


// ================================================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE (required for type="module")
// ================================================================
window.changeAdminPassword   = changeAdminPassword;
window.saveCommentsControl   = saveCommentsControl;
window.saveAdBanner          = saveAdBanner;
window.saveFooterLinks       = saveFooterLinks;
window.toggleApiKeysPanel    = toggleApiKeysPanel;
window.addApiKeyRow          = addApiKeyRow;
window.deleteApiKey          = deleteApiKey;
window.updateApiKey          = updateApiKey;
window.setActiveApiKey       = setActiveApiKey;
window.testApiKey            = testApiKey;
window.refreshCatDropdowns   = refreshCatDropdowns;
window.addSocialMedia        = addSocialMedia;
window.deleteSocialMedia     = deleteSocialMedia;
window.updateSocialMedia     = updateSocialMedia;
window.renderSocialMedia     = renderSocialMedia;
window.renderFooterColEditor = renderFooterColEditor;
window.addFooterLink         = addFooterLink;
window.deleteFooterLink      = deleteFooterLink;
window.updateFooterLink      = updateFooterLink;
window.saveFooterCol         = saveFooterCol;
window.renderAdsManager      = renderAdsManager;
window.saveEditor            = saveEditor;
window.disableAllComments    = disableAllComments;
window.loadSubscribers       = loadSubscribers;
window.loadAnalytics         = loadAnalytics;
window._syncEditorPasswords  = _syncEditorPasswords;
window.refreshNewsCatDropdown = refreshNewsCatDropdown;
window.openEmailModal        = openEmailModal;
window.sendEmailToSubs       = sendEmailToSubs;
window.toggleAllSubs         = toggleAllSubs;
window.toggleSubSelect       = toggleSubSelect;
window.toggleEditorActive    = toggleEditorActive;
window.toggleEditorNewsAccess = toggleEditorNewsAccess;
window.filterSubscribers     = filterSubscribers;
window.deleteSubscriber      = deleteSubscriber;
window.exportSubscribers     = exportSubscribers;
window.enableAllComments     = enableAllComments;
window.saveStatsBar          = saveStatsBar;
window.loadStatsBar          = loadStatsBar;
window.addNavMenuItem        = addNavMenuItem;
window.deleteNavItem         = deleteNavItem;
window.updateNavItem         = updateNavItem;
window.saveNavMenu           = saveNavMenu;
window.resetNavMenu          = resetNavMenu;
window.renderNavMenuEditor   = renderNavMenuEditor;
window.loadAdBanners         = loadAdBanners;
window.addCustomBanner       = addCustomBanner;
window.updateCustomBanner    = updateCustomBanner;
window.deleteCustomBanner    = deleteCustomBanner;
window.renderCustomBanners   = renderCustomBanners;
window.showNewsSubTab        = showNewsSubTab;
window.toggleNewsComments    = toggleNewsComments;
window.saveFooterSettings  = saveFooterSettings;
window.addNewsToBreaking = addNewsToBreaking;
window.addNewsToLatest = addNewsToLatest;
window.addToBreakingById = addToBreakingById;
window.addToLatestById = addToLatestById;
window.approveAI = approveAI;
window.approveAllAI = approveAllAI;
window.approveAllFetched = approveAllFetched;
window.approveFetched = approveFetched;
window.askDelete = askDelete;
window.checkPw = checkPw;
window.closeModal = closeModal;
window.confirmDelete = confirmDelete;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.editAIandApprove = editAIandApprove;
window.editBreaking = editBreaking;
window.editCat = editCat;
window.editEditor = editEditor;
window.editFetchedAndApprove = editFetchedAndApprove;
window.editLatest = editLatest;
window.editNews = editNews;
window.filterNews = filterNews;
window.generateAINews = generateAINews;
window.loadFetchedNews = loadFetchedNews;
window.openModal = openModal;
window.pinToWide = pinToWide;
window.previewNewsThumb = previewNewsThumb;
window.previewNewsThumbUrl = previewNewsThumbUrl;
window.rejectAI = rejectAI;
window.rejectFetched = rejectFetched;
window.removeFromBreakingByTitle = removeFromBreakingByTitle;
window.removeFromLatestByTitle = removeFromLatestByTitle;
window.resetAllControls = resetAllControls;
window.restoreAI = restoreAI;
window.restoreFetched = restoreFetched;
window.rteCmd = rteCmd;
window.rteHandleImage = rteHandleImage;
window.rteInsertChart = rteInsertChart;
window.rteInsertDivider = rteInsertDivider;
window.rteInsertImage = rteInsertImage;
window.rteInsertLink = rteInsertLink;
window.rteInsertVideo = rteInsertVideo;
window.saveBreaking = saveBreaking;
window.saveCat = saveCat;
window.saveDuration = saveDuration;
window.saveDurationFromCtrl = saveDurationFromCtrl;
window.saveEditor = saveEditor;
window.saveLatest = saveLatest;
window.saveNews = saveNews;
window.savePageControl = savePageControl;
window.saveSiteAppearance = saveSiteAppearance;
window.searchInternetNews = searchInternetNews;
window.selectColor = selectColor;
window.setSiteLang = setSiteLang;
window.setSiteTheme = setSiteTheme;
window.showPage = showPage;
window.showToast = showToast;
window.syncBreakingShortcut = syncBreakingShortcut;
window.toggleAIContent = toggleAIContent;
window.toggleAdminTheme = toggleAdminTheme;
window.toggleBreakingItem = toggleBreakingItem;
window.toggleBreakingMaster = toggleBreakingMaster;
window.toggleFetchContent = toggleFetchContent;
window.toggleLatest = toggleLatest;
window.undoApproveAI = undoApproveAI;
window.undoFetched = undoFetched;
window.unpinWide = unpinWide;
window.updateTickerSpeed = updateTickerSpeed;

// ─── CRITICAL: Expose module-scoped functions called from inline HTML handlers ───
// Because <script type="module"> scopes declarations, these MUST be exposed on window
// or inline onclick/oninput/onchange handlers will throw ReferenceError silently.
window.resetNewsForm         = resetNewsForm;
window.resetCatModal         = resetCatModal;
window.resetEditorForm       = resetEditorForm;
window.footerRteCmd          = footerRteCmd;
window.applyRolePermissions  = applyRolePermissions;
window.renderFetchedNews     = renderFetchedNews;
window._getSocialMedia       = _getSocialMedia;
window._saveSocialMedia      = _saveSocialMedia;
window._renderEditorCatsList = _renderEditorCatsList;
window._currentAllowedCats   = _currentAllowedCats;
// Login-screen customization (called from oninput handlers in page controls)
window.saveLoginScreen            = saveLoginScreen;
window.loadLoginScreenControls    = loadLoginScreenControls;
window.applyLoginScreenFromCache  = applyLoginScreenFromCache;
// Identity & Layout page (الهوية والتخطيط)
window.loadIdentitySettings    = loadIdentitySettings;
window.saveIdentitySettings    = saveIdentitySettings;
window.restoreIdentityDefaults = restoreIdentityDefaults;
window.uploadLogoImage         = uploadLogoImage;
window.removeLogoImage         = removeLogoImage;
window.loadLayoutSettings      = loadLayoutSettings;
window.saveLayoutSettings      = saveLayoutSettings;
window.alignHeroHeights        = alignHeroHeights;
window.restoreHeroDefaults     = restoreHeroDefaults;
window.restoreAdHeightDefaults = restoreAdHeightDefaults;
window.renderIdentityNavMenu   = renderIdentityNavMenu;
// Footer-column helpers (already exposed above but making sure)
if (!window.updateFooterLink) window.updateFooterLink = updateFooterLink;
if (!window.addFooterLink)    window.addFooterLink    = addFooterLink;
if (!window.deleteFooterLink) window.deleteFooterLink = deleteFooterLink;
if (!window.saveFooterCol)    window.saveFooterCol    = saveFooterCol;


