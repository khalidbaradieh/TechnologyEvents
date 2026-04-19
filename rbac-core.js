// ================================================================
// rbac-core.js — مصدر الحقيقة الوحيد للصلاحيات والأدوار
// يُستخدم من قِبل admin.html و rbac.html
// ================================================================

export const PERMISSIONS = [
  // محتوى
  { id:'add_articles',    label:'إضافة أخبار',              group:'محتوى',  icon:'➕' },
  { id:'edit_articles',   label:'تعديل الأخبار',            group:'محتوى',  icon:'✏️' },
  { id:'delete_articles', label:'حذف الأخبار',              group:'محتوى',  icon:'🗑' },
  { id:'publish_articles',label:'نشر الأخبار',              group:'محتوى',  icon:'📤' },
  { id:'approve_articles',label:'اعتماد مقالات الكتّاب',    group:'محتوى',  icon:'✅' },
  { id:'schedule_articles',label:'جدولة النشر',             group:'محتوى',  icon:'🗓️' },
  { id:'archive_articles', label:'أرشفة الأخبار',           group:'محتوى',  icon:'🗄️' },
  { id:'rollback_articles',label:'استرجاع النسخ',           group:'محتوى',  icon:'🕘' },
  { id:'view_article_audit',label:'سجل تدقيق الأخبار',      group:'محتوى',  icon:'📜' },
  { id:'bypass_four_eyes', label:'تجاوز نموذج الأربع عيون', group:'محتوى',  icon:'👁️' },
  { id:'import_articles', label:'استيراد الأخبار',          group:'محتوى',  icon:'📥' },
  { id:'ai_generate',     label:'توليد بالذكاء الاصطناعي',  group:'محتوى',  icon:'🤖' },
  // الموقع
  { id:'manage_homepage', label:'الصفحة الرئيسية',          group:'الموقع', icon:'🏠' },
  { id:'manage_cats',     label:'إدارة الأقسام',            group:'الموقع', icon:'📂' },
  { id:'manage_breaking', label:'الأخبار العاجلة',          group:'الموقع', icon:'⚡' },
  { id:'manage_ticker',   label:'شريط الأخبار',             group:'الموقع', icon:'🗞️' },
  { id:'manage_ads',      label:'إدارة الإعلانات',          group:'الموقع', icon:'📣' },
  { id:'manage_nav',      label:'قوائم التنقل',             group:'الموقع', icon:'🔗' },
  { id:'manage_identity', label:'هوية الموقع',              group:'الموقع', icon:'🎨' },
  // النظام
  { id:'manage_users',    label:'إدارة المستخدمين',         group:'النظام', icon:'👥' },
  { id:'view_analytics',  label:'التحليلات والإحصاءات',     group:'النظام', icon:'📊' },
  { id:'view_reports',    label:'التقارير',                 group:'النظام', icon:'📈' },
  { id:'system_settings', label:'إعدادات النظام',           group:'النظام', icon:'⚙️' },
  { id:'manage_emails',   label:'إدارة المشتركين',          group:'النظام', icon:'📧' },
  { id:'manage_inbox',    label:'صندوق الرسائل',            group:'النظام', icon:'✉️' },
];

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
    desc:'إدارة المحتوى والمؤسسة التحريرية والحوكمة التشغيلية',
    perms:['add_articles','edit_articles','delete_articles','publish_articles',
           'approve_articles','schedule_articles','archive_articles',
           'rollback_articles','view_article_audit',
           'import_articles','ai_generate',
           'manage_homepage','manage_cats','manage_breaking','manage_ticker',
           'manage_ads','manage_nav','manage_identity',
           'manage_users','view_analytics','view_reports','system_settings',
           'manage_emails','manage_inbox'],
  },
  {
    id:'publisher', name:'ناشر', icon:'📡', color:'#40C8F0',
    level:65, protected:false,
    desc:'جدولة ونشر وأرشفة المحتوى المعتمد مع الاطلاع على السجل والنسخ',
    perms:['edit_articles','publish_articles','schedule_articles','archive_articles',
           'rollback_articles','view_article_audit',
           'manage_homepage','manage_breaking','manage_ticker','view_analytics'],
  },
  {
    id:'editor', name:'محرر', icon:'✏️', color:'#A078FF',
    level:60, protected:false,
    desc:'تحرير المواد وإرسالها للمراجعة واعتمادها قبل التسليم للنشر',
    perms:['add_articles','edit_articles','approve_articles',
           'rollback_articles','view_article_audit',
           'ai_generate','manage_homepage','manage_breaking','manage_ticker','view_analytics'],
  },
  {
    id:'writer', name:'كاتب', icon:'📝', color:'#3DDC84',
    level:40, protected:false,
    desc:'كتابة مقالات وتقديمها للمراجعة بدون اعتماد أو نشر مباشر',
    perms:['add_articles','edit_articles','view_article_audit'],
  },
  {
    id:'reviewer', name:'مراجع', icon:'🔍', color:'#FF9A3C',
    level:35, protected:false,
    desc:'مراجعة المقالات واعتمادها أو ردّها',
    perms:['edit_articles','approve_articles','view_article_audit','view_analytics'],
  },
  {
    id:'leader', name:'رئيس تحرير', icon:'📋', color:'#40C8F0',
    level:70, protected:false,
    desc:'الإشراف على المحتوى وإدارة فريق التحرير',
    perms:['add_articles','edit_articles','delete_articles','publish_articles',
           'approve_articles','schedule_articles','archive_articles',
           'rollback_articles','view_article_audit',
           'ai_generate','manage_homepage','manage_breaking',
           'manage_ticker','manage_cats','view_analytics','view_reports'],
  },
];

// صلاحية → قائمة صفحات الأدمن
export const PERM_TO_PAGES = {
  add_articles:    ['news'],
  edit_articles:   ['news'],
  delete_articles: ['news'],
  publish_articles:['news'],
  approve_articles:['news'],
  schedule_articles:['news'],
  archive_articles:['news'],
  rollback_articles:['news'],
  view_article_audit:['news'],
  bypass_four_eyes:['news'],
  import_articles: ['news'],           // sub-tab داخل news
  ai_generate:     ['news'],           // sub-tab داخل news
  manage_homepage: ['pagecontrols','general-settings'],
  manage_cats:     ['categories'],
  manage_breaking: ['breaking'],
  manage_ticker:   ['latest'],
  manage_ads:      ['ads-manager'],
  manage_nav:      ['nav-links-manager','footer-control'],
  manage_identity: ['identity'],
  manage_users:    ['editors'],
  view_analytics:  ['analytics'],
  view_reports:    ['analytics'],
  system_settings: ['settings'],
  manage_emails:   ['subscribers'],
  manage_inbox:    ['inbox'],
};

// ────────────────────────────────────────────────
// دوال الصلاحيات
// ────────────────────────────────────────────────

/**
 * يحسب الصلاحيات الفعلية للمستخدم:
 * - إذا كان لديه customPerms → تُستخدم مباشرةً
 * - وإلا يُرث من دوره
 */
export function getEffectivePerms(user, roles) {
  if (!user) return [];
  if (user.customPerms && Array.isArray(user.customPerms)) return user.customPerms;
  const allRoles = roles || loadRolesFromLS();
  const role = allRoles.find(r => r.id === user.roleId);
  if (!role) return [];
  if (role.perms.includes('*')) return ['*'];
  return role.perms || [];
}

/** هل المستخدم يملك الصلاحية المحددة؟ */
export function hasPerm(permId, user, roles) {
  const perms = getEffectivePerms(user, roles);
  return perms.includes('*') || perms.includes(permId);
}

/** هل المستخدم مدير عام أو يملك صلاحية كاملة؟ */
export function isSuperAdmin(user) {
  if (!user) return false;
  return user.roleId === 'manager' || getEffectivePerms(user).includes('*');
}

/** يعيد قائمة صفحات الأدمن المسموح بها بناءً على الصلاحيات */
export function getAllowedPages(user, roles) {
  if (!user) return ['overview'];
  if (isSuperAdmin(user)) return null; // null = كل الصفحات
  const perms = getEffectivePerms(user, roles);
  if (!perms.length) return ['overview'];
  const pages = new Set(['overview']);
  perms.forEach(p => { (PERM_TO_PAGES[p] || []).forEach(pg => pages.add(pg)); });
  return [...pages];
}

/** تقرأ الأدوار من localStorage أو تُعيد الافتراضية */
export function loadRolesFromLS() {
  try {
    const c = JSON.parse(localStorage.getItem('atq_rbac_roles') || '[]');
    if (c && c.length) return c;
  } catch(_) {}
  return DEFAULT_ROLES;
}

/** تقرأ المستخدم الحالي من جلسة RBAC */
export function getCurrentRbacUser() {
  try {
    const stored = localStorage.getItem('atq_rbac_user');
    if (!stored) return null;
    return JSON.parse(stored);
  } catch(_) { return null; }
}

/** تحقق من أن المستخدم يملك صلاحية إدارة مستخدم آخر بمستوى أدنى */
export function canManageUser(actor, target, roles) {
  if (!actor || !target) return false;
  if (isSuperAdmin(actor)) return true;
  if (!hasPerm('manage_users', actor, roles)) return false;
  const allRoles = roles || loadRolesFromLS();
  const actorRole  = allRoles.find(r => r.id === actor.roleId);
  const targetRole = allRoles.find(r => r.id === target.roleId);
  if (!actorRole || !targetRole) return false;
  return actorRole.level > targetRole.level;
}
