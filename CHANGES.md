# News Admin Panel — Enterprise Publishing Refactor

## What changed

This refactor keeps the existing site behavior and UI structure intact, while upgrading the news admin flow to a more enterprise-safe publishing model:

- Editorial workflow: `Draft → Review → Approved → Scheduled → Published → Archived`
- Role-aware publishing controls integrated with the existing RBAC system
- Four-eyes enforcement: creators cannot approve or publish their own articles unless granted the dedicated RBAC bypass permission
- Full article audit trail and version snapshots stored in Firestore
- Rollback support from version history
- Scheduled publishing support for future release times
- News dashboard workflow metrics inside the admin panel
- Shared workflow module reused by both `admin.html` and `index.html`

## New / updated files

- `news-workflow-core.js`
  Shared publishing logic:
  workflow states, labels, badge mapping, scheduling helpers, four-eyes validation,
  audit/version payload builders, and dashboard metrics.

- `rbac-core.js`
  Expanded permissions matrix with enterprise news controls:
  `schedule_articles`, `archive_articles`, `rollback_articles`,
  `view_article_audit`, `bypass_four_eyes`

- `admin.html`
  News workflow metrics, governance summary in the editor modal,
  audit/version history modal, workflow-aware actions, scheduler sync,
  and article lifecycle persistence with versioning + audit logs.

- `index.html`
  Now materializes workflow-aware articles via the shared workflow module so
  scheduled content can go live without exposing drafts/review states publicly.

- `config.js`
  Added Firestore collection constants:
  `news_audit`, `news_versions`

- `vercel.json`
  Added no-cache header for the shared workflow module.

## Firestore additions

Existing collections remain unchanged and compatible.

New collections:

- `news_audit/{entryId}`
  One audit record per article action

- `news_versions/{entryId}`
  One immutable snapshot per saved version

## RBAC model

Enterprise publishing permissions are now first-class in the RBAC matrix.

Key roles available by default:

- `writer`
- `editor`
- `publisher`
- `admin`
- `manager` remains the super-admin role

Legacy roles such as `leader` and `reviewer` are preserved for compatibility.

## Compatibility notes

- Public site rendering still relies on the legacy `status` field for compatibility,
  but that field is now derived from the richer `workflowState`
- Existing news documents without enterprise fields are normalized automatically
- Existing Firebase hosting / Vercel / GitHub deployment flow remains compatible
- Existing admin features such as AI news, imported news, latest ticker, breaking news,
  pinning, comments toggles, and category management are preserved
