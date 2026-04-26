// ================================================================
// assets/js/admin-sections.js — News Sections Management
// Controls BOTH built-in sections (trending, featured, hero, etc.)
// AND custom user-defined sections.
//
// Fix 1: Sections stored in settings/custom_sections (own Firestore doc)
// Fix 2: Called on initDashboard so Add News form checkboxes always ready
// Fix 3: Built-in sections shown at top of admin page for central control
// ================================================================

import { db }                          from '/modules/firebase.js';
import { doc, setDoc, getDoc, onSnapshot }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { DB }                          from '/config.js';

const SECTIONS_DOC = 'custom_sections';

export const SECTION_LAYOUTS = [
  { value: 'scroll',   label: '↔ تمرير أفقي' },
  { value: 'grid',     label: '⊞ شبكة بطاقات' },
  { value: 'list',     label: '≡ قائمة عمودية' },
  { value: 'featured', label: '★ بطاقة مميزة كبيرة' },
];
export const SECTION_LOCATIONS = [
  { value: 'after-hero',     label: 'بعد الخبر الرئيسي' },
  { value: 'after-trending', label: 'بعد الأكثر تداولاً' },
  { value: 'after-grid',     label: 'بعد شبكة الأخبار' },
  { value: 'before-footer',  label: 'قبل التذييل' },
];
export const SECTION_SORTS = [
  { value: 'newest', label: 'الأحدث أولاً' },
  { value: 'views',  label: 'الأكثر مشاهدةً' },
  { value: 'manual', label: 'ترتيب يدوي' },
];

let _sectionsCache = [];
let _listenerStarted = false;

// ─────────────────────────────────────────────────────────────────
// Firebase helpers
// ─────────────────────────────────────────────────────────────────
async function _readSections() {
  try {
    const snap = await getDoc(doc(db, DB.SETTINGS, SECTIONS_DOC));
    return snap.exists() ? (snap.data().items || []) : [];
  } catch (e) { console.warn('[Sections] read:', e); return []; }
}
async function _writeSections(list) {
  try {
    await setDoc(doc(db, DB.SETTINGS, SECTIONS_DOC), { items: list });
    _sectionsCache = list;
  } catch (e) { console.warn('[Sections] write:', e); window.showToast?.('خطأ في حفظ الأقسام'); }
}
export function startSectionsListener(onChange) {
  return onSnapshot(doc(db, DB.SETTINGS, SECTIONS_DOC), snap => {
    _sectionsCache = snap.exists() ? (snap.data().items || []) : [];
    if (typeof onChange === 'function') onChange(_sectionsCache);
  }, err => console.warn('[Sections] listener:', err));
}
export function getSectionsCache() { return _sectionsCache; }

// ─────────────────────────────────────────────────────────────────
// CRUD — custom sections
// ─────────────────────────────────────────────────────────────────
export async function addSection() {
  const list = await _readSections();
  const id   = 'section_' + Date.now();
  list.push({ id, name: 'قسم جديد', icon: '📋', description: '',
    layout: 'scroll', location: 'after-trending', sort: 'newest',
    maxItems: 8, color: '#C9A84C', active: false, showTitle: true,
    newsFlag: id, createdAt: new Date().toISOString() });
  await _writeSections(list);
  _afterChange(list);
  window.showToast?.('تم إضافة قسم جديد');
}
export async function updateSection(id, field, val) {
  const list = await _readSections();
  const s    = list.find(x => x.id === id); if (!s) return;
  s[field] = val; await _writeSections(list);
  if (['active','layout','location','sort'].includes(field)) { _afterChange(list); window.showToast?.('تم الحفظ'); }
  else { clearTimeout(window._sectSaveTimer); window._sectSaveTimer = setTimeout(() => { _afterChange(list); window.showToast?.('تم الحفظ'); }, 700); }
}
export async function deleteSection(id) {
  if (!confirm('هل تريد حذف هذا القسم؟')) return;
  const list = (await _readSections()).filter(s => s.id !== id);
  await _writeSections(list); _afterChange(list); window.showToast?.('تم الحذف');
}
export async function toggleSectionActive(id) {
  const list = await _readSections();
  const s    = list.find(x => x.id === id); if (!s) return;
  s.active = !s.active; await _writeSections(list); _afterChange(list);
  window.showToast?.(s.active ? 'القسم مفعّل على الموقع' : 'القسم موقوف');
}

// ─────────────────────────────────────────────────────────────────
// Fix 3: Built-in sections toggle
// ─────────────────────────────────────────────────────────────────
export function toggleBuiltinSection(id, enabled) {
  if (id === '__trending__') {
    if (typeof window.saveTrendingToggle === 'function') window.saveTrendingToggle(enabled);
    // update the display immediately
    setTimeout(renderBuiltInSections, 300);
  }
}

// ─────────────────────────────────────────────────────────────────
// Fix 3: Render built-in sections at top of page
// ─────────────────────────────────────────────────────────────────
export function renderBuiltInSections() {
  const cont = document.getElementById('builtin-sections-list');
  if (!cont) return;

  let trendingOn = true;
  try {
    const sc = localStorage.getItem('atq_cache_site');
    if (sc) trendingOn = JSON.parse(sc).trending_enabled !== false;
  } catch (_) {}

  const builtins = [
    { id: '__hero__',     name: 'الخبر الرئيسي',    icon: '🎯', desc: 'الخبر العاجل في الواجهة الرئيسية',          layout: 'featured', location: 'أعلى الصفحة',        active: true,       canToggle: false },
    { id: '__trending__', name: 'الأكثر تداولاً',   icon: '🔥', desc: 'شريط التمرير الأفقي أسفل الخبر الرئيسي',   layout: 'scroll',   location: 'بعد الخبر الرئيسي', active: trendingOn, canToggle: true  },
    { id: '__featured__', name: 'أبرز المقالات',    icon: '⭐', desc: 'البطاقة الكبيرة بجانب الخبر الرئيسي',       layout: 'featured', location: 'بجانب الخبر الرئيسي',active: true,       canToggle: false },
    { id: '__grid__',     name: 'شبكة الأخبار',     icon: '⊞', desc: 'البطاقات الست الرئيسية أسفل الواجهة',        layout: 'grid',     location: 'وسط الصفحة',          active: true,       canToggle: false },
  ];

  cont.innerHTML = builtins.map(s => {
    const badge = s.active
      ? `<span style="font-size:11px;color:var(--green);font-weight:700">● نشط</span>`
      : `<span style="font-size:11px;color:var(--text-dim)">● مخفي</span>`;
    const toggle = s.canToggle
      ? `<label style="position:relative;display:inline-block;width:44px;height:22px;cursor:pointer;flex-shrink:0">
           <input type="checkbox" ${s.active ? 'checked' : ''} onchange="toggleBuiltinSection('${s.id}',this.checked)" style="opacity:0;width:0;height:0">
           <span style="position:absolute;cursor:pointer;inset:0;background:${s.active ? '#3DDC84' : 'var(--dark-4)'};border-radius:22px;transition:.3s">
             <span style="position:absolute;height:16px;width:16px;right:${s.active ? '24px' : '3px'};bottom:3px;background:white;border-radius:50%;transition:.3s"></span>
           </span>
         </label>`
      : `<span style="font-size:11px;padding:3px 8px;background:rgba(201,168,76,.1);color:var(--gold);border-radius:16px;white-space:nowrap;flex-shrink:0">دائم</span>`;
    return `<div style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:var(--dark-3);border-radius:12px;border:1px solid var(--border-dim)">
      ${toggle}
      <span style="font-size:22px">${s.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;color:var(--text)">${s.name}</div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${s.desc}</div>
      </div>
      <div style="text-align:left;font-size:11px;color:var(--text-dim);flex-shrink:0">
        <div>${s.layout} · ${s.location}</div>
        <div style="margin-top:3px">${badge}</div>
      </div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────
// Fix 2: Render custom sections admin list
// ─────────────────────────────────────────────────────────────────
export function renderSectionsAdmin(list) {
  const cont = document.getElementById('custom-sections-list');
  if (!cont) return;
  if (!list || !list.length) {
    cont.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim);font-size:13px">لا توجد أقسام مخصصة بعد. اضغط «إضافة قسم جديد» للإنشاء.</div>';
    return;
  }
  cont.innerHTML = list.map(s => {
    const color = s.color || '#C9A84C';
    const lo = SECTION_LAYOUTS.map(l => `<option value="${l.value}" ${s.layout===l.value?'selected':''}>${l.label}</option>`).join('');
    const po = SECTION_LOCATIONS.map(l => `<option value="${l.value}" ${s.location===l.value?'selected':''}>${l.label}</option>`).join('');
    const so = SECTION_SORTS.map(l => `<option value="${l.value}" ${s.sort===l.value?'selected':''}>${l.label}</option>`).join('');
    return `<div class="card" style="border:2px solid ${s.active?color+'88':'var(--border-dim)'};margin-bottom:16px;transition:.2s">
      <div style="padding:14px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border-dim);flex-wrap:wrap">
        <label style="position:relative;display:inline-block;width:44px;height:22px;cursor:pointer;flex-shrink:0">
          <input type="checkbox" ${s.active?'checked':''} onchange="toggleSectionActive('${s.id}')" style="opacity:0;width:0;height:0">
          <span style="position:absolute;cursor:pointer;inset:0;background:${s.active?color:'var(--dark-4)'};border-radius:22px;transition:.3s">
            <span style="position:absolute;height:16px;width:16px;right:${s.active?'24px':'3px'};bottom:3px;background:white;border-radius:50%;transition:.3s"></span>
          </span>
        </label>
        <span style="font-size:22px">${s.icon||'📋'}</span>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700;color:var(--text)">${s.name}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:2px">
            ${SECTION_LAYOUTS.find(l=>l.value===s.layout)?.label||s.layout} · ${SECTION_LOCATIONS.find(l=>l.value===s.location)?.label||s.location}
            ${s.active?`<span style="color:${color};font-weight:700"> · نشط</span>`:''}
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <code style="background:var(--dark-4);padding:2px 8px;border-radius:4px;font-size:10px;color:var(--text-dim)">${s.newsFlag||s.id}</code>
          <button onclick="deleteSection('${s.id}')" style="background:none;border:1px solid rgba(255,82,82,.3);color:var(--red);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px">🗑 حذف</button>
        </div>
      </div>
      <div style="padding:16px 18px;display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="form-group" style="margin:0"><label class="form-label">اسم القسم</label>
          <input class="form-input" value="${(s.name||'').replace(/"/g,'&quot;')}" oninput="updateSection('${s.id}','name',this.value)"></div>
        <div class="form-group" style="margin:0"><label class="form-label">أيقونة</label>
          <input class="form-input" value="${s.icon||'📋'}" maxlength="4" oninput="updateSection('${s.id}','icon',this.value)" style="font-size:20px;text-align:center"></div>
        <div class="form-group" style="margin:0"><label class="form-label">طريقة العرض</label>
          <select class="form-select" onchange="updateSection('${s.id}','layout',this.value)">${lo}</select></div>
        <div class="form-group" style="margin:0"><label class="form-label">موقع الظهور</label>
          <select class="form-select" onchange="updateSection('${s.id}','location',this.value)">${po}</select></div>
        <div class="form-group" style="margin:0"><label class="form-label">ترتيب الأخبار</label>
          <select class="form-select" onchange="updateSection('${s.id}','sort',this.value)">${so}</select></div>
        <div class="form-group" style="margin:0"><label class="form-label">عدد الأخبار</label>
          <input class="form-input" type="number" min="1" max="20" value="${s.maxItems||8}" oninput="updateSection('${s.id}','maxItems',parseInt(this.value)||8)"></div>
        <div class="form-group" style="margin:0"><label class="form-label">اللون</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="color" value="${s.color||'#C9A84C'}" onchange="updateSection('${s.id}','color',this.value)" style="width:44px;height:36px;border:none;cursor:pointer;background:none">
            <input class="form-input" value="${s.color||'#C9A84C'}" oninput="updateSection('${s.id}','color',this.value)" style="font-family:monospace;font-size:12px">
          </div></div>
        <div class="form-group" style="margin:0"><label class="form-label">وصف (اختياري)</label>
          <input class="form-input" value="${(s.description||'').replace(/"/g,'&quot;')}" placeholder="يظهر تحت اسم القسم" oninput="updateSection('${s.id}','description',this.value)"></div>
      </div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────
// Sync into Add News form (checkboxes + priority dropdown)
// ─────────────────────────────────────────────────────────────────
export function syncSectionCheckboxesToNewsForm(list) {
  const wrap = document.getElementById('n-custom-sections-wrap');
  if (!wrap) return;
  const active = (list || []).filter(s => s.active);
  if (!active.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  wrap.innerHTML = `<label class="form-label">إظهار في الأقسام المخصصة</label>
    <div style="background:var(--dark-3);border:1px solid var(--border-dim);border-radius:10px;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${active.map(s => `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px">
        <input type="checkbox" id="n-section-${s.id}" style="width:14px;height:14px">
        <span>${s.icon} <strong style="color:${s.color||'var(--gold)'}">${s.name}</strong></span>
      </label>`).join('')}
    </div>`;
}

function _syncSectionsToPriorityDropdown(list) {
  const sel = document.getElementById('n-priority');
  if (!sel) return;
  // Remove previously injected options
  Array.from(sel.options).forEach(opt => { if (opt.dataset.cs) opt.remove(); });
  // Inject active custom sections
  (list || []).filter(s => s.active).forEach(s => {
    const opt = new Option(s.icon + ' ' + s.name, s.newsFlag || s.id);
    opt.dataset.cs = '1';
    sel.appendChild(opt);
  });
}

export function getCheckedCustomSections(all) {
  const res = {};
  (all || _sectionsCache).filter(s => s.active).forEach(s => {
    const el = document.getElementById('n-section-' + s.id);
    res[s.newsFlag || s.id] = !!(el && el.checked);
  });
  return res;
}
export function setCustomSectionCheckboxes(article, all) {
  (all || _sectionsCache).filter(s => s.active).forEach(s => {
    const el = document.getElementById('n-section-' + s.id);
    if (el) el.checked = !!(article && article[s.newsFlag || s.id]);
  });
}
export function resetCustomSectionCheckboxes(all) {
  (all || _sectionsCache).filter(s => s.active).forEach(s => {
    const el = document.getElementById('n-section-' + s.id);
    if (el) el.checked = false;
  });
}

function _afterChange(list) {
  renderBuiltInSections();
  renderSectionsAdmin(list);
  syncSectionCheckboxesToNewsForm(list);
  _syncSectionsToPriorityDropdown(list);
}

// ─────────────────────────────────────────────────────────────────
// Init — called from initDashboard and when navigating to page
// ─────────────────────────────────────────────────────────────────
export async function initAdminSections() {
  const list = await _readSections();
  _sectionsCache = list;
  renderBuiltInSections();
  renderSectionsAdmin(list);
  syncSectionCheckboxesToNewsForm(list);
  _syncSectionsToPriorityDropdown(list);
  if (!_listenerStarted) {
    _listenerStarted = true;
    startSectionsListener(updated => _afterChange(updated));
  }
}

// ─────────────────────────────────────────────────────────────────
// Window exposures
// ─────────────────────────────────────────────────────────────────
window.addSection            = addSection;
window.updateSection         = updateSection;
window.deleteSection         = deleteSection;
window.toggleSectionActive   = toggleSectionActive;
window.toggleBuiltinSection  = toggleBuiltinSection;
window.renderBuiltInSections = renderBuiltInSections;
