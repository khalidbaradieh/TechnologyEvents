// ================================================================
// admin-rbac.js  —  RBAC Helper Layer for Admin Panel
// Version: 2.0.0
//
// Imports canonical definitions from rbac-engine.js and provides
// localStorage session management helpers for admin.js.
//
// IMPORTANT: Do not define roles, permissions, or page maps here.
//            All definitions live in rbac-engine.js.
// ================================================================

import {
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
} from '/assets/js/rbac-engine.js';

// Re-export everything for consumers that import from admin-rbac.js
export {
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

// ── localStorage key constants ───────────────────────────────────
const LS = {
  RBAC_USER:  'atq_rbac_user',
  RBAC_ROLES: 'atq_rbac_roles',
  EDITORS:    'atq_editors',
  PASSWORDS:  'atq_user_passwords',
};

// ── Load roles from localStorage cache ───────────────────────────
// Falls back to DEFAULT_ROLES if cache is missing or invalid.
export function loadRoles() {
  try {
    const stored = localStorage.getItem(LS.RBAC_ROLES);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (_) {}
  return DEFAULT_ROLES;
}

// ── Load current RBAC session ────────────────────────────────────
export function loadRbacSession() {
  try {
    const stored = localStorage.getItem(LS.RBAC_USER);
    if (stored) return JSON.parse(stored);
  } catch (_) {}
  return null;
}

// ── Save RBAC session ────────────────────────────────────────────
export function saveRbacSession(sessionObj) {
  try { localStorage.setItem(LS.RBAC_USER, JSON.stringify(sessionObj)); } catch (_) {}
}

// ── Clear RBAC session ───────────────────────────────────────────
export function clearRbacSession() {
  try { localStorage.removeItem(LS.RBAC_USER); } catch (_) {}
}

// ── Check if session has access to RBAC panel ────────────────────
export function sessionCanAccessRbac() {
  const session = loadRbacSession();
  const roles   = loadRoles();
  return canAccessRbacPanel(session, roles);
}

// ── Get allowed page IDs for current session ─────────────────────
export function getSessionAllowedPages() {
  const session = loadRbacSession();
  const roles   = loadRoles();
  return getAllowedPages(session, roles);
}

// ── Check a permission for current session ───────────────────────
export function sessionHasPerm(perm) {
  const session = loadRbacSession();
  const roles   = loadRoles();
  return hasPerm(perm, session, roles);
}
