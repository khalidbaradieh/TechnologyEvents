import { FIREBASE_CONFIG, DB, VERSION, STORE } from '../config.ts';
import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, onSnapshot, query, orderBy }
         from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const _fbApp = initializeApp(FIREBASE_CONFIG);
const _db    = getFirestore(_fbApp);

// ── Cache Busting ─────────────────────────────────────────────
// If VERSION changed since last visit, wipe stale localStorage caches
// (keeps auth/passwords/RBAC intact, only clears content caches)
(function _bustCacheIfNeeded() {
  try {
    const prev = localStorage.getItem(STORE.VERSION);
    if (prev !== VERSION) {
      [STORE.NEWS, STORE.LATEST, STORE.BREAKING, STORE.CATS,
       STORE.SITE_BTN, STORE.TICKER_SPD, STORE.TICKER_VIS,
       STORE.SITE_TITLE, STORE.SUB_TEXT, STORE.WIDE_PIN].forEach(k => {
        try { localStorage.removeItem(k); } catch(_) {}
      });
      localStorage.setItem(STORE.VERSION, VERSION);
      console.info('[Admin] Cache busted → v' + VERSION);
    }
  } catch(_) {}
})();

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
  try { await deleteDoc(doc(_db, DB.NEWS, String(id)));
  catch(e) { console.warn('[FB] delNews:', e); }
}

// Save a settings document: settings/{key}
async function _fbSetSetting(key, data) {
  try { await setDoc(doc(_db, DB.SETTINGS, key), data);
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
  try { localStorage.setItem(STORE.NEWS,     JSON.stringify(newsData)); }     catch(_) {}
  try { localStorage.setItem(STORE.LATEST,   JSON.stringify(latestData)); }   catch(_) {}
  try { localStorage.setItem(STORE.BREAKING, JSON.stringify(breakingData)); } catch(_) {}
  try { localStorage.setItem(STORE.CATS,     JSON.stringify(catsData)); }     catch(_) {}
  // 2. Firestore (async background — index.html reads from here)
  _fbSetSetting(DB.S.LATEST,   { items: latestData });
  _fbSetSetting(DB.S.BREAKING, { items: breakingData });
  _fbSetSetting(DB.S.CATS,     { items: catsData });
  // Note: individual news docs saved via _fbSetNews() in saveNews() etc.
}

function loadAll() {
  // Load from localStorage immediately (fast, for UI)
  try { newsData     = JSON.parse(localStorage.getItem(STORE.NEWS))     || DEF_NEWS;    } catch(e) { newsData     = DEF_NEWS;    }
  try { latestData   = JSON.parse(localStorage.getItem(STORE.LATEST))   || DEF_LATEST;  } catch(e) { latestData   = DEF_LATEST;  }
  try { breakingData = JSON.parse(localStorage.getItem(STORE.BREAKING)) || DEF_BREAKING;} catch(e) { breakingData = DEF_BREAKING;}
  try { const sc = JSON.parse(localStorage.getItem(STORE.CATS)); if(sc&&sc.length) catsData = sc; } catch(e) {}
  // Merge rbac.html-saved users (atq_editors) into editorsData so passwords + names are known
  try {
    const rbacEditors = JSON.parse(localStorage.getItem(STORE.EDITORS) || '[]');
    if (rbacEditors && rbacEditors.length) {
      const existing = new Set(editorsData.map(e => e.user));
      rbacEditors.forEach(e => { if (!existing.has(e.user)) editorsData.push(e); });
      // Also update existing users with latest data from rbac (name, role, pass, etc.)
      rbacEditors.forEach(re => {
        const idx = editorsData.findIndex(e => e.user === re.user);
        if (idx !== -1) editorsData[idx] = { ...editorsData[idx], ...re };
      });
    }
  } catch(_) {}
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
    // Update approval queue badge with fresh data
    _updateApprovalBadge();
    // Re-apply sidebar user display now that editorsData is authoritative
    if (_curUser && _curUser.username && _curUser.username !== 'admin') {
      const _fbEd = editorsData.find(e => e.user === _curUser.username);
      if (_fbEd) {
        _curUser.name = _fbEd.name || _curUser.name;
        _curUser.role = _fbEd.role || _curUser.role;
        document.getElementById('sidebar-name').textContent = _curUser.name;
        // Update sidebar role badge with RBAC role name
        const _rbSess = _loadRbacSession();
        const _rbRoles = _loadRoles();
        const _rbRole = _rbRoles.find(r => r.id === (_fbEd.roleId || _rbSess?.roleId));
        const _rb = document.getElementById('sidebar-role');
        if (_rb) _rb.textContent = (_rbRole && _rbRole.name) || _curUser.role;
        // Update RBAC session with fresh data from Firestore
        try {
          const _ss = _loadRbacSession();
          if (_ss && _ss.username === _curUser.username) {
            _ss.name        = _curUser.name;
            _ss.roleId      = _fbEd.roleId || _ss.roleId;
            _ss.customPerms = _fbEd.customPerms || _ss.customPerms || null;
            localStorage.setItem('atq_rbac_user', JSON.stringify(_ss));
          }
        } catch(_) {}
        applyRolePermissions();
      }
    }
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

    // Determine display name and role from editorsData
    let displayName = 'المدير العام';
    let legacyRole  = 'مدير';
    let rbacRoleId  = 'manager';
    let editorObj   = null;

    if (u !== 'admin') {
      editorObj = (typeof editorsData !== 'undefined')
        ? editorsData.find(e => e.user === u) : null;
      if (editorObj) {
        displayName = editorObj.name || u;
        legacyRole  = editorObj.role || 'محرر';
        // Prefer explicit roleId (set by rbac.html), else infer from legacy role
        rbacRoleId  = editorObj.roleId
          || (legacyRole === 'مدير' ? 'admin'
            : legacyRole === 'محرر' ? 'editor'
            : legacyRole === 'مشرف' ? 'supervisor'
            : legacyRole === 'كاتب' ? 'writer' : 'editor');
      } else {
        displayName = u;
        rbacRoleId  = 'editor';
      }
    }

    _curUser = { name: displayName, avatar: u[0].toUpperCase(), role: legacyRole, username: u };
    document.getElementById('sidebar-name').textContent   = _curUser.name;
    document.getElementById('sidebar-avatar').textContent = _curUser.avatar;
    const roleBadge = document.getElementById('sidebar-role');
    // Show friendly role name from loaded RBAC roles
    const _roles = _loadRoles();
    const _roleObj = _roles.find(r => r.id === rbacRoleId);
    if (roleBadge) roleBadge.textContent = (_roleObj && _roleObj.name) || legacyRole;

    // ── Save RBAC session (authoritative) ──
    const rbacSession = {
      id:          editorObj ? (editorObj.id || u) : u,
      username:    u,
      name:        displayName,
      roleId:      rbacRoleId,
      customPerms: editorObj ? (editorObj.customPerms || null) : null,
    };
    try { localStorage.setItem('atq_rbac_user', JSON.stringify(rbacSession)); } catch(_) {}

    initDashboard();
    applyRolePermissions();
    // Re-apply after async Firestore data loads
    setTimeout(applyRolePermissions, 500);
    setTimeout(applyRolePermissions, 1800);
    // Re-apply category scope filter
    const _refreshScope = () => {
      if (typeof refreshNewsCatDropdown === 'function') refreshNewsCatDropdown();
      if (typeof newsData !== 'undefined' && typeof renderNewsTable === 'function') renderNewsTable(newsData);
    };
    _refreshScope();
    setTimeout(_refreshScope, 600);
    setTimeout(_refreshScope, 1900);
  } else {
    document.getElementById('login-error').style.display = 'block';
    document.getElementById('login-pass').value = '';
  }
}
document.getElementById('login-pass').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
document.getElementById('login-user').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });

function doLogout() {
  // Clear RBAC session
  try { localStorage.removeItem('atq_rbac_user'); } catch(_) {}
  _curUser = null;
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  ['login-user','login-pass'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  // Reset all rbac-hidden elements so next login starts clean
  document.querySelectorAll('.rbac-hidden').forEach(el => el.classList.remove('rbac-hidden'));
}

// ─── ROLE-BASED PERMISSIONS ───────────────────────────────────────
// Single source of truth: RBAC session from atq_rbac_user (set by rbac.html + doLogin).
// Legacy Arabic roles are mapped to RBAC roleIds on login for backward compat.

// Built-in role defaults — mirrors rbac.html DEFAULT_ROLES exactly
const _RBAC_FALLBACK_ROLES = [
  { id:'manager',    level:100, perms:['*'] },
  { id:'admin',      level:80,  perms:['add_articles','edit_articles','edit_any_article',
    'delete_articles','publish_articles','approve_articles','review_articles',
    'schedule_articles','import_articles','ai_generate',
    'manage_homepage','manage_cats','manage_breaking','manage_ticker',
    'manage_ads','manage_nav','manage_identity',
    'manage_users','view_analytics','view_reports','view_audit_log',
    'manage_emails','manage_inbox'] },
  { id:'editor',     level:60,  perms:['add_articles','edit_articles','edit_any_article',
    'publish_articles','approve_articles','review_articles','schedule_articles',
    'ai_generate','manage_homepage','manage_breaking','manage_ticker',
    'view_analytics','view_audit_log'] },
  { id:'supervisor', level:50,  perms:['add_articles','edit_articles','edit_any_article',
    'review_articles','view_analytics'] },
  { id:'writer',     level:40,  perms:['add_articles','edit_articles'] },
  { id:'viewer',     level:20,  perms:['view_analytics','view_reports'] },
];

// RBAC permission → admin page IDs
const RBAC_PAGE_MAP = {
  add_articles:     ['news'],
  edit_articles:    ['news'],
  edit_any_article: ['news'],
  delete_articles:  ['news'],
  publish_articles: ['news'],
  review_articles:  ['news','approval-queue'],
  approve_articles: ['news','approval-queue'],
  schedule_articles:['news'],
  import_articles:  ['news'],
  ai_generate:      ['news'],
  manage_homepage:  ['pagecontrols','general-settings'],
  manage_cats:      ['categories'],
  manage_breaking:  ['breaking'],
  manage_ticker:    ['latest'],
  manage_ads:       ['ads-manager'],
  manage_nav:       ['nav-links-manager'],
  manage_identity:  ['identity','footer-control'],
  manage_users:     ['editors'],
  view_analytics:   ['analytics'],
  view_reports:     ['analytics'],
  view_audit_log:   ['analytics'],
  system_settings:  ['settings'],
  manage_emails:    ['subscribers'],
  manage_inbox:     ['inbox'],
};

// News sub-tab permissions
const NEWS_SUBTAB_PERMS = {
  'ai-news':    ['ai_generate','approve_articles'],
  'fetch-news': ['import_articles','approve_articles'],
};

// ── Workflow status definitions ─────────────────────────────────
// Each status maps to: who can set it, badge color, and display label
const NEWS_WORKFLOW = {
  'مسودة':         { label:'مسودة',          color:'var(--text-dim)',  bg:'rgba(255,255,255,0.06)', icon:'📝', setBy:['*'] },
  'مقدم':          { label:'مقدم للمراجعة',   color:'#FF9A3C',         bg:'rgba(255,154,60,0.12)',  icon:'📨', setBy:['writer','supervisor','editor','admin','manager'] },
  'قيد المراجعة':  { label:'قيد المراجعة',   color:'var(--accent)',   bg:'rgba(74,158,255,0.12)', icon:'🔍', setBy:['supervisor','editor','admin','manager'] },
  'يحتاج تعديل':  { label:'يحتاج تعديل',    color:'var(--red)',      bg:'rgba(255,82,82,0.12)',  icon:'↩️', setBy:['supervisor','editor','admin','manager'] },
  'معتمد':         { label:'معتمد',          color:'var(--purple)',   bg:'rgba(160,120,255,0.12)',icon:'✅', setBy:['editor','admin','manager'] },
  'مجدول':         { label:'مجدول',          color:'#40C8F0',        bg:'rgba(64,200,240,0.12)', icon:'🗓', setBy:['editor','admin','manager'] },
  'منشور':         { label:'منشور',          color:'var(--green)',    bg:'rgba(61,220,132,0.12)', icon:'🌐', setBy:['editor','admin','manager'] },
  'مرفوض':         { label:'مرفوض',          color:'var(--red)',      bg:'rgba(255,82,82,0.12)',  icon:'❌', setBy:['supervisor','editor','admin','manager'] },
  'مؤرشف':         { label:'مؤرشف',          color:'var(--text-dim)', bg:'rgba(255,255,255,0.06)',icon:'🗃', setBy:['admin','manager'] },
};

// Statuses that constitute "pending review" — shown in approval queue
const PENDING_STATUSES = ['مقدم','قيد المراجعة'];

// Get allowed workflow statuses for current user
function _getAllowedStatuses() {
  const session = _loadRbacSession();
  if (!session) return Object.keys(NEWS_WORKFLOW);
  const roles = _loadRoles();
  const perms = _getEffectivePerms(session, roles);
  if (perms.includes('*')) return Object.keys(NEWS_WORKFLOW);
  const roleId = session.roleId;
  return Object.entries(NEWS_WORKFLOW)
    .filter(([, def]) => def.setBy.includes('*') || def.setBy.includes(roleId))
    .map(([status]) => status);
}

// Statuses that lock an article from writer edits entirely
const WRITER_LOCKED_STATUSES = ['قيد المراجعة', 'معتمد', 'مجدول', 'منشور'];

// Check if current user can edit a specific article (ownership + permission + status lock)
function _canEditArticle(article) {
  if (!article) return false;
  if (!_hasPerm('edit_articles')) return false;
  // Roles with edit_any_article (editor, admin, manager) bypass all locks
  if (_hasPerm('edit_any_article')) return true;
  // Writers and supervisors without edit_any_article:
  // 1. Must own the article
  const session = _loadRbacSession();
  if (!session) return true;
  const myName = _curUser ? _curUser.name : session.name;
  const isOwn = article.author === myName || article.createdBy === session.username;
  if (!isOwn) return false;
  // 2. Article must not be in a locked status
  if (WRITER_LOCKED_STATUSES.includes(article.status)) return false;
  return true;
}

// Check if current user can change the status of an article
function _canSetStatus(article, targetStatus) {
  if (!article) return false;
  const allowed = _getAllowedStatuses();
  if (!allowed.includes(targetStatus)) return false;
  // Writers cannot approve/publish their own articles
  if (['معتمد','منشور'].includes(targetStatus)) {
    const session = _loadRbacSession();
    if (session) {
      const myName = _curUser ? _curUser.name : session.name;
      const isOwn = article.author === myName || article.createdBy === session.username;
      if (isOwn && !_hasPerm('approve_articles')) return false;
    }
  }
  return true;
}

// Record an audit event on an article
function _auditStamp(article, action) {
  const session = _loadRbacSession();
  const who = _curUser ? _curUser.name : (session ? session.name : 'النظام');
  const ts  = new Date().toISOString();
  if (!article.audit) article.audit = [];
  article.audit.unshift({ action, who, ts });
  // Keep only last 20 events
  if (article.audit.length > 20) article.audit = article.audit.slice(0, 20);
  // Also stamp per-action fields
  if (action === 'create')    { article.createdBy = who;   article.createdAt = ts; }
  if (action === 'edit')      { article.editedBy  = who;   article.editedAt  = ts; }
  if (action === 'approve')   { article.approvedBy= who;   article.approvedAt= ts; }
  if (action === 'publish')   { article.publishedBy=who;   article.publishedAt=ts; }
  if (action === 'reject')    { article.rejectedBy = who;  article.rejectedAt = ts; }
  if (action === 'submit')    { article.submittedBy= who;  article.submittedAt= ts; }
}

// Load roles from localStorage cache (synced by rbac.html)
function _loadRoles() {
  try {
    const c = JSON.parse(localStorage.getItem('atq_rbac_roles') || '[]');
    if (Array.isArray(c) && c.length) return c;
  } catch(_) {}
  return _RBAC_FALLBACK_ROLES;
}

// Load current RBAC session
function _loadRbacSession() {
  try {
    const s = localStorage.getItem('atq_rbac_user');
    return s ? JSON.parse(s) : null;
  } catch(_) { return null; }
}

// Get effective permissions for a session
function _getEffectivePerms(session, roles) {
  if (!session || !session.roleId) return [];
  if (session.customPerms) return session.customPerms;
  const role = roles.find(r => r.id === session.roleId);
  return role ? (role.perms || []) : [];
}

// Check if current session has a given permission
function _hasPerm(perm) {
  const session = _loadRbacSession();
  if (!session) return true; // no RBAC session = full access (main admin)
  const roles = _loadRoles();
  const perms = _getEffectivePerms(session, roles);
  return perms.includes('*') || perms.includes(perm);
}

// Compute allowed page IDs (null = all access)
function _getRbacAllowedPages() {
  const session = _loadRbacSession();
  if (!session || !session.roleId) return null;
  if (session.roleId === 'manager') return null;
  const roles = _loadRoles();
  const perms = _getEffectivePerms(session, roles);
  if (!perms || !perms.length) return ['overview'];
  if (perms.includes('*')) return null;
  const pages = new Set(['overview']);
  perms.forEach(p => { (RBAC_PAGE_MAP[p] || []).forEach(pg => pages.add(pg)); });
  return [...pages];
}

// Check if a news sub-tab is accessible
function _canAccessNewsSubTab(tabId) {
  const required = NEWS_SUBTAB_PERMS[tabId];
  if (!required) return true;
  return required.some(p => _hasPerm(p));
}

// ─── MASTER PERMISSION APPLY ──────────────────────────────────────
// Called on login, after Firestore loads, and after RBAC role changes.
function applyRolePermissions() {
  // Determine allowed page list
  const session  = _loadRbacSession();
  const isAdmin  = !_curUser || _curUser.username === 'admin';
  const allowed  = isAdmin ? null : _getRbacAllowedPages();

  // ── 1. Sidebar nav items ───────────────────────────────────
  // Reset all first
  document.querySelectorAll('.sidebar-nav .nav-item, .sidebar-nav .nav-section-title, .sidebar-nav .divider')
    .forEach(el => el.classList.remove('rbac-hidden'));

  if (allowed !== null) {
    document.querySelectorAll('.sidebar-nav .nav-item[data-page]').forEach(a => {
      const pageId = a.getAttribute('data-page');
      if (pageId && !allowed.includes(pageId)) a.classList.add('rbac-hidden');
    });
    // Hide section titles whose children are all hidden
    document.querySelectorAll('.sidebar-nav .nav-section-title').forEach(title => {
      let next = title.nextElementSibling;
      let anyVisible = false;
      while (next && !next.classList.contains('nav-section-title') && !next.classList.contains('divider')) {
        if (next.classList.contains('nav-item') && !next.classList.contains('rbac-hidden')) {
          anyVisible = true; break;
        }
        next = next.nextElementSibling;
      }
      if (!anyVisible) title.classList.add('rbac-hidden');
    });
  }

  // ── 2. data-perm buttons/elements ─────────────────────────
  document.querySelectorAll('[data-perm]').forEach(el => {
    const perm = el.getAttribute('data-perm');
    if (!perm) return;
    if (!_hasPerm(perm)) {
      el.classList.add('rbac-hidden');
    } else {
      el.classList.remove('rbac-hidden');
    }
  });

  // ── 3. News sub-tabs ───────────────────────────────────────
  ['ai-news', 'fetch-news'].forEach(tab => {
    const btn = document.getElementById('ntab-' + tab);
    if (!btn) return;
    if (!_canAccessNewsSubTab(tab)) btn.classList.add('rbac-hidden');
    else btn.classList.remove('rbac-hidden');
  });

  // ── 4. Redirect if on forbidden page ──────────────────────
  if (allowed !== null) {
    const activePage = document.querySelector('.page.active');
    if (activePage) {
      const activeId = activePage.id.replace(/^page-/, '');
      if (!allowed.includes(activeId)) {
        const overviewItem = document.querySelector('.sidebar-nav .nav-item[data-page="overview"], .sidebar-nav .nav-item[onclick*="overview"]');
        if (typeof showPage === 'function') showPage('overview', overviewItem);
      }
    }
  }

  // ── 5. Writers: if no publish permission, hide status options ─
  if (!_hasPerm('publish_articles')) {
    const statusSel = document.getElementById('n-status');
    if (statusSel) {
      Array.from(statusSel.options).forEach(opt => {
        const restricted = ['منشور','معتمد','مجدول','مؤرشف'];
        opt.disabled = restricted.includes(opt.value);
      });
    }
    // Show writer note in modal
    const writerNote = document.getElementById('n-status-writer-note');
    if (writerNote) writerNote.style.display = 'block';
    // Show writer banner in news list
    const writerInfo = document.getElementById('news-writer-info');
    if (writerInfo) writerInfo.style.display = 'block';
  } else {
    const statusSel = document.getElementById('n-status');
    if (statusSel) {
      Array.from(statusSel.options).forEach(opt => { opt.disabled = false; });
    }
    const writerNote = document.getElementById('n-status-writer-note');
    if (writerNote) writerNote.style.display = 'none';
    const writerInfo = document.getElementById('news-writer-info');
    if (writerInfo) writerInfo.style.display = 'none';
  }

  // ── 6. News filter status dropdown — show all workflow statuses ─
  const filterStatSel = document.getElementById('news-filter-status');
  if (filterStatSel && filterStatSel.options.length <= 4) {
    // Rebuild with full workflow statuses
    filterStatSel.innerHTML = '<option value="كل الحالات">كل الحالات</option>' +
      Object.entries(NEWS_WORKFLOW).map(([s, def]) =>
        `<option value="${s}">${def.icon} ${def.label}</option>`
      ).join('');
  }

  // ── 7. News role banner ────────────────────────────────────
  _updateNewsRoleBanner();

  // ── 8. Update approval queue badge ─────────────────────────
  _updateApprovalBadge();
}

// ── News Role Banner — shows current user's news permissions ──
function _updateNewsRoleBanner() {
  const banner  = document.getElementById('news-role-banner');
  if (!banner) return;
  // Only show for non-admin RBAC users (admin sees everything, no need for banner)
  const isAdmin = !_curUser || _curUser.username === 'admin';
  if (isAdmin) { banner.style.display = 'none'; return; }

  const session = _loadRbacSession();
  if (!session || !session.roleId) { banner.style.display = 'none'; return; }

  const roles   = _loadRoles();
  const role    = roles.find(r => r.id === session.roleId);
  if (!role) { banner.style.display = 'none'; return; }

  // Build permission summary
  const canAdd     = _hasPerm('add_articles');
  const canEdit    = _hasPerm('edit_articles');
  const canEditAny = _hasPerm('edit_any_article');
  const canDel     = _hasPerm('delete_articles');
  const canPublish = _hasPerm('publish_articles');
  const canApprove = _hasPerm('approve_articles');
  const canReview  = _hasPerm('review_articles');
  const canAI      = _hasPerm('ai_generate');
  const canImport  = _hasPerm('import_articles');

  const caps = [];
  if (canAdd)     caps.push('إضافة');
  if (canEdit)    caps.push(canEditAny ? 'تعديل (الكل)' : 'تعديل (مقالاتي)');
  if (canDel)     caps.push('حذف');
  if (canReview)  caps.push('مراجعة');
  if (canApprove) caps.push('اعتماد');
  if (canPublish) caps.push('نشر');
  if (canAI)      caps.push('ذكاء اصطناعي');
  if (canImport)  caps.push('استيراد');

  const iconEl  = document.getElementById('news-role-icon');
  const labelEl = document.getElementById('news-role-label');
  const descEl  = document.getElementById('news-role-desc');
  const badgeEl = document.getElementById('news-role-badge-el');

  if (iconEl)  iconEl.textContent  = role.icon || '👤';
  if (labelEl) labelEl.textContent = (role.name || session.roleId) + ' — صلاحيات قسم الأخبار';
  if (descEl)  descEl.textContent  = caps.length
    ? 'صلاحياتك: ' + caps.join(' · ')
    : 'وصول للعرض فقط — لا توجد صلاحيات تعديل';
  if (badgeEl) {
    badgeEl.textContent = role.name || session.roleId;
    badgeEl.style.color       = role.color || 'var(--gold)';
    badgeEl.style.borderColor = role.color || 'var(--gold)';
    badgeEl.style.background  = (role.color || '#C9A84C') + '18';
  }

  banner.style.display = 'flex';
}

// Returns the array of category names the current user is allowed to access,
// or null if the user has unrestricted access (مدير, or no allowedCats set, or no logged-in user).
function _currentAllowedCats() {
  if (!_curUser || !_curUser.username) return null;
  if (_curUser.username === 'admin') return null;
  const session = _loadRbacSession();
  if (!session) return null;
  const roles = _loadRoles();
  const perms = _getEffectivePerms(session, roles);
  if (perms.includes('*')) return null; // full access
  if (typeof editorsData === 'undefined' || !editorsData) return null;
  const ed = editorsData.find(e => e.user === _curUser.username);
  if (!ed) return null;
  if (!Array.isArray(ed.allowedCats) || !ed.allowedCats.length) return null;
  return ed.allowedCats;
}

// ─── INIT ─────────────────────────────────────────────────────
function initDashboard() {
  loadAll();
  _syncEditorPasswords();
  refreshNewsCatDropdown();
  renderCats();
  renderEditors();
  renderLatest();
  renderBreaking();
  renderNewsTable(newsData);
  buildChart();
  refreshAuthorSelect();
  loadPageControls();
  loadAdBanners();
  loadStatsBar();
  renderNavMenuEditor();
  _startInboxListener();
  // Update approval queue badge on load
  setTimeout(_updateApprovalBadge, 500);
  if (localStorage.getItem('atq_admin_theme') === 'light') {
    document.body.classList.add('light');
    const btn = document.getElementById('admin-theme-btn');
    if (btn) btn.textContent = '🌙 داكن';
  }
}

// ─── NAV ──────────────────────────────────────────────────────
const PAGE_TITLES = {
  overview:            ['نظرة عامة',              'مرحباً بك في لوحة تحكم الأحداث التقنية'],
  news:                ['إدارة الأخبار',           'إضافة وتعديل وحذف الأخبار'],
  'approval-queue':    ['قائمة الاعتماد',         'المقالات المقدمة للمراجعة والنشر'],
  categories:          ['الأقسام والتصنيفات',      'إدارة أقسام الموقع'],
  latest:              ['شريط آخر الأخبار',        'النصوص التي تظهر في الشريط الذهبي'],
  breaking:            ['شريط الأخبار العاجلة',    'الشريط الأحمر — تفعيل وإيقاف'],
  pagecontrols:        ['تحكم في الصفحة',          'تفعيل وإيقاف عناصر الصفحة الرئيسية'],
  'general-settings':  ['التعليقات والتفاعل',      'التعليقات وأزرار التفاعل مع المقالات'],
  identity:            ['الهوية والتخطيط',         'الشعار، اسم الموقع، القائمة الرئيسية، وأبعاد الخبر الرئيسي'],
  editors:             ['إدارة المستخدمين',        'إضافة وإدارة المستخدمين والصلاحيات'],
  settings:            ['إعدادات النظام',           'الإعدادات العامة وكلمة المرور'],
  'footer-control':    ['إدارة الفوتر',            'تحكم كامل في عناصر الفوتر'],
  'ads-manager':       ['إدارة الإعلانات',         'تفعيل وتخصيص جميع البانرات الإعلانية'],
  'nav-links-manager': ['روابط القائمة الرئيسية',  'إدارة روابط شريط التنقل العلوي'],
  analytics:           ['إحصائيات المحتوى',        'تحليل أداء الأخبار والمحررين والمشتركين'],
  subscribers:         ['المشتركون',               'قائمة بريد المشتركين في النشرة الإخبارية'],
  inbox:               ['صندوق الرسائل',           'رسائل الزوار من نموذج تواصل معنا'],
};

function showPage(id, el) {
  // RBAC access check — block navigation to forbidden pages
  const isAdmin = !_curUser || _curUser.username === 'admin';
  if (!isAdmin) {
    const allowed = _getRbacAllowedPages();
    if (allowed !== null && !allowed.includes(id)) {
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
  if (id === 'approval-queue') renderApprovalQueue();
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
  // RBAC check for restricted sub-tabs
  if (tab === 'ai-news' && !_hasPerm('ai_generate') && !_hasPerm('approve_articles')) {
    showToast('🚫 ليس لديك صلاحية الوصول إلى هذه الأداة');
    return;
  }
  if (tab === 'fetch-news' && !_hasPerm('import_articles') && !_hasPerm('approve_articles')) {
    showToast('🚫 ليس لديك صلاحية الوصول إلى هذه الأداة');
    return;
  }

  // Ensure page-news is active
  const newsPage = document.getElementById('page-news');
  if (newsPage && !newsPage.classList.contains('active')) {
    showPage('news', document.querySelector('.nav-item[data-page="news"]'));
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
  const emptyState = document.getElementById('news-empty-state');

  // ── Ownership scoping: writers only see own articles ───────
  const session = _loadRbacSession();
  const canSeeAll = !session || _hasPerm('edit_any_article') || _hasPerm('view_analytics');
  if (!canSeeAll && _curUser) {
    data = data.filter(n =>
      n.author === _curUser.name ||
      n.createdBy === (_curUser.username || _curUser.name)
    );
  }

  // ── Category restriction ────────────────────────────────────
  const allowedCats = _currentAllowedCats();
  if (allowedCats) {
    data = data.filter(n => allowedCats.indexOf(n.cat) !== -1);
  }

  const countEl = document.getElementById('news-count');
  if (countEl) countEl.textContent = `(${data.length} أخبار)`;
  if (!data.length) {
    if (tbody) tbody.innerHTML = '';
    if (emptyState) {
      emptyState.style.display = 'block';
      const hint = document.getElementById('news-empty-hint');
      if (hint) hint.textContent = _hasPerm('add_articles')
        ? 'ابدأ بإضافة أول خبر'
        : 'لا توجد أخبار في الوقت الحالي';
    }
    return;
  }
  if (emptyState) emptyState.style.display = 'none';
  const latestTitles   = new Set(latestData.map(l=>l.text));
  const breakingTitles = new Set(breakingData.map(b=>b.text));
  const pinnedId = localStorage.getItem('atq_wide_pinned');

  // Group news by week
  function getWeekLabel(dateStr) {
    if (!dateStr) return 'بدون تاريخ';
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

  const _canEdit   = _hasPerm('edit_articles');
  const _canDel    = _hasPerm('delete_articles');
  const _canTicker = _hasPerm('manage_ticker');
  const _canBreak  = _hasPerm('manage_breaking');
  const _canPin    = _hasPerm('manage_homepage') || _hasPerm('manage_identity');

  let html = '';
  Object.entries(grouped).forEach(([week, items]) => {
    html += `<tr><td colspan="7" style="background:rgba(201,168,76,0.06);padding:8px 20px;font-size:12px;font-weight:700;color:var(--gold);letter-spacing:0.5px;border-bottom:1px solid var(--border-dim)">${week} — ${items.length} أخبار</td></tr>`;

    html += items.map(n => {
      const badge = n.priority==='عاجل'
        ? '<span style="color:var(--red);font-size:10px;margin-left:4px">● عاجل</span>'
        : n.priority==='مميز'
        ? '<span style="color:var(--gold);font-size:10px;margin-left:4px">★ مميز</span>' : '';

      // ── Full workflow status badge ─────────────────────────
      const wf = NEWS_WORKFLOW[n.status] || NEWS_WORKFLOW['مسودة'];
      const statusBadge = `<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:${wf.bg};color:${wf.color};white-space:nowrap">${wf.icon} ${wf.label}</span>`;

      // ── Review note tooltip if present ─────────────────────
      const reviewTooltip = n.reviewNote
        ? `<div title="${n.reviewNote}" style="font-size:10px;color:var(--orange);margin-top:2px;cursor:help;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px">💬 ${n.reviewNote}</div>`
        : '';

      // ── Audit info ─────────────────────────────────────────
      const auditInfo = n.publishedBy
        ? `<div style="font-size:10px;color:var(--text-dim)">نشر: ${n.publishedBy}</div>`
        : n.createdBy ? `<div style="font-size:10px;color:var(--text-dim)">أنشأ: ${n.createdBy}</div>` : '';

      const inLatest   = latestTitles.has(n.title);
      const inBreaking = breakingTitles.has(n.title);
      const isPinned   = String(n.id) === pinnedId;

      // Ownership-aware edit button — respects status lock
      const canEditThis = _canEdit && _canEditArticle(n);
      // For own articles that are locked: show lock icon instead of edit button
      const isOwnButLocked = !_hasPerm('edit_any_article') && !canEditThis && (() => {
        const session = _loadRbacSession();
        const myName = _curUser ? _curUser.name : session?.name;
        return (n.author === myName || n.createdBy === session?.username) && WRITER_LOCKED_STATUSES.includes(n.status);
      })();

      const latestBtn = !_canTicker ? '' : inLatest
        ? `<button class="btn-view" onclick="removeFromLatestByTitle(${n.id})" style="background:rgba(201,168,76,0.15);color:var(--gold);border-color:rgba(201,168,76,0.4);font-size:11px" title="موجود في الشريط — اضغط للإزالة">📰 ✓</button>`
        : `<button class="btn-view" onclick="addNewsToLatest(${n.id})" style="background:rgba(201,168,76,0.07);color:var(--gold);border-color:rgba(201,168,76,0.2);font-size:11px">📰</button>`;

      const breakBtn = !_canBreak ? '' : inBreaking
        ? `<button class="btn-view" onclick="removeFromBreakingByTitle(${n.id})" style="background:rgba(255,82,82,0.15);color:#FF7070;border-color:rgba(255,82,82,0.4);font-size:11px" title="موجود في العاجل">⚡ ✓</button>`
        : `<button class="btn-view" onclick="addNewsToBreaking(${n.id})" style="background:rgba(255,82,82,0.07);color:#FF7070;border-color:rgba(255,82,82,0.2);font-size:11px">⚡</button>`;

      const pinBtn = !_canPin ? '' : isPinned
        ? `<button class="btn-view" onclick="unpinWide()" style="background:rgba(74,158,255,0.15);color:#6BB5FF;border-color:rgba(74,158,255,0.4);font-size:11px" title="مثبت — اضغط لإلغاء">📌 ✓</button>`
        : `<button class="btn-view" onclick="pinToWide(${n.id})" style="background:rgba(74,158,255,0.07);color:#6BB5FF;border-color:rgba(74,158,255,0.2);font-size:11px">📌</button>`;

      const commentBtn = n.commentsEnabled === false
        ? `<button class="btn-view" onclick="toggleNewsComments(${n.id})" style="font-size:11px;background:rgba(255,82,82,0.08);color:#FF7070;border-color:rgba(255,82,82,0.2)" title="تعليقات مغلقة">💬✗</button>`
        : `<button class="btn-view" onclick="toggleNewsComments(${n.id})" style="font-size:11px;background:rgba(61,220,132,0.08);color:#3DDC84;border-color:rgba(61,220,132,0.2)" title="تعليقات مفعّلة">💬✓</button>`;

      const editBtn = canEditThis
        ? `<button class="btn-edit" onclick="editNews(${n.id})" style="font-size:11px">✏️</button>`
        : isOwnButLocked
        ? `<span title="${NEWS_WORKFLOW[n.status]?.label || n.status} — المقال مقفل" style="font-size:13px;cursor:default;opacity:0.5;padding:5px">🔒</span>`
        : '';
      const delBtn  = _canDel    ? `<button class="btn-del"  onclick="askDelete('news',${n.id},'الخبر')" style="font-size:11px">🗑</button>` : '';

      // Quick-approve button for reviewers (supervisor/editor+)
      const canApprove = _hasPerm('approve_articles');
      const quickApproveBtn = canApprove && ['مقدم','قيد المراجعة'].includes(n.status)
        ? `<button class="btn-approve" onclick="quickSetStatus(${n.id},'معتمد')" style="font-size:11px;padding:5px 8px" title="اعتماد سريع">✅</button>`
        : '';
      const quickPublishBtn = _hasPerm('publish_articles') && n.status === 'معتمد'
        ? `<button class="btn-approve" onclick="quickSetStatus(${n.id},'منشور')" style="font-size:11px;padding:5px 8px;background:rgba(61,220,132,0.15);color:var(--green);border-color:rgba(61,220,132,0.3)" title="نشر سريع">🌐</button>`
        : '';
      const quickRejectBtn = _hasPerm('review_articles') && PENDING_STATUSES.includes(n.status)
        ? `<button class="btn-del" onclick="quickSetStatus(${n.id},'يحتاج تعديل')" style="font-size:11px;padding:5px 8px" title="إرجاع للتعديل">↩️</button>`
        : '';

      return `<tr>
        <td>
          <div class="td-title">${badge}${n.title}</div>
          ${auditInfo}
        </td>
        <td>${n.cat}</td>
        <td style="font-size:12px">${n.author}</td>
        <td style="color:var(--text-dim);font-size:11px">${n.date}</td>
        <td style="font-size:11px">${n.views||'٠'}</td>
        <td>
          ${statusBadge}
          ${reviewTooltip}
        </td>
        <td>
          <div class="actions" style="flex-wrap:wrap;gap:3px">
            ${editBtn}${quickApproveBtn}${quickPublishBtn}${quickRejectBtn}${latestBtn}${breakBtn}${pinBtn}${commentBtn}${delBtn}
          </div>
        </td>
      </tr>`;
    }).join('');
  });
  tbody.innerHTML = html;
  // Update approval queue badge after rendering
  _updateApprovalBadge();
}

function filterNews(q) {
  // Read search input
  const search = (typeof q === 'string' ? q : document.querySelector('#news-sub-main .search-input')?.value || '').toLowerCase().trim();
  // Read category dropdown (new named id)
  const catSel = document.getElementById('news-filter-cat') || document.querySelector('#news-sub-main .filter-select');
  const cat = catSel ? catSel.value : '';
  // Read status dropdown (new named id)
  const statSel = document.getElementById('news-filter-status') || document.querySelectorAll('#news-sub-main .filter-select')[1];
  const stat = statSel ? statSel.value : '';

  let filtered = newsData;
  if (search) filtered = filtered.filter(n => n.title.toLowerCase().includes(search)||n.cat.includes(search)||n.author.toLowerCase().includes(search));
  if (cat && cat !== '' && cat !== 'كل الأقسام') filtered = filtered.filter(n => n.cat === cat);
  if (stat && stat !== 'كل الحالات') filtered = filtered.filter(n => n.status === stat);
  renderNewsTable(filtered);
}

// ── Quick status change from table row (no modal needed) ────────
function quickSetStatus(id, targetStatus) {
  const n = newsData.find(x => x.id === id);
  if (!n) return;
  // RBAC: check ownership + permission to set this status
  if (!_canSetStatus(n, targetStatus)) {
    showToast('🚫 ليس لديك صلاحية تغيير هذه الحالة'); return;
  }
  // Writers cannot approve/publish own articles
  if (['معتمد','منشور'].includes(targetStatus) && !_hasPerm('approve_articles')) {
    showToast('🚫 لا يمكنك نشر أو اعتماد مقالك بنفسك'); return;
  }
  const prevStatus = n.status;
  const action = targetStatus === 'منشور' ? 'publish' : targetStatus === 'معتمد' ? 'approve'
    : targetStatus === 'مرفوض' ? 'reject' : 'edit';
  n.status = targetStatus;
  _auditStamp(n, action);
  _fbSetNews(n);
  saveAll();
  renderNewsTable(newsData);
  renderApprovalQueue();
  _updateApprovalBadge();
  const wf = NEWS_WORKFLOW[targetStatus] || {};
  showToast(`${wf.icon || '✅'} تم تغيير الحالة إلى: ${wf.label || targetStatus}`);
}
window.quickSetStatus = quickSetStatus;

// ── Update approval queue badge count ─────────────────────────
function _updateApprovalBadge() {
  const pending = newsData.filter(n => PENDING_STATUSES.includes(n.status));
  const badge = document.getElementById('approval-queue-badge');
  const navBadge = document.getElementById('news-pending-badge');
  const totalPending = pending.length;
  if (badge) {
    badge.textContent = totalPending;
    badge.style.display = totalPending > 0 ? 'inline' : 'none';
  }
  if (navBadge) {
    navBadge.textContent = totalPending > 0 ? totalPending : '!';
    navBadge.style.display = totalPending > 0 ? 'inline' : 'none';
  }
}

// ── Render the approval queue page ────────────────────────────
function renderApprovalQueue() {
  if (!_hasPerm('review_articles') && !_hasPerm('approve_articles')) return;

  const filterStatus = document.getElementById('aq-filter-status')?.value || '';
  // Determine what this user can see
  const canSeeAll = _hasPerm('edit_any_article');
  let queue = newsData.filter(n => {
    // All workflow statuses except منشور and مسودة belong in queue
    const inQueue = Object.keys(NEWS_WORKFLOW).filter(s => !['منشور','مسودة'].includes(s));
    if (!inQueue.includes(n.status)) return false;
    if (filterStatus && n.status !== filterStatus) return false;
    // Supervisors only see articles from their team (simplified: own cats or all)
    const allowedCats = _currentAllowedCats();
    if (allowedCats && !allowedCats.includes(n.cat)) return false;
    return true;
  });

  // Sort: pending first, then by submission time (newest first)
  queue.sort((a, b) => {
    const priorityOrder = ['مقدم','قيد المراجعة','يحتاج تعديل','معتمد','مجدول','مرفوض','مؤرشف'];
    const ai = priorityOrder.indexOf(a.status);
    const bi = priorityOrder.indexOf(b.status);
    if (ai !== bi) return ai - bi;
    return (Number(b.id)||0) - (Number(a.id)||0);
  });

  // Update stat counters
  const counts = { 'مقدم':0, 'قيد المراجعة':0, 'يحتاج تعديل':0, 'معتمد':0, 'مرفوض':0 };
  newsData.forEach(n => { if (counts[n.status] !== undefined) counts[n.status]++; });
  const setCount = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setCount('aq-count-submitted',  counts['مقدم']);
  setCount('aq-count-reviewing',  counts['قيد المراجعة']);
  setCount('aq-count-revision',   counts['يحتاج تعديل']);
  setCount('aq-count-approved',   counts['معتمد']);
  setCount('aq-count-rejected',   counts['مرفوض']);

  const list  = document.getElementById('approval-queue-list');
  const empty = document.getElementById('approval-queue-empty');
  if (!list) return;

  if (!queue.length) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  list.innerHTML = queue.map(n => {
    const wf = NEWS_WORKFLOW[n.status] || {};
    const canApprove = _hasPerm('approve_articles');
    const canReview  = _hasPerm('review_articles');
    const canPublish = _hasPerm('publish_articles');
    const canEditThis = _canEditArticle(n);

    // Time waiting calculation
    const submittedAt = n.submittedAt || n.createdAt || '';
    let timeWaiting = '';
    if (submittedAt) {
      const mins = Math.floor((Date.now() - new Date(submittedAt).getTime()) / 60000);
      timeWaiting = mins < 60 ? `منذ ${mins} دقيقة`
        : mins < 1440 ? `منذ ${Math.floor(mins/60)} ساعة`
        : `منذ ${Math.floor(mins/1440)} يوم`;
    }

    // Action buttons based on status + role
    let actionBtns = '';
    if (['مقدم','قيد المراجعة'].includes(n.status)) {
      if (n.status === 'مقدم' && canReview) {
        actionBtns += `<button class="btn-view" onclick="quickSetStatus(${n.id},'قيد المراجعة')" style="font-size:12px;padding:6px 12px;color:var(--accent);border-color:rgba(74,158,255,0.3)">🔍 بدء المراجعة</button>`;
      }
      if (canApprove) {
        actionBtns += `<button class="btn-approve" onclick="quickSetStatus(${n.id},'معتمد')" style="font-size:12px;padding:6px 12px">✅ اعتماد</button>`;
      }
      if (canReview) {
        actionBtns += `<button class="btn-secondary" onclick="quickSetStatus(${n.id},'يحتاج تعديل')" style="font-size:12px;padding:6px 12px;color:var(--orange);border-color:rgba(255,154,60,0.3)">↩️ إرجاع للتعديل</button>`;
        actionBtns += `<button class="btn-del" onclick="quickSetStatus(${n.id},'مرفوض')" style="font-size:12px;padding:6px 12px">❌ رفض</button>`;
      }
    }
    if (n.status === 'معتمد' && canPublish) {
      actionBtns += `<button class="btn-approve" onclick="quickSetStatus(${n.id},'منشور')" style="font-size:12px;padding:6px 12px;background:rgba(61,220,132,0.15);color:var(--green);border-color:rgba(61,220,132,0.3)">🌐 نشر</button>`;
    }
    if (canEditThis) {
      actionBtns += `<button class="btn-edit" onclick="editNews(${n.id})" style="font-size:12px;padding:6px 12px">✏️ تعديل</button>`;
    }

    // Review note display
    const reviewNoteHtml = n.reviewNote
      ? `<div style="background:rgba(255,154,60,0.08);border:1px solid rgba(255,154,60,0.2);border-radius:8px;padding:8px 12px;margin-top:8px;font-size:12px;color:var(--orange)">💬 ملاحظة المراجع: ${n.reviewNote}</div>`
      : '';

    // Audit trail mini-view
    const lastAudit = n.audit && n.audit[0]
      ? `<span style="font-size:11px;color:var(--text-dim)">${n.audit[0].who} · ${new Date(n.audit[0].ts).toLocaleString('ar-EG',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>`
      : '';

    return `<div style="background:var(--dark-3);border:1px solid ${wf.color ? wf.color + '44' : 'var(--border-dim)'};border-radius:14px;padding:18px;transition:.15s">
      <div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
            <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${wf.bg};color:${wf.color};white-space:nowrap">${wf.icon} ${wf.label}</span>
            ${n.priority === 'عاجل' ? '<span style="font-size:10px;color:var(--red);font-weight:700">● عاجل</span>' : ''}
          </div>
          <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:4px;line-height:1.4">${n.title}</div>
          <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--text-dim)">
            <span>✍️ ${n.author}</span>
            <span>📂 ${n.cat}</span>
            ${timeWaiting ? `<span>⏱ ${timeWaiting}</span>` : ''}
            ${lastAudit}
          </div>
          ${reviewNoteHtml}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;flex-shrink:0">
          ${actionBtns}
        </div>
      </div>
    </div>`;
  }).join('');
}
window.renderApprovalQueue = renderApprovalQueue;

function resetNewsForm() {
  ['n-title','n-excerpt','n-content','n-thumbnail','n-photo-url'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value='';
  });
  excerptSetContent('');
  document.getElementById('n-thumb-preview').innerHTML = '🖼';
  const catEl = document.getElementById('n-cat'); if(catEl) catEl.value='';
  const ncEl2 = document.getElementById('n-nav-cat'); if(ncEl2) ncEl2.value='';
  const trEl2 = document.getElementById('n-trending'); if(trEl2) trEl2.checked=false;
  const prEl  = document.getElementById('n-priority'); if(prEl) prEl.value='عادي';
  // Reset "also in" section checkboxes
  ['n-also-trending','n-also-featured','n-also-breaking','n-also-hero'].forEach(id => {
    const el = document.getElementById(id); if (el) el.checked = false;
  });
  // Reset metadata-visibility toggles
  ['n-show-author','n-show-date','n-show-views'].forEach(id => {
    const el = document.getElementById(id); if (el) el.checked = true;
  });
  // Reset review note + schedule
  const rnEl = document.getElementById('n-review-note'); if(rnEl) rnEl.value='';
  const sdEl = document.getElementById('n-schedule-date'); if(sdEl) sdEl.value='';
  const rnGrp = document.getElementById('n-review-note-group'); if(rnGrp) rnGrp.style.display='none';
  const sdGrp = document.getElementById('n-schedule-group');   if(sdGrp) sdGrp.style.display='none';

  document.getElementById('news-edit-id').value = '';
  document.getElementById('news-modal-title').textContent = 'إضافة خبر جديد';
  rteSetContent('');

  // ── RBAC: auto-assign author for writers ──────────────────
  // Writers can only write as themselves — pre-fill and lock the author field
  refreshAuthorSelect(); // this will lock the select for writers automatically
  // If writer, force their name as author value
  if (!_hasPerm('edit_any_article') && _curUser && _curUser.name) {
    const authorSel = document.getElementById('n-author');
    if (authorSel) authorSel.value = _curUser.name;
  }

  // ── RBAC: set safe default status by role ──────────────────
  _populateStatusDropdown(null);
  const stEl = document.getElementById('n-status');
  if (stEl) {
    const defaultStatus = _hasPerm('publish_articles') ? 'منشور' : 'مسودة';
    stEl.value = defaultStatus;
  }

  // ── Setup modal buttons for new article ────────────────────
  _setupNewsModalButtons(null);
}

// ── saveNewsAs — saves with a specific target status (workflow shortcut buttons) ──
function saveNewsAs(targetStatus) {
  const statusEl = document.getElementById('n-status');
  if (statusEl) statusEl.value = targetStatus;
  saveNews();
}
window.saveNewsAs = saveNewsAs;

function saveNews() {
  const title = document.getElementById('n-title').value.trim();
  const cat   = document.getElementById('n-cat').value;
  if (!title || !cat) { showToast('⚠️ الرجاء تعبئة العنوان والقسم'); return; }

  // ── RBAC check 1: must have add or edit permission ─────────
  if (!_hasPerm('add_articles') && !_hasPerm('edit_articles')) {
    showToast('🚫 ليس لديك صلاحية حفظ الأخبار'); return;
  }

  const eid = document.getElementById('news-edit-id').value;

  // ── RBAC check 2: editing requires ownership or edit_any_article ──
  if (eid) {
    const existing = newsData.find(n => n.id == eid);
    if (existing) {
      // Ownership check
      if (!_hasPerm('edit_any_article')) {
        const session = _loadRbacSession();
        const myName  = _curUser ? _curUser.name : session?.name;
        const isOwn   = existing.author === myName || existing.createdBy === session?.username;

        if (!isOwn) {
          showToast('🚫 لا يمكنك تعديل مقالات الآخرين');
          return;
        }
        // Status lock check (prevents bypassing via direct JS call)
        if (WRITER_LOCKED_STATUSES.includes(existing.status)) {
          showToast('🔒 لا يمكن تعديل المقال في حالته الحالية');
          return;
        }
      }
    }
  }

  const requestedStatus = document.getElementById('n-status').value;

  // ── RBAC check 3: enforce status permissions ───────────────
  const existingForStatus = eid ? newsData.find(n => n.id == eid) : null;
  const dummyArticle = existingForStatus || { author: _curUser ? _curUser.name : '' };
  if (!_canSetStatus(dummyArticle, requestedStatus)) {
    showToast('🚫 ليس لديك صلاحية تعيين هذه الحالة');
    // Force to safe status for role
    const safeStatus = _hasPerm('publish_articles') ? requestedStatus : 'مسودة';
    document.getElementById('n-status').value = safeStatus;
    return;
  }

  // ── RBAC check 4: writers cannot self-approve ─────────────
  if (['معتمد','منشور'].includes(requestedStatus) && !_hasPerm('approve_articles')) {
    showToast('🚫 لا يمكنك نشر أو اعتماد مقالك بنفسك');
    document.getElementById('n-status').value = 'مقدم';
    return;
  }

  const priority = document.getElementById('n-priority').value;
  const chk = id => { const el = document.getElementById(id); return !!(el && el.checked); };
  const obj = {
    title, cat,
    author:     document.getElementById('n-author').value,
    date:       new Date().toLocaleDateString('ar-EG',{year:'numeric',month:'2-digit',day:'2-digit'}),
    views:      '٠',
    status:     requestedStatus,
    priority:   priority,
    excerpt:    excerptGetContent(),
    content:    rteGetContent(),
    thumbnail:  document.getElementById('n-thumbnail').value,
    navCat:     document.getElementById('n-nav-cat')?.value || '',
    // Review note (supervisor feedback to writer)
    reviewNote: document.getElementById('n-review-note')?.value || '',
    // Scheduled date
    scheduledAt:document.getElementById('n-schedule-date')?.value || '',
    // Back-compat boolean flags
    trending:   priority === 'trending' || chk('n-also-trending'),
    featured:   priority === 'ابرز المقالات' || chk('n-also-featured'),
    alsoTrending: chk('n-also-trending'),
    alsoFeatured: chk('n-also-featured'),
    alsoBreaking: chk('n-also-breaking'),
    alsoHero:     chk('n-also-hero'),
    showAuthor:   chk('n-show-author'),
    showDate:     chk('n-show-date'),
    showViews:    chk('n-show-views'),
  };

  if (eid) {
    const idx = newsData.findIndex(n => n.id == eid);
    if (idx !== -1) {
      obj.date   = newsData[idx].date || obj.date;
      obj.views  = newsData[idx].views || obj.views;
      obj.audit  = newsData[idx].audit || [];
      obj.createdBy  = newsData[idx].createdBy;
      obj.createdAt  = newsData[idx].createdAt;
      // Determine audit action by status change
      const prevStatus = newsData[idx].status;
      const action = requestedStatus === 'منشور' ? 'publish'
        : requestedStatus === 'معتمد' ? 'approve'
        : requestedStatus === 'مرفوض' ? 'reject'
        : requestedStatus === 'مقدم'  ? 'submit'
        : 'edit';
      _auditStamp(obj, action);
      newsData[idx] = {...newsData[idx], ...obj};
      obj.id = newsData[idx].id;
      // If status changed to pending, show in approval queue
      if (PENDING_STATUSES.includes(requestedStatus) && !PENDING_STATUSES.includes(prevStatus)) {
        _updateApprovalBadge();
        showToast('📨 تم تقديم المقال للمراجعة');
      } else {
        showToast('✅ تم تحديث الخبر');
      }
    }
    _fbSetNews(newsData[newsData.findIndex(n => n.id == obj.id || n.id == eid)]);
  } else {
    obj.id = Date.now();
    _auditStamp(obj, requestedStatus === 'مقدم' ? 'submit' : 'create');
    newsData.unshift(obj);
    _fbSetNews(obj);
    if (requestedStatus === 'مقدم') {
      _updateApprovalBadge();
      showToast('📨 تم تقديم المقال للمراجعة');
    } else {
      showToast('✅ تم إضافة الخبر');
    }
  }
  renderNewsTable(newsData);
  saveAll();
  closeModal('news-modal');
  // Refresh approval queue if visible
  const aqPage = document.getElementById('page-approval-queue');
  if (aqPage && aqPage.classList.contains('active')) renderApprovalQueue();
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

  // ── RBAC: ownership check ──────────────────────────────────
  if (!_hasPerm('edit_any_article')) {
    // Writer/supervisor: check ownership first
    const session = _loadRbacSession();
    const myName  = _curUser ? _curUser.name : session?.name;
    const isOwn   = n.author === myName || n.createdBy === session?.username;

    if (!isOwn) {
      showToast('🚫 لا يمكنك تعديل مقالات الآخرين');
      return;
    }

    // ── Status lock: writer cannot edit once locked ──────────
    if (WRITER_LOCKED_STATUSES.includes(n.status)) {
      const wf = NEWS_WORKFLOW[n.status] || {};
      const lockMessages = {
        'قيد المراجعة': '🔍 المقال قيد المراجعة حالياً — لا يمكن تعديله حتى يُرجعه المراجع',
        'معتمد':        '✅ المقال معتمد — لا يمكن تعديله بعد الاعتماد',
        'مجدول':        '🗓 المقال مجدول للنشر — لا يمكن تعديله',
        'منشور':        '🌐 المقال منشور — لا يمكن تعديله بعد النشر',
      };
      showToast(lockMessages[n.status] || `🔒 لا يمكن تعديل المقال في حالة: ${wf.label || n.status}`);
      return;
    }
  }

  document.getElementById('news-edit-id').value  = id;
  document.getElementById('n-title').value       = n.title;
  const catEl = document.getElementById('n-cat'); if(catEl) catEl.value = n.cat;
  document.getElementById('n-author').value      = n.author;

  // ── RBAC: lock author field for writers ───────────────────
  // Writers can only write under their own name — refresh then re-set
  refreshAuthorSelect();
  document.getElementById('n-author').value = n.author; // re-assert after refresh
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

  // ── Populate status dropdown filtered to allowed statuses ──
  _populateStatusDropdown(n);

  // ── Load review note ───────────────────────────────────────
  const reviewNoteEl = document.getElementById('n-review-note');
  if (reviewNoteEl) reviewNoteEl.value = n.reviewNote || '';
  _toggleReviewNoteField(n.status);

  // ── Load scheduled date ────────────────────────────────────
  const schedEl = document.getElementById('n-schedule-date');
  if (schedEl) schedEl.value = n.scheduledAt || '';

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

  // ── Show audit trail in modal title tooltip ────────────────
  const auditInfo = n.audit && n.audit.length
    ? ` — آخر تعديل: ${n.audit[0].who}`
    : '';
  document.getElementById('news-modal-title').textContent = 'تعديل الخبر' + auditInfo;

  // ── Configure modal action buttons per role ─────────────────
  _setupNewsModalButtons(n);

  openModal('news-modal');
}

// ── Populate status dropdown filtered by what this user can set ──
function _populateStatusDropdown(existingArticle) {
  const sel = document.getElementById('n-status');
  if (!sel) return;
  const allowed = _getAllowedStatuses();
  const current = existingArticle ? existingArticle.status : 'مسودة';
  // Always include current status even if not in allowed (can't change it, but can see it)
  const options = Object.entries(NEWS_WORKFLOW).filter(([s]) =>
    allowed.includes(s) || s === current
  );
  sel.innerHTML = options.map(([s, def]) =>
    `<option value="${s}" ${s === current ? 'selected' : ''} ${!allowed.includes(s) ? 'disabled style="color:var(--text-dim)"' : ''}>${def.icon} ${def.label}</option>`
  ).join('');
}

// ── Show/hide review note field based on status ──
function _toggleReviewNoteField(status) {
  const group = document.getElementById('n-review-note-group');
  const label = document.getElementById('n-review-note-label');
  if (!group) return;
  if (['يحتاج تعديل','مرفوض'].includes(status)) {
    group.style.display = 'block';
    if (label) label.textContent = status === 'مرفوض' ? '📝 سبب الرفض' : '📝 ملاحظات التعديل المطلوب';
  } else {
    group.style.display = 'none';
  }
}

// ── Configure action buttons in modal footer based on role + article state ──
function _setupNewsModalButtons(article) {
  const isNew = !article;
  const status = article ? article.status : 'مسودة';
  const canPublish  = _hasPerm('publish_articles');
  const canApprove  = _hasPerm('approve_articles');
  const canReview   = _hasPerm('review_articles');
  const canSubmit   = _hasPerm('add_articles') || _hasPerm('edit_articles');
  const isOwnArticle= !article || _canEditArticle(article);

  // Default save button — always present for editing
  const saveBtn    = document.getElementById('n-save-btn');
  const draftBtn   = document.getElementById('n-draft-btn');
  const submitBtn  = document.getElementById('n-submit-btn');
  const reviseBtn  = document.getElementById('n-revise-btn');
  const approveBtn = document.getElementById('n-approve-btn');
  const publishBtn = document.getElementById('n-publish-btn');

  // Hide all special buttons first
  [draftBtn, submitBtn, reviseBtn, approveBtn, publishBtn].forEach(b => { if(b) b.style.display='none'; });
  if (saveBtn) saveBtn.style.display = '';

  if (!canPublish && !canApprove) {
    // Writer / Viewer — show draft + submit
    if (saveBtn) saveBtn.style.display = 'none';
    if (draftBtn)  draftBtn.style.display  = '';
    if (submitBtn) submitBtn.style.display = '';
  } else if (canReview && !canPublish) {
    // Supervisor — show save + revise
    if (reviseBtn) reviseBtn.style.display = '';
  } else if (canApprove && canPublish) {
    // Editor / Admin / Manager — full controls
    if (reviseBtn)  reviseBtn.style.display  = '';
    if (approveBtn) approveBtn.style.display = '';
    if (publishBtn) publishBtn.style.display = '';
    if (saveBtn)    saveBtn.style.display    = 'none'; // replaced by publishBtn
  }

  // Toggle review/schedule fields based on current status
  const statusSel = document.getElementById('n-status');
  if (statusSel) {
    statusSel.onchange = () => {
      _toggleReviewNoteField(statusSel.value);
      const schedGrp = document.getElementById('n-schedule-group');
      if (schedGrp) schedGrp.style.display = statusSel.value === 'مجدول' ? 'block' : 'none';
    };
    // Initial toggle
    const schedGrp = document.getElementById('n-schedule-group');
    if (schedGrp) schedGrp.style.display = status === 'مجدول' ? 'block' : 'none';
  }
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
  const opts = '<option value="">اختر القسم *</option>' +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
  sel.innerHTML = opts;
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
  // Also update the news list category filter select
  const filterSel = document.getElementById('news-filter-cat');
  if (filterSel) {
    const filterCur = filterSel.value;
    filterSel.innerHTML = '<option value="">كل الأقسام</option>' +
      cats.map(c => `<option value="${c}">${c}</option>`).join('');
    if (filterCur) filterSel.value = filterCur;
  }
}

function renderCats() {
  refreshNewsCatDropdown(); // sync news modal dropdown with current categories
  const _canEdit = _hasPerm('manage_cats');
  document.getElementById('cats-grid').innerHTML = catsData.map(c => `
    <div class="cat-card">
      <div style="position:absolute;top:0;right:0;width:4px;height:100%;background:${c.color};border-radius:0 14px 14px 0"></div>
      <div class="cat-card-header">
        <div class="cat-icon" style="background:${c.color}22">${c.icon}</div>
        <div><div class="cat-name">${c.name}</div><div class="cat-slug">/${c.slug}</div></div>
      </div>
      <div class="cat-stats"><div class="cat-stat"><strong>${c.articles}</strong> مقال</div></div>
      <div class="cat-actions">
        ${_canEdit ? `<button class="btn-edit" onclick="editCat(${c.id})">✏️ تعديل</button>
        <button class="btn-del"  onclick="askDelete('cat',${c.id},'${c.name}')">🗑 حذف</button>` : ''}
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
  const container = document.getElementById('latest-list');
  if (!container) return;
  const sorted = [...latestData].sort((a, b) => Number(b.id) - Number(a.id));
  const active  = sorted.filter(l => l.status === 'نشط');
  document.getElementById('latest-count').textContent = `${latestData.length} نص — ${active.length} نشط`;
  if (!sorted.length) {
    container.innerHTML = '<div style="padding:28px;text-align:center;color:var(--text-dim);font-size:13px">🗞️ لا توجد نصوص بعد</div>';
    return;
  }
  const B = 'display:inline-flex;align-items:center;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;padding:3px 10px;border:1px solid;background:none;transition:.15s;';
  container.innerHTML = sorted.map(l => {
    const on  = l.status === 'نشط';
    const dot = `<span style="width:8px;height:8px;border-radius:50%;background:${on ? '#3DDC84' : 'var(--text-dim)'};flex-shrink:0;display:inline-block"></span>`;
    const togStyle = on ? `color:#FF7070;border-color:rgba(255,82,82,0.35);${B}` : `color:#3DDC84;border-color:rgba(61,220,132,0.35);${B}`;
    const safeText = (l.text||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid var(--border-dim)">
      ${dot}
      <span style="flex:1;font-size:13px;color:var(--text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis" title="${safeText}">${l.text}</span>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <button style="${togStyle}" onmousedown="return false;" onclick="toggleLatest(${l.id})" title="${on ? 'إيقاف' : 'تفعيل'}">${on ? '⏸' : '▶'}</button>
        <button style="color:var(--text-muted);border-color:var(--border-dim);${B}" onmousedown="return false;" onclick="editLatest(${l.id})" title="تعديل">✏️</button>
        <button style="color:#FF7070;border-color:rgba(255,82,82,0.3);${B}" onmousedown="return false;" onclick="deleteLatest(${l.id})" title="حذف">🗑</button>
      </div>
    </div>`;
  }).join('');
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
    latestData.unshift({id:Date.now(), text, status:document.getElementById('l-status').value});
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
  const sortedBreaking = [...breakingData].sort((a, b) => Number(b.id||0) - Number(a.id||0));
  tb.innerHTML = sortedBreaking.map(b => `
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

  // Read RBAC role selection (from editor modal)
  const rbacRoleId = document.getElementById('e-rbac-role')?.value
    || document.getElementById('e-role')?.value || 'editor';

  // Map RBAC roleId back to legacy Arabic role for backward compat
  const _roleNameMap = {manager:'مدير',admin:'مسؤول',editor:'محرر',writer:'كاتب',viewer:'مراقب'};
  const legacyRole = _roleNameMap[rbacRoleId] || rbacRoleId;

  const obj = {
    name, email,
    user:         document.getElementById('e-user').value.trim(),
    role:         legacyRole,      // legacy Arabic field
    roleId:       rbacRoleId,      // RBAC field (new)
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
      obj.color    = editorsData[idx].color;
      obj.articles = editorsData[idx].articles || 0;
      if (!passVal) obj.pass = editorsData[idx].pass || '';
      editorsData[idx] = {...editorsData[idx], ...obj};
    }
    showToast('✅ تم تحديث بيانات المستخدم');
  } else {
    obj.id = Date.now();
    obj.articles = 0;
    if (!obj.color) obj.color = colors[Math.floor(Math.random()*colors.length)];
    editorsData.push(obj);
    showToast('✅ تم إضافة المستخدم');
  }

  // Persist passwords
  _syncEditorPasswords();
  // Persist to Firestore (editors collection via settings/editors)
  _fbSetSetting('editors', { items: editorsData });

  saveAll();
  renderEditors();
  refreshAuthorSelect();
  closeModal('editor-modal');
}

function _syncEditorPasswords() {
  // Start with existing passwords (preserves admin password changes + rbac-created users)
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem('atq_user_passwords') || '{}'); } catch(_) {}
  // Merge from editorsData (current session)
  editorsData.forEach(e => {
    if (e.user && e.pass && e.active !== false) stored[e.user] = e.pass;
  });
  // Also merge from rbac.html-saved editors (atq_editors) — these may not be in editorsData yet
  try {
    const rbacEds = JSON.parse(localStorage.getItem('atq_editors') || '[]');
    rbacEds.forEach(e => { if (e.user && e.pass && e.active !== false) stored[e.user] = e.pass; });
  } catch(_) {}
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

  // ── RBAC: writers can only assign their own name ──────────
  const isWriter = !_hasPerm('edit_any_article'); // writers & supervisors without this perm
  if (isWriter && _curUser && _curUser.name) {
    // Only show the current user's own name — no impersonation allowed
    sel.innerHTML = `<option value="${_curUser.name}">${_curUser.name}</option>`;
    sel.value = _curUser.name;
    sel.disabled = true; // visually locked
    sel.title = 'الكاتب يُعيَّن تلقائياً باسمك';
    return;
  }

  // Editors, admins, managers: show all active members
  sel.disabled = false;
  sel.title = '';
  sel.innerHTML = '<option value="">اختر المحرر</option>' +
    editorsData.map(e => `<option value="${e.name}">${e.name}${e.active === false ? ' (موقوف)' : ''}</option>`).join('');
  if (cur) sel.value = cur;
}

// ─── DELETE ───────────────────────────────────────────────────
function askDelete(type, id, label) {
  _delTarget=id; _delType=type;
  document.getElementById('del-msg').textContent = `سيتم حذف "${label}" نهائياً ولا يمكن التراجع.`;
  openModal('del-modal');
}
function confirmDelete() {
  // ── RBAC security check ────────────────────────────────────
  if (_delType === 'news' && !_hasPerm('delete_articles')) {
    showToast('🚫 ليس لديك صلاحية حذف الأخبار');
    closeModal('del-modal');
    return;
  }
  if (_delType === 'cat' && !_hasPerm('manage_cats')) {
    showToast('🚫 ليس لديك صلاحية حذف الأقسام');
    closeModal('del-modal');
    return;
  }
  if (_delType === 'editor' && !_hasPerm('manage_users')) {
    showToast('🚫 ليس لديك صلاحية إدارة المستخدمين');
    closeModal('del-modal');
    return;
  }
  // Ownership check for news deletion
  if (_delType === 'news') {
    const article = newsData.find(n => n.id === _delTarget);
    if (article && !_canEditArticle(article) && !_hasPerm('delete_articles')) {
      showToast('🚫 لا يمكنك حذف مقالات الآخرين');
      closeModal('del-modal');
      return;
    }
    // Audit: log deletion
    if (article) _auditStamp(article, 'delete');
  }
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
      body: JSON.stringify({model:'claude-haiku-4-5-20201',max_tokens:10,messages:[{role:'user',content:'hi'}]})
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
    </div>`).join('') || '<div style="color:var(--text-dim);font-size:13px;padding:8px">لا توجد حسابات. أضف بالزر أعلاه.</div>';
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
  _siteSettingsCache.social_media = socials;
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
  if (targets.length > 50) showToast('⚠️ تم فتح أول 50 مستقبل من ' + targets.length + '. أرسل دفعات متعددة.');
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
        message: data.message || '',
        date: data.sentAt ? new Date(data.sentAt.seconds * 1000).toLocaleDateString('ar-EG') : '—',
        read: data.read || false,
        replied: data.replied || false
      });
    });
    _inboxData.sort((a,b) => b.id.localeCompare(a.id)); // newest first
    renderInboxMessages(_inboxData);
  } catch(e) {
    console.error('Load inbox error:', e);
    if (host) host.innerHTML = '<div style="text-align:center;padding:20px;color:var(--red)">⚠️ خطأ في تحميل الرسائل: ' + e.message + '</div>';
  }
}

function renderInboxMessages(data) {
  const host = document.getElementById('inbox-list');
  if (!host) return;
  if (!data.length) {
    host.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim);font-size:14px">📭 لا توجد رسائل بعد</div>';
    return;
  }
  host.innerHTML = data.map(msg => `
    <div style="background:var(--dark-3);border:1px solid var(--border-dim);border-radius:12px;padding:16px;margin-bottom:12px;cursor:pointer" onclick="openInboxMessage('${msg.id}')">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:12px;color:${msg.read ? 'var(--text-dim)' : 'var(--accent)'}">${msg.read ? '✓' : '●'} ${msg.date}</span>
        <span style="font-size:12px;color:var(--text-dim)">${msg.name} &lt;${msg.email}&gt;</span>
        ${msg.replied ? '<span style="font-size:10px;color:var(--green);background:rgba(61,220,132,0.1);padding:2px 6px;border-radius:10px">تم الرد</span>' : ''}
      </div>
      <div style="font-size:14px;color:var(--text);line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${msg.message}</div>
    </div>`).join('');
}

function openInboxMessage(id) {
  const msg = _inboxData.find(m => m.id === id);
  if (!msg) return;
  document.getElementById('inbox-msg-name').textContent = msg.name;
  document.getElementById('inbox-msg-email').textContent = msg.email;
  document.getElementById('inbox-msg-date').textContent = msg.date;
  document.getElementById('inbox-msg-body').textContent = msg.message;
  document.getElementById('inbox-msg-reply-btn').onclick = () => replyToInboxMessage(msg);
  document.getElementById('inbox-msg-mark-read-btn').onclick = () => markInboxMessageRead(id);
  document.getElementById('inbox-msg-mark-replied-btn').onclick = () => markInboxMessageReplied(id);
  openModal('inbox-message-modal');
  // Auto-mark as read
  if (!msg.read) markInboxMessageRead(id, false);
}

function markInboxMessageRead(id, showToast = true) {
  const msg = _inboxData.find(m => m.id === id);
  if (!msg || msg.read) return;
  msg.read = true;
  updateDoc(doc(_db, 'contact_messages', id), { read: true });
  renderInboxMessages(_inboxData);
  if (showToast) showToast('✅ تم وضع علامة مقروء');
}

function markInboxMessageReplied(id) {
  const msg = _inboxData.find(m => m.id === id);
  if (!msg) return;
  msg.replied = !msg.replied;
  updateDoc(doc(_db, 'contact_messages', id), { replied: msg.replied });
  renderInboxMessages(_inboxData);
  showToast(msg.replied ? '✅ تم وضع علامة تم الرد' : '↺ تم إزالة علامة الرد');
}

function replyToInboxMessage(msg) {
  const subject = encodeURIComponent('رد على رسالتك في الأحداث التقنية');
  const body = encodeURIComponent(`مرحباً ${msg.name},\n\nشكراً لتواصلك معنا.\n\nرسالتك:\n"${msg.message}"\n\nمع خالص التحية،\nفريق الأحداث التقنية`);
  window.open(`mailto:${msg.email}?subject=${subject}&body=${body}`);
}

function loadInboxForwarding() {
  const fwd = localStorage.getItem('atq_inbox_forwarding');
  const el = document.getElementById('inbox-forward-email');
  if (el) el.value = fwd || '';
}

function saveInboxForwarding() {
  const email = document.getElementById('inbox-forward-email')?.value.trim();
  if (email) localStorage.setItem('atq_inbox_forwarding', email);
  else localStorage.removeItem('atq_inbox_forwarding');
  showToast('✅ تم حفظ إعدادات التوجيه');
}

function forwardInboxMessage(msg) {
  const fwdEmail = localStorage.getItem('atq_inbox_forwarding');
  if (!fwdEmail) { showToast('⚠️ لم يتم تعيين بريد إلكتروني للتوجيه'); return; }
  const subject = encodeURIComponent('رسالة من موقع الأحداث التقنية');
  const body = encodeURIComponent(`من: ${msg.name} <${msg.email}>\nالتاريخ: ${msg.date}\n\nالرسالة:\n${msg.message}`);
  window.open(`mailto:${fwdEmail}?subject=${subject}&body=${body}`);
  showToast('📤 تم فتح نافذة التوجيه');
}

// ─── AI NEWS GENERATION ───────────────────────────────────────────
function renderAINews() {
  const container = document.getElementById('ai-news-list');
  if (!container) return;
  const aiNews = JSON.parse(localStorage.getItem('atq_ai_news') || '[]');
  if (!aiNews.length) {
    container.innerHTML = '<div style="padding:28px;text-align:center;color:var(--text-dim);font-size:13px">🤖 لا توجد أخبار مولدة بالذكاء الاصطناعي بعد</div>';
    return;
  }
  container.innerHTML = aiNews.map((n,i) => `
    <div style="background:var(--dark-3);border:1px solid var(--border-dim);border-radius:12px;padding:16px;margin-bottom:12px">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="flex:1">
          <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px">${n.title}</div>
          <div style="font-size:13px;color:var(--text-dim);margin-bottom:8px">${n.excerpt}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span style="font-size:11px;background:var(--dark-4);color:var(--text-muted);padding:3px 8px;border-radius:6px">${n.cat}</span>
            <span style="font-size:11px;background:var(--dark-4);color:var(--text-muted);padding:3px 8px;border-radius:6px">${n.author}</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-direction:column">
          <button class="btn-primary" onclick="importAINews(${i})" style="font-size:12px;padding:6px 12px">📥 استيراد</button>
          <button class="btn-del" onclick="deleteAINews(${i})" style="font-size:12px;padding:6px 12px">🗑 حذف</button>
        </div>
      </div>
    </div>`).join('');
}

function generateAINews() {
  const prompt = document.getElementById('ai-prompt')?.value.trim();
  if (!prompt) { showToast('⚠️ أدخل وصف الخبر'); return; }
  const key = _getActiveApiKey();
  if (!key) { showToast('⚠️ أضف مفتاح API أولاً'); return; }
  showToast('🤖 جاري توليد الخبر...');
  const btn = document.getElementById('ai-generate-btn');
  if (btn) btn.disabled = true;
  fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `أنت محرر تقني متخصص. اكتب خبراً تقنياً باللغة العربية بناءً على هذا الوصف: "${prompt}". 

الخبر يجب أن يكون:
- عنوان جذاب وموجز
- مقدمة قصيرة (ملخص)
- محتوى مفصل ومفيد
- تصنيف مناسب من: الذكاء الاصطناعي، الهواتف والأجهزة، الفضاء والعلوم، الأمن الرقمي، الشركات والأعمال، ألعاب الفيديو، السيارات الكهربائية، الروبوتات، التقنية الحيوية

أعد الخبر بتنسيق JSON فقط:
{
  "title": "العنوان هنا",
  "excerpt": "الملخص هنا",
  "content": "المحتوى الكامل هنا",
  "cat": "التصنيف هنا",
  "author": "أحمد الرشيدي"
}`
      }]
    })
  }).then(r => r.json()).then(d => {
    if (d.content && d.content[0] && d.content[0].text) {
      try {
        const news = JSON.parse(d.content[0].text);
        if (news.title && news.content) {
          const aiNews = JSON.parse(localStorage.getItem('atq_ai_news') || '[]');
          aiNews.unshift(news);
          localStorage.setItem('atq_ai_news', JSON.stringify(aiNews));
          renderAINews();
          showToast('✅ تم توليد الخبر بنجاح');
        } else {
          showToast('❌ الرد غير صحيح — جرب وصفاً آخر');
        }
      } catch(e) {
        showToast('❌ خطأ في تحليل الرد — جرب وصفاً آخر');
      }
    } else {
      showToast('❌ فشل في توليد الخبر: ' + (d.error?.message || 'رد غير متوقع'));
    }
  }).catch(e => {
    showToast('❌ خطأ في الاتصال: ' + e.message);
  }).finally(() => {
    if (btn) btn.disabled = false;
  });
}

function importAINews(i) {
  const aiNews = JSON.parse(localStorage.getItem('atq_ai_news') || '[]');
  const n = aiNews[i];
  if (!n) return;
  // Pre-fill the news form
  document.getElementById('n-title').value = n.title;
  document.getElementById('n-excerpt').value = n.excerpt;
  excerptSetContent(n.excerpt);
  rteSetContent(n.content);
  document.getElementById('n-cat').value = n.cat;
  document.getElementById('n-author').value = n.author;
  // Switch to main news tab
  showNewsSubTab('main');
  showToast('📥 تم استيراد الخبر — احفظه الآن');
}

function deleteAINews(i) {
  const aiNews = JSON.parse(localStorage.getItem('atq_ai_news') || '[]');
  aiNews.splice(i, 1);
  localStorage.setItem('atq_ai_news', JSON.stringify(aiNews));
  renderAINews();
  showToast('🗑 تم حذف الخبر المولد');
}

// ─── FETCH NEWS FROM RSS ──────────────────────────────────────────
function loadFetchedNews() {
  const container = document.getElementById('fetched-news-list');
  if (!container) return;
  const fetched = JSON.parse(localStorage.getItem('atq_fetched_news') || '[]');
  if (!fetched.length) {
    container.innerHTML = '<div style="padding:28px;text-align:center;color:var(--text-dim);font-size:13px">📰 لا توجد أخبار مستوردة بعد</div>';
    return;
  }
  container.innerHTML = fetched.map((n,i) => `
    <div style="background:var(--dark-3);border:1px solid var(--border-dim);border-radius:12px;padding:16px;margin-bottom:12px">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="flex:1">
          <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px">${n.title}</div>
          <div style="font-size:13px;color:var(--text-dim);margin-bottom:8px">${n.excerpt || n.description}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span style="font-size:11px;background:var(--dark-4);color:var(--text-muted);padding:3px 8px;border-radius:6px">${n.source}</span>
            <span style="font-size:11px;background:var(--dark-4);color:var(--text-muted);padding:3px 8px;border-radius:6px">${n.cat || 'غير مصنف'}</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-direction:column">
          <button class="btn-primary" onclick="importFetchedNews(${i})" style="font-size:12px;padding:6px 12px">📥 استيراد</button>
          <button class="btn-del" onclick="deleteFetchedNews(${i})" style="font-size:12px;padding:6px 12px">🗑 حذف</button>
        </div>
      </div>
    </div>`).join('');
}

function renderFetchedNews() {
  loadFetchedNews();
}

function fetchNewsFromRSS() {
  const url = document.getElementById('rss-url')?.value.trim();
  if (!url) { showToast('⚠️ أدخل رابط RSS'); return; }
  showToast('📰 جاري استيراد الأخبار...');
  const btn = document.getElementById('fetch-news-btn');
  if (btn) btn.disabled = true;
  fetch('/api/fetch-rss?url=' + encodeURIComponent(url))
    .then(r => r.json())
    .then(d => {
      if (d.items && d.items.length) {
        const fetched = JSON.parse(localStorage.getItem('atq_fetched_news') || '[]');
        d.items.forEach(item => {
          if (!fetched.find(f => f.title === item.title)) {
            fetched.unshift({
              title: item.title,
              excerpt: item.description || item.summary,
              content: item.content || item.description,
              cat: 'الشركات والأعمال', // default
              author: item.author || 'مستورد',
              source: d.feed?.title || 'RSS',
              url: item.link
            });
          }
        });
        localStorage.setItem('atq_fetched_news', JSON.stringify(fetched));
        renderFetchedNews();
        showToast(`✅ تم استيراد ${d.items.length} خبر`);
      } else {
        showToast('❌ لا توجد أخبار في هذا الرابط');
      }
    })
    .catch(e => {
      showToast('❌ فشل في الاستيراد: ' + e.message);
    })
    .finally(() => {
      if (btn) btn.disabled = false;
    });
}

function importFetchedNews(i) {
  const fetched = JSON.parse(localStorage.getItem('atq_fetched_news') || '[]');
  const n = fetched[i];
  if (!n) return;
  // Pre-fill the news form
  document.getElementById('n-title').value = n.title;
  document.getElementById('n-excerpt').value = n.excerpt;
  excerptSetContent(n.excerpt);
  rteSetContent(n.content);
  document.getElementById('n-cat').value = n.cat;
  document.getElementById('n-author').value = n.author;
  // Switch to main news tab
  showNewsSubTab('main');
  showToast('📥 تم استيراد الخبر — احفظه الآن');
}

function deleteFetchedNews(i) {
  const fetched = JSON.parse(localStorage.getItem('atq_fetched_news') || '[]');
  fetched.splice(i, 1);
  localStorage.setItem('atq_fetched_news', JSON.stringify(fetched));
  renderFetchedNews();
  showToast('🗑 تم حذف الخبر المستورد');
}

// ─── MODALS ──────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
  document.body.style.overflow = '';
}
window.openModal = openModal;
window.closeModal = closeModal;

// ─── TOAST NOTIFICATIONS ──────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 3000);
}
window.showToast = showToast;

// ─── RICH TEXT EDITOR ─────────────────────────────────────────────
function rteGetContent() {
  const editor = document.getElementById('rte-editor');
  return editor ? editor.innerHTML : '';
}
function rteSetContent(html) {
  const editor = document.getElementById('rte-editor');
  if (editor) editor.innerHTML = html;
}
window.rteGetContent = rteGetContent;
window.rteSetContent = rteSetContent;

// ─── EXCERPT EDITOR ───────────────────────────────────────────────
function excerptGetContent() {
  const editor = document.getElementById('excerpt-editor');
  return editor ? editor.innerText : '';
}
function excerptSetContent(text) {
  const editor = document.getElementById('excerpt-editor');
  if (editor) editor.innerText = text;
}
window.excerptGetContent = excerptGetContent;
window.excerptSetContent = excerptSetContent;

// ─── LOAD AD BANNERS ──────────────────────────────────────────────
function loadAdBanners() {
  const ads = JSON.parse(localStorage.getItem('atq_ad_banners') || '{}');
  ['top','bottom','grid','article','allnews'].forEach(pos => {
    const imgEl = document.getElementById('ad-' + pos + '-img');
    const urlEl = document.getElementById('ad-' + pos + '-url');
    const prevEl = document.getElementById('ad-' + pos + '-preview');
    if (imgEl) imgEl.value = ads[pos]?.img || '';
    if (urlEl) urlEl.value = ads[pos]?.url || '';
    if (prevEl) {
      if (ads[pos]?.img) {
        prevEl.innerHTML = `<img src="${ads[pos].img}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;
      } else {
        prevEl.innerHTML = '📢';
      }
    }
  });
}

// ─── SAVE AD BANNERS ──────────────────────────────────────────────
function saveAdBanners() {
  const ads = {};
  ['top','bottom','grid','article','allnews'].forEach(pos => {
    const img = document.getElementById('ad-' + pos + '-img')?.value;
    const url = document.getElementById('ad-' + pos + '-url')?.value;
    if (img || url) ads[pos] = { img, url };
  });
  localStorage.setItem('atq_ad_banners', JSON.stringify(ads));
  _fbUpdateSite({ ad_banners: ads });
  showToast('✅ تم حفظ البانرات الإعلانية');
}

// ─── LOAD INTERACTION TOGGLES ─────────────────────────────────────
function loadInteractionToggles() {
  const toggles = JSON.parse(localStorage.getItem('atq_interactions') || '{}');
  ['comments','likes','shares','bookmarks'].forEach(key => {
    const el = document.getElementById('int-' + key);
    if (el) el.checked = toggles[key] !== false;
  });
}

// ─── SAVE INTERACTION TOGGLES ─────────────────────────────────────
function saveInteractionToggles() {
  const toggles = {};
  ['comments','likes','shares','bookmarks'].forEach(key => {
    const el = document.getElementById('int-' + key);
    toggles[key] = !!(el && el.checked);
  });
  localStorage.setItem('atq_interactions', JSON.stringify(toggles));
  _fbUpdateSite({ interactions: toggles });
  showToast('✅ تم حفظ إعدادات التفاعل');
}

// ─── LOAD COMMENTS CONTROL ─────────────────────────────────────────
function loadCommentsControl() {
  const control = JSON.parse(localStorage.getItem('atq_comments_control') || '{}');
  const modEl = document.getElementById('comments-moderation');
  const anonEl = document.getElementById('comments-anonymous');
  if (modEl) modEl.checked = control.moderation !== false;
  if (anonEl) anonEl.checked = control.allowAnonymous !== false;
}

// ─── SAVE COMMENTS CONTROL ─────────────────────────────────────────
function saveCommentsControl() {
  const control = {
    moderation: !!(document.getElementById('comments-moderation')?.checked),
    allowAnonymous: !!(document.getElementById('comments-anonymous')?.checked)
  };
  localStorage.setItem('atq_comments_control', JSON.stringify(control));
  _fbUpdateSite({ comments_control: control });
  showToast('✅ تم حفظ إعدادات التعليقات');
}

// ─── RENDER SUBSCRIBERS TABLE ─────────────────────────────────────
function renderSubscribersTable(data) {
  const tbody = document.getElementById('sub-tbody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-dim);font-size:14px">📧 لا يوجد مشتركون بعد</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(s => `
    <tr>
      <td><input type="checkbox" class="sub-check" onchange="toggleSubSelect('${s.email}',this.checked)"></td>
      <td>${s.email}</td>
      <td>${s.source}</td>
      <td>${s.date}</td>
    </tr>`).join('');
}

// ─── BUILD CHART ──────────────────────────────────────────────────
function buildChart() {
  const ctx = document.getElementById('analytics-chart');
  if (!ctx) return;
  const pub = newsData.filter(n => n.status === 'منشور');
  const draft = newsData.filter(n => n.status === 'مسودة');
  const review = newsData.filter(n => n.status === 'قيد المراجعة');
  const approved = newsData.filter(n => n.status === 'معتمد');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['منشور', 'مسودة', 'قيد المراجعة', 'معتمد'],
      datasets: [{
        data: [pub.length, draft.length, review.length, approved.length],
        backgroundColor: ['var(--green)', 'var(--text-dim)', 'var(--accent)', 'var(--purple)'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

// ─── UTILITY FUNCTIONS ────────────────────────────────────────────
function renderFooterColEditor(col) {
  const list = document.getElementById('footer-' + col + '-list');
  if (!list) return;
  const items = _siteSettingsCache?.footer_cols?.[col] || _FOOTER_COL_DEFAULTS[col];
  list.innerHTML = items.map((item, i) => `
    <div style="display:flex;gap:8px;align-items:center;background:var(--dark-3);border-radius:8px;padding:8px 10px;margin-bottom:6px">
      <input type="text" value="${item.label||''}" onchange="updateFooterColItem('${col}',${i},'label',this.value)"
        style="flex:1;background:none;border:none;border-bottom:1px solid var(--border-dim);padding:4px 6px;font-family:inherit;font-size:13px;color:var(--text);outline:none" placeholder="اسم الرابط">
      <input type="text" value="${item.url||''}" onchange="updateFooterColItem('${col}',${i},'url',this.value)"
        style="width:120px;background:none;border:1px solid var(--border-dim);border-radius:6px;padding:4px 8px;font-family:inherit;font-size:11px;color:var(--text);outline:none" placeholder="https://...">
      <button onclick="deleteFooterColItem('${col}',${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:0 4px">×</button>
    </div>`).join('') || '<div style="color:var(--text-dim);font-size:13px;padding:8px">لا توجد روابط — أضف بالزر أعلاه.</div>';
}

function addFooterColItem(col) {
  const items = _siteSettingsCache?.footer_cols?.[col] || _FOOTER_COL_DEFAULTS[col];
  items.push({label:'', url:''});
  if (!_siteSettingsCache) _siteSettingsCache = {};
  if (!_siteSettingsCache.footer_cols) _siteSettingsCache.footer_cols = {};
  _siteSettingsCache.footer_cols[col] = items;
  renderFooterColEditor(col);
}

function deleteFooterColItem(col, i) {
  const items = _siteSettingsCache?.footer_cols?.[col] || _FOOTER_COL_DEFAULTS[col];
  items.splice(i,1);
  if (!_siteSettingsCache) _siteSettingsCache = {};
  if (!_siteSettingsCache.footer_cols) _siteSettingsCache.footer_cols = {};
  _siteSettingsCache.footer_cols[col] = items;
  renderFooterColEditor(col);
}

function updateFooterColItem(col, i, field, val) {
  const items = _siteSettingsCache?.footer_cols?.[col] || _FOOTER_COL_DEFAULTS[col];
  if (items[i]) items[i][field] = val;
  if (!_siteSettingsCache) _siteSettingsCache = {};
  if (!_siteSettingsCache.footer_cols) _siteSettingsCache.footer_cols = {};
  _siteSettingsCache.footer_cols[col] = items;
}

function saveFooterCols() {
  const cols = _siteSettingsCache?.footer_cols || {};
  _fbUpdateSite({ footer_cols: cols });
  showToast('✅ تم حفظ أعمدة الفوتر');
}

const _FOOTER_COL_DEFAULTS = {
  company: [
    {label:'عن الموقع', url:''},
    {label:'فريق العمل', url:''},
    {label:'الوظائف', url:''},
    {label:'اتصل بنا', url:''}
  ],
  more: [
    {label:'الشروط والأحكام', url:''},
    {label:'سياسة الخصوصية', url:''},
    {label:'خريطة الموقع', url:''},
    {label:'الأرشيف', url:''}
  ]
};

// ─── WINDOW ASSIGNMENTS ───────────────────────────────────────────
window.doLogin = doLogin;
window.doLogout = doLogout;
window.showPage = showPage;
window.showNewsSubTab = showNewsSubTab;
window.renderNewsTable = renderNewsTable;
window.filterNews = filterNews;
window.saveNews = saveNews;
window.saveNewsAs = saveNewsAs;
window.toggleNewsComments = toggleNewsComments;
window.editNews = editNews;
window.addNewsToLatest = addNewsToLatest;
window.addNewsToBreaking = addNewsToBreaking;
window.previewNewsThumb = previewNewsThumb;
window.previewNewsThumbUrl = previewNewsThumbUrl;
window.refreshNewsCatDropdown = refreshNewsCatDropdown;
window.renderCats = renderCats;
window.saveCat = saveCat;
window.editCat = editCat;
window.doEditCat = doEditCat;
window.selectColor = selectColor;
window.renderLatest = renderLatest;
window.toggleLatest = toggleLatest;
window.editLatest = editLatest;
window.saveLatest = saveLatest;
window.removeFromLatestByTitle = removeFromLatestByTitle;
window.removeFromBreakingByTitle = removeFromBreakingByTitle;
window.pinToWide = pinToWide;
window.unpinWide = unpinWide;
window.addToBreakingById = addToBreakingById;
window.addToLatestById = addToLatestById;
window.addToLatest = addToLatest;
window.renderBreaking = renderBreaking;
window.toggleBreakingItem = toggleBreakingItem;
window.editBreaking = editBreaking;
window.saveBreaking = saveBreaking;
window.addToBreaking = addToBreaking;
window.toggleBreakingMaster = toggleBreakingMaster;
window.saveDuration = saveDuration;
window.renderEditors = renderEditors;
window.toggleEditorActive = toggleEditorActive;
window.toggleEditorNewsAccess = toggleEditorNewsAccess;
window.saveEditor = saveEditor;
window.editEditor = editEditor;
window.refreshAuthorSelect = refreshAuthorSelect;
window.askDelete = askDelete;
window.confirmDelete = confirmDelete;
window.savePageControl = savePageControl;
window.saveTrendingToggle = saveTrendingToggle;
window.updateTickerSpeed = updateTickerSpeed;
window.saveSiteAppearance = saveSiteAppearance;
window.setSiteTheme = setSiteTheme;
window.setSiteLang = setSiteLang;
window.resetAllControls = resetAllControls;
window.syncBreakingShortcut = syncBreakingShortcut;
window.loadPageControls = loadPageControls;
window.loadLoginScreenControls = loadLoginScreenControls;
window.saveLoginScreen = saveLoginScreen;
window.applyLoginScreenFromCache = applyLoginScreenFromCache;
window.saveFooterSettings = saveFooterSettings;
window._getApiKeys = _getApiKeys;
window._saveApiKeys = _saveApiKeys;
window._getActiveApiKey = _getActiveApiKey;
window.renderApiKeysList = renderApiKeysList;
window.addApiKeyRow = addApiKeyRow;
window.deleteApiKey = deleteApiKey;
window.updateApiKey = updateApiKey;
window.setActiveApiKey = setActiveApiKey;
window.toggleApiKeysPanel = toggleApiKeysPanel;
window.testApiKey = testApiKey;
window._getSocialMedia = _getSocialMedia;
window.renderSocialMedia = renderSocialMedia;
window.addSocialMedia = addSocialMedia;
window.deleteSocialMedia = deleteSocialMedia;
window.updateSocialMedia = updateSocialMedia;
window._saveSocialMedia = _saveSocialMedia;
window.saveFooterLinks = saveFooterLinks;
window.disableAllComments = disableAllComments;
window.enableAllComments = enableAllComments;
window.saveStatsBar = saveStatsBar;
window.loadStatsBar = loadStatsBar;
window._getNavItems = _getNavItems;
window.renderNavMenuEditor = renderNavMenuEditor;
window.renderIdentityNavMenu = renderIdentityNavMenu;
window.addNavMenuItem = addNavMenuItem;
window.deleteNavItem = deleteNavItem;
window.updateNavItem = updateNavItem;
window.saveNavMenu = saveNavMenu;
window.resetNavMenu = resetNavMenu;
window._IDENTITY_DEFAULTS = _IDENTITY_DEFAULTS;
window.loadIdentitySettings = loadIdentitySettings;
window._refreshIdentityPreview = _refreshIdentityPreview;
window.saveIdentitySettings = saveIdentitySettings;
window.restoreIdentityDefaults = restoreIdentityDefaults;
window.uploadLogoImage = uploadLogoImage;
window.removeLogoImage = removeLogoImage;
window._LAYOUT_DEFAULTS = _LAYOUT_DEFAULTS;
window.loadLayoutSettings = loadLayoutSettings;
window.saveLayoutSettings = saveLayoutSettings;
window.alignHeroHeights = alignHeroHeights;
window.restoreHeroDefaults = restoreHeroDefaults;
window._MAINT_DEFAULTS = _MAINT_DEFAULTS;
window.loadMaintenance = loadMaintenance;
window.saveMaintenance = saveMaintenance;
window.handleMaintImageUpload = handleMaintImageUpload;
window.clearMaintImage = clearMaintImage;
window.restoreMaintDefaults = restoreMaintDefaults;
window.restoreAdHeightDefaults = restoreAdHeightDefaults;
window._subscribersData = _subscribersData;
window.toggleAllSubs = toggleAllSubs;
window.toggleSubSelect = toggleSubSelect;
window.openEmailModal = openEmailModal;
window.sendEmailToSubs = sendEmailToSubs;
window.loadSubscribers = loadSubscribers;
window._inboxData = _inboxData;
window._inboxUnsub = _inboxUnsub;
window._startInboxListener = _startInboxListener;
window.loadInboxMessages = loadInboxMessages;
window.renderInboxMessages = renderInboxMessages;
window.openInboxMessage = openInboxMessage;
window.markInboxMessageRead = markInboxMessageRead;
window.markInboxMessageReplied = markInboxMessageReplied;
window.replyToInboxMessage = replyToInboxMessage;
window.loadInboxForwarding = loadInboxForwarding;
window.saveInboxForwarding = saveInboxForwarding;
window.forwardInboxMessage = forwardInboxMessage;
window.renderAINews = renderAINews;
window.generateAINews = generateAINews;
window.importAINews = importAINews;
window.deleteAINews = deleteAINews;
window.loadFetchedNews = loadFetchedNews;
window.renderFetchedNews = renderFetchedNews;
window.fetchNewsFromRSS = fetchNewsFromRSS;
window.importFetchedNews = importFetchedNews;
window.deleteFetchedNews = deleteFetchedNews;
window.openModal = openModal;
window.closeModal = closeModal;
window.showToast = showToast;
window.rteGetContent = rteGetContent;
window.rteSetContent = rteSetContent;
window.excerptGetContent = excerptGetContent;
window.excerptSetContent = excerptSetContent;
window.loadAdBanners = loadAdBanners;
window.saveAdBanners = saveAdBanners;
window.loadInteractionToggles = loadInteractionToggles;
window.saveInteractionToggles = saveInteractionToggles;
window.loadCommentsControl = loadCommentsControl;
window.saveCommentsControl = saveCommentsControl;
window.renderSubscribersTable = renderSubscribersTable;
window.buildChart = buildChart;
window.renderFooterColEditor = renderFooterColEditor;
window.addFooterColItem = addFooterColItem;
window.deleteFooterColItem = deleteFooterColItem;
window.updateFooterColItem = updateFooterColItem;
window.saveFooterCols = saveFooterCols;
window._FOOTER_COL_DEFAULTS = _FOOTER_COL_DEFAULTS;