export const WORKFLOW_STATES = Object.freeze({
  DRAFT: 'draft',
  REVIEW: 'review',
  APPROVED: 'approved',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

export const WORKFLOW_ORDER = Object.freeze([
  WORKFLOW_STATES.DRAFT,
  WORKFLOW_STATES.REVIEW,
  WORKFLOW_STATES.APPROVED,
  WORKFLOW_STATES.SCHEDULED,
  WORKFLOW_STATES.PUBLISHED,
  WORKFLOW_STATES.ARCHIVED,
]);

export const WORKFLOW_LABELS = Object.freeze({
  [WORKFLOW_STATES.DRAFT]: 'مسودة',
  [WORKFLOW_STATES.REVIEW]: 'قيد المراجعة',
  [WORKFLOW_STATES.APPROVED]: 'معتمد',
  [WORKFLOW_STATES.SCHEDULED]: 'مجدول',
  [WORKFLOW_STATES.PUBLISHED]: 'منشور',
  [WORKFLOW_STATES.ARCHIVED]: 'مؤرشف',
});

export const WORKFLOW_BADGE_CLASSES = Object.freeze({
  [WORKFLOW_STATES.DRAFT]: 'badge-draft',
  [WORKFLOW_STATES.REVIEW]: 'badge-review',
  [WORKFLOW_STATES.APPROVED]: 'badge-approved',
  [WORKFLOW_STATES.SCHEDULED]: 'badge-scheduled',
  [WORKFLOW_STATES.PUBLISHED]: 'badge-published',
  [WORKFLOW_STATES.ARCHIVED]: 'badge-archived',
});

export const WORKFLOW_ACTIONS = Object.freeze({
  CREATE: 'create',
  EDIT: 'edit',
  SUBMIT_REVIEW: 'submit_review',
  APPROVE: 'approve',
  SCHEDULE: 'schedule',
  PUBLISH: 'publish',
  ARCHIVE: 'archive',
  ROLLBACK: 'rollback',
  DELETE: 'delete',
});

export const ENTERPRISE_PERMISSION_IDS = Object.freeze({
  SCHEDULE: 'schedule_articles',
  ARCHIVE: 'archive_articles',
  ROLLBACK: 'rollback_articles',
  VIEW_AUDIT: 'view_article_audit',
  BYPASS_FOUR_EYES: 'bypass_four_eyes',
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isValidDate(value) {
  return !Number.isNaN(new Date(value).getTime());
}

export function actorKey(actor) {
  if (!actor) return '';
  return String(actor.username || actor.id || actor.user || '').trim();
}

export function actorName(actor) {
  if (!actor) return 'النظام';
  return actor.name || actor.username || actor.user || 'النظام';
}

export function actorRef(actor) {
  return {
    key: actorKey(actor),
    id: actor?.id || actor?.username || actor?.user || 'system',
    username: actor?.username || actor?.user || '',
    name: actorName(actor),
    roleId: actor?.roleId || 'system',
  };
}

export function toDatetimeLocalValue(value) {
  if (!value || !isValidDate(value)) return '';
  const date = new Date(value);
  const pad = n => String(n).padStart(2, '0');
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}

export function toIsoString(value) {
  if (!value) return '';
  if (typeof value === 'string' && value.includes('T') && isValidDate(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return new Date(value).toISOString();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return '';
}

export function formatWorkflowDateTime(value) {
  if (!value || !isValidDate(value)) return '—';
  return new Date(value).toLocaleString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function mapLegacyStatusToWorkflow(status) {
  const s = String(status || '').trim();
  if (s === 'منشور') return WORKFLOW_STATES.PUBLISHED;
  if (s === 'مؤرشف') return WORKFLOW_STATES.ARCHIVED;
  return WORKFLOW_STATES.DRAFT;
}

export function getWorkflowLabel(state) {
  return WORKFLOW_LABELS[state] || WORKFLOW_LABELS[WORKFLOW_STATES.DRAFT];
}

export function getLegacyStatusForState(state) {
  if (state === WORKFLOW_STATES.PUBLISHED) return 'منشور';
  if (state === WORKFLOW_STATES.ARCHIVED) return 'مؤرشف';
  return 'مسودة';
}

export function getExactWorkflowState(article) {
  return article?.workflowState || mapLegacyStatusToWorkflow(article?.status);
}

export function isScheduledDue(article, now = Date.now()) {
  const state = getExactWorkflowState(article);
  if (state !== WORKFLOW_STATES.SCHEDULED) return false;
  if (!article?.scheduledAt || !isValidDate(article.scheduledAt)) return false;
  return new Date(article.scheduledAt).getTime() <= now;
}

export function getEffectiveWorkflowState(article, now = Date.now()) {
  const exact = getExactWorkflowState(article);
  if (exact === WORKFLOW_STATES.SCHEDULED && isScheduledDue(article, now)) {
    return WORKFLOW_STATES.PUBLISHED;
  }
  return exact;
}

export function isLiveArticle(article, now = Date.now()) {
  return getEffectiveWorkflowState(article, now) === WORKFLOW_STATES.PUBLISHED;
}

export function isOwnArticle(article, actor) {
  const creatorKey = String(article?.createdByKey || article?.createdBy || '').trim();
  const currentKey = actorKey(actor);
  return !!creatorKey && !!currentKey && creatorKey === currentKey;
}

export function canBypassFourEyes(actor, hasPerm) {
  if (!actor) return false;
  if (actor.roleId === 'manager') return true;
  if (typeof hasPerm !== 'function') return false;
  return !!hasPerm(ENTERPRISE_PERMISSION_IDS.BYPASS_FOUR_EYES);
}

export function materializeArticleForView(article, now = Date.now()) {
  const item = clone(article || {});
  const exactState = getExactWorkflowState(item);
  const effectiveState = getEffectiveWorkflowState(item, now);
  item.workflowState = exactState;
  item.effectiveWorkflowState = effectiveState;
  item.workflowLabel = getWorkflowLabel(exactState);
  item.workflowBadgeClass = WORKFLOW_BADGE_CLASSES[exactState] || WORKFLOW_BADGE_CLASSES[WORKFLOW_STATES.DRAFT];
  item.status = getLegacyStatusForState(effectiveState);
  item.legacyStatus = item.status;
  item.version = Number(item.version || 1);
  item.isLive = effectiveState === WORKFLOW_STATES.PUBLISHED;
  item.isDueScheduled = exactState === WORKFLOW_STATES.SCHEDULED && effectiveState === WORKFLOW_STATES.PUBLISHED;
  item.scheduledAt = toIsoString(item.scheduledAt) || '';
  item.createdAtIso = item.createdAtIso || item.createdAt || '';
  item.updatedAtIso = item.updatedAtIso || item.updatedAt || '';
  return item;
}

export function normalizeArticles(items, now = Date.now()) {
  return (items || []).map(item => materializeArticleForView(item, now));
}

export function getDefaultWorkflowStateForActor(actor, hasPerm) {
  return WORKFLOW_STATES.DRAFT;
}

export function validateWorkflowTransition({ article, targetState, actor, hasPerm }) {
  const current = getExactWorkflowState(article);
  const ownArticle = isOwnArticle(article, actor);
  const bypass = canBypassFourEyes(actor, hasPerm);
  const can = permId => (typeof hasPerm === 'function' ? !!hasPerm(permId) : false);

  if (!targetState || !WORKFLOW_ORDER.includes(targetState)) {
    return { ok: false, reason: 'مرحلة النشر غير صالحة.' };
  }

  if (targetState === current) return { ok: true, action: WORKFLOW_ACTIONS.EDIT };

  if (targetState === WORKFLOW_STATES.DRAFT) {
    return { ok: can('edit_articles') || can('add_articles'), action: WORKFLOW_ACTIONS.EDIT, reason: 'لا تملك صلاحية تعديل الخبر.' };
  }

  if (targetState === WORKFLOW_STATES.REVIEW) {
    return {
      ok: can('edit_articles') || can('add_articles'),
      action: WORKFLOW_ACTIONS.SUBMIT_REVIEW,
      reason: 'لا تملك صلاحية إرسال الخبر للمراجعة.',
    };
  }

  if (targetState === WORKFLOW_STATES.APPROVED) {
    if (!can('approve_articles')) return { ok: false, reason: 'لا تملك صلاحية اعتماد الأخبار.' };
    if (ownArticle && !bypass) return { ok: false, reason: 'نموذج الأربع عيون يمنعك من اعتماد خبرك بنفسك.' };
    return { ok: true, action: WORKFLOW_ACTIONS.APPROVE };
  }

  if (targetState === WORKFLOW_STATES.SCHEDULED) {
    if (!can(ENTERPRISE_PERMISSION_IDS.SCHEDULE)) return { ok: false, reason: 'لا تملك صلاحية جدولة الأخبار.' };
    if (ownArticle && !bypass) return { ok: false, reason: 'لا يمكنك جدولة خبرك بنفسك بدون صلاحية استثناء من RBAC.' };
    if (current !== WORKFLOW_STATES.APPROVED && current !== WORKFLOW_STATES.SCHEDULED && !can('approve_articles')) {
      return { ok: false, reason: 'يجب اعتماد الخبر قبل جدولته.' };
    }
    if ((current === WORKFLOW_STATES.DRAFT || current === WORKFLOW_STATES.REVIEW) && ownArticle && !bypass) {
      return { ok: false, reason: 'يجب أن يعتمد شخص آخر خبرك قبل جدولته.' };
    }
    return { ok: true, action: WORKFLOW_ACTIONS.SCHEDULE };
  }

  if (targetState === WORKFLOW_STATES.PUBLISHED) {
    if (!can('publish_articles')) return { ok: false, reason: 'لا تملك صلاحية نشر الأخبار.' };
    if (ownArticle && !bypass) return { ok: false, reason: 'لا يمكنك نشر خبرك بنفسك بدون صلاحية استثناء من RBAC.' };
    if (
      current !== WORKFLOW_STATES.APPROVED &&
      current !== WORKFLOW_STATES.SCHEDULED &&
      current !== WORKFLOW_STATES.PUBLISHED &&
      !can('approve_articles')
    ) {
      return { ok: false, reason: 'يجب اعتماد الخبر قبل نشره.' };
    }
    if ((current === WORKFLOW_STATES.DRAFT || current === WORKFLOW_STATES.REVIEW) && ownArticle && !bypass) {
      return { ok: false, reason: 'يجب أن يعتمد شخص آخر خبرك قبل نشره.' };
    }
    return { ok: true, action: WORKFLOW_ACTIONS.PUBLISH };
  }

  if (targetState === WORKFLOW_STATES.ARCHIVED) {
    if (!can(ENTERPRISE_PERMISSION_IDS.ARCHIVE)) {
      return { ok: false, reason: 'لا تملك صلاحية أرشفة الأخبار.' };
    }
    return { ok: true, action: WORKFLOW_ACTIONS.ARCHIVE };
  }

  return { ok: false, reason: 'الانتقال المطلوب غير مدعوم.' };
}

export function summarizeAction(action, state) {
  const labels = {
    [WORKFLOW_ACTIONS.CREATE]: 'إنشاء خبر',
    [WORKFLOW_ACTIONS.EDIT]: 'تحديث الخبر',
    [WORKFLOW_ACTIONS.SUBMIT_REVIEW]: 'إرسال للمراجعة',
    [WORKFLOW_ACTIONS.APPROVE]: 'اعتماد خبر',
    [WORKFLOW_ACTIONS.SCHEDULE]: 'جدولة خبر',
    [WORKFLOW_ACTIONS.PUBLISH]: 'نشر خبر',
    [WORKFLOW_ACTIONS.ARCHIVE]: 'أرشفة خبر',
    [WORKFLOW_ACTIONS.ROLLBACK]: 'استرجاع نسخة',
    [WORKFLOW_ACTIONS.DELETE]: 'حذف خبر',
  };
  const base = labels[action] || 'تحديث خبر';
  if (!state) return base;
  return `${base} — ${getWorkflowLabel(state)}`;
}

export function createVersionEntry(article, actor, reason, now = Date.now()) {
  const snapshot = clone(article);
  delete snapshot.effectiveWorkflowState;
  delete snapshot.workflowLabel;
  delete snapshot.workflowBadgeClass;
  delete snapshot.isLive;
  delete snapshot.isDueScheduled;
  delete snapshot.legacyStatus;

  return {
    articleId: article.id,
    articleTitle: article.title || '—',
    version: Number(article.version || 1),
    reason: reason || summarizeAction(WORKFLOW_ACTIONS.EDIT, getExactWorkflowState(article)),
    snapshot,
    actor: actorRef(actor),
    createdAt: new Date(now).toISOString(),
    createdAtTs: now,
  };
}

export function createAuditEntry({
  article,
  previousArticle,
  actor,
  action,
  details,
  now = Date.now(),
  extra = {},
}) {
  return {
    articleId: article?.id,
    articleTitle: article?.title || '—',
    action,
    details: details || summarizeAction(action, getExactWorkflowState(article)),
    previousState: previousArticle ? getExactWorkflowState(previousArticle) : null,
    nextState: article ? getExactWorkflowState(article) : null,
    actor: actorRef(actor),
    createdAt: new Date(now).toISOString(),
    createdAtTs: now,
    version: Number(article?.version || previousArticle?.version || 1),
    ...extra,
  };
}

export function computeWorkflowMetrics(items, now = Date.now()) {
  const normalized = normalizeArticles(items, now);
  const exactCounts = {
    [WORKFLOW_STATES.DRAFT]: 0,
    [WORKFLOW_STATES.REVIEW]: 0,
    [WORKFLOW_STATES.APPROVED]: 0,
    [WORKFLOW_STATES.SCHEDULED]: 0,
    [WORKFLOW_STATES.PUBLISHED]: 0,
    [WORKFLOW_STATES.ARCHIVED]: 0,
  };

  normalized.forEach(item => {
    const exact = item.workflowState;
    if (exactCounts[exact] !== undefined) exactCounts[exact] += 1;
  });

  const scheduledUpcoming = normalized.filter(item => item.workflowState === WORKFLOW_STATES.SCHEDULED && !item.isDueScheduled).length;
  const publishedLive = normalized.filter(item => item.isLive).length;

  return {
    total: normalized.length,
    drafts: exactCounts[WORKFLOW_STATES.DRAFT],
    inReview: exactCounts[WORKFLOW_STATES.REVIEW],
    approved: exactCounts[WORKFLOW_STATES.APPROVED],
    scheduled: scheduledUpcoming,
    published: publishedLive,
    archived: exactCounts[WORKFLOW_STATES.ARCHIVED],
    dueScheduled: normalized.filter(item => item.isDueScheduled).length,
  };
}
