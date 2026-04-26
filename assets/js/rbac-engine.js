// ================================================================
// rbac-engine.js  —  Unified RBAC Engine (Single Source of Truth)
// Version: 2.0.0
//
// ALL permission definitions, role defaults, and core RBAC functions
// live here. Both admin.js and rbac.js import from this module.
// Never duplicate these definitions in any other file.
//
// PERMISSION MODEL:
//   session.roleId      → base role (perms from role definition)
//   session.addPerms    → extra perms ADDED on top of role (new)
//   session.denyPerms   → perms DENIED despite role (new, deny > allow)
//   session.customPerms → legacy FULL OVERRIDE (replaces role perms)
//   session.allowedCats → category scope restriction
// ================================================================

// ── Permission Catalog ───────────────────────────────────────────
// Canonical list. Add new permissions here — NEVER elsewhere.
export const PERMISSIONS = [
  // ── محتوى الأخبار ─────────────────────────────────────────────
  { id: 'add_articles',      label: 'إضافة أخبار',                group: 'محتوى',  icon: '➕' },
  { id: 'edit_articles',     label: 'تعديل مقالاتي',              group: 'محتوى',  icon: '✏️' },
  { id: 'edit_any_article',  label: 'تعديل أي مقال',              group: 'محتوى',  icon: '✏️' },
  { id: 'delete_articles',   label: 'حذف الأخبار',                group: 'محتوى',  icon: '🗑' },
  { id: 'publish_articles',  label: 'نشر الأخبار',                group: 'محتوى',  icon: '📤' },
  { id: 'approve_articles',  label: 'اعتماد المقالات',            group: 'محتوى',  icon: '✅' },
  { id: 'review_articles',   label: 'مراجعة المقالات',            group: 'محتوى',  icon: '🔍' },
  { id: 'schedule_articles', label: 'جدولة النشر',                group: 'محتوى',  icon: '🗓' },
  { id: 'import_articles',   label: 'استيراد الأخبار',            group: 'محتوى',  icon: '📥' },
  { id: 'ai_generate',       label: 'توليد بالذكاء الاصطناعي',    group: 'محتوى',  icon: '🤖' },
  // ── إدارة الموقع ──────────────────────────────────────────────
  { id: 'manage_homepage',   label: 'الصفحة الرئيسية',           group: 'الموقع', icon: '🏠' },
  { id: 'manage_cats',       label: 'إدارة الأقسام',             group: 'الموقع', icon: '📂' },
  { id: 'manage_breaking',   label: 'الأخبار العاجلة',           group: 'الموقع', icon: '⚡' },
  { id: 'manage_ticker',     label: 'شريط الأخبار',              group: 'الموقع', icon: '🗞️' },
  { id: 'manage_ads',        label: 'إدارة الإعلانات',           group: 'الموقع', icon: '📣' },
  { id: 'manage_nav',        label: 'قوائم التنقل',              group: 'الموقع', icon: '🔗' },
  { id: 'manage_identity',   label: 'هوية الموقع',               group: 'الموقع', icon: '🎨' },
  { id: 'manage_sections',   label: 'الأقسام المخصصة',           group: 'الموقع', icon: '📑' },
  // ── إدارة النظام ──────────────────────────────────────────────
  { id: 'manage_users',      label: 'إدارة المستخدمين',          group: 'النظام', icon: '👥' },
  { id: 'manage_roles',      label: 'إدارة الأدوار والصلاحيات',  group: 'النظام', icon: '🔐' },
  { id: 'view_analytics',    label: 'التحليلات والإحصاءات',      group: 'النظام', icon: '📊' },
  { id: 'view_reports',      label: 'التقارير',                  group: 'النظام', icon: '📈' },
  { id: 'view_audit_log',    label: 'سجل المراجعة',              group: 'النظام', icon: '📋' },
  { id: 'system_settings',   label: 'إعدادات النظام',            group: 'النظام', icon: '⚙️' },
  { id: 'manage_emails',     label: 'إدارة المشتركين',           group: 'النظام', icon: '📧' },
  { id: 'manage_inbox',      label: 'صندوق الرسائل',             group: 'النظام', icon: '✉️' },
];

// ── Default Role Definitions ─────────────────────────────────────
// Canonical list. 6 roles, ordered by access level descending.
export const DEFAULT_ROLES = [
  {
    id: 'manager', name: 'مدير عام', icon: '👑', color: '#C9A84C',
    level: 100, protected: true,
    desc: 'وصول كامل غير محدود لجميع أجزاء النظام',
    perms: ['*'],
  },
  {
    id: 'admin', name: 'مسؤول', icon: '🛡️', color: '#4A9EFF',
    level: 80, protected: false,
    desc: 'صلاحيات واسعة على المحتوى والموقع وإدارة المستخدمين',
    perms: [
      'add_articles', 'edit_articles', 'edit_any_article', 'delete_articles',
      'publish_articles', 'approve_articles', 'review_articles', 'schedule_articles',
      'import_articles', 'ai_generate',
      'manage_homepage', 'manage_cats', 'manage_breaking', 'manage_ticker',
      'manage_ads', 'manage_nav', 'manage_identity', 'manage_sections',
      'manage_users',
      'view_analytics', 'view_reports', 'view_audit_log',
      'manage_emails', 'manage_inbox',
    ],
  },
  {
    id: 'editor', name: 'محرر', icon: '✍️', color: '#A078FF',
    level: 60, protected: false,
    desc: 'إنشاء المحتوى ونشره وإدارة الشريط والأقسام',
    perms: [
      'add_articles', 'edit_articles', 'edit_any_article',
      'publish_articles', 'approve_articles', 'review_articles', 'schedule_articles',
      'ai_generate',
      'manage_homepage', 'manage_breaking', 'manage_ticker', 'manage_sections',
      'view_analytics', 'view_audit_log',
    ],
  },
  {
    id: 'supervisor', name: 'مشرف', icon: '👁️', color: '#FF9A3C',
    level: 50, protected: false,
    desc: 'مراجعة المقالات والإشراف على المحتوى',
    perms: [
      'add_articles', 'edit_articles', 'edit_any_article',
      'review_articles', 'approve_articles',
      'view_analytics',
    ],
  },
  {
    id: 'writer', name: 'كاتب', icon: '📝', color: '#3DDC84',
    level: 40, protected: false,
    desc: 'كتابة الأخبار فقط — بدون نشر مباشر',
    perms: ['add_articles', 'edit_articles'],
  },
  {
    id: 'viewer', name: 'مراقب', icon: '📊', color: '#40C8F0',
    level: 20, protected: false,
    desc: 'عرض الإحصائيات والتقارير فقط — لا يمكن التعديل',
    perms: ['view_analytics', 'view_reports'],
  },
];

// ── Permission → Admin Page ID Map ───────────────────────────────
// Used to compute sidebar nav visibility and page access guards.
export const PERM_PAGE_MAP = {
  add_articles:      ['news'],
  edit_articles:     ['news'],
  edit_any_article:  ['news'],
  delete_articles:   ['news'],
  publish_articles:  ['news', 'custom-sections'],
  approve_articles:  ['news', 'approval-queue'],
  review_articles:   ['news', 'approval-queue'],
  schedule_articles: ['news'],
  import_articles:   ['news'],
  ai_generate:       ['news'],
  manage_homepage:   ['pagecontrols', 'general-settings'],
  manage_cats:       ['categories'],
  manage_breaking:   ['breaking'],
  manage_ticker:     ['latest'],
  manage_ads:        ['ads-manager'],
  manage_nav:        ['nav-links-manager'],
  manage_identity:   ['identity', 'footer-control'],
  manage_sections:   ['custom-sections'],
  manage_users:      ['editors'],
  manage_roles:      ['editors'],
  view_analytics:    ['analytics'],
  view_reports:      ['analytics'],
  view_audit_log:    ['analytics'],
  system_settings:   ['settings'],
  manage_emails:     ['subscribers'],
  manage_inbox:      ['inbox'],
};

// ── News Sub-Tab Permissions ──────────────────────────────────────
export const NEWS_SUBTAB_PERMS = {
  'ai-news':    ['ai_generate'],
  'fetch-news': ['import_articles'],
};

// ── RBAC Panel Access Requirements ───────────────────────────────
// Permissions that grant access to the RBAC management interface.
export const RBAC_ACCESS_PERMS = ['manage_users', 'manage_roles'];

// ================================================================
// CORE FUNCTIONS
// ================================================================

/**
 * Get the effective permissions for a session.
 *
 * Evaluation order:
 *   1. session.customPerms (legacy full override)  → replaces everything
 *   2. role.perms base                             → from loaded role definition
 *   3. + session.addPerms                          → extra grants on top
 *   4. - session.denyPerms                         → explicit denials win
 *
 * @param {object} session  - { roleId, customPerms?, addPerms?, denyPerms? }
 * @param {object[]} roles  - loaded role definitions array
 * @returns {string[]}      - effective permission IDs (or ['*'] for super-admin)
 */
export function getEffectivePerms(session, roles) {
  if (!session || !session.roleId) return [];

  // ── Legacy mode: customPerms completely replaces role perms ──
  if (session.customPerms && Array.isArray(session.customPerms) && session.customPerms.length) {
    let perms = [...session.customPerms];
    // Still apply explicit denyPerms for safety even in override mode
    if (Array.isArray(session.denyPerms) && session.denyPerms.length) {
      perms = perms.filter(p => p === '*' || !session.denyPerms.includes(p));
    }
    return perms;
  }

  // ── Normal mode: role perms + addPerms - denyPerms ───────────
  const role = roles.find(r => r.id === session.roleId);
  let perms = role ? [...(role.perms || [])] : [];

  // Wildcard: super-admin bypass (denyPerms intentionally not applied)
  if (perms.includes('*')) return ['*'];

  // Add extra permissions granted directly to this user
  if (Array.isArray(session.addPerms) && session.addPerms.length) {
    session.addPerms.forEach(p => {
      if (p && typeof p === 'string' && !perms.includes(p)) perms.push(p);
    });
  }

  // Remove explicitly denied permissions (deny always wins over allow)
  if (Array.isArray(session.denyPerms) && session.denyPerms.length) {
    perms = perms.filter(p => !session.denyPerms.includes(p));
  }

  return perms;
}

/**
 * Check if a session has a specific permission.
 *
 * @param {string} perm     - permission ID to check
 * @param {object} session  - RBAC session object
 * @param {object[]} roles  - loaded role definitions
 * @returns {boolean}
 */
export function hasPerm(perm, session, roles) {
  if (!session || !session.roleId) return false;
  const perms = getEffectivePerms(session, roles);
  return perms.includes('*') || perms.includes(perm);
}

/**
 * Get the list of admin page IDs the session is allowed to access.
 * Returns null for full access (wildcard), or a string[] of page IDs.
 *
 * @param {object} session  - RBAC session object
 * @param {object[]} roles  - loaded role definitions
 * @returns {string[]|null}
 */
export function getAllowedPages(session, roles) {
  if (!session || !session.roleId) return null; // no session → full access
  const perms = getEffectivePerms(session, roles);
  if (!perms.length) return ['overview'];
  if (perms.includes('*')) return null; // wildcard → full access
  const pages = new Set(['overview']);
  perms.forEach(p => (PERM_PAGE_MAP[p] || []).forEach(pg => pages.add(pg)));
  return [...pages];
}

/**
 * Check if a session can access a specific news sub-tab.
 *
 * @param {string} tabId    - 'ai-news' | 'fetch-news'
 * @param {object} session  - RBAC session
 * @param {object[]} roles  - loaded roles
 * @returns {boolean}
 */
export function canAccessNewsSubTab(tabId, session, roles) {
  if (!session) return false;
  const perms = getEffectivePerms(session, roles);
  if (perms.includes('*')) return true;
  const required = NEWS_SUBTAB_PERMS[tabId];
  if (!required) return true;
  return required.some(p => perms.includes(p));
}

/**
 * Check if a session can access the RBAC management panel.
 *
 * @param {object} session  - RBAC session
 * @param {object[]} roles  - loaded roles
 * @returns {boolean}
 */
export function canAccessRbacPanel(session, roles) {
  if (!session) return false;
  const perms = getEffectivePerms(session, roles);
  if (perms.includes('*')) return true;
  return RBAC_ACCESS_PERMS.some(p => perms.includes(p));
}

/**
 * Check if a session can manage roles (highest privilege operation).
 * Only the manager role (wildcard) can do this by default.
 *
 * @param {object} session  - RBAC session
 * @param {object[]} roles  - loaded roles
 * @returns {boolean}
 */
export function canManageRoles(session, roles) {
  return hasPerm('manage_roles', session, roles);
}

/**
 * Check if a session is a super-admin (has wildcard access).
 *
 * @param {object} session  - RBAC session
 * @param {object[]} roles  - loaded roles
 * @returns {boolean}
 */
export function isSuperAdmin(session, roles) {
  if (!session) return false;
  const perms = getEffectivePerms(session, roles);
  return perms.includes('*');
}

/**
 * Content-level access check.
 * Controls whether a session can read/write a specific piece of content.
 *
 * @param {'article'|'category'|'page'|'file'} contentType
 * @param {{ catName?, authorUser?, status?, visibility? }} contentMeta
 * @param {object} session  - RBAC session
 * @param {object[]} roles  - loaded roles
 * @returns {boolean}
 */
export function canAccessContent(contentType, contentMeta, session, roles) {
  if (!session) return false;
  const perms = getEffectivePerms(session, roles);
  if (perms.includes('*')) return true;

  const { catName, authorUser, status } = contentMeta || {};

  if (contentType === 'article') {
    // Must have at least one content permission
    const hasAnyContentPerm = perms.some(p =>
      ['add_articles','edit_articles','edit_any_article','delete_articles',
       'publish_articles','approve_articles','review_articles','schedule_articles',
       'import_articles','ai_generate'].includes(p)
    );
    if (!hasAnyContentPerm) return false;
    // Category scope restriction
    if (catName && Array.isArray(session.allowedCats) && session.allowedCats.length) {
      if (!session.allowedCats.includes(catName)) return false;
    }
    return true;
  }

  if (contentType === 'category') {
    if (!perms.includes('manage_cats')) return false;
    if (catName && Array.isArray(session.allowedCats) && session.allowedCats.length) {
      return session.allowedCats.includes(catName);
    }
    return true;
  }

  return true;
}

/**
 * Get role display name for a session.
 */
export function getRoleName(session, roles) {
  if (!session || !session.roleId) return '—';
  const role = roles.find(r => r.id === session.roleId);
  return role ? (role.name || session.roleId) : session.roleId;
}

/**
 * Get role display color for a session.
 */
export function getRoleColor(session, roles) {
  if (!session || !session.roleId) return '#C9A84C';
  const role = roles.find(r => r.id === session.roleId);
  return role ? (role.color || '#C9A84C') : '#C9A84C';
}

/**
 * Validate that a permission ID exists in the catalog.
 */
export function isValidPerm(permId) {
  return PERMISSIONS.some(p => p.id === permId);
}

/**
 * Get permission metadata by ID.
 */
export function getPermMeta(permId) {
  return PERMISSIONS.find(p => p.id === permId) || null;
}

/**
 * Get the role hierarchy level for a roleId.
 */
export function getRoleLevel(roleId, roles) {
  const role = roles.find(r => r.id === roleId);
  return role ? (role.level || 0) : 0;
}

/**
 * Check if a user's role is high enough to manage another user.
 * A user cannot edit users of equal or higher level.
 */
export function canManageUser(managerSession, targetRoleId, roles) {
  if (!managerSession) return false;
  const perms = getEffectivePerms(managerSession, roles);
  if (perms.includes('*')) return true;
  if (!perms.includes('manage_users')) return false;
  const managerLevel = getRoleLevel(managerSession.roleId, roles);
  const targetLevel  = getRoleLevel(targetRoleId, roles);
  return managerLevel > targetLevel;
}

// ── Default export namespace ──────────────────────────────────────
export const RBAC = {
  PERMISSIONS,
  DEFAULT_ROLES,
  PERM_PAGE_MAP,
  NEWS_SUBTAB_PERMS,
  RBAC_ACCESS_PERMS,
  getEffectivePerms,
  hasPerm,
  getAllowedPages,
  canAccessNewsSubTab,
  canAccessRbacPanel,
  canManageRoles,
  isSuperAdmin,
  canAccessContent,
  getRoleName,
  getRoleColor,
  isValidPerm,
  getPermMeta,
  getRoleLevel,
  canManageUser,
};

export default RBAC;
