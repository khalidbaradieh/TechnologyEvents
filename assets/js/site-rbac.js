// ================================================================
// site-rbac.js  —  Frontend RBAC Engine for the Public Website
// Version: 2.0.0
//
// Controls what editors/admins see when they visit the public site
// while logged in. Also provides the API for future member-only
// sections and content-level access control.
//
// Usage (in index.html or main.js):
//   import { initSiteRbac } from '/assets/js/site-rbac.js';
//   initSiteRbac();
//
// HTML hooks (apply to any element to control visibility):
//   data-rbac-show="publish_articles"    → show only if user has perm
//   data-rbac-hide="manage_users"        → hide if user has perm
//   data-rbac-role="editor,admin"        → show only for these roles
//   data-rbac-min-level="60"             → show only for roles ≥ level
// ================================================================

import {
  getEffectivePerms,
  hasPerm,
  getRoleName,
  getRoleColor,
  isSuperAdmin,
  DEFAULT_ROLES,
} from '/assets/js/rbac-engine.js';

// ── Internal state ────────────────────────────────────────────────
let _siteSession = null;
let _siteRoles   = DEFAULT_ROLES;
let _initialized = false;

// ── localStorage keys ─────────────────────────────────────────────
const LS = {
  RBAC_USER:  'atq_rbac_user',
  RBAC_ROLES: 'atq_rbac_roles',
};

// ================================================================
// INITIALIZATION
// ================================================================

/**
 * Initialize the site RBAC engine.
 * Call once on page load. Reads session from localStorage and applies
 * all RBAC-driven DOM adjustments.
 *
 * @param {object} [options]
 * @param {boolean} [options.showAdminBar=true]  - Show floating admin toolbar if logged in
 * @param {boolean} [options.applyHooks=true]    - Apply data-rbac-* DOM attributes
 */
export function initSiteRbac(options) {
  const opts = Object.assign({ showAdminBar: true, applyHooks: true }, options || {});

  _siteSession = _loadSession();
  _siteRoles   = _loadRoles();
  _initialized = true;

  if (!_siteSession) return; // No logged-in admin/editor on this device

  // Apply DOM visibility hooks
  if (opts.applyHooks) {
    _applyDomHooks();
    // Re-apply after dynamic content loads
    setTimeout(_applyDomHooks, 800);
  }

  // Show floating admin toolbar
  if (opts.showAdminBar) {
    _mountAdminBar();
  }

  console.info('[RBAC] Site session loaded:', _siteSession.name, '→', _siteSession.roleId);
}

// ================================================================
// PUBLIC API
// ================================================================

/**
 * Check if the current site visitor has a specific admin permission.
 *
 * @param {string} perm - permission ID
 * @returns {boolean}
 */
export function siteHasPerm(perm) {
  if (!_siteSession) return false;
  return hasPerm(perm, _siteSession, _siteRoles);
}

/**
 * Get the current site visitor's effective permissions.
 *
 * @returns {string[]}
 */
export function getSitePerms() {
  if (!_siteSession) return [];
  return getEffectivePerms(_siteSession, _siteRoles);
}

/**
 * Check if the current visitor is a logged-in admin/editor.
 *
 * @returns {boolean}
 */
export function isSiteAdminLoggedIn() {
  return !!_siteSession;
}

/**
 * Get the current visitor's display name (if logged in).
 *
 * @returns {string|null}
 */
export function getSiteUserName() {
  return _siteSession ? (_siteSession.name || _siteSession.username) : null;
}

/**
 * Get the current visitor's role name (if logged in).
 *
 * @returns {string|null}
 */
export function getSiteRoleName() {
  if (!_siteSession) return null;
  return getRoleName(_siteSession, _siteRoles);
}

/**
 * Get the current visitor's role color.
 *
 * @returns {string}
 */
export function getSiteRoleColor() {
  if (!_siteSession) return '#C9A84C';
  return getRoleColor(_siteSession, _siteRoles);
}

/**
 * Check if a specific article can be edited by the current visitor.
 *
 * @param {{ id, catName, authorUser, status }} article
 * @returns {boolean}
 */
export function canEditArticle(article) {
  if (!_siteSession) return false;
  const perms = getEffectivePerms(_siteSession, _siteRoles);
  if (perms.includes('*')) return true;
  if (!perms.includes('edit_articles') && !perms.includes('edit_any_article')) return false;
  // Own article
  if (perms.includes('edit_any_article')) return true;
  // Category scope
  if (article.catName && Array.isArray(_siteSession.allowedCats) && _siteSession.allowedCats.length) {
    if (!_siteSession.allowedCats.includes(article.catName)) return false;
  }
  return _siteSession.username === article.authorUser || _siteSession.name === article.authorName;
}

/**
 * Check if the current visitor can publish articles.
 *
 * @returns {boolean}
 */
export function canPublishArticle() {
  return siteHasPerm('publish_articles');
}

/**
 * Re-apply DOM hooks (useful after dynamic content changes).
 */
export function refreshSiteRbac() {
  if (!_initialized) return;
  _applyDomHooks();
}

// ================================================================
// DOM HOOKS
// ================================================================

/**
 * Apply data-rbac-* attribute-based visibility control to DOM elements.
 *
 * Supported attributes:
 *   data-rbac-show="perm_id"        → show only if user has the permission
 *   data-rbac-hide="perm_id"        → hide if user has the permission
 *   data-rbac-role="roleId,roleId"  → show only for listed roles
 *   data-rbac-min-level="60"        → show only for roles ≥ level
 *   data-rbac-admin-only            → show only for any logged-in admin/editor
 */
function _applyDomHooks() {
  const isLoggedIn = !!_siteSession;
  const perms      = isLoggedIn ? getEffectivePerms(_siteSession, _siteRoles) : [];
  const isWildcard = perms.includes('*');
  const roleId     = _siteSession ? _siteSession.roleId : null;
  const myLevel    = (() => {
    if (!roleId) return 0;
    const r = _siteRoles.find(x => x.id === roleId);
    return r ? (r.level || 0) : 0;
  })();

  // data-rbac-show="perm_id"
  document.querySelectorAll('[data-rbac-show]').forEach(el => {
    const perm = el.getAttribute('data-rbac-show');
    const show = isWildcard || perms.includes(perm);
    el.style.display = show ? '' : 'none';
  });

  // data-rbac-hide="perm_id"
  document.querySelectorAll('[data-rbac-hide]').forEach(el => {
    const perm = el.getAttribute('data-rbac-hide');
    const hide = isWildcard || perms.includes(perm);
    if (hide) el.style.display = 'none';
  });

  // data-rbac-role="editor,admin"
  document.querySelectorAll('[data-rbac-role]').forEach(el => {
    const allowed = (el.getAttribute('data-rbac-role') || '').split(',').map(r => r.trim());
    const show = isWildcard || (roleId && allowed.includes(roleId));
    el.style.display = show ? '' : 'none';
  });

  // data-rbac-min-level="60"
  document.querySelectorAll('[data-rbac-min-level]').forEach(el => {
    const minLevel = parseInt(el.getAttribute('data-rbac-min-level') || '0', 10);
    const show = isWildcard || myLevel >= minLevel;
    el.style.display = show ? '' : 'none';
  });

  // data-rbac-admin-only (show to any logged-in staff)
  document.querySelectorAll('[data-rbac-admin-only]').forEach(el => {
    el.style.display = isLoggedIn ? '' : 'none';
  });
}

// ================================================================
// ADMIN TOOLBAR (floating bar on the public site for logged-in staff)
// ================================================================

function _mountAdminBar() {
  // Don't mount more than once
  if (document.getElementById('site-rbac-adminbar')) return;

  const perms        = getEffectivePerms(_siteSession, _siteRoles);
  const name         = _siteSession.name || _siteSession.username;
  const roleName     = getRoleName(_siteSession, _siteRoles);
  const roleColor    = getRoleColor(_siteSession, _siteRoles);
  const canNews      = perms.includes('*') || perms.includes('add_articles') || perms.includes('edit_articles');
  const canBreaking  = perms.includes('*') || perms.includes('manage_breaking');
  const canAnalytics = perms.includes('*') || perms.includes('view_analytics');
  const adminUrl     = '/admin.html';

  const bar = document.createElement('div');
  bar.id = 'site-rbac-adminbar';
  bar.setAttribute('dir', 'rtl');
  bar.style.cssText = `
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 99999;
    background: rgba(10,10,10,0.96); backdrop-filter: blur(12px);
    border-top: 1px solid ${roleColor}44;
    display: flex; align-items: center; gap: 12px;
    padding: 8px 16px; font-family: 'Cairo', sans-serif;
    font-size: 12px; color: #ddd;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
  `;

  bar.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-inline-end:auto">
      <span style="
        width:28px;height:28px;border-radius:50%;
        background:${roleColor}22;color:${roleColor};
        display:flex;align-items:center;justify-content:center;
        font-weight:700;font-size:13px;flex-shrink:0;
        border:1px solid ${roleColor}44;
      ">${(name[0]||'?').toUpperCase()}</span>
      <span style="color:#fff;font-weight:600">${name}</span>
      <span style="
        background:${roleColor}18;color:${roleColor};
        border:1px solid ${roleColor}44;border-radius:4px;
        padding:2px 7px;font-size:11px;
      ">${roleName}</span>
    </div>
    ${canNews      ? `<a href="${adminUrl}#news"      style="${_barLinkStyle()}" onclick="_siteRbacNav('news',event)">📝 الأخبار</a>` : ''}
    ${canBreaking  ? `<a href="${adminUrl}#breaking"  style="${_barLinkStyle()}" onclick="_siteRbacNav('breaking',event)">⚡ العاجلة</a>` : ''}
    ${canAnalytics ? `<a href="${adminUrl}#analytics" style="${_barLinkStyle()}" onclick="_siteRbacNav('analytics',event)">📊 إحصائيات</a>` : ''}
    <a href="${adminUrl}" style="${_barLinkStyle('#4A9EFF')}">🛡️ لوحة التحكم</a>
    <button onclick="window._siteRbacDismissBar()" style="
      background:transparent;border:none;color:#888;cursor:pointer;
      font-size:16px;padding:4px 8px;line-height:1;
    " title="إخفاء الشريط">✕</button>
  `;

  document.body.appendChild(bar);
  // Pad body so content isn't hidden behind bar
  document.body.style.paddingBottom = Math.max(
    parseInt(document.body.style.paddingBottom || '0', 10), 44
  ) + 'px';
}

function _barLinkStyle(color) {
  const c = color || '#aaa';
  return `
    color:${c};text-decoration:none;padding:5px 10px;border-radius:5px;
    border:1px solid ${c}33;background:${c}10;
    font-size:12px;white-space:nowrap;
    transition:background 0.15s;
  `;
}

// Global helpers called from the toolbar HTML
window._siteRbacNav = function(page, e) {
  e.preventDefault();
  window.open('/admin.html', '_blank');
};

window._siteRbacDismissBar = function() {
  const bar = document.getElementById('site-rbac-adminbar');
  if (bar) {
    bar.style.display = 'none';
    document.body.style.paddingBottom = '';
  }
};

// ================================================================
// PRIVATE HELPERS
// ================================================================

function _loadSession() {
  try {
    const s = localStorage.getItem(LS.RBAC_USER);
    return s ? JSON.parse(s) : null;
  } catch (_) { return null; }
}

function _loadRoles() {
  try {
    const s = localStorage.getItem(LS.RBAC_ROLES);
    if (s) {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (_) {}
  return DEFAULT_ROLES;
}
