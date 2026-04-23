// ================================================================
// assets/js/rbac.js — RBAC user/role/permission management script
// Extracted from rbac.html. Import path updated for /assets/js/ location.
// ================================================================

import { FIREBASE_CONFIG, DB } from '/config.js';
import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, addDoc, getDocs, query, orderBy, limit }
         from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const _app = initializeApp(FIREBASE_CONFIG);
const _db  = getFirestore(_app);

// ─── CONSTANTS ────────────────────────────────────────────────
const PERMISSIONS = [
  // محتوى
  { id:'add_articles',    label:'إضافة أخبار',              group:'محتوى',  icon:'➕' },
  { id:'edit_articles',   label:'تعديل الأخبار',             group:'محتوى',  icon:'✏️' },
  { id:'delete_articles', label:'حذف الأخبار',               group:'محتوى',  icon:'🗑' },
  { id:'publish_articles',label:'نشر الأخبار',               group:'محتوى',  icon:'📤' },
  { id:'approve_articles',label:'اعتماد مقالات الكتّاب',     group:'محتوى',  icon:'✅' },
  { id:'import_articles', label:'استيراد الأخبار',           group:'محتوى',  icon:'📥' },
  { id:'ai_generate',     label:'توليد بالذكاء الاصطناعي',   group:'محتوى',  icon:'🤖' },
  // الموقع
  { id:'manage_homepage', label:'الصفحة الرئيسية',           group:'الموقع', icon:'🏠' },
  { id:'manage_cats',     label:'إدارة الأقسام',             group:'الموقع', icon:'📂' },
  { id:'manage_breaking', label:'الأخبار العاجلة',           group:'الموقع', icon:'⚡' },
  { id:'manage_ticker',   label:'شريط الأخبار',              group:'الموقع', icon:'🗞️' },
  { id:'manage_ads',      label:'إدارة الإعلانات',           group:'الموقع', icon:'📣' },
  { id:'manage_nav',      label:'قوائم التنقل',              group:'الموقع', icon:'🔗' },
  { id:'manage_identity', label:'هوية الموقع',               group:'الموقع', icon:'🎨' },
  // النظام
  { id:'manage_users',    label:'إدارة المستخدمين',          group:'النظام', icon:'👥' },
  { id:'view_analytics',  label:'التحليلات والإحصاءات',      group:'النظام', icon:'📊' },
  { id:'view_reports',    label:'التقارير',                  group:'النظام', icon:'📈' },
  { id:'system_settings', label:'إعدادات النظام',            group:'النظام', icon:'⚙️' },
  { id:'manage_emails',   label:'إدارة المشتركين',           group:'النظام', icon:'📧' },
  { id:'manage_inbox',    label:'صندوق الرسائل',             group:'النظام', icon:'✉️' },
];

const DEFAULT_ROLES = [
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

// Map RBAC permissions → admin.html page IDs
const PERM_TO_PAGES = {
  add_articles:    ['news'],
  edit_articles:   ['news'],
  delete_articles: ['news'],
  publish_articles:['news'],
  approve_articles:['news'],
  import_articles: ['import'],
  ai_generate:     ['ai-generator'],
  manage_homepage: ['pagecontrols','general-settings'],
  manage_cats:     ['categories'],
  manage_breaking: ['breaking'],
  manage_ticker:   ['latest'],
  manage_ads:      ['ads-manager'],
  manage_nav:      ['nav-links-manager'],
  manage_identity: ['identity'],
  manage_users:    ['editors'],
  view_analytics:  ['analytics'],
  view_reports:    ['analytics'],
  system_settings: ['settings'],
  manage_emails:   ['subscribers'],
  manage_inbox:    ['inbox'],
};

// ─── STATE ────────────────────────────────────────────────────
let rbacRoles  = [...DEFAULT_ROLES];
let users      = [];
let activityLog = [];
let catsData   = [];
let curUser    = null;
let matrixEditing = false;
let matrixDraft   = null;   // copy being edited
let _uSelectedRole = 'editor';

// ─── AUTH CHECK ───────────────────────────────────────────────
function checkAuth() {
  try {
    const stored = localStorage.getItem('atq_rbac_user');
    if (!stored) return false;
    const u = JSON.parse(stored);
    if (!u || !u.roleId) return false;
    const role = rbacRoles.find(r => r.id === u.roleId);
    if (!role) return false;
    const perms = getEffectivePerms(u);
    // Must have manage_users OR be manager
    if (u.roleId === 'manager' || perms.includes('manage_users') || perms.includes('*')) {
      curUser = u;
      return true;
    }
    return false;
  } catch { return false; }
}

function getEffectivePerms(user) {
  if (!user) return [];
  if (user.customPerms && Array.isArray(user.customPerms)) return user.customPerms;
  const role = rbacRoles.find(r => r.id === user.roleId);
  if (!role) return [];
  if (role.perms.includes('*')) return ['*'];
  return role.perms || [];
}

function hasPerm(permId, user) {
  const u = user || curUser;
  if (!u) return false;
  const perms = getEffectivePerms(u);
  return perms.includes('*') || perms.includes(permId);
}

// ─── FIREBASE ─────────────────────────────────────────────────
async function loadData() {
  // Load roles
  const rbacSnap = await getDoc(doc(_db, DB.SETTINGS, 'rbac'));
  if (rbacSnap.exists() && rbacSnap.data().roles && rbacSnap.data().roles.length) {
    rbacRoles = rbacSnap.data().roles;
  } else {
    // First run — bootstrap defaults
    await setDoc(doc(_db, DB.SETTINGS, 'rbac'), { roles: DEFAULT_ROLES });
  }

  // Load users via snapshot listener (live updates)
  onSnapshot(doc(_db, DB.SETTINGS, 'editors'), snap => {
    users = snap.exists() ? (snap.data().items || []) : [];
    renderUsers(); renderStats(); renderRoles();
  });

  // Load cats
  const catsSnap = await getDoc(doc(_db, DB.SETTINGS, DB.S.CATS));
  if (catsSnap.exists()) catsData = catsSnap.data().items || [];

  // Load activity log
  loadActivityLog();
}

async function saveUsers() {
  await setDoc(doc(_db, DB.SETTINGS, 'editors'), { items: users });
  // sync to localStorage for admin.html auth
  localStorage.setItem('atq_editors', JSON.stringify(users));
  syncPasswordsToLS();
}

function syncPasswordsToLS() {
  const map = {};
  users.forEach(u => { if (u.user && u.pass && u.active !== false) map[u.user] = u.pass; });
  localStorage.setItem('atq_user_passwords', JSON.stringify(map));
}

async function saveRoles() {
  await setDoc(doc(_db, DB.SETTINGS, 'rbac'), { roles: rbacRoles });
  localStorage.setItem('atq_rbac_roles', JSON.stringify(rbacRoles));
  // Tell parent to reload rbac data
  window.parent.postMessage({ type:'rbac:roles_updated', roles: rbacRoles }, '*');
}

async function loadActivityLog() {
  try {
    const snap = await getDoc(doc(_db, DB.SETTINGS, 'activity_log'));
    activityLog = snap.exists() ? (snap.data().entries || []) : [];
    renderLog();
  } catch { activityLog = []; }
}

async function logActivity(action, details) {
  if (!curUser) return;
  const entry = {
    id:       Date.now(),
    ts:       new Date().toISOString(),
    userId:   curUser.id || curUser.username,
    userName: curUser.name,
    action,
    details,
  };
  activityLog.unshift(entry);
  if (activityLog.length > 200) activityLog = activityLog.slice(0, 200);
  try {
    await setDoc(doc(_db, DB.SETTINGS, 'activity_log'), { entries: activityLog });
  } catch {}
  renderLog();
}

// ─── RENDER ───────────────────────────────────────────────────
function renderStats() {
  const total    = users.length;
  const active   = users.filter(u => u.active !== false).length;
  const roleCounts = {};
  rbacRoles.forEach(r => { roleCounts[r.id] = 0; });
  users.forEach(u => { if (roleCounts[u.roleId] !== undefined) roleCounts[u.roleId]++; else roleCounts[u.roleId] = 1; });

  const el = document.getElementById('stats-row');
  const stats = [
    { val: total,  lbl: 'إجمالي الأعضاء',    dot: null,          clr: '' },
    { val: active, lbl: 'الأعضاء النشطون',   dot: '#3DDC84',     clr: '' },
    { val: total - active, lbl: 'موقوفون',   dot: '#FF5252',     clr: '' },
    ...rbacRoles.map(r => ({ val: roleCounts[r.id] || 0, lbl: r.name, dot: r.color, clr: r.color })),
  ];
  el.innerHTML = stats.map(s => `
    <div class="stat-card" style="${s.clr ? 'border-color:' + s.clr + '33' : ''}">
      <div class="s-val" style="${s.clr ? 'color:' + s.clr : ''}">${s.val}</div>
      <div class="s-lbl">${s.dot ? '<span class="s-dot" style="background:' + s.dot + '"></span>' : ''}${s.lbl}</div>
    </div>`).join('');
}

function renderUsers() {
  const q    = (document.getElementById('user-search')?.value || '').trim().toLowerCase();
  const rf   = document.getElementById('role-filter')?.value || '';
  const sf   = document.getElementById('status-filter')?.value || '';

  let list = [...users];
  if (q)  list = list.filter(u => u.name?.toLowerCase().includes(q) || u.user?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  if (rf) list = list.filter(u => u.roleId === rf);
  if (sf === 'active')    list = list.filter(u => u.active !== false);
  if (sf === 'suspended') list = list.filter(u => u.active === false);

  const grid = document.getElementById('users-grid');
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state"><div class="es-icon">👥</div><p>لا توجد نتائج</p></div>';
    return;
  }

  grid.innerHTML = list.map(u => {
    const role   = rbacRoles.find(r => r.id === u.roleId) || { name:'غير محدد', color:'#666', icon:'?', level:0 };
    const active = u.active !== false;
    const perms  = getEffectivePerms(u);
    const pAll   = perms.includes('*');
    const permPrev = pAll ? '<span class="perm-tag">جميع الصلاحيات</span>'
      : perms.slice(0,3).map(p => {
          const pm = PERMISSIONS.find(x => x.id === p);
          return pm ? `<span class="perm-tag">${pm.label}</span>` : '';
        }).join('') + (perms.length > 3 ? `<span class="perm-tag">+${perms.length - 3}</span>` : '');

    const initials = (u.name || '?').split(' ').slice(0,2).map(w => w[0]).join('');
    const canEdit   = curUser && (curUser.roleId === 'manager' || (hasPerm('manage_users') && role.level < (rbacRoles.find(r=>r.id===curUser.roleId)?.level||0)));
    const canDelete = curUser?.roleId === 'manager' && u.roleId !== 'manager';

    return `<div class="user-card" style="--role-color:${role.color}">
      <div class="card-top">
        <div class="avatar" style="background:${role.color}22;color:${role.color};width:42px;height:42px;font-size:15px">${initials}</div>
        <div style="flex:1;overflow:hidden">
          <div class="card-name">${u.name}</div>
          <div class="card-username">@${u.user || '—'}</div>
        </div>
        <span class="status-dot" style="background:${active ? '#3DDC84' : '#FF5252'}"></span>
      </div>
      <div class="card-email" title="${u.email || ''}">${u.email || '—'}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span class="role-badge" style="background:${role.color}18;color:${role.color};border:1px solid ${role.color}44">${role.icon} ${role.name}</span>
        <span style="font-size:11px;color:var(--text-dim)">${active ? '● نشط' : '○ موقوف'}</span>
      </div>
      <div class="perm-tags">${permPrev}</div>
      <div class="user-meta">
        <span>${u.articles || 0} مقال</span>
        <span>${u.allowedCats?.length ? u.allowedCats.length + ' قسم' : 'جميع الأقسام'}</span>
        <span>${u.lastActive ? new Date(u.lastActive).toLocaleDateString('ar-EG') : '—'}</span>
      </div>
      <div class="card-actions">
        ${canEdit ? `<button class="btn-icon" onclick="editUser(${u.id})" title="تعديل">✏️ تعديل</button>` : ''}
        ${canEdit ? `<button class="btn-icon ${active ? '' : 'success'}" onclick="toggleUserActive(${u.id})" title="${active ? 'تعليق' : 'تفعيل'}">${active ? '⏸ تعليق' : '▶ تفعيل'}</button>` : ''}
        ${canDelete ? `<button class="btn-icon danger" onclick="deleteUser(${u.id})" title="حذف">🗑</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderRoles() {
  // Populate role filter dropdown
  const rf = document.getElementById('role-filter');
  if (rf) {
    rf.innerHTML = '<option value="">كل الأدوار</option>' +
      rbacRoles.map(r => `<option value="${r.id}">${r.icon} ${r.name}</option>`).join('');
  }

  // Roles tab
  const sorted = [...rbacRoles].sort((a,b) => b.level - a.level);
  const isManager = curUser?.roleId === 'manager';
  if (isManager) document.getElementById('add-role-btn').style.display = '';

  document.getElementById('roles-container').innerHTML = sorted.map(r => {
    const count = users.filter(u => u.roleId === r.id).length;
    const permCount = r.perms.includes('*') ? PERMISSIONS.length : r.perms.length;
    const pct = r.level;
    return `<div class="role-row" style="--role-clr:${r.color}">
      <div class="role-icon">${r.icon}</div>
      <div class="role-info">
        <div class="role-name" style="color:${r.color}">${r.name}</div>
        <div class="role-desc">${r.desc}</div>
        <div class="role-level-bar"><div class="role-level-fill" style="width:${pct}%;background:${r.color}"></div></div>
      </div>
      <div class="role-stats">
        <div class="role-stat"><strong>${count}</strong> عضو</div>
        <div class="role-stat"><strong>${permCount}</strong> صلاحية</div>
        <div class="role-stat"><strong>${r.level}</strong> مستوى</div>
      </div>
      ${isManager && !r.protected ? `<button class="btn-icon" onclick="editRole('${r.id}')" style="margin-right:8px">✏️</button>` : ''}
    </div>`;
  }).join('');
}

function renderMatrix() {
  const roles  = [...rbacRoles].sort((a,b) => b.level - a.level);
  const groups = [...new Set(PERMISSIONS.map(p => p.group))];
  const draft  = matrixDraft || {};
  const isManager = curUser?.roleId === 'manager';

  if (isManager) {
    document.getElementById('matrix-edit-btn').style.display = '';
    document.getElementById('matrix-edit-hint').textContent = matrixEditing ? 'وضع التعديل نشط — انقر على ✅/❌ لتغيير الصلاحية' : '';
  }

  let html = `<tr><th style="text-align:right;min-width:180px">الصلاحية</th>` +
    roles.map(r => `<th><span style="color:${r.color}">${r.icon}</span><br>${r.name}</th>`).join('') + '</tr>';

  groups.forEach(grp => {
    html += `<tr class="group-row"><td colspan="${roles.length + 1}">◆ ${grp}</td></tr>`;
    PERMISSIONS.filter(p => p.group === grp).forEach(p => {
      html += `<tr><td class="perm-label">${p.icon} ${p.label}</td>`;
      roles.forEach(r => {
        const rPerms = matrixEditing ? (draft[r.id] || r.perms) : r.perms;
        const has    = rPerms.includes('*') || rPerms.includes(p.id);
        const sym    = has ? '✅' : '❌';
        if (matrixEditing && !r.protected) {
          html += `<td><span class="perm-check editable" data-role="${r.id}" data-perm="${p.id}" onclick="toggleMatrixCell('${r.id}','${p.id}')">${sym}</span></td>`;
        } else {
          html += `<td><span class="perm-check">${sym}</span></td>`;
        }
      });
      html += '</tr>';
    });
  });

  document.getElementById('matrix-tbody').innerHTML = html;
}

function renderLog() {
  const q  = (document.getElementById('log-search')?.value || '').toLowerCase();
  const af = document.getElementById('log-action-filter')?.value || '';
  let list = [...activityLog];
  if (q)  list = list.filter(e => e.userName?.toLowerCase().includes(q) || e.details?.toLowerCase().includes(q));
  if (af) list = list.filter(e => e.action === af);

  const cls = { create:'log-create', edit:'log-edit', delete:'log-delete', login:'log-login', perm:'log-perm', suspend:'log-delete' };
  const lbl = { create:'إنشاء', edit:'تعديل', delete:'حذف', login:'دخول', perm:'صلاحية', suspend:'تعليق' };

  if (curUser?.roleId === 'manager') document.getElementById('clear-log-btn').style.display = '';

  document.getElementById('log-tbody').innerHTML = list.length
    ? list.slice(0, 100).map(e => `<tr>
        <td>${new Date(e.ts).toLocaleString('ar-EG')}</td>
        <td><strong>${e.userName || '—'}</strong></td>
        <td><span class="log-action ${cls[e.action] || ''}">${lbl[e.action] || e.action}</span></td>
        <td>${e.details || '—'}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;padding:28px;color:var(--text-dim)">لا توجد سجلات</td></tr>';
}

// ─── USER MODAL ───────────────────────────────────────────────
function openUserModal(userId) {
  _uSelectedRole = 'writer';
  document.getElementById('u-edit-id').value = '';
  document.getElementById('u-name').value     = '';
  document.getElementById('u-username').value = '';
  document.getElementById('u-email').value    = '';
  document.getElementById('u-pass').value     = '';
  document.getElementById('u-active').checked = true;
  document.getElementById('u-use-custom-perms').checked = false;
  document.getElementById('perm-override-panel').style.display = 'none';
  document.getElementById('perm-toggle-icon').textContent = '▼';
  document.getElementById('user-modal-title').textContent = 'إضافة عضو جديد';
  updateAvatarPreview();
  buildRoleSelector();
  buildCatsList([]);
  buildPermsList([], false);
  document.getElementById('user-modal').classList.add('open');
}
window.openUserModal = openUserModal;

function editUser(id) {
  const u = users.find(x => x.id === id); if (!u) return;
  _uSelectedRole = u.roleId || 'writer';
  document.getElementById('u-edit-id').value  = id;
  document.getElementById('u-name').value     = u.name;
  document.getElementById('u-username').value = u.user || '';
  document.getElementById('u-email').value    = u.email || '';
  document.getElementById('u-pass').value     = '';
  document.getElementById('u-active').checked = u.active !== false;
  document.getElementById('user-modal-title').textContent = 'تعديل بيانات العضو';
  updateAvatarPreview();
  buildRoleSelector(u.roleId);
  buildCatsList(u.allowedCats || []);
  const hasCustom = Array.isArray(u.customPerms);
  document.getElementById('u-use-custom-perms').checked = hasCustom;
  buildPermsList(u.customPerms || [], hasCustom);
  document.getElementById('user-modal').classList.add('open');
}
window.editUser = editUser;

function closeUserModal() {
  document.getElementById('user-modal').classList.remove('open');
}
window.closeUserModal = closeUserModal;

function buildRoleSelector(selectedId) {
  const isManager = curUser?.roleId === 'manager';
  const curLevel  = rbacRoles.find(r => r.id === curUser?.roleId)?.level || 0;
  // Can only assign roles lower than own level (unless manager)
  const allowedRoles = rbacRoles.filter(r => isManager ? r.id !== 'manager' : r.level < curLevel);

  const colorMap = { manager:'201,168,76', admin:'74,158,255', editor:'160,120,255', writer:'61,220,132' };

  document.getElementById('role-selector').innerHTML = allowedRoles
    .sort((a,b) => b.level - a.level)
    .map(r => `
      <div class="role-opt ${r.id === (selectedId || _uSelectedRole) ? 'selected' : ''}"
           style="--opt-color:${r.color};--opt-rgb:${colorMap[r.id] || '201,168,76'}"
           onclick="selectRole('${r.id}')">
        <div class="ro-icon">${r.icon}</div>
        <div class="ro-name" style="color:${r.color}">${r.name}</div>
        <div class="ro-level">مستوى ${r.level}</div>
      </div>`).join('');

  _uSelectedRole = selectedId || allowedRoles[0]?.id || 'writer';
}

window.selectRole = function(id) {
  _uSelectedRole = id;
  document.querySelectorAll('.role-opt').forEach(el => {
    el.classList.toggle('selected', el.getAttribute('onclick').includes("'" + id + "'"));
  });
};

function buildCatsList(selected) {
  const set = new Set(selected);
  document.getElementById('u-cats-list').innerHTML = catsData.map(c =>
    `<label class="check-row">
      <input type="checkbox" value="${c.name}" ${set.has(c.name) ? 'checked' : ''} style="accent-color:var(--gold)">
      <span>${c.icon || '📂'} ${c.name}</span>
    </label>`).join('') || '<span style="font-size:11px;color:var(--text-dim)">لا توجد أقسام</span>';
}

function buildPermsList(selected, enabled) {
  const set   = new Set(selected);
  const grps  = [...new Set(PERMISSIONS.map(p => p.group))];
  let html = '';
  grps.forEach(g => {
    html += `<div class="section-label" style="grid-column:1/-1">${g}</div>`;
    PERMISSIONS.filter(p => p.group === g).forEach(p => {
      html += `<label class="check-row">
        <input type="checkbox" class="perm-custom-cb" value="${p.id}" ${set.has(p.id) ? 'checked' : ''} ${enabled ? '' : 'disabled'} style="accent-color:var(--gold)">
        <span>${p.icon} ${p.label}</span>
      </label>`;
    });
  });
  document.getElementById('u-perms-list').innerHTML = html;
  document.getElementById('perm-select-btns') &&
    (document.getElementById('perm-select-btns').style.display = enabled ? 'flex' : 'none');
}

window.togglePermOverride = function() {
  const panel = document.getElementById('perm-override-panel');
  const icon  = document.getElementById('perm-toggle-icon');
  const open  = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  icon.textContent = open ? '▲' : '▼';
};

window.toggleCustomPerms = function(checked) {
  document.querySelectorAll('.perm-custom-cb').forEach(cb => cb.disabled = !checked);
  const btns = document.getElementById('perm-select-btns');
  if (btns) btns.style.display = checked ? 'flex' : 'none';
};

window.selectAllCats = function(val) {
  document.querySelectorAll('#u-cats-list input').forEach(cb => cb.checked = val);
};

window.selectAllPerms = function(val) {
  document.querySelectorAll('.perm-custom-cb').forEach(cb => { if (!cb.disabled) cb.checked = val; });
};

window.updateAvatarPreview = function() {
  const name    = document.getElementById('u-name').value.trim();
  const role    = rbacRoles.find(r => r.id === _uSelectedRole);
  const color   = role?.color || '#C9A84C';
  const initials= name.split(' ').slice(0,2).map(w=>w[0]||'').join('') || '?';
  const el      = document.getElementById('u-avatar-preview');
  if (el) { el.textContent = initials; el.style.background = color + '22'; el.style.color = color; }
};

async function saveUser() {
  const name  = document.getElementById('u-name').value.trim();
  const uname = document.getElementById('u-username').value.trim();
  const email = document.getElementById('u-email').value.trim();
  if (!name || !uname || !email) { toast('⚠️ الرجاء تعبئة الحقول المطلوبة'); return; }

  const eid    = document.getElementById('u-edit-id').value;
  const pass   = document.getElementById('u-pass').value;
  const active = document.getElementById('u-active').checked;
  const role   = rbacRoles.find(r => r.id === _uSelectedRole) || rbacRoles[rbacRoles.length - 1];

  const allowedCats = Array.from(document.querySelectorAll('#u-cats-list input:checked')).map(c => c.value);
  const useCustom   = document.getElementById('u-use-custom-perms').checked;
  const customPerms = useCustom
    ? Array.from(document.querySelectorAll('.perm-custom-cb:checked')).map(c => c.value)
    : null;

  const colors = ['#C9A84C','#4A9EFF','#A078FF','#3DDC84','#FF5252','#FF9A3C','#40C8F0'];

  if (eid) {
    const idx = users.findIndex(u => u.id == eid);
    if (idx !== -1) {
      const existing = users[idx];
      users[idx] = {
        ...existing,
        name, user: uname, email,
        roleId:      _uSelectedRole,
        role:        role.name,  // keep old field for compat
        active,
        allowedCats,
        customPerms,
      };
      if (pass) users[idx].pass = pass;
      logActivity('edit', `تعديل بيانات العضو: ${name}`);
      toast('✅ تم تحديث بيانات العضو');
    }
  } else {
    if (users.find(u => u.user === uname)) { toast('⚠️ اسم المستخدم محجوز مسبقاً'); return; }
    const obj = {
      id:         Date.now(),
      name, user: uname, email,
      pass:       pass || Math.random().toString(36).slice(2, 10),
      roleId:     _uSelectedRole,
      role:       role.name,
      active,
      allowedCats,
      customPerms,
      articles:   0,
      color:      colors[Math.floor(Math.random() * colors.length)],
      createdAt:  new Date().toISOString(),
      canAddNews: true,
    };
    users.push(obj);
    logActivity('create', `إنشاء حساب جديد: ${name} — دور: ${role.name}`);
    toast('✅ تم إنشاء الحساب');
  }

  await saveUsers();
  closeUserModal();
  renderUsers(); renderStats();
  // Notify parent to refresh author list
  window.parent.postMessage({ type:'rbac:users_updated' }, '*');
}
window.saveUser = saveUser;

// ─── USER ACTIONS ─────────────────────────────────────────────
window.toggleUserActive = async function(id) {
  const u = users.find(x => x.id === id); if (!u) return;
  u.active = u.active === false;
  await saveUsers();
  logActivity('suspend', `${u.active ? 'تفعيل' : 'تعليق'} حساب: ${u.name}`);
  toast(u.active ? '✅ تم تفعيل الحساب' : '⏸ تم تعليق الحساب');
  renderUsers(); renderStats();
};

window.deleteUser = async function(id) {
  const u = users.find(x => x.id === id); if (!u) return;
  if (!confirm(`هل أنت متأكد من حذف "${u.name}"؟ لا يمكن التراجع.`)) return;
  users = users.filter(x => x.id !== id);
  await saveUsers();
  logActivity('delete', `حذف حساب: ${u.name}`);
  toast('🗑 تم الحذف');
  renderUsers(); renderStats();
  window.parent.postMessage({ type:'rbac:users_updated' }, '*');
};

// ─── ROLE MODAL ───────────────────────────────────────────────
window.openRoleModal = function() {
  document.getElementById('r-edit-id').value = '';
  document.getElementById('r-name').value    = '';
  document.getElementById('r-level').value   = '50';
  document.getElementById('r-icon').value    = '🔰';
  document.getElementById('r-color').value   = '#4A9EFF';
  document.getElementById('r-desc').value    = '';
  buildRolePermsGrid([]);
  document.getElementById('role-modal-title').textContent = 'إضافة دور جديد';
  document.getElementById('role-modal').classList.add('open');
};

window.editRole = function(roleId) {
  const r = rbacRoles.find(x => x.id === roleId); if (!r) return;
  document.getElementById('r-edit-id').value = roleId;
  document.getElementById('r-name').value    = r.name;
  document.getElementById('r-level').value   = r.level;
  document.getElementById('r-icon').value    = r.icon;
  document.getElementById('r-color').value   = r.color;
  document.getElementById('r-desc').value    = r.desc;
  buildRolePermsGrid(r.perms.includes('*') ? PERMISSIONS.map(p => p.id) : r.perms);
  document.getElementById('role-modal-title').textContent = 'تعديل الدور';
  document.getElementById('role-modal').classList.add('open');
};

function buildRolePermsGrid(selected) {
  const set  = new Set(selected);
  const grps = [...new Set(PERMISSIONS.map(p => p.group))];
  let html = '';
  grps.forEach(g => {
    html += `<div class="section-label" style="grid-column:1/-1">${g}</div>`;
    PERMISSIONS.filter(p => p.group === g).forEach(p => {
      html += `<label class="check-row"><input type="checkbox" value="${p.id}" ${set.has(p.id) ? 'checked' : ''} style="accent-color:var(--gold)"><span>${p.icon} ${p.label}</span></label>`;
    });
  });
  document.getElementById('r-perms-grid').innerHTML = html;
}

window.saveRole = async function() {
  const eid   = document.getElementById('r-edit-id').value;
  const name  = document.getElementById('r-name').value.trim();
  const level = parseInt(document.getElementById('r-level').value) || 50;
  const icon  = document.getElementById('r-icon').value.trim() || '🔰';
  const color = document.getElementById('r-color').value;
  const desc  = document.getElementById('r-desc').value.trim();
  const perms = Array.from(document.querySelectorAll('#r-perms-grid input:checked')).map(c => c.value);
  if (!name) { toast('⚠️ أدخل اسم الدور'); return; }

  if (eid) {
    const idx = rbacRoles.findIndex(r => r.id === eid);
    if (idx !== -1) { rbacRoles[idx] = { ...rbacRoles[idx], name, level, icon, color, desc, perms }; }
    logActivity('perm', `تعديل الدور: ${name}`);
    toast('✅ تم تحديث الدور');
  } else {
    const newId = name.replace(/\s+/g, '_').toLowerCase() + '_' + Date.now();
    rbacRoles.push({ id:newId, name, level, icon, color, desc, perms, protected:false });
    logActivity('create', `إنشاء دور جديد: ${name}`);
    toast('✅ تم إنشاء الدور');
  }

  await saveRoles();
  closeModal('role-modal');
  renderRoles(); renderMatrix();
  window.parent.postMessage({ type:'rbac:roles_updated', roles: rbacRoles }, '*');
};

// ─── MATRIX ───────────────────────────────────────────────────
window.toggleMatrixEdit = function() {
  matrixEditing  = !matrixEditing;
  matrixDraft    = matrixEditing ? {} : null;
  const editBtn  = document.getElementById('matrix-edit-btn');
  const saveBtn  = document.getElementById('matrix-save-btn');
  const hint     = document.getElementById('matrix-edit-hint');
  editBtn.textContent = matrixEditing ? '✕ إلغاء' : '✏️ تعديل';
  saveBtn.style.display = matrixEditing ? '' : 'none';
  hint.textContent = matrixEditing ? '⚠️ وضع التعديل نشط' : '';
  renderMatrix();
};

window.toggleMatrixCell = function(roleId, permId) {
  if (!matrixDraft) matrixDraft = {};
  const role = rbacRoles.find(r => r.id === roleId);
  if (!matrixDraft[roleId]) matrixDraft[roleId] = [...(role?.perms || [])].filter(p => p !== '*');
  const idx = matrixDraft[roleId].indexOf(permId);
  if (idx === -1) matrixDraft[roleId].push(permId);
  else            matrixDraft[roleId].splice(idx, 1);
  renderMatrix();
};

window.saveMatrix = async function() {
  if (!matrixDraft) return;
  Object.entries(matrixDraft).forEach(([roleId, perms]) => {
    const r = rbacRoles.find(x => x.id === roleId);
    if (r && !r.protected) r.perms = perms;
  });
  await saveRoles();
  matrixEditing = false; matrixDraft = null;
  document.getElementById('matrix-edit-btn').textContent = '✏️ تعديل';
  document.getElementById('matrix-save-btn').style.display = 'none';
  document.getElementById('matrix-edit-hint').textContent = '';
  renderMatrix();
  logActivity('perm', 'تعديل مصفوفة الصلاحيات');
  toast('✅ تم حفظ التغييرات');
};

// ─── FILTERS ──────────────────────────────────────────────────
window.filterUsers = renderUsers;
window.filterLog   = renderLog;

// ─── LOG ACTIONS ──────────────────────────────────────────────
window.clearLog = async function() {
  if (!confirm('هل تريد مسح سجل النشاط بالكامل؟')) return;
  activityLog = [];
  await setDoc(doc(_db, DB.SETTINGS, 'activity_log'), { entries: [] });
  renderLog(); toast('🗑 تم مسح السجل');
};

// ─── TAB SWITCH ───────────────────────────────────────────────
window.switchTab = function(id, btn) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id)?.classList.add('active');
  btn?.classList.add('active');
  if (id === 'matrix')   renderMatrix();
  if (id === 'log')      renderLog();
  if (id === 'password') {
    const sec = document.getElementById('admin-pw-section');
    if (curUser?.roleId === 'manager' && sec) { sec.style.display = ''; _buildAdminPwUserList(); }
  }
};

// ─── MODAL HELPERS ────────────────────────────────────────────
window.closeModal = function(id) {
  document.getElementById(id)?.classList.remove('open');
};

// ─── TOAST ────────────────────────────────────────────────────
function toast(msg) {
  const el = document.getElementById('rbac-toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}
// ─── CHANGE PASSWORD ──────────────────────────────────────────
function rbacCheckPwStrength(pw) {
  const fill = document.getElementById('rbac-pw-fill'); if (!fill) return;
  const s = [/.{8,}/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(r => r.test(pw)).length;
  fill.style.width = (s * 25) + '%';
  fill.style.background = ['#FF5252','#FF9A3C','#C9A84C','#3DDC84'][s - 1] || '#FF5252';
}
window.rbacCheckPwStrength = rbacCheckPwStrength;

async function changeRbacPassword() {
  const errEl = document.getElementById('pw-rbac-error');
  const okEl  = document.getElementById('pw-rbac-success');
  [errEl, okEl].forEach(el => { if(el) el.style.display = 'none'; });
  const show = (el, msg) => { if(el) { el.textContent = msg; el.style.display = 'block'; } };
  if (!curUser) { show(errEl, '⚠️ لست مسجلاً'); return; }
  const cur   = (document.getElementById('rbac-pw-current')?.value || '').trim();
  const newPw = (document.getElementById('rbac-pw-new')?.value     || '').trim();
  const conf  = (document.getElementById('rbac-pw-confirm')?.value  || '').trim();
  if (!cur)             { show(errEl, '⚠️ أدخل كلمة المرور الحالية'); return; }
  if (newPw.length < 6) { show(errEl, '⚠️ كلمة المرور الجديدة 6 أحرف على الأقل'); return; }
  if (newPw !== conf)   { show(errEl, '❌ كلمة المرور الجديدة غير متطابقة'); return; }
  try {
    let verified = false;
    if (curUser.username === 'admin') {
      const stored = JSON.parse(localStorage.getItem('atq_user_passwords') || '{}');
      verified = cur === (stored['admin'] || 'admin123');
    } else {
      const snap = await getDoc(doc(_db, DB.SETTINGS, 'editors'));
      const ed = (snap.exists() ? snap.data().items || [] : []).find(e => e.user === curUser.username);
      verified = ed && ed.pass === cur;
    }
    if (!verified) { show(errEl, '❌ كلمة المرور الحالية غير صحيحة'); return; }
    if (curUser.username === 'admin') {
      const s2 = JSON.parse(localStorage.getItem('atq_user_passwords') || '{}');
      s2['admin'] = newPw;
      localStorage.setItem('atq_user_passwords', JSON.stringify(s2));
    } else {
      const snap2 = await getDoc(doc(_db, DB.SETTINGS, 'editors'));
      const eds = snap2.exists() ? snap2.data().items || [] : [];
      const i   = eds.findIndex(e => e.user === curUser.username);
      if (i !== -1) {
        eds[i].pass = newPw;
        await setDoc(doc(_db, DB.SETTINGS, 'editors'), { items: eds });
        localStorage.setItem('atq_editors', JSON.stringify(eds));
        const pw = JSON.parse(localStorage.getItem('atq_user_passwords') || '{}');
        pw[curUser.username] = newPw;
        localStorage.setItem('atq_user_passwords', JSON.stringify(pw));
      }
    }
    ['rbac-pw-current','rbac-pw-new','rbac-pw-confirm'].forEach(id => {
      const el = document.getElementById(id); if(el) el.value = '';
    });
    const f = document.getElementById('rbac-pw-fill'); if(f) f.style.width = '0';
    logActivity('edit', 'تغيير كلمة مرور الحساب الشخصي');
    show(okEl, '✅ تم تحديث كلمة المرور بنجاح!');
    toast('✅ تم تحديث كلمة المرور');
    window.parent.postMessage({ type:'rbac:users_updated' }, '*');
  } catch(e) { show(errEl, '❌ خطأ: ' + (e.message || e)); }
}
window.changeRbacPassword = changeRbacPassword;

function _buildAdminPwUserList() {
  const sel = document.getElementById('admin-pw-user'); if (!sel) return;
  sel.innerHTML = users.map(u => `<option value="${u.user}">${u.name} (@${u.user})</option>`).join('');
}

async function adminChangeOtherPassword() {
  const msgEl = document.getElementById('admin-pw-msg'); if(msgEl) msgEl.textContent = '';
  const uname = document.getElementById('admin-pw-user')?.value;
  const newPw = (document.getElementById('admin-pw-new')?.value || '').trim();
  if (!uname || newPw.length < 6) {
    if(msgEl){ msgEl.textContent='⚠️ اختر عضواً وأدخل كلمة مرور (6 أحرف+)'; msgEl.style.color='var(--red)'; }
    return;
  }
  try {
    const snap = await getDoc(doc(_db, DB.SETTINGS, 'editors'));
    const eds  = snap.exists() ? snap.data().items || [] : [];
    const i    = eds.findIndex(e => e.user === uname);
    if (i === -1) { if(msgEl){ msgEl.textContent='❌ المستخدم غير موجود'; msgEl.style.color='var(--red)'; } return; }
    eds[i].pass = newPw;
    await setDoc(doc(_db, DB.SETTINGS, 'editors'), { items: eds });
    localStorage.setItem('atq_editors', JSON.stringify(eds));
    const pw = JSON.parse(localStorage.getItem('atq_user_passwords') || '{}');
    pw[uname] = newPw; localStorage.setItem('atq_user_passwords', JSON.stringify(pw));
    logActivity('edit', `تغيير كلمة مرور العضو: ${eds[i].name}`);
    if(msgEl){ msgEl.textContent='✅ تم التحديث'; msgEl.style.color='var(--green)'; }
    document.getElementById('admin-pw-new').value = '';
    toast('✅ تم تحديث كلمة المرور');
    window.parent.postMessage({ type:'rbac:users_updated' }, '*');
  } catch(e) {
    if(msgEl){ msgEl.textContent='❌ خطأ: '+(e.message||e); msgEl.style.color='var(--red)'; }
  }
}
window.adminChangeOtherPassword = adminChangeOtherPassword;

window._rbacToast = toast;

// ─── THEME TOGGLE ─────────────────────────────────────────────
function toggleRbacTheme() {
  const isLight = document.body.classList.toggle('light');
  const btn = document.getElementById('rbac-theme-btn');
  if (btn) btn.textContent = isLight ? '🌙 داكن' : '🌙 فاتح';
  try { localStorage.setItem('atq_rbac_theme', isLight ? 'light' : 'dark'); } catch(_) {}
}
window.toggleRbacTheme = toggleRbacTheme;

// ─── STANDALONE LOGOUT ────────────────────────────────────────
function doRbacLogout() {
  if (!_isInIframe) {
    localStorage.removeItem('atq_rbac_user');
    curUser = null;
    document.getElementById('standalone-login').style.display = 'flex';
    document.getElementById('rbac-logout-btn').style.display = 'none';
    document.getElementById('cur-user-display').style.display = 'none';
    document.getElementById('tab-bar').style.display = 'flex';
    document.getElementById('rl-pass').value = '';
  } else {
    // In iframe — tell parent to logout
    window.parent.postMessage('rbac:back', '*');
  }
}
window.doRbacLogout = doRbacLogout;

// ─── STANDALONE LOGIN HANDLER ─────────────────────────────────
async function rbacStandaloneLogin() {
  const u   = (document.getElementById('rl-user').value || '').trim();
  const p   =  document.getElementById('rl-pass').value || '';
  const btn = document.getElementById('rl-btn');
  const err = document.getElementById('login-error-msg');
  err.textContent = '';
  if (!u || !p) { err.textContent = '⚠️ أدخل اسم المستخدم وكلمة المرور'; return; }
  btn.textContent = '...'; btn.disabled = true;
  try {
    const snap = await getDoc(doc(_db, DB.SETTINGS, 'editors'));
    const edList = snap.exists() ? (snap.data().items || []) : [];
    let roles = [...DEFAULT_ROLES];
    try {
      const rs = await getDoc(doc(_db, DB.SETTINGS, 'rbac'));
      if (rs.exists() && rs.data().roles?.length) roles = rs.data().roles;
    } catch(_) {}

    let matched = null;
    if (u === 'admin') {
      const pw = JSON.parse(localStorage.getItem('atq_user_passwords') || '{}');
      if (p === (pw['admin'] || 'admin123')) {
        matched = { id:'admin', username:'admin', name:'المدير العام', roleId:'manager', customPerms:null };
      }
    } else {
      const ed = edList.find(e => e.user === u);
      if (ed && ed.pass === p && ed.active !== false) {
        const rid   = ed.roleId || 'editor';
        const rObj  = roles.find(r => r.id === rid);
        if (rObj && rObj.level >= 80) {
          matched = { id: ed.id, username: u, name: ed.name, roleId: rid, customPerms: ed.customPerms || null };
        } else {
          err.textContent = '🚫 صلاحياتك لا تسمح بالوصول إلى هذه الصفحة';
          btn.textContent = 'دخول ←'; btn.disabled = false; return;
        }
      }
    }
    if (!matched) {
      err.textContent = '❌ اسم المستخدم أو كلمة المرور غير صحيحة';
      btn.textContent = 'دخول ←'; btn.disabled = false; return;
    }
    localStorage.setItem('atq_rbac_user', JSON.stringify(matched));
    rbacRoles = roles;
    localStorage.setItem('atq_rbac_roles', JSON.stringify(roles));
    curUser = matched;
    document.getElementById('standalone-login').style.display = 'none';
    _showTopbarUser();
    await loadData();
    renderStats(); renderRoles(); renderMatrix();
    logActivity('login', 'تسجيل دخول مباشر — RBAC');
  } catch(e) {
    err.textContent = '❌ خطأ في الاتصال: ' + (e.message || e);
    btn.textContent = 'دخول ←'; btn.disabled = false;
  }
}
window.rbacStandaloneLogin = rbacStandaloneLogin;

function _showTopbarUser() {
  if (!curUser) return;
  const role     = rbacRoles.find(r => r.id === curUser.roleId);
  const initials = (curUser.name || '?').split(' ').slice(0,2).map(w=>w[0]).join('');
  document.getElementById('cur-user-display').style.display = 'flex';
  document.getElementById('topbar-avatar').textContent      = initials;
  document.getElementById('topbar-avatar').style.background = (role?.color || '#C9A84C') + '22';
  document.getElementById('topbar-avatar').style.color      = role?.color || '#C9A84C';
  document.getElementById('topbar-name').textContent        = curUser.name;
  document.getElementById('topbar-role').textContent        = role?.name || '—';
  // Show logout button (only in standalone tab, not iframe)
  if (!_isInIframe) {
    const logoutBtn = document.getElementById('rbac-logout-btn');
    if (logoutBtn) logoutBtn.style.display = '';
  }
}

// ─── INIT ─────────────────────────────────────────────────────
const _isInIframe = (() => { try { return window.self !== window.top; } catch(_) { return true; } })();

// Apply saved theme immediately
(function() {
  try {
    const t = localStorage.getItem('atq_rbac_theme');
    if (t === 'light') {
      document.body.classList.add('light');
      const btn = document.getElementById('rbac-theme-btn');
      if (btn) btn.textContent = '🌙 داكن';
    }
  } catch(_) {}
})();

async function init() {
  // Load roles
  try {
    const rs = await getDoc(doc(_db, DB.SETTINGS, 'rbac'));
    if (rs.exists() && rs.data().roles?.length) {
      rbacRoles = rs.data().roles;
      localStorage.setItem('atq_rbac_roles', JSON.stringify(rbacRoles));
    }
  } catch(_) {}

  if (!_isInIframe) {
    // Standalone new-tab: always require login
    document.getElementById('standalone-login').style.display = 'flex';
    try {
      const stored = localStorage.getItem('atq_rbac_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u && u.username) document.getElementById('rl-user').value = u.username;
      }
    } catch(_) {}
    return;
  }

  // In iframe from admin.html — trust session already set
  if (!checkAuth()) {
    document.getElementById('access-denied').style.display = 'flex';
    document.getElementById('tab-bar').style.display = 'none';
    const ap = document.getElementById('rbac-main').querySelector('.tab-pane.active');
    if (ap) ap.classList.remove('active');
    return;
  }
  _showTopbarUser();
  await loadData();
  renderStats(); renderRoles(); renderMatrix();
  logActivity('login', 'فتح لوحة إدارة الأعضاء');
}

init();
