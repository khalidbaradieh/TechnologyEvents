# Admin Panel — RBAC Refactor Summary

## Architecture Overview

```
rbac-core.js          ← Single source of truth for RBAC constants
    ↓
admin.html            ← Uses RBAC_PAGE_MAP + _getRbacAllowedPages()
rbac.html             ← Uses PERM_TO_PAGES (same data, same logic)
    ↓
localStorage:
  atq_rbac_user       ← Current session { roleId, customPerms }
  atq_rbac_roles      ← Custom roles from rbac.html
  atq_editors         ← Users list with roleId field
  atq_user_passwords  ← Login credentials
```

## Changes Made

### admin.html — Critical RBAC Fixes

| # | Issue | Fix |
|---|-------|-----|
| 1 | `showPage()` checked `ROLE_PERMS['مدير']` (legacy) | Now uses `_getRbacAllowedPages()` exclusively |
| 2 | `applyRolePermissions()` had Arabic-string fallback | Removed — RBAC-only via `_getCurrentRbacUser()` |
| 3 | `doLogin()` guessed roleId from Arabic string | Now reads `ed.roleId` from editorsData, falls back to `'editor'` |
| 4 | Editor modal had 3 legacy Arabic roles | Now has 5 RBAC roleIds: admin, leader, editor, reviewer, writer |
| 5 | `saveEditor()` saved `role:'محرر'` (Arabic string) | Now saves `roleId:'editor'` + `role:'محرر'` (display label) |
| 6 | `renderEditors()` badge class checked Arabic string | Now checks `e.roleId` with Arabic label fallback |
| 7 | `_currentAllowedCats()` checked `role === 'مدير'` | Now checks `roleId === 'manager' \|\| roleId === 'admin'` |
| 8 | Default `editorsData` had no `roleId` field | Added `roleId` to all 6 default editors |
| 9 | News sub-tabs (AI, Import) shown to all roles | Now hidden based on `ai_generate` / `import_articles` perms |
| 10 | `_RBAC_FALLBACK_ROLES` only had 4 roles | Added `leader` (level 70) and `reviewer` (level 35) |
| 11 | Dead `saveEditor_OLD_REPLACED()` function existed | Removed |
| 12 | `ROLE_PERMS` object was unused but present | Removed |
| 13 | Sidebar role badge only showed Arabic text | Now shows role icon (👑🛡️📋✏️🔍📝) + label |
| 14 | `_refreshEditorScope` didn't re-sync RBAC session | Now re-syncs `atq_rbac_user.roleId` after Firebase refresh |

### rbac.html — Role Updates

| # | Change |
|---|--------|
| 1 | Added `leader` role (level 70) — رئيس تحرير |
| 2 | Added `reviewer` role (level 35) — مراجع |
| 3 | `PERM_TO_PAGES` synced with admin.html `RBAC_PAGE_MAP` |
| 4 | `import_articles` and `ai_generate` now map to `['news']` not separate pages |
| 5 | `manage_nav` now includes `footer-control` page |

### rbac-core.js — New Shared Module

Exports:
- `PERMISSIONS` — 20 permission definitions
- `DEFAULT_ROLES` — 6 built-in roles  
- `PERM_TO_PAGES` — permission → page mapping
- `getEffectivePerms(user, roles)` — resolves custom or role-based perms
- `hasPerm(permId, user, roles)` — single permission check
- `isSuperAdmin(user)` — checks for * wildcard
- `getAllowedPages(user, roles)` — returns allowed page list
- `loadRolesFromLS()` — reads from localStorage with fallback
- `getCurrentRbacUser()` — reads session
- `canManageUser(actor, target, roles)` — hierarchy check

## Role Hierarchy (Final)

| Role | ID | Level | Key Permissions |
|------|----|-------|----------------|
| المدير العام | manager | 100 | `*` (everything) |
| مدير | admin | 80 | All except system_settings |
| رئيس تحرير | leader | 70 | Content management + analytics |
| محرر | editor | 60 | Add/edit/publish + AI + breaking |
| كاتب | writer | 40 | Add/edit articles only |
| مراجع | reviewer | 35 | Edit + approve + analytics |

## Permission Enforcement

Every page access goes through this chain:

```
showPage(id) 
  → _getCurrentRbacUser()         reads atq_rbac_user
  → _getRbacAllowedPages()        maps perms → pages
  → block if page not in list
  
applyRolePermissions()
  → hides sidebar nav items       attribute-based
  → hides news sub-tabs           ntab-ai-news, ntab-fetch-news
  → redirects if on forbidden page
```

## Deployment Notes

1. Deploy all 4 files: `admin.html`, `rbac.html`, `rbac-core.js`, `config.js`
2. `api/anthropic.js` is unchanged
3. Firebase Firestore schema is unchanged
4. All localStorage keys are unchanged — existing user sessions remain valid
5. Existing users without `roleId` field default to `'editor'` role on next login

