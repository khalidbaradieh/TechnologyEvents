// ================================================================
// admin-rbac.js  —  RBAC Permission Engine for Admin Panel
// Single source of truth for role-based access control.
// Imported by admin.html as a module.
// ================================================================

// ── Default roles (mirrors rbac.html DEFAULT_ROLES exactly) ──────
export const DEFAULT_ROLES = [
  {
    id:'manager', name:'المدير العام', icon:'👑', color:'#C9A84C',
    level:100, protected:true,
    desc:'صلاحيات كاملة وغير محدودة على جميع أجزاء النظام',
    perms:['*'],
  },
  {
    id:'admin', name:'مدير', icon:'🛡️', color:'#4A9EFF',
    level:80, protected:false,
    desc:'إدارة المحتوى والمستخدمين مع قيود محدودة على إعدادات النظام',
    perms:['add_articles','edit_articles','delete_articles','publish_articles',
           'approve_articles','import_articles','ai_generate',
           'manage_homepage','manage_cats','manage_breaking','manage_ticker',
           'manage_ads','manage_nav','manage_identity',
           'view_analytics','view_reports','manage_emails','manage_inbox'],
  },
  {
    id:'editor', name:'محرر', icon:'✏️', color:'#A078FF',
    level:60, protected:false,
    desc:'إضافة وتعديل ونشر الأخبار واعتماد مقالات الكتّاب',
    perms:['add_articles','edit_articles','publish_articles','approve_articles',
           'ai_generate','manage_homepage','manage_breaking','manage_ticker','view_analytics'],
  },
  {
    id:'writer', name:'كاتب', icon:'📝', color:'#3DDC84',
    level:40, protected:false,
    desc:'كتابة مقالات وتقديمها للمراجعة — بدون صلاحية النشر المباشر',
    perms:['add_articles','edit_articles'],
  },
];

// ── Permission → Admin page IDs map ──────────────────────────────
export const PERM_PAGE_MAP = {
  add_articles:    ['news'],
  edit_articles:   ['news'],
  delete_articles: ['news'],
  publish_articles:['news'],
  approve_articles:['news'],
  import_articles: ['news'],        // news sub-tab: fetch
  ai_generate:     ['news'],        // news sub-tab: ai-news
  manage_homepage: ['pagecontrols','general-settings'],
  manage_cats:     ['categories'],
  manage_breaking: ['breaking'],
  manage_ticker:   ['latest'],
  manage_ads:      ['ads-manager'],
  manage_nav:      ['nav-links-manager'],
  manage_identity: ['identity','footer-control'],
  manage_users:    ['editors'],
  view_analytics:  ['analytics'],
  view_reports:    ['analytics'],
  system_settings: ['settings'],
  manage_emails:   ['subscribers'],
  manage_inbox:    ['inbox'],
};

// ── News sub-tab permissions ──────────────────────────────────────
export const NEWS_SUBTAB_PERMS = {
  'ai-news':    ['ai_generate','approve_articles'],
  'fetch-news': ['import_articles','approve_articles'],
};

// ── Load roles from localStorage (cached from rbac.html sync) ────
export function loadRoles() {
  try {
    const stored = localStorage.getItem('atq_rbac_roles');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch(_) {}
  return DEFAULT_ROLES;
}

// ── Load current RBAC session ─────────────────────────────────────
export function loadRbacSession() {
  try {
    const stored = localStorage.getItem('atq_rbac_user');
    if (stored) return JSON.parse(stored);
  } catch(_) {}
  return null;
}

// ── Save RBAC session ─────────────────────────────────────────────
export function saveRbacSession(sessionObj) {
  try { localStorage.setItem('atq_rbac_user', JSON.stringify(sessionObj)); } catch(_) {}
}

// ── Clear RBAC session ────────────────────────────────────────────
export function clearRbacSession() {
  try { localStorage.removeItem('atq_rbac_user'); } catch(_) {}
}

// ── Get current user's effective permissions ──────────────────────
export function getEffectivePerms(session, roles) {
  if (!session || !session.roleId) return [];
  if (session.customPerms) return session.customPerms;
  const role = roles.find(r => r.id === session.roleId);
  return role ? (role.perms || []) : [];
}

// ── Check if current user has a specific permission ───────────────
export function hasPerm(perm, session, roles) {
  if (!session) return false;
  const perms = getEffectivePerms(session, roles);
  return perms.includes('*') || perms.includes(perm);
}

// ── Compute allowed admin page IDs from RBAC session ─────────────
// Returns null for full access (manager/*), or string[] of page IDs
export function getAllowedPages(session, roles) {
  if (!session || !session.roleId) return null; // no RBAC — full access
  const perms = getEffectivePerms(session, roles);
  if (!perms || !perms.length) return ['overview'];
  if (perms.includes('*')) return null; // full access
  const pages = new Set(['overview']);
  perms.forEach(p => {
    (PERM_PAGE_MAP[p] || []).forEach(pg => pages.add(pg));
  });
  return [...pages];
}

// ── Check if a news sub-tab is accessible ────────────────────────
export function canAccessNewsSubTab(tabId, session, roles) {
  if (!session) return true; // not logged in via RBAC — allow
  const perms = getEffectivePerms(session, roles);
  if (perms.includes('*')) return true;
  const required = NEWS_SUBTAB_PERMS[tabId];
  if (!required) return true;
  return required.some(p => perms.includes(p));
}

// ── Get role color for a user ─────────────────────────────────────
export function getRoleColor(session, roles) {
  if (!session || !session.roleId) return '#C9A84C';
  const role = roles.find(r => r.id === session.roleId);
  return role ? (role.color || '#C9A84C') : '#C9A84C';
}

// ── Get role display name ─────────────────────────────────────────
export function getRoleName(session, roles) {
  if (!session || !session.roleId) return '—';
  const role = roles.find(r => r.id === session.roleId);
  return role ? (role.name || session.roleId) : session.roleId;
}
